const {
  formatCommerceMessage,
  formatFenToYuan,
} = require('../../utils/commerce')

const TAB_CONFIG = [
  { key: 'all', label: '\u5168\u90e8' },
  { key: 'pending_payment', label: '\u5f85\u652f\u4ed8' },
  { key: 'paid', label: '\u5f85\u53d1\u8d27' },
  { key: 'shipped', label: '\u5f85\u6536\u8d27' },
  { key: 'completed', label: '\u5df2\u5b8c\u6210' },
  { key: 'cancelled', label: '\u5df2\u53d6\u6d88' },
  { key: 'closed', label: '\u5df2\u5173\u95ed' },
]

const TAB_ALIAS_MAP = {
  pending_receive: 'shipped',
  pending_delivery: 'paid',
}

const EMPTY_COPY = {
  all: { title: '\u6682\u65e0\u5546\u54c1\u8ba2\u5355', desc: '\u4e0b\u5355\u540e\u7684\u5546\u54c1\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
  pending_payment: { title: '\u6682\u65e0\u5f85\u652f\u4ed8\u8ba2\u5355', desc: '\u8fd8\u6ca1\u6709\u672a\u652f\u4ed8\u7684\u5546\u54c1\u8ba2\u5355\u3002' },
  paid: { title: '\u6682\u65e0\u5f85\u53d1\u8d27\u8ba2\u5355', desc: '\u5df2\u652f\u4ed8\u5f85\u53d1\u8d27\u7684\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
  shipped: { title: '\u6682\u65e0\u5f85\u6536\u8d27\u8ba2\u5355', desc: '\u5df2\u53d1\u8d27\u5f85\u6536\u8d27\u7684\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
  completed: { title: '\u6682\u65e0\u5df2\u5b8c\u6210\u8ba2\u5355', desc: '\u5df2\u786e\u8ba4\u6536\u8d27\u7684\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
  cancelled: { title: '\u6682\u65e0\u5df2\u53d6\u6d88\u8ba2\u5355', desc: '\u4f60\u53d6\u6d88\u7684\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
  closed: { title: '\u6682\u65e0\u5df2\u5173\u95ed\u8ba2\u5355', desc: '\u8d85\u65f6\u672a\u652f\u4ed8\u5173\u95ed\u7684\u8ba2\u5355\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002' },
}

function normalizeTabKey(rawTab = 'all') {
  const tab = TAB_ALIAS_MAP[rawTab] || rawTab
  return TAB_CONFIG.some((item) => item.key === tab) ? tab : 'all'
}

function formatDateTime(input) {
  if (!input) return ''
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function mapOrder(item = {}) {
  const firstItem = (item.items || [])[0] || {}
  return {
    ...item,
    statusClass: item.displayStatusKey || '',
    orderTypeText: '\u5546\u54c1\u8ba2\u5355',
    title: firstItem.title || item.merchantName || '\u672a\u547d\u540d\u5546\u54c1',
    cover: firstItem.cover || '/images/default-goods-image.png',
    summary: `${(item.items || []).length}\u4ef6\u5546\u54c1 · ${item.merchantName || '\u5e73\u53f0\u81ea\u8425'}`,
    createdAtText: formatDateTime(item.createdAt),
    payAmountText: formatFenToYuan(item.payAmount, { fallback: '\u5f85\u5b9a' }),
  }
}

Page({
  data: {
    tabs: TAB_CONFIG,
    currentTab: 'all',
    displayList: [],
    emptyTitle: EMPTY_COPY.all.title,
    emptyDesc: EMPTY_COPY.all.desc,
  },

  onLoad(options) {
    this.setData({
      currentTab: normalizeTabKey(options.tab || 'all'),
    })
  },

  onShow() {
    this.loadOrders()
  },

  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    if (!tab) return
    this.setData({ currentTab: normalizeTabKey(tab) }, () => this.loadOrders())
  },

  async loadOrders() {
    const status = this.data.currentTab === 'all' ? '' : this.data.currentTab
    wx.showLoading({ title: '\u52a0\u8f7d\u4e2d' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productOrder',
        data: {
          action: 'listMine',
          status,
          page: 1,
          pageSize: 100,
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: formatCommerceMessage(res.result && res.result.message, '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      const displayList = ((res.result.data && res.result.data.list) || []).map(mapOrder)
      const copy = EMPTY_COPY[this.data.currentTab] || EMPTY_COPY.all
      this.setData({
        displayList,
        emptyTitle: copy.title,
        emptyDesc: copy.desc,
      })
    } catch (error) {
      console.error('[productOrderList] load failed', error)
      wx.showToast({
        title: '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/productOrderDetail/productOrderDetail?id=${id}`,
    })
  },
})
