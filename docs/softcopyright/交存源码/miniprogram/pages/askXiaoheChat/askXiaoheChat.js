const {
  yuxiaoheBotId,
  yuxiaoheHttpBaseUrl
} = require("../../config/agent")
const { resolveActivityCover, resolveActivityGallery } = require("../../utils/mediaAssets")
const { buildActivityCoverTags } = require("../../utils/activityCoverTags")
const { createBuddyApplicationFromMatch } = require("../../utils/messageStore")
const {
  buildConversationTitle,
  createConversationId,
  getConversationById,
  saveConversation
} = require("../../utils/askConversationStore")

const DEFAULT_ACTIVITY_COVER = "/images/nav-academy.png"
const DEFAULT_PRODUCT_COVER = "/images/default-goods-image.png"
const LOADING_BASE_TEXT = "小禾正在整理合适的内容"

function normalizeSkillMode(skillMode = "") {
  return skillMode === "route_planning" ? "guide_customization" : skillMode
}

const SKILL_CONFIG = {
  guide_customization: {
    badgeName: "攻略定制",
    placeholder: "告诉小禾这次想怎么安排行程",
    intro: "把这次行程的想法告诉小禾，小禾会像聊天一样一步步帮你梳理出发日期、天数、人数、关系、路线、预算和出行方式。"
  },
  buddy_matching: {
    badgeName: "找搭子",
    placeholder: "告诉小禾你想找什么样的搭子",
    intro: "告诉小禾你想去哪、什么时候出发、希望和什么样的人同行，小禾会先帮你筛出更合适的同行候选，再由你决定要不要发起申请。"
  },
  xiaohe_feedback: {
    badgeName: "小禾树洞",
    placeholder: "说说你的想法",
    intro: "无论是活动、商品、住宿还是体验建议，都可以直接告诉小禾，小禾会认真记下来。"
  }
}

const DEFAULT_BUDDY_TAGS = ["周末出发", "自由行", "轻社交"]

const GENERIC_BUDDY_STATUS_TAGS = ["偏好接近"]
const GENERIC_BUDDY_TAGS = ["还在建立中"]
const GENERIC_BUDDY_HIGHLIGHT_KEYWORDS = ["共同偏好", "资料完整度", "还在建立中"]
const GENERIC_BUDDY_PRACTICAL_VALUES = ["轻同行搭子", "同区域"]

function normalizeText(value) {
  return String(value || "").trim()
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : []
}

function normalizeTextLower(value) {
  return normalizeText(value).toLowerCase()
}

function getSettingAsync() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: resolve,
      fail: reject
    })
  })
}

function getLocationAsync(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("getLocation timeout"))
    }, timeout)

    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        clearTimeout(timer)
        resolve(res)
      },
      fail: (error) => {
        clearTimeout(timer)
        reject(error)
      }
    })
  })
}

function readSelectedRegion() {
  try {
    return wx.getStorageSync("selectedRegion") || null
  } catch (error) {
    return null
  }
}

function buildLocationContext(userInfo = {}, userLocation = null, selectedRegion = null) {
  const region = selectedRegion || {}
  const location = userLocation || {}

  return {
    province: region.province || userInfo.province || "",
    city: region.city || userInfo.city || "",
    district: region.district || userInfo.district || "",
    displayName: region.displayName || region.title || region.label || "",
    locationText: region.locationText || region.address || "",
    latitude: location.latitude || region.latitude || "",
    longitude: location.longitude || region.longitude || ""
  }
}

function ensureBuddySession() {
  const app = getApp()
  if (app.hasActiveSession && app.hasActiveSession()) {
    return true
  }

  wx.showToast({
    title: "请先登录后再找搭子",
    icon: "none"
  })

  setTimeout(() => {
    wx.navigateTo({
      url: "/pages/login/login"
    })
  }, 250)

  return false
}

function uniqueList(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)))
}

function requestAgentHttp({ path = "/", method = "GET", data = {} } = {}) {
  if (!yuxiaoheHttpBaseUrl) {
    return Promise.reject(new Error("yuxiaoheHttpBaseUrl is required"))
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${yuxiaoheHttpBaseUrl}${normalizedPath}`,
      method,
      data,
      header: {
        "content-type": "application/json"
      },
      success: (res) => {
        const statusCode = Number(res && res.statusCode)
        if (statusCode >= 200 && statusCode < 300) {
          resolve(res.data)
          return
        }

        const error = new Error(`request failed with status ${statusCode}`)
        error.statusCode = statusCode
        error.responseData = res && res.data
        try {
          console.error("[askXiaoheChat] requestAgentHttp non-2xx", {
            path: normalizedPath,
            method,
            statusCode,
            responseData: res && res.data
          })
        } catch (logError) {
          console.warn("[askXiaoheChat] inspect requestAgentHttp non-2xx failed", logError)
        }
        reject(error)
      },
      fail: reject
    })
  })
}

function filterBuddyStatusTag(tag = "") {
  const text = normalizeText(tag)
  return GENERIC_BUDDY_STATUS_TAGS.includes(text) ? "" : text
}

function filterBuddyTags(tags = []) {
  return uniqueList(normalizeArray(tags).filter((tag) => !GENERIC_BUDDY_TAGS.includes(tag)))
}

function filterBuddyHighlights(items = []) {
  return normalizeArray(items).filter(
    (item) => !GENERIC_BUDDY_HIGHLIGHT_KEYWORDS.some((keyword) => item.includes(keyword))
  )
}

function filterBuddyPracticalInfo(list = []) {
  return (Array.isArray(list) ? list : []).filter((item) => {
    const value = normalizeText(item && item.value)
    return value && !GENERIC_BUDDY_PRACTICAL_VALUES.includes(value)
  })
}

function buildBuddyDisplaySummary(item = {}) {
  const tags = filterBuddyTags(item.tags)
  if (tags.length) {
    return `真实标签：${tags.slice(0, 3).join("、")}`
  }

  const practicalInfo = filterBuddyPracticalInfo(item.practicalInfo)
  const locationInfo = practicalInfo.find((entry) => normalizeText(entry && entry.label).includes("地区"))
  if (locationInfo && locationInfo.value) {
    return `真实资料：来自${locationInfo.value}`
  }

  return "以下展示的是该用户已填写的公开资料，以及系统基于资料生成的匹配结果。"
}

function buildBuddySystemReason(item = {}) {
  const parts = []
  const statusTag = filterBuddyStatusTag(item.statusTag)
  const tags = filterBuddyTags(item.tags)

  if (statusTag) {
    parts.push(statusTag)
  }

  if (tags.length) {
    parts.push(`标签重合 ${Math.min(tags.length, 3)} 项`)
  }

  if (item.matchScore) {
    parts.push(`匹配度 ${item.matchScore}%`)
  }

  return `系统匹配说明：${parts.join(" + ") || "已根据地区、已填写标签和资料完整度完成匹配"}`
}

function normalizeBuddyRecommendation(item = {}) {
  const tags = filterBuddyTags(item.tags)
  const practicalInfo = filterBuddyPracticalInfo(item.practicalInfo)

  return {
    ...item,
    statusTag: filterBuddyStatusTag(item.statusTag),
    summary: normalizeBuddySummaryText(item.summary, normalizeText(item.region)),
    matchReason: normalizeText(item.matchReason) || buildBuddySystemReason({ ...item, tags }),
    reasonTitle: "系统匹配说明",
    tags,
    playItems: filterBuddyHighlights(item.playItems),
    practicalInfo,
  }
}

function trimRegionSuffix(value = "") {
  return normalizeText(value).replace(/(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/u, "")
}

function buildBuddyAvatarText(name = "") {
  const text = normalizeText(name)
  return text ? text.slice(0, 1).toUpperCase() : "搭"
}

function buildBuddyAvatarColor(name = "") {
  const palette = ["#7A8CFF", "#8B6BFF", "#4FA7A7", "#F08A5D", "#6C9A8B"]
  const text = normalizeText(name)
  if (!text) return palette[0]

  const codeSum = text.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palette[codeSum % palette.length]
}

function buildBuddyOpeningText(item = {}) {
  const name = normalizeText(item.title || item.nickname) || "这位搭子"
  const region = normalizeText(item.region)
  const matchReason = normalizeText(item.matchReason)
  if (region && matchReason) {
    return `你好，${name}，我看到你也在关注${region}方向的同行安排，尤其是“${matchReason}”这一点和我的想法很接近，想和你进一步聊聊出发时间和集合方式。`
  }
  if (region) {
    return `你好，${name}，我看到你也在关注${region}方向的同行安排，想和你进一步聊聊出发时间和集合方式。`
  }
  return `你好，${name}，我想和你进一步聊聊这次同行安排，看看我们是不是适合一起出发。`
}

function buildBuddyPracticalInfoFromCandidate(item = {}) {
  const info = []
  const region = normalizeText(item.region)
  if (region && !/待补充|未提供|未知/u.test(region)) {
    info.push({ label: "所在地区", value: region })
  }
  return info
}

function buildBuddyHighlightsFromCandidate(item = {}) {
  const tags = filterBuddyTags(item.tags)
  if (tags.length) {
    return tags.slice(0, 3)
  }

  return ["资料比较完整", "可以先聊聊出发时间和同行节奏"]
}

function normalizeBuddySummaryText(summary = "", region = "") {
  const text = normalizeText(summary)
  if (
    !text ||
    /已完善基础资料|可进一步发起同行申请|轻同行候选|同行候选/u.test(text)
  ) {
    if (region && !/待补充|未提供|未知/u.test(region)) {
      return `对方也在关注${region}方向的同行安排，可以先从时间和路线聊起。`
    }
    return "这位搭子的资料已经比较完整，可以先从时间和路线聊起。"
  }

  return text
}

function createMessage(role, text, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    role,
    text,
    recommendations: [],
    tips: "",
    guessQuestions: [],
    followUp: "",
    channelLabel: "",
    ...extra
  }
}

function buildSkillContext(skillMode = "") {
  if (!skillMode || !SKILL_CONFIG[skillMode]) {
    return null
  }

  return {
    mode: skillMode,
    title: SKILL_CONFIG[skillMode].badgeName,
    collected: {}
  }
}

const MAINLINE_BY_SKILL_MODE = {
  buddy_matching: "buddy_matching",
  guide_customization: "guide_customization",
  xiaohe_feedback: "xiaohe_feedback"
}

function createEmptyTaskState(mainline = "") {
  return {
    mainline: normalizeText(mainline),
    subType: "",
    collected: {},
    missingField: "",
    lastAskedField: "",
    candidateIds: [],
    feedbackType: "",
    intentConfidence: mainline ? 1 : 0
  }
}

function createInitialTaskState(skillMode = "") {
  const mainline = MAINLINE_BY_SKILL_MODE[normalizeText(skillMode)] || ""
  return createEmptyTaskState(mainline)
}

function buildTaskStateFromBackend(result = {}, fallbackState = {}) {
  const collected = result && result.collected && typeof result.collected === "object"
    ? { ...result.collected }
    : { ...(fallbackState.collected || {}) }
  const missingField = result && result.missingField && typeof result.missingField === "object"
    ? normalizeText(result.missingField.key || result.missingField.label)
    : normalizeText(result && result.missingField)

  return {
    ...createEmptyTaskState(normalizeText(result && result.mainline)),
    ...fallbackState,
    mainline: normalizeText(result && result.mainline) || normalizeText(fallbackState.mainline),
    collected,
    missingField,
    lastAskedField: normalizeText(result && result.lastAskedField) || missingField || normalizeText(fallbackState.lastAskedField),
    candidateIds: normalizeArray((result.candidates || []).map((item) => item && item.id)),
    feedbackType: normalizeText(result && result.feedbackType) || normalizeText(fallbackState.feedbackType),
    intentConfidence: 1
  }
}

function buildGuideCardIntro(taskState = {}) {
  const collected = (taskState && taskState.collected) || {}
  const time = normalizeText(collected.time)
  const relationship = normalizeText(collected.relationship)
  const destination = normalizeText(collected.destination)
  const budget = normalizeText(collected.budget)

  const segments = [
    time ? `${time}期间` : "",
    relationship ? `和${relationship}` : "",
    destination ? `去${destination}` : "",
    budget ? `预算在${budget}` : ""
  ].filter(Boolean)

  if (!segments.length) {
    return "小禾先帮你把这次更合适的活动和景点整理成卡片啦。"
  }

  return `小禾先按你这次${segments.join("，")}的需求，整理了几张更适合直接参考的卡片。`
}

function buildGuideWarmTips(taskState = {}) {
  const collected = (taskState && taskState.collected) || {}
  const destination = normalizeText(collected.destination) || "目的地"
  const time = normalizeText(collected.time)
  const relationship = normalizeText(collected.relationship)
  const budget = normalizeText(collected.budget)

  const tips = []

  if (time) {
    tips.push(`${time}前往${destination}时，建议优先确认开放时间、天气和路况，假期时段也尽量早点出发。`)
  } else {
    tips.push(`去${destination}前，记得再确认开放时间、天气和交通情况。`)
  }

  if (relationship) {
    tips.push(`这次同行关系是${relationship}，更适合把节奏放慢一些，给拍照、休息和临时调整留出余量。`)
  } else if (budget) {
    tips.push(`预算在${budget}的话，建议优先把同一区域的点位串起来，行程会更从容。`)
  } else {
    tips.push("如果你愿意，小禾还可以继续帮你把这些卡片串成半天或一天的具体安排。")
  }

  return ["温馨提示"]
    .concat(tips.slice(0, 2).map((item, index) => `${index + 1}. ${item}`))
    .join("\n")
}

function buildGuideFallbackRecommendation(item = {}) {
  const type = normalizeText(item && item.type)
  const sourceId = normalizeText(item && item.id)
  if (!type || !sourceId) return null

  const practicalInfo = []
  const region = normalizeText(item && item.region)
  const priceText = normalizeText(item && item.priceText)

  if (region) {
    practicalInfo.push({ label: "所在区域", value: region })
  }

  if (priceText) {
    practicalInfo.push({ label: "参考价格", value: priceText })
  }

  return {
    id: `${type}-${sourceId}`,
    sourceId,
    type,
    title: normalizeText(item && item.title) || "推荐内容",
    summary: normalizeText(item && item.summary) || "小禾先帮你筛出了一个合适选项。",
    gallery: [],
    tags: normalizeArray(item && item.tags).slice(0, 4),
    playItems: [],
    practicalInfo
  }
}

function buildGuideFocusItems(taskState = {}, candidate = {}, item = {}, type = "") {
  const collected = (taskState && taskState.collected) || {}
  const destination = normalizeText(collected.destination)
  const time = normalizeText(collected.time)
  const relationship = normalizeText(collected.relationship)
  const budget = normalizeText(collected.budget)
  const region = normalizeText(candidate.region || item.region || item.locationName)
  const tags = uniqueList(
    normalizeArray(item.highlights)
      .concat(normalizeArray(item.itinerary))
      .concat(normalizeArray(item.playTags))
      .concat(normalizeArray(item.categoryTags))
      .concat(normalizeArray(item.tags))
      .concat(normalizeArray(item.suitableGroups))
      .concat(normalizeArray(candidate.tags))
  )

  const focusItems = []

  if (destination && region) {
    focusItems.push(`地点落在${region}，和这次去${destination}的安排更顺路。`)
  }

  if (relationship) {
    focusItems.push(`这类${type === "product" ? "内容" : "行程"}更适合和${relationship}一起慢慢体验，节奏不会太赶。`)
  }

  if (time) {
    focusItems.push(`${time}出行时更建议把它当作半天到大半天的安排，留出机动时间会更舒服。`)
  }

  if (budget) {
    const priceText = normalizeText(candidate.priceText || item.priceText || item.price)
    focusItems.push(priceText ? `当前参考价格是${priceText}，更方便和你这次${budget}的预算一起衡量。` : `这类安排更适合纳入你这次${budget}的整体预算里一起考虑。`)
  }

  tags.forEach((tag) => {
    if (focusItems.length < 4 && normalizeText(tag)) {
      focusItems.push(normalizeText(tag))
    }
  })

  return uniqueList(focusItems).slice(0, 4)
}

function buildGuidePracticalInfo(taskState = {}, candidate = {}, item = {}, type = "") {
  const collected = (taskState && taskState.collected) || {}
  const destination = normalizeText(collected.destination)
  const time = normalizeText(collected.time)
  const relationship = normalizeText(collected.relationship)
  const region = normalizeText(candidate.region || item.region || item.locationName || item.address)
  const priceText = normalizeText(candidate.priceText || item.priceText || item.price)

  const info = []

  if (region) {
    info.push({ label: "所在区域", value: region })
  } else if (destination) {
    info.push({ label: "所在区域", value: destination })
  }

  if (priceText) {
    info.push({ label: type === "hotel" ? "参考房价" : "参考价格", value: priceText })
  }

  if (time) {
    info.push({ label: "建议安排", value: `${time}更适合预留半天到大半天来体验` })
  }

  if (relationship) {
    info.push({ label: "同行建议", value: `按${relationship}的节奏慢慢走，会比赶点式打卡更舒服` })
  }

  if (!info.length) {
    if (type === "activity") return getActivityPracticalInfo(item)
    if (type === "scenic") return getScenicPracticalInfo(item)
    if (type === "product") return getProductPracticalInfo(item)
  }

  return info.slice(0, 4)
}

async function buildActivityRecommendationCard(item = {}, candidate = {}, taskState = {}) {
  const coverTagInfo = buildActivityCoverTags(item)
  const playItems = buildGuideFocusItems(taskState, candidate, item, "activity")
  const gallery = await resolveActivityGallery(item)

  return {
    id: normalizeText(item._id || item.id || candidate.id),
    sourceId: normalizeText(item._id || item.id || candidate.id),
    type: "activity",
    title: normalizeText(item.title || candidate.title) || "农旅活动",
    summary: normalizeText(candidate.summary || item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
    gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
    tags: coverTagInfo.combinedTags.slice(0, 4),
    playItems: playItems.length ? playItems : ["活动亮点待补充"],
    practicalInfo: buildGuidePracticalInfo(taskState, candidate, item, "activity"),
    cover: await resolveActivityCover(item)
  }
}

function buildScenicRecommendationCard(item = {}, candidate = {}, taskState = {}) {
  const cover = normalizeText(item.cover) || DEFAULT_ACTIVITY_COVER
  const gallery = Array.isArray(item.gallery) && item.gallery.length
    ? item.gallery.filter(Boolean).slice(0, 2)
    : [cover]
  const playItems = buildGuideFocusItems(taskState, candidate, item, "scenic")

  return {
    id: normalizeText(item._id || item.id || candidate.id),
    sourceId: normalizeText(item._id || item.id || candidate.id),
    type: "scenic",
    title: normalizeText(item.locationName || item.title || candidate.title) || "乡村景点",
    summary: normalizeText(candidate.summary || item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
    gallery,
    tags: uniqueList(normalizeArray(item.playTags).concat(normalizeArray(item.tags))).slice(0, 4),
    playItems: playItems.length ? playItems : ["游玩亮点待补充"],
    practicalInfo: buildGuidePracticalInfo(taskState, candidate, item, "scenic"),
    cover
  }
}

function buildProductRecommendationCard(item = {}, candidate = {}, taskState = {}) {
  const cover = normalizeText(item.cover) || DEFAULT_PRODUCT_COVER
  const playItems = buildGuideFocusItems(taskState, candidate, item, "product")

  return {
    id: normalizeText(item._id || item.id || candidate.id),
    sourceId: normalizeText(item._id || item.id || candidate.id),
    type: "product",
    title: normalizeText(item.title || candidate.title) || "乡味特产",
    summary: normalizeText(candidate.summary || item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
    gallery: [cover],
    tags: uniqueList(normalizeArray(item.categoryTags).concat(normalizeArray(item.tags))).slice(0, 4),
    playItems: playItems.length ? playItems : ["选购亮点待补充"],
    practicalInfo: buildGuidePracticalInfo(taskState, candidate, item, "product"),
    cover
  }
}

function buildHotelRecommendationCard(item = {}, candidate = {}, taskState = {}) {
  const cover = normalizeText(item.cover || item.image || item.poster) || DEFAULT_ACTIVITY_COVER
  const gallery = Array.isArray(item.images) && item.images.length
    ? item.images.filter(Boolean).slice(0, 2)
    : [cover]

  return {
    id: normalizeText(item._id || item.id || candidate.id),
    sourceId: normalizeText(item._id || item.id || candidate.id),
    type: "hotel",
    title: normalizeText(item.name || item.title || candidate.title) || "民宿推荐",
    summary: normalizeText(candidate.summary || item.summary || item.description || item.detail) || "暂时还没有更详细的介绍。",
    gallery,
    tags: uniqueList(normalizeArray(item.tags)).slice(0, 4),
    playItems: buildGuideFocusItems(taskState, candidate, item, "hotel"),
    practicalInfo: buildGuidePracticalInfo(taskState, candidate, item, "hotel"),
    cover
  }
}

function readCollectedText(collected = {}, keys = []) {
  for (const key of keys) {
    const value = normalizeText(collected && collected[key])
    if (value) return value
  }
  return ""
}

function extractTaskDestination(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["destination"])
  if (existing) return existing

  const normalized = normalizeText(text)
  const patterns = [
    /去([\u4e00-\u9fa5A-Za-z0-9]{2,12})/u,
    /到([\u4e00-\u9fa5A-Za-z0-9]{2,12})/u,
    /在([\u4e00-\u9fa5A-Za-z0-9]{2,12})(?:玩|逛|旅游|旅行)/u
  ]

  for (const pattern of patterns) {
    const matched = normalized.match(pattern)
    if (matched && matched[1]) return matched[1]
  }

  if (/^[\u4e00-\u9fa5A-Za-z0-9]{2,12}$/u.test(normalized)) {
    return normalized
  }

  return ""
}

function extractTaskTime(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["time"])
  if (existing) return existing

  const matched = normalizeText(text).match(
    /(今天|明天|后天|周末|五一|十一|端午|中秋|春节|暑假|寒假|下周|这周|周[一二三四五六日天]|\d{1,2}月\d{1,2}日|\d{1,2}号)/u
  )
  return matched && matched[1] ? matched[1] : ""
}

function extractBuddyCompanionPreference(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["companionPreference"])
  if (existing) return existing

  const normalized = normalizeText(text)
  const directPatterns = [
    /(女生搭子|男生搭子|情侣搭子|亲子搭子|摄影搭子|饭搭子|自由行搭子)/u,
    /(同龄人|大学生|本地人|会开车|能拼车|随和一点|话少一点|会拍照|会摄影)/u
  ]

  for (const pattern of directPatterns) {
    const matched = normalized.match(pattern)
    if (matched && matched[1]) return matched[1]
  }

  const normalizedGender =
    /(女生|小姐姐)/u.test(normalized) ? "女生" : /(男生|小哥哥)/u.test(normalized) ? "男生" : ""
  const normalizedTrait =
    /(会摄影|会拍照|摄影)/u.test(normalized)
      ? "会摄影"
      : /(会开车|能开车)/u.test(normalized)
        ? "会开车"
        : /能拼车/u.test(normalized)
          ? "能拼车"
          : /同龄人/u.test(normalized)
            ? "同龄人"
            : /大学生/u.test(normalized)
              ? "大学生"
              : /本地人/u.test(normalized)
                ? "本地人"
                : /随和/u.test(normalized)
                  ? "随和一点"
                  : /话少/u.test(normalized)
                    ? "话少一点"
                    : ""

  if (normalizedTrait && normalizedGender) {
    return `${normalizedTrait}的${normalizedGender}`
  }

  if (normalizedTrait) return normalizedTrait
  if (normalizedGender) return normalizedGender

  return ""
}

function extractGuidePeopleCount(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["peopleCount"])
  if (existing) return existing

  const normalized = normalizeText(text)
  const matched = normalized.match(/([一二三四五六七八九十两\d]+(?:人|位))/u)
  if (matched && matched[1]) return matched[1]

  if (/^我和/u.test(normalized)) {
    return "2人"
  }

  return ""
}

function extractGuideRelationship(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["relationship"])
  if (existing) return existing

  const normalized = normalizeText(text)
  const matched = normalized.match(/(情侣|夫妻|亲子|朋友|闺蜜|同学|同事|家人|一个人|独自|男朋友|女朋友|对象|恋人|爱人)/u)
  if (matched && matched[1]) {
    return /(男朋友|女朋友|对象|恋人|爱人)/u.test(matched[1]) ? "情侣" : matched[1]
  }

  if (/(男朋友|女朋友|对象|恋人|爱人)/u.test(normalized)) {
    return "情侣"
  }

  return ""
}

function extractGuideBudget(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["budget"])
  if (existing) return existing

  const matched = normalizeText(text).match(/(\d{2,5}\s*(?:元|块|w|万))/u)
  return matched && matched[1] ? matched[1] : ""
}

function buildBuddyCollectedFields(text = "", prevCollected = {}, location = {}) {
  return {
    departure:
      readCollectedText(prevCollected, ["departure"]) ||
      normalizeText(location && (location.city || location.displayName)) ||
      "",
    destination: extractTaskDestination(text, prevCollected),
    time: extractTaskTime(text, prevCollected),
    companionPreference: extractBuddyCompanionPreference(text, prevCollected)
  }
}

function buildGuideCollectedFields(text = "", prevCollected = {}) {
  return {
    time: extractTaskTime(text, prevCollected),
    peopleCount: extractGuidePeopleCount(text, prevCollected),
    relationship: extractGuideRelationship(text, prevCollected),
    budget: extractGuideBudget(text, prevCollected),
    destination: extractTaskDestination(text, prevCollected)
  }
}

function pickMissingField(mainline = "", collected = {}) {
  const fieldOrderMap = {
    buddy_matching: ["destination", "time", "departure", "companionPreference"],
    guide_customization: ["destination", "time", "peopleCount", "relationship", "budget"]
  }

  const order = fieldOrderMap[mainline] || []
  return order.find((field) => !normalizeText(collected && collected[field])) || ""
}

function classifyFeedbackType(text = "") {
  const source = normalizeText(text)
  if (!source) return ""
  if (/(建议|希望|能不能|可不可以|改进)/u.test(source)) return "platform_suggestion"
  if (/(难用|卡|bug|闪退|进不去|加载慢|失败)/u.test(source)) return "product_feedback"
  if (/(烦|难受|委屈|伤心|emo|崩溃|累)/u.test(source)) return "emotion_support"
  return "experience_complaint"
}

function inferMainlineFromText(text = "") {
  const source = normalizeText(text)
  if (!source) return ""
  if (/(天气|气温|温度|下雨|降雨|冷不冷|热不热|我在哪|我现在在哪|当前位置|定位|我的位置)/u.test(source)) {
    return "weather_location"
  }
  if (/(搭子|同行|一起去|有没有人一起|找人一起|找个伴)/u.test(source)) {
    return "buddy_matching"
  }
  if (/(攻略|行程|路线|怎么玩|安排|旅游|旅行|去.+玩)/u.test(source)) {
    return "guide_customization"
  }
  if (/(建议|反馈|意见|吐槽|抱怨|难受|委屈|伤心|emo|崩溃|压力|不高兴|烦|心情)/u.test(source)) {
    return "xiaohe_feedback"
  }
  return ""
}

function buildSkillOpeningQuestion(skillMode = "") {
  if (skillMode === "guide_customization") {
    return "用户刚进入了“攻略定制”技能。请你先热情问候，再用自然聊天的语气引导用户逐步补充这次行程信息。不要一上来就给推荐，也不要像表单一样连续盘问。你要优先帮助用户收集这次攻略所需的关键信息，并且第一轮只问当前最必要的一个问题。"
  }

  if (skillMode === "buddy_matching") {
    return "用户刚进入了“找搭子”技能。请你先以“小禾”的身份主动发出一条自然的开场引导，不要直接给推荐结果，也不要照搬固定模板。核心目标是先引导用户说清这次想去哪、什么时候出发、希望和什么样的人同行。第一轮只问当前最必要的一个问题。"
  }

  if (skillMode === "xiaohe_feedback") {
    return "用户刚进入了“小禾树洞”技能。请你以小禾的口吻主动开始对话，先邀请用户说出最想反馈的内容，再根据对方表达自然追问必要细节。语气要真诚，不要像在填表。"
  }

  return ""
}

function toAgentHistory(messages = []) {
  return (messages || [])
    .map((item) => {
      const content = normalizeText(item && item.text)
      if (!content) return null
      return {
        role: item.role === "user" ? "user" : "assistant",
        content
      }
    })
    .filter(Boolean)
    .slice(-12)
}

function detectRecommendationType(question = "") {
  const text = normalizeText(question)
  if (!text) return ""

  if (/(特产|美食|礼盒|伴手礼|带走|乡味|手作)/u.test(text)) return "product"
  if (/(景点|景区|风景|打卡|拍照|观光|花海|草原|古村|漫游|牧场)/u.test(text)) return "scenic"
  if (/(活动|农旅|采摘|研学|亲子|周末|农场|体验)/u.test(text)) return "activity"

  return ""
}

function buildIntentTokensByType(question = "", type = "") {
  const source = normalizeText(question)
  const keywordMap = {
    activity: ["亲子", "农旅", "采摘", "研学", "周末", "农场", "手作", "萌宠", "草莓"],
    scenic: ["景点", "打卡", "拍照", "古村", "花海", "草原", "漫游", "观光", "田园"],
    product: ["特产", "伴手礼", "礼盒", "美食", "乡味", "手作", "健康", "杂粮", "鲜果"]
  }

  return uniqueList((keywordMap[type] || []).filter((keyword) => source.includes(keyword)))
}

function buildLocationTokens(location = {}) {
  return uniqueList([
    trimRegionSuffix(location.province),
    trimRegionSuffix(location.city),
    trimRegionSuffix(location.district),
    trimRegionSuffix(location.displayName),
    trimRegionSuffix(location.locationText)
  ].filter(Boolean))
}

function joinActivitySearchText(item = {}) {
  return normalizeTextLower([
    item.title,
    item.summary,
    item.content,
    item.detail,
    item.locationName,
    item.province,
    item.city,
    item.district,
    item.transport,
    item.stay
  ]
    .concat(normalizeArray(item.tags))
    .concat(normalizeArray(item.travelModeTags))
    .concat(normalizeArray(item.playTags))
    .concat(normalizeArray(item.suitableGroups))
    .concat(normalizeArray(item.highlights))
    .concat(normalizeArray(item.itinerary))
    .join(" "))
}

function joinScenicSearchText(item = {}) {
  return normalizeTextLower([
    item.title,
    item.locationName,
    item.summary,
    item.content,
    item.detail,
    item.province,
    item.city,
    item.district,
    item.tips,
    item.openTime
  ]
    .concat(normalizeArray(item.tags))
    .concat(normalizeArray(item.playTags))
    .concat(normalizeArray(item.suitableGroups))
    .concat(normalizeArray(item.highlights))
    .join(" "))
}

function joinProductSearchText(item = {}) {
  return normalizeTextLower([
    item.title,
    item.locationName,
    item.summary,
    item.content,
    item.detail,
    item.province,
    item.city,
    item.district
  ]
    .concat(normalizeArray(item.tags))
    .concat(normalizeArray(item.categoryTags))
    .concat(normalizeArray(item.highlights))
    .concat(normalizeArray(item.suitableGroups))
    .join(" "))
}

function scoreByQuestion(text, question = "", location = {}, type = "") {
  const intentTokens = buildIntentTokensByType(question, type)
  const locationTokens = buildLocationTokens(location)
  let score = 0

  intentTokens.forEach((token) => {
    if (text.includes(normalizeTextLower(token))) {
      score += 12
    }
  })

  locationTokens.forEach((token, index) => {
    if (token && text.includes(normalizeTextLower(token))) {
      score += 16 - Math.min(index * 2, 8)
    }
  })

  if (/(附近|周边)/u.test(normalizeText(question)) && !locationTokens.length) {
    score -= 4
  }

  return score
}

function getActivityPlayItems(item = {}) {
  return uniqueList(
    normalizeArray(item.highlights)
      .concat(normalizeArray(item.itinerary))
      .concat(normalizeArray(item.playTags))
      .concat(normalizeArray(item.suitableGroups))
  ).slice(0, 4)
}

function getActivityPracticalInfo(item = {}) {
  const addressText = normalizeText(
    item.locationName || [item.province, item.city, item.district].filter(Boolean).join(" · ")
  ) || "待补充"
  const phoneText = normalizeText(item.merchantPhone || item.contactPhone || item.phone || item.tel) || "待咨询"

  return [
    { label: "地址", value: addressText },
    { label: "电话", value: phoneText }
  ]
}

function getScenicPlayItems(item = {}) {
  return uniqueList(
    normalizeArray(item.highlights)
      .concat(normalizeArray(item.playTags))
      .concat(normalizeArray(item.suitableGroups))
  ).slice(0, 4)
}

function getScenicPracticalInfo(item = {}) {
  const addressText = normalizeText(
    item.locationName || [item.province, item.city, item.district].filter(Boolean).join(" · ")
  ) || "待补充"
  const openTimeText = normalizeText(item.openTime) || "以现场公示为准"

  return [
    { label: "地址", value: addressText },
    { label: "开放时间", value: openTimeText }
  ]
}

function getProductPlayItems(item = {}) {
  return uniqueList(
    normalizeArray(item.highlights)
      .concat(normalizeArray(item.categoryTags))
      .concat(normalizeArray(item.tags))
      .concat(normalizeArray(item.suitableGroups))
  ).slice(0, 4)
}

function getProductPracticalInfo(item = {}) {
  const originText = normalizeText(
    item.locationName || [item.province, item.city, item.district].filter(Boolean).join(" · ")
  ) || "待补充"
  const priceText = item.price
    ? `¥${item.price}`
    : (item.priceFrom ? `¥${item.priceFrom}起` : "价格待定")

  return [
    { label: "产地", value: originText },
    { label: "参考价格", value: priceText }
  ]
}

function buildBuddyPromptSummary(question = "", userInfo = {}) {
  const dnaTags = normalizeArray(userInfo.dnaTags).slice(0, 3)
  const profileText = dnaTags.length ? `，也会参考你的偏好标签“${dnaTags.join("、")}”` : ""
  const questionText = normalizeText(question) || "你当前的同行需求"
  return `小禾根据“${questionText}”${profileText}，先帮你筛到这几位更值得进一步联系的搭子候选。`
}

Page({
  data: {
    statusBarHeight: 20,
    text: {
      brand: "问小禾",
      fallbackQuestion: "附近有哪些适合周末放松的去处？",
      inputPlaceholder: "发消息，告诉小禾你想了解什么"
    },
    source: "search_input",
    skillMode: "",
    question: "",
    conversationId: "",
    showSkillIntro: false,
    showSkillBadge: false,
    skillBadgeName: "",
    inputPlaceholder: "发消息，告诉小禾你想了解什么",
    introText: "",
    quickOptions: [],
    messages: [],
    inputValue: "",
    isAiLoading: false,
    currentTaskState: createEmptyTaskState(""),
    genericPreferences: {
      distance: "",
      budget: "",
      detailLevel: ""
    }
  },

  onLoad(options) {
    this.initNavMetrics()

    const source = options && options.source ? options.source : "search_input"
    const skillMode = normalizeSkillMode(options && options.skillMode ? options.skillMode : "")
    const skillConfig = SKILL_CONFIG[skillMode] || null
    const shouldShowSkillIntro = source === "skill_entry" && !!skillConfig && skillMode !== "buddy_matching"
    const question = options && options.q ? decodeURIComponent(options.q) : ""
    const conversationId = options && options.conversationId ? decodeURIComponent(options.conversationId) : ""

    if (conversationId) {
      this.restoreConversation(conversationId, source, skillMode, skillConfig)
      return
    }

    const initialQuestion = source === "skill_entry"
      ? (skillConfig ? skillConfig.badgeName : this.data.text.brand)
      : (question || this.data.text.fallbackQuestion)
    const messages = this.buildMessages({ source, question: initialQuestion })
    const nextConversationId = createConversationId()

    this.setData({
      source,
      skillMode,
      question: initialQuestion,
      conversationId: nextConversationId,
      showSkillIntro: shouldShowSkillIntro,
      showSkillBadge: source === "skill_entry" && !!skillConfig,
      skillBadgeName: skillConfig ? skillConfig.badgeName : "",
      inputPlaceholder: skillConfig ? skillConfig.placeholder : this.data.text.inputPlaceholder,
      introText: shouldShowSkillIntro && skillConfig ? skillConfig.intro : "",
      quickOptions: [],
      messages,
      currentTaskState: createInitialTaskState(skillMode),
      genericPreferences: {
        distance: "",
        budget: "",
        detailLevel: ""
      }
    })

    this.persistConversation(nextConversationId, messages, initialQuestion)

    if (source === "skill_entry") {
      const openingQuestion = buildSkillOpeningQuestion(skillMode)
      this.requestGenericAnswer(openingQuestion, {
        contextPayload: {
          mode: "skill",
          skillContext: buildSkillContext(skillMode) || {}
        }
      })
      return
    }

    this.requestGenericAnswer(initialQuestion)
  },

  onUnload() {
    this.stopLoadingAnimation()
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 20 })
    } catch (error) {
      this.setData({ statusBarHeight: 20 })
    }
  },

  restoreConversation(conversationId, source, skillMode, skillConfig) {
    const conversation = getConversationById(conversationId)
    if (!conversation) {
      wx.showToast({
        title: "未找到这段历史对话",
        icon: "none"
      })
      wx.navigateBack()
      return
    }

    this.setData({
      source,
      skillMode,
      question: normalizeText(conversation.firstQuestion),
      conversationId,
      showSkillIntro: false,
      showSkillBadge: false,
      skillBadgeName: skillConfig ? skillConfig.badgeName : "",
      inputPlaceholder: skillConfig ? skillConfig.placeholder : this.data.text.inputPlaceholder,
      introText: "",
      quickOptions: [],
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
      currentTaskState: conversation.currentTaskState || createInitialTaskState(skillMode),
      genericPreferences: {
        ...(conversation.genericPreferences || {
          distance: "",
          budget: "",
          detailLevel: ""
        })
      }
    })
  },

  buildMessages({ source, question }) {
    if (source === "skill_entry") {
      return []
    }
    return [createMessage("user", question)]
  },

  persistConversation(conversationId, messages, firstQuestion) {
    if (!conversationId) return

    saveConversation({
      id: conversationId,
      title: buildConversationTitle(firstQuestion),
      firstQuestion,
      createdAt: getConversationById(conversationId)?.createdAt || Date.now(),
      updatedAt: Date.now(),
      messages,
      source: this.data.source,
      skillMode: this.data.skillMode,
      genericPreferences: this.data.genericPreferences,
      currentTaskState: this.data.currentTaskState
    })
  },

  syncCurrentConversation() {
    const { conversationId, messages } = this.data
    if (!conversationId || !messages.length) return

    const firstUserMessage = messages.find((item) => item.role === "user")
    const firstQuestion = normalizeText(firstUserMessage && firstUserMessage.text) || normalizeText(this.data.question)
    if (!firstQuestion) return

    this.persistConversation(conversationId, messages, firstQuestion)
  },

  getCurrentSkillContext(extraSkillContext = null) {
    const baseSkillContext = buildSkillContext(this.data.skillMode) || {}
    const currentTaskState = this.data.currentTaskState || createEmptyTaskState("")
    const mergedSkillContext = {
      ...baseSkillContext,
      ...(extraSkillContext || {})
    }

    return {
      ...mergedSkillContext,
      collected: {
        ...(mergedSkillContext.collected || {}),
        ...(currentTaskState.collected || {})
      }
    }
  },

  buildNextTaskState(question, location = null) {
    const currentTaskState = this.data.currentTaskState || createEmptyTaskState("")
    const inferredMainline = inferMainlineFromText(question)
    const skillMainline =
      MAINLINE_BY_SKILL_MODE[this.data.skillMode] ||
      currentTaskState.mainline ||
      inferredMainline ||
      ""
    const nextState = {
      ...createEmptyTaskState(skillMainline),
      ...currentTaskState,
      mainline: skillMainline || currentTaskState.mainline || ""
    }

    const text = normalizeText(question)
    if (!text) {
      return nextState
    }

    if (nextState.mainline === "buddy_matching") {
      const collected = buildBuddyCollectedFields(text, nextState.collected, location)
      return {
        ...nextState,
        collected,
        missingField: pickMissingField("buddy_matching", collected),
        lastAskedField: currentTaskState.missingField || currentTaskState.lastAskedField || ""
      }
    }

    if (nextState.mainline === "guide_customization") {
      const collected = buildGuideCollectedFields(text, nextState.collected)
      return {
        ...nextState,
        collected,
        missingField: pickMissingField("guide_customization", collected),
        lastAskedField: currentTaskState.missingField || currentTaskState.lastAskedField || ""
      }
    }

    if (nextState.mainline === "xiaohe_feedback") {
      return {
        ...nextState,
        feedbackType: classifyFeedbackType(text)
      }
    }

    return nextState
  },

  updateCurrentTaskState(question, location = null) {
    const nextTaskState = this.buildNextTaskState(question, location)
    this.setData({ currentTaskState: nextTaskState })
    return nextTaskState
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.navigateTo({ url: "/pages/search/search?mode=ask" })
  },

  onInputChange(e) {
    this.setData({ inputValue: e.detail.value || "" })
  },

  submitInput() {
    const value = normalizeText(this.data.inputValue)
    if (!value) return
    this.handleUserReply(value)
  },

  useQuickOption(e) {
    const question = normalizeText(e.currentTarget.dataset.question)
    if (!question) return
    this.handleUserReply(question)
  },

  handleUserReply(value) {
    const nextMessages = this.data.messages.concat(createMessage("user", value))
    this.setData({
      messages: nextMessages,
      inputValue: ""
    })
    this.syncCurrentConversation()

    if (this.data.source === "skill_entry") {
      this.requestGenericAnswer(value, {
        contextPayload: {
          mode: "skill",
          skillContext: buildSkillContext(this.data.skillMode) || {}
        }
      })
      return
    }

    this.replyGeneric(value)
  },

  async replyGeneric(value) {
    if (!value) return
    const normalizedValue = normalizeText(value)

    if (normalizedValue.includes("更近") || normalizedValue.includes("近一点")) {
      this.setData({
        genericPreferences: {
          ...this.data.genericPreferences,
          distance: "near"
        }
      })
      this.appendAiMessage("记下了。接下来小禾会优先帮你关注更近一些、出行更轻松的选择。")
      return
    }

    if (normalizedValue.includes("便宜") || normalizedValue.includes("性价比") || normalizedValue.includes("省钱")) {
      this.setData({
        genericPreferences: {
          ...this.data.genericPreferences,
          budget: "value"
        }
      })
      this.appendAiMessage("收到。接下来小禾会更偏向高性价比、预算更友好的推荐。")
      return
    }

    if (/^(详细一点|更详细一点|具体一点|说具体点|展开讲讲|讲详细点|再详细点)$/u.test(normalizedValue)) {
      this.setData({
        genericPreferences: {
          ...this.data.genericPreferences,
          detailLevel: "detailed"
        }
      })
      this.appendAiMessage("可以。接下来小禾会把建议说得更具体一些，方便你直接判断。")
      return
    }

    await this.requestGenericAnswer(value)
  },

  appendAiMessage(text, extra = {}) {
    const nextMessages = this.data.messages.concat(createMessage("ai", text, extra))
    this.setData({ messages: nextMessages })
    this.syncCurrentConversation()
  },

  appendAiPlaceholder() {
    const message = createMessage("ai", "", {
      recommendations: [],
      tips: "",
      guessQuestions: [],
      followUp: ""
    })

    const nextMessages = this.data.messages.concat(message)
    this.setData({ messages: nextMessages })
    this.syncCurrentConversation()
    return message.id
  },

  updateMessageById(id, updates = {}) {
    const messages = (this.data.messages || []).map((message) => {
      if (message.id !== id) return message
      return { ...message, ...updates }
    })

    this.setData({ messages })
    this.syncCurrentConversation()
  },

  startLoadingAnimation(messageId) {
    this.stopLoadingAnimation()
    const frames = ["", ".", "..", "..."]
    let frameIndex = 0

    this.updateMessageById(messageId, {
      text: LOADING_BASE_TEXT
    })

    this.loadingMessageTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length
      this.updateMessageById(messageId, {
        text: `${LOADING_BASE_TEXT}${frames[frameIndex]}`
      })
    }, 450)
  },

  stopLoadingAnimation() {
    if (this.loadingMessageTimer) {
      clearInterval(this.loadingMessageTimer)
      this.loadingMessageTimer = null
    }
  },

  async requestGenericAnswer(question, options = {}) {
    if (!question || this.data.isAiLoading) return

    if (!yuxiaoheBotId) {
      this.appendAiMessage("当前还没有完成问小禾的智能体配置，暂时还不能发起对话。")
      return
    }

    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI || !wx.cloud.extend.AI.bot) {
      this.appendAiMessage("当前微信基础库暂不支持问小禾对话，请确认小程序基础库版本为 3.7.1 或以上。")
      return
    }

    this.setData({ isAiLoading: true })
    const aiMessageId = this.appendAiPlaceholder()
    const recommendationType = detectRecommendationType(question)
    const latestLocation = await this.ensureFreshLocationContext()
    const currentTaskState = this.data.currentTaskState || createInitialTaskState(this.data.skillMode)
    const contextPayload = {
      ...(options.contextPayload || {}),
      location: latestLocation,
      currentTaskState,
      skillContext: {
        ...this.getCurrentSkillContext(options.contextPayload && options.contextPayload.skillContext),
        collected: {
          ...(currentTaskState.collected || {})
        }
      }
    }
    const shouldRenderStructuredAnswer = !!recommendationType && !currentTaskState.mainline
    this.startLoadingAnimation(aiMessageId)

    try {
      const groundedUiPromise = shouldRenderStructuredAnswer
        ? this.buildGroundedRecommendationUi(question, contextPayload)
        : Promise.resolve({ introText: "", recommendations: [], tips: "" })
      const conversationStatePromise = this.fetchConversationState(question, contextPayload).catch((error) => {
        console.warn("[askXiaoheChat] fetch conversation state failed", error)
        return null
      })
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId: yuxiaoheBotId,
          msg: question,
          history: toAgentHistory(this.data.messages),
          contextPayload: this.buildGenericPayload(question, contextPayload)
        }
      })
      try {
        console.log("[askXiaoheChat] sendMessage response keys", Object.keys(res || {}))
        console.log("[askXiaoheChat] sendMessage response", res)
      } catch (logError) {
        console.warn("[askXiaoheChat] inspect sendMessage response failed", logError)
      }

      let answer = ""
      for await (const chunk of res.textStream) {
        answer += chunk
        this.stopLoadingAnimation()
        this.updateMessageById(aiMessageId, {
          text: answer
        })
      }

      const conversationState = await conversationStatePromise
      try {
        console.log("[askXiaoheChat] conversation state", conversationState)
      } catch (logError) {
        console.warn("[askXiaoheChat] inspect conversation state failed", logError)
      }
      if (conversationState) {
        const nextTaskState = buildTaskStateFromBackend(conversationState, currentTaskState)
        this.setData({ currentTaskState: nextTaskState })
      }

      const taskStateFromBackend = buildTaskStateFromBackend(conversationState, currentTaskState)
      const recommendations =
        conversationState && conversationState.mainline === "buddy_matching"
          ? this.buildBuddyRecommendations(conversationState && conversationState.candidates, taskStateFromBackend)
          : await this.buildGuideRecommendations(
              conversationState && conversationState.candidates,
              taskStateFromBackend
            )
      try {
        console.log("[askXiaoheChat] structured recommendation summary", {
          mainline: conversationState && conversationState.mainline,
          candidateCount: Array.isArray(conversationState && conversationState.candidates)
            ? conversationState.candidates.length
            : 0,
          recommendationCount: Array.isArray(recommendations) ? recommendations.length : 0,
          firstRecommendation: Array.isArray(recommendations) && recommendations.length
            ? recommendations[0]
            : null
        })
      } catch (logError) {
        console.warn("[askXiaoheChat] inspect structured recommendations failed", logError)
      }
      if (
        conversationState &&
        conversationState.mainline === "guide_customization" &&
        recommendations.length
      ) {
        this.updateMessageById(aiMessageId, {
          text: buildGuideCardIntro(taskStateFromBackend),
          recommendations,
          tips: buildGuideWarmTips(taskStateFromBackend, recommendations),
          guessQuestions: [],
          followUp: ""
        })
        return
      }

      if (
        conversationState &&
        conversationState.mainline === "buddy_matching" &&
        recommendations.length
      ) {
        this.updateMessageById(aiMessageId, {
          text: buildBuddyPromptSummary(question),
          recommendations,
          tips: [
            "小禾提醒你",
            "1. 先确认出发时间和集合区域，再决定要不要继续聊。",
            "2. 当前展示的是后端统一返回的真实同行候选卡片。"
          ].join("\n"),
          guessQuestions: [],
          followUp: ""
        })
        return
      }

      const groundedUi = await groundedUiPromise
      if (shouldRenderStructuredAnswer && groundedUi.recommendations && groundedUi.recommendations.length) {
        this.updateMessageById(aiMessageId, {
          text: groundedUi.introText || "",
          recommendations: groundedUi.recommendations || [],
          tips: groundedUi.tips || "",
          guessQuestions: [],
          followUp: ""
        })
        return
      }

      this.updateMessageById(aiMessageId, {
        text: normalizeText(answer) || "这次小禾没有整理出有效内容，你可以换个问法再试试。",
        recommendations: [],
        tips: "",
        guessQuestions: [],
        followUp: ""
      })
    } catch (error) {
      console.error("[askXiaoheChat] generic failed", error)
      this.updateMessageById(aiMessageId, {
        text: "小禾这会儿有点忙，你可以换个问法试试，或者稍后再来找我。",
        recommendations: [],
        tips: "",
        guessQuestions: [],
        followUp: ""
      })
    } finally {
      this.stopLoadingAnimation()
      this.setData({ isAiLoading: false })
      this.syncCurrentConversation()
    }
  },

  async ensureFreshLocationContext() {
    const app = getApp()
    let userInfo = {}

    try {
      userInfo = (app && typeof app.getUserInfo === "function" && app.getUserInfo()) || {}
    } catch (error) {
      userInfo = {}
    }

    const selectedRegion = readSelectedRegion()
    let nextUserLocation = null

    try {
      nextUserLocation = wx.getStorageSync("userLocation") || userInfo.userLocation || null
    } catch (error) {
      nextUserLocation = userInfo.userLocation || null
    }

    try {
      const setting = await getSettingAsync()
      if (setting && setting.authSetting && setting.authSetting["scope.userLocation"]) {
        const locationRes = await getLocationAsync()
        nextUserLocation = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
        wx.setStorageSync("userLocation", nextUserLocation)

        if (userInfo && userInfo.openid && app && typeof app.setUserInfo === "function") {
          app.setUserInfo({
            ...userInfo,
            userLocation: nextUserLocation,
            locationAuthorized: true
          })
          userInfo = (typeof app.getUserInfo === "function" && app.getUserInfo()) || userInfo
        }
      }
    } catch (error) {
      console.warn("[askXiaoheChat] refresh location before request failed", error)
    }

    return buildLocationContext(userInfo, nextUserLocation, selectedRegion)
  },

  buildGenericPayload(question, extraPayload = {}) {
    const app = getApp()
    let userInfo = {}
    let cachedUserLocation = null
    let selectedRegion = null

    try {
      userInfo = (app && typeof app.getUserInfo === "function" && app.getUserInfo()) || {}
    } catch (error) {
      userInfo = {}
    }

    try {
      cachedUserLocation = wx.getStorageSync("userLocation") || (userInfo && userInfo.userLocation) || null
    } catch (error) {
      cachedUserLocation = null
    }

    selectedRegion = readSelectedRegion()

    const baseLocation = buildLocationContext(userInfo, cachedUserLocation, selectedRegion)
    const mergedLocation = {
      ...baseLocation,
      ...(extraPayload.location || {})
    }
    const currentTaskState = extraPayload.currentTaskState || this.data.currentTaskState || createEmptyTaskState("")
    const skillContext = {
      ...this.getCurrentSkillContext(extraPayload.skillContext),
      collected: {
        ...(this.getCurrentSkillContext(extraPayload.skillContext).collected || {}),
        ...(currentTaskState.collected || {})
      }
    }

    return {
      mode: extraPayload.mode || "generic",
      source: this.data.source || "search_input",
      question,
      location: mergedLocation,
      userProfile: {
        nickname: userInfo.nickName || userInfo.nickname || "",
        dnaTags: userInfo.dnaTags || [],
        residentCity: userInfo.city || "",
        commonDeparture: userInfo.commonDeparture || userInfo.city || "",
        travelStyle: userInfo.travelStyle || "",
        budgetRange: userInfo.budgetRange || ""
      },
      preferences: this.data.genericPreferences || {},
      skillContext,
      currentTaskState,
      history: (this.data.messages || [])
        .map((item) => ({
          role: item.role === "ai" ? "assistant" : item.role,
          text: item.text
        }))
        .filter((item) => item.role && item.text)
        .slice(-20),
      context: {
        source: this.data.source || "search_input"
      },
      ...extraPayload
    }
  },

  async fetchActivitiesForChat() {
    try {
      const res = await wx.cloud.callFunction({ name: "getactivities" })
      return res && res.result && Array.isArray(res.result.list) ? res.result.list : []
    } catch (error) {
      console.error("[askXiaoheChat] fetch activities failed", error)
      return []
    }
  },

  async fetchScenicsForChat() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("scenics").get()
      return Array.isArray(res && res.data) ? res.data : []
    } catch (error) {
      console.error("[askXiaoheChat] fetch scenics failed", error)
      return []
    }
  },

  async fetchProductsForChat() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("products").get()
      return Array.isArray(res && res.data) ? res.data : []
    } catch (error) {
      console.error("[askXiaoheChat] fetch products failed", error)
      return []
    }
  },

  async fetchHotelsForChat() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("hotels").get()
      return Array.isArray(res && res.data) ? res.data : []
    } catch (error) {
      console.error("[askXiaoheChat] fetch hotels failed", error)
      return []
    }
  },

  async fetchConversationState(question, contextPayload = {}) {
    const app = getApp()
    const genericPayload = this.buildGenericPayload(question, contextPayload)
    const userInfo = (app && typeof app.getUserInfo === "function" && app.getUserInfo()) || {}
    const cloudbaseUserId = normalizeText(userInfo && userInfo.openid)
    const payload = {
      location: genericPayload.location || {},
      currentTaskState: genericPayload.currentTaskState || {},
      history: Array.isArray(genericPayload.history) ? genericPayload.history.slice(-20) : []
    }
    try {
      console.log("[askXiaoheChat] fetchConversationState payload", payload)
      console.log("[askXiaoheChat] fetchConversationState payload json", JSON.stringify(payload))
      console.log("[askXiaoheChat] fetchConversationState cloudbaseUserId", cloudbaseUserId)
    } catch (logError) {
      console.warn("[askXiaoheChat] inspect fetchConversationState payload failed", logError)
    }
    const result = await requestAgentHttp({
      path: "/api/conversation-state",
      method: "POST",
      data: {
        question,
        contextPayload: payload,
        cloudbaseUserId
      }
    })

    return result && result.data ? result.data : result
  },

  async buildGroundedRecommendationUi(question, extraPayload = {}) {
    const recommendationType = detectRecommendationType(question)
    if (!recommendationType) {
      return {
        introText: "",
        recommendations: [],
        tips: ""
      }
    }

    if (recommendationType === "activity") {
      return this.buildGroundedActivityUi(question, extraPayload)
    }

    if (recommendationType === "scenic") {
      return this.buildGroundedScenicUi(question, extraPayload)
    }

    return this.buildGroundedProductUi(question, extraPayload)
  },

  async buildGuideRecommendations(candidates = [], taskState = {}) {
    const normalizedCandidates = Array.isArray(candidates) ? candidates : []
    if (!normalizedCandidates.length) return []

    const [activities, scenics, products, hotels] = await Promise.all([
      this.fetchActivitiesForChat(),
      this.fetchScenicsForChat(),
      this.fetchProductsForChat(),
      this.fetchHotelsForChat()
    ])

    const activityMap = new Map((activities || []).map((item) => [normalizeText(item && (item._id || item.id)), item]))
    const scenicMap = new Map((scenics || []).map((item) => [normalizeText(item && (item._id || item.id)), item]))
    const productMap = new Map((products || []).map((item) => [normalizeText(item && (item._id || item.id)), item]))
    const hotelMap = new Map((hotels || []).map((item) => [normalizeText(item && (item._id || item.id)), item]))

    const recommendations = await Promise.all(
      normalizedCandidates.map(async (candidate) => {
        const type = normalizeText(candidate && candidate.type)
        const sourceId = normalizeText(candidate && candidate.id)
        const fallback = buildGuideFallbackRecommendation(candidate)
        if (!type || !sourceId) return fallback

        if (type === "activity") {
          const matched = activityMap.get(sourceId)
          return matched ? buildActivityRecommendationCard(matched, candidate, taskState) : fallback
        }

        if (type === "scenic") {
          const matched = scenicMap.get(sourceId)
          return matched ? buildScenicRecommendationCard(matched, candidate, taskState) : fallback
        }

        if (type === "product") {
          const matched = productMap.get(sourceId)
          return matched ? buildProductRecommendationCard(matched, candidate, taskState) : fallback
        }

        if (type === "hotel") {
          const matched = hotelMap.get(sourceId)
          return matched ? buildHotelRecommendationCard(matched, candidate, taskState) : fallback
        }

        return fallback
      })
    )

    return recommendations.filter(Boolean)
  },

  buildBuddyRecommendations(candidates = [], taskState = {}) {
    const normalizedCandidates = Array.isArray(candidates) ? candidates : []
    if (!normalizedCandidates.length) return []

  return normalizedCandidates
      .map((candidate, index) => {
        const title = normalizeText(candidate && (candidate.nickname || candidate.title)) || `搭子候选 ${index + 1}`
        const tags = filterBuddyTags(candidate && candidate.tags)
        const region = normalizeText(candidate && candidate.region)
        const summary = normalizeBuddySummaryText(candidate && candidate.summary, region)
        const matchReason = normalizeText(candidate && candidate.matchReason) || "资料和偏好方向比较接近，适合先进一步聊聊。"
        const practicalInfo = buildBuddyPracticalInfoFromCandidate(candidate)
        const playItems = buildBuddyHighlightsFromCandidate({ ...candidate, tags })

        return normalizeBuddyRecommendation({
          id: normalizeText(candidate && candidate.id) || `buddy-${index}`,
          type: "buddy",
          title,
          statusTag: "",
          summary,
          matchReason,
          reasonTitle: "匹配理由",
          tags,
          playItems,
          practicalInfo,
          avatarUrl: "",
          avatarText: buildBuddyAvatarText(title),
          avatarColor: buildBuddyAvatarColor(title),
          actionText: "发起搭子申请",
          openingText: buildBuddyOpeningText({
            ...candidate,
            title,
            region,
            matchReason,
          }),
          planSummary: "",
          matchScore: "",
          matchScoreText: "",
          taskState,
        })
      })
      .filter(Boolean)
  },

  async buildGroundedActivityUi(question, extraPayload = {}) {
    const payload = this.buildGenericPayload(question, extraPayload)
    const location = payload.location || {}
    const list = await this.fetchActivitiesForChat()
    const rankedList = list
      .map((item) => ({ item, score: scoreByQuestion(joinActivitySearchText(item), question, location, "activity") }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const recommendations = await Promise.all(
      rankedList.map(async ({ item }) => {
        const coverTagInfo = buildActivityCoverTags(item)
        const playItems = getActivityPlayItems(item)
        const gallery = await resolveActivityGallery(item)

        return {
          id: normalizeText(item._id || item.id),
          sourceId: normalizeText(item._id || item.id),
          type: "activity",
          title: normalizeText(item.title) || "农旅活动",
          summary: normalizeText(item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
          gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
          tags: coverTagInfo.combinedTags.slice(0, 4),
          playItems: playItems.length ? playItems : ["活动亮点待补充"],
          practicalInfo: getActivityPracticalInfo(item),
          cover: await resolveActivityCover(item)
        }
      })
    )

    return {
      introText: recommendations.length ? "小禾结合你当前的位置和平台内容，为你整理了这些更值得关注的农旅活动：" : "",
      recommendations,
      tips: recommendations.length
        ? [
            "小禾提醒你",
            "1. 出行前建议先确认最新开放情况和可体验项目。",
            "2. 参与亲子或户外活动时，记得提前做好防晒、防蚊和补水准备。"
          ].join("\n")
        : ""
    }
  },

  async buildGroundedScenicUi(question, extraPayload = {}) {
    const payload = this.buildGenericPayload(question, extraPayload)
    const location = payload.location || {}
    const list = await this.fetchScenicsForChat()
    const rankedList = list
      .map((item) => ({ item, score: scoreByQuestion(joinScenicSearchText(item), question, location, "scenic") }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const recommendations = rankedList.map(({ item }) => {
      const cover = normalizeText(item.cover) || DEFAULT_ACTIVITY_COVER
      const gallery = Array.isArray(item.gallery) && item.gallery.length
        ? item.gallery.filter(Boolean).slice(0, 2)
        : [cover]
      const playItems = getScenicPlayItems(item)

      return {
        id: normalizeText(item._id || item.id),
        sourceId: normalizeText(item._id || item.id),
        type: "scenic",
        title: normalizeText(item.locationName || item.title) || "乡村景点",
        summary: normalizeText(item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
        gallery,
        tags: uniqueList(normalizeArray(item.playTags).concat(normalizeArray(item.tags))).slice(0, 4),
        playItems: playItems.length ? playItems : ["游玩亮点待补充"],
        practicalInfo: getScenicPracticalInfo(item),
        cover
      }
    })

    return {
      introText: recommendations.length ? "小禾结合你当前的位置和平台内容，为你整理了这些值得去看看的乡村景点：" : "",
      recommendations,
      tips: recommendations.length
        ? [
            "小禾提醒你",
            "1. 出行前建议先确认天气、开放时间和停车条件。",
            "2. 如果这次主要是拍照打卡，尽量选择光线更稳定的时段前往。"
          ].join("\n")
        : ""
    }
  },

  async buildGroundedProductUi(question, extraPayload = {}) {
    const payload = this.buildGenericPayload(question, extraPayload)
    const location = payload.location || {}
    const list = await this.fetchProductsForChat()
    const rankedList = list
      .map((item) => ({ item, score: scoreByQuestion(joinProductSearchText(item), question, location, "product") }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const recommendations = rankedList.map(({ item }) => {
      const cover = normalizeText(item.cover) || DEFAULT_PRODUCT_COVER
      const playItems = getProductPlayItems(item)

      return {
        id: normalizeText(item._id || item.id),
        sourceId: normalizeText(item._id || item.id),
        type: "product",
        title: normalizeText(item.title) || "乡味特产",
        summary: normalizeText(item.summary || item.content || item.detail) || "暂时还没有更详细的介绍。",
        gallery: [cover],
        tags: uniqueList(normalizeArray(item.categoryTags).concat(normalizeArray(item.tags))).slice(0, 4),
        playItems: playItems.length ? playItems : ["选购亮点待补充"],
        practicalInfo: getProductPracticalInfo(item),
        cover
      }
    })

    return {
      introText: recommendations.length ? "小禾结合你当前的位置和平台内容，为你整理了这些值得带走的乡味特产：" : "",
      recommendations,
      tips: recommendations.length
        ? [
            "小禾提醒你",
            "1. 送礼或远途携带时，优先选择礼盒、干货或真空包装产品。",
            "2. 生鲜和现做类商品记得留意保质期与便携性。"
          ].join("\n")
        : ""
    }
  },

  async requestBuddyMatches(question) {
    if (!ensureBuddySession()) {
      return
    }

    const app = getApp()
    let userInfo = {}
    try {
      userInfo = (app && typeof app.getUserInfo === "function" && app.getUserInfo()) || {}
    } catch (error) {
      userInfo = {}
    }

    try {
      const result = await wx.cloud.callFunction({
        name: "userManage",
        data: {
          action: "getBuddyMatches",
          payload: {
            question: normalizeText(question) || DEFAULT_BUDDY_TAGS.join(" "),
            limit: 3
          }
        }
      })

      const recommendations = Array.isArray(result?.result?.list)
        ? result.result.list.map((item) => ({
            ...normalizeBuddyRecommendation(item),
            type: "buddy",
            title: item.userName,
          }))
        : []

      if (!recommendations.length) {
        this.appendAiMessage("小禾暂时还没有筛到合适的真实搭子候选。等更多用户完成资料和 DNA 标签后，这里会更准确。", {
          channelLabel: "找搭子"
        })
        return
      }

      this.appendAiMessage(buildBuddyPromptSummary(question, userInfo), {
        recommendations,
        tips: [
          "小禾提醒你",
          "1. 先确认出发时间和集合区域，再决定要不要继续聊。",
          "2. 目前展示的是基于真实资料算出的候选，只展示必要字段。"
        ].join("\n"),
        channelLabel: "找搭子"
      })
    } catch (error) {
      console.error("[askXiaoheChat] get buddy matches failed", error)
      this.appendAiMessage("小禾这会儿还没拿到可用的搭子候选，你可以稍后再试。", {
        channelLabel: "找搭子"
      })
    }
  },

  applyBuddyMatch(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
    const userName = normalizeText(dataset.username)
    const openingText = normalizeText(dataset.opening)
    if (!userName || !openingText) {
      wx.showToast({ title: "这位搭子的信息还没准备好", icon: "none" })
      return
    }

    const application = createBuddyApplicationFromMatch({
      userName,
      openingText,
      avatarUrl: dataset.avatarurl,
      avatarText: dataset.avatartext,
      avatarColor: dataset.avatarcolor,
      matchScore: dataset.matchscore,
      matchReason: dataset.matchreason,
      direction: "outgoing"
    })

    if (!application || !application.id) {
      wx.showToast({ title: "发起申请失败", icon: "none" })
      return
    }

    wx.showToast({ title: "已发起申请", icon: "success" })
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/messageBuddyApplyChat/messageBuddyApplyChat?id=${application.id}`
      })
    }, 220)
  },

  openCardDetail(e) {
    const { type, sourceid: sourceId } = e.currentTarget.dataset || {}
    try {
      console.log("[askXiaoheChat] openCardDetail dataset", e.currentTarget.dataset || {})
    } catch (logError) {
      console.warn("[askXiaoheChat] inspect openCardDetail dataset failed", logError)
    }
    if (type === "buddy") return
    if (!sourceId) return

    const urlMap = {
      activity: `/pages/activityDetail/activityDetail?id=${sourceId}`,
      scenic: `/pages/scenicDetail/scenicDetail?id=${sourceId}`,
      product: `/pages/productDetail/productDetail?id=${sourceId}`,
      hotel: `/pages/hotelDetail/hotelDetail?id=${sourceId}`
    }

    const targetUrl = urlMap[type]
    if (!targetUrl) return

    wx.navigateTo({ url: targetUrl })
  }
})
