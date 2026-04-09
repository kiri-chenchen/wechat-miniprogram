const ASK_CONVERSATION_STORAGE_KEY = "askXiaoheConversations"
const MAX_CONVERSATIONS = 20

function normalizeText(value) {
  return String(value || "").trim()
}

function createConversationId() {
  return `conv_${Date.now()}_${Math.floor(Math.random() * 100000)}`
}

function buildConversationTitle(firstQuestion = "") {
  const text = normalizeText(firstQuestion)
  if (!text) return "新的小禾对话"

  if (/亲子/.test(text) && /(农旅|活动|采摘|研学|农场)/.test(text)) {
    return "附近亲子农旅活动推荐"
  }

  if (/(拍照|打卡)/.test(text) && /(景点|地方|景区|哪里)/.test(text)) {
    return "附近拍照打卡景点推荐"
  }

  if (/(景点|景区|古村|花海|草原|观景)/.test(text)) {
    return "附近乡村景点推荐"
  }

  if (/(特产|乡味|伴手礼|礼盒|美食)/.test(text)) {
    return "附近乡味特产推荐"
  }

  if (/(周末|放松|去处)/.test(text)) {
    return "附近周末放松去处推荐"
  }

  const compact = text.replace(/[？?！!。,，、；;：:\s]/g, "")
  return compact.slice(0, 14) || "新的小禾对话"
}

function safeRead() {
  try {
    return wx.getStorageSync(ASK_CONVERSATION_STORAGE_KEY) || []
  } catch (error) {
    return []
  }
}

function safeWrite(list) {
  wx.setStorageSync(ASK_CONVERSATION_STORAGE_KEY, Array.isArray(list) ? list : [])
}

function listConversations() {
  return safeRead()
    .filter((item) => item && item.id)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

function getConversationById(id) {
  return listConversations().find((item) => item.id === id) || null
}

function saveConversation(conversation) {
  if (!conversation || !conversation.id) return null

  const current = listConversations().filter((item) => item.id !== conversation.id)
  const next = [
    {
      id: conversation.id,
      title: normalizeText(conversation.title) || "新的小禾对话",
      firstQuestion: normalizeText(conversation.firstQuestion),
      createdAt: conversation.createdAt || Date.now(),
      updatedAt: conversation.updatedAt || Date.now(),
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
      source: normalizeText(conversation.source),
      skillMode: normalizeText(conversation.skillMode),
      genericPreferences: conversation.genericPreferences || {},
      currentTaskState: conversation.currentTaskState || null
    }
  ].concat(current).slice(0, MAX_CONVERSATIONS)

  safeWrite(next)
  return next[0]
}

function removeConversation(id) {
  const next = listConversations().filter((item) => item.id !== id)
  safeWrite(next)
  return next
}

function clearConversations() {
  safeWrite([])
}

module.exports = {
  ASK_CONVERSATION_STORAGE_KEY,
  buildConversationTitle,
  clearConversations,
  createConversationId,
  getConversationById,
  listConversations,
  removeConversation,
  saveConversation
}
