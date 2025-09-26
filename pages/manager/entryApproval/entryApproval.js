// pages/manager/entryApproval/entryApproval.js
const api = require('../../../utils/request.js')

Page({
  data: {
    applications: [],
    filteredApplications: [],
    currentFilter: 'all',
    currentFilterIndex: 0, // 添加索引用于picker
    filterOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审批' },
      { value: 'approved', label: '已批准' },
      { value: 'rejected', label: '已拒绝' }
    ],
    expandedUsers: {},
    expandedProjects: {},
    showApproveDialog: false,
    currentApproval: null,
    approveRemark: '',
    statistics: {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    }
  },

  onLoad() {
    this.loadApplications()
    this.loadStatistics()
  },

  onShow() {
    this.loadApplications()
    this.loadStatistics()
  },

  // 加载申请列表
  async loadApplications() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await api.managerGetEntryApplications({
        status: this.data.currentFilter === 'all' ? 'all' : this.data.currentFilter
      })
      
      if (res.code === 200) {
        // 格式化数据中的日期时间
        const formattedData = (res.data || []).map(userGroup => ({
          ...userGroup,
          projects: userGroup.projects.map(project => ({
            ...project,
            applications: project.applications.map(app => ({
              ...app,
              formatted_expect_leavetime: app.expect_leavetime ? this.formatDateTime(app.expect_leavetime) : '',
              formatted_created_at: this.formatDateTime(app.created_at),
              formatted_approve_time: app.approve_time ? this.formatDateTime(app.approve_time) : ''
            }))
          }))
        }))
        
        this.setData({
          applications: formattedData,
          filteredApplications: formattedData
        })
      } else {
        wx.showToast({
          title: res.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载申请列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载统计数据
  async loadStatistics() {
    try {
      const res = await api.managerGetEntryStatistics()
      
      if (res.code === 200) {
        this.setData({
          statistics: {
            pending: res.data.pending_count,
            approved: res.data.approved_count,
            rejected: res.data.rejected_count,
            total: res.data.total_count
          }
        })
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  // 切换用户展开/收起
  toggleUser(e) {
    const userId = e.currentTarget.dataset.userId
    const expandedUsers = this.data.expandedUsers
    expandedUsers[userId] = !expandedUsers[userId]
    
    this.setData({ expandedUsers })
  },

  // 切换项目展开/收起
  toggleProject(e) {
    const key = e.currentTarget.dataset.key
    const expandedProjects = this.data.expandedProjects
    expandedProjects[key] = !expandedProjects[key]
    
    this.setData({ expandedProjects })
  },

  // 切换筛选
  onFilterChange(e) {
    const filterIndex = e.detail.value
    const filterValue = this.data.filterOptions[filterIndex].value
    this.setData({
      currentFilter: filterValue,
      currentFilterIndex: filterIndex,
      expandedUsers: {},
      expandedProjects: {}
    })
    this.loadApplications()
  },

  // 显示审批对话框
  showApproveDialog(e) {
    const application = e.currentTarget.dataset.application
    const action = e.currentTarget.dataset.action
    const userGroup = e.currentTarget.dataset.usergroup
    
    this.setData({
      showApproveDialog: true,
      currentApproval: {
        ...application,
        username: userGroup.username,  // 添加用户名
        action
      },
      approveRemark: ''
    })
  },

  // 关闭审批对话框
  closeApproveDialog() {
    this.setData({
      showApproveDialog: false,
      currentApproval: null,
      approveRemark: ''
    })
  },

  // 输入审批备注
  onRemarkInput(e) {
    this.setData({
      approveRemark: e.detail.value
    })
  },

  // 确认审批
  async confirmApprove() {
    const { currentApproval, approveRemark } = this.data
    
    if (!currentApproval) return
    
    wx.showLoading({ title: '处理中...' })
    
    try {
      const res = await api.managerApproveEntry(currentApproval.id, {
        status: currentApproval.action,
        approve_remark: approveRemark
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: res.message || (currentApproval.action === 'approved' ? '已批准' : '已拒绝'),
          icon: 'success'
        })
        
        this.closeApproveDialog()
        this.loadApplications()
        this.loadStatistics()
      } else {
        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('审批失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      expired: '已过期'
    }
    return map[status] || status
  },

  // 获取状态颜色
  getStatusColor(status) {
    const map = {
      pending: '#ff9800',
      approved: '#4caf50',
      rejected: '#f44336',
      expired: '#9e9e9e'
    }
    return map[status] || '#666'
  },

  // 获取申请类型文本
  getEntryTypeText(type) {
    return type === 'entry' ? '入场申请' : '离场申请'
  },

  // 获取申请类型颜色
  getEntryTypeColor(type) {
    return type === 'entry' ? '#2196f3' : '#ff5722'
  },

  // 下拉刷新
  onPullDownRefresh() {
    Promise.all([
      this.loadApplications(),
      this.loadStatistics()
    ]).then(() => {
      wx.stopPullDownRefresh()
    })
  }
})