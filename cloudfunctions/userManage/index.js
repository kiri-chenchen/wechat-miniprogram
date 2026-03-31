const https = require('https')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const TENCENT_MAP_KEY = process.env.TENCENT_MAP_KEY || process.env.QQ_MAP_KEY || ''

async function getCurrentUserRecord() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('users').where({ openid: OPENID }).limit(1).get()

  if (!res.data.length) {
    return null
  }

  return res.data[0]
}

async function saveAndFetchUser(userId, data) {
  await db.collection('users').doc(userId).update({
    data: {
      ...data,
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('users').doc(userId).get()
  return fresh.data
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : []
}

function uniqueList(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)))
}

function trimRegionSuffix(value) {
  return normalizeText(value).replace(/(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/u, '')
}

function getSharedTags(currentUser = {}, candidate = {}) {
  const currentTags = new Set(normalizeArray(currentUser.dnaTags))
  return normalizeArray(candidate.dnaTags).filter((tag) => currentTags.has(tag))
}

function deriveBuddyTagsFromIntent(intent = {}) {
  const normalized = normalizeBuddyIntent(intent)
  const tags = []

  if (normalized.buddyType === 'casual') tags.push('周末同游')
  if (normalized.buddyType === 'photo') tags.push('摄影搭子')
  if (normalized.buddyType === 'parent_child') tags.push('亲子搭子')
  if (normalized.buddyType === 'free_travel') tags.push('自由行搭子')
  if (normalized.acceptCarpool === 'yes') tags.push('接受拼车')
  if (normalized.groupPreference === 'two') tags.push('两人同行')
  if (normalized.groupPreference === 'small_group') tags.push('3-4人小团')
  if (normalized.groupPreference === 'flexible') tags.push('人数灵活')

  return uniqueList(tags)
}

function getBuddyTags(user = {}) {
  const directTags = normalizeArray(user.buddyTags)
  if (directTags.length) {
    return directTags
  }
  return deriveBuddyTagsFromIntent(user.buddyIntent)
}

function getSharedBuddyTags(currentUser = {}, candidate = {}) {
  const currentTags = new Set(getBuddyTags(currentUser))
  return getBuddyTags(candidate).filter((tag) => currentTags.has(tag))
}

function buildBuddyExplanation(currentUser = {}, candidate = {}, sharedTags = []) {
  const parts = []
  const sharedBuddyTags = getSharedBuddyTags(currentUser, candidate)
  const currentCity = trimRegionSuffix(currentUser.city)
  const candidateCity = trimRegionSuffix(candidate.city)
  const currentProvince = trimRegionSuffix(currentUser.province)
  const candidateProvince = trimRegionSuffix(candidate.province)

  if (currentCity && candidateCity && currentCity === candidateCity) {
    parts.push('同城')
  } else if (currentProvince && candidateProvince && currentProvince === candidateProvince) {
    parts.push('同省')
  }

  if (sharedBuddyTags.length) {
    parts.push(`搭子标签重合 ${Math.min(sharedBuddyTags.length, 3)} 项`)
  }

  if (sharedTags.length) {
    parts.push(`DNA 标签重合 ${Math.min(sharedTags.length, 3)} 项`)
  }

  if (candidate.profileCompleted && candidate.dnaCompleted) {
    parts.push('资料较完整')
  }

  return parts
}

function buildBuddyRealSummary(candidate = {}) {
  const buddyTags = getBuddyTags(candidate)
  if (buddyTags.length) {
    return `真实标签：${buddyTags.slice(0, 3).join('、')}`
  }

  const cityText = trimRegionSuffix(candidate.city) || trimRegionSuffix(candidate.province) || ''
  if (cityText) {
    return `真实资料：来自${cityText}`
  }

  return '以下展示的是该用户已填写的公开资料，以及系统基于资料生成的匹配结果。'
}

function getAgeFromBirthDate(value) {
  const text = normalizeText(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDiff = now.getMonth() - date.getMonth()
  const dayDiff = now.getDate() - date.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }
  return age >= 0 ? age : null
}

function getAgeRangeLabel(age) {
  if (age === null) return ''
  if (age < 18) return '18岁以下'
  if (age < 25) return '18-24岁'
  if (age < 35) return '25-34岁'
  if (age < 45) return '35-44岁'
  if (age < 60) return '45-59岁'
  return '60岁以上'
}

function inferBuddyType(tags = []) {
  const joined = normalizeArray(tags).join(' ')
  if (joined.includes('亲子')) return '亲子搭子'
  if (joined.includes('摄影')) return '摄影搭子'
  if (joined.includes('自由行') || joined.includes('独自旅行')) return '自由行搭子'
  if (joined.includes('团队') || joined.includes('老友')) return '周末同游搭子'
  return '轻同行搭子'
}

function getBuddyTypeLabel(value) {
  const map = {
    casual: '周末同游搭子',
    photo: '摄影搭子',
    parent_child: '亲子搭子',
    free_travel: '自由行搭子',
  }
  return map[normalizeText(value)] || ''
}

function pickStatusTag(currentUser = {}, candidate = {}, sharedTags = []) {
  const currentCity = trimRegionSuffix(currentUser.city)
  const candidateCity = trimRegionSuffix(candidate.city)
  if (currentCity && candidateCity && currentCity === candidateCity) {
    return '同城更容易约'
  }

  if (sharedTags.length >= 2) {
    return `${sharedTags.slice(0, 2).join(' · ')}`
  }

  return '偏好接近'
}

function buildBuddySummary(candidate = {}, sharedTags = []) {
  const cityText = trimRegionSuffix(candidate.city) || trimRegionSuffix(candidate.province) || '同区域'
  const tags = normalizeArray(candidate.dnaTags)
  const focusTags = sharedTags.length ? sharedTags : tags.slice(0, 3)
  const buddyType = inferBuddyType(focusTags)
  const tagText = focusTags.length ? focusTags.join('、') : '周末轻同行'
  return `来自${cityText}，更偏向${tagText}，适合先从${buddyType}开始沟通。`
}

function buildMatchReason(currentUser = {}, candidate = {}, sharedTags = []) {
  const reasons = []
  const currentCity = trimRegionSuffix(currentUser.city)
  const candidateCity = trimRegionSuffix(candidate.city)
  const currentProvince = trimRegionSuffix(currentUser.province)
  const candidateProvince = trimRegionSuffix(candidate.province)

  if (currentCity && candidateCity && currentCity === candidateCity) {
    reasons.push('你们在同一城市，线下集合成本更低')
  } else if (currentProvince && candidateProvince && currentProvince === candidateProvince) {
    reasons.push('你们在同一省内，出发区域相对接近')
  }

  if (sharedTags.length) {
    reasons.push(`DNA标签有重合：${sharedTags.slice(0, 3).join('、')}`)
  }

  const candidateAge = getAgeFromBirthDate(candidate.birthDate)
  const currentAge = getAgeFromBirthDate(currentUser.birthDate)
  if (candidateAge !== null && currentAge !== null && Math.abs(candidateAge - currentAge) <= 8) {
    reasons.push('年龄阶段接近，出行节奏可能更一致')
  }

  return reasons.slice(0, 2).join('；') || '基础资料和偏好方向比较接近，适合先发起一次轻量沟通。'
}

function buildBuddyOpeningText(question, candidate = {}, sharedTags = []) {
  const text = normalizeText(question)
  const title = inferBuddyType(sharedTags.length ? sharedTags : normalizeArray(candidate.dnaTags))
  if (text) {
    return `你好，我正在找“${text}”方向的同行搭子，看到我们偏好挺接近，想先和你聊聊是否方便一起出发。`
  }
  return `你好，我想找一位${title}，看到我们资料和偏好比较接近，想先认识一下。`
}

function normalizeBuddyIntent(input = {}) {
  return {
    availability: normalizeText(input.availability),
    buddyType: normalizeText(input.buddyType),
    acceptCarpool: normalizeText(input.acceptCarpool),
    groupPreference: normalizeText(input.groupPreference),
  }
}

function buildBuddyIntentFromTags(tags = []) {
  const list = normalizeArray(tags)

  return normalizeBuddyIntent({
    availability: '',
    buddyType: list.includes('摄影搭子')
      ? 'photo'
      : list.includes('亲子搭子')
        ? 'parent_child'
        : list.includes('自由行搭子')
          ? 'free_travel'
          : list.includes('周末同游')
            ? 'casual'
            : '',
    acceptCarpool: list.includes('接受拼车') ? 'yes' : '',
    groupPreference: list.includes('两人同行')
      ? 'two'
      : list.includes('3-4人小团')
        ? 'small_group'
        : list.includes('人数灵活')
          ? 'flexible'
          : '',
  })
}

function isBuddyIntentCompleted(intent = {}) {
  const normalized = normalizeBuddyIntent(intent)
  return !!(
    normalized.availability &&
    normalized.buddyType &&
    normalized.acceptCarpool &&
    normalized.groupPreference
  )
}

function getQuestionIntentTokens(question = '') {
  const text = normalizeText(question)
  const tokens = []
  if (text.includes('周六')) tokens.push('saturday')
  if (text.includes('周日')) tokens.push('sunday')
  if (text.includes('周末')) tokens.push('weekend')
  if (text.includes('摄影')) tokens.push('photo')
  if (text.includes('亲子')) tokens.push('parent_child')
  if (text.includes('拼车')) tokens.push('carpool_yes')
  if (text.includes('两个人') || text.includes('2人')) tokens.push('group_two')
  if (text.includes('小团') || text.includes('3') || text.includes('4')) tokens.push('group_small')
  return tokens
}

function scoreBuddyCandidate(currentUser = {}, candidate = {}, question = '') {
  let score = 45
  const sharedTags = getSharedTags(currentUser, candidate)
  const currentIntent = normalizeBuddyIntent(currentUser.buddyIntent)
  const candidateIntent = normalizeBuddyIntent(candidate.buddyIntent)
  const questionTokens = getQuestionIntentTokens(question)
  score += Math.min(sharedTags.length * 14, 42)

  const currentCity = trimRegionSuffix(currentUser.city)
  const candidateCity = trimRegionSuffix(candidate.city)
  const currentProvince = trimRegionSuffix(currentUser.province)
  const candidateProvince = trimRegionSuffix(candidate.province)

  if (currentCity && candidateCity && currentCity === candidateCity) {
    score += 24
  } else if (currentProvince && candidateProvince && currentProvince === candidateProvince) {
    score += 14
  }

  if (candidate.profileCompleted) score += 4
  if (candidate.dnaCompleted) score += 4
  if (candidate.buddyIntentCompleted) score += 10
  if (normalizeText(candidate.avatarUrl)) score += 3
  if (normalizeText(candidate.nickName)) score += 3

  const currentAge = getAgeFromBirthDate(currentUser.birthDate)
  const candidateAge = getAgeFromBirthDate(candidate.birthDate)
  if (currentAge !== null && candidateAge !== null) {
    const diff = Math.abs(currentAge - candidateAge)
    if (diff <= 5) score += 8
    else if (diff <= 10) score += 4
  }

  const candidateText = normalizeArray(candidate.dnaTags).join(' ')
  normalizeArray(String(question || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/gu)).forEach((token) => {
    if (candidateText.includes(token)) {
      score += 5
    }
  })

  if (currentIntent.availability && candidateIntent.availability && currentIntent.availability === candidateIntent.availability) {
    score += 10
  }
  if (currentIntent.buddyType && candidateIntent.buddyType && currentIntent.buddyType === candidateIntent.buddyType) {
    score += 12
  }
  if (currentIntent.acceptCarpool && candidateIntent.acceptCarpool && currentIntent.acceptCarpool === candidateIntent.acceptCarpool) {
    score += 8
  }
  if (currentIntent.groupPreference && candidateIntent.groupPreference && currentIntent.groupPreference === candidateIntent.groupPreference) {
    score += 8
  }

  if (questionTokens.includes('saturday') && candidateIntent.availability === 'saturday') score += 10
  if (questionTokens.includes('sunday') && candidateIntent.availability === 'sunday') score += 10
  if (questionTokens.includes('weekend') && (candidateIntent.availability === 'weekend' || candidateIntent.availability === 'flexible')) score += 8
  if (questionTokens.includes('photo') && candidateIntent.buddyType === 'photo') score += 12
  if (questionTokens.includes('parent_child') && candidateIntent.buddyType === 'parent_child') score += 12
  if (questionTokens.includes('carpool_yes') && candidateIntent.acceptCarpool === 'yes') score += 10
  if (questionTokens.includes('group_two') && candidateIntent.groupPreference === 'two') score += 8
  if (questionTokens.includes('group_small') && candidateIntent.groupPreference === 'small_group') score += 8

  return Math.min(score, 98)
}

function buildBuddyCandidate(currentUser = {}, candidate = {}, question = '') {
  const sharedTags = getSharedTags(currentUser, candidate)
  const score = scoreBuddyCandidate(currentUser, candidate, question)
  const candidateIntent = normalizeBuddyIntent(candidate.buddyIntent)
  const cityText = trimRegionSuffix(candidate.city) || trimRegionSuffix(candidate.province) || '同区域'
  const ageText = getAgeRangeLabel(getAgeFromBirthDate(candidate.birthDate))
  const tags = uniqueList(sharedTags.concat(normalizeArray(candidate.dnaTags))).slice(0, 4)
  const practicalInfo = [
    { label: '所在地区', value: cityText },
    { label: '同行类型', value: getBuddyTypeLabel(candidateIntent.buddyType) || inferBuddyType(tags) },
  ]

  if (candidateIntent.availability) {
    const availabilityMap = {
      saturday: '周六更方便',
      sunday: '周日更方便',
      weekend: '周末都可以',
      flexible: '时间较灵活',
    }
    practicalInfo.push({ label: '可同行时间', value: availabilityMap[candidateIntent.availability] || candidateIntent.availability })
  }

  if (candidateIntent.acceptCarpool) {
    practicalInfo.push({
      label: '是否接受拼车',
      value: candidateIntent.acceptCarpool === 'yes' ? '接受拼车' : '暂不拼车',
    })
  }

  if (ageText) {
    practicalInfo.push({ label: '年龄阶段', value: ageText })
  }

  return {
    id: candidate._id,
    sourceId: candidate._id,
    userName: normalizeText(candidate.nickName) || '同行旅友',
    avatarUrl: normalizeText(candidate.avatarUrl),
    avatarText: (normalizeText(candidate.nickName) || '搭').slice(0, 1),
    avatarColor: '#6e89ff',
    matchScore: score,
    matchScoreText: `匹配度 ${score}%`,
    statusTag: '',
    summary: buildBuddyRealSummary(candidate),
    matchReason: `系统匹配说明：${buildBuddyExplanation(currentUser, candidate, sharedTags).join(' + ') || '已根据地区、已填写标签和资料完整度完成匹配'}`,
    tags,
    playItems: uniqueList([
      `共同偏好：${sharedTags.length ? sharedTags.slice(0, 3).join('、') : '还在建立中'}`,
      `资料完整度：${candidate.profileCompleted && candidate.dnaCompleted ? '较完整' : '待继续完善'}`,
      candidateIntent.groupPreference === 'two' ? '更偏好两人同行' : '',
      candidateIntent.groupPreference === 'small_group' ? '更偏好3-4人小团' : '',
    ]).filter(Boolean),
    practicalInfo,
    actionText: '发起搭子申请',
    openingText: buildBuddyOpeningText(question, candidate, sharedTags),
  }
}

function buildDisplayName({ displayName, poiTitle, district, city, province, locationText }) {
  return (
    normalizeText(displayName) ||
    normalizeText(poiTitle) ||
    stripAdminPrefix(normalizeText(locationText)) ||
    normalizeText(district) ||
    normalizeText(city) ||
    normalizeText(province) ||
    normalizeText(locationText)
  )
}

function stripAdminPrefix(text) {
  const raw = normalizeText(text)
  if (!raw) return ''
  return raw.replace(/^(?:(?:[\u4e00-\u9fa5]{2,12})(?:省|特别行政区|自治州|地区|盟|市|区|县)){1,4}/u, '')
}

function scorePoi(item = {}) {
  const title = normalizeText(item.title || item.name)
  if (!title) {
    return -999
  }

  let score = 0
  if (/(大学|学院|校区|广场|商场|中心|公园|景区|小区|公寓|影城|影院|酒店|民宿|站)$/u.test(title)) score += 12
  if (/(人民政府|政府|居委会|村委会|街道办|派出所|卫生院)$/u.test(title)) score -= 8
  if (/(镇|村)$/u.test(title)) score += 4
  if (title.length <= 16) score += 3
  if (title.length >= 24) score -= 2

  const distance = normalizeNumber(item._distance || item.distance)
  if (distance !== null) {
    score += Math.max(0, 6 - distance / 200)
  }

  return score
}

function pickBestPoi(pois = []) {
  if (!Array.isArray(pois) || !pois.length) {
    return {}
  }

  return pois
    .map((item) => ({ item, score: scorePoi(item) }))
    .sort((a, b) => b.score - a.score)[0].item || {}
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key)
}

async function reverseGeocodeByTencentMap(location) {
  if (!TENCENT_MAP_KEY) {
    console.warn('[userManage] TENCENT_MAP_KEY missing, skip reverse geocode')
    return null
  }

  const latitude = normalizeNumber(location && location.latitude)
  const longitude = normalizeNumber(location && location.longitude)
  if (latitude === null || longitude === null) {
    return null
  }

  const url =
    'https://apis.map.qq.com/ws/geocoder/v1/?output=json&get_poi=1' +
    '&poi_options=policy=5;radius=1000;page_size=5;page_index=1' +
    `&location=${encodeURIComponent(`${latitude},${longitude}`)}` +
    `&key=${encodeURIComponent(TENCENT_MAP_KEY)}`

  const result = await requestJson(url)
  if (!result || result.status !== 0 || !result.result) {
    console.warn('[userManage] reverse geocode failed', result)
    return null
  }

  const addressComponent = result.result.address_component || {}
  const adInfo = result.result.ad_info || {}
  const pois = Array.isArray(result.result.pois) ? result.result.pois : []
  const nearestPoi = pickBestPoi(pois)
  const poiTitle =
    stripAdminPrefix(normalizeText(nearestPoi.title) || normalizeText(nearestPoi.name)) ||
    ''

  return {
    province: addressComponent.province || adInfo.province || '',
    city: addressComponent.city || adInfo.city || '',
    district: addressComponent.district || adInfo.district || '',
    adcode: adInfo.adcode || '',
    poiTitle,
    displayName:
      poiTitle ||
      addressComponent.street ||
      addressComponent.street_number ||
      '',
    locationText:
      result.result.address ||
      (result.result.formatted_addresses && result.result.formatted_addresses.recommend) ||
      '',
  }
}

async function placeSuggestionByTencentMap(keyword, options = {}) {
  if (!TENCENT_MAP_KEY) {
    console.warn('[userManage] TENCENT_MAP_KEY missing, skip place suggestion')
    return []
  }

  const text = normalizeText(keyword)
  if (!text) {
    return []
  }

  const params = [
    `keyword=${encodeURIComponent(text)}`,
    `key=${encodeURIComponent(TENCENT_MAP_KEY)}`,
    'output=json',
    'get_ad_info=1',
    'region_fix=0',
    'policy=1',
    'page_size=10',
  ]

  const region = normalizeText(options.region)
  if (region) {
    params.push(`region=${encodeURIComponent(region)}`)
  }

  const latitude = normalizeNumber(options.latitude)
  const longitude = normalizeNumber(options.longitude)
  if (latitude !== null && longitude !== null) {
    params.push(`location=${encodeURIComponent(`${latitude},${longitude}`)}`)
  }

  const url = `https://apis.map.qq.com/ws/place/v1/suggestion?${params.join('&')}`
  const result = await requestJson(url)
  if (!result || result.status !== 0 || !Array.isArray(result.data)) {
    console.warn('[userManage] place suggestion failed', result)
    return []
  }

  return result.data.map((item) => ({
    title: item.title || '',
    address: item.address || '',
    adcode: String(item.adcode || ''),
    province: item.province || '',
    city: item.city || '',
    district: item.district || '',
    latitude: item.location && item.location.lat,
    longitude: item.location && item.location.lng,
  }))
}

exports.main = async (event) => {
  try {
    const user = await getCurrentUserRecord()
    if (!user) {
      return {
        success: false,
        message: '用户不存在',
      }
    }

    if (event.action === 'updateProfile') {
      const profile = event.profile || {}
      const nextUser = await saveAndFetchUser(user._id, {
        avatarUrl: profile.avatarUrl || '',
        nickName: profile.nickName || '',
        gender: profile.gender || '未知',
        birthDate: profile.birthDate || '',
        profileCompleted: true,
      })

      return {
        success: true,
        userInfo: nextUser,
      }
    }

    if (event.action === 'updateOnboarding') {
      const payload = event.payload || {}
      let resolvedLocation = null

      try {
        resolvedLocation = payload.userLocation ? await reverseGeocodeByTencentMap(payload.userLocation) : null
      } catch (error) {
        console.error('[userManage] reverse geocode error', error)
        resolvedLocation = null
      }

      const nextUser = await saveAndFetchUser(user._id, {
        locationAuthorized: !!payload.locationAuthorized,
        locationChoiceMade: !!payload.locationChoiceMade,
        userLocation: payload.userLocation || null,
        province: (resolvedLocation && resolvedLocation.province) || user.province || '',
        city: (resolvedLocation && resolvedLocation.city) || user.city || '',
        district: (resolvedLocation && resolvedLocation.district) || user.district || '',
        adcode: (resolvedLocation && resolvedLocation.adcode) || user.adcode || '',
        locationText: (resolvedLocation && resolvedLocation.locationText) || user.locationText || '',
        displayName:
          (resolvedLocation && buildDisplayName(resolvedLocation)) ||
          user.displayName ||
          '',
      })

      return {
        success: true,
        userInfo: nextUser,
      }
    }

    if (event.action === 'updateRegion') {
      const payload = event.payload || {}
      let resolvedLocation = null

      try {
        resolvedLocation = payload.userLocation ? await reverseGeocodeByTencentMap(payload.userLocation) : null
      } catch (error) {
        console.error('[userManage] updateRegion reverse geocode error', error)
        resolvedLocation = null
      }

      const nextUser = await saveAndFetchUser(user._id, {
        locationAuthorized:
          typeof payload.locationAuthorized === 'boolean'
            ? payload.locationAuthorized
            : !!user.locationAuthorized,
        locationChoiceMade: true,
        userLocation: hasOwn(payload, 'userLocation')
          ? (payload.userLocation || null)
          : (user.userLocation || null),
        province:
          normalizeText(payload.province) ||
          (resolvedLocation && resolvedLocation.province) ||
          user.province ||
          '',
        city:
          normalizeText(payload.city) ||
          (resolvedLocation && resolvedLocation.city) ||
          user.city ||
          '',
        district:
          normalizeText(payload.district) ||
          (resolvedLocation && resolvedLocation.district) ||
          user.district ||
          '',
        adcode:
          normalizeText(payload.adcode) ||
          (resolvedLocation && resolvedLocation.adcode) ||
          user.adcode ||
          '',
        locationText:
          normalizeText(payload.locationText) ||
          (resolvedLocation && resolvedLocation.locationText) ||
          user.locationText ||
          '',
        displayName:
          buildDisplayName({
            displayName: payload.displayName,
            poiTitle: resolvedLocation && resolvedLocation.poiTitle,
            district:
              normalizeText(payload.district) ||
              (resolvedLocation && resolvedLocation.district) ||
              user.district ||
              '',
            city:
              normalizeText(payload.city) ||
              (resolvedLocation && resolvedLocation.city) ||
              user.city ||
              '',
            province:
              normalizeText(payload.province) ||
              (resolvedLocation && resolvedLocation.province) ||
              user.province ||
              '',
            locationText:
              normalizeText(payload.locationText) ||
              (resolvedLocation && resolvedLocation.locationText) ||
              user.locationText ||
              '',
          }) ||
          user.displayName ||
          '',
      })

      return {
        success: true,
        userInfo: nextUser,
      }
    }

    if (event.action === 'searchPlaceSuggestions') {
      const payload = event.payload || {}
      const list = await placeSuggestionByTencentMap(payload.keyword, {
        region: payload.region,
        latitude: payload.latitude,
        longitude: payload.longitude,
      })

      return {
        success: true,
        list,
      }
    }

    if (event.action === 'updateDNATags') {
      const tags = Array.isArray(event.tags) ? event.tags : []
      const buddyTags = Array.isArray(event.buddyTags) ? uniqueList(event.buddyTags) : []
      const buddyIntent = buildBuddyIntentFromTags(buddyTags)
      const nextUser = await saveAndFetchUser(user._id, {
        dnaTags: tags,
        buddyTags,
        buddyIntent,
        buddyIntentCompleted: !!buddyTags.length,
        dnaCompleted: true,
        onboardingCompleted: true,
      })

      return {
        success: true,
        userInfo: nextUser,
      }
    }

    if (event.action === 'updateBuddyIntent') {
      const buddyIntent = normalizeBuddyIntent(event.buddyIntent || {})
      const buddyTags = deriveBuddyTagsFromIntent(buddyIntent)
      const nextUser = await saveAndFetchUser(user._id, {
        buddyTags,
        buddyIntent,
        buddyIntentCompleted: !!buddyTags.length,
      })

      return {
        success: true,
        userInfo: nextUser,
      }
    }

    if (event.action === 'getBuddyMatches') {
      const payload = event.payload || {}
      const question = normalizeText(payload.question)
      const limit = Math.min(Math.max(Number(payload.limit) || 3, 1), 10)
      const res = await db.collection('users').limit(100).get()
      const currentOpenid = user.openid || ''

      const list = (res.data || [])
        .filter((item) => item && item.openid && item.openid !== currentOpenid)
        .filter((item) => item.profileCompleted && item.dnaCompleted)
        .map((item) => buildBuddyCandidate(user, item, question))
        .sort((left, right) => right.matchScore - left.matchScore)
        .slice(0, limit)

      return {
        success: true,
        list,
      }
    }

    return {
      success: false,
      message: '不支持的操作',
    }
  } catch (err) {
    console.error('userManage failed', err)
    return {
      success: false,
      message: '操作失败',
    }
  }
}
