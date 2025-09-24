// pages/leave/leave.js
const api = require('../../utils/request.js')

Page({
  data: {
    activeTab: 'apply', // apply: 申请请假, history: 请假记录, quota: 调休额度
    userInfo: null,
    
    // 请假申请相关
    leaveTypes: [], // 从后端加载
    selectedTypeIndex: 0,
    selectedType: null,
    startDate: '',
    endDate: '',
    reason: '',
    leaveDays: 0,
    
    // 调休额度申请相关
    businessStartDate: '',
    businessEndDate: '',
    businessDays: 0,
    quotaDays: 0,
    projectId: null, // 从用户信息获取
    
    // 请假历史
    leaveHistory: [],
    
    // 调休额度
    compensatoryQuota: {
      total: 0,
      used: 0,
      available: 0
    },
    
    // 调休规则配置
    compensatoryRules: {
      minBusinessDays: 14,  // 默认值，可从后端配置
      baseDaysPerQuota: 10   // 默认值，可从后端配置
    },
    
    // UI状态
    loading: false,
    showQuotaDialog: false
  },

  async onLoad() {
    await this.loadUserInfo()
    await this.loadLeaveTypes()
    await this.loadCompensatoryRules()
    this.initPage()
  },

  async onShow() {
    if (this.data.userInfo) {
      await this.loadLeaveHistory()
      await this.loadCompensatoryQuota()
    }
  },

  // 初始化页面
  initPage() {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    this.setData({
      startDate: this.formatDate(today),
      endDate: this.formatDate(tomorrow),
      businessStartDate: this.formatDate(today),
      businessEndDate: this.formatDate(tomorrow)
    })
    
    // 设置默认选中的请假类型
    if (this.data.leaveTypes.length > 0) {
      this.setData({
        selectedType: this.data.leaveTypes[0],
        selectedTypeIndex: 0
      })
    }
    
    this.calculateLeaveDays()
  },

  // 加载用户信息
  async loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }
    
    // 设置用户信息和项目ID
    this.setData({ 
      userInfo,
      projectId: userInfo.project_id || userInfo.default_project_id || 1
    })
  },

  // 从后端加载请假类型
  async loadLeaveTypes() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await api.request({
        url: '/leave/types',
        method: 'GET'
      })
      
      if (res.code === 200 && res.data) {
        this.setData({
          leaveTypes: res.data,
          selectedType: res.data[0] || null,
          selectedTypeIndex: 0
        })
      }
    } catch (error) {
      console.error('加载请假类型失败:', error)
      // 如果加载失败，使用基本类型
      this.setData({
        leaveTypes: [
          { id: 1, type_name: '事假', type_code: 'personal' },
          { id: 2, type_name: '病假', type_code: 'sick' }
        ]
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载调休规则配置（如果后端支持）
  async loadCompensatoryRules() {
    try {
      const res = await api.request({
        url: '/leave/compensatory/rules',
        method: 'GET'
      })
      
      if (res.code === 200 && res.data) {
        this.setData({
          compensatoryRules: {
            minBusinessDays: res.data.min_business_days || 14,
            baseDaysPerQuota: res.data.extra_days_per_quota || 10
          }
        })
      }
    } catch (error) {
      // 如果后端没有这个接口，使用默认值
      console.log('使用默认调休规则')
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    
    if (tab === 'history') {
      this.loadLeaveHistory()
    } else if (tab === 'quota') {
      this.loadCompensatoryQuota()
    }
  },

  // 选择请假类型
  onLeaveTypeChange(e) {
    const index = e.detail.value
    this.setData({
      selectedTypeIndex: index,
      selectedType: this.data.leaveTypes[index]
    })
    
    // 如果选择了调休，检查额度
    if (this.data.leaveTypes[index].type_code === 'compensatory') {
      this.checkCompensatoryQuota()
    }
  },

  // 选择开始日期
  onStartDateChange(e) {
    const startDate = e.detail.value
    this.setData({ startDate })
    
    // 如果结束日期早于开始日期，自动调整
    if (this.data.endDate < startDate) {
      this.setData({ endDate: startDate })
    }
    
    this.calculateLeaveDays()
  },

  // 选择结束日期
  onEndDateChange(e) {
    const endDate = e.detail.value
    this.setData({ endDate })
    
    // 如果开始日期晚于结束日期，自动调整
    if (this.data.startDate > endDate) {
      this.setData({ startDate: endDate })
    }
    
    this.calculateLeaveDays()
  },

  // 计算请假天数
  calculateLeaveDays() {
    const start = new Date(this.data.startDate)
    const end = new Date(this.data.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    
    this.setData({ leaveDays: days })
  },

  // 输入请假原因
  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  // 检查调休额度
  async checkCompensatoryQuota() {
    if (!this.data.userInfo) return
    
    try {
      const res = await api.request({
        url: `/leave/compensatory/quota/${this.data.userInfo.id}`,
        method: 'GET'
      })
      
      if (res.code === 200) {
        const available = res.data.available || 0
        
        this.setData({
          compensatoryQuota: res.data
        })
        
        if (available < this.data.leaveDays) {
          wx.showToast({
            title: `调休额度不足，可用${available}天`,
            icon: 'none',
            duration: 2000
          })
        }
      }
    } catch (error) {
      console.error('检查调休额度失败:', error)
    }
  },

  // 提交请假申请
  async submitLeaveApplication() {
    // 验证表单
    if (!this.data.selectedType) {
      wx.showToast({
        title: '请选择请假类型',
        icon: 'none'
      })
      return
    }
    
    if (!this.data.reason.trim()) {
      wx.showToast({
        title: '请输入请假原因',
        icon: 'none'
      })
      return
    }
    
    if (this.data.leaveDays <= 0) {
      wx.showToast({
        title: '请假天数不正确',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '确认提交',
      content: `确定要申请${this.data.selectedType.type_name} ${this.data.leaveDays}天吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doSubmitLeave()
        }
      }
    })
  },

  // 执行提交请假
  async doSubmitLeave() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    wx.showLoading({ title: '提交中...' })
    
    try {
      const data = {
        leave_type_id: this.data.selectedType.id,
        start_date: this.data.startDate,
        end_date: this.data.endDate,
        reason: this.data.reason
      }
      
      const res = await api.request({
        url: '/leave/apply',
        method: 'POST',
        data
      })
      
      wx.hideLoading()
      
      if (res.code === 200) {
        wx.showToast({
          title: '申请提交成功',
          icon: 'success'
        })
        
        // 清空表单
        this.initPage()
        
        // 切换到历史记录
        setTimeout(() => {
          this.setData({ activeTab: 'history' })
          this.loadLeaveHistory()
        }, 1500)
      } else {
        wx.showToast({
          title: res.message || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('提交请假申请失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 显示调休额度申请对话框
  showQuotaApplication() {
    this.setData({ showQuotaDialog: true })
    this.calculateBusinessDays()
  },

  // 隐藏调休额度申请对话框
  hideQuotaDialog() {
    this.setData({ 
      showQuotaDialog: false,
      businessStartDate: this.formatDate(new Date()),
      businessEndDate: this.formatDate(new Date()),
      businessDays: 0,
      quotaDays: 0
    })
  },

  // 出差开始日期变化
  onBusinessStartDateChange(e) {
    const businessStartDate = e.detail.value
    this.setData({ businessStartDate })
    
    if (this.data.businessEndDate < businessStartDate) {
      this.setData({ businessEndDate: businessStartDate })
    }
    
    this.calculateBusinessDays()
  },

  // 出差结束日期变化
  onBusinessEndDateChange(e) {
    const businessEndDate = e.detail.value
    this.setData({ businessEndDate })
    
    if (this.data.businessStartDate > businessEndDate) {
      this.setData({ businessStartDate: businessEndDate })
    }
    
    this.calculateBusinessDays()
  },

  // 计算出差天数和调休额度
  calculateBusinessDays() {
    const start = new Date(this.data.businessStartDate)
    const end = new Date(this.data.businessEndDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    
    // 使用配置的规则计算
    const { minBusinessDays, baseDaysPerQuota } = this.data.compensatoryRules
    let quotaDays = 0
    
    if (days >= minBusinessDays) {
      quotaDays = Math.floor((days - minBusinessDays) / baseDaysPerQuota) + 1
    }
    
    this.setData({ 
      businessDays: days,
      quotaDays: quotaDays
    })
  },

  // 提交调休额度申请
  async submitQuotaApplication() {
    const { minBusinessDays } = this.data.compensatoryRules
    
    if (this.data.businessDays < minBusinessDays) {
      wx.showToast({
        title: `出差天数不足${minBusinessDays}天`,
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({ title: '提交中...' })
    
    try {
      const data = {
        project_id: this.data.projectId,
        start_date: this.data.businessStartDate,
        end_date: this.data.businessEndDate
      }
      
      const res = await api.request({
        url: '/leave/compensatory/apply',
        method: 'POST',
        data
      })
      
      wx.hideLoading()
      
      if (res.code === 200) {
        wx.showToast({
          title: '申请提交成功',
          icon: 'success'
        })
        
        this.hideQuotaDialog()
        this.loadCompensatoryQuota()
      } else {
        wx.showToast({
          title: res.message || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('提交调休额度申请失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  // 加载请假历史（从后端获取真实数据）
  async loadLeaveHistory() {
    if (!this.data.userInfo) return
    
    this.setData({ loading: true })
    
    try {
      const res = await api.request({
        url: `/leave/applications/${this.data.userInfo.id}`,
        method: 'GET'
      })
      
      if (res.code === 200 && res.data) {
        this.setData({
          leaveHistory: res.data.map(item => ({
            ...item,
            statusText: this.getStatusText(item.status),
            statusClass: item.status,
            dateRange: `${item.start_date} 至 ${item.end_date}`,
            // 格式化时间
            created_at: this.formatDateTime(item.created_at)
          }))
        })
      } else {
        this.setData({ leaveHistory: [] })
      }
    } catch (error) {
      console.error('加载请假历史失败:', error)
      this.setData({ leaveHistory: [] })
      wx.showToast({
        title: '加载请假记录失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载调休额度（从后端获取真实数据）
  async loadCompensatoryQuota() {
    if (!this.data.userInfo) return
    
    try {
      const res = await api.request({
        url: `/leave/compensatory/quota/${this.data.userInfo.id}`,
        method: 'GET'
      })
      
      if (res.code === 200 && res.data) {
        this.setData({
          compensatoryQuota: {
            total: res.data.total || 0,
            used: res.data.used || 0,
            available: res.data.available || 0
          }
        })
      } else {
        this.setData({
          compensatoryQuota: {
            total: 0,
            used: 0,
            available: 0
          }
        })
      }
    } catch (error) {
      console.error('加载调休额度失败:', error)
      this.setData({
        compensatoryQuota: {
          total: 0,
          used: 0,
          available: 0
        }
      })
    }
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待审批',
      'approved': '已通过',
      'rejected': '已拒绝',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知'
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化日期时间
  formatDateTime(datetime) {
    if (!datetime) return ''
    
    const date = new Date(datetime)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 查看请假详情
  viewLeaveDetail(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.leaveHistory[index]
    
    let content = `类型：${item.type_name}\n`
    content += `日期：${item.dateRange}\n`
    content += `天数：${item.leave_days}天\n`
    content += `原因：${item.reason}\n`
    content += `状态：${item.statusText}\n`
    content += `申请时间：${item.created_at}`
    
    if (item.approve_time) {
      content += `\n审批时间：${this.formatDateTime(item.approve_time)}`
    }
    
    if (item.approve_remark) {
      content += `\n审批备注：${item.approve_remark}`
    }
    
    wx.showModal({
      title: '请假详情',
      content: content,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  // 取消请假申请
  async cancelLeaveApplication(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.leaveHistory[index]
    
    if (item.status !== 'pending') {
      wx.showToast({
        title: '只能取消待审批的申请',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个请假申请吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.request({
              url: `/leave/cancel/${item.id}`,
              method: 'POST'
            })
            
            if (result.code === 200) {
              wx.showToast({
                title: '取消成功',
                icon: 'success'
              })
              this.loadLeaveHistory()
            } else {
              wx.showToast({
                title: result.message || '取消失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('取消请假申请失败:', error)
            wx.showToast({
              title: '取消失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
})