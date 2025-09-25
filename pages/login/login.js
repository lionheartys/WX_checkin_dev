const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    username: '',
    phone: '',
    password: '',
    confirmPassword: '',
    loading: false,
    isRegister: false,  // false=登录模式, true=注册模式

    companyList: [],      // [{id, name}]
    companyNameList: [], 
    companyIndex: 0  ,
    roles: ['职工', '项目管理员'],
    roleIndex: 0,
    deviceId: ''
  },

  async onLoad() {
    const deviceId = this.ensureDeviceId()
    this.setData({ deviceId })

    await this.fetchCompanies()

    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      // 根据角色跳转到不同页面
      this.navigateByRole(userInfo.role)
    }
  },

  // 生成唯一设备ID
  ensureDeviceId() {
    let id = wx.getStorageSync('device_id')
    if (!id) {
      id = this.genUUIDv4()
      wx.setStorageSync('device_id', id)
    }
    return id
  },

  genUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },

  //复制函数
  copyDeviceId() {
    const { deviceId } = this.data;
    if (!deviceId) return;
    wx.setClipboardData({
      data: deviceId,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  async fetchCompanies() {
    try {
      const res = await util.getCompanies()
      if (res.code === 200 && Array.isArray(res.data)) {
        const companyList = res.data
        const companyNameList = companyList.map(c => c.name)
        this.setData({ companyList, companyNameList, companyIndex: 0 })
      } else {
        wx.showToast({ title: '公司列表获取失败', icon: 'none' })
      }
    } catch (e) {
      console.error('fetchCompanies error', e)
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },

  onCompanyChange(e) {
    this.setData({ companyIndex: Number(e.detail.value) || 0 })
  },

  // 添加新方法：根据角色导航到不同页面
  navigateByRole(role) {
    if (role === 'admin') {
      wx.reLaunch({
        url: '/pages/admin/dashboard/dashboard'
      })
    }else if (role === 'project_manager') {
      wx.reLaunch({
        url: '/pages/manager/dashboard/dashboard'
      })
    } else {
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

  // 输入密码
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    })
  },

  onCompanyInput(e){
    this.setData({
      companyId: e.detail.value
    })
  },

  // 切换登录/注册模式
  toggleMode() {
    this.setData({
      isRegister: !this.data.isRegister,
      username: '',
      phone: '',
      password: '',
      confirmPassword: ''
    })
  },

  // 登录 - 修改这个方法
  async login() {
    const { username, password } = this.data
    
    if (!username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return
    }

    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.login({ 
        username,
        password 
      })
      
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
        
        // 修改：根据角色跳转到不同页面
        setTimeout(() => {
          this.navigateByRole(res.data.user.role)
        }, 1000)
      } else {
        wx.showToast({
          title: res.message || '登录失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 注册 - 保持不变
  async register() {
    const { username, phone, password, confirmPassword, roles, roleIndex, deviceId, companyList, companyIndex} = this.data
    
    if (!username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return
    }

    if (!phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return
    }

    // 手机号验证
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }

    if (!password || password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none'
      })
      return
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'none'
      })
      return
    }

    if (!companyList.length) return wx.showToast({ title: '请先选择公司', icon: 'none' })

    const company = companyList[companyIndex]
    if (!company || !company.id) return wx.showToast({ title: '公司选择无效', icon: 'none' })

    this.setData({ loading: true })

    try {
        const { code } = await new Promise((resolve, reject) => {
          wx.login({ success: resolve, fail: reject })
        });

        if (!code) throw new Error('wx.login 未返回 code')

        const roleLabel = roles[roleIndex] || '职工'
        const roleMap = { '职工': 'staff', '项目管理员': 'project_manager' }
        const role = roleMap[roleLabel] || 'staff'

        const res = await api.register({
          username,
          phone,
          password,
          confirmPassword,
          company_id: Number(company.id),
          role,
          deviceId: deviceId,
          code
        })
        
        if (res.code === 200) {
          wx.showToast({
            title: '注册成功，请等待审核', // 改进提示
            icon: 'success',
            duration: 2000
          })
          
          // 注册成功后切换到登录模式
          setTimeout(() => {
            this.setData({
              isRegister: false,
              password: '',
              confirmPassword: ''
            })
          }, 2000)
        } else {
          wx.showToast({
            title: res.message || '注册失败',
            icon: 'none'
          })
        }
      } catch (error) {
        console.error('注册失败:', error)
        wx.showToast({
          title: '注册失败',
          icon: 'none'
        })
      } finally {
        this.setData({ loading: false })
      }
    }
})