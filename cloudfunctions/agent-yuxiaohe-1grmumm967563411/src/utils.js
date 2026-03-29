import { jwtDecode } from "jwt-decode";
import tcb from "@cloudbase/node-sdk";

const LOCATION_WORD_REGEXP = /(附近|周边|本地|同城|这里|这边|当前位置|现在)/;
const DEFAULT_REGION_LABEL = "未提供地区";
const MAX_DATASET_FETCH = 60;
const MAX_CANDIDATE_PER_TYPE = 3;

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

function removeRegionSuffix(value) {
  return normalizeText(value)
    .replace(/(特别行政区|自治区|自治州|地区|盟)$/u, "")
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

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPriceText(item = {}, type = "activity") {
  const price = safeNumber(item.priceFrom || item.price || 0);
  if (!price) {
    return type === "hotel" ? "价格待定" : "可咨询";
  }

  return type === "hotel" ? `￥${price}/晚` : `￥${price}起`;
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

  if (/活动|采摘|研学|体验|农旅|亲子|周末|玩/.test(text)) {
    requested.push("activity");
  }
  if (/景|观光|古村|花海|打卡|拍照/.test(text)) {
    requested.push("scenic");
  }
  if (/民宿|酒店|住宿|住/.test(text)) {
    requested.push("hotel");
  }
  if (/特产|商品|礼盒|伴手礼|买/.test(text)) {
    requested.push("product");
  }

  return requested.length ? requested : ["activity", "scenic", "hotel", "product"];
}

function scoreLocation(item = {}, regionTokens = []) {
  if (!regionTokens.length) {
    return 0;
  }

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
  if (!intentTokens.length) {
    return 0;
  }

  const text = joinSearchText(item);
  return intentTokens.reduce((score, token) => {
    if (!token) {
      return score;
    }
    return score + (text.includes(normalizeTextLower(token)) ? 8 : 0);
  }, 0);
}

function scoreNearbyIntent(question = "", item = {}, location = {}) {
  if (!LOCATION_WORD_REGEXP.test(question)) {
    return 0;
  }

  const regionText = buildRegionLabel(location);
  const itemRegion = getItemRegionText(item) || normalizeText(item.locationName) || normalizeText(item.address);
  return itemRegion && regionText !== DEFAULT_REGION_LABEL && itemRegion.includes(removeRegionSuffix(regionText)) ? 10 : 0;
}

function scoreSourceType(type, requestedTypes = []) {
  if (!requestedTypes.length) {
    return 0;
  }

  if (requestedTypes[0] === type) {
    return 20;
  }

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
    item.title || item.name || item.locationName || {
      activity: "农旅活动",
      scenic: "乡村景点",
      hotel: "乡野民宿",
      product: "乡味商品",
    }[type]
  );
  const region = getItemRegionText(item) || normalizeText(item.locationName) || normalizeText(item.address) || "地区待补充";
  const summary = normalizeText(item.summary || item.content || item.desc || item.description || item.detail);
  const tags = uniqueList([
    ...normalizeArray(item.tags),
    ...normalizeArray(item.travelModeTags),
    ...normalizeArray(item.playTags),
    ...normalizeArray(item.suitableGroups),
    ...normalizeArray(item.categoryTags),
  ]).slice(0, 4);

  return {
    id: normalizeText(item._id || item.id),
    type,
    title,
    region,
    priceText: getPriceText(item, type),
    summary,
    tags,
  };
}

function formatCandidateLine(candidate, index) {
  const summary = candidate.summary ? `；简介：${candidate.summary}` : "";
  const tags = candidate.tags.length ? `；标签：${candidate.tags.join("、")}` : "";
  return `${index + 1}. [${candidate.type}] ${candidate.title}（ID: ${candidate.id || "无"}；地区：${candidate.region}；价格：${candidate.priceText}${tags}${summary}）`;
}

function getCloudbaseApp() {
  if (cloudbaseApp) {
    return cloudbaseApp;
  }

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
}) {
  const regionTokens = buildRegionTokens(location);
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

  const sorted = sortByScore(candidates);
  const grouped = {
    activity: [],
    scenic: [],
    hotel: [],
    product: [],
  };

  sorted.forEach((candidate) => {
    if (grouped[candidate.type].length >= MAX_CANDIDATE_PER_TYPE) {
      return;
    }
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
    regionLabel: buildRegionLabel(location),
    selected,
    grouped,
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

  const location = payload.location || {};
  const userProfile = payload.userProfile || {};
  const preferences = payload.preferences || {};
  const datasets = payload.platformDataset || (await loadPlatformDataset());
  const ranked = buildRankedCandidates({
    question,
    location,
    userProfile,
    datasets,
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
    "你是智能体“裕小禾”，昵称“小禾”。",
    "“问小禾”只是小程序聊天模块名，不是你的名字。",
    `用户问题：${question}`,
    `用户地区：${ranked.regionLabel}`,
    profileText ? `用户画像标签：${profileText}` : "",
    preferenceText ? `用户偏好：${preferenceText}` : "",
    ranked.intentTokens.length ? `问题意图关键词：${ranked.intentTokens.join("、")}` : "",
    "以下是平台实时筛出的候选数据，请只基于这些数据回答，不要编造平台里不存在的内容：",
    dataBlock,
    "回答要求：",
    "1. 优先按用户地区收敛回答，直接点名候选内容。",
    "2. 明确说明这些候选为什么适合用户当前问题，不要泛泛列举通用玩法。",
    "3. 如果候选不足，就明确说“当前平台在该区域下筛到的内容有限”，不要虚构额外推荐。",
    "4. 回答中用“裕小禾”或“小禾”自称，不要把“问小禾”当成智能体名字。",
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

export function buildAgentUserPrompt({
  question = "",
  groundingContext = {},
  contextPayload = {},
} = {}) {
  const normalizedQuestion = normalizeText(question);
  const regionLabel = normalizeText(groundingContext?.regionLabel) || DEFAULT_REGION_LABEL;
  const profileTags = normalizeArray(contextPayload?.userProfile?.dnaTags).join("、");
  const preferencePairs = Object.entries(contextPayload?.preferences || {})
    .map(([key, value]) => [normalizeText(key), normalizeText(value)])
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);

  const sections = [
    "你是智能体“裕小禾”，对话时自称“小禾”。",
    "“问小禾”只是小程序里的功能模块名，不是你的名字。",
    "你要基于当前小程序平台能力回答，优先使用已经提供的平台候选内容和用户上下文，不要编造平台里不存在的内容。",
    "如果问题涉及平台推荐，要结合用户地区、偏好和候选内容直接给出贴近当前需求的建议。",
    "如果信息不足，要诚实说明，并给出下一步更具体的提问建议。",
    `用户当前问题：${normalizedQuestion}`,
    `用户当前地区：${regionLabel}`,
    profileTags ? `用户画像标签：${profileTags}` : "",
    preferencePairs.length ? `用户偏好：${preferencePairs.join("；")}` : "",
    groundingContext?.prompt || "",
    "请直接开始回答用户问题。",
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

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return;
    }

    try {
      const payload = jwtDecode(token);
      input.forwardedProps = {
        ...(input.forwardedProps || {}),
        cloudbaseUserId:
          payload?.uid || payload?.sub || payload?.openid || payload?.user_id || "",
      };
    } catch (error) {
      console.warn(
        "[DetectCloudbaseUserMiddleware] jwt decode failed",
        error?.message || error
      );
    }
  }
}
