const {
  resolveActivityCover,
  resolveActivityGallery,
} = require('../../utils/mediaAssets')
const { buildActivityCoverTags } = require('../../utils/activityCoverTags')
const {
  isFavorited,
  toggleFavorite,
  recordFootprint,
} = require('../../utils/collectionStore')

Page({
  data: {
    detail: null,
    activityId: '',
    favorited: false,
    statusBarHeight: 20,
    favoriteIcon: '/images/icons/favorite-heart-outline.png',
    favoriteIconFilled: '/images/icons/favorite-heart-filled.png',
    text: {
      location: '活动地点',
      price: '参考价格',
      transport: '交通方式',
      stay: '住宿安排',
      travelMode: '旅行方式',
      playMode: '旅行玩法',
      suitableGroups: '适合人群',
      highlights: '活动亮点',
      itinerary: '行程安排',
      info: '活动信息',
      pickup: '接送服务',
      pickupPoint: '接送地点',
      address: '详细地址',
      phone: '联系电话',
      duration: '活动时长',
      region: '活动区域',
      description: '详细介绍',
      gallery: '活动图集',
      priceLabel: '参考价',
      bookNow: '立即报名',
      empty: '暂无活动数据',
    },
  },

  onLoad(options) {
    this.initNavMetrics()
    const id = options.id || ''
    this.setData({ activityId: id })
    if (id) {
      this.loadDetail(id)
    }
  },

  onShow() {
    const { activityId } = this.data
    if (activityId) {
      this.loadDetail(activityId)
    }
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20,
      })
    } catch (error) {
      this.setData({
        statusBarHeight: 20,
      })
    }
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getactivitydetail',
        data: { id },
      })
      const rawDetail = res.result?.data || null
      const detail = await this.normalizeDetail(rawDetail)
      const favorited = isFavorited('activity', detail && detail._id)
      if (detail) {
        recordFootprint(this.buildCollectionRecord(detail))
      }

      this.setData({
        detail,
        favorited,
      })
    } catch (error) {
      console.error('[activityDetail] load failed', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  async normalizeDetail(detail) {
    if (!detail) {
      return null
    }

    const cover = await resolveActivityCover(detail)
    const gallery = await resolveActivityGallery(detail)
    const tags = Array.isArray(detail.tags) ? detail.tags : []
    const travelModeTags = Array.isArray(detail.travelModeTags) ? detail.travelModeTags : []
    const playTags = Array.isArray(detail.playTags) ? detail.playTags : []
    const suitableGroups = Array.isArray(detail.suitableGroups) ? detail.suitableGroups : []
    const highlights = Array.isArray(detail.highlights) ? detail.highlights : []
    const itinerary = Array.isArray(detail.itinerary) ? detail.itinerary : []
    const regionText = [detail.province, detail.city, detail.district].filter(Boolean).join(' · ')
    const coverTagInfo = buildActivityCoverTags(detail)
    const priceValue = detail.priceFrom || detail.price || 0

    return {
      ...detail,
      cover,
      gallery,
      tags,
      travelModeTags,
      playTags,
      suitableGroups,
      highlights,
      itinerary,
      summary: detail.summary || detail.content || '',
      detailText: detail.detail || detail.content || '',
      regionText,
      durationText: coverTagInfo.durationTag,
      coverTags: coverTagInfo.tags,
      priceValue,
      priceText: priceValue ? `¥${priceValue}` : '待定',
      locationText: detail.locationName || regionText || '地点待补充',
      transportText: detail.transport || '待补充',
      stayText: detail.stay || '不含住宿',
      pickupText: detail.pickup ? '支持接送' : '不含接送',
      pickupPointText: detail.pickupPoint || '',
      addressText: detail.address || detail.locationName || regionText || '待补充',
      phoneText: detail.merchantPhone || detail.contactPhone || detail.phone || detail.tel || '待补充',
      traveledCount: detail.traveledCount || 0,
    }
  },

  buildCollectionRecord(detail) {
    if (!detail) {
      return null
    }

    return {
      type: 'activity',
      id: detail._id,
      title: detail.title,
      cover: detail.cover,
      city: detail.city || detail.province || detail.locationText,
      regionText: detail.regionText || detail.locationText,
      summary: detail.summary,
      priceText: detail.priceText,
      metaText: detail.durationText,
      badgeText: '活动',
      statsText: `${detail.traveledCount || 0}人已出行`,
    }
  },

  toggleFavorite() {
    const { detail } = this.data
    if (!detail || !detail._id) {
      return
    }

    const favorited = toggleFavorite(this.buildCollectionRecord(detail))
    this.setData({ favorited })
    wx.showToast({
      title: favorited ? '已收藏' : '已取消收藏',
      icon: 'none',
    })
  },

  previewGallery(e) {
    const current = e.currentTarget.dataset.src
    const urls = (this.data.detail && this.data.detail.gallery) || []
    if (!current || !urls.length) {
      return
    }

    wx.previewImage({
      current,
      urls,
    })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.switchTab({
      url: '/pages/home/home',
    })
  },

  handleBook() {
    const { detail } = this.data
    if (!detail || !detail._id) {
      wx.showToast({
        title: '数据还在加载，请稍后再试',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/book/book?id=${detail._id}`,
    })
  },
})
