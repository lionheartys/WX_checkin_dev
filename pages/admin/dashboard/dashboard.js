// pages/admin/dashboard/dashboard.js
const api = require('../../../utils/request.js')

Page({
  data: {
    userInfo: {},
    statistics: {
      pendingUsers: 0,
      todayCheckins: 0,
      totalUsers: 0,
      abnormalToday: 0
    }
  },

  onLoad() {
    this.setData({
      userInfo: wx.getStorageSync('userInfo')
    })
    this.getStatistics()
  },

  onShow() {
    // 每次显示页面时刷新统计数据
    this.getStatistics()
  },

  // 获取统计数据
  async getStatistics() {
    try {
      const res = await api.request({
        url: '/admin/statistics',
        method: 'GET'
      })
      
      if (res.code === 200) {
        this.setData({
          statistics: res.data
        })
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  },

  // 跳转到用户审核页面
  goToUserAudit() {
    wx.navigateTo({
      url: '/pages/admin/userAudit/userAudit'
    })
  },

  // 跳转到打卡记录页面
  goToCheckinRecords() {
    wx.navigateTo({
      url: '/pages/admin/checkinRecords/checkinRecords'
    })
  },

  // 跳转到用户管理页面
  goToUserManagement() {
    wx.navigateTo({
      url: '/pages/admin/userManagement/userManagement'
    })
  },

  // 跳转到数据统计页面
  goToStatistics() {
    wx.navigateTo({
      url: '/pages/admin/statistics/statistics'
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }
      }
    })
  }
})