// 全局应用实例
App({
    globalData: {
      userInfo: null,
      token: '',
      // baseUrl:'http://192.168.15.127:3000/api'  // 您的后端地址
    },
  
    onLaunch() {
      console.log('小程序启动')
      this.checkLogin()
    },
  
    // 检查登录状态
    checkLogin() {
      const token = wx.getStorageSync('token')
      const userInfo = wx.getStorageSync('userInfo')
      
      if (token && userInfo) {
        this.globalData.token = token
        this.globalData.userInfo = userInfo
      }
    },
  
    // 登录方法
    login() {
      return new Promise((resolve, reject) => {
        wx.login({
          success: (res) => {
            if (res.code) {
              console.log('获取code成功：', res.code)
              resolve(res.code)
            } else {
              reject('获取code失败')
            }
          },
          fail: reject
        })
      })
    },
  
    // 获取用户信息
    getUserInfo() {
      return new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        })
      })
    }
  })