const api = require('../../../utils/request.js')

Page({
  data: {
    records: [],
    selectedDate: '',
    statusOptions: [
      { value: '', label: '全部' },
      { value: 'normal', label: '正常' },
      { value: 'late', label: '迟到' },
      { value: 'early', label: '早退' },
      { value: 'absent', label: '缺勤' }
    ],
    statusIndex: 0,
    statusMap: {
      normal: '正常',
      late: '迟到',
      early: '早退',
      absent: '缺勤',
      abnormal: '异常'
    }
  },

  onLoad() {
    // 默认显示今天的记录
    const today = new Date().toISOString().split('T')[0]
    this.setData({ selectedDate: today })
    this.loadRecords()
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value })
    this.loadRecords()
  },

  onStatusChange(e) {
    this.setData({ statusIndex: e.detail.value })
    this.loadRecords()
  },

  async loadRecords() {
    wx.showLoading({ title: '加载中...' })
    
    const params = {}
    if (this.data.selectedDate) {
      params.date = this.data.selectedDate
    }
    if (this.data.statusOptions[this.data.statusIndex].value) {
      params.status = this.data.statusOptions[this.data.statusIndex].value
    }

    try {
      const res = await api.adminGetCheckinRecords(params)
      if (res.code === 200) {
        this.setData({
          records: res.data || []
        })
      }
    } catch (error) {
      console.error('获取打卡记录失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})