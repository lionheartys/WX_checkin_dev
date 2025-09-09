// pages/admin/userAudit/userAudit.js
const api = require('../../../utils/request.js')

Page({
  data: {
    pendingUsers: []
  },

  onLoad() {
    this.getPendingUsers()
  },

  // 获取待审核用户列表
  async getPendingUsers() {
    wx.showLoading({ title: '加载中...' })
    try {
      // 改为使用具体的 API 方法
      const res = await api.adminGetPendingUsers()
      
      if (res.code === 200) {
        this.setData({
          pendingUsers: res.data || []
        })
      }
    } catch (error) {
      console.error('获取待审核用户失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 通过审核
  async approveUser(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认',
      content: '确定通过该用户的注册申请？',
      success: async (res) => {
        if (res.confirm) {
          await this.auditUser(userId, 'approved')
        }
      }
    })
  },

  // 拒绝审核
  async rejectUser(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认',
      content: '确定拒绝该用户的注册申请？',
      success: async (res) => {
        if (res.confirm) {
          await this.auditUser(userId, 'rejected')
        }
      }
    })
  },

  // 审核用户
  async auditUser(userId, status) {
    wx.showLoading({ title: '处理中...' })
    try {
      // 改为使用具体的 API 方法
      // const res = await api.adminAuditUser({ userId, status })
      const res = await api.adminAuditUser({ 
        user_id: userId,  // 改为 user_id
        status: status,
        remark: ''  // 添加 remark 字段
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        })
        // 刷新列表
        this.getPendingUsers()
      } else {
        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('审核失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 添加 switchTab 方法（如果需要切换标签页）
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    // 根据需要实现标签切换逻辑
    wx.switchTab({
      url: `/pages/admin/${tab}/${tab}`
    })
  }
})