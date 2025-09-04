const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    startDate: '',
    endDate: '',
    records: [],
    groupedRecords: [],
    loading: false,
    statistics: {
      totalDays: 0,
      normalDays: 0,
      lateDays: 0,
      absentDays: 0
    }
  },

  onLoad() {
    this.initDateRange()
    this.loadHistory()
  },

  onShow() {
    // 从其他页面返回时刷新数据
    this.loadHistory()
  },

  // 初始化日期范围（默认显示最近30天）
  initDateRange() {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    
    this.setData({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    })
  },

  // 开始日期变化
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    })
  },

  // 结束日期变化
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    })
  },

  // 加载历史记录
  async loadHistory() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.getCheckinHistory(userInfo.id)
      
      if (res.code === 200) {
        // 过滤日期范围
        const filteredRecords = this.filterRecordsByDate(res.data)
        
        // 处理记录数据
        const processedRecords = filteredRecords.map(record => ({
          ...record,
          date: new Date(record.checkin_time).toLocaleDateString(),
          time: new Date(record.checkin_time).toTimeString().split(' ')[0],
          statusText: this.getStatusText(record.checkin_status)
        }))

        this.setData({
          records: processedRecords
        })

        // 按日期分组
        this.groupRecordsByDate(processedRecords)
        
        // 计算统计数据
        this.calculateStatistics(processedRecords)
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 按日期过滤记录
  filterRecordsByDate(records) {
    const { startDate, endDate } = this.data
    
    if (!startDate || !endDate) return records
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // 设置为当天结束
    
    return records.filter(record => {
      const recordDate = new Date(record.checkin_time)
      return recordDate >= start && recordDate <= end
    })
  },

  // 按日期分组记录
  groupRecordsByDate(records) {
    const groups = {}
    
    records.forEach(record => {
      const date = record.date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(record)
    })
    
    // 转换为数组并排序
    const groupedRecords = Object.keys(groups)
      .sort((a, b) => new Date(b) - new Date(a)) // 降序排列
      .map(date => ({
        date: this.formatDateDisplay(date),
        records: groups[date].sort((a, b) => 
          new Date(a.checkin_time) - new Date(b.checkin_time)
        )
      }))
    
    this.setData({
      groupedRecords
    })
  },

  // 格式化日期显示
  formatDateDisplay(dateStr) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const dateString = date.toLocaleDateString()
    const todayString = today.toLocaleDateString()
    const yesterdayString = yesterday.toLocaleDateString()
    
    if (dateString === todayString) {
      return `今天 (${dateStr})`
    } else if (dateString === yesterdayString) {
      return `昨天 (${dateStr})`
    } else {
      const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
      return `${dateStr} ${weekDay}`
    }
  },

  // 计算统计数据
  calculateStatistics(records) {
    const dailyStats = {}
    
    // 按日期统计每天的打卡情况
    records.forEach(record => {
      const date = record.date
      if (!dailyStats[date]) {
        dailyStats[date] = {
          hasIn: false,
          hasOut: false,
          hasLate: false,
          hasAbsent: false
        }
      }
      
      const stat = dailyStats[date]
      
      if (record.checkin_type === 'in') {
        stat.hasIn = true
      } else {
        stat.hasOut = true
      }
      
      if (record.checkin_status === 'late') {
        stat.hasLate = true
      } else if (record.checkin_status === 'absent') {
        stat.hasAbsent = true
      }
    })
    
    // 计算各种统计值
    const dates = Object.keys(dailyStats)
    let normalDays = 0
    let lateDays = 0
    let absentDays = 0
    
    dates.forEach(date => {
      const stat = dailyStats[date]
      if (stat.hasAbsent) {
        absentDays++
      } else if (stat.hasLate) {
        lateDays++
      } else if (stat.hasIn && stat.hasOut) {
        normalDays++
      }
    })
    
    this.setData({
      statistics: {
        totalDays: dates.length,
        normalDays,
        lateDays,
        absentDays
      }
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
      'holiday': '休假',
      'abnormal': '异常'
    }
    return statusMap[status] || '正常'
  }
})