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
    roleText: '',
    // 添加页面状态标识
    pageStatus: 'loading' // loading, staff, redirecting
  },

  onLoad() {
    this.handleRoleBasedRouting()
  },

  onShow() {
    // 每次显示都检查路由，防止缓存问题
    this.handleRoleBasedRouting()
  },

  // 基于角色的路由处理
  handleRoleBasedRouting() {
    console.log('=== 开始角色路由处理 ===')
    
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    
    console.log('用户信息:', userInfo)
    console.log('Token存在:', !!token)

    // 1. 未登录情况
    if (!token || !userInfo) {
      console.log('用户未登录，跳转到登录页')
      this.setData({ pageStatus: 'redirecting' })
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    // 2. 管理员角色跳转
    if (userInfo.role === 'admin') {
      console.log('管理员角色，跳转到管理员首页')
      this.setData({ pageStatus: 'redirecting' })
      wx.redirectTo({
        url: '/pages/admin/dashboard/dashboard'
      })
      return
    }
    if (userInfo.role === 'project_manager') {
      console.log('项目管理员角色，跳转到项目管理员首页')
      this.setData({ pageStatus: 'redirecting' })
      wx.redirectTo({
        url: '/pages/manager/dashboard/dashboard'
      })
      return
    }

    // 3. 普通员工角色，继续执行页面逻辑
    console.log('普通员工角色，显示员工首页')
    this.setData({ 
      pageStatus: 'staff',
      userInfo: userInfo 
    })
    
    // 初始化员工首页
    this.initStaffPage()
  },

  // 初始化员工页面（原逻辑）
  initStaffPage() {
    this.initPage()
    this.loadTodayRecords()
    
    // 设置角色文本
    const roleMap = {
      'admin': '管理员',
      'project_manager': '项目负责人', 
      'staff': '员工'
    }

    this.setData({
      roleText: roleMap[this.data.userInfo.role] || '员工'
    })
  },

  // 初始化页面
  initPage() {
    const now = new Date()
    this.setData({
      currentDate: util.formatTime(now).split(' ')[0]
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
  },

  // 添加下拉刷新功能
  onPullDownRefresh() {
    console.log('下拉刷新')
    this.loadTodayRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  }
  // 项目入/离场申请
  goToProjectApply() {
    wx.navigateTo({
      url: '/pages/projectApply/projectApply'
    })
  },
  
  // 项目离场申请
  // goToProjectOutApply() {
  //   wx.navigateTo({
  //     url: '/pages/projectApply/projectApply'
  //   })
  // }

})