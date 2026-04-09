const { resolveKnowledgeArticleMedia } = require('../../utils/knowledgeArticle')

const DEFAULT_TAB = 'agri'

Page({
  data: {
    loading: true,
    activeTab: DEFAULT_TAB,
    currentCategory: '全部',
    categories: [],
    filteredList: [],
    heroCover: '',
  },

  onLoad() {
    this.fullList = []
    this.loadArticles()
  },

  onPullDownRefresh() {
    this.loadArticles().finally(() => wx.stopPullDownRefresh())
  },

  async loadArticles() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getknowledgearticles',
        data: {
          channel: this.data.activeTab,
        },
      })

      const result = (res || {}).result || {}
      if (!result.ok) {
        throw new Error(result.error || 'load articles failed')
      }

      const resolvedList = await Promise.all(
        (result.list || []).map((item) => resolveKnowledgeArticleMedia(item))
      )

      const categories = Array.isArray(result.categories) && result.categories.length
        ? result.categories
        : ['全部']

      this.fullList = resolvedList
      this.setData({
        loading: false,
        categories,
        heroCover: (resolvedList[0] && resolvedList[0].cover) || '',
      })
      this.applyCategory(this.data.currentCategory)
    } catch (err) {
      console.error('[academy] load articles failed', err)
      this.fullList = []
      this.setData({
        loading: false,
        categories: ['全部'],
        currentCategory: '全部',
        filteredList: [],
        heroCover: '',
      })
      wx.showToast({
        title: '文章加载失败',
        icon: 'none',
      })
    }
  },

  applyCategory(category) {
    const currentCategory = category || '全部'
    const sourceList = this.fullList || []
    const filteredList = currentCategory === '全部'
      ? sourceList
      : sourceList.filter((item) => (item.tags || []).includes(currentCategory))

    this.setData({
      currentCategory,
      filteredList,
    })
  },

  async switchTab(e) {
    const activeTab = e.currentTarget.dataset.tab
    if (!activeTab || activeTab === this.data.activeTab) {
      return
    }

    this.fullList = []
    this.setData({
      activeTab,
      currentCategory: '全部',
      categories: [],
      filteredList: [],
      heroCover: '',
    })

    await this.loadArticles()
  },

  switchCategory(e) {
    const currentCategory = e.currentTarget.dataset.category || '全部'
    this.applyCategory(currentCategory)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/pages/knowledgeDetail/knowledgeDetail?id=${id}`,
    })
  },
})
