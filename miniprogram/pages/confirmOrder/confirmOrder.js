const {
  formatCommerceMessage,
  formatFenToYuan,
  runProductOrderPayment,
} = require('../../utils/commerce')

function parseCartItemIds(raw = '') {
  return decodeURIComponent(String(raw || ''))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

Page({
  data: {
    source: 'buy_now',
    productId: '',
    quantity: 1,
    cartItemIds: [],
    preview: null,
    address: null,
    remark: '',
    submitting: false,
  },

  onLoad(options) {
    this.setData({
      source: options.source || 'buy_now',
      productId: options.productId || '',
      quantity: Number(options.quantity || 1),
      cartItemIds: parseCartItemIds(options.cartItemIds || ''),
    })
  },

  onShow() {
    this.loadPreview()
  },

  buildOrderPayload(action) {
    const payload = {
      action,
      source: this.data.source,
      addressId: this.data.address && this.data.address._id,
    }

    if (this.data.source === 'buy_now') {
      payload.items = [
        {
          productId: this.data.productId,
          quantity: this.data.quantity,
        },
      ]
    }

    if (this.data.source === 'cart' && this.data.cartItemIds.length) {
      payload.cartItemIds = this.data.cartItemIds
    }

    return payload
  },

  async loadPreview() {
    wx.showLoading({ title: '\u52a0\u8f7d\u4e2d' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productOrder',
        data: this.buildOrderPayload('preview'),
      })

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: formatCommerceMessage(res.result && res.result.message, '\u8ba2\u5355\u9884\u89c8\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      const preview = res.result.data || {}
      this.setData({
        preview: this.decoratePreview(preview),
        address: preview.address || null,
      })
    } catch (error) {
      console.error('[confirmOrder] preview failed', error)
      wx.showToast({
        title: '\u8ba2\u5355\u9884\u89c8\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  decoratePreview(preview = {}) {
    return {
      ...preview,
      goodsAmountText: formatFenToYuan(preview.goodsAmount, { fallback: '\u5f85\u5b9a' }),
      shippingFeeText: preview.shippingFee > 0 ? formatFenToYuan(preview.shippingFee, { fallback: '\u5f85\u5b9a' }) : '\u5305\u90ae',
      payAmountText: formatFenToYuan(preview.payAmount, { fallback: '\u5f85\u5b9a' }),
      items: (preview.items || []).map((item) => ({
        ...item,
        unitPriceText: formatFenToYuan(item.unitPrice, { fallback: '\u5f85\u5b9a' }),
        subtotalText: formatFenToYuan(item.subtotal, { fallback: '\u5f85\u5b9a' }),
      })),
    }
  },

  chooseAddress() {
    wx.navigateTo({
      url: '/pages/addressList/addressList?select=1',
      success: (res) => {
        res.eventChannel.on('addressSelected', ({ address }) => {
          this.setData({ address }, () => this.loadPreview())
        })
      },
    })
  },

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value,
    })
  },

  async submitOrder() {
    if (this.data.submitting) return
    if (!this.data.address || !this.data.address._id) {
      wx.showToast({
        title: '\u8bf7\u5148\u9009\u62e9\u6536\u8d27\u5730\u5740',
        icon: 'none',
      })
      return
    }

    const payload = {
      ...this.buildOrderPayload('create'),
      addressId: this.data.address._id,
      remark: this.data.remark.trim(),
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '\u63d0\u4ea4\u4e2d' })
    try {
      const createRes = await wx.cloud.callFunction({
        name: 'productOrder',
        data: payload,
      })

      if (!createRes.result || !createRes.result.success) {
        wx.showToast({
          title: formatCommerceMessage(createRes.result && createRes.result.message, '\u4e0b\u5355\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      const order = (createRes.result.data && createRes.result.data.order) || null
      const orderId = order && order._id
      if (!orderId) {
        wx.showToast({
          title: '\u4e0b\u5355\u5931\u8d25',
          icon: 'none',
        })
        return
      }

      const payResult = await runProductOrderPayment(orderId)
      if (!payResult.success) {
        wx.showToast({
          title: formatCommerceMessage(payResult.message, '\u652f\u4ed8\u5931\u8d25'),
          icon: 'none',
        })
      }

      wx.redirectTo({
        url: `/pages/productOrderDetail/productOrderDetail?id=${orderId}`,
      })
    } catch (error) {
      console.error('[confirmOrder] create failed', error)
      wx.showToast({
        title: '\u4e0b\u5355\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      this.setData({ submitting: false })
      wx.hideLoading()
    }
  },
})
