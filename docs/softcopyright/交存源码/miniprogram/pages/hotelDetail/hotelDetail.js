const DEFAULT_HOTEL_COVER = '/images/nav-hotel.png'
const {
  resolveMediaSource,
  resolveMediaList,
} = require('../../utils/mediaAssets')
const {
  isFavorited,
  toggleFavorite,
  recordFootprint,
} = require('../../utils/collectionStore')

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

Page({
  data: {
    id: '',
    detail: null,
    favorited: false,
    favoriteIcon: '/images/icons/favorite-heart-outline.png',
    favoriteIconFilled: '/images/icons/favorite-heart-filled.png',
    text: {
      empty: '暂无酒店民宿数据',
      location: '位置与周边',
      price: '参考价格',
      score: '住客口碑',
      facilities: '设施服务',
      roomTypes: '房型参考',
      highlights: '住宿亮点',
      suitableGroups: '适合人群',
      description: '详情介绍',
      gallery: '图片展示',
      bookNow: '联系商家',
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
        favorited: isFavorited('hotel', detail._id),
      })
    }
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('hotels').doc(id).get()
      const detail = await this.normalizeDetail(res.data || null)
      const favorited = isFavorited('hotel', detail && detail._id)
      if (detail) {
        recordFootprint(this.buildCollectionRecord(detail))
      }

      this.setData({
        detail,
        favorited,
      })
    } catch (error) {
      console.error('[hotelDetail] load failed', error)
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

    const cover = await resolveMediaSource(detail.cover, DEFAULT_HOTEL_COVER)
    const gallery = await resolveMediaList(normalizeArray(detail.gallery), cover)
    const tags = normalizeArray(detail.tags).slice(0, 6)
    const facilities = normalizeArray(detail.facilities)
    const roomTypes = normalizeArray(detail.roomTypes)
    const highlights = normalizeArray(detail.highlights)
    const suitableGroups = normalizeArray(detail.suitableGroups)
    const regionText = [detail.province, detail.city, detail.district].filter(Boolean).join(' · ')
    const commentCount = Number(detail.commentCount || 0)
    const price = Number(detail.price || 0)
    const score = Number(detail.score || 0)

    return {
      ...detail,
      cover,
      gallery,
      tags,
      facilities,
      roomTypes,
      highlights,
      suitableGroups,
      regionText,
      locationText: detail.locationText || detail.address || regionText || '地点待补充',
      addressText: detail.address || '',
      priceText: price ? `¥${price}起` : '价格待定',
      scoreText: score ? `${score}分 · ${commentCount}人评价` : '点评待补充',
      titleScoreText: score ? `${score}分 · ${commentCount}人评价` : '',
      descriptionText: detail.description || detail.desc || detail.summary || '',
    }
  },

  buildCollectionRecord(detail) {
    if (!detail) {
      return null
    }

    return {
      type: 'hotel',
      id: detail._id,
      title: detail.name || detail.title,
      cover: detail.cover,
      city: detail.city || detail.province || detail.locationText,
      regionText: detail.regionText || detail.locationText,
      summary: detail.summary || detail.descriptionText,
      priceText: detail.priceText,
      metaText: detail.scoreText,
      badgeText: '酒店/民宿',
      scoreText: detail.scoreText,
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

  handleContact() {
    wx.showToast({
      title: '联系商家功能稍后接入',
      icon: 'none',
    })
  },
})
