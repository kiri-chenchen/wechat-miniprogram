const DEFAULT_DATA = () => ({
  activityId: '',
  travelDate: '',
  adultCount: 0,
  childCount: 0,
  totalCount: 0,
  nonce: '',
  contactName: '',
  contactPhone: '',
  contactQQ: '',
  contactWechat: '',
  travelers: [],
  travelerIds: [],
  specialRequest: '',
  emergencyEnabled: false,
  emergencyName: '',
  emergencyPhone: '',
})

function mapOrderMessage(message) {
  const messageMap = {
    ACTIVITY_ID_REQUIRED: 'Missing activity id',
    INVALID_TRAVEL_DATE: 'Please choose a valid travel date',
    INVALID_TRAVELER_COUNT: 'Traveler count is invalid',
    TRAVELER_COUNT_MISMATCH: 'Please select the required travelers',
    CONTACT_NAME_REQUIRED: 'Please fill in contact name',
    INVALID_CONTACT_PHONE: 'Invalid contact phone number',
    EMERGENCY_NAME_REQUIRED: 'Please fill in emergency contact name',
    INVALID_EMERGENCY_PHONE: 'Invalid emergency contact phone number',
    ACTIVITY_NOT_AVAILABLE: 'Activity is unavailable',
    TRAVELER_NOT_FOUND: 'Traveler data is invalid, please reselect',
    PHONE_BIND_REQUIRED: 'Please bind your phone number first',
    WECHAT_LOGIN_REQUIRED: 'Please login first',
  }
  return messageMap[message] || message || 'Submit failed'
}

Page({
  data: DEFAULT_DATA(),

  onLoad(options) {
    const adult = Number(options.adult || 0)
    const child = Number(options.child || 0)
    const activityId = options.activityId || options.id || ''

    this.setData({
      ...DEFAULT_DATA(),
      activityId,
      travelDate: options.date || '',
      adultCount: adult,
      childCount: child,
      totalCount: adult + child,
      nonce: options.nonce || '',
    })
  },

  onNameInput(e) { this.setData({ contactName: e.detail.value }) },
  onPhoneInput(e) { this.setData({ contactPhone: e.detail.value }) },
  onQQInput(e) { this.setData({ contactQQ: e.detail.value }) },
  onWechatInput(e) { this.setData({ contactWechat: e.detail.value }) },
  onSpecialInput(e) { this.setData({ specialRequest: e.detail.value }) },
  onEmergencyName(e) { this.setData({ emergencyName: e.detail.value }) },
  onEmergencyPhone(e) { this.setData({ emergencyPhone: e.detail.value }) },

  toggleEmergency(e) {
    this.setData({ emergencyEnabled: !!e.detail.value })
  },

  goSelectTravelers() {
    const need = this.data.totalCount
    wx.navigateTo({
      url: `/pages/travelerSelect/travelerSelect?need=${need}`,
      success: (res) => {
        res.eventChannel.emit('initSelected', { selectedIds: this.data.travelerIds })
        res.eventChannel.on('selectedDone', (data) => {
          const travelers = data.travelers || []
          this.setData({
            travelers,
            travelerIds: travelers.map((item) => item._id),
          })
        })
      },
    })
  },

  async submitOrder() {
    const {
      activityId, travelDate, adultCount, childCount, contactName, contactPhone,
      contactQQ, contactWechat, travelerIds, specialRequest,
      emergencyEnabled, emergencyName, emergencyPhone,
    } = this.data

    wx.showLoading({ title: 'Submitting' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'activityOrder',
        data: {
          action: 'create',
          activityId,
          travelDate,
          adultCount,
          childCount,
          travelerIds,
          contact: {
            name: contactName,
            phone: contactPhone,
            qq: contactQQ,
            wechat: contactWechat,
          },
          specialRequest,
          emergency: {
            enabled: emergencyEnabled,
            name: emergencyName,
            phone: emergencyPhone,
          },
        },
      })

      if (!res.result || !res.result.success) {
        wx.showToast({ title: mapOrderMessage(res.result && res.result.message), icon: 'none' })
        return
      }

      wx.showToast({ title: 'Order created', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 2 }), 1200)
    } catch (error) {
      console.error('[order] submit failed', error)
      wx.showToast({ title: 'Submit failed', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
})
