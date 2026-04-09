Page({

  data: {

    activityId: "",

    today: "",

    travelDate: "",

    adultCount: 0,

    childCount: 0

  },


  onLoad(options) {

    const today = this.formatDate(new Date())

    this.setData({

      today,

      // 兼容两种传法：id 或 activityId
      activityId: options.id || options.activityId || ""

    })

  },


  formatDate(date) {

    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')

    return `${y}-${m}-${d}`

  },


  onDateChange(e) {

    this.setData({

      travelDate: e.detail.value

    })

  },


  addAdult() {

    this.setData({

      adultCount: this.data.adultCount + 1

    })

  },


  minusAdult() {

    if (this.data.adultCount <= 0) return

    this.setData({

      adultCount: this.data.adultCount - 1

    })

  },


  addChild() {

    this.setData({

      childCount: this.data.childCount + 1

    })

  },


  minusChild() {

    if (this.data.childCount <= 0) return

    this.setData({

      childCount: this.data.childCount - 1

    })

  },


  goNext() {

    const { activityId, travelDate, adultCount, childCount } = this.data

    if (!activityId) {
      return wx.showToast({
        title: '活动ID丢失，请返回重试',
        icon: 'none'
      })
    }

    if (!travelDate) {

      return wx.showToast({

        title: '请选择出行日期',

        icon: 'none'

      })

    }

    if (adultCount + childCount <= 0) {

      return wx.showToast({

        title: '请选择出行人数',

        icon: 'none'

      })

    }


    const nonce = Date.now()

    wx.navigateTo({

      url: `/pages/order/order?activityId=${activityId}&date=${travelDate}&adult=${adultCount}&child=${childCount}&nonce=${nonce}`

    })

  }

})