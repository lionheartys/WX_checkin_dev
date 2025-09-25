// pages/manager/dashboard/dashboard.js
const api = require('../../../utils/request.js')

Page({
  data: {
    userInfo: {},
    statistics: {
      todayCheckins: 0,       // 今日打卡人数
      abnormalToday: 0,       // 今日异常数
      pendingMakeup: 0,       // 待审核补卡
      //pendingLeave: 0,        // 待审核请假
      pendingEntry: 0         // 待审核入场申请
    }
  },

  onLoad() {
    this.setData({
      userInfo: wx.getStorageSync('userInfo')
    })
    this.getStatistics()
    this.getPendingMakeupCount()
    //this.getPendingLeaveCount()
    this.getPendingEntryCount()
  },

  onShow() {
    this.getStatistics()
    this.getPendingMakeupCount()
    //this.getPendingLeaveCount()
    this.getPendingEntryCount()
  },

  // 获取统计数据（只针对当前项目）
  async getStatistics() {
    try {
      const res = await api.request({
        url: '/manager/statistics',
        method: 'GET'
      })
      if (res.code === 200) {
        this.setData({
          statistics: { ...this.data.statistics, ...res.data }
        })
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  },

  // 获取待审核补卡申请数
  async getPendingMakeupCount() {
    try {
      const res = await api.request({
        url: '/manager/makeup-applications?status=pending',
        method: 'GET'
      })
      if (res.code === 200) {
        this.setData({
          'statistics.pendingMakeup': res.data.length
        })
      }
    } catch (error) {
      console.error('获取待审核补卡数失败:', error)
    }
  },

  //获取待审核请假申请数
  async getPendingLeaveCount() {
    try {
      const res = await api.request({
        url: '/manager/leave-applications?status=pending',
        method: 'GET'
      })
      if (res.code === 200) {
        this.setData({
          'statistics.pendingLeave': res.data.length
        })
      }
    } catch (error) {
      console.error('获取待审核请假数失败:', error)
    }
  },

  // 获取待审批入场申请数
  async getPendingEntryCount() {
    try {
      const res = await api.request({
        url: '/manager/entry-applications?status=pending',
        method: 'GET'
      })
      if (res.code === 200) {
        this.setData({
          'statistics.pendingEntry': res.data.length
        })
      }
    } catch (error) {
      console.error('获取待审批入场申请数失败:', error)
    }
  },

  // 跳转到打卡记录页面
  goToCheckinRecords() {
    wx.navigateTo({
      url: '/pages/manager/checkinRecords/checkinRecords'
    })
  },

  // 跳转到补卡审核页面
  goToMakeupAudit() {
    wx.navigateTo({
      url: '/pages/manager/makeupAudit/makeupAudit'
    })
  },

  // 跳转到请假审核页面
  //goToLeaveAudit() {
    //wx.navigateTo({
      //url: '/pages/manager/leaveAudit/leaveAudit'
    //})
  //},

  // 跳转到打卡地管理页面
  goToLocationManagement() {
    wx.navigateTo({
      url: '/pages/manager/locationManagement/locationManagement'
    })
  },

  // 跳转到项目管理页面
  goToProjectManagement() {
    wx.navigateTo({
      url: '/pages/manager/projectManagement/projectManagement'
    })
  },

  // 跳转到入场申请审批页面
  goToEntryApproval() {
    wx.navigateTo({
      url: '/pages/manager/entryApproval/entryApproval'
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
