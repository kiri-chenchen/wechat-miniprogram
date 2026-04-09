const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLLECTION_NAME = 'knowledgeArticles'
const MAX_LIMIT = 100
const CLOUD_ENV_ID = 'cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845'
const CLOUD_KNOWLEDGE_COVER_PREFIX = `cloud://${CLOUD_ENV_ID}/knowledge/covers`
const KNOWLEDGE_COVER_FILE_MAP = {
  'agri-001': 'spring-vegetable.png',
  'agri-002': 'village-chicken.png',
  'agri-003': 'corn-disease.png',
  'agri-004': 'bee-guide.png',
  'agri-005': 'rice-brand.png',
  'culture-001': 'summer-palace.png',
  'culture-002': 'intangible-heritage.png',
  'culture-003': 'folk-custom.png',
  'culture-004': 'travel-tips.png',
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function getFileName(value = '') {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  const segments = normalized.split('/')
  return normalizeText(segments[segments.length - 1])
}

function buildKnowledgeCoverFileID(fileName = '') {
  const normalized = getFileName(fileName)
  return normalized ? `${CLOUD_KNOWLEDGE_COVER_PREFIX}/${normalized}` : ''
}

function normalizeKnowledgeCover(doc = {}) {
  const cover = normalizeText(doc.cover)
  if (/^(cloud|https?):\/\//i.test(cover)) {
    return cover
  }

  const coverFileName = getFileName(cover) || KNOWLEDGE_COVER_FILE_MAP[normalizeText(doc._id)]
  return buildKnowledgeCoverFileID(coverFileName)
}

function parseTime(value) {
  if (!value) {
    return 0
  }

  if (typeof value === 'number') {
    return value
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'string') {
    const timestamp = Date.parse(value.replace(/-/g, '/'))
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  if (typeof value === 'object') {
    if (typeof value.getTime === 'function') {
      return value.getTime()
    }
    if (value.$date) {
      return parseTime(value.$date)
    }
  }

  return 0
}

function buildListItem(doc = {}) {
  return {
    id: doc._id,
    channel: normalizeText(doc.channel) || 'agri',
    title: normalizeText(doc.title),
    publishTime: normalizeText(doc.publishTime),
    tags: normalizeArray(doc.tags).filter(Boolean),
    wordCount: Number(doc.wordCount) || 0,
    summary: normalizeText(doc.summary),
    cover: normalizeKnowledgeCover(doc),
    views: Number(doc.views) || 0,
    likes: Number(doc.likes) || 0,
    favorites: Number(doc.favorites) || 0,
    comments: Number(doc.comments) || 0,
    shareCount: Number(doc.shareCount) || 0,
    author: normalizeText(doc.author),
    location: doc.location || null,
  }
}

function sortArticles(list = []) {
  return [...list].sort((a, b) => {
    const pinnedDiff = Number(b.isPinned) - Number(a.isPinned)
    if (pinnedDiff !== 0) {
      return pinnedDiff
    }

    const timeDiff = parseTime(b.publishTime) - parseTime(a.publishTime)
    if (timeDiff !== 0) {
      return timeDiff
    }

    return parseTime(b.updatedAt) - parseTime(a.updatedAt)
  })
}

exports.main = async (event = {}) => {
  const channel = normalizeText(event.channel) || 'agri'
  const res = await db.collection(COLLECTION_NAME)
    .where({
      status: 'published',
      channel,
    })
    .limit(MAX_LIMIT)
    .get()

  const list = sortArticles(res.data || [])
  const categories = ['全部', ...new Set(
    list.flatMap((item) => normalizeArray(item.tags).filter(Boolean))
  )]

  return {
    ok: true,
    channel,
    categories,
    list: list.map(buildListItem),
  }
}
