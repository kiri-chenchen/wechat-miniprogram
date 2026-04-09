const TAB_CONFIG = [
  { key: 'all', label: 'All' },
  { key: 'pending_payment', label: 'To Pay' },
  { key: 'pending_trip', label: 'Upcoming' },
  { key: 'pending_receive', label: 'To Receive' },
  { key: 'refund_after_sale', label: 'Refunds' },
]

const DEFAULT_ORDER_COVER = '/images/activities/lz-yuzhong-strawberry-family-day.jpg'

const EMPTY_COPY = {
  all: { title: 'No orders', desc: 'Your orders will appear here.' },
  pending_payment: { title: 'No pending payments', desc: 'Unpaid orders will appear here.' },
  pending_trip: { title: 'No upcoming trips', desc: 'Paid activity orders will appear here.' },
  pending_receive: { title: 'No deliveries', desc: 'Product delivery flow is not connected yet.' },
  refund_after_sale: { title: 'No refunds', desc: 'Refunding and cancelled orders will appear here.' },
}

function pad(num) {
  return String(num).padStart(2, '0')
}

function formatDateTime(input) {
  if (!input) return 'Time unavailable'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toMoney(value) {
  return Number(value || 0).toFixed(2)
}

function mapOrder(item) {
  const statusKey = item.displayStatusKey
  const bucketMap = {
    pending_payment: 'pending_payment',
    upcoming: 'pending_trip',
    pending_review: 'all',
    refunding: 'refund_after_sale',
    cancelled: 'refund_after_sale',
    completed: 'all',
  }

  return {
    ...item,
    orderType: 'activity',
    orderTypeText: 'Activity Order',
    title: item.activityTitle || 'Untitled Activity',
    cover: item.activityCover || item.cover || DEFAULT_ORDER_COVER,
    summary: item.travelDate ? `Travel date ${item.travelDate}` : 'Activity order',
    createdAtValue: new Date(item.createdAt || 0).getTime() || 0,
    createdAtText: formatDateTime(item.createdAt),
    totalPriceText: toMoney(item.totalPrice),
    statusBucket: bucketMap[statusKey] || 'all',
    statusClass: statusKey || 'success',
  }
}

Page({
  data: {
    tabs: TAB_CONFIG,
    currentTab: 'all',
    rawList: [],
    displayList: [],
    emptyTitle: EMPTY_COPY.all.title,
    emptyDesc: EMPTY_COPY.all.desc,
  },

  onLoad(options) {
    const tab = options.tab || 'all'
    this.setData({
      currentTab: TAB_CONFIG.some((item) => item.key === tab) ? tab : 'all',
    })
  },

  onShow() {
    this.loadOrders()
  },

  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    this.setData({ currentTab: tab }, () => this.buildDisplayList())
  },

  async loadOrders() {
    wx.showLoading({ title: 'Loading' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'activityOrder',
        data: { action: 'listMine', page: 1, pageSize: 100 },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({ title: (res.result && res.result.message) || 'Load failed', icon: 'none' })
        return
      }

      const orders = (res.result.data || []).map(mapOrder)
      orders.sort((a, b) => (b.createdAtValue || 0) - (a.createdAtValue || 0))
      this.setData({ rawList: orders }, () => this.buildDisplayList())
    } catch (error) {
      console.error('[myOrders] load orders failed', error)
      wx.showToast({ title: 'Load failed', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  buildDisplayList() {
    const { currentTab, rawList } = this.data
    let list = rawList

    if (currentTab === 'pending_payment') list = rawList.filter((item) => item.statusBucket === 'pending_payment')
    if (currentTab === 'pending_trip') list = rawList.filter((item) => item.statusBucket === 'pending_trip')
    if (currentTab === 'pending_receive') list = rawList.filter((item) => item.statusBucket === 'pending_receive')
    if (currentTab === 'refund_after_sale') list = rawList.filter((item) => item.statusBucket === 'refund_after_sale')

    const copy = EMPTY_COPY[currentTab] || EMPTY_COPY.all
    this.setData({
      displayList: list,
      emptyTitle: copy.title,
      emptyDesc: copy.desc,
    })
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    wx.navigateTo({ url: `/pages/activityOrderDetail/activityOrderDetail?id=${id}` })
  },
})
