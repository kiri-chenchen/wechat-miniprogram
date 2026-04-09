const {
  isFavorited,
  toggleFavorite,
  recordFootprint,
} = require('../../utils/collectionStore')
const {
  resolveMediaSource,
  resolveMediaList,
} = require('../../utils/mediaAssets')

Page({
  data: {
    id: '',
    detail: null,
    favorited: false,
    favoriteIcon: '/images/icons/favorite-heart-outline.png',
    favoriteIconFilled: '/images/icons/favorite-heart-filled.png',
    text: {
      empty: '暂无景点数据',
      location: '景点地点',
      openTime: '开放时间',
      price: '参考门票',
      highlights: '景点亮点',
      tips: '游玩提示',
      description: '详细介绍',
      gallery: '景点图集',
    },
  },

  onLoad(options) {
    const id = options.id || ''
    this.setData({ id })
    if (id) {
      this.loadDetail(id)
    }
  },

  onShow() {
    const { detail } = this.data
    if (detail && detail._id) {
      this.setData({
        favorited: isFavorited('scenic', detail._id),
      })
    }
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('scenics').doc(id).get()
      const detail = await this.normalizeDetail(res.data || null)
      const favorited = isFavorited('scenic', detail && detail._id)
      if (detail) {
        recordFootprint(this.buildCollectionRecord(detail))
      }

      this.setData({
        detail,
        favorited,
      })
    } catch (error) {
      console.error('[scenicDetail] load failed', error)
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

    const fallbackCover = '/images/nav-academy.png'
    const cover = await resolveMediaSource(detail.cover, fallbackCover)
    const rawGallery = Array.isArray(detail.gallery) && detail.gallery.length
      ? detail.gallery
      : [detail.cover || fallbackCover]
    const gallery = await resolveMediaList(rawGallery, cover)
    const tags = []
      .concat(Array.isArray(detail.tags) ? detail.tags : [])
      .concat(Array.isArray(detail.playTags) ? detail.playTags : [])
      .slice(0, 6)
    const regionText = [detail.province, detail.city, detail.district].filter(Boolean).join(' · ')

    return {
      ...detail,
      cover,
      gallery,
      tags,
      regionText,
      locationText: detail.locationName || regionText || '地点待补充',
      priceText: detail.priceFrom ? `¥${detail.priceFrom}起` : '免费或现场咨询',
      openTimeText: detail.openTime || '以现场公示为准',
      highlights: Array.isArray(detail.highlights) ? detail.highlights : [],
      tipsText: detail.tips || '',
      descriptionText: detail.content || detail.summary || '',
    }
  },

  buildCollectionRecord(detail) {
    if (!detail) {
      return null
    }

    return {
      type: 'scenic',
      id: detail._id,
      title: detail.title,
      cover: detail.cover,
      city: detail.city || detail.province || detail.locationText,
      regionText: detail.regionText || detail.locationText,
      summary: detail.summary || detail.descriptionText,
      priceText: detail.priceText,
      metaText: detail.openTimeText,
      badgeText: '景点',
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
})
