const STORAGE_KEY = 'messageCenterMockState'

function normalizeList(value) {
  return Array.isArray(value) ? value : []
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sortByUpdatedAt(list) {
  return normalizeList(list).sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
}

function createSeedState() {
  const now = Date.now()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  return {
    interactiveFilters: [
      { key: 'all', label: '全部消息' },
      { key: 'like', label: '赞' },
      { key: 'mention', label: '提及' },
      { key: 'comment', label: '评论' },
    ],
    interactions: [
      {
        id: 'interaction-1',
        type: 'mention',
        actorName: '春日果园',
        actorTag: '朋友',
        avatarText: '春',
        avatarColor: '#ffb547',
        actionText: '提到了你',
        content: '周末黄河边露营活动记得带上相机，我们一起拍照打卡。',
        targetTitle: '黄河边露营活动',
        updatedAt: now - 2 * hour,
      },
      {
        id: 'interaction-2',
        type: 'like',
        actorName: '风吹麦浪',
        actorTag: '互相关注',
        avatarText: '风',
        avatarColor: '#ff6f91',
        actionText: '赞了你的出行笔记',
        content: '你发布的“周末采摘搭子攻略”收到了新的赞。',
        targetTitle: '周末采摘搭子攻略',
        updatedAt: now - 5 * hour,
      },
      {
        id: 'interaction-3',
        type: 'comment',
        actorName: '山野摄影社',
        actorTag: '朋友',
        avatarText: '山',
        avatarColor: '#6e9eff',
        actionText: '评论了你',
        content: '“这个路线很适合周末短途，想一起去！”',
        targetTitle: '桃花摄影路线',
        updatedAt: now - day,
      },
    ],
    newFollowers: [
      {
        id: 'follower-1',
        userName: '麦田里的风',
        avatarText: '麦',
        avatarColor: '#ff8b5c',
        followAt: now - day,
      },
      {
        id: 'follower-2',
        userName: '西北小路',
        avatarText: '西',
        avatarColor: '#4da1ff',
        followAt: now - 2 * day,
      },
      {
        id: 'follower-3',
        userName: '桃花巷口',
        avatarText: '桃',
        avatarColor: '#ff6ab0',
        followAt: now - 3 * day,
      },
    ],
    noteStories: [
      {
        id: 'note-story-1',
        userName: '桃花摄影搭子',
        avatarText: '桃',
        avatarColor: '#ff6fb5',
        noteId: 'note-1',
        noteTitle: '桃花沟半日摄影笔记',
        noteSummary: '今天桃花已经开得很满，下午四点的光线最适合拍人像，山脚停车也方便。',
        publishAt: now - 18 * minute,
      },
      {
        id: 'note-story-2',
        userName: '乡野慢游小队',
        avatarText: '慢',
        avatarColor: '#5f9dff',
        noteId: 'note-2',
        noteTitle: '周末慢游路线更新',
        noteSummary: '把集合点改到了地铁口，顺路加了一家可以喝茶休息的院子。',
        publishAt: now - 45 * minute,
      },
      {
        id: 'note-story-3',
        userName: '周末采摘计划',
        avatarText: '采',
        avatarColor: '#45b36b',
        noteId: 'note-3',
        noteTitle: '草莓园实测笔记',
        noteSummary: '上午十点前人少一些，采摘区旁边有洗手台，带孩子去会更方便。',
        publishAt: now - 2 * hour,
      },
      {
        id: 'note-story-4',
        userName: '风吹麦浪',
        avatarText: '风',
        avatarColor: '#ff8b5c',
        noteId: 'note-4',
        noteTitle: '黄河边露营注意事项',
        noteSummary: '晚上风大，建议带厚外套和露营灯，靠河边的位置蚊虫会多一些。',
        publishAt: now - 5 * hour,
      },
    ],
    merchantConversations: [
      {
        id: 'merchant-1',
        shopName: '河湾采摘园',
        avatarText: '河',
        avatarColor: '#ff9f43',
        preview: '您好，周六上午场还有两个名额，可以直接到店集合。',
        updatedAt: now - 40 * minute,
        unread: 2,
      },
      {
        id: 'merchant-2',
        shopName: '山野民宿',
        avatarText: '宿',
        avatarColor: '#6c5ce7',
        preview: '已为你保留山景房，如需加早餐可以直接告诉我。',
        updatedAt: now - 6 * hour,
        unread: 0,
      },
    ],
    merchantMessages: {
      'merchant-1': [
        {
          id: 'merchant-1-msg-1',
          role: 'merchant',
          text: '你好，看到你咨询周末采摘活动了。',
          updatedAt: now - 80 * minute,
        },
        {
          id: 'merchant-1-msg-2',
          role: 'merchant',
          text: '您好，周六上午场还有两个名额，可以直接到店集合。',
          updatedAt: now - 40 * minute,
        },
      ],
      'merchant-2': [
        {
          id: 'merchant-2-msg-1',
          role: 'merchant',
          text: '已为你保留山景房，如需加早餐可以直接告诉我。',
          updatedAt: now - 6 * hour,
        },
      ],
    },
    platformSupportConversation: {
      id: 'platform-support',
      title: '平台客服',
      avatarText: '平',
      avatarColor: '#3c9f5b',
      updatedAt: now - 3 * hour,
      unread: 1,
    },
    platformSupportMessages: [
      {
        id: 'platform-support-1',
        role: 'platform',
        text: '你好，这里是平台客服。账号、订单、退款、规则问题都可以在这里咨询。',
        updatedAt: now - 3 * hour,
      },
      {
        id: 'platform-support-2',
        role: 'platform',
        text: '你最近的活动订单如果需要协助，也可以把订单号直接发给我。',
        updatedAt: now - 2.8 * hour,
      },
    ],
    platformGuarantees: [
      {
        id: 'guarantee-1',
        title: '平台服务保障',
        subtitle: '出行订单保障待领取',
        content: '你本次乡野采摘活动可领取平台出行保障，若遇商家无法履约等问题，可发起平台协助。',
        orderTitle: '春日草莓采摘一日游',
        orderNo: 'TRIP20260326001',
        actionText: '点击领取保障',
        updatedAt: now - 4 * hour,
      },
      {
        id: 'guarantee-2',
        title: '平台服务保障',
        subtitle: '订单保障已生效',
        content: '你上次的民宿订单保障已生效，若出现入住问题，可在订单详情里申请平台介入。',
        orderTitle: '山野民宿周末两日住',
        orderNo: 'HOTEL20260318009',
        actionText: '查看保障说明',
        updatedAt: now - 2 * day,
      },
    ],
    buddyApplications: [
      {
        id: 'buddy-apply-1',
        userName: '桃花摄影搭子',
        avatarText: '桃',
        avatarColor: '#ff6fb5',
        preview: '你好，我也想去桃花摄影活动，能一起拼车吗？',
        updatedAt: now - 25 * minute,
        unread: 2,
        messages: [
          {
            id: 'buddy-apply-1-msg-1',
            role: 'other',
            text: '你好，我也想去桃花摄影活动，能一起拼车吗？',
            updatedAt: now - 25 * minute,
          },
          {
            id: 'buddy-apply-1-msg-2',
            role: 'other',
            text: '我从兰州西出发，时间比较灵活。',
            updatedAt: now - 23 * minute,
          },
        ],
      },
      {
        id: 'buddy-apply-2',
        userName: '黄河露营搭子',
        avatarText: '黄',
        avatarColor: '#ff9a3d',
        preview: '看到你也收藏了黄河边露营活动，想问下你周六去吗？',
        updatedAt: now - 3 * hour,
        unread: 1,
        messages: [
          {
            id: 'buddy-apply-2-msg-1',
            role: 'other',
            text: '看到你也收藏了黄河边露营活动，想问下你周六去吗？',
            updatedAt: now - 3 * hour,
          },
        ],
      },
    ],
    formalConversations: [
      {
        id: 'conversation-1',
        title: '乡野慢游小队',
        avatarText: '慢',
        avatarColor: '#5f9dff',
        preview: '我们准备周六上午九点在地铁口集合。',
        updatedAt: now - 50 * minute,
        unread: 1,
        kind: 'social',
      },
      {
        id: 'conversation-2',
        title: '周末采摘计划',
        avatarText: '采',
        avatarColor: '#45b36b',
        preview: '我把路线和预算整理好了，你看看。',
        updatedAt: now - 8 * hour,
        unread: 0,
        kind: 'social',
      },
    ],
    formalMessages: {
      'conversation-1': [
        {
          id: 'conversation-1-msg-1',
          role: 'other',
          text: '我们准备周六上午九点在地铁口集合。',
          updatedAt: now - 50 * minute,
        },
      ],
      'conversation-2': [
        {
          id: 'conversation-2-msg-1',
          role: 'other',
          text: '我把路线和预算整理好了，你看看。',
          updatedAt: now - 8 * hour,
        },
      ],
    },
  }
}

function mergeWithSeedState(cachedState = {}) {
  const seed = createSeedState()
  return {
    ...seed,
    ...cachedState,
    interactiveFilters: normalizeList(cachedState.interactiveFilters).length ? cachedState.interactiveFilters : seed.interactiveFilters,
    interactions: normalizeList(cachedState.interactions).length ? cachedState.interactions : seed.interactions,
    newFollowers: normalizeList(cachedState.newFollowers).length ? cachedState.newFollowers : seed.newFollowers,
    noteStories: normalizeList(cachedState.noteStories).length ? cachedState.noteStories : seed.noteStories,
    merchantConversations: normalizeList(cachedState.merchantConversations).length ? cachedState.merchantConversations : seed.merchantConversations,
    merchantMessages: cachedState.merchantMessages && typeof cachedState.merchantMessages === 'object'
      ? { ...seed.merchantMessages, ...cachedState.merchantMessages }
      : seed.merchantMessages,
    platformSupportConversation: cachedState.platformSupportConversation || seed.platformSupportConversation,
    platformSupportMessages: normalizeList(cachedState.platformSupportMessages).length ? cachedState.platformSupportMessages : seed.platformSupportMessages,
    platformGuarantees: normalizeList(cachedState.platformGuarantees).length ? cachedState.platformGuarantees : seed.platformGuarantees,
    buddyApplications: normalizeList(cachedState.buddyApplications).length ? cachedState.buddyApplications : seed.buddyApplications,
    formalConversations: normalizeList(cachedState.formalConversations).length ? cachedState.formalConversations : seed.formalConversations,
    formalMessages: cachedState.formalMessages && typeof cachedState.formalMessages === 'object'
      ? { ...seed.formalMessages, ...cachedState.formalMessages }
      : seed.formalMessages,
  }
}

function readStorageState() {
  try {
    const state = wx.getStorageSync(STORAGE_KEY)
    return state && typeof state === 'object' ? state : null
  } catch (error) {
    console.error('[messageStore] read state failed', error)
    return null
  }
}

function writeStorageState(state) {
  try {
    wx.setStorageSync(STORAGE_KEY, state)
  } catch (error) {
    console.error('[messageStore] write state failed', error)
  }
}

function ensureState() {
  const cached = readStorageState()
  if (cached) {
    const merged = mergeWithSeedState(cached)
    writeStorageState(merged)
    return merged
  }

  const state = createSeedState()
  writeStorageState(state)
  return state
}

function getMessageState() {
  return clone(ensureState())
}

function setMessageState(nextState) {
  writeStorageState(clone(nextState))
}

function formatMonthDay(timestamp) {
  const date = new Date(Number(timestamp || 0))
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function formatConversationTime(timestamp) {
  const value = Number(timestamp || 0)
  if (!value) return ''

  const date = new Date(value)
  const now = new Date()
  const sameDay = (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )

  if (sameDay) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  return formatMonthDay(value)
}

function buildHomeRows(state) {
  const safeState = state || ensureState()
  const buddyApplications = normalizeList(safeState.buddyApplications).filter((item) => item.direction)
  const buddyUnread = buddyApplications.reduce((sum, item) => sum + Number(item.unread || 0), 0)
  const latestBuddy = sortByUpdatedAt(buddyApplications)[0]

  const specialRows = [
    {
      id: 'buddy-home',
      kind: 'entry',
      entryType: 'buddy',
      title: '搭子申请',
      subtitle: latestBuddy ? latestBuddy.preview : '查看别人给你发送的搭子申请',
      updatedAt: latestBuddy ? latestBuddy.updatedAt : Date.now() - 3000,
      unread: buddyUnread,
      avatarText: '搭',
      avatarColor: '#6e89ff',
    },
  ]

  const conversationRows = sortByUpdatedAt(safeState.formalConversations)
    .filter((item) => item.kind === 'buddy')
    .map((item) => ({
    ...item,
    kind: 'conversation',
  }))

  return specialRows.concat(conversationRows)
}

function buildStoryList(state) {
  const safeState = state || ensureState()
  const relatedNames = uniqueList(
    normalizeList(safeState.buddyApplications)
      .map((item) => item.userName)
      .concat(normalizeList(safeState.formalConversations).map((item) => item.title))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )

  return clone(
    sortByUpdatedAt(safeState.noteStories)
      .filter((item) => relatedNames.includes(String(item.userName || '').trim()))
      .map((item) => ({
        id: item.id,
        title: item.userName,
        avatarUrl: item.avatarUrl || '',
        avatarText: item.avatarText,
        avatarColor: item.avatarColor,
        unread: 0,
        noteId: item.noteId,
        noteTitle: item.noteTitle,
      }))
  )
}

function getInteractiveList(filterKey) {
  const state = ensureState()
  const filter = String(filterKey || 'all')
  const source = normalizeList(state.interactions)
  if (filter === 'all') return clone(source)
  return clone(source.filter((item) => item.type === filter))
}

function markInteractionsRead() {
  const state = ensureState()
  state.interactions = normalizeList(state.interactions).map((item) => ({
    ...item,
    read: true,
  }))
  state.newFollowers = normalizeList(state.newFollowers).map((item) => ({
    ...item,
    read: true,
  }))
  writeStorageState(state)
}

function getNewFollowers() {
  return clone(sortByUpdatedAt(ensureState().newFollowers))
}

function getMerchantConversations() {
  return clone(sortByUpdatedAt(ensureState().merchantConversations))
}

function getMerchantConversation(id) {
  const state = ensureState()
  const conversation = normalizeList(state.merchantConversations).find((item) => item.id === id)
  const messages = clone((state.merchantMessages && state.merchantMessages[id]) || [])
  return {
    conversation: clone(conversation || null),
    messages,
  }
}

function sendMerchantMessage(id, text) {
  const content = String(text || '').trim()
  if (!content) return null

  const state = ensureState()
  const list = normalizeList(state.merchantConversations)
  const target = list.find((item) => item.id === id)
  if (!target) return null

  const now = Date.now()
  const nextMessage = {
    id: `${id}-user-${now}`,
    role: 'user',
    text: content,
    updatedAt: now,
  }

  state.merchantMessages[id] = normalizeList(state.merchantMessages[id]).concat(nextMessage)
  target.preview = content
  target.updatedAt = now
  writeStorageState(state)
  return nextMessage
}

function getPlatformSupport() {
  const state = ensureState()
  return {
    conversation: clone(state.platformSupportConversation),
    messages: clone(state.platformSupportMessages),
  }
}

function sendPlatformSupportMessage(text) {
  const content = String(text || '').trim()
  if (!content) return null

  const state = ensureState()
  const now = Date.now()
  const nextMessage = {
    id: `platform-user-${now}`,
    role: 'user',
    text: content,
    updatedAt: now,
  }

  state.platformSupportMessages = normalizeList(state.platformSupportMessages).concat(nextMessage)
  state.platformSupportConversation.updatedAt = now
  writeStorageState(state)
  return nextMessage
}

function getPlatformGuarantees() {
  return clone(sortByUpdatedAt(ensureState().platformGuarantees))
}

function getBuddyApplications() {
  return clone(sortByUpdatedAt(ensureState().buddyApplications).filter((item) => item.direction))
}

function getBuddyApplication(id) {
  const state = ensureState()
  const target = normalizeList(state.buddyApplications).find((item) => item.id === id)
  return clone(target || null)
}

function createBuddyApplicationFromMatch(payload = {}) {
  const userName = String(payload.userName || '').trim()
  const openingText = String(payload.openingText || '').trim()
  if (!userName || !openingText) {
    return null
  }

  const state = ensureState()
  const now = Date.now()
  const id = `buddy-apply-local-${now}`
  const application = {
    id,
    userName,
    avatarUrl: payload.avatarUrl || '',
    avatarText: payload.avatarText || userName.slice(0, 1) || '搭',
    avatarColor: payload.avatarColor || '#6e89ff',
    preview: openingText,
    draftText: openingText,
    updatedAt: now,
    unread: 0,
    direction: payload.direction || 'outgoing',
    matchScore: Number(payload.matchScore || 0),
    matchReason: payload.matchReason || '',
    messages: [],
  }

  state.buddyApplications = [application].concat(
    normalizeList(state.buddyApplications).filter((item) => item.id !== id)
  )
  writeStorageState(state)
  return clone(application)
}

function replyToBuddyApplication(id, text) {
  const content = String(text || '').trim()
  if (!content) return { conversationId: '', conversation: null }

  const state = ensureState()
  const target = normalizeList(state.buddyApplications).find((item) => item.id === id)
  if (!target) {
    return { conversationId: '', conversation: null }
  }

  const now = Date.now()
  const conversationId = `conversation-${id}`
  const nextMessages = normalizeList(target.messages).concat({
    id: `${id}-reply-${now}`,
    role: 'user',
    text: content,
    updatedAt: now,
  })

  state.buddyApplications = normalizeList(state.buddyApplications).filter((item) => item.id !== id)
  state.formalConversations = normalizeList(state.formalConversations)
    .filter((item) => item.id !== conversationId)
    .concat({
      id: conversationId,
      title: target.userName,
      avatarUrl: target.avatarUrl || '',
      avatarText: target.avatarText,
      avatarColor: target.avatarColor,
      preview: content,
      updatedAt: now,
      unread: 0,
      kind: 'buddy',
    })
  state.formalMessages[conversationId] = nextMessages
  writeStorageState(state)

  return {
    conversationId,
    conversation: clone(state.formalConversations.find((item) => item.id === conversationId) || null),
  }
}

function getFormalConversation(id) {
  const state = ensureState()
  return {
    conversation: clone(normalizeList(state.formalConversations).find((item) => item.id === id) || null),
    messages: clone((state.formalMessages && state.formalMessages[id]) || []),
  }
}

function sendFormalMessage(id, text) {
  const content = String(text || '').trim()
  if (!content) return null

  const state = ensureState()
  const target = normalizeList(state.formalConversations).find((item) => item.id === id)
  if (!target) return null

  const now = Date.now()
  const nextMessage = {
    id: `${id}-user-${now}`,
    role: 'user',
    text: content,
    updatedAt: now,
  }

  state.formalMessages[id] = normalizeList(state.formalMessages[id]).concat(nextMessage)
  target.preview = content
  target.updatedAt = now
  writeStorageState(state)
  return nextMessage
}

function getNoteStories() {
  return clone(sortByUpdatedAt(ensureState().noteStories))
}

function getNoteById(id) {
  const target = normalizeList(ensureState().noteStories).find((item) => item.noteId === id)
  return clone(target || null)
}

function markMerchantConversationRead(id) {
  const state = ensureState()
  const target = normalizeList(state.merchantConversations).find((item) => item.id === id)
  if (!target) return
  target.unread = 0
  writeStorageState(state)
}

function markPlatformSupportRead() {
  const state = ensureState()
  if (!state.platformSupportConversation) return
  state.platformSupportConversation.unread = 0
  writeStorageState(state)
}

function markBuddyApplicationRead(id) {
  const state = ensureState()
  const target = normalizeList(state.buddyApplications).find((item) => item.id === id)
  if (!target) return
  target.unread = 0
  writeStorageState(state)
}

function markFormalConversationRead(id) {
  const state = ensureState()
  const target = normalizeList(state.formalConversations).find((item) => item.id === id)
  if (!target) return
  target.unread = 0
  writeStorageState(state)
}

module.exports = {
  buildHomeRows,
  buildStoryList,
  formatConversationTime,
  getInteractiveList,
  markInteractionsRead,
  getMessageState,
  getNewFollowers,
  getMerchantConversations,
  getMerchantConversation,
  markMerchantConversationRead,
  sendMerchantMessage,
  getPlatformSupport,
  markPlatformSupportRead,
  sendPlatformSupportMessage,
  getPlatformGuarantees,
  getBuddyApplications,
  getBuddyApplication,
  createBuddyApplicationFromMatch,
  markBuddyApplicationRead,
  getNoteStories,
  getNoteById,
  replyToBuddyApplication,
  getFormalConversation,
  markFormalConversationRead,
  sendFormalMessage,
  setMessageState,
}
