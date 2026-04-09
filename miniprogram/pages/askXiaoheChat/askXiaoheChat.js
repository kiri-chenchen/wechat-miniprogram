const {
  yuxiaoheBotId,
  yuxiaoheHttpBaseUrl
} = require("../../config/agent")
const {
  resolveMediaSource,
  resolveMediaList,
  resolveActivityCover,
  resolveActivityGallery
} = require("../../utils/mediaAssets")
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
const LOADING_BASE_TEXT = "小禾正在思考中"

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

const BUDDY_AVATAR_COLORS = ["#5B8FF9", "#61DDAA", "#F6BD16", "#E8684A", "#6DC8EC", "#9270CA"]

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

function uniqueList(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)))
}

function requestAgentHttp({ path = "", method = "GET", data = null, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = normalizeText(yuxiaoheHttpBaseUrl).replace(/\/$/, "")
    const normalizedPath = normalizeText(path)
    if (!baseUrl || !normalizedPath) {
      reject(new Error("agent http config missing"))
      return
    }

    wx.request({
      url: `${baseUrl}${normalizedPath}`,
      method,
      data,
      timeout,
      header: {
        "content-type": "application/json"
      },
      success(res) {
        const statusCode = Number(res && res.statusCode)
        if (statusCode >= 200 && statusCode < 300) {
          resolve(res.data)
          return
        }

        console.warn("[askXiaoheChat] requestAgentHttp non-2xx", {
          path: normalizedPath,
          method,
          statusCode,
          data: res && res.data
        })
        reject(new Error(`request failed with status ${statusCode || 0}`))
      },
      fail(error) {
        reject(error)
      }
    })
  })
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

function hasReadableBuddyText(value = "") {
  const text = normalizeText(value)
  if (!text) return false
  return !/(系统筛选|同行候选|已完善基础资料|可进一步发起同行申请|地区待补充|未提供|未知|待补充)/u.test(text)
}

function filterBuddyStatusTag(tag = "") {
  const text = normalizeText(tag)
  return hasReadableBuddyText(text) ? text : ""
}

function filterBuddyTags(tags = []) {
  return uniqueList(normalizeArray(tags)).filter(hasReadableBuddyText)
}

function filterBuddyHighlights(items = []) {
  return normalizeArray(items).filter(hasReadableBuddyText)
}

function filterBuddyPracticalInfo(list = []) {
  return (Array.isArray(list) ? list : []).filter((item) => {
    const label = normalizeText(item && item.label)
    const value = normalizeText(item && item.value)
    return label && value && hasReadableBuddyText(value)
  })
}

function buildBuddyTextPool(item = {}) {
  return normalizeTextLower([
    item.title,
    item.nickname,
    item.summary,
    item.matchReason,
    item.region
  ]
    .concat(normalizeArray(item.tags))
    .join(" "))
}

function removeBuddyRegionSuffix(value = "") {
  return normalizeText(value).replace(/(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/u, "")
}

function isBuddyRegionClose(departure = "", region = "") {
  const left = removeBuddyRegionSuffix(departure)
  const right = removeBuddyRegionSuffix(region)
  if (!left || !right) return false
  return left.includes(right) || right.includes(left)
}

function calculateBuddyMatchScore(item = {}, taskState = {}) {
  const collected = (taskState && taskState.collected) || {}
  const tags = filterBuddyTags(item.tags)
  const region = normalizeText(item.region)
  const summary = normalizeText(item.summary)
  const companionPreference = normalizeText(collected.companionPreference)
  const destination = normalizeText(collected.destination)
  const departure = normalizeText(collected.departure)
  const textPool = buildBuddyTextPool(item)

  let score = 58
  score += Math.min(tags.length * 6, 18)
  if (hasReadableBuddyText(region)) score += 8
  if (hasReadableBuddyText(summary)) score += 8
  if (companionPreference && textPool.includes(normalizeTextLower(companionPreference))) score += 8
  if (destination && textPool.includes(normalizeTextLower(destination))) score += 8
  if (departure && isBuddyRegionClose(departure, region)) score += 8

  return Math.max(58, Math.min(98, score))
}

function buildBuddyDisplaySummary(item = {}, taskState = {}) {
  if (hasReadableBuddyText(item.summary)) {
    return normalizeText(item.summary)
  }

  const destination = normalizeText(taskState && taskState.collected && taskState.collected.destination)
  const region = normalizeText(item.region)
  if (destination && region) {
    return `对${destination}这类同行计划有一定契合度，也方便继续沟通具体安排。`
  }
  if (region) {
    return `资料里显示活动区域在${region}，适合继续聊出发时间和同行节奏。`
  }

  return "这位用户的公开资料和你的同行需求方向比较接近，可以继续确认时间和计划。"
}

function buildBuddySystemReason(item = {}, taskState = {}) {
  if (hasReadableBuddyText(item.matchReason)) {
    return normalizeText(item.matchReason)
  }

  const collected = (taskState && taskState.collected) || {}
  const companionPreference = normalizeText(collected.companionPreference)
  const destination = normalizeText(collected.destination)
  const parts = []
  if (destination) parts.push(`目的地方向和“${destination}”接近`)
  if (companionPreference) parts.push(`同行偏好贴近“${companionPreference}”`)
  if (normalizeText(item.region)) parts.push("地区信息清晰，方便继续约时间")
  return parts[0] || "公开资料和这次同行需求方向比较接近。"
}

function buildBuddyPlayItems(item = {}, summary = "") {
  const tags = filterBuddyTags(item.tags)
  if (tags.length) return tags.slice(0, 3)
  if (hasReadableBuddyText(summary)) return [summary]
  return ["可继续沟通出发时间和同行安排"]
}

function buildBuddyPracticalInfo(item = {}) {
  const list = []
  const region = normalizeText(item.region)
  if (hasReadableBuddyText(region)) {
    list.push({ label: "所在地区", value: region })
  }
  return filterBuddyPracticalInfo(list)
}

function buildBuddyOpeningText(item = {}, taskState = {}) {
  const collected = (taskState && taskState.collected) || {}
  const destination = normalizeText(collected.destination)
  const time = normalizeText(collected.time)
  const tripText = [time, destination].filter(Boolean).join(" ")
  return `你好，我也对${tripText || "这次同行"}感兴趣，方便聊聊你的计划吗？`
}

function buildBuddyAvatarText(title = "") {
  return normalizeText(title).slice(0, 1) || "搭"
}

function buildBuddyAvatarColor(seed = "") {
  const text = normalizeText(seed)
  let total = 0
  for (let index = 0; index < text.length; index += 1) {
    total += text.charCodeAt(index)
  }
  return BUDDY_AVATAR_COLORS[total % BUDDY_AVATAR_COLORS.length]
}

function normalizeBuddyRecommendation(item = {}, taskState = {}) {
  const title = normalizeText(item.title || item.nickname) || "搭子候选"
  const summary = buildBuddyDisplaySummary(item, taskState)
  const matchReason = buildBuddySystemReason(item, taskState)
  const tags = filterBuddyTags(item.tags)
  const matchScore = calculateBuddyMatchScore(item, taskState)

  return {
    ...item,
    title,
    statusTag: filterBuddyStatusTag(item.statusTag),
    summary,
    matchReason,
    reasonTitle: "匹配理由",
    tags,
    playItems: buildBuddyPlayItems(item, summary),
    practicalInfo: buildBuddyPracticalInfo(item),
    matchScore,
    matchScoreText: `${matchScore}%契合度`,
    actionText: "发送搭子申请",
    openingText: buildBuddyOpeningText(item, taskState),
    avatarText: buildBuddyAvatarText(title),
    avatarColor: buildBuddyAvatarColor(normalizeText(item.id || title))
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
    return "小禾先帮你整理了几张更适合直接参考的卡片。"
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
    tips.push(`${time}前往${destination}时，建议优先确认开放时间、天气和交通情况。`)
  } else {
    tips.push(`去${destination}前，记得再确认开放时间、天气和交通情况。`)
  }

  if (relationship) {
    tips.push(`这次同行关系是${relationship}，更适合把节奏放慢一些。`)
  } else if (budget) {
    tips.push(`预算在${budget}的话，建议优先把同一区域的点位串起来。`)
  }

  return ["温馨提示"]
    .concat(tips.slice(0, 2).map((item, index) => `${index + 1}. ${item}`))
    .join("\n")
}

function findRecordByCandidateId(list = [], candidate = {}) {
  const candidateId = normalizeText(candidate && candidate.id)
  if (!candidateId) return null

  return (Array.isArray(list) ? list : []).find((item) => {
    const itemId = normalizeText(item && (item._id || item.id))
    return itemId && itemId === candidateId
  }) || null
}

function buildRegionText(item = {}, candidate = {}) {
  return normalizeText(candidate.region)
    || normalizeText(item.locationName)
    || normalizeText(item.locationText)
    || [item.province, item.city, item.district].filter(Boolean).join(" · ")
    || "待补充"
}

function buildTravelCompanionText(taskState = {}) {
  const collected = taskState && taskState.collected ? taskState.collected : {}
  const peopleCount = normalizeText(collected.peopleCount)
  const relationship = normalizeText(collected.relationship)
  if (peopleCount && relationship) return `${peopleCount}·${relationship}`
  return peopleCount || relationship || ""
}

function buildGuideFocusItems(candidate = {}, item = {}, type = "") {
  const candidateHighlights = normalizeArray(candidate.highlights)
    .concat(normalizeArray(candidate.playItems))
    .concat(normalizeArray(candidate.tags))

  let localHighlights = []
  if (type === "activity") {
    localHighlights = normalizeArray(item.highlights)
      .concat(normalizeArray(item.itinerary))
      .concat(normalizeArray(item.playTags))
      .concat(normalizeArray(item.suitableGroups))
  } else if (type === "scenic") {
    localHighlights = normalizeArray(item.highlights)
      .concat(normalizeArray(item.playTags))
      .concat(normalizeArray(item.tags))
  } else if (type === "product") {
    localHighlights = normalizeArray(item.highlights)
      .concat(normalizeArray(item.categoryTags))
      .concat(normalizeArray(item.tags))
  } else if (type === "hotel") {
    localHighlights = normalizeArray(item.highlights)
      .concat(normalizeArray(item.facilities))
      .concat(normalizeArray(item.roomTypes))
      .concat(normalizeArray(item.suitableGroups))
  }

  return uniqueList(candidateHighlights.concat(localHighlights)).slice(0, 4)
}

function buildGuidePracticalInfo(candidate = {}, item = {}, taskState = {}, type = "") {
  const companionText = buildTravelCompanionText(taskState)
  const regionText = buildRegionText(item, candidate)
  const priceText = normalizeText(candidate.priceText)
    || (item.price ? `楼${item.price}` : "")
    || (item.priceFrom ? "¥" + item.priceFrom + "起" : "")
  const list = []

  if (regionText) {
    list.push({ label: "所在区域", value: regionText })
  }

  if (companionText) {
    list.push({ label: "同行场景", value: companionText })
  }

  if (type === "activity") {
    list.push({ label: "出行参考", value: normalizeText(item.transport) || "以商家最新安排为准" })
    if (priceText) list.push({ label: "参考价格", value: priceText })
    return list.slice(0, 3)
  }

  if (type === "scenic") {
    list.push({ label: "开放时间", value: normalizeText(item.openTime) || "以现场公示为准" })
    if (priceText) list.push({ label: "门票参考", value: priceText })
    return list.slice(0, 3)
  }

  if (type === "product") {
    if (priceText) list.push({ label: "参考价格", value: priceText })
    list.push({ label: "适合场景", value: companionText || "伴手礼/自用" })
    return list.slice(0, 3)
  }

  if (type === "hotel") {
    list.push({ label: "位置参考", value: normalizeText(item.address) || regionText })
    if (priceText) list.push({ label: "参考价格", value: priceText })
    return list.slice(0, 3)
  }

  if (priceText) {
    list.push({ label: "参考价格", value: priceText })
  }

  return list.slice(0, 3)
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

  const patterns = [
    /去([\u4e00-\u9fa5A-Za-z0-9]{2,12})/u,
    /到([\u4e00-\u9fa5A-Za-z0-9]{2,12})/u,
    /在([\u4e00-\u9fa5A-Za-z0-9]{2,12})(?:玩|逛|旅游|旅行)/u
  ]

  for (const pattern of patterns) {
    const matched = normalizeText(text).match(pattern)
    if (matched && matched[1]) return matched[1]
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

  const patterns = [
    /(女生搭子|男生搭子|情侣搭子|亲子搭子|摄影搭子|饭搭子|自由行搭子)/u,
    /(同龄人|大学生|本地人|会开车|能拼车|随和一点|话少一点|会拍照)/u
  ]

  for (const pattern of patterns) {
    const matched = normalizeText(text).match(pattern)
    if (matched && matched[1]) return matched[1]
  }

  return ""
}

function extractGuidePeopleCount(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["peopleCount"])
  if (existing) return existing

  const matched = normalizeText(text).match(/([一二三四五六七八九十两\d]+(?:人|位))/u)
  return matched && matched[1] ? matched[1] : ""
}

function extractGuideRelationship(text = "", collected = {}) {
  const existing = readCollectedText(collected, ["relationship"])
  if (existing) return existing

  const matched = normalizeText(text).match(/(情侣|夫妻|亲子|朋友|闺蜜|同学|同事|家人|一个人|独自)/u)
  return matched && matched[1] ? matched[1] : ""
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
  if (/(难用|卡顿|bug|闪退|进不去|加载慢|失败)/u.test(source)) return "product_feedback"
  if (/(难受|委屈|伤心|emo|崩溃|累)/u.test(source)) return "emotion_support"
  return "experience_complaint"
}

function buildSkillOpeningQuestion(skillMode = "") {
  if (skillMode === "guide_customization") {
    return "用户刚进入了攻略定制技能。请先热情问候，再自然引导用户逐步补充行程信息。第一轮只问当前最必要的一个问题。"
  }

  if (skillMode === "buddy_matching") {
    return "用户刚进入了找搭子技能。请先以小禾的身份自然开场，引导用户说清这次想去哪、什么时候出发、希望和什么样的人同行。第一轮只问当前最必要的一个问题。"
  }

  if (skillMode === "xiaohe_feedback") {
    return "用户刚进入了小禾树洞技能。请先邀请用户说出最想反馈的内容，再根据表达自然追问必要细节。"
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

function buildBuddyPromptSummary(question = "", userInfo = {}) {
  const dnaTags = normalizeArray(userInfo.dnaTags).slice(0, 3)
  const profileText = dnaTags.length ? "，也会参考你的偏好标签 " + dnaTags.join("、") : ""
  const questionText = normalizeText(question) || "你当前的同行需求"
  return "小禾根据 " + questionText + profileText + "，先帮你筛到这几位更值得进一步联系的搭子候选。"
}

Page({
  data: {
    statusBarHeight: 20,
    text: {
      brand: "问小禾",
      fallbackQuestion: "闄勮繎鏈夊摢浜涢€傚悎鍛ㄦ湯鏀炬澗鐨勫幓澶勶紵",
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
    const skillMainline = MAINLINE_BY_SKILL_MODE[this.data.skillMode] || currentTaskState.mainline || ""
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
      this.appendAiMessage("记下了。接下来小禾会优先帮你关注更近一点、出行更轻松的选择。")
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

    if (/^(璇︾粏涓€鐐箌鏇磋缁嗕竴鐐箌鍏蜂綋涓€鐐箌璇村叿浣撶偣|灞曞紑璁茶|璁茶缁嗙偣|鍐嶈缁嗙偣)$/u.test(normalizedValue)) {
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
    this.startLoadingAnimation(aiMessageId)

    try {
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

      let answer = ""
      for await (const chunk of res.textStream) {
        answer += chunk
        this.stopLoadingAnimation()
        this.updateMessageById(aiMessageId, {
          text: answer
        })
      }

      const conversationState = await conversationStatePromise
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

      if (
        conversationState &&
        conversationState.mainline === "guide_customization" &&
        recommendations.length
      ) {
        this.updateMessageById(aiMessageId, {
          text: buildGuideCardIntro(taskStateFromBackend),
          recommendations,
          tips: buildGuideWarmTips(taskStateFromBackend),
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

  async buildActivityRecommendationCard(candidate = {}, item = {}, taskState = {}) {
    const coverTagInfo = buildActivityCoverTags(item)
    const cover = await resolveActivityCover(item)
    const gallery = await resolveActivityGallery(item)

    return {
      id: `${normalizeText(candidate.type)}-${normalizeText(candidate.id)}`,
      sourceId: normalizeText(item._id || item.id || candidate.id),
      type: "activity",
      title: normalizeText(candidate.title) || normalizeText(item.title) || "鍐滄梾娲诲姩",
      summary: normalizeText(candidate.summary) || normalizeText(item.summary || item.content || item.detail) || "小禾先帮你筛出了一个适合继续了解的农旅活动。",
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
      tags: uniqueList(normalizeArray(candidate.tags).concat(coverTagInfo.combinedTags || [])).slice(0, 4),
      playItems: buildGuideFocusItems(candidate, item, "activity"),
      practicalInfo: buildGuidePracticalInfo(candidate, item, taskState, "activity"),
      cover
    }
  },

  async buildScenicRecommendationCard(candidate = {}, item = {}, taskState = {}) {
    const cover = await resolveMediaSource(item.cover, DEFAULT_ACTIVITY_COVER)
    const gallery = await resolveMediaList(item.gallery || [], cover)

    return {
      id: `${normalizeText(candidate.type)}-${normalizeText(candidate.id)}`,
      sourceId: normalizeText(item._id || item.id || candidate.id),
      type: "scenic",
      title: normalizeText(candidate.title) || normalizeText(item.title) || "涔℃潙鏅偣",
      summary: normalizeText(candidate.summary) || normalizeText(item.summary || item.content) || "小禾先帮你筛出了一个适合继续了解的景点。",
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
      tags: uniqueList(normalizeArray(candidate.tags).concat(normalizeArray(item.playTags)).concat(normalizeArray(item.tags))).slice(0, 4),
      playItems: buildGuideFocusItems(candidate, item, "scenic"),
      practicalInfo: buildGuidePracticalInfo(candidate, item, taskState, "scenic"),
      cover
    }
  },

  async buildProductRecommendationCard(candidate = {}, item = {}, taskState = {}) {
    const cover = await resolveMediaSource(item.cover, DEFAULT_PRODUCT_COVER)
    const gallery = await resolveMediaList(item.gallery || [], cover)

    return {
      id: `${normalizeText(candidate.type)}-${normalizeText(candidate.id)}`,
      sourceId: normalizeText(item._id || item.id || candidate.id),
      type: "product",
      title: normalizeText(candidate.title) || normalizeText(item.title) || "涔″懗鐗逛骇",
      summary: normalizeText(candidate.summary) || normalizeText(item.summary || item.content) || "小禾先帮你筛出了一个适合继续了解的本地好物。",
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
      tags: uniqueList(normalizeArray(candidate.tags).concat(normalizeArray(item.categoryTags)).concat(normalizeArray(item.tags))).slice(0, 4),
      playItems: buildGuideFocusItems(candidate, item, "product"),
      practicalInfo: buildGuidePracticalInfo(candidate, item, taskState, "product"),
      cover
    }
  },

  async buildHotelRecommendationCard(candidate = {}, item = {}, taskState = {}) {
    const cover = await resolveMediaSource(item.cover, DEFAULT_ACTIVITY_COVER)
    const gallery = await resolveMediaList(item.gallery || [], cover)

    return {
      id: `${normalizeText(candidate.type)}-${normalizeText(candidate.id)}`,
      sourceId: normalizeText(item._id || item.id || candidate.id),
      type: "hotel",
      title: normalizeText(candidate.title) || normalizeText(item.name || item.title) || "閰掑簵姘戝",
      summary: normalizeText(candidate.summary) || normalizeText(item.summary || item.description || item.desc) || "小禾先帮你筛出了一个适合继续了解的住宿选项。",
      gallery: Array.isArray(gallery) ? gallery.filter(Boolean).slice(0, 2) : [],
      tags: uniqueList(normalizeArray(candidate.tags).concat(normalizeArray(item.tags))).slice(0, 4),
      playItems: buildGuideFocusItems(candidate, item, "hotel"),
      practicalInfo: buildGuidePracticalInfo(candidate, item, taskState, "hotel"),
      cover
    }
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

    const cards = await Promise.all(normalizedCandidates.map(async (candidate) => {
      const type = normalizeText(candidate.type)

      if (type === "activity") {
        const item = findRecordByCandidateId(activities, candidate)
        if (item) return this.buildActivityRecommendationCard(candidate, item, taskState)
      }

      if (type === "scenic") {
        const item = findRecordByCandidateId(scenics, candidate)
        if (item) return this.buildScenicRecommendationCard(candidate, item, taskState)
      }

      if (type === "product") {
        const item = findRecordByCandidateId(products, candidate)
        if (item) return this.buildProductRecommendationCard(candidate, item, taskState)
      }

      if (type === "hotel") {
        const item = findRecordByCandidateId(hotels, candidate)
        if (item) return this.buildHotelRecommendationCard(candidate, item, taskState)
      }

      return null
    }))

    return cards.filter(Boolean)
  },

  buildBuddyRecommendations(candidates = [], taskState = {}) {
    const normalizedCandidates = Array.isArray(candidates) ? candidates : []
    if (!normalizedCandidates.length) return []

    return normalizedCandidates
      .map((candidate) => normalizeBuddyRecommendation({
        id: normalizeText(candidate.id),
        type: "buddy",
        title: normalizeText(candidate.nickname || candidate.title) || "搭子候选",
        summary: normalizeText(candidate.summary),
        matchReason: normalizeText(candidate.matchReason),
        tags: normalizeArray(candidate.tags),
        region: normalizeText(candidate.region),
        score: Number(candidate.score || 0),
        nickname: normalizeText(candidate.nickname),
        playItems: [],
        practicalInfo: []
      }, taskState))
      .filter(Boolean)
  },

  applyBuddyMatch(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
    const userName = normalizeText(dataset.username)
    const openingText = normalizeText(dataset.opening)
    if (!userName || !openingText) {
      wx.showToast({ title: "杩欎綅鎼瓙鐨勪俊鎭繕娌″噯澶囧ソ", icon: "none" })
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
      wx.showToast({ title: "鍙戣捣鐢宠澶辫触", icon: "none" })
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


