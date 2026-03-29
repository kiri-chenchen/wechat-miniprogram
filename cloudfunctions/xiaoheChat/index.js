// Legacy lightweight implementation.
// The only formal mainline for YuXiaoHe is cloudfunctions/agent-yuxiaohe-1grmumm967563411.
// Keep this file only for migration reference or temporary compatibility. Do not continue feature expansion here.

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_COVER = '/images/activities/lz-yuzhong-strawberry-family-day.jpg'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase()
}

function buildSearchTokens(question) {
  const normalized = normalizeText(question)
  if (!normalized) return []

  const tokens = normalized
    .replace(/[，。！？、,.!?/\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return Array.from(new Set([normalized].concat(tokens)))
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function joinSearchText(activity) {
  return [
    activity.title,
    activity.summary,
    activity.content,
    activity.detail,
    activity.locationName,
    activity.province,
    activity.city,
    activity.district
  ]
    .concat(normalizeArray(activity.tags))
    .concat(normalizeArray(activity.travelModeTags))
    .concat(normalizeArray(activity.playTags))
    .concat(normalizeArray(activity.suitableGroups))
    .join(' ')
}

function scoreActivity(activity, input) {
  const haystack = normalizeLowerText(joinSearchText(activity))
  let score = 0

  input.tokens.forEach((token) => {
    const lowerToken = normalizeLowerText(token)
    if (!lowerToken) return
    if (haystack.includes(lowerToken)) score += lowerToken.length > 3 ? 4 : 2
  })

  const city = normalizeLowerText(input.location.city)
  const district = normalizeLowerText(input.location.district)
  if (city && haystack.includes(city)) score += 3
  if (district && haystack.includes(district)) score += 2

  normalizeArray(input.userProfile.dnaTags).forEach((tag) => {
    const lowerTag = normalizeLowerText(tag)
    if (lowerTag && haystack.includes(lowerTag)) score += 1
  })

  if (input.preferences.distance === 'near') score += 1
  if (input.preferences.budget === 'value' || input.preferences.budget === '高性价比') {
    const price = Number(activity.priceFrom || activity.price || 0)
    if (price && price <= 300) score += 1
  }

  return score
}

function mapCard(activity) {
  const tags = normalizeArray(activity.tags).slice(0, 3)
  const price = Number(activity.priceFrom || activity.price || 0)
  return {
    id: activity._id || activity.id || '',
    type: 'activity',
    title: activity.title || '农旅活动',
    summary: activity.summary || activity.content || '',
    priceText: price ? `¥${price}起` : '价格待定',
    regionText: [activity.province, activity.city, activity.district].filter(Boolean).join(' · '),
    tags,
    cover: activity.cover || DEFAULT_COVER
  }
}

function buildGuessQuestions(question, cards) {
  const base = [
    '有没有更近一点的活动？',
    '还有更适合周末的推荐吗？',
    '能再推荐性价比高一点的吗？'
  ]

  if (cards.length && normalizeLowerText(question).includes('亲子')) {
    return [
      '还有适合亲子的其他选择吗？',
      '有没有当天往返更轻松的活动？',
      '能再推荐孩子会更喜欢的吗？'
    ]
  }

  if (cards.length && normalizeLowerText(question).includes('拍照')) {
    return [
      '还有更适合拍照打卡的吗？',
      '有没有风景更开阔一点的？',
      '能再推荐人少一点的吗？'
    ]
  }

  return base
}

function buildAnswer(question, cards, input) {
  if (!cards.length) {
    const locationText = [input.location.city, input.location.district].filter(Boolean).join('')
    return locationText
      ? `我先按你当前的问题和${locationText}附近的范围帮你看了一圈，暂时没有找到特别贴合的活动。你可以换个更具体的问法，比如亲子、采摘、周末短途或摄影打卡，小禾再继续帮你找。`
      : '我先按你当前的问题帮你筛了一轮，暂时没有找到特别贴合的活动。你可以把地区、玩法偏好或出行人群再说具体一点，小禾继续帮你缩小范围。'
  }

  const top = cards[0]
  const locationText = input.location.city || '附近'
  const dnaHint = normalizeArray(input.userProfile.dnaTags).slice(0, 2).join('、')
  const preferenceHint = []

  if (input.preferences.distance === 'near') preferenceHint.push('尽量离你更近')
  if (input.preferences.budget === 'value' || input.preferences.budget === '高性价比') preferenceHint.push('性价比更高')
  if (input.preferences.detailLevel === '详细') preferenceHint.push('体验信息更完整')

  const preferenceText = preferenceHint.length ? `，也优先参考了“${preferenceHint.join('、')}”这些偏好` : ''
  const dnaText = dnaHint ? `，再结合你最近的偏好标签“${dnaHint}”` : ''

  if (cards.length === 1) {
    return `我先帮你在${locationText}附近筛到一条更贴合的问题结果${dnaText}${preferenceText}。像“${top.title}”这类活动会更适合现在这个需求，既有在地体验，也比较适合直接安排进接下来的行程里。`
  }

  return `我先帮你在${locationText}附近挑了几条更贴近的问题结果${dnaText}${preferenceText}。这几项活动的玩法方向比较接近你现在想找的内容，你可以先从最感兴趣的一条看起，小禾也可以继续帮你再缩小范围。`
}

function buildTips(cards, input) {
  if (!cards.length) {
    return '可以试着补充地区、预算或偏好关键词，这样小禾更容易帮你缩小范围。'
  }

  if (input.preferences.distance === 'near') {
    return '如果你更在意当天往返，可以继续告诉小禾“更近一点”或“只看周末短途”。'
  }

  return '如果你已经有大概预算或出行人群，也可以继续告诉小禾，我会把推荐再收得更准一些。'
}

function buildGenericResult(input, candidates) {
  const cards = candidates.slice(0, 3).map(mapCard)
  return {
    answer: buildAnswer(input.question, cards, input),
    cards,
    tips: buildTips(cards, input),
    guessQuestions: buildGuessQuestions(input.question, cards),
    followUp: cards.length ? '如果你愿意，我还可以继续按距离、预算或玩法偏好帮你再缩小范围。' : ''
  }
}

async function getActivityCandidates(input) {
  const collection = db.collection('activities')
  const res = await collection.limit(50).get()
  const list = res.data || []
  const scored = list
    .map((activity) => ({
      activity,
      score: scoreActivity(activity, input)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.activity)

  return scored.length ? scored : list.slice(0, 6)
}

exports.main = async (event) => {
  console.warn('[xiaoheChat] legacy implementation invoked; mainline agent service should be preferred')
  const mode = event.mode || 'generic'

  if (mode !== 'generic') {
    return {
      success: false,
      errorCode: 'MODE_NOT_READY',
      message: '当前模式的裕小禾能力还在接入中'
    }
  }

  const input = {
    question: normalizeText(event.question),
    location: event.location || {},
    userProfile: event.userProfile || {},
    preferences: event.preferences || {}
  }

  if (!input.question) {
    return {
      success: false,
      errorCode: 'EMPTY_QUESTION',
      message: '问题不能为空'
    }
  }

  input.tokens = buildSearchTokens(input.question)

  try {
    const candidates = await getActivityCandidates(input)
    const result = buildGenericResult(input, candidates)
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('[xiaoheChat] generic failed', error)
    return {
      success: false,
      errorCode: 'AI_REQUEST_FAILED',
      message: '调用裕小禾失败'
    }
  }
}
