const DEFAULT_HINTS = [
  "\u4eb2\u5b50\u91c7\u6458",
  "\u975e\u9057\u4f53\u9a8c",
  "\u5468\u672b\u4e00\u65e5\u6e38",
  "\u7530\u56ed\u82b1\u6d77",
  "\u53e4\u6751\u6f2b\u6e38",
  "\u4e61\u5473\u7279\u4ea7",
  "\u8282\u6c14\u793c\u76d2"
]

const SEARCH_STORAGE_KEY = "searchHistoryKeywords"
const SEARCH_RECOMMENDATION_STORAGE_KEY = "searchPageRecommendations"
const RESULT_TABS = [
  "\u5168\u90e8",
  "\u6d3b\u52a8",
  "\u666f\u70b9",
  "\u5546\u54c1",
  "\u6c11\u5bbf"
]

const DEFAULT_ACTIVITY_COVER = "/images/activities/lz-yuzhong-strawberry-family-day.jpg"
const DEFAULT_HOTEL_COVER = "/images/nav-hotel.png"
const DEFAULT_PRODUCT_COVER = "/images/default-goods-image.png"
const { buildActivityCoverTags } = require("../../utils/activityCoverTags")
const { resolveActivityCover, resolveMediaSource } = require("../../utils/mediaAssets")
const {
  listConversations,
  removeConversation
} = require("../../utils/askConversationStore")

const HOT_RANKS = [
  {
    id: "h1",
    title: "\u5468\u672b\u4eb2\u5b50\u91c7\u6458\u70ed\u5ea6\u6500\u5347",
    searchKeyword: "\u4eb2\u5b50\u91c7\u6458",
    desc: "\u8349\u8393\u91c7\u6458\u3001\u840c\u5ba0\u519c\u573a\u548c\u4eb2\u5b50\u624b\u4f5c\u6210\u4e3a\u672c\u5468\u6700\u53d7\u6b22\u8fce\u7684\u519c\u65c5\u7ec4\u5408\u3002",
    badge: "98.6\u4e07\u70ed\u5ea6",
    image: "/images/nav-academy.png"
  },
  {
    id: "h2",
    title: "\u6625\u65e5\u82b1\u6d77\u53e4\u6751\u6210\u51fa\u6e38\u70ed\u95e8",
    searchKeyword: "\u7530\u56ed\u82b1\u6d77",
    desc: "\u53e4\u6751\u6f2b\u6e38\u642d\u914d\u8d4f\u82b1\u6444\u5f71\uff0c\u6210\u4e3a\u5e73\u53f0\u6700\u53d7\u6b22\u8fce\u7684\u5468\u672b\u73a9\u6cd5\u3002",
    badge: "76.4\u4e07\u70ed\u5ea6",
    image: "/images/nav-hotel.png"
  },
  {
    id: "h3",
    title: "\u4e61\u5473\u7279\u4ea7\u793c\u76d2\u641c\u7d22\u4e0a\u6da8",
    searchKeyword: "\u4e61\u5473\u7279\u4ea7",
    desc: "\u5e94\u5b63\u9c9c\u8d27\u4e0e\u624b\u4f5c\u4f34\u624b\u793c\u6210\u4e3a\u8fd1\u671f\u5546\u54c1\u641c\u7d22\u589e\u957f\u70b9\u3002",
    badge: "61.2\u4e07\u70ed\u5ea6",
    image: "/images/nav-mall.png"
  },
  {
    id: "h4",
    title: "\u90fd\u5e02\u767d\u9886\u5468\u8fb9\u653e\u677e\u9700\u6c42\u4e0a\u6da8",
    searchKeyword: "\u90fd\u5e02\u767d\u9886",
    desc: "\u8fd1\u90ca\u8f7b\u5ea6\u5047\u3001\u7cbe\u81f4\u7f8e\u98df\u548c\u90ca\u91ce\u4f53\u9a8c\u6210\u4e3a\u8fd1\u671f\u70ed\u95e8\u9009\u62e9\u3002",
    badge: "58.9\u4e07\u70ed\u5ea6",
    image: "/images/nav-hotel.png"
  },
  {
    id: "h5",
    title: "\u94f6\u53d1\u65cf\u8f7b\u677e\u51fa\u6e38\u5173\u6ce8\u5ea6\u63d0\u5347",
    searchKeyword: "\u94f6\u53d1\u65cf",
    desc: "\u6162\u8282\u594f\u89c2\u5149\u3001\u4e61\u91ce\u98ce\u5473\u548c\u8f7b\u4f53\u9a8c\u7ebf\u8def\u66f4\u53d7\u6b22\u8fce\u3002",
    badge: "53.4\u4e07\u70ed\u5ea6",
    image: "/images/nav-academy.png"
  },
  {
    id: "h6",
    title: "\u5468\u672b\u77ed\u9014\u5fae\u5ea6\u5047\u70ed\u95e8\u5ea6\u8d70\u9ad8",
    searchKeyword: "\u5468\u672b\u77ed\u9014",
    desc: "\u4e00\u5929\u4e00\u591c\u7684\u8fd1\u90ca\u51fa\u6e38\u7ec4\u5408\uff0c\u6210\u4e3a\u5468\u672b\u653e\u677e\u7684\u4eba\u6c14\u73a9\u6cd5\u3002",
    badge: "49.8\u4e07\u70ed\u5ea6",
    image: "/images/nav-mall.png"
  }
]

const DISCOVER_KEYWORD_BLACKLIST = new Set([
  "\u6d3b\u52a8",
  "\u666f\u70b9",
  "\u5546\u54c1",
  "\u6c11\u5bbf",
  "\u63a8\u8350",
  "\u70ed\u95e8",
  "\u9644\u8fd1",
  "\u5468\u8fb9",
  "\u6253\u5361",
  "\u89c2\u5149"
])

const ASK_SKILLS = [
  {
    id: "guide",
    mode: "guide_customization",
    title: "\u653b\u7565\u5b9a\u5236",
    icon: "/images/ask-skills/guide.png"
  },
  {
    id: "buddy",
    mode: "buddy_matching",
    title: "\u627e\u642d\u5b50",
    icon: "/images/ask-skills/route.png"
  },
  {
    id: "treehole",
    mode: "xiaohe_feedback",
    title: "\u5c0f\u79be\u6811\u6d1e",
    icon: "/images/ask-skills/treehole.png"
  }
]

const ASK_SUGGESTIONS = [
  "\u9644\u8fd1\u6709\u4ec0\u4e48\u9002\u5408\u4eb2\u5b50\u7684\u519c\u65c5\u6d3b\u52a8\uff1f",
  "\u9644\u8fd1\u6709\u54ea\u4e9b\u503c\u5f97\u53bb\u7684\u4e61\u6751\u666f\u70b9\uff1f",
  "\u9644\u8fd1\u6709\u4ec0\u4e48\u503c\u5f97\u5e26\u8d70\u7684\u4e61\u5473\u7279\u4ea7\uff1f",
  "\u5468\u8fb9\u6709\u4ec0\u4e48\u9002\u5408\u5468\u672b\u653e\u677e\u7684\u53bb\u5904\uff1f",
  "\u9644\u8fd1\u6709\u6ca1\u6709\u9002\u5408\u62cd\u7167\u6253\u5361\u7684\u5730\u65b9\uff1f"
]

const SCENIC_HINT_REGEXP = /景|观|花海|草原|古村|漫游|摄影|观光|山野|湿地|牧场/
const PRODUCT_HINT_REGEXP = /美食|特产|礼盒|手作|百合|鲜货|米酒|伴手礼|乡味/

function safeStorageGet(key) {
  try {
    return wx.getStorageSync(key) || []
  } catch (err) {
    return []
  }
}

function safeRecommendationStorageGet() {
  try {
    const value = wx.getStorageSync(SEARCH_RECOMMENDATION_STORAGE_KEY)
    if (!value || typeof value !== "object") {
      return null
    }
    return value
  } catch (err) {
    return null
  }
}

function formatConversationTime(createdAt) {
  if (!createdAt) return "\u4eca\u5929"

  const now = new Date()
  const createdDate = new Date(createdAt)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const createdStart = new Date(
    createdDate.getFullYear(),
    createdDate.getMonth(),
    createdDate.getDate()
  ).getTime()
  const diffDays = Math.floor((todayStart - createdStart) / 86400000)

  if (diffDays <= 0) return "\u4eca\u5929"
  if (diffDays === 1) return "\u6628\u5929"
  if (diffDays < 7) return "\u8fd1" + (diffDays + 1) + "\u5929"
  return createdDate.getMonth() + 1 + "\u6708" + createdDate.getDate() + "\u65e5"
}

function normalizeConversationHistory(list) {
  return (list || []).map((item) => ({
    id: item.id,
    title: item.title || item.firstQuestion || '新的小禾对话',
    firstQuestion: item.firstQuestion || '',
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || item.createdAt || Date.now(),
    displayTime: formatConversationTime(item.updatedAt || item.createdAt)
  }))
}

function buildVisibleConversationHistory(list, expanded) {
  const normalizedList = Array.isArray(list) ? list : []
  if (expanded) {
    return normalizedList
  }
  return normalizedList.slice(0, 2)
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase()
}

function normalizeTagArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeDiscoverKeyword(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[，,、/\\|]+/g, "")
}

function isValidDiscoverKeyword(keyword) {
  const normalizedKeyword = normalizeDiscoverKeyword(keyword)
  if (!normalizedKeyword) return false
  if (normalizedKeyword.length < 2 || normalizedKeyword.length > 8) return false
  if (DISCOVER_KEYWORD_BLACKLIST.has(normalizedKeyword)) return false
  if (/^[0-9]+$/.test(normalizedKeyword)) return false
  return true
}

function joinActivitySearchText(item) {
  return [
    item.title,
    item.summary,
    item.content,
    item.detail,
    item.locationName,
    item.province,
    item.city,
    item.district,
    item.transport,
    item.stay
  ]
    .concat(normalizeTagArray(item.tags))
    .concat(normalizeTagArray(item.travelModeTags))
    .concat(normalizeTagArray(item.playTags))
    .concat(normalizeTagArray(item.suitableGroups))
    .concat(normalizeTagArray(item.highlights))
    .concat(normalizeTagArray(item.itinerary))
    .join(" ")
    .toLowerCase()
}

async function mapActivityResult(item) {
  const region = [item.province, item.city, item.district].filter(Boolean).join(" · ")
  const price = Number(item.priceFrom || item.price || 0)
  const coverTagInfo = buildActivityCoverTags(item)
  const tags = coverTagInfo.combinedTags

  return {
    id: item._id || item.id,
    sourceId: item._id || item.id,
    type: "activity",
    title: item.title || "\u519c\u65c5\u6d3b\u52a8",
    region: region || item.locationName || "\u5730\u70b9\u5f85\u8865\u5145",
    price: price ? `\u00a5${price}\u8d77` : "\u4ef7\u683c\u5f85\u5b9a",
    priceText: price ? `\u00a5${price}` : "\u4e3b\u9898\u7cbe\u9009",
    soldText: item.traveledCount ? `${item.traveledCount}\u4eba\u5df2\u51fa\u884c` : "",
    dayText: coverTagInfo.durationTag || "",
    tags,
    cover: await resolveActivityCover(item)
  }
}

async function mapScenicResult(item) {
  const region = [item.province, item.city, item.district].filter(Boolean).join(" · ")
  const tags = normalizeTagArray(item.playTags)
    .concat(normalizeTagArray(item.tags))
    .slice(0, 4)

  return {
    id: `scenic-${item._id || item.id}`,
    sourceId: item._id || item.id,
    type: "scenic",
    title: item.locationName || item.title || "\u4e61\u6751\u666f\u70b9",
    region: region || item.locationName || "\u5730\u70b9\u5f85\u8865\u5145",
    price: item.priceFrom || item.price ? `\u00a5${item.priceFrom || item.price}\u8d77` : "\u53ef\u54a8\u8be2",
    priceText: item.priceFrom || item.price ? `\u00a5${item.priceFrom || item.price}` : "\u666f\u70b9\u63a8\u8350",
    soldText: item.visitedCount ? `${item.visitedCount}\u4eba\u5df2\u5230\u8bbf` : "",
    tags: tags.length ? tags : ["\u666f\u70b9"],
    cover: await resolveMediaSource(item.cover, DEFAULT_ACTIVITY_COVER)
  }
}

async function mapProductResult(item) {
  const region = [item.province, item.city, item.district].filter(Boolean).join(" · ")
  const tags = normalizeTagArray(item.categoryTags)
    .concat(normalizeTagArray(item.playTags))
    .concat(normalizeTagArray(item.tags))
    .slice(0, 4)

  return {
    id: `product-${item._id || item.id}`,
    sourceId: item._id || item.id,
    type: "product",
    title: item.title || "\u4e61\u5473\u597d\u7269",
    region: region || item.locationName || "\u4ea7\u5730\u5f85\u8865\u5145",
    price: item.priceFrom || item.price ? `\u00a5${item.priceFrom || item.price}\u8d77` : "\u4ef7\u683c\u5f85\u5b9a",
    priceText: item.priceFrom || item.price ? `\u00a5${item.priceFrom || item.price}` : "\u4e3b\u9898\u7cbe\u9009",
    soldText: item.sold ? `${item.sold}\u4eba\u5df2\u8d2d` : "",
    tags: tags.length ? tags : ["\u4e61\u5473\u7279\u4ea7"],
    cover: await resolveMediaSource(item.cover, DEFAULT_PRODUCT_COVER)
  }
}

async function mapHotelResult(item) {
  const region = [item.province, item.city, item.district].filter(Boolean).join(" · ")
  const price = Number(item.price || item.priceFrom || 0)
  const tags = normalizeTagArray(item.tags).slice(0, 4)

  return {
    id: item._id || item.id,
    sourceId: item._id || item.id,
    type: "hotel",
    title: item.name || item.title || "\u4e61\u91ce\u6c11\u5bbf",
    region: region || item.address || "\u5730\u70b9\u5f85\u8865\u5145",
    price: price ? `\u00a5${price}/\u665a` : "\u4ef7\u683c\u5f85\u5b9a",
    priceText: price ? `\u00a5${price}` : "\u6c11\u5bbf\u63a8\u8350",
    soldText: item.bookedCount ? `${item.bookedCount}\u4eba\u5df2\u8ba2` : "",
    tags: tags.length ? tags : ["\u6c11\u5bbf"],
    cover: await resolveMediaSource(item.cover, DEFAULT_HOTEL_COVER)
  }
}

Page({
  data: {
    statusBarHeight: 20,
    text: {
      searchMode: "\u641c\u7d22",
      askMode: "\u95ee\u5c0f\u79be",
      modeBadge: "\u5403\u73a9\u4f4f\u884c\uff0c\u5c0f\u79be\u90fd\u5b89\u6392",
      historySearch: "\u5386\u53f2\u641c\u7d22",
      clear: "\u6e05\u7a7a",
      discover: "\u53d1\u73b0",
      hotRank: "e\u7ad9\u70ed\u699c",
      searchResult: "\u7684\u641c\u7d22\u7ed3\u679c",
      resetSearch: "\u91cd\u65b0\u641c\u7d22",
      emptyResult: "\u6ca1\u6709\u627e\u5230\u66f4\u5339\u914d\u7684\u5185\u5bb9\uff0c\u8bd5\u8bd5\u6362\u4e2a\u5173\u952e\u8bcd\u770b\u770b\u3002",
      askPlaceholder: "\u9644\u8fd1\u6709\u4ec0\u4e48\u597d\u5403\u7684\uff1f",
      deepThink: "\u6df1\u5ea6\u601d\u8003",
      send: "\u53d1\u9001",
      historyConversation: "\u5386\u53f2\u5bf9\u8bdd",
      skillTitle: "\u5c0f\u79be\u6280\u80fd",
      tryAsk: "\u8bd5\u8bd5\u8fd9\u6837\u95ee",
      voiceSoon: "\u8bed\u97f3\u8f6c\u6587\u5b57\u4f1a\u5728\u95ee\u5c0f\u79be\u4e2d\u63a5\u5165",
      typeActivity: "\u6d3b\u52a8",
      typeScenic: "\u666f\u70b9",
      typeProduct: "\u5546\u54c1",
      typeHotel: "\u6c11\u5bbf"
    },
    mode: "search",
    keyword: "",
    searchHints: DEFAULT_HINTS,
    searchHintIndex: 0,
    currentHint: DEFAULT_HINTS[0],
    searchFocused: false,
    historyKeywords: [],
    discoverKeywords: [],
    hotRankList: [],
    resultTabs: RESULT_TABS,
    activeResultTab: 0,
    hasSearched: false,
    allResults: [],
    visibleResults: [],
    askQuestion: "",
    deepThink: false,
    historyConversations: [],
    visibleHistoryConversations: [],
    historyConversationsExpanded: false,
    historyEditMode: false,
    askSkills: ASK_SKILLS,
    askSuggestions: ASK_SUGGESTIONS
  },

  onLoad(options) {
    this.initNavMetrics()
    const incomingHint = options && options.hint ? decodeURIComponent(options.hint) : ""
    const incomingKeyword = options && options.keyword ? decodeURIComponent(options.keyword) : ""
    if (incomingKeyword) {
      wx.redirectTo({
        url: `/pages/searchResults/searchResults?keyword=${encodeURIComponent(incomingKeyword)}`
      })
      return
    }
    const cachedRecommendations = safeRecommendationStorageGet()
    const historyConversations = normalizeConversationHistory(listConversations())
    this.setData({
      mode: options && options.mode ? options.mode : "search",
      currentHint: incomingHint || DEFAULT_HINTS[0],
      keyword: "",
      historyKeywords: safeStorageGet(SEARCH_STORAGE_KEY),
      discoverKeywords: cachedRecommendations && Array.isArray(cachedRecommendations.discoverKeywords)
        ? cachedRecommendations.discoverKeywords
        : [],
      hotRankList: cachedRecommendations && Array.isArray(cachedRecommendations.hotRankList)
        ? cachedRecommendations.hotRankList
        : [],
      historyConversations,
      visibleHistoryConversations: buildVisibleConversationHistory(historyConversations, false),
      historyConversationsExpanded: false,
      historyEditMode: false
    })
    this.refreshSearchRecommendations()
    this.startHintRotation()
  },

  onShow() {
    this.startHintRotation()
    this.syncAskHistory(normalizeConversationHistory(listConversations()))
    if (
      this.data.mode === "search" &&
      !this.searchSourceCache &&
      (!this.data.discoverKeywords.length || !this.data.hotRankList.length)
    ) {
      this.refreshSearchRecommendations()
    }
  },

  onHide() {
    this.clearHintTimer()
  },

  onUnload() {
    this.clearHintTimer()
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20
      })
    } catch (err) {
      this.setData({
        statusBarHeight: 20
      })
    }
  },

  startHintRotation() {
    this.clearHintTimer()
    this.hintTimer = setInterval(() => {
      const { searchHints, searchHintIndex, hasSearched, mode, searchFocused, keyword } = this.data
      if (!searchHints.length || hasSearched || mode !== "search" || searchFocused || keyword) {
        return
      }
      const nextIndex = (searchHintIndex + 1) % searchHints.length
      this.setData({
        searchHintIndex: nextIndex,
        currentHint: searchHints[nextIndex]
      })
    }, 5000)
  },

  clearHintTimer() {
    if (this.hintTimer) {
      clearInterval(this.hintTimer)
      this.hintTimer = null
    }
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({
      url: "/pages/home/home"
    })
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode || mode === this.data.mode) return
    this.setData({ mode })
    if (mode === "search") {
      this.startHintRotation()
    } else {
      this.clearHintTimer()
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || "" })
  },

  onSearchFocus() {
    this.setData({ searchFocused: true })
  },

  onSearchBlur() {
    this.setData({ searchFocused: false })
    this.startHintRotation()
  },

  onVoiceSearch() {
    wx.showToast({ title: this.data.text.voiceSoon, icon: "none" })
  },

  useKeyword(e) {
    const keyword = e.currentTarget.dataset.keyword
    if (!keyword) return
    this.setData({ keyword }, () => this.goSearchResults(keyword))
  },

  clearHistory() {
    if (!this.data.historyKeywords.length) {
      return
    }

    wx.showModal({
      title: "",
      content: "确认删除全部历史记录？",
      confirmText: "确认",
      cancelText: "取消",
      confirmColor: "#4c8bf5",
      success: ({ confirm }) => {
        if (!confirm) {
          return
        }
        wx.removeStorageSync(SEARCH_STORAGE_KEY)
        this.setData({ historyKeywords: [] })
      }
    })
  },

  executeSearch() {
    const keyword = (this.data.keyword || this.data.currentHint || "").trim()
    if (!keyword) return
    this.goSearchResults(keyword)
  },

  async refreshSearchRecommendations() {
    try {
      const searchSource = await this.loadSearchSource()
      const [discoverKeywords, hotRankList] = await Promise.all([
        this.resolveDiscoverKeywords(searchSource),
        this.resolveHotRankList(searchSource)
      ])
      wx.setStorageSync(SEARCH_RECOMMENDATION_STORAGE_KEY, {
        discoverKeywords,
        hotRankList,
        updatedAt: Date.now()
      })
      this.setData({
        discoverKeywords,
        hotRankList
      })
    } catch (error) {
      console.error("[search] refresh recommendations failed", error)
    }
  },

  async loadSearchSource() {
    if (this.searchSourceCache) {
      return this.searchSourceCache
    }

    const [activities, hotels, scenics, products] = await Promise.all([
      this.fetchActivities(),
      this.fetchHotels(),
      this.fetchScenics(),
      this.fetchProducts()
    ])

    this.searchSourceCache = {
      activities,
      hotels,
      scenics,
      products
    }

    return this.searchSourceCache
  },

  async fetchActivities() {
    const res = await wx.cloud.callFunction({
      name: "getactivities"
    })
    return res.result?.list || []
  },

  async fetchHotels() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("hotels").where({ status: true }).get()
      return res.data || []
    } catch (error) {
      console.error("[search] fetch hotels failed", error)
      return []
    }
  },

  async fetchScenics() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("scenics").get()
      return res.data || []
    } catch (error) {
      console.error("[search] fetch scenics failed", error)
      return []
    }
  },

  async fetchProducts() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection("products").get()
      return res.data || []
    } catch (error) {
      console.error("[search] fetch products failed", error)
      return []
    }
  },

  async filterActivityResults(list, keyword) {
    const lowerKeyword = normalizeSearchText(keyword)
    return Promise.all((list || [])
      .filter((item) => joinActivitySearchText(item).includes(lowerKeyword))
      .map(mapActivityResult))
  },

  async filterScenicResults(list, keyword) {
    const lowerKeyword = normalizeSearchText(keyword)
    return Promise.all((list || [])
      .filter((item) => {
        const text = [
          item.title,
          item.summary,
          item.content,
          item.locationName,
          item.province,
          item.city,
          item.district
        ]
          .concat(normalizeTagArray(item.tags))
          .concat(normalizeTagArray(item.playTags))
          .concat(normalizeTagArray(item.suitableGroups))
          .join(" ")
          .toLowerCase()
        return SCENIC_HINT_REGEXP.test(text) && text.includes(lowerKeyword)
      })
      .map(mapScenicResult))
  },

  async filterProductResults(list, keyword) {
    const lowerKeyword = normalizeSearchText(keyword)
    return Promise.all((list || [])
      .filter((item) => {
        const text = [
          item.title,
          item.summary,
          item.content,
          item.locationName,
          item.province,
          item.city,
          item.district
        ]
          .concat(normalizeTagArray(item.tags))
          .concat(normalizeTagArray(item.categoryTags))
          .concat(normalizeTagArray(item.suitableGroups))
          .join(" ")
          .toLowerCase()
        return PRODUCT_HINT_REGEXP.test(text) && text.includes(lowerKeyword)
      })
      .map(mapProductResult))
  },

  async filterHotelResults(list, keyword) {
    const lowerKeyword = normalizeSearchText(keyword)
    return Promise.all((list || [])
      .filter((item) => {
        const merged = [
          item.name,
          item.title,
          item.summary,
          item.desc,
          item.description,
          item.address,
          item.province,
          item.city,
          item.district
        ]
          .concat(normalizeTagArray(item.tags))
          .join(" ")
          .toLowerCase()

        return merged.includes(lowerKeyword)
      })
      .map(mapHotelResult))
  },

  async countResultsByKeyword(searchSource, keyword) {
    if (!searchSource || !keyword) {
      return 0
    }

    const { activities, hotels, scenics, products } = searchSource
    const [activityResults, scenicResults, productResults, hotelResults] = await Promise.all([
      this.filterActivityResults(activities, keyword),
      this.filterScenicResults(scenics, keyword),
      this.filterProductResults(products, keyword),
      this.filterHotelResults(hotels, keyword)
    ])
    return activityResults.length
      + scenicResults.length
      + productResults.length
      + hotelResults.length
  },

  collectDiscoverKeywordCounts(searchSource) {
    const keywordCountMap = new Map()
    const appendKeywords = (keywords) => {
      normalizeTagArray(keywords).forEach((keyword) => {
        const normalizedKeyword = normalizeDiscoverKeyword(keyword)
        if (!isValidDiscoverKeyword(normalizedKeyword)) {
          return
        }
        keywordCountMap.set(
          normalizedKeyword,
          (keywordCountMap.get(normalizedKeyword) || 0) + 1
        )
      })
    }

    ;(searchSource.activities || []).forEach((item) => {
      appendKeywords(item.tags)
      appendKeywords(item.travelModeTags)
      appendKeywords(item.playTags)
      appendKeywords(item.suitableGroups)
    })

    ;(searchSource.scenics || []).forEach((item) => {
      appendKeywords(item.tags)
      appendKeywords(item.playTags)
      appendKeywords(item.suitableGroups)
    })

    ;(searchSource.products || []).forEach((item) => {
      appendKeywords(item.tags)
      appendKeywords(item.categoryTags)
      appendKeywords(item.playTags)
      appendKeywords(item.suitableGroups)
    })

    ;(searchSource.hotels || []).forEach((item) => {
      appendKeywords(item.tags)
    })

    return keywordCountMap
  },

  async resolveDiscoverKeywords(searchSource) {
    const rankedKeywords = await Promise.all(
      Array.from(this.collectDiscoverKeywordCounts(searchSource).entries()).map(async ([keyword, count]) => ({
        keyword,
        count,
        resultCount: await this.countResultsByKeyword(searchSource, keyword)
      }))
    )

    return rankedKeywords
      .filter((item) => item.resultCount > 0)
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }
        if (left.keyword.length !== right.keyword.length) {
          return left.keyword.length - right.keyword.length
        }
        return left.keyword.localeCompare(right.keyword, "zh-CN")
      })
      .map((item) => item.keyword)
      .slice(0, 6)
  },

  async resolveHotRankList(searchSource) {
    const rankedHotList = await Promise.all(
      HOT_RANKS.map(async (item) => ({
        ...item,
        resultCount: await this.countResultsByKeyword(searchSource, item.searchKeyword)
      }))
    )

    return rankedHotList
      .filter((item) => item.resultCount > 0)
      .map(({ resultCount, ...item }) => item)
  },

  persistHistory(keyword) {
    const current = this.data.historyKeywords || []
    const next = [keyword].concat(current.filter((item) => item !== keyword)).slice(0, 8)
    wx.setStorageSync(SEARCH_STORAGE_KEY, next)
    this.setData({ historyKeywords: next })
  },

  changeResultTab(e) {
    const index = Number(e.currentTarget.dataset.index)
    const typeMap = ["all", "activity", "scenic", "product", "hotel"]
    const type = typeMap[index]
    const visibleResults = type === "all"
      ? this.data.allResults
      : this.data.allResults.filter((item) => item.type === type)

    this.setData({
      activeResultTab: index,
      visibleResults
    })
  },

  resetSearch() {
    this.setData({
      keyword: "",
      hasSearched: false,
      activeResultTab: 0,
      allResults: [],
      visibleResults: [],
      searchFocused: false
    })
  },

  onAskInput(e) {
    this.setData({ askQuestion: e.detail.value || "" })
  },

  toggleDeepThink() {
    this.setData({ deepThink: !this.data.deepThink })
  },

  onAskVoice() {
    wx.showToast({
      title: this.data.text.voiceSoon,
      icon: "none"
    })
  },

  useAskPrompt(e) {
    const question = e.currentTarget.dataset.question
    if (!question) return
    this.goAskChat(question, "suggest_prompt")
  },

  useAskSkill(e) {
    const skillMode = e.currentTarget.dataset.mode
    if (!skillMode) return
    wx.navigateTo({
      url: `/pages/askXiaoheChat/askXiaoheChat?source=skill_entry&skillMode=${skillMode}`
    })
  },

  toggleAskHistoryExpand() {
    if (this.data.historyEditMode) {
      return
    }
    const expanded = !this.data.historyConversationsExpanded
    this.setData({
      historyConversationsExpanded: expanded,
      visibleHistoryConversations: buildVisibleConversationHistory(this.data.historyConversations, expanded)
    })
  },

  toggleAskHistoryEdit() {
    const nextEditMode = !this.data.historyEditMode
    const nextExpanded = nextEditMode ? true : false
    this.setData({
      historyEditMode: nextEditMode,
      historyConversationsExpanded: nextExpanded,
      visibleHistoryConversations: buildVisibleConversationHistory(
        this.data.historyConversations,
        nextExpanded
      )
    })
  },

  syncAskHistory(historyConversations) {
    const normalizedHistory = Array.isArray(historyConversations) ? historyConversations : []
    const historyConversationsExpanded = this.data.historyEditMode ? true : false
    this.setData({
      historyConversations: normalizedHistory,
      historyConversationsExpanded,
      visibleHistoryConversations: buildVisibleConversationHistory(normalizedHistory, historyConversationsExpanded)
    })
  },

  openAskHistory(e) {
    if (this.data.historyEditMode) return
    const conversationId = e.currentTarget.dataset.id
    if (!conversationId) return
    wx.navigateTo({
      url: `/pages/askXiaoheChat/askXiaoheChat?conversationId=${encodeURIComponent(conversationId)}&source=search_input`
    })
  },

  removeAskHistory(e) {
    const conversationId = e.currentTarget.dataset.id
    if (!conversationId) return
    const next = normalizeConversationHistory(removeConversation(conversationId))
    this.syncAskHistory(next)
  },

  submitAsk() {
    const question = (this.data.askQuestion || this.data.text.askPlaceholder || "").trim()
    if (!question) return
    this.goAskChat(question, "search_input")
  },

  goSearchResults(keyword) {
    const encodedKeyword = encodeURIComponent((keyword || "").trim())
    if (!encodedKeyword) {
      return
    }
    wx.navigateTo({
      url: `/pages/searchResults/searchResults?keyword=${encodedKeyword}`
    })
  },

  goAskChat(question, source) {
    const encodedQuestion = encodeURIComponent(question)
    const deepThink = this.data.deepThink ? "1" : "0"
    wx.navigateTo({
      url: `/pages/askXiaoheChat/askXiaoheChat?q=${encodedQuestion}&deep=${deepThink}&source=${source}`
    })
  },

  openResultDetail(e) {
    const id = e.currentTarget.dataset.id
    const sourceId = e.currentTarget.dataset.sourceid
    const type = e.currentTarget.dataset.type
    const targetId = sourceId || id

    if ((type === "activity" || type === "scenic" || type === "product") && targetId) {
      const detailUrlMap = {
        activity: `/pages/activityDetail/activityDetail?id=${targetId}`,
        scenic: `/pages/scenicDetail/scenicDetail?id=${targetId}`,
        product: `/pages/productDetail/productDetail?id=${targetId}`
      }
      wx.navigateTo({ url: detailUrlMap[type] })
      return
    }

    if (type === "hotel") {
      wx.navigateTo({
        url: targetId
          ? `/pages/hotelDetail/hotelDetail?id=${targetId}`
          : "/pages/hotel/hotel"
      })
      return
    }

    wx.showToast({
      title: "\u8be5\u7c7b\u578b\u8be6\u60c5\u9875\u8fd8\u5728\u5b8c\u5584",
      icon: "none"
    })
  }
})

