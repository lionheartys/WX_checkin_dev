// 引入模块
const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    userLocation: null,
    checkinLocation: null, // 从后端动态获取
    maxDistance: 100,
    distance: 0,
    canCheckin: false,
    loading: false,
    statusText: '加载中...',
    currentTime: '',
    currentDate: '',
    currentAddress: '获取位置中...',
    todayRecords: [],
    todaySummary: {
      checkedIn: false,
      checkedOut: false,
      checkinTime: '',
      checkoutTime: ''
    }
  },

  async onLoad() {
    this.initPage()
    // 先获取打卡配置，再获取位置
    await this.loadCheckinConfig()
    this.getLocation()
    this.getUserInfo()
    this.loadTodayRecords()
    this.loadTodaySummary()
    
    // 开始定时更新时间
    this.startTimeUpdate()
  },

  onShow() {
    this.loadTodaySummary()
    this.loadTodayRecords()
  },

  onUnload() {
    // 清理定时器
    if (this.timer) {
      clearInterval(this.timer)
    }
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
    this.timer = setInterval(() => {
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

  // 获取用户信息
  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
    }
  },

  // 从后端获取打卡配置
  async loadCheckinConfig() {
    wx.showLoading({
      title: '加载配置...'
    })
    
    try {
      // [修复] 使用 request.js 中定义的 getCheckinConfig 方法
      const res = await api.getCheckinConfig(1)
      
      wx.hideLoading()
      
      if (res.code === 200 && res.data) {
        this.setData({
          checkinLocation: {
            latitude: res.data.latitude,
            longitude: res.data.longitude,
            address: res.data.location_name || '公司',
          },
          maxDistance: res.data.checkin_range || 100
        })
        console.log('打卡配置加载成功:', this.data.checkinLocation)
      } else {
        wx.showToast({
          title: res.message || '获取打卡配置失败',
          icon: 'none'
        })
        // 使用默认配置（成都）
        this.setDefaultConfig()
      }
    } catch (error) {
      wx.hideLoading()
      console.error('加载打卡配置失败:', error)
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      })
      // 使用默认配置
      this.setDefaultConfig()
    }
  },

  // 设置默认配置
  setDefaultConfig() {
    this.setData({
      checkinLocation: {
        latitude: 30.6424200,
        longitude: 104.0431100,
        address: '默认办公点'
      },
      maxDistance: 100
    })
  },

  // 获取位置信息
  getLocation() {
    // 确保有打卡配置才继续
    if (!this.data.checkinLocation) {
      console.log('打卡配置未加载，等待配置...')
      // 延迟重试
      setTimeout(() => {
        this.getLocation()
      }, 1000)
      return
    }
    
    wx.showLoading({
      title: '获取位置中...'
    })

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取位置成功:', res)
        this.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
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
        
        this.setData({
          statusText: '位置获取失败'
        })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  // 计算距离
  calculateDistance() {
    const { userLocation, checkinLocation } = this.data
    
    console.log('用户位置:', userLocation)
    console.log('打卡位置:', checkinLocation)
    console.log('最大允许距离:', this.data.maxDistance)
    
    if (!userLocation || !checkinLocation) return
    
    const distance = util.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      checkinLocation.latitude,
      checkinLocation.longitude
    )
    
    console.log('计算出的距离:', distance, '米')
    
    const canCheckin = distance <= this.data.maxDistance
    let statusText = '准备打卡'
    
    if (!canCheckin) {
      statusText = `距离过远 (${Math.round(distance)}米)`
    }
    
    this.setData({
      distance: Math.round(distance),
      canCheckin,
      statusText
    })
  },

  // 获取地址信息
  getAddressInfo(latitude, longitude) {
    // 这里可以使用腾讯地图API，需要申请key
    // 暂时使用简单的显示
    this.setData({
      currentAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    })
  },

  // 执行打卡
  async doCheckin() {
    if (!this.data.canCheckin || this.data.loading) {
      if (!this.data.canCheckin) {
        wx.showToast({
          title: `距离过远，无法打卡 (${this.data.distance}米)`,
          icon: 'none'
        })
      }
      return
    }
    
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
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
    
    wx.showLoading({
      title: '打卡中...'
    })
    
    try {
      const checkinData = {
        user_id: userInfo.id,
        type: checkinType,
        longitude: this.data.userLocation.longitude,
        latitude: this.data.userLocation.latitude
      }
      
      // 使用现有的打卡API
      const res = await api.checkin(checkinData)
      
      wx.hideLoading()
      
      if (res.code === 200) {
        wx.showToast({
          title: `${checkinType === 'in' ? '上班' : '下班'}打卡成功`,
          icon: 'success'
        })
        
        // 刷新今日汇总和记录
        setTimeout(() => {
          this.loadTodaySummary()
          this.loadTodayRecords()
        }, 1000)
      } else {
        wx.showToast({
          title: res.message || '打卡失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('打卡失败:', error)
      wx.showToast({
        title: '打卡失败，请重试',
        icon: 'none'
      })
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

  // 加载今日记录
  async loadTodayRecords() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) return
    
    try {
      // [修复] 使用 request.js 中定义的 getCheckinHistory 方法
      const res = await api.getCheckinHistory(userInfo.id)
      
      if (res.code === 200) {
        this.setData({
          todayRecords: res.data || []
        })
      }
    } catch (error) {
      console.error('加载记录失败:', error)
    }
  },

  // 加载今日汇总
  async loadTodaySummary() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) return
    
    try {
      // 使用今日记录来计算汇总
      const todayRecords = this.data.todayRecords
      const today = new Date().toDateString()
      
      // 过滤今天的记录
      const todayCheckins = todayRecords.filter(record => {
        return new Date(record.checkin_time).toDateString() === today
      })
      
      const checkedIn = todayCheckins.some(r => r.checkin_type === 'in')
      const checkedOut = todayCheckins.some(r => r.checkin_type === 'out')
      
      const checkinRecord = todayCheckins.find(r => r.checkin_type === 'in')
      const checkoutRecord = todayCheckins.find(r => r.checkin_type === 'out')
      
      this.setData({
        todaySummary: {
          checkedIn,
          checkedOut,
          checkinTime: checkinRecord ? new Date(checkinRecord.checkin_time).toTimeString().split(' ')[0] : '',
          checkoutTime: checkoutRecord ? new Date(checkoutRecord.checkin_time).toTimeString().split(' ')[0] : ''
        }
      })
    } catch (error) {
      console.error('加载今日汇总失败:', error)
    }
  },

  // 刷新位置
  refreshLocation() {
    this.getLocation()
  },

  // 刷新配置
  async refreshConfig() {
    await this.loadCheckinConfig()
    this.getLocation()
  },

  // 查看历史记录
  viewHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  }
})
