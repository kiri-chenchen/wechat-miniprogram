import express from "express";
import { agui, createExpressRoutes } from "@cloudbase/agent-server";
import { AdpAgent } from "@cloudbase/agent-adapter-adp";
import dotenvx from "@dotenvx/dotenvx";
import { Observable } from "rxjs";
import { randomUUID } from "crypto";
import { jwtDecode } from "jwt-decode";
import {
  WeChatAgent,
  createWxMessageHandler,
  WeChatHistoryManager,
} from "@cloudbase/agent-adapter-wx";
import {
  DetectCloudbaseUserMiddleware,
  buildAgentUserPrompt,
  buildPlatformGroundingContext,
} from "./utils.js";
import { buildDirectAnswer } from "./direct-answer.js";

dotenvx.config();

const PORT = Number(process.env.PORT || 9000);

class MyAgent extends AdpAgent {
  generateRequestBody({ message, fileInfos, input }) {
    return super.generateRequestBody({
      message,
      fileInfos,
      input,
    });
  }
}

class PatchedWeChatAgent extends WeChatAgent {
  constructor(config) {
    super(config);
    this.finalReplyCache = "";
  }

  handleWeChatSending(event, input) {
    if (event?.type === "TEXT_MESSAGE_CHUNK") {
      this.messageBuffer += event.delta || event.content || "";
      return;
    }

    if (event?.type === "RUN_FINISHED") {
      this.lastReply = this.messageBuffer.trim();
      if (this.lastReply) {
        this.finalReplyCache = this.lastReply;
        this.sendToWeChat(this.lastReply, input).catch(console.error);
        this.messageBuffer = "";
      }
      return;
    }

    super.handleWeChatSending(event, input);
  }

  async sendToWeChat(content, input) {
    if (content) {
      this.finalReplyCache = content;
    }
    return super.sendToWeChat(content, input);
  }

  run(input) {
    const original$ = super.run(input);

    return new Observable((subscriber) => {
      const subscription = original$.subscribe({
        next: (event) => subscriber.next(event),
        error: (error) => subscriber.error(error),
        complete: () => {
          if (!this.lastReply && this.finalReplyCache) {
            this.lastReply = this.finalReplyCache;
          }
          subscriber.complete();
        },
      });

      return () => subscription.unsubscribe();
    });
  }
}

function createAgent({ request }) {
  console.log("[agent-yuxiaohe] createAgent", {
    hasAppKey: !!process.env.ADP_APP_KEY,
    envId: process.env.TCB_ENV || process.env.ENV_ID || "",
    method: request?.method,
    path: request?.path,
  });

  const agent = new MyAgent({
    adpConfig: {
      appKey: process.env.ADP_APP_KEY || "",
      credential: {
        secretId: process.env.TENCENTCLOUD_SECRETID || "",
        secretKey: process.env.TENCENTCLOUD_SECRETKEY || "",
        token: process.env.TENCENTCLOUD_SESSIONTOKEN || "",
      },
      enableUpload: false,
    },
  });

  agent.use(new DetectCloudbaseUserMiddleware(request));
  return agent;
}

function createBaseAgent() {
  return new MyAgent({
    adpConfig: {
      appKey: process.env.ADP_APP_KEY || "",
      credential: {
        secretId: process.env.TENCENTCLOUD_SECRETID || "",
        secretKey: process.env.TENCENTCLOUD_SECRETKEY || "",
        token: process.env.TENCENTCLOUD_SESSIONTOKEN || "",
      },
      enableUpload: false,
    },
  });
}

function extractCloudbaseUserId(request) {
  const authorization =
    request?.headers?.authorization ||
    request?.headers?.Authorization ||
    request?.headers?.get?.("authorization") ||
    request?.headers?.get?.("Authorization") ||
    "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return "";
  }

  try {
    const payload = jwtDecode(token);
    return payload?.uid || payload?.sub || payload?.openid || payload?.user_id || "";
  } catch (error) {
    console.warn(
      "[agent-yuxiaohe] jwt decode failed",
      error?.message || error
    );
    return "";
  }
}

function createWxAgent({ request, options }) {
  console.log("[agent-yuxiaohe] createWxAgent", {
    agentId: options?.agentId,
    method: request?.method,
    path: request?.path,
  });

  const baseAgent = createAgent({ request });
  const envId = process.env.TCB_ENV || process.env.ENV_ID || "";
  const authorization =
    request.headers.authorization ||
    request.headers.Authorization ||
    request.headers.get?.("authorization") ||
    request.headers.get?.("Authorization") ||
    "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  return {
    agent: new PatchedWeChatAgent({
      agentId: options?.agentId || process.env.AGENT_ID || "agent-yuxiaohe",
      agent: baseAgent,
      wechatConfig: {
        sendMode: "aitools",
        context: {
          extendedContext: {
            envId,
            accessToken,
          },
        },
      },
      historyManager: new WeChatHistoryManager({
        envId,
      }),
    }),
  };
}

function createRunId() {
  try {
    return randomUUID();
  } catch (error) {
    return `run-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

function normalizeBotHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((item, index) => {
      const role = item?.role === "assistant" ? "assistant" : "user";
      const content = String(item?.content || "").trim();

      if (!content) {
        return null;
      }

      return {
        id: `history-${index}-${Date.now()}`,
        role,
        content,
      };
    })
    .filter(Boolean);
}

async function buildAgentInputFromBotBody(body = {}) {
  const historyMessages = normalizeBotHistory(body?.history);
  const msg = String(body?.msg || "").trim();

  if (!msg) {
    throw new Error("msg is required");
  }

  const groundingContext = await buildPlatformGroundingContext(
    body?.contextPayload || {}
  );
  const groundedMessageContent = buildAgentUserPrompt({
    question: msg,
    groundingContext,
    contextPayload: body?.contextPayload || {},
  });

  return {
    messages: historyMessages.concat({
      id: `user-${Date.now()}`,
      role: "user",
      content: groundedMessageContent,
    }),
    threadId:
      String(body?.conversationId || "").trim() || `conversation-${Date.now()}`,
    runId: createRunId(),
    tools: [],
    context: [],
    state: {},
    forwardedProps: {
      groundingRegion: groundingContext?.regionLabel || "",
      groundingCandidateCount: groundingContext?.candidates?.length || 0,
    },
  };
}

function writeSseChunk(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeDirectTextResponse(res, text) {
  const content = String(text || "").trim();
  if (content) {
    writeSseChunk(res, { content });
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

async function handleBotSendMessage(req, res) {
  console.log("[agent-yuxiaohe] bot send-message request", {
    method: req.method,
    path: req.path,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    hasMsg: !!req.body?.msg,
    historyLength: Array.isArray(req.body?.history) ? req.body.history.length : 0,
  });

  let agent;
  let textBuffer = "";
  let chunkCount = 0;

  try {
    const directAnswer = await buildDirectAnswer({
      question: req.body?.msg || "",
      contextPayload: req.body?.contextPayload || {},
    });

    if (directAnswer) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      writeDirectTextResponse(res, directAnswer);
      return;
    }

    const input = await buildAgentInputFromBotBody(req.body || {});
    const cloudbaseUserId = extractCloudbaseUserId(req);
    input.forwardedProps = {
      ...(input.forwardedProps || {}),
      cloudbaseUserId,
    };
    agent = createBaseAgent();

    console.log("[agent-yuxiaohe] bot send-message createAgent", {
      threadId: input.threadId,
      runId: input.runId,
      messageCount: input.messages.length,
      hasCloudbaseUserId: !!cloudbaseUserId,
      groundingRegion: input.forwardedProps?.groundingRegion || "",
      groundingCandidateCount: input.forwardedProps?.groundingCandidateCount || 0,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const events = agui.sendMessageAGUI.handler(input, agent);

    for await (const event of events) {
      console.log("[agent-yuxiaohe] bot send-message event", {
        type: event?.type,
        hasDelta: !!event?.delta,
        hasContent: !!event?.content,
      });

      if (event?.type === "TEXT_MESSAGE_CONTENT") {
        const content = event.delta || event.content || "";
        if (content) {
          textBuffer += content;
          chunkCount += 1;
          console.log("[agent-yuxiaohe] bot send-message chunk", {
            chunkCount,
            contentLength: content.length,
            totalLength: textBuffer.length,
          });
          writeSseChunk(res, { content });
        }
        continue;
      }

      if (event?.type === "TEXT_MESSAGE_END") {
        break;
      }
    }

    if (!chunkCount && textBuffer) {
      writeSseChunk(res, { content: textBuffer });
    }

    console.log("[agent-yuxiaohe] bot send-message finish", {
      chunkCount,
      totalLength: textBuffer.length,
    });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("[agent-yuxiaohe] bot send-message setup failed", error);
    if (!res.headersSent) {
      res.status(400).json({
        error: "invalid send-message request",
        message: error?.message || String(error),
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

const app = express();

app.use((req, res, next) => {
  console.log("[agent-yuxiaohe] incoming", {
    method: req.method,
    path: req.path,
  });
  next();
});

app.post("/send-message", express.json(), handleBotSendMessage);

app.post(
  "/v1/aibot/bots/:agentId/send-message",
  express.json(),
  (req, res, next) => {
    console.log("[agent-yuxiaohe] /v1/aibot/bots/:agentId/send-message hit", {
      method: req.method,
      path: req.path,
      agentId: req.params?.agentId,
    });
    next();
  },
  handleBotSendMessage
);

createExpressRoutes({
  createAgent,
  express: app,
});

app.post(
  "/wx-send-message",
  express.json(),
  (req, res, next) => {
    console.log("[agent-yuxiaohe] /wx-send-message hit", {
      hasBody: !!req.body,
    });
    next();
  },
  createWxMessageHandler(createWxAgent)
);

app.post(
  "/v1/aibot/bots/:agentId/wx-send-message",
  express.json(),
  (req, res, next) => {
    console.log("[agent-yuxiaohe] /v1/aibot/bots/:agentId/wx-send-message hit", {
      agentId: req.params?.agentId,
      hasBody: !!req.body,
    });
    next();
  },
  createWxMessageHandler(createWxAgent)
);

app.listen(PORT, () => {
  console.log("[agent-yuxiaohe] boot", {
    port: PORT,
    hasAppKey: !!process.env.ADP_APP_KEY,
    envId: process.env.TCB_ENV || process.env.ENV_ID || "",
  });
});
