const { yuxiaoheBotId } = require("../../config/agent")
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
    summary: buildBuddyDisplaySummary({ ...item, tags, practicalInfo }),
    matchReason: buildBuddySystemReason({ ...item, tags }),
    reasonTitle: "系统匹配说明",
    tags,
    playItems: filterBuddyHighlights(item.playItems),
    practicalInfo,
  }
}

function trimRegionSuffix(value = "") {
  return normalizeText(value).replace(/(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/u, "")
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
    title: SKILL_CONFIG[skillMode].badgeName
  }
}

function buildSkillOpeningQuestion(skillMode = "") {
  if (skillMode === "guide_customization") {
    return "用户刚进入了“攻略定制”技能。请你先热情问候，再用自然聊天的语气引导用户逐步补充行程信息。不要一上来就长篇推荐，也不要像表单一样连续盘问。你要优先收集并梳理这些关键信息：出发日期和天数、人数、人物关系、出发地、目的地、途径地、出行方式、预算。如果用户暂时不确定某一项，你要主动给出合理默认并继续推进。等信息足够后，再结合季节、天气、温度、旺季淡季和平台内容给出建议。第一轮只问当前最必要的一个问题。"
  }

  if (skillMode === "buddy_matching") {
    return "用户刚进入了“找搭子”技能。请你先用自然聊天的语气确认这次想找什么类型的同行搭子，再一步步补充目的地、出发时间、出发地、人数偏好和同行边界。不要把这段对话做成表单。第一轮只问最必要的一个问题。"
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
      showSkillIntro: source === "skill_entry" && !!skillConfig,
      showSkillBadge: source === "skill_entry" && !!skillConfig,
      skillBadgeName: skillConfig ? skillConfig.badgeName : "",
      inputPlaceholder: skillConfig ? skillConfig.placeholder : this.data.text.inputPlaceholder,
      introText: skillConfig ? skillConfig.intro : "",
      quickOptions: [],
      messages,
      genericPreferences: {
        distance: "",
        budget: "",
        detailLevel: ""
      }
    })

    this.persistConversation(nextConversationId, messages, initialQuestion)

    if (source === "skill_entry") {
      if (skillMode === "buddy_matching") {
        this.requestBuddyMatches("我想找一个合适的搭子")
        return
      }

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
      genericPreferences: {
        distance: "",
        budget: "",
        detailLevel: ""
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
      messages
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
      if (this.data.skillMode === "buddy_matching") {
        this.requestBuddyMatches(value)
        return
      }

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
    const shouldRenderStructuredAnswer = !!recommendationType
    this.startLoadingAnimation(aiMessageId)

    try {
      const groundedUiPromise = this.buildGroundedRecommendationUi(question, options.contextPayload || {})
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId: yuxiaoheBotId,
          msg: question,
          history: toAgentHistory(this.data.messages),
          contextPayload: this.buildGenericPayload(question, options.contextPayload || {})
        }
      })

      let answer = ""
      for await (const chunk of res.textStream) {
        answer += chunk
        if (!shouldRenderStructuredAnswer) {
          this.stopLoadingAnimation()
          this.updateMessageById(aiMessageId, {
            text: answer
          })
        }
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

  buildGenericPayload(question, extraPayload = {}) {
    const app = getApp()
    let userInfo = {}
    let cachedUserLocation = null

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

    return {
      mode: extraPayload.mode || "generic",
      question,
      location: {
        province: userInfo.province || "",
        city: userInfo.city || "",
        district: userInfo.district || "",
        latitude: cachedUserLocation && cachedUserLocation.latitude ? cachedUserLocation.latitude : "",
        longitude: cachedUserLocation && cachedUserLocation.longitude ? cachedUserLocation.longitude : ""
      },
      userProfile: {
        nickname: userInfo.nickName || userInfo.nickname || "",
        dnaTags: userInfo.dnaTags || []
      },
      preferences: this.data.genericPreferences || {},
      history: (this.data.messages || [])
        .map((item) => ({
          role: item.role,
          text: item.text
        }))
        .filter((item) => item.role && item.text)
        .slice(-8),
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
