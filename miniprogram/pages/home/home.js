const {
  isRenderableMedia,
  resolveActivityBanner,
  resolveActivityCover,
} = require('../../utils/mediaAssets')
const { buildActivityCoverTags } = require('../../utils/activityCoverTags')

const SAFE_PRODUCT_COVER = '/images/default-goods-image.png'

const DEFAULT_SEARCH_HINTS = [
  '亲子采摘',
  '非遗体验',
  '周末一日游',
  '田园花海',
  '古村漫游',
  '乡味特产',
  '节气礼盒',
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
    title: '农旅宝典',
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
        title: '苦水玫瑰季',
        period: '当季限定',
        description: '围绕玫瑰花田、玫瑰手作和玫瑰风味商品展开的乡野限定主题。',
        activityKeywords: ['玫瑰', '花海', '采摘', '手作', '乡村'],
        products: ['玫瑰酸奶', '干玫瑰', '玫瑰酱', '玫瑰精油', '玫瑰香薰'],
      },
      {
        id: 'lily',
        title: '百合丰收季',
        period: '时令限定',
        description: '主打百合采挖、百合食养和百合伴手礼的在地主题。',
        activityKeywords: ['百合', '采摘', '乡味', '手作', '康养'],
        products: ['鲜百合', '百合干', '百合银耳羹', '百合礼盒', '百合茶'],
      },
      {
        id: 'farm',
        title: '黄河田园周末',
        period: '周末限定',
        description: '适合亲子与轻度假人群的近郊田园微度假主题。',
        activityKeywords: ['亲子', '田园', '农旅', '草莓', '摄影'],
        products: ['草莓礼盒', '手工果酱', '农家小米', '乡野点心'],
      },
    ],
  },
  {
    matchKeywords: ['天水', '秦安'],
    themes: [
      {
        id: 'fruit',
        title: '果香采摘季',
        period: '当季限定',
        description: '以果园采摘、乡村休闲和亲子互动为核心的丰收主题。',
        activityKeywords: ['果园', '采摘', '亲子', '乡村'],
        products: ['鲜果礼盒', '果酱', '果脯', '果汁', '果干'],
      },
      {
        id: 'study',
        title: '田园研学周',
        period: '研学限定',
        description: '适合家庭和学校出行的农事课堂与自然观察主题。',
        activityKeywords: ['研学', '劳动', '课堂', '实践', '亲子'],
        products: ['研学手册', '自然观察包', '文创笔记本', '乡土种子盒'],
      },
      {
        id: 'folk',
        title: '乡味手作集',
        period: '体验限定',
        description: '突出地方风物、乡味制作和慢生活体验的文旅主题。',
        activityKeywords: ['手作', '体验', '文旅', '乡味'],
        products: ['手工点心', '乡味礼盒', '风味辣酱', '手作香包'],
      },
    ],
  },
  {
    matchKeywords: ['甘南', '夏河', '玛曲'],
    themes: [
      {
        id: 'grassland',
        title: '草原牧歌季',
        period: '牧场限定',
        description: '围绕草原牧场生活、帐篷露营和藏乡风情体验展开。',
        activityKeywords: ['草原', '牧场', '露营', '乡村', '摄影'],
        products: ['牦牛酸奶', '风干牛肉', '酥油茶', '草原奶贝'],
      },
      {
        id: 'folk',
        title: '藏乡风物周',
        period: '文化限定',
        description: '结合民族文化、手作体验和草原风物的轻度假主题。',
        activityKeywords: ['文旅', '手作', '体验', '摄影'],
        products: ['藏纹香囊', '手工挂饰', '特色奶制品', '草原香薰'],
      },
      {
        id: 'light',
        title: '轻牧生活节',
        period: '周末限定',
        description: '适合城市游客体验牧场日常和慢生活节奏的主题。',
        activityKeywords: ['康养', '乡村', '体验', '草原'],
        products: ['牧场早餐包', '奶酪礼盒', '牧场文创杯', '野花蜂蜜'],
      },
    ],
  },
  {
    matchKeywords: ['张掖', '陇南', '临夏'],
    themes: [
      {
        id: 'homestay',
        title: '乡野栖居周',
        period: '民宿限定',
        description: '聚焦乡村民宿、古村漫游与在地生活体验的主题。',
        activityKeywords: ['民宿', '乡村', '文旅', '摄影'],
        products: ['民宿早餐券', '古村手绘地图', '乡居香氛', '伴手礼盒'],
      },
      {
        id: 'food',
        title: '乡味寻鲜季',
        period: '风味限定',
        description: '围绕地方美食、手作体验和乡味采购的主题活动。',
        activityKeywords: ['乡味', '手作', '文旅', '体验'],
        products: ['地方小吃礼盒', '手工酱料', '风味挂面', '杂粮组合'],
      },
      {
        id: 'photo',
        title: '田园影像节',
        period: '摄影限定',
        description: '适合周末打卡、花海拍摄和乡村慢游的主题内容。',
        activityKeywords: ['摄影', '花海', '田园', '乡村'],
        products: ['摄影明信片', '相框摆件', '风景拼图', '田园文创袋'],
      },
    ],
  },
]

const DEFAULT_THEME_GROUP = {
  themes: [
    {
      id: 'season',
      title: '当季采摘季',
      period: '当季限定',
      description: '围绕时令果蔬、田园采摘和亲子乡野出游的主题内容。',
      activityKeywords: ['采摘', '亲子', '田园', '乡村'],
      products: ['采摘鲜果', '手工果酱', '时令蔬菜盒', '田园点心'],
    },
    {
      id: 'craft',
      title: '乡野手作周',
      period: '体验限定',
      description: '主打地方手作、非遗体验和乡味制作的主题。',
      activityKeywords: ['非遗', '手作', '体验', '文旅'],
      products: ['手作文创', '香囊', '风味酱料', '非遗礼盒'],
    },
    {
      id: 'slow',
      title: '周末慢游节',
      period: '周末限定',
      description: '为近郊微度假、乡村漫游与轻康养人群准备的主题。',
      activityKeywords: ['康养', '摄影', '文旅', '乡村'],
      products: ['轻食礼盒', '香草茶', '乡居民宿券', '慢游地图'],
    },
  ],
}

const THEME_CONTENT_OVERRIDES = {
  '苦水玫瑰季': {
    activitySeedKeys: [
      'lz-yongdeng-rose-weekend',
      'lz-kushui-rose-culture-day',
      'lz-kushui-danxia-hike-day',
    ],
    productCards: [
      {
        seedKey: 'lz-rose-jam',
        title: '永登玫瑰酱礼装',
        price: 56,
        sold: 93,
        tags: ['玫瑰风味', '伴手礼'],
      },
      {
        title: '苦水玫瑰纯露礼盒',
        price: 79,
        sold: 41,
        tags: ['玫瑰手作', '节气礼盒'],
      },
    ],
  },
  '百合丰收季': {
    activitySeedKeys: [
      'lz-bailihe-handmade-food-tour',
      'lz-xigu-baihe-culture-day',
    ],
    productCards: [
      {
        seedKey: 'lz-baihe-gift-box',
        title: '兰州百合伴手礼盒',
        price: 88,
        sold: 126,
        tags: ['百合特产', '节气礼盒'],
      },
      {
        title: '兰州鲜百合尝鲜装',
        price: 49,
        sold: 58,
        tags: ['时令鲜货', '食养'],
      },
    ],
  },
  '黄河田园周末': {
    activitySeedKeys: [
      'lz-yuzhong-strawberry-family-day',
      'lz-suburb-farm-study-camp',
      'lz-gaolan-country-photo-day',
      'lz-gaolan-shichuan-pear-garden-day',
    ],
    productCards: [
      {
        title: '榆中草莓鲜采礼盒',
        price: 69,
        sold: 84,
        tags: ['田园鲜果', '周末带走'],
      },
      {
        title: '近郊手工果酱组合',
        price: 39,
        sold: 67,
        tags: ['农旅手作', '轻食伴手'],
      },
    ],
  },
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function trimRegionSuffix(name = '') {
  return normalizeText(name)
    .replace(/(特别行政区|自治区|地区|盟)$/u, '')
    .replace(/(省|市|区|县)$/u, '')
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

function buildThemeActivities(activityList, theme) {
  const override = getThemeOverride(theme)
  const activitySeedKeys = (override && override.activitySeedKeys) || []
  if (activitySeedKeys.length) {
    const activityMap = activityList.reduce((result, activity) => {
      result[activity.seedKey] = activity
      return result
    }, {})

    return activitySeedKeys
      .map((seedKey) => activityMap[seedKey])
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
    priceText: product.price ? `¥${product.price}` : '主题精选',
    sold: Number(product.sold) || 0,
    soldText: product.sold ? `${product.sold}人已购` : '主题精选',
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
        priceText: matchedProduct ? matchedProduct.priceText : `¥${card.price}`,
        soldText: matchedProduct ? matchedProduct.soldText : `${card.sold}人已购`,
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
    priceText: '主题精选',
    soldText: theme.period || '主题限定',
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
            title: item.title || '未命名活动',
            cover: await resolveActivityCover(item),
            dayText: coverTagInfo.durationTag,
            tags: coverTagInfo.tags,
            priceText: item.priceFrom || item.price ? `¥${item.priceFrom || item.price}` : '主题精选',
            soldText: item.traveledCount ? `${item.traveledCount}人已出行` : '主题精选',
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
        title: '加载失败',
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

  formatDays(days) {
    if (!days) {
      return '1天'
    }
    if (days === 0.5) {
      return '0.5天'
    }
    return `${days}天`
  },

  refreshThemeSection() {
    const { regionName, activityList, productList, themeActive } = this.data
    const themeGroup = pickThemeGroup(regionName)
    const themeList = themeGroup.themes.map((theme) => ({
      ...theme,
      activities: buildThemeActivities(activityList, theme),
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
        title: '广告信息不完整',
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
    if (!id) {
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
        title: '商品详情正在整理中',
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
      title: '扫码/拍照购功能待完善',
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
