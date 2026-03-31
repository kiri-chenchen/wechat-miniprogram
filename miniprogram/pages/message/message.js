const app = getApp()
const {
  buildHomeRows,
  buildStoryList,
  formatConversationTime,
} = require('../../utils/messageStore')
const { resolveMediaSource } = require('../../utils/mediaAssets')

const DEFAULT_AVATAR = '/images/avatar.png'

Page({
  data: {
    statusBarHeight: 20,
    userAvatar: DEFAULT_AVATAR,
    storyList: [],
    homeRows: [],
  },

  onShow() {
    this.initNavMetrics()
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

  async refreshPage() {
    const userInfo = app.getUserInfo ? (app.getUserInfo() || {}) : {}
    const userAvatar = await resolveMediaSource(
      userInfo.avatarPreviewUrl || userInfo.avatarResolvedUrl || userInfo.avatarUrl || '',
      DEFAULT_AVATAR
    )

    const storyList = await Promise.all(
      buildStoryList().map(async (item) => ({
        ...item,
        avatarUrl: await resolveMediaSource(item.avatarUrl || '', ''),
        unreadText: item.unread > 99 ? '99+' : (item.unread > 0 ? String(item.unread) : ''),
      }))
    )

    const homeRows = await Promise.all(
      buildHomeRows().map(async (item) => ({
        ...item,
        avatarUrl: await resolveMediaSource(item.avatarUrl || '', ''),
        timeText: formatConversationTime(item.updatedAt),
        unreadText: item.unread > 99 ? '99+' : (item.unread > 0 ? String(item.unread) : ''),
      }))
    )

    this.setData({
      userAvatar,
      storyList,
      homeRows,
    })
  },

  onUserAvatarError() {
    this.setData({ userAvatar: DEFAULT_AVATAR })
  },

  openRow(e) {
    const { kind, entryType, id } = e.currentTarget.dataset
    if (kind === 'conversation') {
      wx.navigateTo({ url: `/pages/messageConversation/messageConversation?id=${id}` })
      return
    }
    if (entryType === 'buddy') {
      wx.navigateTo({ url: '/pages/messageBuddyApply/messageBuddyApply' })
    }
  },

  openStory(e) {
    const { noteId } = e.currentTarget.dataset
    if (noteId) {
      wx.navigateTo({ url: `/pages/noteDetail/noteDetail?id=${noteId}` })
    }
  },

  onMenuTap() {
    wx.showToast({ title: '菜单功能稍后接入', icon: 'none' })
  },

  onSearchTap() {
    wx.showToast({ title: '搜索功能稍后接入', icon: 'none' })
  },

  onAddTap() {
    wx.showActionSheet({
      itemList: ['去问小禾', '查看搭子申请'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/askXiaoheChat/askXiaoheChat' })
          return
        }
        wx.navigateTo({ url: '/pages/messageBuddyApply/messageBuddyApply' })
      },
    })
  },
})
