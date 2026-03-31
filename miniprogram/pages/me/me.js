const app = getApp()
const { resolveMediaSource } = require('../../utils/mediaAssets')

const DEFAULT_LOGGED_IN_AVATAR = '/images/avatar.png'
const GUEST_AVATAR = '/images/me/guest-avatar.png'

const TEXT = {
  defaultNickname: 'e位旅客',
  guestHint: '登录开启我的专属农旅体验',
  authLogin: '授权登录',
  editProfile: '修改个人资料',
  myDNA: '农旅DNA',
  dnaPlaceholder: '点击查看和调整你的专属标签',
  dnaPlaceholderGuest: '登录定制我的专属标签',
  myOrders: '我的订单',
  allOrders: '全部',
  favorites: '收藏浏览',
  history: '浏览历史',
  customerService: '在线客服',
  systemSettings: '系统设置',
  clearLoginState: '清除本地登录态',
  clearLocalTestData: '清除本地测试数据',
  systemSettingsCancel: '取消',
  logout: '退出登录',
  historyDeveloping: '浏览历史开发中',
  customerServiceDeveloping: '在线客服开发中',
  systemSettingsDeveloping: '系统设置开发中',
  clearDone: '已清理',
  logoutSuccess: '已退出登录',
}

const ORDER_ENTRIES = [
  {
    key: 'pending_payment',
    tab: 'pending_payment',
    label: '待支付',
    icon: '/images/me/order-status/pending-payment.png',
  },
  {
    key: 'pending_trip',
    tab: 'pending_trip',
    label: '待出行',
    icon: '/images/me/order-status/pending-trip.png',
  },
  {
    key: 'pending_receive',
    tab: 'pending_receive',
    label: '待收货',
    icon: '/images/me/order-status/pending-receive.png',
  },
  {
    key: 'review',
    tab: 'pending',
    label: '评价',
    icon: '/images/me/order-status/review.png',
  },
  {
    key: 'refund_after_sale',
    tab: 'refund_after_sale',
    label: '退款/售后',
    icon: '/images/me/order-status/refund-after-sale.png',
  },
]

Page({
  data: {
    text: TEXT,
    orderEntries: ORDER_ENTRIES,
    statusBarHeight: 20,
    loggedIn: false,
    userInfo: {
      avatarUrl: GUEST_AVATAR,
      nickName: '',
    },
    dnaTags: [],
    dnaPlaceholderText: TEXT.dnaPlaceholderGuest,
  },

  onLoad() {
    this.initNavMetrics()
  },

  onShow() {
    this.refreshUser()
  },

  initNavMetrics() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20,
      })
    } catch (err) {
      this.setData({
        statusBarHeight: 20,
      })
    }
  },

  async refreshUser() {
    const rawUserInfo = app.getUserInfo() || {}
    const loggedIn = !!rawUserInfo.openid
    let avatarUrl = GUEST_AVATAR

    if (loggedIn) {
      const previewAvatar = rawUserInfo.avatarPreviewUrl || ''
      const cachedResolvedAvatar = rawUserInfo.avatarResolvedUrl || ''
      const resolvedAvatar = await resolveMediaSource(rawUserInfo.avatarUrl, cachedResolvedAvatar || DEFAULT_LOGGED_IN_AVATAR)
      avatarUrl = previewAvatar || resolvedAvatar || cachedResolvedAvatar || DEFAULT_LOGGED_IN_AVATAR
    }

    const nickName = loggedIn ? (rawUserInfo.nickName || TEXT.defaultNickname) : ''
    const dnaTags = loggedIn && Array.isArray(rawUserInfo.dnaTags) ? rawUserInfo.dnaTags : []

    this.setData({
      loggedIn,
      userInfo: {
        avatarUrl,
        nickName,
      },
      dnaTags,
      dnaPlaceholderText: loggedIn ? TEXT.dnaPlaceholder : TEXT.dnaPlaceholderGuest,
    })

    if (loggedIn && rawUserInfo.avatarPreviewUrl) {
      const resolvedAvatar = await resolveMediaSource(rawUserInfo.avatarUrl, '')
      if (resolvedAvatar) {
        const nextUserInfo = {
          ...rawUserInfo,
          avatarPreviewUrl: '',
          avatarResolvedUrl: resolvedAvatar,
        }
        app.setUserInfo(nextUserInfo)
        this.setData({
          'userInfo.avatarUrl': resolvedAvatar,
        })
      }
    } else if (loggedIn && rawUserInfo.avatarUrl && avatarUrl && avatarUrl !== rawUserInfo.avatarResolvedUrl && avatarUrl !== DEFAULT_LOGGED_IN_AVATAR) {
      app.setUserInfo({
        ...rawUserInfo,
        avatarResolvedUrl: avatarUrl,
      })
    }
  },

  onAvatarError() {
    this.setData({
      'userInfo.avatarUrl': DEFAULT_LOGGED_IN_AVATAR,
    })
  },

  onUserBoxTap() {
    if (!this.data.loggedIn) {
      this.goLogin()
    }
  },

  goLogin() {
    wx.navigateTo({
      url: '/pages/login/login',
    })
  },

  goEditProfile() {
    wx.navigateTo({
      url: '/pages/registerProfile/registerProfile?mode=edit',
    })
  },

  goMyDNATags() {
    if (!this.data.loggedIn) {
      this.goLogin()
      return
    }

    wx.navigateTo({
      url: '/pages/dnaTag/dnaTag?mode=edit',
    })
  },

  goAllOrders() {
    wx.navigateTo({
      url: '/pages/myOrders/myOrders?tab=all',
    })
  },

  goOrderTab(e) {
    const { tab } = e.currentTarget.dataset
    if (tab === 'pending') {
      wx.navigateTo({
        url: '/pages/reviewCenter/reviewCenter?tab=pending',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/myOrders/myOrders?tab=${tab || 'all'}`,
    })
  },

  goFavorites() {
    wx.navigateTo({
      url: '/pages/favorites/favorites',
    })
  },

  goHistory() {
    wx.showToast({
      title: TEXT.historyDeveloping,
      icon: 'none',
    })
  },

  goCustomerService() {
    wx.showToast({
      title: TEXT.customerServiceDeveloping,
      icon: 'none',
    })
  },

  goSystemSetting() {
    wx.showActionSheet({
      itemList: [TEXT.clearLoginState, TEXT.clearLocalTestData],
      success: (res) => {
        if (res.tapIndex === 0) {
          app.clearUserInfo()
          wx.showToast({
            title: TEXT.clearDone,
            icon: 'success',
          })
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/home/home',
            })
          }, 250)
          return
        }

        if (res.tapIndex === 1) {
          app.clearLocalTestData()
          wx.showToast({
            title: TEXT.clearDone,
            icon: 'success',
          })
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/home/home',
            })
          }, 250)
        }
      },
      fail: () => {},
    })
  },

  logout() {
    app.clearUserInfo()
    this.setData({
      loggedIn: false,
      userInfo: {
        avatarUrl: GUEST_AVATAR,
        nickName: '',
      },
      dnaTags: [],
    })

    wx.showToast({
      title: TEXT.logoutSuccess,
      icon: 'success',
    })

    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/home/home',
      })
    }, 300)
  },
})
