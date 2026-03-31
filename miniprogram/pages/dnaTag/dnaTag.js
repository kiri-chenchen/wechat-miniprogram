const app = getApp()

const TEXT = {
  travelModesTitle: '\u65c5\u884c\u65b9\u5f0f',
  travelStylesTitle: '\u65c5\u884c\u73a9\u6cd5',
  buddyTagsTitle: '\u642d\u5b50\u504f\u597d',
  saveAndEnterHome: '\u4fdd\u5b58\u5e76\u8fdb\u5165\u9996\u9875',
  saveOnly: '\u4fdd\u5b58',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  saved: 'DNA \u5df2\u4fdd\u5b58',
  travelModes: [
    '\u81ea\u7531\u884c',
    '\u8ddf\u56e2\u6e38',
    '\u4eb2\u5b50\u51fa\u884c',
    '\u9000\u4f11\u65c5\u5c45',
    '\u79c1\u4eba\u5b9a\u5236',
    '\u627e\u642d\u5b50',
    '\u56e2\u961f\u51fa\u6e38',
    '\u72ec\u81ea\u65c5\u884c',
  ],
  travelStyles: [
    '\u79cd\u690d\u91c7\u6458',
    '\u6816\u5c45\u5c71\u91ce',
    '\u519c\u4e8b\u79d1\u666e',
    '\u7f8e\u98df\u7f8e\u9152',
    '\u624b\u5de5\u5de5\u574a',
    '\u975e\u9057\u6587\u5316',
    '\u751f\u6001\u89c2\u5149',
    '\u521b\u610f\u6444\u5f71',
  ],
  buddyTags: [
    '\u5468\u672b\u540c\u6e38',
    '\u6444\u5f71\u642d\u5b50',
    '\u4eb2\u5b50\u642d\u5b50',
    '\u81ea\u7531\u884c\u642d\u5b50',
    '\u63a5\u53d7\u62fc\u8f66',
    '\u4e24\u4eba\u540c\u884c',
    '3-4\u4eba\u5c0f\u56e2',
    '\u4eba\u6570\u7075\u6d3b',
  ],
}

function buildTagMap(tags) {
  return tags.reduce((acc, tag) => {
    acc[tag] = true
    return acc
  }, {})
}

function ensureBoundSession() {
  const app = getApp()
  if (app.hasActiveSession && app.hasActiveSession()) {
    return true
  }

  wx.showToast({
    title: '请先完成登录后再保存标签',
    icon: 'none',
  })

  setTimeout(() => {
    wx.redirectTo({
      url: '/pages/login/login',
    })
  }, 250)

  return false
}

Page({
  data: {
    text: {
      travelModesTitle: TEXT.travelModesTitle,
      travelStylesTitle: TEXT.travelStylesTitle,
      buddyTagsTitle: TEXT.buddyTagsTitle,
      saveButton: TEXT.saveAndEnterHome,
    },
    mode: 'setup',
    travelModes: TEXT.travelModes,
    travelStyles: TEXT.travelStyles,
    buddyTags: TEXT.buddyTags,
    selectedModes: [],
    selectedStyles: [],
    selectedBuddyTags: [],
    selectedModeMap: {},
    selectedStyleMap: {},
    selectedBuddyTagMap: {},
    loading: false,
  },

  onLoad(options) {
    const mode = options.mode || 'setup'
    const userInfo = app.getUserInfo() || {}
    const dnaTags = userInfo.dnaTags || []
    const buddyTags = this.getBuddyTags(userInfo)
    const selectedModes = dnaTags.filter((tag) => TEXT.travelModes.includes(tag))
    const selectedStyles = dnaTags.filter((tag) => TEXT.travelStyles.includes(tag))

    this.setData({
      mode,
      'text.saveButton': mode === 'edit' ? TEXT.saveOnly : TEXT.saveAndEnterHome,
      selectedModes,
      selectedStyles,
      selectedBuddyTags: buddyTags,
      selectedModeMap: buildTagMap(selectedModes),
      selectedStyleMap: buildTagMap(selectedStyles),
      selectedBuddyTagMap: buildTagMap(buddyTags),
    })
  },

  getBuddyTags(userInfo = {}) {
    const directTags = Array.isArray(userInfo.buddyTags) ? userInfo.buddyTags : []
    if (directTags.length) {
      return directTags.filter((tag) => TEXT.buddyTags.includes(tag))
    }

    const buddyIntent = userInfo.buddyIntent || {}
    const legacyTags = []
    if (buddyIntent.buddyType === 'casual') legacyTags.push('周末同游')
    if (buddyIntent.buddyType === 'photo') legacyTags.push('摄影搭子')
    if (buddyIntent.buddyType === 'parent_child') legacyTags.push('亲子搭子')
    if (buddyIntent.buddyType === 'free_travel') legacyTags.push('自由行搭子')
    if (buddyIntent.acceptCarpool === 'yes') legacyTags.push('接受拼车')
    if (buddyIntent.groupPreference === 'two') legacyTags.push('两人同行')
    if (buddyIntent.groupPreference === 'small_group') legacyTags.push('3-4人小团')
    if (buddyIntent.groupPreference === 'flexible') legacyTags.push('人数灵活')
    return Array.from(new Set(legacyTags))
  },

  toggleModeTag(e) {
    this.toggleTag('selectedModes', 'selectedModeMap', e.currentTarget.dataset.tag)
  },

  toggleStyleTag(e) {
    this.toggleTag('selectedStyles', 'selectedStyleMap', e.currentTarget.dataset.tag)
  },

  toggleBuddyTag(e) {
    this.toggleTag('selectedBuddyTags', 'selectedBuddyTagMap', e.currentTarget.dataset.tag)
  },

  toggleTag(field, mapField, tag) {
    const current = this.data[field]
    const exists = current.includes(tag)
    const next = exists ? current.filter((item) => item !== tag) : [...current, tag]

    this.setData({
      [field]: next,
      [mapField]: buildTagMap(next),
    })
  },

  async onSave() {
    const tags = [...this.data.selectedModes, ...this.data.selectedStyles]
    const buddyTags = [...this.data.selectedBuddyTags]
    await this.submitTags(tags, buddyTags)
  },

  async submitTags(tags, buddyTags) {
    if (!ensureBoundSession()) {
      return
    }

    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'updateDNATags',
          tags,
          buddyTags,
        },
      })

      if (!res.result.success) {
        wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
        return
      }

      app.setUserInfo(res.result.userInfo)
      wx.showToast({
        title: TEXT.saved,
        icon: 'success',
      })

      if (this.data.mode === 'edit') {
        wx.navigateBack()
        return
      }

      wx.switchTab({ url: '/pages/home/home' })
    } catch (err) {
      console.error('[dna] submit dna tags failed', err)
      wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
