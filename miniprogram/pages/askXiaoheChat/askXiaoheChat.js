const { yuxiaoheBotId } = require("../../config/agent")
const { resolveActivityCover, resolveActivityGallery } = require("../../utils/mediaAssets")
const { buildActivityCoverTags } = require("../../utils/activityCoverTags")
const {
  buildConversationTitle,
  createConversationId,
  getConversationById,
  saveConversation
} = require("../../utils/askConversationStore")

const DEFAULT_ACTIVITY_COVER = "/images/nav-academy.png"
const DEFAULT_PRODUCT_COVER = "/images/default-goods-image.png"
const LOADING_BASE_TEXT = "小禾正在整理合适的内容"

const SKILL_CONFIG = {
  route_planning: {
    badgeName: "路线规划",
    placeholder: "告诉小禾你的出发地和目的地",
    intro: "把出发地、途经地或目的地告诉小禾，小禾会先帮你把路线思路整理清楚。",
    firstQuestion: "我们先从出发地开始吧，你准备从哪里出发？",
    quickOptions: []
  },
  guide_customization: {
    badgeName: "攻略定制",
    placeholder: "告诉小禾你的出行需求",
    intro: "把人数、天数、地区和偏好告诉小禾，小禾会一步步帮你整理成更清晰的出行方案。",
    firstQuestion: "我们先从基础信息开始吧，这次是几个人一起出行？",
    quickOptions: ["1人", "2人", "3-5人", "6人以上"]
  },
  xiaohe_feedback: {
    badgeName: "小禾树洞",
    placeholder: "说说你的想法",
    intro: "无论是活动、商品、住宿还是体验建议，都可以直接告诉小禾，小禾会认真记下来。",
    firstQuestion: "这次你最想和小禾聊哪一类想法？",
    quickOptions: ["活动建议", "商品建议", "住宿建议", "体验反馈"]
  }
}

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

function uniqueList(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)))
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

function buildSkillRequest(skillMode = "", formData = {}) {
  const normalized = Object.fromEntries(
    Object.entries(formData || {}).map(([key, value]) => [key, normalizeText(value)])
  )

  if (skillMode === "route_planning") {
    return {
      question: `请根据我的路线规划需求，结合平台内容给出更实用的出行建议。我的出发地是${normalized.origin}，目的地是${normalized.destination}。`,
      contextPayload: {
        mode: "skill",
        skillContext: {
          mode: "route_planning",
          title: "路线规划",
          collected: normalized
        }
      }
    }
  }

  if (skillMode === "guide_customization") {
    return {
      question: `请根据我的攻略定制需求，结合平台内容给出更适合的推荐。我这次${normalized.peopleCount}出行，同行类型是${normalized.groupType}，计划${normalized.days}，想去${normalized.region}，预算是${normalized.budget}。`,
      contextPayload: {
        mode: "skill",
        skillContext: {
          mode: "guide_customization",
          title: "攻略定制",
          collected: normalized
        }
      }
    }
  }

  if (skillMode === "xiaohe_feedback") {
    return {
      question: `这是我想通过问小禾提交的一条${normalized.feedbackType || "体验反馈"}，请先理解我的反馈重点，并给出合适的回应。反馈内容是：${normalized.feedbackText}。`,
      contextPayload: {
        mode: "skill",
        skillContext: {
          mode: "xiaohe_feedback",
          title: "小禾树洞",
          collected: normalized
        }
      }
    }
  }

  return {
    question: "",
    contextPayload: {}
  }
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
    currentStep: "",
    formData: {},
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
    const skillMode = options && options.skillMode ? options.skillMode : ""
    const skillConfig = SKILL_CONFIG[skillMode] || null
    const question = options && options.q ? decodeURIComponent(options.q) : ""
    const conversationId = options && options.conversationId ? decodeURIComponent(options.conversationId) : ""

    if (conversationId) {
      this.restoreConversation(conversationId, source, skillMode, skillConfig)
      return
    }

    const initialQuestion = question || this.data.text.fallbackQuestion
    const messages = this.buildMessages({ source, question: initialQuestion, skillConfig })
    const nextConversationId = source === "skill_entry" ? "" : createConversationId()

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
      quickOptions: skillConfig ? skillConfig.quickOptions : [],
      messages,
      currentStep: this.getInitialStep(source, skillMode),
      formData: {},
      genericPreferences: {
        distance: "",
        budget: "",
        detailLevel: ""
      }
    })

    if (source !== "skill_entry") {
      this.persistConversation(nextConversationId, messages, initialQuestion)
      this.requestGenericAnswer(initialQuestion)
    }
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
      currentStep: "",
      formData: {},
      genericPreferences: {
        distance: "",
        budget: "",
        detailLevel: ""
      }
    })
  },

  buildMessages({ source, question, skillConfig }) {
    if (source === "skill_entry" && skillConfig) {
      return [createMessage("ai", skillConfig.firstQuestion)]
    }
    return [createMessage("user", question)]
  },

  getInitialStep(source, skillMode) {
    if (source !== "skill_entry") return ""

    const stepMap = {
      route_planning: "route_origin",
      guide_customization: "guide_people",
      xiaohe_feedback: "feedback_type"
    }

    return stepMap[skillMode] || ""
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
    const firstQuestion = normalizeText(firstUserMessage && firstUserMessage.text)
    if (!firstQuestion) return

    this.persistConversation(conversationId, messages, firstQuestion)
  },

  activateGenericMode() {
    const nextConversationId = this.data.conversationId || createConversationId()

    this.setData({
      source: "search_input",
      skillMode: "",
      conversationId: nextConversationId,
      showSkillIntro: false,
      showSkillBadge: false,
      skillBadgeName: "",
      inputPlaceholder: this.data.text.inputPlaceholder,
      introText: "",
      quickOptions: [],
      currentStep: "",
      formData: {}
    })

    return nextConversationId
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
      this.handleSkillReply(value)
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

  requestSkillAnswer(skillMode, formData) {
    const skillRequest = buildSkillRequest(skillMode, formData)
    const question = normalizeText(skillRequest.question)

    if (!question) {
      this.appendAiMessage("这次收集到的信息还不够完整，你可以再补充一点，小禾再继续帮你整理。")
      return
    }

    this.activateGenericMode()
    this.requestGenericAnswer(question, {
      contextPayload: skillRequest.contextPayload || {}
    })
  },

  handleSkillReply(value) {
    if (!this.data.currentStep || /_(done)$/u.test(this.data.currentStep)) {
      this.activateGenericMode()
      this.replyGeneric(value)
      return
    }

    if (this.data.skillMode === "route_planning") {
      this.handleRouteReply(value)
      return
    }

    if (this.data.skillMode === "guide_customization") {
      this.handleGuideReply(value)
      return
    }

    if (this.data.skillMode === "xiaohe_feedback") {
      this.handleFeedbackReply(value)
    }
  },

  handleRouteReply(value) {
    const formData = { ...(this.data.formData || {}) }

    if (this.data.currentStep === "route_origin") {
      formData.origin = value
      this.setData({ formData, currentStep: "route_destination", quickOptions: [] })
      this.appendAiMessage("记下了。那这次你想去哪里？")
      return
    }

    if (this.data.currentStep === "route_destination") {
      formData.destination = value
      this.requestSkillAnswer("route_planning", formData)
    }
  },

  handleGuideReply(value) {
    const formData = { ...(this.data.formData || {}) }
    const step = this.data.currentStep

    if (step === "guide_people") {
      formData.peopleCount = value
      this.setData({ formData, currentStep: "guide_group", quickOptions: ["亲子", "情侣", "朋友", "长辈"] })
      this.appendAiMessage("这次同行的人更接近哪一类？")
      return
    }

    if (step === "guide_group") {
      formData.groupType = value
      this.setData({ formData, currentStep: "guide_days", quickOptions: ["1天", "2天", "3天"] })
      this.appendAiMessage("这次准备安排几天？")
      return
    }

    if (step === "guide_days") {
      formData.days = value
      this.setData({ formData, currentStep: "guide_region", quickOptions: [] })
      this.appendAiMessage("这次更想去哪个地区看看？")
      return
    }

    if (step === "guide_region") {
      formData.region = value
      this.setData({ formData, currentStep: "guide_budget", quickOptions: ["500元内", "500-1000元", "1000-2000元"] })
      this.appendAiMessage("这次大概想把预算控制在什么范围？")
      return
    }

    if (step === "guide_budget") {
      formData.budget = value
      this.requestSkillAnswer("guide_customization", formData)
    }
  },

  handleFeedbackReply(value) {
    const formData = { ...(this.data.formData || {}) }

    if (this.data.currentStep === "feedback_type") {
      formData.feedbackType = value
      this.setData({ formData, currentStep: "feedback_detail", quickOptions: [] })
      this.appendAiMessage("可以再和小禾说具体一点吗？这样我会更方便帮你准确记录。")
      return
    }

    formData.feedbackText = value
    this.requestSkillAnswer("xiaohe_feedback", formData)
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

    const skillContext = extraPayload.skillContext || {}
    const explicitRegion = normalizeText(
      skillContext.mode === "route_planning"
        ? skillContext.collected && skillContext.collected.destination
        : skillContext.collected && skillContext.collected.region
    )

    return {
      mode: "generic",
      question,
      location: {
        province: userInfo.province || "",
        city: userInfo.city || "",
        district: userInfo.district || "",
        displayName: explicitRegion || "",
        locationText: explicitRegion || "",
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

  openCardDetail(e) {
    const { type, sourceid: sourceId } = e.currentTarget.dataset || {}
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
