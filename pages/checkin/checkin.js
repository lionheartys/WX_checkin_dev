const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    currentTime: '',
    currentDate: '',
    currentAddress: '获取位置中...',
    distance: -1,
    canCheckin: false,
    loading: false,
    statusText: '准备打卡',
    userLocation: null,
    checkinLocation: {
      longitude: 121.4737,
      latitude: 31.2304
    },
    maxDistance: 200, // 最大打卡距离（米）
    todaySummary: {
      checkedIn: false,
      checkedOut: false,
      checkinTime: '',
      checkoutTime: ''
    }
  },

  onLoad() {
    this.initPage()
    this.startTimeUpdate()
    this.getLocation()
    this.loadTodaySummary()
  },

  onShow() {
    this.loadTodaySummary()
  },

  onUnload() {
    // 清理定时器
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
  },

  // 初始化页面
  initPage() {
    this.updateTime()
  },

  // 开始时间更新
  startTimeUpdate() {
    this.timeInterval = setInterval(() => {
      this.updateTime()
    }, 1000)
  },

  // 更新时间显示
  updateTime() {
    const now = new Date()
    const time = now.toTimeString().split(' ')[0]
    const date = now.toLocaleDateString('zh-CN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    this.setData({
      currentTime: time,
      currentDate: date
    })
  },

  // 获取位置信息
  getLocation() {
    wx.showLoading({
      title: '获取位置中...'
    })

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取位置成功:', res)
        this.setData({
          userLocation: {
            longitude: res.longitude,
            latitude: res.latitude
          }
        })
        
        // 计算距离
        this.calculateDistance()
        
        // 获取地址信息
        this.getAddressInfo(res.latitude, res.longitude)
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        wx.hideLoading()
        
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置权限',
            content: '需要位置权限才能进行打卡，请在设置中开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({
            title: '获取位置失败',
            icon: 'none'
          })
        }
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  // 计算距离
  calculateDistance() {
    const { userLocation, checkinLocation } = this.data
    
    if (!userLocation) return
    
    const distance = util.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      checkinLocation.latitude,
      checkinLocation.longitude
    )
    
    const canCheckin = distance <= this.data.maxDistance
    let statusText = '准备打卡'
    
    if (!canCheckin) {
      statusText = '距离过远'
    }
    
    this.setData({
      distance: Math.round(distance),
      canCheckin,
      statusText
    })
  },

  // 获取地址信息
  getAddressInfo(latitude, longitude) {
    // 使用微信自带的地址解析
    wx.request({
      url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${latitude},${longitude}&key=YOUR_TENCENT_MAP_KEY&get_poi=1`,
      success: (res) => {
        if (res.data.status === 0) {
          this.setData({
            currentAddress: res.data.result.address
          })
        }
      },
      fail: () => {
        this.setData({
          currentAddress: '位置解析失败'
        })
      }
    })
  },

  // 执行打卡
  async doCheckin() {
    if (!this.data.canCheckin || this.data.loading) return
    
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    // 判断打卡类型
    const checkinType = this.getCheckinType()
    
    this.setData({ loading: true })
    
    try {
      const checkinData = {
        user_id: userInfo.id,
        type: checkinType,
        longitude: this.data.userLocation.longitude,
        latitude: this.data.userLocation.latitude
      }
      
      const res = await api.checkin(checkinData)
      
      if (res.code === 200) {
        wx.showToast({
          title: `${checkinType === 'in' ? '上班' : '下班'}打卡成功`,
          icon: 'success'
        })
        
        // 刷新今日汇总
        setTimeout(() => {
          this.loadTodaySummary()
        }, 1000)
      }
    } catch (error) {
      console.error('打卡失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 判断打卡类型
  getCheckinType() {
    const { todaySummary } = this.data
    
    // 如果还没上班打卡，则为上班
    if (!todaySummary.checkedIn) {
      return 'in'
    }
    
    // 如果已经上班但还没下班，则为下班
    if (todaySummary.checkedIn && !todaySummary.checkedOut) {
      return 'out'
    }
    
    // 都打过了，默认为下班（可能是补打卡）
    return 'out'
  },

  // 加载今日汇总
  async loadTodaySummary() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) return
    
    try {
      const res = await api.getCheckinHistory(userInfo.id)
      if (res.code === 200) {
        const today = new Date().toDateString()
        const todayRecords = res.data.filter(record => {
          return new Date(record.checkin_time).toDateString() === today
        })
        
        const checkedIn = todayRecords.some(r => r.checkin_type === 'in')
        const checkedOut = todayRecords.some(r => r.checkin_type === 'out')
        
        const checkinRecord = todayRecords.find(r => r.checkin_type === 'in')
        const checkoutRecord = todayRecords.find(r => r.checkin_type === 'out')
        
        this.setData({
          todaySummary: {
            checkedIn,
            checkedOut,
            checkinTime: checkinRecord ? new Date(checkinRecord.checkin_time).toTimeString().split(' ')[0] : '',
            checkoutTime: checkoutRecord ? new Date(checkoutRecord.checkin_time).toTimeString().split(' ')[0] : ''
          }
        })
      }
    } catch (error) {
      console.error('加载今日汇总失败:', error)
    }
  },

  // 刷新位置
  refreshLocation() {
    this.getLocation()
  },

  // 查看历史记录
  viewHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  }
})