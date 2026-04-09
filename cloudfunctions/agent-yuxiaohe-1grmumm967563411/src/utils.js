import { jwtDecode } from "jwt-decode";
import tcb from "@cloudbase/node-sdk";

const LOCATION_WORD_REGEXP = /(附近|周边|本地|同城|这里|这边|当前位置|现在)/u;
const DEFAULT_REGION_LABEL = "未提供地区";
const MAX_DATASET_FETCH = 60;
const MAX_CANDIDATE_PER_TYPE = 3;
const BUDDY_MAX_CANDIDATES = 3;
const GUIDE_MAX_CANDIDATES = 6;

export const MAINLINE = {
  BUDDY: "buddy_matching",
  GUIDE: "guide_customization",
  WEATHER: "weather_location",
  FEEDBACK: "xiaohe_feedback",
  GENERIC: "generic_guard",
};

const MAINLINE_SKILL_MODE_MAP = {
  buddy_matching: MAINLINE.BUDDY,
  guide_customization: MAINLINE.GUIDE,
  xiaohe_feedback: MAINLINE.FEEDBACK,
};

const BUDDY_KEYWORDS = ["搭子", "同行", "一起去", "找人一起", "结伴", "拼玩", "拼车", "一起玩", "一起旅游", "一起旅行"];
const GUIDE_KEYWORDS = ["攻略", "路线", "行程", "怎么玩", "安排", "推荐路线", "定制", "规划"];
const WEATHER_KEYWORDS = [
  "天气",
  "气温",
  "温度",
  "下雨",
  "降雨",
  "穿什么",
  "穿啥",
  "位置",
  "定位",
  "我在哪",
  "附近天气",
];
const FEEDBACK_KEYWORDS = [
  "吐槽",
  "反馈",
  "建议",
  "意见",
  "抱怨",
  "难用",
  "卡顿",
  "bug",
  "心情",
  "烦",
  "难受",
  "委屈",
  "emo",
];

let cloudbaseApp = null;

export function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTextLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function uniqueList(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

function maskIdentifier(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`;
}

function includesAny(text = "", keywords = []) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isBuddyIntentText(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (includesAny(normalized, BUDDY_KEYWORDS)) return true;

  return (
    /(找|想找|帮我找).*(一起|结伴|同行)/u.test(normalized) ||
    /(一起).*(找|想找|帮我找)/u.test(normalized) ||
    /(找|想找|帮我找).*(女生|男生|小姐姐|小哥哥)/u.test(normalized) ||
    /(女生|男生|小姐姐|小哥哥).*(一起|同行|结伴)/u.test(normalized)
  );
}

function removeRegionSuffix(value) {
  return normalizeText(value)
    .replace(/(特别行政区|自治区|自治州|地区)$/u, "")
    .replace(/(省|市|区|县|旗)$/u, "");
}

function buildRegionTokens(location = {}) {
  return uniqueList(
    [
      location.province,
      location.city,
      location.district,
      location.displayName,
      location.locationText,
    ]
      .map(removeRegionSuffix)
      .filter(Boolean)
  );
}

function buildExplicitRegionTokens(region = "") {
  const normalizedRegion = normalizeText(region);
  if (!normalizedRegion) return [];

  return uniqueList(
    [normalizedRegion, removeRegionSuffix(normalizedRegion)].filter(Boolean)
  );
}

function buildRegionLabel(location = {}) {
  const displayName = normalizeText(location.displayName);
  if (displayName) {
    return displayName;
  }

  const region = [location.province, location.city, location.district]
    .map(removeRegionSuffix)
    .filter(Boolean)
    .join(" / ");

  return region || normalizeText(location.locationText) || DEFAULT_REGION_LABEL;
}

function getConversationHistory(contextPayload = {}) {
  if (!Array.isArray(contextPayload?.history)) {
    return [];
  }

  return contextPayload.history
    .map((item) => ({
      role: item?.role === "assistant" || item?.role === "ai" ? "assistant" : "user",
      text: normalizeText(item?.text || item?.content || ""),
    }))
    .filter((item) => item.text)
    .slice(-20);
}

function inferFieldFromAssistant(mainline = "", assistantText = "") {
  const text = normalizeText(assistantText);
  if (!text) return "";

  if (mainline === MAINLINE.GUIDE) {
    if (text.includes("最想去哪里")) return "destination";
    if (text.includes("什么时候去")) return "time";
    if (text.includes("几个人一起")) return "peopleCount";
    if (text.includes("什么关系")) return "relationship";
    if (text.includes("预算")) return "budget";
  }

  if (mainline === MAINLINE.BUDDY) {
    if (text.includes("从哪里出发")) return "departure";
    if (text.includes("最想去哪里")) return "destination";
    if (text.includes("什么时候出发")) return "time";
    if (text.includes("同行搭子")) return "companionPreference";
  }

  return "";
}

function inferMainlineFromHistory(contextPayload = {}) {
  const history = getConversationHistory(contextPayload);
  if (!history.length) return "";

  const lastAssistantText =
    [...history].reverse().find((item) => item.role === "assistant")?.text || "";
  const combinedText = history.map((item) => item.text).join("\n");

  if (
    lastAssistantText.includes("最想去哪里") ||
    lastAssistantText.includes("什么时候去") ||
    lastAssistantText.includes("几个人一起") ||
    lastAssistantText.includes("什么关系") ||
    lastAssistantText.includes("预算")
  ) {
    return MAINLINE.GUIDE;
  }

  if (
    lastAssistantText.includes("从哪里出发") ||
    lastAssistantText.includes("什么时候出发") ||
    lastAssistantText.includes("同行搭子")
  ) {
    return MAINLINE.BUDDY;
  }

  if (
    lastAssistantText.includes("我会认真听") ||
    lastAssistantText.includes("收到你的反馈") ||
    lastAssistantText.includes("收到这条建议") ||
    lastAssistantText.includes("最让你难受的点")
  ) {
    return MAINLINE.FEEDBACK;
  }

  if (includesAny(combinedText, GUIDE_KEYWORDS)) return MAINLINE.GUIDE;
  if (isBuddyIntentText(combinedText)) return MAINLINE.BUDDY;
  if (includesAny(combinedText, FEEDBACK_KEYWORDS)) return MAINLINE.FEEDBACK;
  if (includesAny(combinedText, WEATHER_KEYWORDS)) return MAINLINE.WEATHER;

  return "";
}

function inferTaskStateFromHistory(contextPayload = {}) {
  const explicitState = contextPayload?.currentTaskState || {};
  const mainline =
    normalizeText(explicitState?.mainline) || inferMainlineFromHistory(contextPayload);

  if (!mainline) {
    return explicitState || {};
  }

  const history = getConversationHistory(contextPayload);
  const inferredState = {
    ...explicitState,
    mainline,
    collected: {
      ...(explicitState?.collected || {}),
    },
    lastAskedField: normalizeText(explicitState?.lastAskedField),
    feedbackType: normalizeText(explicitState?.feedbackType),
  };

  const userTexts = history
    .filter((item) => item.role === "user")
    .map((item) => item.text);

  if (mainline === MAINLINE.GUIDE) {
    const collected = { ...(inferredState.collected || {}) };
    const historyInferenceContext = {
      ...(contextPayload || {}),
      disableHistoryInference: true,
      currentTaskState: {
        ...(explicitState || {}),
        mainline,
        collected,
      },
      skillContext: {
        ...(contextPayload?.skillContext || {}),
        collected: {
          ...(contextPayload?.skillContext?.collected || {}),
          ...collected,
        },
      },
    };

    userTexts.forEach((text) => {
      historyInferenceContext.currentTaskState.collected = collected;
      historyInferenceContext.skillContext.collected = {
        ...(contextPayload?.skillContext?.collected || {}),
        ...collected,
      };

      if (!collected.time) collected.time = extractTime(text, historyInferenceContext);
      if (!collected.peopleCount) {
        collected.peopleCount = extractCount(
          text,
          historyInferenceContext,
          ["peopleCount"],
          /([一二三四五六七八九十两\d]+(?:人|位))/u
        );
      }
      if (!collected.relationship) {
        collected.relationship = extractRelationship(text, historyInferenceContext);
      }
      if (!collected.peopleCount) {
        collected.peopleCount = normalizePeopleCountFromRelationship(
          collected.relationship,
          collected.peopleCount
        );
      }
      if (!collected.budget) collected.budget = extractGuideBudgetValue(text, historyInferenceContext);
      if (!collected.destination) collected.destination = extractDestination(text, historyInferenceContext);
    });
    inferredState.collected = collected;
  }

  if (mainline === MAINLINE.BUDDY) {
    const collected = { ...(inferredState.collected || {}) };
    const historyInferenceContext = {
      ...(contextPayload || {}),
      disableHistoryInference: true,
      currentTaskState: {
        ...(explicitState || {}),
        mainline,
        collected,
      },
      skillContext: {
        ...(contextPayload?.skillContext || {}),
        collected: {
          ...(contextPayload?.skillContext?.collected || {}),
          ...collected,
        },
      },
    };

    userTexts.forEach((text) => {
      historyInferenceContext.currentTaskState.collected = collected;
      historyInferenceContext.skillContext.collected = {
        ...(contextPayload?.skillContext?.collected || {}),
        ...collected,
      };

      if (!collected.departure) {
        const location = contextPayload?.location || {};
        collected.departure = normalizeText(location.city || location.displayName);
      }
      if (!collected.destination) collected.destination = extractDestination(text, historyInferenceContext);
      if (!collected.time) collected.time = extractTime(text, historyInferenceContext);
      if (!collected.companionPreference) {
        collected.companionPreference = extractCompanionPreference(text, historyInferenceContext);
      }
    });
    inferredState.collected = collected;
  }

  if (mainline === MAINLINE.FEEDBACK && !inferredState.feedbackType) {
    const latestUserText = [...userTexts].reverse().find(Boolean) || "";
    inferredState.feedbackType = classifyFeedbackType(latestUserText);
  }

  if (!inferredState.lastAskedField) {
    const lastAssistantText =
      [...history].reverse().find((item) => item.role === "assistant")?.text || "";
    inferredState.lastAskedField = inferFieldFromAssistant(mainline, lastAssistantText);
  }

  return inferredState;
}

function getCurrentTaskState(contextPayload = {}) {
  if (contextPayload?.disableHistoryInference) {
    return contextPayload?.currentTaskState || {};
  }

  return inferTaskStateFromHistory(contextPayload);
}

function getMergedCollected(contextPayload = {}) {
  const skillCollected = contextPayload?.skillContext?.collected || {};
  const taskCollected = getCurrentTaskState(contextPayload)?.collected || {};

  return {
    ...skillCollected,
    ...taskCollected,
  };
}

function readStateValue(contextPayload = {}, keys = []) {
  const collected = getMergedCollected(contextPayload);
  for (const key of keys) {
    const value = normalizeText(collected?.[key]);
    if (value) return value;
  }
  return "";
}

function mergeSkillLocation(location = {}, contextPayload = {}) {
  const skillMode = normalizeText(contextPayload?.skillContext?.mode);
  const collected = getMergedCollected(contextPayload);
  const explicitRegion =
    skillMode === MAINLINE.GUIDE
      ? normalizeText(collected.destination || collected.region)
      : normalizeText(collected.region);

  if (!explicitRegion) {
    return location || {};
  }

  return {
    ...(location || {}),
    displayName: explicitRegion,
    locationText: explicitRegion,
  };
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPriceText(item = {}, type = "activity") {
  const price = safeNumber(item.priceFrom || item.price || 0);
  if (!price) {
    return type === "hotel" ? "价格待定" : "可咨询";
  }
  return type === "hotel" ? `¥${price}/晚` : `¥${price}起`;
}

function getItemRegionText(item = {}) {
  return [item.province, item.city, item.district]
    .map(removeRegionSuffix)
    .filter(Boolean)
    .join(" / ");
}

function joinSearchText(item = {}) {
  return normalizeTextLower(
    [
      item.title,
      item.name,
      item.summary,
      item.content,
      item.detail,
      item.desc,
      item.description,
      item.locationName,
      item.address,
      item.province,
      item.city,
      item.district,
      item.transport,
      item.stay,
      ...normalizeArray(item.tags),
      ...normalizeArray(item.travelModeTags),
      ...normalizeArray(item.playTags),
      ...normalizeArray(item.suitableGroups),
      ...normalizeArray(item.highlights),
      ...normalizeArray(item.itinerary),
      ...normalizeArray(item.categoryTags),
      ...normalizeArray(item.dnaTags),
    ].join(" ")
  );
}

function buildIntentTokens(question = "", userProfile = {}) {
  const source = normalizeText(question);
  const tokens = [];
  const keywordMap = [
    "亲子",
    "农旅",
    "活动",
    "景点",
    "民宿",
    "酒店",
    "住宿",
    "商品",
    "特产",
    "采摘",
    "研学",
    "手作",
    "花海",
    "周末",
    "拍照",
    "露营",
    "慢游",
    "乡村",
    "农场",
    "萌宠",
  ];

  keywordMap.forEach((keyword) => {
    if (source.includes(keyword)) {
      tokens.push(keyword);
    }
  });

  normalizeArray(userProfile.dnaTags).forEach((tag) => tokens.push(tag));
  return uniqueList(tokens);
}

function detectRequestedTypes(question = "") {
  const text = normalizeText(question);
  const requested = [];

  if (/活动|采摘|研学|体验|农旅|亲子|周末|玩/u.test(text)) {
    requested.push("activity");
  }
  if (/景点|观光|古村|花海|打卡|拍照/u.test(text)) {
    requested.push("scenic");
  }
  if (/民宿|酒店|住宿|住/u.test(text)) {
    requested.push("hotel");
  }
  if (/特产|商品|礼盒|伴手礼/u.test(text)) {
    requested.push("product");
  }

  return requested.length ? requested : ["activity", "scenic", "hotel", "product"];
}

function scoreLocation(item = {}, regionTokens = []) {
  if (!regionTokens.length) return 0;

  const text = joinSearchText(item);
  let score = 0;
  regionTokens.forEach((token, index) => {
    if (token && text.includes(normalizeTextLower(token))) {
      score += 15 - Math.min(index * 2, 8);
    }
  });
  return score;
}

function scoreIntent(item = {}, intentTokens = []) {
  if (!intentTokens.length) return 0;

  const text = joinSearchText(item);
  return intentTokens.reduce((score, token) => {
    if (!token) return score;
    return score + (text.includes(normalizeTextLower(token)) ? 8 : 0);
  }, 0);
}

function scoreNearbyIntent(question = "", item = {}, location = {}) {
  if (!LOCATION_WORD_REGEXP.test(question)) return 0;

  const regionText = buildRegionLabel(location);
  const itemRegion =
    getItemRegionText(item) || normalizeText(item.locationName) || normalizeText(item.address);

  return itemRegion && regionText !== DEFAULT_REGION_LABEL && itemRegion.includes(removeRegionSuffix(regionText))
    ? 10
    : 0;
}

function scoreSourceType(type, requestedTypes = []) {
  if (!requestedTypes.length) return 0;
  if (requestedTypes[0] === type) return 20;
  return requestedTypes.includes(type) ? 10 : -10;
}

function sortByScore(list = []) {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return safeNumber(b.raw.updatedAt || b.raw.createTime || 0) - safeNumber(a.raw.updatedAt || a.raw.createTime || 0);
  });
}

function summarizeItem(type, item = {}) {
  const title = normalizeText(
    item.title ||
      item.name ||
      item.locationName ||
      {
        activity: "农旅活动",
        scenic: "乡村景点",
        hotel: "乡野民宿",
        product: "乡味商品",
      }[type]
  );

  return {
    id: normalizeText(item._id || item.id),
    type,
    title,
    region: getItemRegionText(item) || normalizeText(item.locationName) || normalizeText(item.address) || "地区待补充",
    priceText: getPriceText(item, type),
    summary: normalizeText(item.summary || item.content || item.desc || item.description || item.detail),
    tags: uniqueList([
      ...normalizeArray(item.tags),
      ...normalizeArray(item.travelModeTags),
      ...normalizeArray(item.playTags),
      ...normalizeArray(item.suitableGroups),
      ...normalizeArray(item.categoryTags),
    ]).slice(0, 4),
  };
}

function formatCandidateLine(candidate, index) {
  const summary = candidate.summary ? `；简介：${candidate.summary}` : "";
  const tags = candidate.tags.length ? `；标签：${candidate.tags.join("、")}` : "";
  return `${index + 1}. [${candidate.type}] ${candidate.title}（ID: ${candidate.id || "无"}；地区：${candidate.region}；价格：${candidate.priceText}${tags}${summary}）`;
}

function itemMatchesExplicitRegion(item = {}, regionTokens = []) {
  if (!regionTokens.length) return true;

  const text = joinSearchText(item);
  return regionTokens.some((token) => text.includes(normalizeTextLower(token)));
}

function getCloudbaseApp() {
  if (cloudbaseApp) return cloudbaseApp;

  const env = process.env.TCB_ENV || process.env.ENV_ID || "";
  cloudbaseApp = tcb.init({
    env,
    secretId: process.env.TENCENTCLOUD_SECRETID || "",
    secretKey: process.env.TENCENTCLOUD_SECRETKEY || "",
    sessionToken: process.env.TENCENTCLOUD_SESSIONTOKEN || "",
  });

  return cloudbaseApp;
}

async function fetchCollection(collectionName, query = null) {
  const app = getCloudbaseApp();
  let request = app.database().collection(collectionName);
  if (query) {
    request = request.where(query);
  }

  const result = await request.limit(MAX_DATASET_FETCH).get();
  return Array.isArray(result?.data) ? result.data : [];
}

async function fetchUserByOpenid(openid = "") {
  const normalizedOpenid = normalizeText(openid);
  if (!normalizedOpenid) return null;

  const result = await fetchCollection("users", { openid: normalizedOpenid });
  console.log("[agent-yuxiaohe] fetchUserByOpenid", {
    requestedOpenid: maskIdentifier(normalizedOpenid),
    matchedCount: result.length,
    matchedByOpenid: result.some(
      (item) => normalizeText(item?.openid) === normalizedOpenid
    ),
    matchedBy_Openid: result.some(
      (item) => normalizeText(item?._openid) === normalizedOpenid
    ),
  });
  return result[0] || null;
}

async function loadPlatformDataset() {
  const [activities, hotels, scenics, products] = await Promise.all([
    fetchCollection("activities", { status: "published" }),
    fetchCollection("hotels", { status: true }),
    fetchCollection("scenics"),
    fetchCollection("products"),
  ]);

  return { activities, hotels, scenics, products };
}

function buildRankedCandidates({
  question = "",
  location = {},
  userProfile = {},
  datasets = {},
  explicitRegion = "",
}) {
  const regionTokens = buildRegionTokens(location);
  const explicitRegionTokens = buildExplicitRegionTokens(explicitRegion);
  const requestedTypes = detectRequestedTypes(question);
  const intentTokens = buildIntentTokens(question, userProfile);

  const candidates = []
    .concat((datasets.activities || []).map((item) => ({ type: "activity", raw: item })))
    .concat((datasets.scenics || []).map((item) => ({ type: "scenic", raw: item })))
    .concat((datasets.hotels || []).map((item) => ({ type: "hotel", raw: item })))
    .concat((datasets.products || []).map((item) => ({ type: "product", raw: item })))
    .map((entry) => {
      const summary = summarizeItem(entry.type, entry.raw);
      const score =
        scoreSourceType(entry.type, requestedTypes) +
        scoreLocation(entry.raw, regionTokens) +
        scoreIntent(entry.raw, intentTokens) +
        scoreNearbyIntent(question, entry.raw, location);

      return {
        ...summary,
        raw: entry.raw,
        score,
      };
    })
    .filter((item) => item.score > 0);

  const regionConstrainedCandidates = explicitRegionTokens.length
    ? candidates.filter((item) => itemMatchesExplicitRegion(item.raw, explicitRegionTokens))
    : candidates;

  const sorted = sortByScore(regionConstrainedCandidates);
  const grouped = { activity: [], scenic: [], hotel: [], product: [] };

  sorted.forEach((candidate) => {
    if (grouped[candidate.type].length >= MAX_CANDIDATE_PER_TYPE) return;
    grouped[candidate.type].push(candidate);
  });

  const selected = requestedTypes
    .flatMap((type) => grouped[type] || [])
    .concat(
      Object.keys(grouped)
        .filter((type) => !requestedTypes.includes(type))
        .flatMap((type) => grouped[type] || [])
    )
    .slice(0, 6);

  return {
    requestedTypes,
    intentTokens,
    regionLabel: explicitRegion || buildRegionLabel(location),
    selected,
  };
}

export async function buildPlatformGroundingContext(payload = {}) {
  const question = normalizeText(payload.question);
  if (!question) {
    return {
      question: "",
      regionLabel: DEFAULT_REGION_LABEL,
      candidates: [],
      prompt: "",
    };
  }

  const location = mergeSkillLocation(payload.location || {}, payload);
  const userProfile = payload.userProfile || {};
  const preferences = payload.preferences || {};
  const datasets = payload.platformDataset || (await loadPlatformDataset());
  const explicitRegion = readStateValue(payload, ["destination", "region", "place"]);
  const ranked = buildRankedCandidates({
    question,
    location,
    userProfile,
    datasets,
    explicitRegion,
  });

  const preferenceText = [
    preferences.distance ? `距离偏好：${preferences.distance}` : "",
    preferences.budget ? `预算偏好：${preferences.budget}` : "",
    preferences.detailLevel ? `回答详细度：${preferences.detailLevel}` : "",
  ]
    .filter(Boolean)
    .join("；");

  const profileText = normalizeArray(userProfile.dnaTags).join("、");
  const lines = ranked.selected.map((item, index) => formatCandidateLine(item, index));
  const dataBlock = lines.length ? lines.join("\n") : "平台当前没有筛到匹配候选。";

  const prompt = [
    "以下是平台当前可用的候选内容，请优先基于这些内容回答。",
    `用户当前问题：${question}`,
    `用户地区：${ranked.regionLabel}`,
    profileText ? `用户画像标签：${profileText}` : "",
    preferenceText ? `用户偏好：${preferenceText}` : "",
    ranked.intentTokens.length ? `问题意图关键词：${ranked.intentTokens.join("、")}` : "",
    "你不得编造平台中不存在的活动、景点、商品或酒店。",
    dataBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    question,
    regionLabel: ranked.regionLabel,
    candidates: ranked.selected,
    prompt,
  };
}

export function detectMainline(question = "", contextPayload = {}) {
  const currentTaskMainline = normalizeText(getCurrentTaskState(contextPayload)?.mainline);
  if (currentTaskMainline) {
    return currentTaskMainline;
  }

  const inferredMainline = inferMainlineFromHistory(contextPayload);
  if (inferredMainline) {
    return inferredMainline;
  }

  const skillMode = normalizeText(contextPayload?.skillContext?.mode);
  if (skillMode && MAINLINE_SKILL_MODE_MAP[skillMode]) {
    return MAINLINE_SKILL_MODE_MAP[skillMode];
  }

  const text = normalizeText(question);
  if (!text) return MAINLINE.GENERIC;
  if (includesAny(text, WEATHER_KEYWORDS)) return MAINLINE.WEATHER;
  if (isBuddyIntentText(text)) return MAINLINE.BUDDY;
  if (includesAny(text, GUIDE_KEYWORDS)) return MAINLINE.GUIDE;
  if (includesAny(text, FEEDBACK_KEYWORDS)) return MAINLINE.FEEDBACK;
  return MAINLINE.GENERIC;
}

function extractDestination(question = "", contextPayload = {}) {
  const fromCollected = readStateValue(contextPayload, ["destination", "region", "place"]);
  if (fromCollected) return fromCollected;

  const normalizedQuestion = normalizeText(question);
  const patterns = [
    /去([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?:玩|逛|旅游|旅行|看|参加|的|，|。|\s|$)/u,
    /到([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?:玩|逛|旅游|旅行|看|参加|的|，|。|\s|$)/u,
    /在([\u4e00-\u9fa5A-Za-z0-9]{2,12}?)(?:玩|逛|旅游|旅行)/u,
  ];

  for (const pattern of patterns) {
    const matched = normalizedQuestion.match(pattern);
    if (matched?.[1]) return matched[1];
  }

  if (
    /^[\u4e00-\u9fa5A-Za-z0-9]{2,12}$/u.test(normalizedQuestion) &&
    !extractTime(normalizedQuestion, contextPayload) &&
    !extractGuideBudgetValue(normalizedQuestion, contextPayload) &&
    !extractCount(normalizedQuestion, contextPayload, ["peopleCount"], /([一二三四五六七八九十两\d]+(?:人|位))/u)
  ) {
    return normalizedQuestion;
  }

  return "";
}

function extractGuideBudgetValue(question = "", contextPayload = {}) {
  const fromCollected = readStateValue(contextPayload, ["budget"]);
  if (fromCollected) return fromCollected;

  const normalizedQuestion = normalizeText(question);
  const amountWithUnit = normalizedQuestion.match(/(\d{2,5}\s*(?:元|块|w|万))/u);
  if (amountWithUnit?.[1]) return amountWithUnit[1];

  const embeddedBudget = normalizedQuestion.match(
    /(?:预算|人均|花费|费用|开销)(?:大概|大约|差不多|控制在)?\s*(\d{2,5})(?:\s*(?:元|块))?(?:左右|以内|以下|上下|上下浮动)?/u
  );
  if (embeddedBudget?.[1]) {
    return `${embeddedBudget[1]}元`;
  }

  const standaloneBudget = normalizedQuestion.match(
    /^(?:预算)?\s*(\d{2,5})(?:\s*(?:元|块))?(?:左右|以内|以下|上下|以左|以上)?$/u
  );
  if (standaloneBudget?.[1]) {
    return `${standaloneBudget[1]}元`;
  }

  const currentTaskState = getCurrentTaskState(contextPayload);
  if (normalizeText(currentTaskState?.lastAskedField) === "budget") {
    const plainNumber = normalizedQuestion.match(/^(\d{2,5})(?:左右|以内|以下|上下)?$/u);
    if (plainNumber?.[1]) {
      return `${plainNumber[1]}元`;
    }
  }

  return "";
}

function extractCount(question = "", contextPayload = {}, keys = [], pattern) {
  const fromCollected = readStateValue(contextPayload, keys);
  if (fromCollected) return fromCollected;
  const normalizedQuestion = normalizeText(question);
  const matched = normalizedQuestion.match(pattern);
  if (matched?.[1]) return matched[1];

  const extendedMatched = normalizedQuestion.match(/([一二三四五六七八九十两\d]+)\s*个?人/u);
  if (extendedMatched?.[1]) {
    return `${extendedMatched[1]}人`;
  }

  if (/^(我俩|我们)$/u.test(normalizedQuestion)) return "2人";
  if (/^(两个人|两人|2个人|2人|我们两个人|我们两人)$/u.test(normalizedQuestion)) return "2人";
  if (/^我和(?:男朋友|女朋友|对象|恋人|爱人|老公|老婆|朋友|同学|同事)/u.test(normalizedQuestion)) {
    return "2人";
  }

  return "";
}

function extractTime(question = "", contextPayload = {}) {
  const fromCollected = readStateValue(contextPayload, ["time", "travelTime", "date", "days"]);
  if (fromCollected) return fromCollected;

  const matched = normalizeText(question).match(
    /(今天|明天|后天|周末|五一|十一|端午|中秋|春节|暑假|寒假|下周|这周|周[一二三四五六日天]|\d{1,2}月\d{1,2}日|\d{1,2}号)/u
  );
  return matched?.[1] || "";
}

function extractCompanionPreference(question = "", contextPayload = {}) {
  const fromCollected = readStateValue(contextPayload, ["companionPreference", "groupPreference", "buddyPreference"]);
  if (fromCollected) return fromCollected;

  const normalizedQuestion = normalizeText(question);
  const directPatterns = [
    /(女生搭子|男生搭子|情侣搭子|亲子搭子|摄影搭子|饭搭子|自由行搭子)/u,
    /(同龄人|大学生|本地人|会开车|能拼车|随和一点|话少一点|会拍照|会摄影)/u,
  ];

  for (const pattern of directPatterns) {
    const matched = normalizedQuestion.match(pattern);
    if (matched?.[1]) return matched[1];
  }

  const normalizedGender =
    /(女生|小姐姐)/u.test(normalizedQuestion) ? "女生" : /(男生|小哥哥)/u.test(normalizedQuestion) ? "男生" : "";
  const normalizedTrait =
    /(会摄影|会拍照|摄影)/u.test(normalizedQuestion)
      ? "会摄影"
      : /(会开车|能开车)/u.test(normalizedQuestion)
        ? "会开车"
        : /能拼车/u.test(normalizedQuestion)
          ? "能拼车"
          : /同龄人/u.test(normalizedQuestion)
            ? "同龄人"
            : /大学生/u.test(normalizedQuestion)
              ? "大学生"
              : /本地人/u.test(normalizedQuestion)
                ? "本地人"
                : /随和/u.test(normalizedQuestion)
                  ? "随和一点"
                  : /话少/u.test(normalizedQuestion)
                    ? "话少一点"
                    : "";

  if (normalizedTrait && normalizedGender) {
    return `${normalizedTrait}的${normalizedGender}`;
  }

  if (normalizedTrait) return normalizedTrait;
  if (normalizedGender) return normalizedGender;
  return "";
}

function extractRelationship(question = "", contextPayload = {}) {
  const fromCollected = readStateValue(contextPayload, ["relationship", "groupType"]);
  if (fromCollected) return fromCollected;

  const normalizedQuestion = normalizeText(question);
  const matched = normalizedQuestion.match(
    /(情侣|夫妻|亲子|朋友|闺蜜|同学|同事|家人|一个人|独自|男朋友|女朋友|对象|恋人|爱人)/u
  );
  if (!matched?.[1]) return "";

  if (/(男朋友|女朋友|对象|恋人|爱人)/u.test(matched[1])) {
    return "情侣";
  }

  return matched[1];
}

function classifyFeedbackType(question = "") {
  const text = normalizeText(question);
  if (!text) return "普通反馈";
  if (/(建议|希望|能不能|可不可以|改进)/u.test(text)) return "平台建议";
  if (/(难用|卡|bug|闪退|进不去|加载慢|失败)/u.test(text)) return "普通反馈";
  if (/(烦|难受|委屈|伤心|emo|崩溃|累)/u.test(text)) return "情绪倾诉";
  return "普通反馈";
}

function normalizePeopleCountFromRelationship(relationship = "", currentPeopleCount = "") {
  if (normalizeText(currentPeopleCount)) {
    return normalizeText(currentPeopleCount);
  }

  const normalizedRelationship = normalizeText(relationship);
  if (normalizedRelationship === "情侣" || normalizedRelationship === "夫妻") {
    return "2人";
  }

  return "";
}

function buildBuddyWorkflow(question = "", contextPayload = {}) {
  const location = contextPayload?.location || {};
  const fields = {
    departure:
      readStateValue(contextPayload, ["departure", "origin"]) ||
      normalizeText(location.city || location.displayName),
    destination: extractDestination(question, contextPayload),
    time: extractTime(question, contextPayload),
    companionPreference: extractCompanionPreference(question, contextPayload),
  };

  const fieldDefs = [
    { key: "departure", label: "出发地", ask: "你这次准备从哪里出发？" },
    { key: "destination", label: "目的地", ask: "你这次最想去哪里？" },
    { key: "time", label: "时间", ask: "你大概什么时候出发？" },
    { key: "companionPreference", label: "同行偏好", ask: "你更想找什么样的同行搭子？" },
  ];

  return {
    mainline: MAINLINE.BUDDY,
    fields,
    missingField: fieldDefs.find((item) => !fields[item.key]) || null,
  };
}

function buildGuideWorkflow(question = "", contextPayload = {}) {
  const relationship = extractRelationship(question, contextPayload);
  const fields = {
    time: extractTime(question, contextPayload),
    peopleCount: extractCount(question, contextPayload, ["peopleCount"], /([一二三四五六七八九十两\d]+(?:人|位))/u),
    relationship,
    budget: extractGuideBudgetValue(question, contextPayload),
    destination: extractDestination(question, contextPayload),
  };
  fields.peopleCount = normalizePeopleCountFromRelationship(relationship, fields.peopleCount);

  const fieldDefs = [
    { key: "destination", label: "目的地", ask: "你这次最想去哪里？" },
    { key: "time", label: "时间", ask: "你打算什么时候去？" },
    { key: "peopleCount", label: "人数", ask: "这次大概几个人一起？" },
    { key: "relationship", label: "关系", ask: "这次同行的人大概是什么关系？" },
    { key: "budget", label: "预算", ask: "这次预算大概想控制在什么范围？" },
  ];

  return {
    mainline: MAINLINE.GUIDE,
    fields,
    missingField: fieldDefs.find((item) => !fields[item.key]) || null,
  };
}

function buildBuddyCandidateCard(currentUser = {}, candidate = {}, fields = {}) {
  const currentTags = new Set(normalizeArray(currentUser.dnaTags));
  const candidateTags = normalizeArray(candidate.dnaTags);
  const sharedTags = candidateTags.filter((tag) => currentTags.has(tag));
  const currentCity = removeRegionSuffix(currentUser.city || currentUser.province);
  const candidateCity = removeRegionSuffix(candidate.city || candidate.province);
  const destination = normalizeText(fields.destination);
  const companionPreference = normalizeText(fields.companionPreference);
  const candidateText = joinSearchText(candidate);

  let score = 40;
  if (currentCity && candidateCity && currentCity === candidateCity) score += 18;
  score += Math.min(sharedTags.length * 10, 30);
  if (companionPreference && candidateText.includes(normalizeTextLower(companionPreference))) score += 15;
  if (destination && candidateText.includes(normalizeTextLower(destination))) score += 10;
  if (candidate.profileCompleted) score += 5;
  if (candidate.dnaCompleted) score += 5;

  const reasons = [];
  if (currentCity && candidateCity && currentCity === candidateCity) reasons.push("同城出发更方便");
  if (sharedTags.length) reasons.push(`DNA 标签重合 ${Math.min(sharedTags.length, 3)} 项`);
  if (companionPreference && candidateText.includes(normalizeTextLower(companionPreference))) {
    reasons.push(`偏好贴近“${companionPreference}”`);
  }
  if (!reasons.length) reasons.push("资料和偏好方向比较接近");

  return {
    id: normalizeText(candidate._id || candidate.id),
    type: "buddy",
    title: normalizeText(candidate.nickName) || "同行搭子",
    region:
      [candidate.province, candidate.city, candidate.district]
        .map(removeRegionSuffix)
        .filter(Boolean)
        .join(" / ") || "地区待补充",
    priceText: "同行匹配",
    summary: normalizeText(candidate.signature || candidate.bio || "") || "已完善基础资料，可进一步发起同行申请。",
    tags: uniqueList(sharedTags.concat(candidateTags)).slice(0, 4),
    matchReason: reasons.join("；"),
    score,
  };
}

async function buildBuddyCandidates(contextPayload = {}, cloudbaseUserId = "", workflow = {}) {
  const currentUser = await fetchUserByOpenid(cloudbaseUserId);
  if (!currentUser) {
    const users = await fetchCollection("users");
    console.warn("[agent-yuxiaohe] buildBuddyCandidates current user missing", {
      cloudbaseUserId: maskIdentifier(cloudbaseUserId),
      totalUsers: users.length,
      usersWithOpenid: users.filter((item) => normalizeText(item?.openid)).length,
      usersWith_Openid: users.filter((item) => normalizeText(item?._openid)).length,
      usersWithMatchingOpenid: users.filter(
        (item) => normalizeText(item?.openid) === normalizeText(cloudbaseUserId)
      ).length,
      usersWithMatching_Openid: users.filter(
        (item) => normalizeText(item?._openid) === normalizeText(cloudbaseUserId)
      ).length,
    });
    return [];
  }

  const users = await fetchCollection("users");
  const normalizedCloudbaseUserId = normalizeText(cloudbaseUserId);
  const withOpenid = users.filter((item) => normalizeText(item?.openid));
  const excludingSelf = withOpenid.filter(
    (item) => normalizeText(item?.openid) !== normalizedCloudbaseUserId
  );
  const profileCompletedUsers = excludingSelf.filter((item) => item?.profileCompleted);
  const dnaCompletedUsers = profileCompletedUsers.filter((item) => item?.dnaCompleted);

  console.log("[agent-yuxiaohe] buildBuddyCandidates stats", {
    cloudbaseUserId: maskIdentifier(normalizedCloudbaseUserId),
    currentUserFound: true,
    currentUserOpenid: maskIdentifier(currentUser?.openid || currentUser?._openid || ""),
    currentUserProfileCompleted: Boolean(currentUser?.profileCompleted),
    currentUserDnaCompleted: Boolean(currentUser?.dnaCompleted),
    workflowFields: {
      departure: normalizeText(workflow?.fields?.departure),
      destination: normalizeText(workflow?.fields?.destination),
      time: normalizeText(workflow?.fields?.time),
      companionPreference: normalizeText(workflow?.fields?.companionPreference),
    },
    totalUsers: users.length,
    usersWithOpenid: withOpenid.length,
    usersWith_Openid: users.filter((item) => normalizeText(item?._openid)).length,
    excludingSelf: excludingSelf.length,
    profileCompleted: profileCompletedUsers.length,
    dnaCompleted: dnaCompletedUsers.length,
    finalCandidatePool: dnaCompletedUsers.length,
    sampleCandidateOpenids: dnaCompletedUsers
      .slice(0, 5)
      .map((item) => maskIdentifier(item?.openid || item?._openid || "")),
  });

  return dnaCompletedUsers
    .map((item) => buildBuddyCandidateCard(currentUser, item, workflow.fields || {}))
    .sort((left, right) => right.score - left.score)
    .slice(0, BUDDY_MAX_CANDIDATES);
}

export async function buildConversationWorkflow({
  question = "",
  contextPayload = {},
  cloudbaseUserId = "",
} = {}) {
  const mainline = detectMainline(question, contextPayload);
  const currentTaskState = getCurrentTaskState(contextPayload);

  if (mainline === MAINLINE.BUDDY) {
    const workflow = buildBuddyWorkflow(question, contextPayload);
    const buddyCandidates = workflow.missingField
      ? []
      : await buildBuddyCandidates(contextPayload, cloudbaseUserId, workflow);

    return {
      ...workflow,
      isReady: !workflow.missingField,
      buddyCandidates,
      lastAskedField: normalizeText(currentTaskState.lastAskedField),
    };
  }

  if (mainline === MAINLINE.GUIDE) {
    const workflow = buildGuideWorkflow(question, contextPayload);
    return {
      ...workflow,
      isReady: !workflow.missingField,
      lastAskedField: normalizeText(currentTaskState.lastAskedField),
    };
  }

  if (mainline === MAINLINE.FEEDBACK) {
    return {
      mainline,
      feedbackType:
        normalizeText(currentTaskState.feedbackType) ||
        classifyFeedbackType(question),
    };
  }

  return {
    mainline,
    lastAskedField: normalizeText(currentTaskState.lastAskedField),
  };
}

export async function buildUnifiedTaskState({
  question = "",
  contextPayload = {},
  cloudbaseUserId = "",
} = {}) {
  const workflow = await buildConversationWorkflow({
    question,
    contextPayload,
    cloudbaseUserId,
  });
  const currentTaskState = getCurrentTaskState(contextPayload);

  return {
    mainline: normalizeText(workflow?.mainline || currentTaskState?.mainline),
    collected: workflow?.fields || currentTaskState?.collected || {},
    missingField: workflow?.missingField
      ? {
          key: normalizeText(workflow.missingField.key),
          label: normalizeText(workflow.missingField.label),
          ask: normalizeText(workflow.missingField.ask),
        }
      : null,
    lastAskedField: normalizeText(
      workflow?.missingField?.key || workflow?.lastAskedField || currentTaskState?.lastAskedField
    ),
    feedbackType: normalizeText(workflow?.feedbackType || currentTaskState?.feedbackType),
    isReady: Boolean(workflow?.isReady),
  };
}

export async function buildBuddyMatchResult({
  departure = "",
  destination = "",
  time = "",
  companionPreference = "",
  cloudbaseUserId = "",
  contextPayload = {},
} = {}) {
  const mergedContextPayload = {
    ...(contextPayload || {}),
    currentTaskState: {
      ...(contextPayload?.currentTaskState || {}),
      mainline: MAINLINE.BUDDY,
      collected: {
        ...(contextPayload?.currentTaskState?.collected || {}),
        departure: normalizeText(departure),
        destination: normalizeText(destination),
        time: normalizeText(time),
        companionPreference: normalizeText(companionPreference),
      },
    },
  };

  const workflow = await buildConversationWorkflow({
    question: "",
    contextPayload: mergedContextPayload,
    cloudbaseUserId,
  });

  return {
    success: true,
    mainline: workflow?.mainline || MAINLINE.BUDDY,
    isReady: !!workflow?.isReady,
    missingField: workflow?.missingField
      ? {
          key: normalizeText(workflow.missingField.key),
          label: normalizeText(workflow.missingField.label),
          ask: normalizeText(workflow.missingField.ask),
        }
      : null,
    collected: workflow?.fields || {},
    candidates: normalizeBuddyCandidates(workflow?.buddyCandidates),
  };
}

export function buildGuideRecallQuestion(fields = {}) {
  const segments = [
    normalizeText(fields.destination),
    normalizeText(fields.time),
    normalizeText(fields.peopleCount),
    normalizeText(fields.relationship),
    normalizeText(fields.budget),
    "活动",
    "景点",
    "住宿",
    "路线",
  ].filter(Boolean);

  return segments.join(" ");
}

export function buildGuideGroundingPayload({
  question = "",
  contextPayload = {},
  guideFields = {},
} = {}) {
  const normalizedFields =
    guideFields && typeof guideFields === "object" ? guideFields : {};

  return {
    ...(contextPayload || {}),
    question: buildGuideRecallQuestion(normalizedFields) || normalizeText(question),
    location: contextPayload?.location || {},
    userProfile: contextPayload?.userProfile || {},
    preferences: contextPayload?.preferences || {},
    skillContext: {
      ...(contextPayload?.skillContext || {}),
      mode: MAINLINE.GUIDE,
      title: normalizeText(contextPayload?.skillContext?.title) || "攻略定制",
      collected: {
        ...(contextPayload?.skillContext?.collected || {}),
        ...normalizedFields,
      },
    },
    currentTaskState: {
      ...(contextPayload?.currentTaskState || {}),
      mainline: MAINLINE.GUIDE,
      collected: {
        ...(contextPayload?.currentTaskState?.collected || {}),
        ...normalizedFields,
      },
    },
  };
}

function normalizeGuideCandidates(candidates = []) {
  const normalized = (Array.isArray(candidates) ? candidates : [])
    .filter((item) => normalizeText(item.type) !== "product")
    .slice(0, GUIDE_MAX_CANDIDATES)
    .map((item) => ({
      id: normalizeText(item.id),
      type: normalizeText(item.type),
      title: normalizeText(item.title),
      region: normalizeText(item.region),
      priceText: normalizeText(item.priceText),
      summary: normalizeText(item.summary),
      tags: normalizeArray(item.tags),
    }));

  console.log("[agent-yuxiaohe] normalizeGuideCandidates", {
    inputCount: Array.isArray(candidates) ? candidates.length : 0,
    outputCount: normalized.length,
    output: normalized,
  });

  return normalized;
}

function normalizeBuddyCandidates(candidates = []) {
  return (Array.isArray(candidates) ? candidates : []).map((item) => ({
    id: normalizeText(item.id),
    nickname: normalizeText(item.title),
    region: normalizeText(item.region),
    summary: normalizeText(item.summary),
    tags: normalizeArray(item.tags),
    matchReason: normalizeText(item.matchReason),
  }));
}

export async function buildGuideCustomizationResult({
  time = "",
  peopleCount = "",
  relationship = "",
  budget = "",
  destination = "",
  contextPayload = {},
} = {}) {
  const mergedContextPayload = {
    ...(contextPayload || {}),
    currentTaskState: {
      ...(contextPayload?.currentTaskState || {}),
      mainline: MAINLINE.GUIDE,
      collected: {
        ...(contextPayload?.currentTaskState?.collected || {}),
        time: normalizeText(time),
        peopleCount: normalizeText(peopleCount),
        relationship: normalizeText(relationship),
        budget: normalizeText(budget),
        destination: normalizeText(destination),
      },
    },
  };

  const workflow = await buildConversationWorkflow({
    question: "",
    contextPayload: mergedContextPayload,
    cloudbaseUserId: "",
  });

  if (!workflow?.isReady) {
    return {
      success: true,
      mainline: workflow?.mainline || MAINLINE.GUIDE,
      isReady: false,
      missingField: workflow?.missingField
        ? {
            key: normalizeText(workflow.missingField.key),
            label: normalizeText(workflow.missingField.label),
            ask: normalizeText(workflow.missingField.ask),
          }
        : null,
      collected: workflow?.fields || {},
      candidates: [],
    };
  }

  const groundingContext = await buildPlatformGroundingContext(
    buildGuideGroundingPayload({
      question: buildGuideRecallQuestion(workflow.fields || {}),
      contextPayload: mergedContextPayload,
      guideFields: workflow.fields || {},
    })
  );

  return {
    success: true,
    mainline: workflow?.mainline || MAINLINE.GUIDE,
    isReady: true,
    missingField: null,
    collected: workflow?.fields || {},
    candidates: normalizeGuideCandidates(groundingContext?.candidates || []),
  };
}

export async function buildConversationStateResult({
  question = "",
  contextPayload = {},
  cloudbaseUserId = "",
} = {}) {
  const workflow = await buildConversationWorkflow({
    question,
    contextPayload,
    cloudbaseUserId,
  });
  const unifiedTaskState = await buildUnifiedTaskState({
    question,
    contextPayload,
    cloudbaseUserId,
  });

  let candidates = [];

  if (
    normalizeText(unifiedTaskState?.mainline) === MAINLINE.GUIDE &&
    Boolean(unifiedTaskState?.isReady)
  ) {
    const guideFields = workflow?.fields || unifiedTaskState?.collected || {};
    console.log("[agent-yuxiaohe] conversation-state guide fields", {
      question: normalizeText(question),
      guideFields,
    });
    const groundingContext = await buildPlatformGroundingContext(
      buildGuideGroundingPayload({
        question,
        contextPayload,
        guideFields,
      })
    );

    console.log("[agent-yuxiaohe] conversation-state guide grounding", {
      candidateCount: Array.isArray(groundingContext?.candidates)
        ? groundingContext.candidates.length
        : 0,
      candidates: groundingContext?.candidates || [],
    });

    candidates = normalizeGuideCandidates(groundingContext?.candidates || []);
  }

  if (
    normalizeText(unifiedTaskState?.mainline) === MAINLINE.BUDDY &&
    Boolean(unifiedTaskState?.isReady)
  ) {
    candidates = normalizeBuddyCandidates(workflow?.buddyCandidates);
  }

  return {
    success: true,
    mainline: normalizeText(unifiedTaskState?.mainline),
    collected: unifiedTaskState?.collected || {},
    missingField: unifiedTaskState?.missingField || null,
    lastAskedField: normalizeText(unifiedTaskState?.lastAskedField),
    feedbackType: normalizeText(unifiedTaskState?.feedbackType),
    isReady: Boolean(unifiedTaskState?.isReady),
    candidates,
  };
}

export function buildAgentUserPrompt({
  question = "",
  groundingContext = {},
  workflowContext = {},
  contextPayload = {},
} = {}) {
  const normalizedQuestion = normalizeText(question);
  const regionLabel = normalizeText(groundingContext?.regionLabel) || DEFAULT_REGION_LABEL;
  const profileTags = normalizeArray(contextPayload?.userProfile?.dnaTags).join("、");
  const preferencePairs = Object.entries(contextPayload?.preferences || {})
    .map(([key, value]) => [normalizeText(key), normalizeText(value)])
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
  const skillMode = normalizeText(contextPayload?.skillContext?.mode);
  const skillTitle = normalizeText(contextPayload?.skillContext?.title);
  const skillPairs = Object.entries(getMergedCollected(contextPayload))
    .map(([key, value]) => [normalizeText(key), normalizeText(value)])
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
  const mainline = workflowContext?.mainline || detectMainline(question, contextPayload);
  const shouldAttachPlatformGrounding =
    mainline === MAINLINE.GUIDE || mainline === MAINLINE.GENERIC;

  const buddyFields = workflowContext?.fields || {};
  const guideFields = workflowContext?.fields || {};
  const buddyCandidates = Array.isArray(workflowContext?.buddyCandidates)
    ? workflowContext.buddyCandidates
    : [];

  const mainlineInstruction =
    mainline === MAINLINE.BUDDY
      ? [
          "当前主线：找搭子。",
          "第一轮只问 1 个最必要的问题。",
          "目标字段只有：出发地、目的地、时间、同行偏好。",
          `当前字段：出发地=${buddyFields.departure || "未提供"}；目的地=${buddyFields.destination || "未提供"}；时间=${buddyFields.time || "未提供"}；同行偏好=${buddyFields.companionPreference || "未提供"}。`,
          workflowContext?.missingField
            ? `信息还不足，当前只追问这个问题：${workflowContext.missingField.ask}`
            : buddyCandidates.length
              ? `信息已足够，请仅基于这些搭子候选回答，并说明匹配理由：\n${buddyCandidates.map((item, index) => `${index + 1}. ${item.title}｜${item.region}｜${item.matchReason}`).join("\n")}`
              : "信息已足够，但当前没有合适候选。请明确说明“当前没有合适候选”，并建议补充时间、出发地或同行偏好。",
          "禁止跳成商品、景点、特产推荐。",
          "禁止因为“美食”等兴趣词误判成商品推荐。",
        ].join("\n")
      : mainline === MAINLINE.GUIDE
        ? [
            "当前主线：攻略定制。",
            "先收集：时间、人数、关系、预算、目的地。",
            `当前字段：时间=${guideFields.time || "未提供"}；人数=${guideFields.peopleCount || "未提供"}；关系=${guideFields.relationship || "未提供"}；预算=${guideFields.budget || "未提供"}；目的地=${guideFields.destination || "未提供"}。`,
            workflowContext?.missingField
              ? `当前信息不足，只问这一个关键问题：${workflowContext.missingField.ask}`
              : "信息足够后再生成路线和建议，并且必须解释“为什么推荐这些”。",
            "不得脑补平台中不存在的内容。",
          ].join("\n")
        : mainline === MAINLINE.FEEDBACK
          ? [
              "当前主线：树洞反馈。",
              `当前反馈分类：${workflowContext?.feedbackType || "普通反馈"}。`,
              "以接住情绪、接收意见为主。",
              "不导购、不推荐、不跳业务主线，只在必要时温和追问。",
            ].join("\n")
          : mainline === MAINLINE.WEATHER
            ? "当前主线：天气/位置。只负责天气、位置、穿衣和出行提醒，不扩题。"
            : [
                "当前主线：普通聊天防串场。",
                "不是天气意图不要查天气。",
                "不是商品意图不要推商品。",
                "不是搭子意图不要匹配搭子。",
                "不确定时先确认，不要自动跳任务。",
              ].join("\n");

  const sections = [
    "你是智能体“裕小禾”，对话中自称“小禾”。",
    "“问小禾”只是小程序里的功能入口名，不是你的名字。",
    "你必须优先使用平台候选和上下文，不得编造平台中不存在的内容。",
    "如果缺数据，要明确说明缺什么。",
    skillMode ? `当前对话来自技能流程：${skillTitle || skillMode}` : "",
    skillPairs.length ? `已收集任务字段：${skillPairs.join("；")}` : "",
    `当前执行主线：${mainline}`,
    mainlineInstruction,
    `用户当前问题：${normalizedQuestion}`,
    `用户当前地区：${regionLabel}`,
    profileTags ? `用户画像标签：${profileTags}` : "",
    preferencePairs.length ? `用户偏好：${preferencePairs.join("；")}` : "",
    shouldAttachPlatformGrounding ? groundingContext?.prompt || "" : "",
    mainline === MAINLINE.GUIDE && workflowContext?.isReady
      ? "攻略主线在信息齐全时，正文只允许输出简短承接、轻量解释和温馨提示，不允许用 1. 2. 3. 枚举推荐项，不允许重复复述具体候选标题、摘要和明细；具体推荐内容由前端结构化卡片展示。"
      : "",
    "请直接开始回答用户。",
  ];

  return sections.filter(Boolean).join("\n\n");
}

export class DetectCloudbaseUserMiddleware {
  constructor(request) {
    this.request = request;
  }

  async beforeAgent({ input }) {
    const authorization =
      this.request?.headers?.authorization ||
      this.request?.headers?.Authorization ||
      this.request?.headers?.get?.("authorization") ||
      this.request?.headers?.get?.("Authorization") ||
      "";

    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return;

    try {
      const payload = jwtDecode(token);
      input.forwardedProps = {
        ...(input.forwardedProps || {}),
        cloudbaseUserId: payload?.uid || payload?.sub || payload?.openid || payload?.user_id || "",
      };
    } catch (error) {
      console.warn("[DetectCloudbaseUserMiddleware] jwt decode failed", error?.message || error);
    }
  }
}
