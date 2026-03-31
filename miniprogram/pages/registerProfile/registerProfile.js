const app = getApp()
const { resolveMediaSource } = require('../../utils/mediaAssets')

const DEFAULT_AVATAR = '/images/avatar.png'
const MAX_AVATAR_SOURCE_SIZE = 2 * 1024 * 1024
const TEXT = {
  unknown: '\u672a\u77e5',
  male: '\u7537',
  female: '\u5973',
  takePhoto: '\u62cd\u7167',
  chooseFromAlbum: '\u4ece\u76f8\u518c\u9009\u62e9',
  uploading: '\u4e0a\u4f20\u4e2d...',
  uploadSuccess: '\u4e0a\u4f20\u6210\u529f',
  uploadFailed: '\u4e0a\u4f20\u5931\u8d25',
  avatarTooLarge: '\u9009\u62e9\u7684\u56fe\u7247\u8d85\u8fc7 2MB\uff0c\u8bf7\u5148\u538b\u7f29\u540e\u518d\u4e0a\u4f20',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  skippedProfile: '\u5df2\u8df3\u8fc7\u8d44\u6599\u586b\u5199',
  profileSaved: '\u8d44\u6599\u5df2\u4fdd\u5b58',
  title: '\u5b8c\u5584\u4e2a\u4eba\u8d44\u6599',
  avatar: '\u5934\u50cf',
  avatarHint: '\u62cd\u7167\u6216\u4ece\u76f8\u518c\u9009\u62e9',
  nickname: '\u6635\u79f0',
  nicknamePlaceholder: '\u672a\u586b\u5199\u65f6\u5c06\u663e\u793a\u4e3a e\u4f4d\u65c5\u5ba2',
  gender: '\u6027\u522b',
  birth: '\u751f\u65e5',
  enableBirth: '\u662f\u5426\u586b\u5199\u751f\u65e5',
  birthUnknown: '\u672a\u586b\u5199\u65f6\u5c06\u663e\u793a\u4e3a\u672a\u77e5',
  nextStep: '\u4e0b\u4e00\u6b65',
  save: '\u4fdd\u5b58',
}

const GENDERS = [TEXT.unknown, TEXT.male, TEXT.female]

function ensureBoundSession() {
  const app = getApp()
  if (app.hasActiveSession && app.hasActiveSession()) {
    return true
  }

  wx.showToast({
    title: '请先完成登录后再保存资料',
    icon: 'none',
  })

  setTimeout(() => {
    wx.redirectTo({
      url: '/pages/login/login',
    })
  }, 250)

  return false
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
    const timer = setTimeout(() => reject(new Error('getLocation timeout')), timeout)
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
    text: {
      title: TEXT.title,
      avatar: TEXT.avatar,
      avatarHint: TEXT.avatarHint,
      nickname: TEXT.nickname,
      nicknamePlaceholder: TEXT.nicknamePlaceholder,
      gender: TEXT.gender,
      birth: TEXT.birth,
      enableBirth: TEXT.enableBirth,
      birthUnknown: TEXT.birthUnknown,
      nextStep: TEXT.nextStep,
      save: TEXT.save,
    },
    mode: 'register',
    avatarPreview: DEFAULT_AVATAR,
    avatarLocalPath: '',
    avatarFileId: '',
    nickname: '',
    gender: TEXT.unknown,
    genders: GENDERS,
    birthEnabled: false,
    birth: {
      year: new Date().getFullYear() - 25,
      month: 1,
      day: 1,
    },
    years: [],
    months: [],
    days: [],
    selectedYearIndex: 0,
    selectedMonthIndex: 0,
    selectedDayIndex: 0,
    loading: false,
    avatarUploading: false,
  },

  async onLoad(options) {
    this.initializeDatePickers()

    const mode = options.mode || 'register'
    const userInfo = app.getUserInfo() || {}
    const birthDate = userInfo.birthDate ? new Date(userInfo.birthDate) : null
    const hasValidBirthDate = birthDate && !Number.isNaN(birthDate.getTime())

    const initBirth = hasValidBirthDate
      ? {
          year: birthDate.getFullYear(),
          month: birthDate.getMonth() + 1,
          day: birthDate.getDate(),
        }
      : this.data.birth

    const rawAvatar = userInfo.avatarUrl || ''
    const resolvedAvatar = await resolveMediaSource(rawAvatar, userInfo.avatarResolvedUrl || DEFAULT_AVATAR)

    this.setData({
      mode,
      avatarPreview: resolvedAvatar || DEFAULT_AVATAR,
      avatarLocalPath: '',
      avatarFileId: rawAvatar || '',
      nickname: userInfo.nickName || '',
      gender: userInfo.gender || TEXT.unknown,
      birthEnabled: !!hasValidBirthDate,
      birth: initBirth,
    })

    if (rawAvatar && resolvedAvatar && resolvedAvatar !== userInfo.avatarResolvedUrl) {
      app.setUserInfo({
        ...userInfo,
        avatarResolvedUrl: resolvedAvatar,
      })
    }

    this.syncBirthPickerIndices(initBirth)

    if (mode === 'register' && !userInfo.locationChoiceMade) {
      this.tryRequestLocationOnEntry()
    }
  },

  initializeDatePickers() {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = currentYear - 80; year <= currentYear; year += 1) {
      years.push(year)
    }

    this.setData({
      years,
      months: Array.from({ length: 12 }, (_, i) => i + 1),
      days: Array.from({ length: 31 }, (_, i) => i + 1),
    })
  },

  syncBirthPickerIndices(birth) {
    this.setData({
      selectedYearIndex: this.data.years.findIndex((item) => item === birth.year),
      selectedMonthIndex: birth.month - 1,
      selectedDayIndex: birth.day - 1,
    })
  },

  onSelectAvatar() {
    wx.showActionSheet({
      itemList: [TEXT.takePhoto, TEXT.chooseFromAlbum],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseAvatar(['camera'])
          return
        }
        this.chooseAvatar(['album'])
      },
    })
  },

  chooseAvatar(sourceType) {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType,
      success: async (res) => {
        const imagePath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
        const selectedFile = Array.isArray(res.tempFiles) ? res.tempFiles[0] : null

        if (selectedFile && selectedFile.size > MAX_AVATAR_SOURCE_SIZE) {
          wx.showToast({
            title: TEXT.avatarTooLarge,
            icon: 'none',
          })
          return
        }

        if (!imagePath) {
          wx.showToast({
            title: TEXT.uploadFailed,
            icon: 'none',
          })
          return
        }

        await this.uploadAvatar(imagePath)
      },
      fail: (err) => {
        console.error('[profile] choose avatar failed', err)
      },
    })
  },

  async uploadAvatar(imagePath) {
    try {
      this.setData({
        avatarPreview: imagePath,
        avatarLocalPath: imagePath,
        avatarUploading: true,
      })
      wx.showLoading({ title: TEXT.uploading })
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
        filePath: imagePath,
      })

      const resolvedAvatar = await resolveMediaSource(uploadRes.fileID, imagePath)
      this.setData({
        avatarFileId: uploadRes.fileID,
        avatarPreview: resolvedAvatar || imagePath,
      })
      wx.showToast({ title: TEXT.uploadSuccess, icon: 'success' })
    } catch (err) {
      console.error('[profile] upload avatar failed', err)
      wx.showToast({
        title: '头像预览已保留，上传失败请稍后重试',
        icon: 'none',
      })
    } finally {
      this.setData({ avatarUploading: false })
      wx.hideLoading()
    }
  },

  onAvatarError() {
    const fallback = this.data.avatarLocalPath || DEFAULT_AVATAR
    if (this.data.avatarPreview !== fallback) {
      this.setData({ avatarPreview: fallback })
    }
  },

  onNicknameInput(e) {
    const value = String(e.detail.value || '').slice(0, 10)
    this.setData({ nickname: value })
  },

  pickerGender(e) {
    const gender = this.data.genders[e.detail.value]
    this.setData({ gender })
  },

  toggleBirthEnabled(e) {
    this.setData({ birthEnabled: !!e.detail.value })
  },

  pickerYear(e) {
    const year = this.data.years[e.detail.value]
    this.setData({
      selectedYearIndex: e.detail.value,
      'birth.year': year,
    })
  },

  pickerMonth(e) {
    this.setData({
      selectedMonthIndex: e.detail.value,
      'birth.month': Number(e.detail.value) + 1,
    })
  },

  pickerDay(e) {
    this.setData({
      selectedDayIndex: e.detail.value,
      'birth.day': Number(e.detail.value) + 1,
    })
  },

  async onSave() {
    await this.submitProfile(false)
  },

  async tryRequestLocationOnEntry() {
    if (!ensureBoundSession() || this.locationPromptTriggered) return
    this.locationPromptTriggered = true

    try {
      let userLocation = null
      const locationRes = await getLocationAsync()
      userLocation = {
        latitude: locationRes.latitude,
        longitude: locationRes.longitude,
      }
      wx.setStorageSync('userLocation', userLocation)
      await this.saveLocationChoice(true, userLocation)
    } catch (err) {
      console.warn('[profile] request location on entry failed', err)
      await this.saveLocationChoice(false, null)
    }
  },

  async saveLocationChoice(locationAuthorized, location) {
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

      if (res.result && res.result.success) {
        app.setUserInfo(res.result.userInfo)
      }
    } catch (err) {
      console.error('[profile] save location choice failed', err)
    } finally {
      const currentUser = app.getUserInfo() || {}
      if (!currentUser.locationChoiceMade) {
        app.setUserInfo({
          ...currentUser,
          locationChoiceMade: true,
          locationAuthorized,
          userLocation: location || null,
        })
      }
    }
  },

  async submitProfile() {
    if (!ensureBoundSession()) {
      return
    }

    if (this.data.avatarUploading) {
      wx.showToast({
        title: '头像上传中，请稍候',
        icon: 'none',
      })
      return
    }

    this.setData({ loading: true })
    try {
      const profile = {
        avatarUrl: this.data.avatarFileId || '',
        nickName: this.data.nickname.trim(),
        gender: this.data.gender || TEXT.unknown,
        birthDate: this.data.birthEnabled
          ? `${this.data.birth.year}-${String(this.data.birth.month).padStart(2, '0')}-${String(this.data.birth.day).padStart(2, '0')}`
          : '',
        profileCompleted: true,
      }

      const result = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'updateProfile',
          profile,
        },
      })

      if (!result.result.success) {
        wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
        return
      }

      const nextUserInfo = {
        ...result.result.userInfo,
        avatarUrl: this.data.avatarFileId || result.result.userInfo.avatarUrl || '',
        avatarPreviewUrl: this.data.avatarLocalPath || this.data.avatarPreview || '',
        avatarResolvedUrl: this.data.avatarPreview || result.result.userInfo.avatarResolvedUrl || '',
      }

      app.setUserInfo(nextUserInfo)
      wx.showToast({
        title: TEXT.profileSaved,
        icon: 'success',
      })

      if (this.data.mode === 'edit') {
        wx.navigateBack()
        return
      }

      wx.redirectTo({ url: '/pages/dnaTag/dnaTag?mode=setup' })
    } catch (err) {
      console.error('[profile] submit profile failed', err)
      wx.showToast({ title: TEXT.saveFailed, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
