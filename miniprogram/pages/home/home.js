const {
  isRenderableMedia,
  resolveActivityBanner,
  resolveActivityCover,
  resolveMediaSource,
} = require('../../utils/mediaAssets')
const { buildActivityCoverTags } = require('../../utils/activityCoverTags')

const SAFE_PRODUCT_COVER = '/images/default-goods-image.png'

const DEFAULT_SEARCH_HINTS = [
  '采摘体验活动',
  '周边乡村旅游',
  '当季花海推荐',
  '农旅研学路线',
  '精品民宿推荐',
  '非遗民俗体验',
  '特色农产品',
]

const NAV_ITEMS = [
  {
    key: 'fun',
    title: '乡野乐事',
    icon: '/images/nav-fun.svg',
    action: 'goRuralFun',
  },
  {
    key: 'academy',
    title: '文旅课堂',
    icon: '/images/nav-academy.png',
    action: 'goAcademy',
  },
  {
    key: 'mall',
    title: '乡味商城',
    icon: '/images/nav-mall.png',
    action: 'goMall',
  },
  {
    key: 'hotel',
    title: '乡野栖居',
    icon: '/images/nav-hotel.png',
    action: 'goHotel',
  },
]

const REGION_THEME_LIBRARY = [
  {
    matchKeywords: ['兰州', '永登', '苦水', '榆中'],
    themes: [
      {
        id: 'rose',
        title: '玫瑰花海主题',
        period: '当季限定',
        description: '围绕玫瑰观赏、花田漫游和乡村休闲展开的特色活动。',
        activityKeywords: ['玫瑰', '花海', '体验', '乡村'],
        products: ['玫瑰花茶', '玫瑰花酱', '鲜花饼', '手作礼盒', '花香伴手礼'],
      },
      {
        id: 'lily',
        title: '百合赏花主题',
        period: '花期限定',
        description: '以百合花田观景、田园拍照和乡野漫游为核心的轻度体验活动。',
        activityKeywords: ['百合', '赏花', '拍照', '乡村', '漫游'],
        products: ['百合礼盒', '百合花茶', '百合甜品', '百合糕点', '百合伴手礼'],
      },
      {
        id: 'farm',
        title: '田园采摘研学',
        period: '周末精选',
        description: '适合亲子和朋友同行的农事体验、采摘互动与田园休闲内容。',
        activityKeywords: ['采摘', '田园', '研学', '亲子', '周末'],
        products: ['草莓采摘', '果蔬礼盒', '农场体验券', '手作课堂'],
      },
      {
        id: 'red',
        title: '金城红旅',
        period: '红色主题',
        description: '围绕兰州战役遗址与革命纪念馆整理的城市红色记忆主题，适合研学、党建和历史文化打卡。',
        activityKeywords: ['红色', '战役', '纪念馆', '遗址'],
        products: [],
      },
    ],
  },
  {
    matchKeywords: ['皋兰', '西固'],
    themes: [
      {
        id: 'fruit',
        title: '鲜果采摘主题',
        period: '当季限定',
        description: '围绕果园采摘、果蔬体验和家庭出游展开的轻松行程。',
        activityKeywords: ['鲜果', '采摘', '亲子', '出游'],
        products: ['鲜果礼盒', '果干零食', '水果果酱', '时令鲜果'],
      },
      {
        id: 'study',
        title: '农耕研学主题',
        period: '研学推荐',
        description: '适合学校与家庭参与的农耕认知、手作课堂和田野观察活动。',
        activityKeywords: ['研学', '农耕', '手作', '田野'],
        products: ['研学套票', '手作材料包', '课程体验券', '农耕文创'],
      },
      {
        id: 'folk',
        title: '民俗文化主题',
        period: '周末推荐',
        description: '聚焦乡村节庆、民俗展示与文化体验的特色内容。',
        activityKeywords: ['民俗', '文化', '节庆', '体验'],
        products: ['民俗文创', '手工香包', '非遗手作', '节庆礼盒'],
      },
    ],
  },
  {
    matchKeywords: ['新区', '高原', '永登'],
    themes: [
      {
        id: 'grassland',
        title: '草原休闲主题',
        period: '夏秋推荐',
        description: '适合避暑、露营和亲近自然的户外休闲活动。',
        activityKeywords: ['草原', '露营', '休闲', '自然', '周末'],
        products: ['露营茶点', '牧场礼盒', '户外野餐包', '草原文创'],
      },
      {
        id: 'folk',
        title: '村落文化主题',
        period: '文化推荐',
        description: '在乡村街巷和文化场景中感受手作、市集与地方故事。',
        activityKeywords: ['村落', '文化', '市集', '体验'],
        products: ['地方手作', '集市礼盒', '乡味糕点', '文化纪念品'],
      },
      {
        id: 'light',
        title: '轻户外主题',
        period: '周末精选',
        description: '以徒步、观景和乡村漫游为主的轻量化出游内容。',
        activityKeywords: ['徒步', '观景', '乡村', '轻旅行'],
        products: ['步道补给包', '轻食零食', '出游周边', '饮品礼盒'],
      },
    ],
  },
  {
    matchKeywords: ['安宁', '城关', '七里河'],
    themes: [
      {
        id: 'homestay',
        title: '乡野栖居主题',
        period: '民宿推荐',
        description: '围绕民宿入住、周边漫游和轻松休闲展开的短途内容。',
        activityKeywords: ['民宿', '采摘', '体验', '周末'],
        products: ['民宿体验券', '伴手礼套装', '乡味点心', '度假礼包'],
      },
      {
        id: 'food',
        title: '乡味美食主题',
        period: '美食推荐',
        description: '围绕地道风味、乡野小吃和特色餐饮展开的体验内容。',
        activityKeywords: ['美食', '民俗', '体验', '周末'],
        products: ['风味礼盒', '手作点心', '特色酱料', '乡味零食'],
      },
      {
        id: 'photo',
        title: '田园摄影主题',
        period: '摄影推荐',
        description: '适合拍照打卡、花田取景和乡野影像记录的出游内容。',
        activityKeywords: ['摄影', '花海', '农场', '采摘'],
        products: ['摄影套票', '设备租借', '风景明信片', '拍摄周边'],
      },
    ],
  },
]

const DEFAULT_THEME_GROUP = {
  themes: [
    {
      id: 'season',
      title: '当季主题推荐',
      period: '当季限定',
      description: '围绕时令风景、农场体验和乡村休闲打造的综合主题内容。',
      activityKeywords: ['花海', '采摘', '农场', '乡村'],
      products: ['花海果礼', '时令鲜果', '手作点心', '农场礼盒'],
    },
    {
      id: 'craft',
      title: '乡野手作主题',
      period: '体验推荐',
      description: '适合参与手作课程、非遗体验和文化互动的轻量玩法。',
      activityKeywords: ['非遗', '工艺', '体验', '文化'],
      products: ['工艺手作', '香包礼盒', '文创材料包', '非遗礼盒'],
    },
    {
      id: 'slow',
      title: '周末慢游主题',
      period: '周末精选',
      description: '适合短途出行、轻松放空和慢节奏体验的周边农旅内容。',
      activityKeywords: ['轻旅行', '摄影', '体验', '采摘'],
      products: ['慢游礼盒', '香氛小物', '民宿代金券', '周边美食'],
    },
  ],
}

const THEME_CONTENT_OVERRIDES = {
  '玫瑰花海主题': {
    activitySeedKeys: [
      'lz-yongdeng-rose-weekend',
      'lz-kushui-rose-culture-day',
      'lz-kushui-danxia-hike-day',
    ],
    productCards: [
      {
        seedKey: 'lz-rose-jam',
        title: '永登玫瑰花酱礼盒',
        price: 56,
        sold: 93,
        tags: ['玫瑰风味', '产地直发'],
      },
      {
        title: '苦水玫瑰手作礼盒',
        price: 79,
        sold: 41,
        tags: ['玫瑰工艺', '花海伴手礼'],
      },
    ],
  },
  '百合赏花主题': {
    activitySeedKeys: [
      'lz-bailihe-handmade-food-tour',
      'lz-xigu-baihe-culture-day',
    ],
    productCards: [
      {
        seedKey: 'lz-baihe-gift-box',
        title: '兰州百合滋补礼盒',
        price: 88,
        sold: 126,
        tags: ['百合特产', '花海伴手礼'],
      },
      {
        title: '兰州百合糕点组合',
        price: 49,
        sold: 58,
        tags: ['花期限定', '轻食甜点'],
      },
    ],
  },
  '田园采摘研学': {
    activitySeedKeys: [
      'lz-yuzhong-qiyun-family-farm-day',
      'lz-yuzhong-strawberry-family-day',
      'lz-suburb-farm-study-camp',
      'lz-gaolan-country-photo-day',
      'lz-gaolan-shichuan-pear-garden-day',
    ],
    productCards: [
      {
        title: '榆中草莓采摘礼盒',
        price: 69,
        sold: 84,
        tags: ['田园鲜果', '周末推荐'],
      },
      {
        title: '农场手作果酱组合',
        price: 39,
        sold: 67,
        tags: ['研学手作', '农场体验'],
      },
    ],
  },
  '金城红旅': {
    scenicSeedKeys: [
      'lz-yingpanling-battle-site',
      'lz-eighth-route-army-office-memorial',
    ],
    productCards: [],
  },
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function trimRegionSuffix(name = '') {
  return normalizeText(name)
    .replace(/(自治州|新区|矿区|林区|区|县)$/u, '')
    .replace(/(省|市)$/u, '')
}

function getRegionDisplayText(source) {
  if (!source) {
    return '兰州'
  }

  const displayName = normalizeText(source.displayName || source.label)
  const district = trimRegionSuffix(source.district)
  const city = trimRegionSuffix(source.city)
  const province = trimRegionSuffix(source.province)
  const locationText = normalizeText(source.locationText || source.address)
  return displayName || district || city || province || locationText || '兰州'
}

function pickThemeGroup(regionName) {
  const regionText = normalizeText(regionName)
  return REGION_THEME_LIBRARY.find((group) =>
    group.matchKeywords.some((keyword) => regionText.includes(keyword))
  ) || DEFAULT_THEME_GROUP
}

function getThemeOverride(theme = {}) {
  return THEME_CONTENT_OVERRIDES[normalizeText(theme.title)] || null
}

function buildThemeActivities(activityList, scenicList, theme) {
  const override = getThemeOverride(theme)
  const activitySeedKeys = (override && override.activitySeedKeys) || []
  const scenicSeedKeys = (override && override.scenicSeedKeys) || []
  if (activitySeedKeys.length) {
    const activityMap = activityList.reduce((result, activity) => {
      result[activity.seedKey] = activity
      return result
    }, {})

    return activitySeedKeys
      .map((seedKey) => activityMap[seedKey])
      .filter(Boolean)
  }

  if (scenicSeedKeys.length) {
    const scenicMap = scenicList.reduce((result, scenic) => {
      result[scenic.seedKey] = scenic
      return result
    }, {})

    return scenicSeedKeys
      .map((seedKey) => scenicMap[seedKey])
      .filter(Boolean)
  }

  const keywords = theme.activityKeywords || []
  return activityList.filter((activity) => {
    const textList = [normalizeText(activity.title), ...(activity.rawTags || []).map(normalizeText)]
    return textList.some((text) => keywords.some((keyword) => text.includes(keyword)))
  }).slice(0, 2)
}

function normalizeProduct(product = {}) {
  const categoryTags = Array.isArray(product.categoryTags) ? product.categoryTags : []
  const tags = Array.isArray(product.tags) ? product.tags : []
  return {
    id: product._id || '',
    seedKey: product.seedKey || '',
    title: product.title || '未命名商品',
    cover: product.cover || SAFE_PRODUCT_COVER,
    price: Number(product.price) || 0,
    priceText: product.price ? `￥${product.price}` : '主题推荐',
    sold: Number(product.sold) || 0,
    soldText: product.sold ? `已售 ${product.sold}` : '主题推荐',
    tags: [...categoryTags, ...tags].slice(0, 3),
  }
}

function buildThemeProducts(productList, theme) {
  const override = getThemeOverride(theme)
  const configuredCards = (override && override.productCards) || []
  const productMap = productList.reduce((result, product) => {
    result[product.seedKey] = product
    return result
  }, {})

  if (configuredCards.length) {
    return configuredCards.map((card, index) => {
      const matchedProduct = card.seedKey ? productMap[card.seedKey] : null
      return {
        _cardKey: `${theme.id}-product-${index}`,
        id: matchedProduct ? matchedProduct.id : '',
        seedKey: (matchedProduct && matchedProduct.seedKey) || card.seedKey || '',
        title: (matchedProduct && matchedProduct.title) || card.title,
        cover: (matchedProduct && matchedProduct.cover) || card.cover || SAFE_PRODUCT_COVER,
        priceText: matchedProduct ? matchedProduct.priceText : `￥${card.price}`,
        soldText: matchedProduct ? matchedProduct.soldText : `已售 ${card.sold}`,
        tags: (matchedProduct && matchedProduct.tags && matchedProduct.tags.length)
          ? matchedProduct.tags
          : (card.tags || []),
      }
    })
  }

  return (theme.products || []).map((title, index) => ({
    _cardKey: `${theme.id}-product-${index}`,
    id: '',
    seedKey: '',
    title,
    cover: SAFE_PRODUCT_COVER,
    priceText: '待定',
    soldText: theme.period || '主题推荐',
    tags: [theme.title],
  }))
}

Page({
  data: {
    regionName: '兰州',
    statusBarHeight: 20,
    menuRect: null,
    searchHints: DEFAULT_SEARCH_HINTS,
    searchHintIndex: 0,
    currentSearchHint: DEFAULT_SEARCH_HINTS[0],
    navItems: NAV_ITEMS,
    bannerList: [],
    activityList: [],
    scenicList: [],
    productList: [],
    themeTabs: [],
    themeActive: 0,
    themeList: [],
    currentTheme: null,
  },

  onLoad() {
    this.initNavMetrics()
    this.syncRegionName()
    this.startSearchHintRotation()
    this.loadActivities()
    this.loadScenics()
    this.loadProducts()
  },

  onShow() {
    this.syncRegionName()
    this.startSearchHintRotation()
  },

  onHide() {
    this.clearSearchHintTimer()
  },

  onUnload() {
    this.clearSearchHintTimer()
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const menuRect = wx.getMenuButtonBoundingClientRect()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20,
        menuRect,
      })
    } catch (err) {
      this.setData({
        statusBarHeight: 20,
        menuRect: null,
      })
    }
  },

  startSearchHintRotation() {
    this.clearSearchHintTimer()
    this.searchHintTimer = setInterval(() => {
      const { searchHints, searchHintIndex } = this.data
      if (!searchHints.length) {
        return
      }

      const nextIndex = (searchHintIndex + 1) % searchHints.length
      this.setData({
        searchHintIndex: nextIndex,
        currentSearchHint: searchHints[nextIndex],
      })
    }, 5000)
  },

  clearSearchHintTimer() {
    if (this.searchHintTimer) {
      clearInterval(this.searchHintTimer)
      this.searchHintTimer = null
    }
  },

  syncRegionName() {
    const app = getApp()
    const userInfo = app.getUserInfo ? app.getUserInfo() : null
    const selectedRegion = wx.getStorageSync('selectedRegion') || null
    const regionName = getRegionDisplayText(selectedRegion || userInfo)

    this.setData({ regionName }, () => this.refreshThemeSection())
  },

  async loadActivities() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getactivities',
      })

      const list = (res.result && res.result.list) || []
      const mapped = await Promise.all(
        list.map(async (item) => {
          const coverTagInfo = buildActivityCoverTags(item)
          return {
            id: item._id,
            seedKey: item.seedKey || '',
            title: item.title || '精选活动',
            cover: await resolveActivityCover(item),
            dayText: coverTagInfo.durationTag,
            tags: coverTagInfo.tags,
            priceText: item.priceFrom || item.price ? `￥${item.priceFrom || item.price}` : '待定',
            soldText: item.traveledCount ? `${item.traveledCount}人已参与` : '主题推荐',
            rawTags: item.tags || [],
          }
        })
      )

      const preferredBanners = mapped.slice(0, 3)
      const bannerList = await Promise.all(
        preferredBanners.map(async (item, index) => ({
          _id: `activity-banner-${item.seedKey || index}`,
          type: 'activity',
          targetId: item.id,
          image: await resolveActivityBanner(item),
        }))
      )

      this.setData({
        bannerList: bannerList.filter((item) => isRenderableMedia(item.image)),
        activityList: mapped,
      }, () => this.refreshThemeSection())
    } catch (err) {
      console.error('load activities failed', err)
      wx.showToast({
        title: '活动加载失败',
        icon: 'none',
      })
    }
  },

  async loadProducts() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('products').limit(50).get()
      const productList = ((res && res.data) || []).map((item) => normalizeProduct(item))

      this.setData({
        productList,
      }, () => this.refreshThemeSection())
    } catch (err) {
      console.error('load products failed', err)
      this.refreshThemeSection()
    }
  },

  async loadScenics() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('scenics').limit(50).get()
      const scenicList = await Promise.all(
        ((res && res.data) || []).map(async (item) => ({
          id: item._id,
          type: 'scenic',
          seedKey: item.seedKey || '',
          title: item.locationName || item.title || '景点推荐',
          cover: await resolveMediaSource(item.cover, '/images/nav-academy.png'),
          dayText: '红旅主题',
          tags: []
            .concat(Array.isArray(item.playTags) ? item.playTags : [])
            .concat(Array.isArray(item.tags) ? item.tags : [])
            .filter(Boolean)
            .slice(0, 3),
          priceText: item.priceFrom || item.price ? `¥${item.priceFrom || item.price}` : '免费参观',
          soldText: item.visitedCount ? `${item.visitedCount}人已到访` : '红色文化推荐',
          rawTags: item.tags || [],
        }))
      )

      this.setData({
        scenicList,
      }, () => this.refreshThemeSection())
    } catch (err) {
      console.error('load scenics failed', err)
      this.refreshThemeSection()
    }
  },

  formatDays(days) {
    if (!days) {
      return '1天'
    }
    if (days === 0.5) {
      return '半天'
    }
    return `${days}天`
  },

  refreshThemeSection() {
    const { regionName, activityList, scenicList, productList, themeActive } = this.data
    const themeGroup = pickThemeGroup(regionName)
    const themeList = themeGroup.themes.map((theme) => ({
      ...theme,
      activities: buildThemeActivities(activityList, scenicList, theme),
      products: buildThemeProducts(productList, theme),
    }))
    const nextActive = themeList[themeActive] ? themeActive : 0

    this.setData({
      themeTabs: themeList.map((item) => item.title),
      themeList,
      themeActive: nextActive,
      currentTheme: themeList[nextActive] || null,
    })
  },

  changeThemeTab(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({
      themeActive: idx,
      currentTheme: this.data.themeList[idx] || null,
    })
  },

  goSearch() {
    const hint = this.data.currentSearchHint || ''
    wx.navigateTo({
      url: `/pages/search/search?hint=${encodeURIComponent(hint)}`,
    })
  },

  executeSearch() {
    const keyword = this.data.currentSearchHint || ''
    wx.navigateTo({
      url: `/pages/searchResults/searchResults?keyword=${encodeURIComponent(keyword)}`,
    })
  },

  onNavTap(e) {
    const action = e.currentTarget.dataset.action
    if (action && typeof this[action] === 'function') {
      this[action]()
    }
  },

  goBannerTarget(e) {
    const { type, id } = e.currentTarget.dataset
    if (!type || !id) {
      wx.showToast({
        title: '内容正在准备中',
        icon: 'none',
      })
      return
    }

    if (type === 'activity') {
      wx.navigateTo({ url: `/pages/activityDetail/activityDetail?id=${id}` })
      return
    }

    if (type === 'product') {
      wx.navigateTo({ url: `/pages/productDetail/productDetail?id=${id}` })
      return
    }

    if (type === 'scenic') {
      wx.navigateTo({ url: `/pages/scenicDetail/scenicDetail?id=${id}` })
      return
    }
  },

  goActivityDetail(e) {
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type || 'activity'
    if (!id) {
      return
    }

    if (type === 'scenic') {
      wx.navigateTo({
        url: `/pages/scenicDetail/scenicDetail?id=${id}`,
      })
      return
    }

    wx.navigateTo({
      url: `/pages/activityDetail/activityDetail?id=${id}`,
    })
  },

  goProductDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({
        title: '商品详情暂未开放',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/productDetail/productDetail?id=${id}`,
    })
  },

  goRegion() {
    wx.navigateTo({
      url: '/pages/regionSelect/regionSelect',
    })
  },

  onScanTap() {
    wx.showToast({
      title: '扫一扫/核销能力正在接入中',
      icon: 'none',
    })
  },

  goRuralFun() {
    wx.navigateTo({
      url: '/pages/ruralFun/ruralFun',
    })
  },

  goAcademy() {
    wx.navigateTo({
      url: '/pages/academy/academy',
    })
  },

  goHotel() {
    wx.navigateTo({
      url: '/pages/hotel/hotel',
    })
  },

  goMall() {
    wx.navigateTo({
      url: '/pages/mall/mall',
    })
  },

  goNotePublish() {
    wx.navigateTo({
      url: '/pages/notePublish/notePublish',
    })
  },
})
