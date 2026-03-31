const {
  getInteractiveList,
  getMessageState,
  getNewFollowers,
  formatConversationTime,
  markInteractionsRead,
} = require('../../utils/messageStore')

Page({
  data: {
    statusBarHeight: 20,
    activeTab: 'interactive',
    selectedFilterKey: 'all',
    showFilterPanel: false,
    badgeCount: 0,
    filterOptions: [],
    interactionList: [],
    followerList: [],
  },

  onShow() {
    this.initNavMetrics()
    markInteractionsRead()
    this.refreshPage()
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: systemInfo.statusBarHeight || 20 })
    } catch (error) {
      this.setData({ statusBarHeight: 20 })
    }
  },

  refreshPage() {
    const state = getMessageState()
    const selectedFilter = (state.interactiveFilters || []).find((item) => item.key === this.data.selectedFilterKey)
    this.setData({
      badgeCount: (state.interactions || []).filter((item) => !item.read).length
        + (state.newFollowers || []).filter((item) => !item.read).length,
      filterOptions: state.interactiveFilters || [],
      interactionList: getInteractiveList(selectedFilter ? selectedFilter.key : 'all').map((item) => ({
        ...item,
        timeText: formatConversationTime(item.updatedAt),
      })),
      followerList: getNewFollowers().map((item) => ({
        ...item,
        timeText: formatConversationTime(item.followAt),
      })),
    })
  },

  goBack() {
    wx.navigateBack()
  },

  switchToFollower() {
    this.setData({ activeTab: 'follower', showFilterPanel: false })
  },

  toggleFilterPanel() {
    if (this.data.activeTab !== 'interactive') {
      this.setData({
        activeTab: 'interactive',
        showFilterPanel: false,
      })
      return
    }
    this.setData({ showFilterPanel: !this.data.showFilterPanel })
  },

  selectFilter(e) {
    this.setData({
      selectedFilterKey: e.currentTarget.dataset.key,
      showFilterPanel: false,
      activeTab: 'interactive',
    }, () => this.refreshPage())
  },

  closePanel() {
    this.setData({ showFilterPanel: false })
  },

  onInteractionAction() {
    wx.showToast({ title: '互动操作先做静态展示', icon: 'none' })
  },

  onFollowBack() {
    wx.showToast({ title: '回关功能后续接真实关系链', icon: 'none' })
  },
})
