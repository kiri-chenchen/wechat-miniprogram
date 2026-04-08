const TAB_MAP = {
  all: '/pages/productOrderList/productOrderList?tab=all',
  pending_payment: '/pages/productOrderList/productOrderList?tab=pending_payment',
  pending_trip: '/pages/myActivities/myActivities?tab=upcoming',
  pending_receive: '/pages/productOrderList/productOrderList?tab=shipped',
  refund_after_sale: '/pages/myActivities/myActivities?tab=after_sale',
}

Page({
  data: {
    redirecting: false,
  },

  onLoad(options) {
    this.redirectToTargetPage(options || {})
  },

  redirectToTargetPage(options = {}) {
    if (this.data.redirecting) return

    const tab = options.tab || 'all'
    const url = TAB_MAP[tab] || TAB_MAP.all
    this.setData({ redirecting: true })

    wx.redirectTo({
      url,
      fail: () => {
        this.setData({ redirecting: false })
        wx.showToast({
          title: '\u6253\u5f00\u8ba2\u5355\u9875\u5931\u8d25',
          icon: 'none',
        })
      },
    })
  },
})
