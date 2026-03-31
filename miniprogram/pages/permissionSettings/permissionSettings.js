const app = getApp()

const TEXT = {
  title: '\u5f00\u542f\u5b9a\u4f4d\u63a8\u8350\u9644\u8fd1\u5185\u5bb9',
  desc: '\u6211\u4eec\u4f1a\u6839\u636e\u4f60\u7684\u4f4d\u7f6e\u63a8\u8350\u9644\u8fd1\u7684\u4e61\u91ce\u6816\u5c45\u3001\u519c\u65c5\u5b9d\u5178\u5185\u5bb9\u548c\u6d3b\u52a8\u9879\u76ee\u3002\u62d2\u7edd\u6388\u6743\u4e5f\u53ef\u4ee5\u7ee7\u7eed\uff0c\u7cfb\u7edf\u4f1a\u5148\u5c55\u793a\u9ed8\u8ba4\u63a8\u8350\u3002',
  statusOn: '\u5f53\u524d\u72b6\u6001\uff1a\u5df2\u5f00\u542f\u5b9a\u4f4d',
  authorize: '\u5fae\u4fe1\u5b98\u65b9\u5b9a\u4f4d\u6388\u6743',
  skip: '\u5148\u8df3\u8fc7',
  keepSettings: '\u6682\u4e0d\u4fee\u6539',
  authorized: '\u5df2\u5f00\u542f\u5b9a\u4f4d',
  skipped: '\u672a\u5f00\u542f\u5b9a\u4f4d\uff0c\u53ef\u7a0d\u540e\u8bbe\u7f6e',
}

function getSettingAsync() {
  return new Promise((resolve, reject) => {
    wx.getSetting({ success: resolve, fail: reject })
  })
}

function authorizeLocationAsync() {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope: 'scope.userLocation',
      success: resolve,
      fail: reject,
    })
  })
}

function getLocationAsync(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('getLocation timeout'))
    }, timeout)

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        clearTimeout(timer)
        resolve(res)
      },
      fail: (err) => {
        clearTimeout(timer)
        reject(err)
      },
    })
  })
}

Page({
  data: {
    text: TEXT,
    mode: 'onboarding',
    loading: false,
    locationAuthorized: false,
  },

  onLoad(options) {
    if (!(app.hasActiveSession && app.hasActiveSession())) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    this.setData({
      mode: options.mode || 'onboarding',
    })
    this.checkLocationStatus()
  },

  async checkLocationStatus() {
    try {
      const setting = await getSettingAsync()
      this.setData({
        locationAuthorized: !!setting.authSetting['scope.userLocation'],
      })
    } catch (err) {
      console.error('[permission] check location status failed', err)
    }
  },

  async onAuthorizeLocation() {
    this.setData({ loading: true })
    console.log('[permission] start authorize location')

    try {
      await authorizeLocationAsync()
      console.log('[permission] authorize success')

      let userLocation = null
      try {
        const locationRes = await getLocationAsync()
        userLocation = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude,
        }
        wx.setStorageSync('userLocation', userLocation)
        console.log('[permission] get location success', userLocation)
      } catch (err) {
        console.warn('[permission] get location failed, continue onboarding', err)
      }

      await this.saveChoice(true, userLocation)
      wx.showToast({
        title: TEXT.authorized,
        icon: 'success',
      })
    } catch (err) {
      console.error('[permission] authorize location failed', err)
      wx.showToast({
        title: TEXT.skipped,
        icon: 'none',
      })
      await this.saveChoice(false, null)
    } finally {
      this.setData({ loading: false })
    }
  },

  async onSkipLocation() {
    this.setData({ loading: true })
    await this.saveChoice(false, null)
    this.setData({ loading: false })
  },

  async saveChoice(locationAuthorized, location) {
    if (!(app.hasActiveSession && app.hasActiveSession())) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    console.log('[permission] save choice', { locationAuthorized, location })

    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'updateOnboarding',
          payload: {
            locationAuthorized,
            locationChoiceMade: true,
            userLocation: location || null,
          },
        },
      })

      console.log('[permission] save choice result', res)

      if (res.result && res.result.success) {
        app.setUserInfo(res.result.userInfo)
      }
    } catch (err) {
      console.error('[permission] save location choice failed', err)
    }

    if (this.data.mode === 'settings') {
      wx.navigateBack()
      return
    }

    wx.redirectTo({
      url: '/pages/dnaTag/dnaTag?mode=setup',
    })
  },
})
