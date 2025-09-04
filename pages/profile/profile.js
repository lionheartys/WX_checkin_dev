const api = require('../../utils/request.js')

Page({
  data: {
    userInfo: {},
    roleText: '',
    monthStats: {
      totalDays: 0,
      lateTimes: 0,
      leaveDays: 0,
      overtimeHours: 0
    }
  },

  onLoad() {
    this.loadUserInfo()
    this.loadMonthStats()
  },

  onShow() {
    this.loadUserInfo()
    this.loadMonthStats()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    const roleMap = {
      'admin': '系统管理员',
      'project_manager': '项目负责人',
      'staff': '普通员工'
    }

    this.setData({
      userInfo,
      roleText: roleMap[userInfo.role] || '员工'
    })
  },

  // 加载本月统计数据
  async loadMonthStats() {
    const userInfo = this.data.userInfo
    if (!userInfo.id) return

    try {
      const res = await api.getCheckinHistory(userInfo.id)
      if (res.code === 200) {
        const monthStats = this.calculateMonthStats(res.data)
        this.setData({ monthStats })
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  // 计算本月统计数据
  calculateMonthStats(records) {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // 过滤本月记录
    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.checkin_time)
      return recordDate.getMonth() === currentMonth && 
             recordDate.getFullYear() === currentYear
    })

    // 按日期分组
    const dailyRecords = {}
    monthRecords.forEach(record => {
      const date = new Date(record.checkin_time).toDateString()
      if (!dailyRecords[date]) {
        dailyRecords[date] = []
      }
      dailyRecords[date].push(record)
    })

    // 计算统计数据
    let totalDays = 0
    let lateTimes = 0
    let leaveDays = 0
    let overtimeHours = 0

    Object.values(dailyRecords).forEach(dayRecords => {
      const hasNormalCheckin = dayRecords.some(r => 
        r.checkin_status === 'normal' || r.checkin_status === 'late'
      )
      
      if (hasNormalCheckin) {
        totalDays++
      }

      // 计算迟到次数
      const lateCount = dayRecords.filter(r => r.checkin_status === 'late').length
      lateTimes += lateCount

      // 计算请假天数
      const leaveCount = dayRecords.filter(r => r.checkin_status === 'leave').length
      if (leaveCount > 0) {
        leaveDays++
      }

      // 简单计算加班时长（这里可以根据实际业务逻辑调整）
      const inRecord = dayRecords.find(r => r.checkin_type === 'in')
      const outRecord = dayRecords.find(r => r.checkin_type === 'out')
      
      if (inRecord && outRecord) {
        const inTime = new Date(inRecord.checkin_time)
        const outTime = new Date(outRecord.checkin_time)
        const workHours = (outTime - inTime) / (1000 * 60 * 60)
        
        // 假设标准工作时长8小时，超过的算加班
        if (workHours > 8) {
          overtimeHours += Math.round((workHours - 8) * 10) / 10
        }
      }
    })

    return {
      totalDays,
      lateTimes,
      leaveDays,
      overtimeHours: Math.round(overtimeHours * 10) / 10
    }
  },

  // 前往设置页面
  goToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    })
  },

  // 前往帮助页面
  goToHelp() {
    wx.showToast({
      title: '帮助功能开发中',
      icon: 'none'
    })
  },

  // 前往关于页面
  goToAbout() {
    wx.showModal({
      title: '关于企业打卡',
      content: '企业打卡系统 v1.0.0\n\n一款简单易用的企业考勤管理工具，支持地理位置打卡、考勤统计、请假申请等功能。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          
          // 清除全局数据
          const app = getApp()
          app.globalData.token = ''
          app.globalData.userInfo = null
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }
      }
    })
  }
})