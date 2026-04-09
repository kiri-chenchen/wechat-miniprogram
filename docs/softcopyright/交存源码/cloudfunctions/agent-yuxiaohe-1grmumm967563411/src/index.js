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
  buildBuddyMatchResult,
  buildConversationStateResult,
  buildGuideGroundingPayload,
  buildGuideCustomizationResult,
  buildPlatformGroundingContext,
  buildConversationWorkflow,
  buildUnifiedTaskState,
} from "./utils.js";
import {
  buildDirectAnswer,
  buildLocationQueryResult,
  buildWeatherQueryResult,
} from "./direct-answer.js";

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

async function buildAgentInputFromBotBody(body = {}, cloudbaseUserId = "") {
  const historyMessages = normalizeBotHistory(body?.history);
  const msg = String(body?.msg || "").trim();

  if (!msg) {
    throw new Error("msg is required");
  }

  const workflowContext = await buildConversationWorkflow({
    question: msg,
    contextPayload: body?.contextPayload || {},
    cloudbaseUserId,
  });
  const unifiedTaskState = await buildUnifiedTaskState({
    question: msg,
    contextPayload: body?.contextPayload || {},
    cloudbaseUserId,
  });
  const guideFields =
    workflowContext?.mainline === "guide_customization" &&
    (workflowContext?.fields || unifiedTaskState?.collected)
      ? workflowContext?.fields || unifiedTaskState?.collected || {}
      : null;
  const groundingPayload = guideFields
    ? buildGuideGroundingPayload({
        question: msg,
        contextPayload: body?.contextPayload || {},
        guideFields,
      })
    : body?.contextPayload || {};
  const groundingContext = await buildPlatformGroundingContext(groundingPayload);
  const groundedMessageContent = buildAgentUserPrompt({
    question: msg,
    groundingContext,
    workflowContext,
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
      mainline: workflowContext?.mainline || "",
      unifiedTaskState,
      unifiedTaskStateText: JSON.stringify(unifiedTaskState),
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
    const cloudbaseUserId = extractCloudbaseUserId(req);
    const directAnswer = await buildDirectAnswer({
      question: req.body?.msg || "",
      contextPayload: req.body?.contextPayload || {},
      cloudbaseUserId,
    });

    if (directAnswer) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      writeDirectTextResponse(res, directAnswer);
      return;
    }

    const input = await buildAgentInputFromBotBody(req.body || {}, cloudbaseUserId);
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
      unifiedTaskState: input.forwardedProps?.unifiedTaskState || {},
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

async function handleBuddyMatch(req, res) {
  try {
    const body = req.body || {};
    const departure = String(body.departure || "").trim();
    const destination = String(body.destination || "").trim();
    const time = String(body.time || "").trim();
    const companionPreference = String(body.companionPreference || "").trim();
    const cloudbaseUserId =
      String(body.cloudbaseUserId || "").trim() || extractCloudbaseUserId(req);

    const result = await buildBuddyMatchResult({
      departure,
      destination,
      time,
      companionPreference,
      cloudbaseUserId,
      contextPayload: body.contextPayload || {},
    });

    res.json(result);
  } catch (error) {
    console.error("[agent-yuxiaohe] buddy-match failed", error);
    res.status(500).json({
      success: false,
      message: "搭子匹配服务暂不可用",
      error: error?.message || String(error),
    });
  }
}

async function handleGuideCustomization(req, res) {
  try {
    const body = req.body || {};
    const result = await buildGuideCustomizationResult({
      time: String(body.time || "").trim(),
      peopleCount: String(body.peopleCount || "").trim(),
      relationship: String(body.relationship || "").trim(),
      budget: String(body.budget || "").trim(),
      destination: String(body.destination || "").trim(),
      contextPayload: body.contextPayload || {},
    });

    res.json(result);
  } catch (error) {
    console.error("[agent-yuxiaohe] guide-customization failed", error);
    res.status(500).json({
      success: false,
      message: "攻略候选服务暂时不可用",
      error: error?.message || String(error),
    });
  }
}

async function handleConversationState(req, res) {
  try {
    const body = req.body || {};
    const cloudbaseUserId =
      String(body.cloudbaseUserId || "").trim() || extractCloudbaseUserId(req);
    const result = await buildConversationStateResult({
      question: String(body.question || "").trim(),
      contextPayload: body.contextPayload || {},
      cloudbaseUserId,
    });

    res.json(result);
  } catch (error) {
    console.error("[agent-yuxiaohe] conversation-state failed", error);
    res.status(500).json({
      success: false,
      message: "浼氳瘽鐘舵€佹湇鍔℃殏鏃朵笉鍙敤",
      error: error?.message || String(error),
    });
  }
}

async function handleWeatherQuery(req, res) {
  try {
    const body = req.body || {};
    const result = await buildWeatherQueryResult({
      question: String(body.question || "").trim(),
      contextPayload: body.contextPayload || {},
    });

    res.json(result);
  } catch (error) {
    console.error("[agent-yuxiaohe] weather-query failed", error);
    res.status(500).json({
      success: false,
      subType: "weather",
      answer: "实时天气暂不可用，刚才查询天气服务时失败了。你可以稍后再试。",
      error: error?.message || String(error),
    });
  }
}

async function handleLocationQuery(req, res) {
  try {
    const body = req.body || {};
    const result = await buildLocationQueryResult({
      contextPayload: body.contextPayload || {},
    });

    res.json(result);
  } catch (error) {
    console.error("[agent-yuxiaohe] location-query failed", error);
    res.status(500).json({
      success: false,
      subType: "location",
      answer: "位置未获取成功。你可以先开启定位权限，或者直接告诉我你所在的城市。",
      error: error?.message || String(error),
    });
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

app.post("/api/buddy-match", express.json(), handleBuddyMatch);

app.post("/api/guide-customization", express.json(), handleGuideCustomization);

app.post("/api/conversation-state", express.json(), handleConversationState);

app.post("/api/weather-query", express.json(), handleWeatherQuery);

app.post("/api/location-query", express.json(), handleLocationQuery);

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
