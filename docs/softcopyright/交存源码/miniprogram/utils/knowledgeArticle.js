const { resolveMediaSource } = require('./mediaAssets')

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

function normalizeContentType(type = '') {
  const value = normalizeText(type).toLowerCase()
  if (value === 'h2' || value === 'heading') {
    return 'heading'
  }
  if (value === 'img' || value === 'image') {
    return 'image'
  }
  return 'paragraph'
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

  const coverFileName = getFileName(cover) || KNOWLEDGE_COVER_FILE_MAP[normalizeText(article.id)]
  return buildKnowledgeCoverFileID(coverFileName)
}

async function resolveKnowledgeArticleMedia(article = {}) {
  const content = await Promise.all(
    normalizeArray(article.content).map(async (item = {}) => {
      const type = normalizeContentType(item.type)
      if (type === 'image') {
        const src = await resolveMediaSource(item.src || item.image || '', '')
        return {
          ...item,
          type,
          src,
        }
      }

      return {
        ...item,
        type,
        text: normalizeText(item.text),
      }
    })
  )

  return {
    ...article,
    tags: normalizeArray(article.tags).filter(Boolean),
    cover: await resolveMediaSource(normalizeKnowledgeCover(article), ''),
    content,
  }
}

module.exports = {
  normalizeText,
  normalizeArray,
  normalizeContentType,
  normalizeKnowledgeCover,
  resolveKnowledgeArticleMedia,
}
