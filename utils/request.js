// utils/request.js
const baseURL = 'http://localhost:3000/api'

// 基础请求方法
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    
    wx.request({
      url: baseURL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        console.log('API请求成功:', options.url, res.data)
        
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          wx.clearStorageSync()
          wx.reLaunch({
            url: '/pages/login/login'
          })
          reject(new Error('认证失败'))
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          })
          reject(res.data)
        }
      },
      fail: (error) => {
        console.error('API请求失败:', error)
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
        reject(error)
      }
    })
  })
}

// 创建包含所有方法的对象
const api = {
  // 基础请求方法（某些页面可能直接调用）
  request: request,
  
  // ========== 认证相关 ==========
  // 用户登录
  login: (data) => {
    return request({
      url: '/auth/login',
      method: 'POST',
      data
    })
  },
  
  // 用户注册
  register: (data) => {
    return request({
      url: '/auth/register',
      method: 'POST',
      data
    })
  },
  
  // ========== 打卡功能（普通用户） ==========
  // 获取打卡配置
  getCheckinConfig: (projectId = 1) => {
    return request({
      url: '/checkin/config',
      method: 'GET',
      data: { projectId }
    })
  },
  
  // 打卡
  checkin: (data) => {
    return request({
      url: '/checkin/simple-clock',
      method: 'POST',
      data
    })
  },
  
  // 获取打卡记录
  getCheckinHistory: (userId) => {
    return request({
      url: `/checkin/records/${userId}`,
      method: 'GET'
    })
  },
  
  // 获取用户列表
  getUsers: () => {
    return request({
      url: '/checkin/users',
      method: 'GET'
    })
  },
  
  // 补卡申请
  applyMakeup: (data) => {
    return request({
      url: '/checkin/makeup',
      method: 'POST',
      data
    })
  },
  
  // 获取今日打卡记录
  getTodayRecords: (userId) => {
    return request({
      url: '/checkin/today',
      method: 'GET'
    })
  },
  
  // ========== 管理员功能 ==========
  // 获取统计数据
  adminGetStatistics: () => {
    return request({
      url: '/admin/statistics',
      method: 'GET'
    })
  },
  
  // 获取待审核用户
  adminGetPendingUsers: () => {
    return request({
      url: '/admin/pending-users',
      method: 'GET'
    })
  },
  
  // 获取所有用户
  adminGetUsers: () => {
    return request({
      url: '/admin/users',
      method: 'GET'
    })
  },
  
  // 审核用户
  adminAuditUser: (data) => {
    return request({
      url: '/admin/audit-user',
      method: 'POST',
      data
    })
  },
  
  // 获取打卡记录（管理员）
  adminGetCheckinRecords: (params) => {
    return request({
      url: '/admin/checkin-records',
      method: 'GET',
      data: params
    })
  },
  
  // 更新用户状态
  adminUpdateUserStatus: (userId, status) => {
    return request({
      url: `/admin/user/${userId}/status`,
      method: 'PUT',
      data: { status }
    })
  }
}

// 导出api对象
module.exports = api