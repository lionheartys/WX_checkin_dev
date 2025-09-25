// pages/manager/locationManagement/locationManagement.js
const api = require('../../../utils/request.js')

Page({
  data: {
    locations: [],
    projects: [],
    loading: false,
    showAddDialog: false,
    showEditDialog: false,
    currentLocation: null,
    
    // 表单数据
    formData: {
      project_id: 1,
      location_name: '',
      longitude: '',
      latitude: '',
      work_start_time: '09:00',
      work_end_time: '18:00',
      checkin_range: 200,
      abnormal_threshold: 30
    },
    
    // 选择器索引
    projectIndex: 0
  },

  async onLoad() {
    await this.loadProjects()
    await this.loadLocations()
  },

  async onShow() {
    await this.loadLocations()
  },

//   // 加载项目列表
//   async loadProjects() {
//     try {
//       console.log('开始加载项目列表...')
//       const res = await api.request({
//         url: '/manager/projects',
//         method: 'GET'
//       })
      
//       console.log('项目列表响应:', res)
      
//       if (res.code === 200 && res.data) {
//         this.setData({
//           projects: res.data,
//           'formData.project_id': res.data[0]?.id || 1
//         })
//         console.log('项目列表设置成功:', this.data.projects)
//       } else {
//         // 如果获取失败，使用默认项目
//         this.setData({
//           projects: [
//             { id: 1, project_name: '测试项目A' },
//             { id: 2, project_name: '示例项目B' }
//           ],
//           'formData.project_id': 1
//         })
//       }
//     } catch (error) {
//       console.error('加载项目列表失败:', error)
//       // 使用默认项目
//       this.setData({
//         projects: [
//           { id: 1, project_name: '测试项目A' },
//           { id: 2, project_name: '示例项目B' }
//         ],
//         'formData.project_id': 1
//       })
//     }
//   },
  async loadProjects() {
    try {
      console.log('开始加载项目列表...')
      const res = await api.request({
        url: '/manager/projects',
        method: 'GET'
      })
      
      console.log('项目列表响应:', res)
      
      if (res.code === 200 && res.data && Array.isArray(res.data.list)) {
        const projectsArray = res.data.list
        this.setData({
          projects: projectsArray,
          'formData.project_id': projectsArray[0]?.id || 1
        })
        console.log('项目列表设置成功:', this.data.projects)
      } else {
        // 使用默认项目
        this.setData({
          projects: [
            { id: 1, project_name: '默认1' },
            { id: 2, project_name: '默认2' }
          ],
          'formData.project_id': 1
        })
        console.log('使用默认项目数据')
      }
    } catch (error) {
      console.error('加载项目列表失败:', error)
      this.setData({
        projects: [
          { id: 1, project_name: '默认A' },
          { id: 2, project_name: '默认B' }
        ],
        'formData.project_id': 1
      })
    }
  },

  

  // 加载打卡地列表，传项目 ID
  async loadLocations() {
    this.setData({ loading: true });
    
    try {
      const projectId = this.data.formData.project_id;
      console.log('开始加载打卡地列表, projectId:', projectId);

      const res = await api.request({
        url: `/manager/project/${projectId}/checkin-locations`, // 修改路径
        method: 'GET'
      });

      if (res.code === 200 && res.data) {
        const locations = res.data.map(item => ({
          ...item,
          work_start_time: this.formatTime(item.work_start_time),
          work_end_time: this.formatTime(item.work_end_time),
          statusText: item.status === 1 ? '启用' : '禁用',
          project_name: item.project_name || `项目${item.project_id}`
        }));
        this.setData({ locations });
      } else {
        this.setData({ locations: [] });
      }
    } catch (error) {
      console.error('加载打卡地列表失败:', error);
      this.setData({ locations: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },


  // 显示添加对话框
  showAddLocation() {
    this.setData({
      showAddDialog: true,
      formData: {
        project_id: this.data.projects[0]?.id || 1,
        location_name: '',
        longitude: '',
        latitude: '',
        work_start_time: '09:00',
        work_end_time: '18:00',
        checkin_range: 200,
        abnormal_threshold: 30
      },
      projectIndex: 0
    })
  },

  // 隐藏添加对话框
  hideAddDialog() {
    this.setData({
      showAddDialog: false
    })
  },

  // 显示编辑对话框
  showEditLocation(e) {
    const index = e.currentTarget.dataset.index
    const location = this.data.locations[index]
    
    // 找到项目索引
    const projectIndex = this.data.projects.findIndex(p => p.id === location.project_id)
    
    this.setData({
      showEditDialog: true,
      currentLocation: location,
      formData: {
        project_id: location.project_id,
        location_name: location.location_name,
        longitude: location.longitude,
        latitude: location.latitude,
        work_start_time: location.work_start_time,
        work_end_time: location.work_end_time,
        checkin_range: location.checkin_range,
        abnormal_threshold: location.abnormal_threshold
      },
      projectIndex: projectIndex >= 0 ? projectIndex : 0
    })
  },

  // 隐藏编辑对话框
  hideEditDialog() {
    this.setData({
      showEditDialog: false,
      currentLocation: null
    })
  },

//   // 选择项目
//   onProjectChange(e) {
//     const index = e.detail.value
//     this.setData({
//       projectIndex: index,
//       'formData.project_id': this.data.projects[index].id
//     })
//   },
  onProjectChange(e) {
    const index = e.detail.value;
    if (this.data.projects && this.data.projects[index]) {
      const projectId = this.data.projects[index].id;
      this.setData({
        projectIndex: index,
        'formData.project_id': projectId
      });
      // 项目切换后重新加载打卡地
      this.loadLocations();
    } else {
      wx.showToast({ title: '项目数据错误', icon: 'none' });
    }
  },

  
  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 时间选择
  onTimeChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 获取当前位置
  getCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          'formData.longitude': res.longitude.toFixed(7),
          'formData.latitude': res.latitude.toFixed(7)
        })
        
        wx.showToast({
          title: '获取位置成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        })
      }
    })
  },

  // 提交添加
  async submitAdd() {
    if (!this.validateForm()) return;

    wx.showLoading({ title: '添加中...' });

    try {
      const projectId = this.data.formData.project_id;

      const res = await api.request({
        url: `/manager/project/${projectId}/checkin-location`, // 修改路径
        method: 'POST',
        data: this.data.formData
      });

      if (res.code === 200) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.hideAddDialog();
        await this.loadLocations();
      } else {
        wx.showToast({ title: res.message || '添加失败', icon: 'none' });
      }
    } catch (error) {
      console.error('添加失败:', error);
      wx.showToast({ title: '添加失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 提交编辑
  async submitEdit() {
    if (!this.validateForm()) return
    if (!this.data.currentLocation) return
    
    wx.showLoading({ title: '更新中...' })
    
    try {
      const res = await api.request({
        url: `/manager/checkin-location/${this.data.currentLocation.id}`,
        method: 'PUT',
        data: this.data.formData
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        
        this.hideEditDialog()
        await this.loadLocations()
      } else {
        wx.showToast({
          title: res.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 表单验证
  validateForm() {
    const { location_name, longitude, latitude } = this.data.formData
    
    if (!location_name.trim()) {
      wx.showToast({
        title: '请输入地点名称',
        icon: 'none'
      })
      return false
    }
    
    if (!longitude || !latitude) {
      wx.showToast({
        title: '请设置经纬度',
        icon: 'none'
      })
      return false
    }
    
    return true
  },

  // 切换状态
  async toggleStatus(e) {
    const index = e.currentTarget.dataset.index
    const location = this.data.locations[index]
    const newStatus = location.status === 1 ? 0 : 1
    const action = newStatus === 1 ? '启用' : '禁用'
    
    wx.showModal({
      title: '确认操作',
      content: `确定要${action}该打卡地吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doToggleStatus(location.id, newStatus)
        }
      }
    })
  },

  // 执行状态切换
  async doToggleStatus(id, status) {
    wx.showLoading({ title: '处理中...' })
    
    try {
      const res = await api.request({
        url: `/manager/checkin-location/${id}/status`,
        method: 'PUT',
        data: { status }
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        })
        
        await this.loadLocations()
      } else {
        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 删除打卡地
  deleteLocation(e) {
    const index = e.currentTarget.dataset.index
    const location = this.data.locations[index]
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除打卡地"${location.location_name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doDeleteLocation(location.id)
        }
      }
    })
  },

  // 执行删除
  async doDeleteLocation(id) {
    wx.showLoading({ title: '删除中...' })
    
    try {
      const res = await api.managerDeleteCheckinLocation(id)
      
      if (res.code === 200) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        await this.loadLocations()
      } else {
        wx.showToast({
          title: res.message || '删除失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('删除失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 查看地图
  viewMap(e) {
    const index = e.currentTarget.dataset.index
    const location = this.data.locations[index]
    
    wx.openLocation({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      scale: 15,
      name: location.location_name,
      address: `打卡范围：${location.checkin_range}米`
    })
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return ''
    // 如果是 HH:mm:ss 格式，去掉秒
    const parts = time.split(':')
    return `${parts[0]}:${parts[1]}`
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadLocations().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})