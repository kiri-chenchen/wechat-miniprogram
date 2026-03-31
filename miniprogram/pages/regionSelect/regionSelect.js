const RECENT_REGION_STORAGE_KEY = "recentRegionList"
const RECENT_REGION_LIMIT = 8
const RECENT_REGION_PREVIEW_COUNT = 3

const RECOMMENDED_CITIES = [
  { name: "兰州", letter: "L", isCurrent: true },
  { name: "北京", letter: "B" },
  { name: "上海", letter: "S" },
  { name: "深圳", letter: "S" },
  { name: "广州", letter: "G" },
  { name: "成都", letter: "C" },
  { name: "武汉", letter: "W" },
  { name: "杭州", letter: "H" },
  { name: "天津", letter: "T" },
  { name: "西安", letter: "X" },
  { name: "南京", letter: "N" },
  { name: "重庆", letter: "C" },
]

function buildRecommendedCities(currentName = "") {
  const normalized = trimRegionSuffix(currentName)
  const currentCity = normalized || "兰州"
  const currentLetter = CITY_BUCKETS.find((bucket) => bucket.cities.includes(currentCity))
  const baseList = RECOMMENDED_CITIES.filter((item) => item.name !== currentCity)
  return [
    {
      name: currentCity,
      letter: (currentLetter && currentLetter.letter) || "L",
      isCurrent: true,
    },
    ...baseList.map((item) => ({
      ...item,
      isCurrent: false,
    })),
  ].slice(0, 12)
}

const CITY_BUCKETS = [
  { letter: "A", cities: ["阿坝州", "阿克苏", "阿拉善盟", "安康", "鞍山"] },
  { letter: "B", cities: ["北京", "保定", "包头", "蚌埠", "北海"] },
  { letter: "C", cities: ["成都", "重庆", "长沙", "长春", "常州"] },
  { letter: "D", cities: ["大连", "东莞", "德阳", "大理", "达州"] },
  { letter: "E", cities: ["鄂尔多斯", "恩施"] },
  { letter: "F", cities: ["福州", "佛山", "抚州"] },
  { letter: "G", cities: ["广州", "贵阳", "桂林", "赣州", "甘南"] },
  { letter: "H", cities: ["杭州", "合肥", "海口", "呼和浩特", "哈尔滨"] },
  { letter: "J", cities: ["济南", "嘉兴", "金华", "揭阳", "九江"] },
  { letter: "K", cities: ["昆明", "开封", "喀什"] },
  { letter: "L", cities: ["兰州", "洛阳", "丽江", "廊坊", "连云港"] },
  { letter: "M", cities: ["绵阳", "梅州", "茂名"] },
  { letter: "N", cities: ["南京", "宁波", "南宁", "南昌", "南通"] },
  { letter: "P", cities: ["攀枝花", "平凉", "普洱"] },
  { letter: "Q", cities: ["青岛", "泉州", "秦皇岛", "庆阳"] },
  { letter: "R", cities: ["日照"] },
  { letter: "S", cities: ["上海", "深圳", "苏州", "沈阳", "石家庄"] },
  { letter: "T", cities: ["天津", "太原", "唐山", "天水"] },
  { letter: "W", cities: ["武汉", "无锡", "温州", "乌鲁木齐", "威海"] },
  { letter: "X", cities: ["西安", "厦门", "徐州", "襄阳", "咸阳"] },
  { letter: "Y", cities: ["烟台", "扬州", "银川", "宜昌", "榆林"] },
  { letter: "Z", cities: ["郑州", "珠海", "中山", "湛江", "张掖"] },
]

function getAppUserInfo() {
  const app = getApp()
  return app.getUserInfo ? app.getUserInfo() : null
}

function trimRegionSuffix(name = "") {
  return String(name)
    .replace(/(特别行政区|自治州|地区|盟)$/u, "")
    .replace(/(省|市|区|县)$/u, "")
}

function stripAdminPrefix(text = "") {
  return String(text)
    .trim()
    .replace(/^(?:(?:[\u4e00-\u9fa5]{2,12})(?:省|特别行政区|自治州|地区|盟|市|区|县)){1,4}/u, "")
}

function parseRegionLabelFromText(text = "") {
  const raw = String(text).trim()
  if (!raw) {
    return ""
  }

  const stripped = stripAdminPrefix(raw)
  const target = stripped || raw

  const poiCandidates = target.match(/[\u4e00-\u9fa5A-Za-z0-9（）()·\-]{2,50}(?:大学|学院|校区|广场|商场|中心|公园|景区|小区|大厦|天地|里|城|站|公寓|影城|影院|酒店|民宿|人民政府|街道办|镇|村)(?:）|\))?/gu)
  if (poiCandidates && poiCandidates.length) {
    return poiCandidates
      .map((item) => item.trim())
      .sort((a, b) => b.length - a.length)[0]
  }

  const districtMatch = target.match(/([\u4e00-\u9fa5]{2,12}(?:自治县|自治州|新区|林区|特区|地区|盟|旗|区|县))/u)
  if (districtMatch && districtMatch[1]) {
    return trimRegionSuffix(districtMatch[1])
  }

  const cityMatch = target.match(/([\u4e00-\u9fa5]{2,12}(?:市|州|地区|盟))/u)
  if (cityMatch && cityMatch[1]) {
    return trimRegionSuffix(cityMatch[1])
  }

  const provinceMatch = target.match(/([\u4e00-\u9fa5]{2,12}(?:省|特别行政区))/u)
  return provinceMatch && provinceMatch[1] ? trimRegionSuffix(provinceMatch[1]) : ""
}

function formatRegionLabel(region = {}) {
  const rawDisplayName = String(region.displayName || region.title || region.label || "").trim()
  const displayName = parseRegionLabelFromText(rawDisplayName) || rawDisplayName
  const district = trimRegionSuffix(region.district)
  const city = trimRegionSuffix(region.city)
  const province = trimRegionSuffix(region.province)
  const parsedFromText = parseRegionLabelFromText(region.locationText || region.address || "")
  return displayName || parsedFromText || district || city || province || "未选择地区"
}

function buildRegionSubtitle(region = {}) {
  const regionText = [region.province, region.city, region.district].filter(Boolean).join(" · ")
  return String(region.locationText || region.address || regionText || "").trim()
}

function getSettingAsync() {
  return new Promise((resolve, reject) => {
    wx.getSetting({ success: resolve, fail: reject })
  })
}

function authorizeLocationAsync() {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope: "scope.userLocation",
      success: resolve,
      fail: reject,
    })
  })
}

function getLocationAsync() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      success: resolve,
      fail: reject,
    })
  })
}

function chooseLocationAsync(options = {}) {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      ...options,
      success: resolve,
      fail: reject,
    })
  })
}

function normalizeRecentItem(source = {}) {
  const displayName = formatRegionLabel(source)
  return {
    displayName,
    title: displayName,
    province: source.province || "",
    city: source.city || "",
    district: source.district || "",
    locationText: source.locationText || source.address || "",
    adcode: source.adcode || "",
    latitude: source.latitude || (source.userLocation && source.userLocation.latitude) || null,
    longitude: source.longitude || (source.userLocation && source.userLocation.longitude) || null,
    sourceType: source.sourceType || "recent",
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 116,
    contentHeight: 600,
    activeTab: "myAddress",
    searchKeyword: "",
    searchResults: [],
    searchLoading: false,
    searchEmpty: false,
    isSearching: false,
    scrollTop: 0,
    scrollIntoView: "",
    currentSelectionTitle: "未选择地区",
    currentLocationTitle: "未获取当前位置",
    locationAuthorized: false,
    saving: false,
    shippingAddressList: [],
    recentList: [],
    recentDisplayList: [],
    recentExpanded: false,
    showRecentClearDialog: false,
    recommendedCities: RECOMMENDED_CITIES,
    cityBuckets: CITY_BUCKETS,
    letterGrid: CITY_BUCKETS.map((item) => item.letter),
  },

  onLoad() {
    const app = getApp()
    if (!(app.hasActiveSession && app.hasActiveSession())) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this.initNavMetrics()
    this.syncRegionState()
  },

  onShow() {
    this.syncRegionState()
  },

  onReady() {
    this.measureSectionAnchors()
  },

  onUnload() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const statusBarHeight = systemInfo.statusBarHeight || 20
      const navHeight = statusBarHeight + 116
      this.setData({
        statusBarHeight,
        navHeight,
        contentHeight: Math.max((systemInfo.windowHeight || 720) - navHeight, 320),
      })
    } catch (err) {
      this.setData({
        statusBarHeight: 20,
        navHeight: 136,
        contentHeight: 620,
      })
    }
  },

  async syncRegionState() {
    const userInfo = getAppUserInfo() || {}
    const selectedRegion = wx.getStorageSync("selectedRegion") || userInfo || {}
    const recentList = this.getRecentList()

    this.setData({
      currentSelectionTitle: formatRegionLabel(selectedRegion),
      currentLocationTitle: formatRegionLabel(userInfo),
      recommendedCities: buildRecommendedCities(userInfo.city || ""),
      recentList,
      recentDisplayList: this.getVisibleRecentList(recentList, this.data.recentExpanded),
    })

    try {
      const setting = await getSettingAsync()
      this.setData({
        locationAuthorized: !!setting.authSetting["scope.userLocation"],
      })
    } catch (err) {
      console.error("[regionSelect] get setting failed", err)
    }

    setTimeout(() => {
      this.measureSectionAnchors()
    }, 80)
  },

  getRecentList() {
    const cached = wx.getStorageSync(RECENT_REGION_STORAGE_KEY)
    return Array.isArray(cached) ? cached : []
  },

  getVisibleRecentList(list, expanded) {
    if (expanded || list.length <= RECENT_REGION_PREVIEW_COUNT) {
      return list
    }
    return list.slice(0, RECENT_REGION_PREVIEW_COUNT)
  },

  measureSectionAnchors() {
    const query = wx.createSelectorQuery().in(this)
    query.select(".contentScroll").boundingClientRect()
    query.select("#domestic-city-anchor").boundingClientRect()
    query.exec((res) => {
      const scrollRect = res && res[0]
      const anchorRect = res && res[1]
      if (!scrollRect || !anchorRect) {
        return
      }

      const domesticAnchorTop = anchorRect.top - scrollRect.top + this.data.scrollTop
      this.domesticAnchorTop = domesticAnchorTop
    })
  },

  onScroll(e) {
    const scrollTop = e.detail.scrollTop || 0
    this.setData({ scrollTop })

    if (this.data.isSearching) {
      return
    }

    const activeTab = scrollTop >= Math.max((this.domesticAnchorTop || 0) - 12, 0) ? "domesticCity" : "myAddress"
    if (activeTab !== this.data.activeTab) {
      this.setData({ activeTab })
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: tab,
      scrollIntoView: tab === "myAddress" ? "my-address-anchor" : "domestic-city-anchor",
    })

    setTimeout(() => {
      this.setData({ scrollIntoView: "" })
    }, 120)
  },

  onLetterTap(e) {
    const letter = e.currentTarget.dataset.letter
    if (!letter) {
      return
    }

    this.setData({
      activeTab: "domesticCity",
      scrollIntoView: `city-group-${letter}`,
    })

    setTimeout(() => {
      this.setData({ scrollIntoView: "" })
    }, 120)
  },

  onRecentToggle() {
    const recentExpanded = !this.data.recentExpanded
    this.setData({
      recentExpanded,
      recentDisplayList: this.getVisibleRecentList(this.data.recentList, recentExpanded),
    })
  },

  onRecentClearTap() {
    if (!this.data.recentList.length) {
      return
    }
    this.setData({ showRecentClearDialog: true })
  },

  onRecentClearCancel() {
    this.setData({ showRecentClearDialog: false })
  },

  onRecentClearConfirm() {
    wx.removeStorageSync(RECENT_REGION_STORAGE_KEY)
    this.setData({
      recentList: [],
      recentDisplayList: [],
      recentExpanded: false,
      showRecentClearDialog: false,
    })
  },

  onSearchInput(e) {
    const keyword = String(e.detail.value || "").trim()
    this.setData({
      searchKeyword: keyword,
      isSearching: !!keyword,
    })

    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }

    if (!keyword) {
      this.setData({
        searchResults: [],
        searchLoading: false,
        searchEmpty: false,
      })
      return
    }

    this.setData({
      searchLoading: true,
      searchEmpty: false,
    })

    this.searchTimer = setTimeout(() => {
      this.searchPlaces(keyword)
    }, 280)
  },

  onSearchClear() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }

    this.setData({
      searchKeyword: "",
      searchResults: [],
      searchLoading: false,
      searchEmpty: false,
      isSearching: false,
    })
  },

  async searchPlaces(keyword) {
    const userInfo = getAppUserInfo() || {}
    const location = userInfo.userLocation || {}
    try {
      const res = await wx.cloud.callFunction({
        name: "userManage",
        data: {
          action: "searchPlaceSuggestions",
          payload: {
            keyword,
            region: userInfo.city || userInfo.province || "",
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
      })

      const list = ((res.result && res.result.list) || []).map((item) => ({
        displayName: item.title || formatRegionLabel(item),
        title: item.title || formatRegionLabel(item),
        subtitle: item.address || [item.city, item.district].filter(Boolean).join(" · "),
        province: item.province || "",
        city: item.city || "",
        district: item.district || "",
        locationText: item.address || "",
        adcode: item.adcode || "",
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        sourceType: "search",
      }))

      this.setData({
        searchResults: list,
        searchLoading: false,
        searchEmpty: !list.length,
      })
    } catch (err) {
      console.error("[regionSelect] search places failed", err)
      this.setData({
        searchResults: [],
        searchLoading: false,
        searchEmpty: true,
      })
    }
  },

  async ensureLocationAuthorized() {
    try {
      const setting = await getSettingAsync()
      if (setting.authSetting["scope.userLocation"]) {
        return true
      }
    } catch (err) {
      console.error("[regionSelect] pre-check location failed", err)
    }

    try {
      await authorizeLocationAsync()
      this.setData({ locationAuthorized: true })
      return true
    } catch (err) {
      console.warn("[regionSelect] authorize denied", err)
      const confirmed = await new Promise((resolve) => {
        wx.showModal({
          title: "需要定位权限",
          content: "开启定位后，小禾才能帮你自动识别附近的农旅地点。",
          confirmText: "去设置",
          cancelText: "知道了",
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false),
        })
      })

      if (confirmed) {
        wx.openSetting({
          success: (res) => {
            this.setData({
              locationAuthorized: !!res.authSetting["scope.userLocation"],
            })
          },
        })
      }
      return false
    }
  },

  onBack() {
    wx.navigateBack()
  },

  noop() {},

  async onUseCurrentLocation() {
    if (this.data.saving) {
      return
    }

    const authorized = await this.ensureLocationAuthorized()
    if (!authorized) {
      return
    }

    try {
      const location = await getLocationAsync()
      const nextUserInfo = await this.saveRegion({
        userLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        locationAuthorized: true,
        sourceType: "location",
      })

      if (!nextUserInfo) {
        return
      }

      wx.showToast({
        title: `已切换到${formatRegionLabel(nextUserInfo)}`,
        icon: "success",
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 280)
    } catch (err) {
      console.error("[regionSelect] get current location failed", err)
      wx.showToast({
        title: "获取当前位置失败",
        icon: "none",
      })
    }
  },

  async onChooseFromMap() {
    if (this.data.saving) {
      return
    }

    const authorized = await this.ensureLocationAuthorized()
    if (!authorized) {
      return
    }

    try {
      const current = await getLocationAsync().catch(() => null)
      const location = await chooseLocationAsync(
        current
          ? {
              latitude: current.latitude,
              longitude: current.longitude,
            }
          : {}
      )

      const nextUserInfo = await this.saveRegion({
        userLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        displayName: location.name || "",
        locationText: location.address || location.name || "",
        locationAuthorized: true,
        sourceType: "map",
      })

      if (!nextUserInfo) {
        return
      }

      wx.showToast({
        title: `已切换到${formatRegionLabel(nextUserInfo)}`,
        icon: "success",
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 280)
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes("cancel")) {
        return
      }
      console.error("[regionSelect] choose location failed", err)
      wx.showToast({
        title: "地图选点失败",
        icon: "none",
      })
    }
  },

  async onSelectRecent(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.recentDisplayList[index]
    if (!item || this.data.saving) {
      return
    }
    await this.selectRegionItem(item)
  },

  async onSelectRecommendedCity(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.recommendedCities[index]
    if (!item || this.data.saving) {
      return
    }
    await this.selectRegionItem({
      displayName: item.name,
      city: item.name,
      locationText: item.name,
      sourceType: "city",
    })
  },

  async onSelectAlphabetCity(e) {
    const cityName = e.currentTarget.dataset.city
    if (!cityName || this.data.saving) {
      return
    }
    await this.selectRegionItem({
      displayName: cityName,
      city: cityName,
      locationText: cityName,
      sourceType: "city",
    })
  },

  async onSelectSearchResult(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.searchResults[index]
    if (!item || this.data.saving) {
      return
    }
    await this.selectRegionItem(item)
  },

  async selectRegionItem(item) {
    const nextUserInfo = await this.saveRegion({
      displayName: item.displayName || item.title || "",
      province: item.province || "",
      city: item.city || "",
      district: item.district || "",
      adcode: item.adcode || "",
      locationText: item.locationText || item.subtitle || "",
      userLocation:
        item.latitude && item.longitude
          ? {
              latitude: item.latitude,
              longitude: item.longitude,
            }
          : null,
      sourceType: item.sourceType || "manual",
    })

    if (!nextUserInfo) {
      return
    }

    wx.showToast({
      title: `已切换到${formatRegionLabel(nextUserInfo)}`,
      icon: "success",
    })

    setTimeout(() => {
      wx.navigateBack()
    }, 280)
  },

  async saveRegion(payload) {
    const app = getApp()
    if (!(app.hasActiveSession && app.hasActiveSession())) {
      wx.redirectTo({ url: '/pages/login/login' })
      return null
    }

    this.setData({ saving: true })
    const previousUserInfo = getAppUserInfo() || {}

    try {
      const res = await wx.cloud.callFunction({
        name: "userManage",
        data: {
          action: "updateRegion",
          payload,
        },
      })

      const nextUserInfo =
        (res.result && res.result.success && res.result.userInfo) ||
        {
          ...previousUserInfo,
          ...payload,
        }

      app.setUserInfo(nextUserInfo)

      const selectedRegion = {
        displayName: nextUserInfo.displayName || payload.displayName || "",
        province: nextUserInfo.province || payload.province || "",
        city: nextUserInfo.city || payload.city || "",
        district: nextUserInfo.district || payload.district || "",
        locationText: nextUserInfo.locationText || payload.locationText || "",
        adcode: nextUserInfo.adcode || payload.adcode || "",
      }

      wx.setStorageSync("selectedRegion", selectedRegion)
      this.pushRecentRegion({
        ...selectedRegion,
        latitude: nextUserInfo.userLocation && nextUserInfo.userLocation.latitude,
        longitude: nextUserInfo.userLocation && nextUserInfo.userLocation.longitude,
        sourceType: payload.sourceType || "manual",
      })

      await this.syncRegionState()
      return nextUserInfo
    } catch (err) {
      console.error("[regionSelect] save region failed", err)
      wx.showToast({
        title: "保存地区失败",
        icon: "none",
      })
      return null
    } finally {
      this.setData({ saving: false })
    }
  },

  pushRecentRegion(source) {
    const nextItem = normalizeRecentItem(source)
    if (!nextItem.displayName) {
      return
    }

    const current = this.getRecentList()
    const deduped = current.filter((item) => {
      const sameName = item.displayName === nextItem.displayName
      const sameAddress = item.locationText === nextItem.locationText
      return !(sameName && sameAddress)
    })

    const nextList = [nextItem, ...deduped].slice(0, RECENT_REGION_LIMIT)
    wx.setStorageSync(RECENT_REGION_STORAGE_KEY, nextList)
  },
})
