const FAVORITES_KEY = 'unifiedFavorites'
const FOOTPRINTS_KEY = 'unifiedFootprints'

const CATEGORY_ALL = 'all'
const CITY_ALL = 'all'

const TYPE_CONFIG = {
  activity: {
    label: '活动',
    path: '/pages/activityDetail/activityDetail',
  },
  product: {
    label: '商品',
    path: '/pages/productDetail/productDetail',
  },
  scenic: {
    label: '景点',
    path: '/pages/scenicDetail/scenicDetail',
  },
  hotel: {
    label: '酒店/民宿',
    path: '/pages/hotelDetail/hotelDetail',
  },
  knowledge: {
    label: '推文',
    path: '/pages/knowledgeDetail/knowledgeDetail',
  },
}

function safeList(value) {
  return Array.isArray(value) ? value : []
}

function getStorageList(key) {
  try {
    return safeList(wx.getStorageSync(key))
  } catch (error) {
    console.error('[collectionStore] getStorageList failed', key, error)
    return []
  }
}

function setStorageList(key, list) {
  try {
    wx.setStorageSync(key, safeList(list))
  } catch (error) {
    console.error('[collectionStore] setStorageList failed', key, error)
  }
}

function sortByLatest(list, fieldName) {
  return safeList(list).sort((left, right) => Number(right[fieldName] || 0) - Number(left[fieldName] || 0))
}

function buildKey(type, id) {
  return `${type || ''}::${id || ''}`
}

function createTargetUrl(type, id) {
  const config = TYPE_CONFIG[type] || {}
  return config.path && id ? `${config.path}?id=${id}` : ''
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeRecord(input = {}) {
  const type = normalizeText(input.type)
  const id = normalizeText(input.id)
  const config = TYPE_CONFIG[type] || {}
  const key = buildKey(type, id)
  const normalizedBadgeText = normalizeText(input.badgeText)
  const badgeText = type === 'knowledge'
    ? config.label
    : (normalizedBadgeText || config.label || '')

  return {
    key,
    type,
    id,
    categoryLabel: config.label || '',
    title: normalizeText(input.title) || '未命名内容',
    cover: normalizeText(input.cover),
    city: normalizeText(input.city) || '未知城市',
    regionText: normalizeText(input.regionText),
    summary: normalizeText(input.summary),
    priceText: normalizeText(input.priceText),
    metaText: normalizeText(input.metaText),
    badgeText,
    author: normalizeText(input.author),
    statsText: normalizeText(input.statsText),
    scoreText: normalizeText(input.scoreText),
    targetUrl: normalizeText(input.targetUrl) || createTargetUrl(type, id),
    updatedAt: Number(input.updatedAt || 0),
    favoritedAt: Number(input.favoritedAt || 0),
    visitedAt: Number(input.visitedAt || 0),
  }
}

function getFavorites() {
  return sortByLatest(
    getStorageList(FAVORITES_KEY).map((item) => normalizeRecord(item)),
    'favoritedAt'
  )
}

function getFootprints() {
  return sortByLatest(
    getStorageList(FOOTPRINTS_KEY).map((item) => normalizeRecord(item)),
    'visitedAt'
  )
}

function isFavorited(type, id) {
  const targetKey = buildKey(type, id)
  return getFavorites().some((item) => item.key === targetKey)
}

function toggleFavorite(record = {}) {
  const normalized = normalizeRecord(record)
  const currentList = getFavorites()
  const exists = currentList.some((item) => item.key === normalized.key)

  if (exists) {
    const nextList = currentList.filter((item) => item.key !== normalized.key)
    setStorageList(FAVORITES_KEY, nextList)
    return false
  }

  const nextItem = {
    ...normalized,
    favoritedAt: Date.now(),
    updatedAt: Date.now(),
  }
  const nextList = [nextItem, ...currentList.filter((item) => item.key !== normalized.key)]
  setStorageList(FAVORITES_KEY, nextList)
  return true
}

function recordFootprint(record = {}) {
  const normalized = normalizeRecord(record)
  if (!normalized.type || !normalized.id) {
    return
  }

  const currentList = getFootprints().filter((item) => item.key !== normalized.key)
  const nextItem = {
    ...normalized,
    visitedAt: Date.now(),
    updatedAt: Date.now(),
  }
  setStorageList(FOOTPRINTS_KEY, [nextItem, ...currentList])
}

function clearFootprints() {
  setStorageList(FOOTPRINTS_KEY, [])
}

function deleteFavorites(keys = []) {
  const keySet = new Set(safeList(keys).filter(Boolean))
  if (!keySet.size) {
    return
  }

  const nextList = getFavorites().filter((item) => !keySet.has(item.key))
  setStorageList(FAVORITES_KEY, nextList)
}

module.exports = {
  CATEGORY_ALL,
  CITY_ALL,
  TYPE_CONFIG,
  getFavorites,
  getFootprints,
  isFavorited,
  toggleFavorite,
  deleteFavorites,
  recordFootprint,
  clearFootprints,
}
