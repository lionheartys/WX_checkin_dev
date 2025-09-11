// pages/admin/makeupAudit/makeupAudit.js
const api = require('../../../utils/request.js')

Page({
  data: {
    activeTab: 'pending',
    tabs: [
      { key: 'pending', title: '待审核', count: 0 },
      { key: 'approved', title: '已通过', count: 0 },
      { key: 'rejected', title: '已拒绝', count: 0 }
    ],
    applications: [],
    loading: false,
    remarkInput: '',  // 审批备注
    currentApplication: null  // 当前处理的申请
  },

  onLoad() {
    this.loadApplications()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadApplications()
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab
    })
    this.loadApplications()
  },

  // 加载补卡申请列表
  async loadApplications() {
    this.setData({ loading: true })
    try {
      const res = await api.adminGetMakeupApplications(this.data.activeTab)
      
      if (res.code === 200) {
        // 格式化数据
        const applications = res.data.map(item => ({
          ...item,
          formatDate: this.formatDate(item.makeup_date),
          formatCreateTime: this.formatDateTime(item.created_at),
          formatApproveTime: item.approve_time ? this.formatDateTime(item.approve_time) : '',
          typeText: item.makeup_type === 'in' ? '上班' : '下班'
        }))
        
        this.setData({
          applications
        })
        
        // 更新计数
        this.updateCounts()
      }
    } catch (error) {
      console.error('加载补卡申请失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 更新各状态数量
  async updateCounts() {
    try {
      // 获取各状态的数量
      const statuses = ['pending', 'approved', 'rejected']
      const counts = {}
      
      for (const status of statuses) {
        const res = await api.adminGetMakeupApplications(status)
        if (res.code === 200) {
          counts[status] = res.data.length
        }
      }
      
      // 更新标签显示
      const tabs = this.data.tabs.map(tab => ({
        ...tab,
        count: counts[tab.key] || 0
      }))
      
      this.setData({ tabs })
    } catch (error) {
      console.error('更新计数失败:', error)
    }
  },

  // 显示审批对话框
  showAuditDialog(e) {
    const index = e.currentTarget.dataset.index
    const application = this.data.applications[index]
    
    this.setData({
      currentApplication: application,
      remarkInput: ''
    })
    
    wx.showModal({
      title: '审批补卡申请',
      content: `确认通过 ${application.username} 的 ${application.formatDate} ${application.typeText} 补卡申请？`,
      confirmText: '通过',
      cancelText: '拒绝',
      success: (res) => {
        if (res.confirm) {
          this.handleAudit('approved')
        } else if (res.cancel) {
          this.showRejectDialog()
        }
      }
    })
  },

  // 显示拒绝对话框
  showRejectDialog() {
    wx.showModal({
      title: '拒绝补卡申请',
      editable: true,
      placeholderText: '请输入拒绝理由',
      success: (res) => {
        if (res.confirm) {
          this.setData({ remarkInput: res.content })
          this.handleAudit('rejected')
        }
      }
    })
  },

  // 处理审批
  async handleAudit(status) {
    if (!this.data.currentApplication) return
    
    wx.showLoading({
      title: '处理中...'
    })
    
    try {
      const res = await api.adminAuditMakeup({
        application_id: this.data.currentApplication.id,
        status: status,
        remark: this.data.remarkInput || (status === 'approved' ? '审批通过' : '审批拒绝')
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '审批成功',
          icon: 'success'
        })
        
        // 重新加载数据
        this.loadApplications()
      }
    } catch (error) {
      console.error('审批失败:', error)
      wx.showToast({
        title: '审批失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
      this.setData({
        currentApplication: null,
        remarkInput: ''
      })
    }
  },

  // 查看详情
  viewDetail(e) {
    const index = e.currentTarget.dataset.index
    const application = this.data.applications[index]
    
    const content = `
申请人：${application.username}
电话：${application.phone}
项目：${application.project_name}
打卡地点：${application.location_name}
补卡日期：${application.formatDate}
补卡类型：${application.typeText}
申请理由：${application.reason}
申请时间：${application.formatCreateTime}
${application.status !== 'pending' ? `审批时间：${application.formatApproveTime}` : ''}
${application.approve_remark ? `审批备注：${application.approve_remark}` : ''}
    `.trim()
    
    wx.showModal({
      title: '补卡申请详情',
      content: content,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  // 格式化日期
  formatDate(date) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化日期时间
  formatDateTime(datetime) {
    const d = new Date(datetime)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadApplications().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})