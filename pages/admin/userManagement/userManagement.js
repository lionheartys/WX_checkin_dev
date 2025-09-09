const api = require('../../../utils/request.js')

Page({
  data: {
    userList: [],
    allUsers: [],
    searchKey: '',
    statusMap: {
      pending: '待审核',
      approved: '正常',
      disabled: '已禁用',
      rejected: '已拒绝'
    }
  },

  onLoad() {
    this.loadUsers()
  },

  onSearchInput(e) {
    this.setData({ searchKey: e.detail.value })
  },

  onSearch() {
    const { searchKey, allUsers } = this.data
    if (!searchKey.trim()) {
      this.setData({ userList: allUsers })
      return
    }

    const filtered = allUsers.filter(user => 
      user.username.includes(searchKey) || 
      user.phone.includes(searchKey)
    )
    
    this.setData({ userList: filtered })
  },

  async loadUsers() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await api.adminGetUsers()
      if (res.code === 200) {
        const users = res.data || []
        this.setData({
          userList: users,
          allUsers: users
        })
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async disableUser(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认',
      content: '确定要禁用该用户吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.updateUserStatus(userId, 'disabled')
        }
      }
    })
  },

  async enableUser(e) {
    const userId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认',
      content: '确定要启用该用户吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.updateUserStatus(userId, 'approved')
        }
      }
    })
  },

  async updateUserStatus(userId, status) {
    wx.showLoading({ title: '处理中...' })
    try {
      const res = await api.adminUpdateUserStatus(userId, status)
      if (res.code === 200) {
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        })
        this.loadUsers()
      } else {
        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新用户状态失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  viewDetail(e) {
    const userId = e.currentTarget.dataset.id
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})