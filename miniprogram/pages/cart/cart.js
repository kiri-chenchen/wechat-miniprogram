const {
  formatCommerceMessage,
  formatFenToYuan,
} = require('../../utils/commerce')

Page({
  data: {
    groups: [],
    loading: false,
    empty: true,
    summaryText: '\u5f85\u5b9a',
    selectedCount: 0,
  },

  onShow() {
    this.loadCart()
  },

  async loadCart() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productCart',
        data: {
          action: 'list',
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: formatCommerceMessage(res.result && res.result.message, '\u8d2d\u7269\u8f66\u52a0\u8f7d\u5931\u8d25'),
          icon: 'none',
        })
        return
      }

      const groups = this.decorateGroups((res.result.data && res.result.data.groups) || [])
      this.setData({
        groups,
        empty: groups.length === 0,
      })
      this.buildSummary(groups)
    } catch (error) {
      console.error('[cart] load failed', error)
      wx.showToast({
        title: '\u8d2d\u7269\u8f66\u52a0\u8f7d\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  decorateGroups(groups = []) {
    return groups.map((group) => ({
      ...group,
      items: (group.items || []).map((item) => {
        const unitPrice = Number((item.productSnapshot && item.productSnapshot.price) || 0)
        const quantity = Number(item.quantity || 0)
        const subtotalFen = unitPrice * quantity
        return {
          ...item,
          subtotalFen,
          subtotalText: formatFenToYuan(subtotalFen, {
            fallback: '\u5f85\u5b9a',
          }),
          unitPriceText: formatFenToYuan(unitPrice, {
            fallback: '\u5f85\u5b9a',
          }),
        }
      }),
    }))
  },

  buildSummary(groups = this.data.groups) {
    let totalFen = 0
    let selectedCount = 0

    groups.forEach((group) => {
      ;(group.items || []).forEach((item) => {
        if (item.selected && item.isPurchasable) {
          selectedCount += 1
          totalFen += Number(item.subtotalFen || 0)
        }
      })
    })

    this.setData({
      summaryText: formatFenToYuan(totalFen, { fallback: '\u5f85\u5b9a' }),
      selectedCount,
    })
  },

  async toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    const selected = !!e.currentTarget.dataset.selected
    await this.runCartAction('toggleSelect', {
      cartItemId: id,
      selected: !selected,
    })
  },

  async changeQuantity(e) {
    const id = e.currentTarget.dataset.id
    const quantity = Number(e.currentTarget.dataset.quantity || 0)
    const delta = Number(e.currentTarget.dataset.delta || 0)
    const nextQuantity = quantity + delta
    if (nextQuantity <= 0) {
      return
    }
    await this.runCartAction('updateQty', {
      cartItemId: id,
      quantity: nextQuantity,
    })
  },

  async removeItem(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '\u5220\u9664\u5546\u54c1',
      content: '\u786e\u8ba4\u5c06\u8fd9\u4e2a\u5546\u54c1\u79fb\u51fa\u8d2d\u7269\u8f66\u5417\uff1f',
      success: async (res) => {
        if (!res.confirm) return
        await this.runCartAction('remove', {
          cartItemId: id,
        })
      },
    })
  },

  async runCartAction(action, payload) {
    wx.showLoading({ title: '\u5904\u7406\u4e2d' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'productCart',
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

      await this.loadCart()
    } catch (error) {
      console.error('[cart] action failed', action, error)
      wx.showToast({
        title: '\u64cd\u4f5c\u5931\u8d25',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  goCheckout() {
    const selectedGroups = this.data.groups
      .map((group) => ({
        merchantOpenid: group.merchantOpenid,
        selectedItems: (group.items || []).filter((item) => item.selected && item.isPurchasable),
      }))
      .filter((group) => group.selectedItems.length > 0)

    if (!selectedGroups.length) {
      wx.showToast({
        title: '\u8bf7\u5148\u9009\u62e9\u5546\u54c1',
        icon: 'none',
      })
      return
    }

    if (selectedGroups.length > 1) {
      wx.showToast({
        title: '\u6682\u4e0d\u652f\u6301\u8de8\u5546\u5bb6\u5408\u5e76\u7ed3\u7b97',
        icon: 'none',
      })
      return
    }

    const cartItemIds = selectedGroups[0].selectedItems
      .map((item) => item._id)
      .filter(Boolean)
      .join(',')

    wx.navigateTo({
      url: `/pages/confirmOrder/confirmOrder?source=cart&cartItemIds=${encodeURIComponent(cartItemIds)}`,
    })
  },

  goMall() {
    wx.navigateTo({
      url: '/pages/mall/mall',
    })
  },
})
