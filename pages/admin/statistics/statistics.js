const api = require('../../../utils/request.js')

Page({
  data: {
    startDate: '',
    endDate: '',
    statistics: {
      totalCheckins: 0,
      avgDaily: 0,
      lateCount: 0,
      earlyCount: 0,
      attendanceRate: 85,
      punctualRate: 78
    },
    topDepartments: [
      { name: '技术部', rate: 95 },
      { name: '市场部', rate: 92 },
      { name: '人事部', rate: 90 },
      { name: '财务部', rate: 88 },
      { name: '运营部', rate: 85 }
    ]
  },

  onLoad() {
    // 设置默认日期范围（最近7天）
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    
    this.setData({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate)
    })
    
    this.loadStatistics()
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
    this.loadStatistics()
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
    this.loadStatistics()
  },

  async loadStatistics() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      // 这里可以调用实际的统计API
      // const res = await api.adminGetDetailedStatistics({
      //   startDate: this.data.startDate,
      //   endDate: this.data.endDate
      // })
      
      // 模拟数据
      setTimeout(() => {
        this.setData({
          statistics: {
            totalCheckins: Math.floor(Math.random() * 1000) + 500,
            avgDaily: Math.floor(Math.random() * 50) + 20,
            lateCount: Math.floor(Math.random() * 50),
            earlyCount: Math.floor(Math.random() * 30),
            attendanceRate: Math.floor(Math.random() * 20) + 75,
            punctualRate: Math.floor(Math.random() * 30) + 65
          }
        })
        wx.hideLoading()
      }, 500)
      
    } catch (error) {
      console.error('获取统计数据失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
      wx.hideLoading()
    }
  },

  exportData() {
    wx.showModal({
      title: '提示',
      content: '确定要导出统计报表吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '导出功能开发中',
            icon: 'none'
          })
        }
      }
    })
  }
})