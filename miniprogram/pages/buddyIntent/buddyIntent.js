const app = getApp()

const TEXT = {
  title: '设置搭子偏好',
  desc: '这些信息会参与搭子匹配，只展示必要字段，不会直接暴露你的隐私信息。',
  save: '保存偏好',
  saveFailed: '保存失败',
  saveSuccess: '搭子偏好已保存',
}

const OPTION_GROUPS = {
  availability: [
    { value: 'saturday', label: '周六更方便' },
    { value: 'sunday', label: '周日更方便' },
    { value: 'weekend', label: '周末都可以' },
    { value: 'flexible', label: '时间较灵活' },
  ],
  buddyType: [
    { value: 'casual', label: '周末同游' },
    { value: 'photo', label: '摄影搭子' },
    { value: 'parent_child', label: '亲子搭子' },
    { value: 'free_travel', label: '自由行搭子' },
  ],
  acceptCarpool: [
    { value: 'yes', label: '接受拼车' },
    { value: 'no', label: '暂不拼车' },
  ],
  groupPreference: [
    { value: 'two', label: '两人同行' },
    { value: 'small_group', label: '3-4人小团' },
    { value: 'flexible', label: '人数灵活' },
  ],
}

function ensureBoundSession() {
  if (app.hasActiveSession && app.hasActiveSession()) {
    return true
  }

  wx.showToast({
    title: '请先登录后再设置',
    icon: 'none',
  })

  setTimeout(() => {
    wx.navigateTo({
      url: '/pages/login/login',
    })
  }, 250)

  return false
}

Page({
  data: {
    text: TEXT,
    optionGroups: OPTION_GROUPS,
    form: {
      availability: '',
      buddyType: '',
      acceptCarpool: '',
      groupPreference: '',
    },
    loading: false,
  },

  onLoad() {
    const userInfo = app.getUserInfo() || {}
    const buddyIntent = userInfo.buddyIntent || {}
    this.setData({
      form: {
        availability: buddyIntent.availability || '',
        buddyType: buddyIntent.buddyType || '',
        acceptCarpool: buddyIntent.acceptCarpool || '',
        groupPreference: buddyIntent.groupPreference || '',
      },
    })
  },

  selectOption(e) {
    const { field, value } = e.currentTarget.dataset
    if (!field || !value) return
    this.setData({
      [`form.${field}`]: value,
    })
  },

  async saveIntent() {
    if (!ensureBoundSession()) {
      return
    }

    const form = this.data.form || {}
    if (!form.availability || !form.buddyType || !form.acceptCarpool || !form.groupPreference) {
      wx.showToast({
        title: '请先完成全部偏好设置',
        icon: 'none',
      })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'updateBuddyIntent',
          buddyIntent: form,
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
        return
      }

      app.setUserInfo(res.result.userInfo)
      wx.showToast({ title: TEXT.saveSuccess, icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 250)
    } catch (error) {
      console.error('[buddyIntent] save failed', error)
      wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
