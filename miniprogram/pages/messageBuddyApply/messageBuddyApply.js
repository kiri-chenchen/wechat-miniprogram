const { getBuddyApplications, formatConversationTime } = require('../../utils/messageStore')
const { resolveMediaSource } = require('../../utils/mediaAssets')

Page({
  data: {
    list: [],
  },

  async onShow() {
    const list = await Promise.all(
      getBuddyApplications().map(async (item) => ({
        ...item,
        avatarUrl: await resolveMediaSource(item.avatarUrl || '', ''),
        timeText: formatConversationTime(item.updatedAt),
        unreadText: item.unread > 99 ? '99+' : (item.unread > 0 ? String(item.unread) : ''),
        directionText: item.direction === 'outgoing' ? '我发起的申请' : '收到的申请',
      }))
    )

    this.setData({ list })
  },

  openDetail(e) {
    wx.navigateTo({ url: `/pages/messageBuddyApplyChat/messageBuddyApplyChat?id=${e.currentTarget.dataset.id}` })
  },
})
