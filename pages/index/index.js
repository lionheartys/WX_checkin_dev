const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    currentDate: '',
    todayRecords: [],
    checkinStatus: {
      text: '未打卡',
      class: 'none'
    },
    roleText: ''
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.checkLoginStatus()
    this.loadTodayRecords()
  },

  // 初始化页面
  initPage() {
    const now = new Date()
    this.setData({
      currentDate: util.formatTime(now).split(' ')[0]
    })
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    const roleMap = {
      'admin': '管理员',
      'project_manager': '项目负责人', 
      'staff': '员工'
    }

    this.setData({
      userInfo,
      roleText: roleMap[userInfo.role] || '员工'
    })
  },

  // 加载今日打卡记录
  async loadTodayRecords() {
    const userInfo = this.data.userInfo
    if (!userInfo) return

    try {
      const res = await api.getCheckinHistory(userInfo.id)
      if (res.code === 200) {
        const today = new Date().toDateString()
        const todayRecords = res.data.filter(record => {
          return new Date(record.checkin_time).toDateString() === today
        }).map(record => ({
          ...record,
          time: new Date(record.checkin_time).toTimeString().split(' ')[0],
          statusText: this.getStatusText(record.checkin_status)
        }))

        this.setData({
          todayRecords
        })

        this.updateCheckinStatus(todayRecords)
      }
    } catch (error) {
      console.error('加载打卡记录失败:', error)
    }
  },

  // 更新打卡状态
  updateCheckinStatus(records) {
    const hasCheckedIn = records.some(r => r.checkin_type === 'in')
    const hasCheckedOut = records.some(r => r.checkin_type === 'out')
    
    let status = { text: '未打卡', class: 'none' }
    
    if (hasCheckedIn && hasCheckedOut) {
      status = { text: '已完成', class: 'complete' }
    } else if (hasCheckedIn) {
      status = { text: '已上班', class: 'partial' }
    }

    this.setData({
      checkinStatus: status
    })
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'normal': '正常',
      'late': '迟到',
      'early': '早退',
      'absent': '缺勤',
      'leave': '请假',
      'abnormal': '异常'
    }
    return statusMap[status] || '正常'
  },

  // 跳转到打卡页面
  goToCheckin() {
    console.log('快速打卡点击事件触发');
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    })
  },

  // 跳转到历史记录
  goToHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  },

 // 跳转到请假页面
goToLeave() {
    wx.navigateTo({
      url: '/pages/leave/leave'
    })
  }
})