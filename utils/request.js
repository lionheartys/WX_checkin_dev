// 封装请求方法
function request(options) {
    // 在方法内部获取 app
    const app = getApp()
    const fullUrl = app.globalData.baseUrl + options.url
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : '',
          ...options.header
        },
        success: (res) => {
          console.log('API请求成功:', options.url, res.data)
          
          if (res.statusCode === 200) {
            resolve(res.data)
          } else {
            wx.showToast({
              title: res.data.message || '请求失败',
              icon: 'none'
            })
            reject(res.data)
          }
        },
        fail: (err) => {
          console.error('API请求失败:', err)
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  }
  
  // API方法
  const api = {
    // 用户注册
    register(data) {
      return request({
        url: '/auth/register',
        method: 'POST',
        data
      })
    },
  
    // 用户登录  
    login(data) {
      return request({
        url: '/auth/login',
        method: 'POST', 
        data
      })
    },
  
    // 获取打卡配置
    getCheckinConfig(projectId = 1) {
      return request({
        url: '/checkin/config',
        method: 'GET',
        data: { projectId }
      })
    },
  
    // 打卡
    checkin(data) {
      return request({
        url: '/checkin/simple-clock',
        method: 'POST',
        data
      })
    },
  
    // 获取打卡记录
    getCheckinHistory(userId) {
      return request({
        url: `/checkin/records/${userId}`,
        method: 'GET'
      })
    },
  
    // 获取用户列表
    getUsers() {
      return request({
        url: '/checkin/users',
        method: 'GET'
      })
    }
  }
  
  module.exports = api