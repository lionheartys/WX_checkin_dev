// pages/admin/leaveAudit/leaveAudit.js
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

  // 加载请假申请列表
  async loadApplications() {
    this.setData({ loading: true })
    try {
      const res = await api.adminGetLeaveApplications(this.data.activeTab)
      
      if (res.code === 200) {
        // 格式化数据
        const applications = res.data.map(item => ({
          ...item,
          formatStartDate: this.formatDate(item.start_date),
          formatEndDate: this.formatDate(item.end_date),
          formatCreateTime: this.formatDateTime(item.created_at),
          formatApproveTime: item.approve_time ? this.formatDateTime(item.approve_time) : '',
          dateRange: `${this.formatDate(item.start_date)} 至 ${this.formatDate(item.end_date)}`
        }))
        
        this.setData({
          applications
        })
        
        // 更新计数
        this.updateCounts()
      }
    } catch (error) {
      console.error('加载请假申请失败:', error)
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
        const res = await api.adminGetLeaveApplications(status)
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
      title: '审批请假申请',
      content: `确认通过 ${application.username} 的 ${application.type_name} 申请（${application.leave_days}天）？`,
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
      title: '拒绝请假申请',
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
      const res = await api.adminAuditLeave({
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
请假类型：${application.type_name}
请假日期：${application.dateRange}
请假天数：${application.leave_days}天
请假原因：${application.reason}
申请时间：${application.formatCreateTime}
${application.status !== 'pending' ? `审批时间：${application.formatApproveTime}` : ''}
${application.approve_remark ? `审批备注：${application.approve_remark}` : ''}
    `.trim()
    
    wx.showModal({
      title: '请假申请详情',
      content: content,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  // 批量通过
  batchApprove() {
    const pendingCount = this.data.tabs.find(t => t.key === 'pending')?.count || 0
    
    if (pendingCount === 0) {
      wx.showToast({
        title: '没有待审核的申请',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '批量审批',
      content: `确定要批量通过所有待审核的申请（共${pendingCount}个）吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doBatchApprove()
        }
      }
    })
  },

  // 执行批量审批
  async doBatchApprove() {
    wx.showLoading({
      title: '处理中...'
    })
    
    try {
      const pendingApps = this.data.applications.filter(app => app.status === 'pending')
      let successCount = 0
      let failCount = 0
      
      for (const app of pendingApps) {
        try {
          const res = await api.adminAuditLeave({
            application_id: app.id,
            status: 'approved',
            remark: '批量审批通过'
          })
          
          if (res.code === 200) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }
      
      wx.hideLoading()
      
      if (successCount > 0) {
        wx.showToast({
          title: `成功通过${successCount}个申请${failCount > 0 ? `，${failCount}个失败` : ''}`,
          icon: 'none',
          duration: 2000
        })
        
        // 刷新列表
        setTimeout(() => {
          this.loadApplications()
        }, 2000)
      } else {
        wx.showToast({
          title: '批量审批失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('批量审批失败:', error)
      wx.showToast({
        title: '批量审批失败',
        icon: 'none'
      })
    }
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化日期时间
  formatDateTime(datetime) {
    if (!datetime) return ''
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