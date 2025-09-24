// pages/admin/dashboard/dashboard.js
const api = require('../../../utils/request.js')

Page({
  data: {
    userInfo: {},
    statistics: {
      pendingUsers: 0,
      todayCheckins: 0,
      totalUsers: 0,
      abnormalToday: 0,
      pendingMakeup: 0,  // 待审核补卡数
      totalCompanies: 0,  // 新增总公司数
      expiringCompanies: 0  // 新增即将过期公司数
    }
  },

  onLoad() {
    this.setData({
      userInfo: wx.getStorageSync('userInfo')
    })
    this.getStatistics()
    this.getPendingMakeupCount()  // 获取待审核补卡数
    this.getCompanyStatistics()  // 获取公司统计数据
  },

  onShow() {
    // 每次显示页面时刷新统计数据
    this.getStatistics()
    this.getPendingMakeupCount()
    this.getCompanyStatistics()
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
          statistics: { ...this.data.statistics, ...res.data }
        })
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  },

  // 获取待审核补卡申请数量
  async getPendingMakeupCount() {
    try {
      const res = await api.adminGetMakeupApplications('pending')
      if (res.code === 200) {
        this.setData({
          'statistics.pendingMakeup': res.data.length
        })
      }
    } catch (error) {
      console.error('获取待审核补卡数失败:', error)
    }
  },

  // 获取公司统计数据
  async getCompanyStatistics() {
    try {
      const res = await api.adminGetCompanies({ page: 1, pageSize: 100 })
      if (res.code === 200) {
        const companies = res.data.list
        const totalCompanies = res.data.total
        const expiringCompanies = companies.filter(c => 
          c.validity_status === 'expiring' || c.validity_status === 'expired'
        ).length
        
        this.setData({
          'statistics.totalCompanies': totalCompanies,
          'statistics.expiringCompanies': expiringCompanies
        })
      }
    } catch (error) {
      console.error('获取公司统计数据失败:', error)
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

  // 跳转到补卡审核页面
  goToMakeupAudit() {
    wx.navigateTo({
      url: '/pages/admin/makeupAudit/makeupAudit'
    })
  },

  // 跳转到请假审核页面
  goToLeaveAudit() {
    wx.navigateTo({
      url: '/pages/admin/leaveAudit/leaveAudit'
    })
  },

  // 跳转到打卡地管理页面
  goToLocationManagement() {
    wx.navigateTo({
      url: '/pages/admin/locationManagement/locationManagement'
    })
  },

  // 跳转到公司管理页面
  goToCompanyManagement() {
    wx.navigateTo({
      url: '/pages/admin/companyManagement/companyManagement'
    })
  },

  // 跳转到项目管理页面
  goToProjectManagement() {
    wx.navigateTo({
      url: '/pages/admin/projectManagement/projectManagement'
    })
  },

  // 跳转到项目入场审批页面
  goToEntryApproval() {
    wx.navigateTo({
      url: '/pages/admin/entryApproval/entryApproval'
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