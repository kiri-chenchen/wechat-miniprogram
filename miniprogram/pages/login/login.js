const app = getApp()

const TEXT = {
  loginFailed: '\u767b\u5f55\u5931\u8d25',
  loginRetry: '\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5',
  unsupportedLoginMethod: '\u4e0d\u652f\u6301\u7684\u767b\u5f55\u65b9\u5f0f',
  brandName: '\u519c\u65c5e\u7ad9',
  tagline: '\u4e61\u91ce\u98ce\u7269\u4e0e\u4e2a\u6027\u5316\u65c5\u7a0b\uff0c\u4ece\u8fd9\u91cc\u5f00\u59cb',
  heroTitle: '\u6388\u6743\u767b\u5f55\u540e\uff0c\u5feb\u901f\u5f00\u542f\u4f60\u7684\u4e13\u5c5e\u519c\u65c5\u4f53\u9a8c',
  titleWechat: '\u6b22\u8fce\u6765\u5230\u519c\u65c5e\u7ad9',
  descBeforeLogin: '\u4e00\u952e\u767b\u5f55\u540e\uff0c\u5373\u53ef\u7ee7\u7eed\u5b8c\u5584\u4f60\u7684\u519c\u65c5\u504f\u597d\u4e0e\u4e13\u5c5e\u884c\u7a0b\u3002',
  btnWechatLogin: '\u5fae\u4fe1\u4e00\u952e\u767b\u5f55',
  agreementSummary: '\u5df2\u9605\u8bfb\u5e76\u540c\u610f\u300a\u519c\u65c5e\u7ad9\u4e2a\u4eba\u4fe1\u606f\u4fdd\u62a4\u6307\u5f15\u300b\u3001\u300a\u519c\u65c5e\u7ad9\u7528\u6237\u670d\u52a1\u8bf4\u660e\u300b',
  footer: '\u767b\u5f55\u540e\u5c06\u7ee7\u7eed\u5b8c\u6210\u5b9a\u4f4d\u3001\u8d44\u6599\u548c\u519c\u65c5 DNA \u8bbe\u7f6e\u3002',
}

function mapCloudMessage(message) {
  const messageMap = {
    UNSUPPORTED_LOGIN_METHOD: TEXT.unsupportedLoginMethod,
  }
  return messageMap[message] || message
}

Page({
  data: {
    text: {
      brandName: TEXT.brandName,
      tagline: TEXT.tagline,
      heroTitle: TEXT.heroTitle,
      titleWechat: TEXT.titleWechat,
      descBeforeLogin: TEXT.descBeforeLogin,
      btnWechatLogin: TEXT.btnWechatLogin,
      agreementSummary: TEXT.agreementSummary,
      footer: TEXT.footer,
    },
    loading: false,
  },

  onShow() {
    const agreePrivacy = wx.getStorageSync('agreePrivacy')
    if (!agreePrivacy) {
      wx.redirectTo({ url: '/pages/welcome/welcome' })
      return
    }
    this.syncFromStorage()
  },

  syncFromStorage() {
    const currentUser = app.getUserInfo() || null
    if (currentUser && currentUser.openid) {
      this.finishLogin(currentUser)
    }
  },

  async onWechatLogin() {
    this.setData({ loading: true })
    try {
      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: { method: 'wechat' },
      })

      if (!loginRes.result.success) {
        wx.showToast({ title: mapCloudMessage(loginRes.result.message) || TEXT.loginFailed, icon: 'none' })
        return
      }

      app.setUserInfo(loginRes.result.userInfo)
      this.finishLogin(loginRes.result.userInfo)
    } catch (err) {
      console.error('[login] wechat login failed', err)
      wx.showToast({ title: TEXT.loginRetry, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  finishLogin(userInfo) {
    app.setUserInfo(userInfo)
    const target = app.getPostLoginTarget(userInfo)
    if (target === '/pages/home/home') {
      wx.switchTab({ url: target })
      return
    }
    wx.redirectTo({ url: target })
  },
})
