// 引入模块
const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    userLocation: null,
    checkinLocation: null,
    maxDistance: 100,
    distance: 0,
    canCheckin: false,
    loading: false,
    statusText: '加载中...',
    currentTime: '',
    currentDate: '',
    currentAddress: '获取位置中...',
    todayRecords: [],
    todaySummary: {
      checkedIn: false,
      checkedOut: false,
      checkinTime: '',
      checkoutTime: ''
    },
    // 新增数据
    workStartTime: '09:00:00',  // 上班时间
    workEndTime: '18:00:00',    // 下班时间
    abnormalThreshold: 30,       // 异常阈值（分钟）
    checkinReasonRequired: false, // 是否需要输入原因
    checkinReason: '',          // 打卡原因
    showMakeupDialog: false,     // 显示补卡对话框
    makeupDate: '',             // 补卡日期
    makeupType: 'in',           // 补卡类型
    makeupReason: '',            // 补卡原因

    userId: null,  // 用户ID
    //projects: [],  // 项目列表（包含项目名称和ID）
    selectedProject: '',  // 当前选择的项目名称
    selectedProjectId: '',  // 当前选择的项目ID
    selectedLocation: '',  // 当前选择的打卡地点名称
    selectedLocationId: '',  // 当前选择的打卡地点ID
    selectedProjectLocations: [],  // 当前选择项目的打卡地点列表（包含名称和ID）
    selectedLocationOptions: [],  // 打卡地点选项（包含名称和ID）

  },

  async onLoad() {
    this.initPage()
    await this.getUserInfo();  // 获取用户信息
    await this.loadProjects();  // 加载可选项目
    await this.loadLocationOptions(); // 加载打卡地
    //this.loadCheckinConfig();  // 加载打卡配置
    //this.getLocation();
    this.loadTodayRecords()
    this.loadTodaySummary()
    this.startTimeUpdate()
  },

  onShow() {
    this.loadTodaySummary()
    this.loadTodayRecords()
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
    }
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
  },

  initPage() {
    this.updateTime()
  },

  startTimeUpdate() {
    this.timer = setInterval(() => {
      this.updateTime()
    }, 1000)
  },

  updateTime() {
    const now = new Date()
    const time = now.toTimeString().split(' ')[0]
    const date = now.toLocaleDateString('zh-CN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    this.setData({
      currentTime: time,
      currentDate: date
    })
  },

  async getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo, userId: userInfo.id });
      console.log('用户信息已加载', this.data.userId)
    }
  },
  //从后端获取可选项目列表
  async loadProjects() {
    const { userId } = this.data;
    console.log('用户信息已加载', userId)
    if (!userId) return;

    try {
      const res = await api.userProjectAvailableList({ userId: userId });  // 调用后端接口获取项目
      console.log('后端状态码为', res.code)
      if (res.code === 200) {
        // 设置项目列表，仅展示项目名称，保存项目ID
        console.log('后端回复为：', res.data)
        const projects = res.data.map(project => ({
          name: project.project_name,
          id: project.id
        }));
        console.log('项目信息为', projects)
        this.setData({
          projects,
          projectNames: projects.map(project => project.name) 
        })
      } 

      else if (res.code === 404) {
        wx.showToast({
          title: '当前用户无有效项目',
          icon: 'none'
        });
      }

      else {
        wx.showToast({
          title: '加载项目失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载项目失败:', error);
      wx.showToast({
        title: '加载项目失败',
        icon: 'none'
      });
    }
  },

    // 选择项目
  onProjectChange(e) {
    const selectedProject = this.data.projects[e.detail.value];
    this.setData({
      selectedProject: selectedProject.name,  // 显示项目名称
      selectedProjectId: selectedProject.id,  // 保存项目ID
      selectedLocation: '',  // 清空选中的打卡地点
      selectedLocationId: '',  // 清空打卡地点ID
      selectedProjectLocations: selectedProject.locations || []  // 获取该项目下的打卡地点
    }, this.loadLocationOptions);
  },

    // 加载打卡地点
  async loadLocationOptions() {
    const { selectedProjectId } = this.data;

    if (!selectedProjectId) return;

    try {
      const res = await api.getProjectCheckinLocations({ projectId: selectedProjectId });  // 获取打卡地点
      if (res.code === 200) {
        console.log('打卡地信息为', res.data)
        // 设置打卡地点选项，仅展示打卡地点名称，保存打卡地点ID
        const locations = res.data.map(location => ({
          name: location.location_name,
          id: location.id
        }));
        this.setData({
          selectedLocationOptions: locations,  // 设置打卡地点选项
          selectedLocationNames: locations.map(location => location.name)
        });
      }
    } catch (error) {
      console.error('加载打卡地点失败:', error);
      wx.showToast({
        title: '加载打卡地点失败',
        icon: 'none'
      });
    }
  },

  // 选择打卡地点
  onLocationChange(e) {
    const selectedLocation = this.data.selectedLocationOptions[e.detail.value];
    this.setData({
      selectedLocation: selectedLocation.name,  // 显示打卡地点名称
      selectedLocationId: selectedLocation.id,  // 保存打卡地点ID
      checkinLocation: selectedLocation  // 更新选中的打卡地点
    });
    
    this.loadCheckinConfig(selectedLocation.id)
  },

  // 从后端获取打卡配置
  async loadCheckinConfig(locationId) {
    wx.showLoading({
      title: '加载配置...'
    })
    
    console.log('用户选择的打卡地ID', locationId)
    try {
      const res = await api.getCheckinConfig({ locationId: locationId })  // 保持原有的API调用
      console.log('后端已返回打卡地配置', res.data)
      wx.hideLoading()
      
      if (res.code === 200 && res.data) {
        // 从后端获取配置成功，使用后端的配置数据
        console.log('后端已返回打卡地配置', res.data)
        this.setData({
          checkinLocation: {
            latitude: res.data.latitude,
            longitude: res.data.longitude,
            address: res.data.location_name || '公司',
          },
          maxDistance: res.data.checkin_range || 100,
          // 新增的时间配置也从后端获取
          workStartTime: res.data.work_start_time || '09:00:00',
          workEndTime: res.data.work_end_time || '18:00:00',
          abnormalThreshold: res.data.abnormal_threshold || 30
        })
        console.log('打卡配置加载成功:', this.data.checkinLocation)

        this.getLocation()
      }
      else if (res.code === 404) {
        wx.showToast({
          title: '当前项目下无可用打卡地',
          icon: 'none'
        });
      }
      else {
        wx.showToast({
          title: res.message || '获取打卡配置失败',
          icon: 'none'
        })
        // 只有在获取失败时才使用默认配置
        this.setDefaultConfig()
      }
    } catch (error) {
      wx.hideLoading()
      console.error('加载打卡配置失败:', error)
      wx.showToast({
        title: '网络错误，使用默认配置',
        icon: 'none'
      })
      // 网络错误时使用默认配置
      this.setDefaultConfig()
    }
  },
  
  // 设置默认配置（仅作为后备方案）
  setDefaultConfig() {
    // 不应该硬编码具体位置，而是提示用户配置未加载
    this.setData({
      checkinLocation: null,  // 不设置默认位置
      maxDistance: 100,
      workStartTime: '09:00:00',
      workEndTime: '18:00:00',
      abnormalThreshold: 30,
      statusText: '配置加载失败，请刷新重试'
    })
    
    提示用户重新加载配置
    wx.showModal({
      title: '提示',
      content: '打卡配置加载失败，是否重新加载？',
      success: (res) => {
        if (res.confirm) {
          this.loadCheckinConfig()  // 重新尝试加载
        }
      }
    })
  },
  
  // 获取位置信息（保持原有逻辑）
  getLocation() {
    // 确保有打卡配置才继续
    if (!this.data.checkinLocation) {
      console.log('打卡配置未加载，等待配置...')
      this.setData({
        statusText: '等待配置加载...',
        canCheckin: false
      })
      // 延迟重试
      setTimeout(() => {
        if (this.data.checkinLocation) {
          this.getLocation()
        }
      }, 1000)
      return
    }
    
    wx.showLoading({
      title: '获取位置中...'
    })
  
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取位置成功:', res)
        this.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
        
        // 计算用户位置与后端配置位置的距离
        this.calculateDistance()
        
        // 获取地址信息
        this.getAddressInfo(res.latitude, res.longitude)
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        wx.hideLoading()
        
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置权限',
            content: '需要位置权限才能进行打卡，请在设置中开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({
            title: '获取位置失败',
            icon: 'none'
          })
        }
        
        this.setData({
          statusText: '位置获取失败',
          canCheckin: false
        })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },
  
  // 计算距离（保持原有逻辑）
  calculateDistance() {
    const { userLocation, checkinLocation } = this.data
    
    console.log('用户位置:', userLocation)
    console.log('打卡位置（来自后端）:', checkinLocation)
    console.log('最大允许距离:', this.data.maxDistance)
    
    if (!userLocation || !checkinLocation) {
      this.setData({
        statusText: '无法计算距离',
        canCheckin: false
      })
      return
    }
    
    // 使用原有的距离计算方法
    const distance = util.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      checkinLocation.latitude,  // 后端配置的纬度
      checkinLocation.longitude  // 后端配置的经度
    )
    
    console.log('计算出的距离:', distance, '米')
    
    const canCheckin = distance <= this.data.maxDistance
    let statusText = '准备打卡'
    
    if (!canCheckin) {
      statusText = `距离过远 (${Math.round(distance)}米)`
    }
    
    this.setData({
      distance: Math.round(distance),
      canCheckin,
      statusText
    })
  },
  
  getAddressInfo(latitude, longitude) {
    this.setData({
      currentAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    })
  },

  // 检查是否需要输入原因（迟到或早退）
  checkTimeAbnormal(type) {
    const now = new Date()
    const currentTime = now.toTimeString().split(' ')[0]
    
    if (type === 'in') {
      // 检查是否迟到
      const workStart = this.data.workStartTime
      const lateTime = this.addMinutesToTime(workStart, this.data.abnormalThreshold)
      
      if (currentTime > lateTime) {
        return {
          isAbnormal: true,
          message: `您已迟到，请输入迟到原因`
        }
      }
    } else {
      // 检查是否早退
      const workEnd = this.data.workEndTime
      const earlyTime = this.subtractMinutesFromTime(workEnd, this.data.abnormalThreshold)
      
      if (currentTime < earlyTime) {
        return {
          isAbnormal: true,
          message: `您将早退，请输入早退原因`
        }
      }
    }
    
    return { isAbnormal: false }
  },

  // 时间计算辅助函数
  addMinutesToTime(time, minutes) {
    const [h, m, s] = time.split(':').map(Number)
    const date = new Date()
    date.setHours(h, m + minutes, s)
    return date.toTimeString().split(' ')[0]
  },

  subtractMinutesFromTime(time, minutes) {
    const [h, m, s] = time.split(':').map(Number)
    const date = new Date()
    date.setHours(h, m - minutes, s)
    return date.toTimeString().split(' ')[0]
  },

  // 上班打卡
  async doCheckinIn() {
    if (!this.data.canCheckin || this.data.loading) {
      if (!this.data.canCheckin) {
        wx.showToast({
          title: `距离过远，无法打卡 (${this.data.distance}米)`,
          icon: 'none'
        })
      }
      return
    }

    // 检查是否已经上班打卡
    if (this.data.todaySummary.checkedIn) {
      wx.showToast({
        title: '今日已上班打卡',
        icon: 'none'
      })
      return
    }

    // 检查是否迟到
    const timeCheck = this.checkTimeAbnormal('in')
    if (timeCheck.isAbnormal) {
      wx.showModal({
        title: '打卡提醒',
        content: timeCheck.message,
        editable: true,
        placeholderText: '请输入原因',
        success: async (res) => {
          if (res.confirm) {
            const reason = res.content || '个人原因'
            await this.executeCheckin('in', reason)
          }
        }
      })
    } else {
      await this.executeCheckin('in')
    }
  },

  // 下班打卡
  async doCheckinOut() {
    if (!this.data.canCheckin || this.data.loading) {
      if (!this.data.canCheckin) {
        wx.showToast({
          title: `距离过远，无法打卡 (${this.data.distance}米)`,
          icon: 'none'
        })
      }
      return
    }

    // 检查是否已经下班打卡
    if (this.data.todaySummary.checkedOut) {
      wx.showToast({
        title: '今日已下班打卡',
        icon: 'none'
      })
      return
    }

    // 检查是否未上班就下班
    if (!this.data.todaySummary.checkedIn) {
      wx.showModal({
        title: '提醒',
        content: '您还未上班打卡，是否继续下班打卡？',
        success: async (res) => {
          if (res.confirm) {
            const timeCheck = this.checkTimeAbnormal('out')
            if (timeCheck.isAbnormal) {
              wx.showModal({
                title: '打卡提醒',
                content: timeCheck.message,
                editable: true,
                placeholderText: '请输入原因',
                success: async (res2) => {
                  if (res2.confirm) {
                    const reason = res2.content || '个人原因'
                    await this.executeCheckin('out', reason)
                  }
                }
              })
            } else {
              await this.executeCheckin('out')
            }
          }
        }
      })
      return
    }

    // 检查是否早退
    const timeCheck = this.checkTimeAbnormal('out')
    if (timeCheck.isAbnormal) {
      wx.showModal({
        title: '打卡提醒',
        content: timeCheck.message,
        editable: true,
        placeholderText: '请输入原因',
        success: async (res) => {
          if (res.confirm) {
            const reason = res.content || '个人原因'
            await this.executeCheckin('out', reason)
          }
        }
      })
    } else {
      await this.executeCheckin('out')
    }
  },

// 执行打卡
async executeCheckin(type, remark = '') {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }
  
    this.setData({ loading: true })
    
    wx.showLoading({
      title: '打卡中...'
    })
    
    try {
      const checkinData = {
        user_id: userInfo.id,
        type: type,
        longitude: this.data.userLocation.longitude,
        latitude: this.data.userLocation.latitude,
        remark: remark  // 传递备注信息
      }
      
      const res = await api.checkin(checkinData)
      
      wx.hideLoading()
      
      if (res.code === 200) {
        // 根据返回的状态显示不同的提示
        let title = `${type === 'in' ? '上班' : '下班'}打卡成功`
        let icon = 'success'
        
        // 检查是否有异常状态
        if (res.data && res.data.status) {
          if (res.data.status === 'late') {
            title = '打卡成功（迟到）'
            icon = 'none'
            
            // 显示迟到详情
            if (res.data.abnormalReason) {
              setTimeout(() => {
                wx.showModal({
                  title: '打卡状态',
                  content: res.data.abnormalReason,
                  showCancel: false,
                  confirmText: '知道了'
                })
              }, 1500)
            }
          } else if (res.data.status === 'early') {
            title = '打卡成功（早退）'
            icon = 'none'
            
            // 显示早退详情
            if (res.data.abnormalReason) {
              setTimeout(() => {
                wx.showModal({
                  title: '打卡状态',
                  content: res.data.abnormalReason,
                  showCancel: false,
                  confirmText: '知道了'
                })
              }, 1500)
            }
          }
        }
        
        wx.showToast({
          title: title,
          icon: icon,
          duration: 2000
        })
        
        // 刷新今日记录和汇总
        setTimeout(() => {
          this.loadTodaySummary()
          this.loadTodayRecords()
        }, 1000)
      } else {
        wx.showToast({
          title: res.message || '打卡失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('打卡失败:', error)
      wx.showToast({
        title: '打卡失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 显示补卡对话框
  showMakeupApplication() {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    
    this.setData({
      showMakeupDialog: true,
      makeupDate: dateStr
    })
  },

  // 隐藏补卡对话框
  hideMakeupDialog() {
    this.setData({
      showMakeupDialog: false,
      makeupDate: '',
      makeupType: 'in',
      makeupReason: ''
    })
  },

  // 更新补卡日期
  onMakeupDateChange(e) {
    this.setData({
      makeupDate: e.detail.value
    })
  },

  // 更新补卡类型
  onMakeupTypeChange(e) {
    this.setData({
      makeupType: e.detail.value
    })
  },

  // 更新补卡原因
  onMakeupReasonInput(e) {
    this.setData({
      makeupReason: e.detail.value
    })
  },

  // 提交补卡申请
  async submitMakeup() {
    const { makeupDate, makeupType, makeupReason } = this.data
    
    if (!makeupReason) {
      wx.showToast({
        title: '请输入补卡原因',
        icon: 'none'
      })
      return
    }

    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '提交中...'
    })

    try {
      const res = await api.applyMakeup({
        user_id: userInfo.id,
        location_id: 1, // 默认位置ID
        makeup_date: makeupDate,
        makeup_type: makeupType,
        reason: makeupReason
      })

      wx.hideLoading()

      if (res.code === 200) {
        wx.showToast({
          title: '补卡申请已提交',
          icon: 'success'
        })
        this.hideMakeupDialog()
      } else {
        wx.showToast({
          title: res.message || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('补卡申请失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  async loadTodayRecords() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) return
    
    try {
      const res = await api.getCheckinHistory(userInfo.id)
      
      if (res.code === 200) {
        this.setData({
          todayRecords: res.data || []
        })
      }
    } catch (error) {
      console.error('加载记录失败:', error)
    }
  },

  async loadTodaySummary() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo) return
    
    try {
      const todayRecords = this.data.todayRecords
      const today = new Date().toDateString()
      
      const todayCheckins = todayRecords.filter(record => {
        return new Date(record.checkin_time).toDateString() === today
      })
      
      const checkedIn = todayCheckins.some(r => r.checkin_type === 'in')
      const checkedOut = todayCheckins.some(r => r.checkin_type === 'out')
      
      const checkinRecord = todayCheckins.find(r => r.checkin_type === 'in')
      const checkoutRecord = todayCheckins.find(r => r.checkin_type === 'out')
      
      this.setData({
        todaySummary: {
          checkedIn,
          checkedOut,
          checkinTime: checkinRecord ? new Date(checkinRecord.checkin_time).toTimeString().split(' ')[0] : '',
          checkoutTime: checkoutRecord ? new Date(checkoutRecord.checkin_time).toTimeString().split(' ')[0] : ''
        }
      })
    } catch (error) {
      console.error('加载今日汇总失败:', error)
    }
  },

  refreshLocation() {
    this.getLocation()
  },

  async refreshConfig() {
    await this.loadCheckinConfig()
    this.getLocation()
  },

  viewHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  }
})