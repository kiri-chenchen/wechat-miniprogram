const ACTIVITY_MEDIA_MAP = {
  'lz-yuzhong-strawberry-family-day': {
    aliases: ['榆中', '草莓', '亲子'],
    localCover: '/images/activities/lz-yuzhong-strawberry-family-day.jpg',
  },
  'lz-gaolan-country-photo-day': {
    aliases: ['皋兰', '田园', '摄影'],
    localCover: '/images/activities/lz-gaolan-country-photo-day.jpg',
  },
  'lz-yongdeng-rose-weekend': {
    aliases: ['永登', '玫瑰', '周末'],
    localCover: '/images/activities/lz-yongdeng-rose-weekend.jpg',
  },
  'lz-suburb-farm-study-camp': {
    aliases: ['近郊', '农事', '研学'],
    localCover: '/images/activities/lz-suburb-farm-study-camp.jpg',
  },
  'lz-bailihe-handmade-food-tour': {
    aliases: ['百合', '乡味', '手作'],
    localCover: '/images/activities/lz-bailihe-handmade-food-tour.jpg',
  },
  'lz-kushui-rose-culture-day': {
    aliases: ['苦水玫瑰', '玫瑰季', '非遗文化'],
    localCover: '/images/nav-academy.png',
  },
  'lz-kushui-danxia-hike-day': {
    aliases: ['苦水丹霞', '红色地貌', '轻徒步'],
    localCover: '/images/nav-academy.png',
  },
  'lz-xigu-baihe-culture-day': {
    aliases: ['西果园', '百合田园', '百合文化'],
    localCover: '/images/nav-academy.png',
  },
  'lz-gaolan-shichuan-pear-garden-day': {
    aliases: ['什川', '古梨园', '皋兰'],
    localCover: '/images/nav-academy.png',
  },
  'lz-qilihe-shenjialing-red-green-fusion': {
    aliases: ['沈家岭', '红绿融合', '红色研学'],
    localCover: '/images/nav-academy.png',
  },
  'lz-bali-huazhaizi-peach-garden': {
    aliases: ['花寨子', '世外桃园', '鲜桃采摘'],
    localCover: '/images/nav-academy.png',
  },
  'tianshui-qinan-fruit-pick-day': {
    aliases: ['天水', '秦安', '果园'],
    localCover: '/images/activities/tianshui-qinan-fruit-pick-day.jpg',
  },
  'zhangye-rural-homestay-weekend': {
    aliases: ['张掖', '民宿', '乡野'],
    localCover: '/images/activities/zhangye-rural-homestay-weekend.jpg',
  },
  'longnan-tea-hill-folk-experience': {
    aliases: ['陇南', '茶山', '民俗'],
    localCover: '/images/activities/longnan-tea-hill-folk-experience.jpg',
  },
  'linxia-food-culture-village-tour': {
    aliases: ['临夏', '美食', '文化'],
    localCover: '/images/activities/linxia-food-culture-village-tour.jpg',
  },
  'gannan-ranch-life-light-tour': {
    aliases: ['甘南', '草原', '牧场'],
    localCover: '/images/activities/gannan-ranch-life-light-tour.jpg',
    cloudCover: 'cloud://cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845/activities/covers/gannan-ranch-life-light-tour.jpg',
    cloudBanner: 'cloud://cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845/activities/banners/gannan-ranch-life-light-tour.jpg',
    cloudGallery: [
      'cloud://cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845/activities/gallery/gannan-ranch-life-light-tour-1.jpg',
      'cloud://cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845/activities/gallery/gannan-ranch-life-light-tour-2.jpg',
    ],
  },
}

const DEFAULT_ACTIVITY_KEY = 'lz-yuzhong-strawberry-family-day'
const CLOUD_FILE_CACHE = Object.create(null)
const CLOUD_ACTIVITY_PREFIX = 'cloud://cloud1-3ghmr5ki7b1172fe.636c-cloud1-3ghmr5ki7b1172fe-1403917845/activities'
const MAX_GALLERY_COUNT = 6

function normalizeText(value = '') {
  return String(value || '').trim()
}

function isLocalMedia(src = '') {
  return normalizeText(src).startsWith('/images/')
}

function isRemoteMedia(src = '') {
  return /^https?:\/\//i.test(normalizeText(src))
}

function isCloudFileId(src = '') {
  return /^cloud:\/\//i.test(normalizeText(src))
}

function isRenderableMedia(src = '') {
  return isLocalMedia(src) || isRemoteMedia(src)
}

function findActivityKey(activity = {}) {
  const seedKey = normalizeText(activity.seedKey)
  if (seedKey && ACTIVITY_MEDIA_MAP[seedKey]) {
    return seedKey
  }

  const title = normalizeText(activity.title)
  if (!title) {
    return DEFAULT_ACTIVITY_KEY
  }

  const matchedKey = Object.keys(ACTIVITY_MEDIA_MAP).find((key) => {
    const aliases = ACTIVITY_MEDIA_MAP[key].aliases || []
    return aliases.some((alias) => title.includes(alias))
  })

  return matchedKey || DEFAULT_ACTIVITY_KEY
}

function getActivityMediaConfig(activity = {}) {
  const key = typeof activity === 'string' ? activity : findActivityKey(activity)
  const config = ACTIVITY_MEDIA_MAP[key] || ACTIVITY_MEDIA_MAP[DEFAULT_ACTIVITY_KEY]
  return {
    key,
    ...config,
  }
}

function buildCloudCover(key) {
  return `${CLOUD_ACTIVITY_PREFIX}/covers/${key}.jpg`
}

function buildCloudBanner(key) {
  return `${CLOUD_ACTIVITY_PREFIX}/banners/${key}.jpg`
}

function buildCloudGallery(key) {
  return Array.from({ length: MAX_GALLERY_COUNT }, (_, index) =>
    `${CLOUD_ACTIVITY_PREFIX}/gallery/${key}-${index + 1}.jpg`
  )
}

function getRawActivityCover(activity = {}) {
  const config = getActivityMediaConfig(activity)
  return config.cloudCover || buildCloudCover(config.key)
}

function getRawActivityBanner(activity = {}) {
  const config = getActivityMediaConfig(activity)
  return config.cloudBanner || buildCloudBanner(config.key)
}

function getRawActivityGallery(activity = {}) {
  const config = getActivityMediaConfig(activity)
  return (Array.isArray(config.cloudGallery) && config.cloudGallery.length)
    ? config.cloudGallery
    : buildCloudGallery(config.key)
}

function resolveCloudFile(fileID) {
  if (!fileID) {
    return Promise.resolve('')
  }

  if (CLOUD_FILE_CACHE[fileID]) {
    return Promise.resolve(CLOUD_FILE_CACHE[fileID])
  }

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => {
        const fileInfo = (((res || {}).fileList || [])[0] || {})
        const tempUrl = fileInfo.tempFileURL || ''
        console.log('[mediaAssets] getTempFileURL success', {
          fileID,
          fileInfo,
          status: fileInfo.status,
          errMsg: fileInfo.errMsg,
          code: fileInfo.code,
          message: fileInfo.message,
          tempFileURL: tempUrl,
        })
        if (tempUrl && fileInfo.status !== -1) {
          CLOUD_FILE_CACHE[fileID] = tempUrl
        }
        resolve(tempUrl || '')
      },
      fail: (err) => {
        console.error('[mediaAssets] getTempFileURL fail', {
          fileID,
          err,
        })
        resolve('')
      },
    })
  })
}

async function resolveMediaSource(src, fallback = '') {
  const value = normalizeText(src)
  if (!value) {
    return fallback
  }

  if (isRenderableMedia(value)) {
    return value
  }

  if (isCloudFileId(value)) {
    const tempUrl = await resolveCloudFile(value)
    return tempUrl || fallback
  }

  return fallback
}

async function resolveMediaList(list = [], fallback = '') {
  const resolved = await Promise.all((list || []).map((item) => resolveMediaSource(item, '')))
  const filtered = resolved.filter(Boolean)
  return filtered.length ? filtered : (fallback ? [fallback] : [])
}

async function resolveActivityCover(activity = {}) {
  const config = getActivityMediaConfig(activity)
  const fallback = config.localCover || ACTIVITY_MEDIA_MAP[DEFAULT_ACTIVITY_KEY].localCover
  const raw = getRawActivityCover(activity)
  return resolveMediaSource(raw, fallback)
}

async function resolveActivityBanner(activity = {}) {
  const fallback = await resolveActivityCover(activity)
  return resolveMediaSource(getRawActivityBanner(activity), fallback)
}

async function resolveActivityGallery(activity = {}) {
  const fallback = await resolveActivityCover(activity)
  const rawGallery = getRawActivityGallery(activity)
  const gallery = await resolveMediaList(rawGallery, fallback)
  console.log('[mediaAssets] resolveActivityGallery', {
    key: getActivityMediaConfig(activity).key,
    rawGallery,
    resolvedCount: gallery.length,
    gallery,
  })
  return gallery
}

module.exports = {
  ACTIVITY_MEDIA_MAP,
  getActivityMediaConfig,
  isLocalMedia,
  isRemoteMedia,
  isCloudFileId,
  isRenderableMedia,
  resolveMediaSource,
  resolveMediaList,
  resolveActivityCover,
  resolveActivityBanner,
  resolveActivityGallery,
}
