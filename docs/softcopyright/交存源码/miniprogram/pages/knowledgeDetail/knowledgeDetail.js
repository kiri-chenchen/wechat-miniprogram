const { resolveKnowledgeArticleMedia, normalizeArray } = require('../../utils/knowledgeArticle')
const {
  isFavorited,
  toggleFavorite,
  recordFootprint,
} = require('../../utils/collectionStore')

Page({
  data: {
    loading: true,
    article: null,
    liked: false,
    favorited: false,
    commentInput: '',
    commentList: [],
    favoriteIcon: '/images/icons/favorite-heart-outline.png',
    favoriteIconFilled: '/images/icons/favorite-heart-filled.png',
  },

  onLoad(options = {}) {
    this.articleId = options.id || ''
    this.loadArticle()
  },

  onShow() {
    const article = this.data.article
    if (article && article.id) {
      this.setData({
        favorited: isFavorited('knowledge', article.id),
      })
    }
  },

  async loadArticle() {
    if (!this.articleId) {
      wx.showToast({ title: '文章不存在', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getknowledgearticledetail',
        data: {
          id: this.articleId,
        },
      })

      const result = (res || {}).result || {}
      if (!result.ok || !result.data) {
        throw new Error(result.error || 'article not found')
      }

      const article = await resolveKnowledgeArticleMedia(result.data)
      const likeState = wx.getStorageSync(`knowledge_like_${article.id}`) || false
      const favState = isFavorited('knowledge', article.id)
      const storedComments =
        wx.getStorageSync(`knowledge_comments_${article.id}`) || normalizeArray(article.commentList)

      recordFootprint(this.buildCollectionRecord(article))

      this.setData({
        loading: false,
        article,
        liked: likeState,
        favorited: favState,
        commentList: storedComments,
      })
    } catch (err) {
      console.error('[knowledgeDetail] load article failed', err)
      this.setData({
        loading: false,
        article: null,
      })
      wx.showToast({ title: '文章加载失败', icon: 'none' })
    }
  },

  buildCollectionRecord(article) {
    if (!article) {
      return null
    }

    const location = article.location || {}
    return {
      type: 'knowledge',
      id: article.id,
      title: article.title,
      cover: article.cover,
      city: article.city || location.city || location.name || article.author,
      regionText: location.address || location.name || '',
      summary: article.summary,
      metaText: `${article.publishTime || ''}${article.views ? ` · ${article.views}阅读` : ''}`,
      badgeText: '笔记/推文',
      author: article.author,
      statsText: `${Number(article.likes || 0)}赞 · ${Number(article.favorites || 0)}收藏`,
    }
  },

  toggleLike() {
    const article = this.data.article
    if (!article) {
      return
    }

    const liked = !this.data.liked
    const likes = Number(article.likes || 0) + (liked ? 1 : -1)
    wx.setStorageSync(`knowledge_like_${article.id}`, liked)
    this.setData({
      liked,
      'article.likes': Math.max(likes, 0),
    })
  },

  toggleFavorite() {
    const article = this.data.article
    if (!article) {
      return
    }

    const baseFavorites = Number(article.favorites || 0)
    const favorited = toggleFavorite(this.buildCollectionRecord(article))
    this.setData({
      favorited,
      'article.favorites': Math.max(baseFavorites + (favorited ? 1 : -1), 0),
    })
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  submitComment() {
    const article = this.data.article
    const value = String(this.data.commentInput || '').trim()
    if (!article || !value) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    const comment = {
      user: '微信用户',
      content: value,
      time: '刚刚',
    }
    const commentList = [comment, ...this.data.commentList]
    wx.setStorageSync(`knowledge_comments_${article.id}`, commentList)
    this.setData({
      commentInput: '',
      commentList,
    })
    wx.showToast({ title: '评论成功', icon: 'success' })
  },

  focusComment() {
    wx.pageScrollTo({
      selector: '.comment-section',
      duration: 300,
    })
  },

  openMap() {
    const location = (this.data.article || {}).location
    if (!location) {
      return
    }

    wx.openLocation({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      name: location.name,
      address: location.address,
      scale: 16,
    })
  },

  onShareAppMessage() {
    const article = this.data.article || {}
    this.setData({
      'article.shareCount': Number(article.shareCount || 0) + 1,
    })

    return {
      title: article.title || '农旅宝典',
      path: `/pages/knowledgeDetail/knowledgeDetail?id=${article.id}`,
      imageUrl: article.cover || '',
    }
  },
})
