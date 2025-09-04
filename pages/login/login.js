const api = require('../../utils/request.js')

Page({
  data: {
    username: '',
    phone: '',
    loading: false
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }
  },

  // 输入用户名
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    })
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    })
  },

  // 登录
  async login() {
    const { username, phone } = this.data
    
    if (!username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.login({ username })
      
      if (res.code === 200) {
        // 保存用户信息
        wx.setStorageSync('token', res.data.token)
        wx.setStorageSync('userInfo', res.data.user)
        
        // 更新全局数据
        const app = getApp()
        app.globalData.token = res.data.token
        app.globalData.userInfo = res.data.user
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
        
        // 跳转到首页
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }, 1000)
      }
    } catch (error) {
      console.error('登录失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 注册
  async register() {
    const { username, phone } = this.data
    
    if (!username.trim() || !phone.trim()) {
      wx.showToast({
        title: '请输入用户名和手机号',
        icon: 'none'
      })
      return
    }

    // 手机号简单验证
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }

    try {
      const res = await api.register({
        username,
        phone,
        company_id: 1,
        openid: `test_${Date.now()}`
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        })
        
        // 注册成功后自动登录
        setTimeout(() => {
          this.login()
        }, 1000)
      }
    } catch (error) {
      console.error('注册失败:', error)
    }
  }
})
