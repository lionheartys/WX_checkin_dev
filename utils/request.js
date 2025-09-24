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
  },

  // 获取补卡申请列表
  adminGetMakeupApplications: (status = 'pending') => {
    return request({
      url: '/admin/makeup-applications',
      method: 'GET',
      data: { status }
    })
  },
  
  // 审批补卡申请
  adminAuditMakeup: (data) => {
    return request({
      url: '/admin/audit-makeup',
      method: 'POST',
      data
    })
  },
  // 获取请假类型列表
getLeaveTypes: () => {
    return request({
      url: '/leave/types',
      method: 'GET'
    })
  },
  
  // 申请请假
  applyLeave: (data) => {
    return request({
      url: '/leave/apply',
      method: 'POST',
      data
    })
  },
  
  // 申请调休额度
  applyCompensatory: (data) => {
    return request({
      url: '/leave/compensatory/apply',
      method: 'POST',
      data
    })
  },
  
  // 获取请假记录
  getLeaveApplications: (userId) => {
    return request({
      url: `/leave/applications/${userId}`,
      method: 'GET'
    })
  },
  
  // 获取调休额度
  getCompensatoryQuota: (userId) => {
    return request({
      url: `/leave/compensatory/quota/${userId}`,
      method: 'GET'
    })
  },

  // 获取请假申请列表
adminGetLeaveApplications: (status = 'pending') => {
    return request({
      url: '/admin/leave-applications',
      method: 'GET',
      data: { status }
    })
  },
  
  // 审批请假申请
  adminAuditLeave: (data) => {
    return request({
      url: '/admin/audit-leave',
      method: 'POST',
      data
    })
  },

  // 获取打卡地列表
adminGetCheckinLocations: (status) => {
    return request({
      url: '/admin/checkin-locations',
      method: 'GET',
      data: status !== undefined ? { status } : {}
    })
  },
  
  // 添加打卡地
  adminAddCheckinLocation: (data) => {
    return request({
      url: '/admin/checkin-location',
      method: 'POST',
      data
    })
  },
  
  // 更新打卡地
  adminUpdateCheckinLocation: (id, data) => {
    return request({
      url: `/admin/checkin-location/${id}`,
      method: 'PUT',
      data
    })
  },
  
  // 更新打卡地状态
  adminUpdateLocationStatus: (id, status) => {
    return request({
      url: `/admin/checkin-location/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  },
  
  // 删除打卡地
  adminDeleteCheckinLocation: (id) => {
    return request({
      url: `/admin/checkin-location/${id}`,
      method: 'DELETE'
    })
  },
  
  // 获取项目列表
  adminGetProjects: () => {
    return request({
      url: '/admin/projects',
      method: 'GET'
    })
  },

  // 获取公司列表
  adminGetCompanies: (params = {}) => {
    return request({
      url: '/admin/companies',
      method: 'GET',
      data: params
    })
  },
  
  // 添加公司
  adminAddCompany: (data) => {
    return request({
      url: '/admin/company',
      method: 'POST',
      data
    })
  },
  
  // 更新公司信息
  adminUpdateCompany: (id, data) => {
    return request({
      url: `/admin/company/${id}`,
      method: 'PUT',
      data
    })
  },
  
  // 更新公司状态
  adminUpdateCompanyStatus: (id, status) => {
    return request({
      url: `/admin/company/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  },
  
  // 删除公司
  adminDeleteCompany: (id) => {
    return request({
      url: `/admin/company/${id}`,
      method: 'DELETE'
    })
  },
  
  // 获取单个公司详情
  adminGetCompanyDetail: (id) => {
    return request({
      url: `/admin/company/${id}`,
      method: 'GET'
    })
  },
  
  // 批量更新公司有效期
  adminBatchUpdateCompanyValidity: (data) => {
    return request({
      url: '/admin/companies/batch-update-validity',
      method: 'PUT',
      data
    })
  },

  // 获取项目管理列表（带分页）
adminGetProjectsManage: (params = {}) => {
    return request({
      url: '/admin/projects-manage',
      method: 'GET',
      data: params
    })
  },
  
  // 添加项目
  adminAddProject: (data) => {
    return request({
      url: '/admin/project',
      method: 'POST',
      data
    })
  },
  
  // 更新项目信息
  adminUpdateProject: (id, data) => {
    return request({
      url: `/admin/project/${id}`,
      method: 'PUT',
      data
    })
  },
  
  // 更新项目状态
  adminUpdateProjectStatus: (id, status) => {
    return request({
      url: `/admin/project/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  },
  
  // 删除项目
  adminDeleteProject: (id) => {
    return request({
      url: `/admin/project/${id}`,
      method: 'DELETE'
    })
  },
  
  // 获取单个项目详情
  adminGetProjectDetail: (id) => {
    return request({
      url: `/admin/project/${id}`,
      method: 'GET'
    })
  },
  
  // 获取可用的项目负责人列表
  adminGetAvailableManagers: () => {
    return request({
      url: '/admin/available-managers',
      method: 'GET'
    })
  },
  
  // 获取所有启用的公司列表（用于选择）
  adminGetCompaniesSelect: () => {
    return request({
      url: '/admin/companies-select',
      method: 'GET'
    })
  },

  // 获取项目入场申请列表
  adminGetEntryApplications: (params) => {
    return request({
      url: '/admin/entry-applications',
      method: 'GET',
      data: params
    })
  },
  
  // 审批项目入场申请
  adminApproveEntry: (id, data) => {
    return request({
      url: `/admin/entry-applications/${id}/approve`,
      method: 'POST',
      data
    })
  },
  
  // 获取项目入场申请统计
  adminGetEntryStatistics: () => {
    return request({
      url: '/admin/entry-applications/statistics',
      method: 'GET'
    })
  },

  //拉取项目列表
  getProjectList: () => {
    return request({
      url: '/project/get-project-list',
      method: 'POST'
    })
  },

  //拉取项目下所属的打卡地
  getProjectLocations: (projectId) => {
    return request({
      url: '/project/get-project-locations-list',
      method: 'POST',
      data: { project_id: projectId }
    })
  },

  //项目入/离场申请提交
  projectApplySubmit: (data) => {
    return request({
      url: '/project/project-apply',
      method: 'POST',
      data
    })
  }
}
// 导出api对象
module.exports = api