const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const COLLECTION_NAME = 'knowledgeArticles'
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
  'redtour-001': 'redtour-shenjialing-gongjian-cover.jpg',
  'redtour-002': 'redtour-xuezhan-shenjialing-cover.jpg',
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

function normalizeKnowledgeCover(article = {}) {
  const cover = normalizeText(article.cover)
  if (/^(cloud|https?):\/\//i.test(cover)) {
    return cover
  }

  const coverFileName = getFileName(cover) || KNOWLEDGE_COVER_FILE_MAP[normalizeText(article._id)]
  return buildKnowledgeCoverFileID(coverFileName)
}

exports.main = async (event = {}) => {
  const id = normalizeText(event.id)
  if (!id) {
    return { ok: false, error: 'missing id' }
  }

  const docRes = await db.collection(COLLECTION_NAME).doc(id).get()
  const article = docRes.data || null
  if (!article || article.status !== 'published') {
    return { ok: false, error: 'article not found' }
  }

  await db.collection(COLLECTION_NAME).doc(id).update({
    data: {
      views: _.inc(1),
      updatedAt: new Date(),
    },
  })

  return {
    ok: true,
    data: {
      id: article._id,
      channel: normalizeText(article.channel) || 'agri',
      title: normalizeText(article.title),
      publishTime: normalizeText(article.publishTime),
      tags: normalizeArray(article.tags).filter(Boolean),
      wordCount: Number(article.wordCount) || 0,
      summary: normalizeText(article.summary),
      cover: normalizeKnowledgeCover(article),
      views: Number(article.views) + 1,
      likes: Number(article.likes) || 0,
      favorites: Number(article.favorites) || 0,
      comments: Number(article.comments) || 0,
      shareCount: Number(article.shareCount) || 0,
      author: normalizeText(article.author),
      content: normalizeArray(article.content),
      location: article.location || null,
      commentList: normalizeArray(article.commentList),
    },
  }
}
