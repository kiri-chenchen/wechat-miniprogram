const {
  formatCommerceMessage,
  formatFenToYuan,
  runProductOrderPayment,
} = require('../../utils/commerce')

function formatDateTime(input) {
  if (!input) return ''
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  data: {
    id: '',
    detail: null,
    countdownText: '',
  },

  timer: null,

  onLoad(options) {
    this.setData({
      id: options.id || '',
    })
  },

  onShow() {
    this.loadDetail()
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  async loadDetail() {
    const id = this.data.id
    if (!id) return

    wx.showLoading({ title: '\u52a0\u8f7d\u4e2d' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productOrder',
        data: {
          action: 'detail',
          id,
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: formatCommerceMessage(res.result && res.result.message, '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      const order = this.decorateOrder((res.result.data && res.result.data.order) || null)
      this.setData({ detail: order }, () => this.setupCountdown())
    } catch (error) {
      console.error('[productOrderDetail] load failed', error)
      wx.showToast({
        title: '\u8ba2\u5355\u52a0\u8f7d\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  decorateOrder(order) {
    if (!order) return null
    return {
      ...order,
      goodsAmountText: formatFenToYuan(order.goodsAmount, { fallback: '\u5f85\u5b9a' }),
      shippingFeeText: order.shippingFee > 0 ? formatFenToYuan(order.shippingFee, { fallback: '\u5f85\u5b9a' }) : '\u5305\u90ae',
      payAmountText: formatFenToYuan(order.payAmount, { fallback: '\u5f85\u5b9a' }),
      createdAtText: formatDateTime(order.createdAt),
      paidAtText: formatDateTime(order.paidAt),
      shippedAtText: formatDateTime(order.shippedAt),
      items: (order.items || []).map((item) => ({
        ...item,
        unitPriceText: formatFenToYuan(item.unitPrice, { fallback: '\u5f85\u5b9a' }),
        subtotalText: formatFenToYuan(item.subtotal, { fallback: '\u5f85\u5b9a' }),
      })),
    }
  },

  setupCountdown() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const detail = this.data.detail
    if (!detail || detail.displayStatusKey !== 'pending_payment') return

    const update = () => {
      const left = Number(detail.paymentDeadline || 0) - Date.now()
      if (left <= 0) {
        this.setData({ countdownText: '00:00' })
        clearInterval(this.timer)
        this.timer = null
        this.loadDetail()
        return
      }

      const minutes = Math.floor(left / 1000 / 60)
      const seconds = Math.floor((left / 1000) % 60)
      this.setData({
        countdownText: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      })
    }

    update()
    this.timer = setInterval(update, 1000)
  },

  async cancelOrder() {
    wx.showModal({
      title: '\u53d6\u6d88\u8ba2\u5355',
      content: '\u786e\u8ba4\u53d6\u6d88\u8fd9\u7b14\u5f85\u652f\u4ed8\u8ba2\u5355\u5417\uff1f',
      success: async (res) => {
        if (!res.confirm) return
        await this.runOrderAction('cancel', { id: this.data.id }, '\u5df2\u53d6\u6d88')
      },
    })
  },

  async payOrder() {
    const result = await runProductOrderPayment(this.data.id)
    if (!result.success) {
      wx.showToast({
        title: formatCommerceMessage(result.message, '\u652f\u4ed8\u5931\u8d25'),
        icon: 'none',
      })
      return
    }

    if (result.cancelled) {
      wx.showToast({
        title: '\u8ba2\u5355\u4ecd\u4e3a\u5f85\u652f\u4ed8\u72b6\u6001',
        icon: 'none',
      })
    } else {
      wx.showToast({
        title: '\u652f\u4ed8\u6210\u529f',
        icon: 'success',
      })
    }
    this.loadDetail()
  },

  async shipOrder() {
    wx.showModal({
      title: '\u6a21\u62df\u53d1\u8d27',
      content: '\u786e\u8ba4\u5c06\u8fd9\u7b14\u5df2\u652f\u4ed8\u8ba2\u5355\u66f4\u65b0\u4e3a\u5f85\u6536\u8d27\u5417\uff1f',
      success: async (res) => {
        if (!res.confirm) return
        await this.runOrderAction('ship', { id: this.data.id }, '\u5df2\u6a21\u62df\u53d1\u8d27')
      },
    })
  },

  async confirmReceive() {
    wx.showModal({
      title: '\u786e\u8ba4\u6536\u8d27',
      content: '\u786e\u8ba4\u5df2\u7ecf\u6536\u5230\u5546\u54c1\u4e86\u5417\uff1f',
      success: async (res) => {
        if (!res.confirm) return
        await this.runOrderAction('confirmReceive', { id: this.data.id }, '\u5df2\u786e\u8ba4\u6536\u8d27')
      },
    })
  },

  goOrderList() {
    wx.navigateTo({
      url: '/pages/productOrderList/productOrderList?tab=all',
    })
  },

  async runOrderAction(action, payload, successTitle) {
    wx.showLoading({ title: '\u5904\u7406\u4e2d' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productOrder',
        data: {
          action,
          ...payload,
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: formatCommerceMessage(res.result && res.result.message, '\u64cd\u4f5c\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      wx.showToast({
        title: successTitle,
        icon: 'success',
      })
      await this.loadDetail()
    } catch (error) {
      console.error('[productOrderDetail] action failed', action, error)
      wx.showToast({
        title: '\u64cd\u4f5c\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },
})
