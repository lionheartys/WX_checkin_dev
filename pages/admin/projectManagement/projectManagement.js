// pages/admin/projectManagement/projectManagement.js
const api = require('../../../utils/request.js')

Page({
  data: {
    projects: [],
    page: 1,
    pageSize: 10,
    total: 0,
    keyword: '',
    selectedStatus: '',
    statusOptions: [
      { value: '', label: '全部' },
      { value: '1', label: '启用' },
      { value: '0', label: '禁用' }
    ],
    showAddDialog: false,
    showEditDialog: false,
    formData: {
      project_name: '',
      general_unit: '',
      manager_id: null,
      manager_name: '',
      status: 1
    },
    editingId: null,
    loading: false,
    companies: [],  // 公司列表
    managers: [],   // 负责人列表
    selectedCompanyIndex: -1,
    selectedManagerIndex: -1
  },

  onLoad() {
    this.getProjectList()
    this.getCompanies()
    this.getManagers()
  },

  onShow() {
    this.getProjectList()
  },

  // 获取项目列表
  async getProjectList() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const res = await api.adminGetProjectsManage({
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.selectedStatus,
        keyword: this.data.keyword
      })
      
      if (res.code === 200) {
        this.setData({
          projects: res.data.list,
          total: res.data.total
        })
      } else {
        wx.showToast({
          title: res.message || '获取失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取公司列表
  async getCompanies() {
    try {
      const res = await api.adminGetCompaniesSelect()
      if (res.code === 200) {
        this.setData({
          companies: res.data
        })
      }
    } catch (error) {
      console.error('获取公司列表失败:', error)
    }
  },

  // 获取负责人列表
  async getManagers() {
    try {
      const res = await api.adminGetAvailableManagers()
      if (res.code === 200) {
        this.setData({
          managers: res.data
        })
      }
    } catch (error) {
      console.error('获取负责人列表失败:', error)
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  // 执行搜索
  onSearch() {
    this.setData({
      page: 1
    }, () => {
      this.getProjectList()
    })
  },

  // 状态筛选
  onStatusChange(e) {
    this.setData({
      selectedStatus: e.detail.value,
      page: 1
    }, () => {
      this.getProjectList()
    })
  },

  // 显示添加对话框
  showAddProject() {
    this.setData({
      showAddDialog: true,
      formData: {
        project_name: '',
        general_unit: '',
        manager_id: null,
        manager_name: '',
        status: 1
      },
      selectedCompanyIndex: -1,
      selectedManagerIndex: -1
    })
  },

  // 显示编辑对话框
  showEditProject(e) {
    const project = e.currentTarget.dataset.project
    
    // 查找公司索引
    let companyIndex = -1
    if (project.general_unit) {
      companyIndex = this.data.companies.findIndex(c => c.company_name === project.general_unit)
    }
    
    // 查找负责人索引
    let managerIndex = -1
    if (project.manager_id) {
      managerIndex = this.data.managers.findIndex(m => m.id === project.manager_id)
    }
    
    this.setData({
      showEditDialog: true,
      editingId: project.id,
      formData: {
        project_name: project.project_name,
        general_unit: project.general_unit || '',
        manager_id: project.manager_id,
        manager_name: project.manager_name || '',
        status: project.status
      },
      selectedCompanyIndex: companyIndex,
      selectedManagerIndex: managerIndex
    })
  },

  // 关闭对话框
  closeDialog() {
    this.setData({
      showAddDialog: false,
      showEditDialog: false,
      formData: {
        project_name: '',
        general_unit: '',
        manager_id: null,
        manager_name: '',
        status: 1
      },
      editingId: null,
      selectedCompanyIndex: -1,
      selectedManagerIndex: -1
    })
  },

  // 表单输入
  onFormInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  // 选择公司
  onCompanyChange(e) {
    const index = e.detail.value
    const company = this.data.companies[index]
    this.setData({
      selectedCompanyIndex: index,
      'formData.general_unit': company.company_name
    })
  },

  // 选择负责人
  onManagerChange(e) {
    const index = e.detail.value
    const manager = this.data.managers[index]
    this.setData({
      selectedManagerIndex: index,
      'formData.manager_id': manager.id,
      'formData.manager_name': manager.username
    })
  },

  // 状态切换
  onStatusSwitch(e) {
    this.setData({
      'formData.status': e.detail.value ? 1 : 0
    })
  },

  // 提交添加
  async submitAdd() {
    const { project_name, general_unit } = this.data.formData
    
    if (!project_name) {
      wx.showToast({
        title: '请输入项目名称',
        icon: 'none'
      })
      return
    }
    
    if (!general_unit) {
      wx.showToast({
        title: '请选择总体单位',
        icon: 'none'
      })
      return
    }
    
    try {
      const res = await api.adminAddProject(this.data.formData)
      
      if (res.code === 200) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })
        this.closeDialog()
        this.getProjectList()
      } else {
        wx.showToast({
          title: res.message || '添加失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('添加项目失败:', error)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  // 提交编辑
  async submitEdit() {
    const { project_name, general_unit } = this.data.formData
    
    if (!project_name) {
      wx.showToast({
        title: '请输入项目名称',
        icon: 'none'
      })
      return
    }
    
    if (!general_unit) {
      wx.showToast({
        title: '请选择总体单位',
        icon: 'none'
      })
      return
    }
    
    try {
      const res = await api.adminUpdateProject(this.data.editingId, this.data.formData)
      
      if (res.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        this.closeDialog()
        this.getProjectList()
      } else {
        wx.showToast({
          title: res.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新项目失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  // 切换项目状态
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 1 ? 0 : 1
    const message = newStatus === 1 ? '确定要启用该项目吗？' : '确定要禁用该项目吗？'
    
    wx.showModal({
      title: '提示',
      content: message,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.adminUpdateProjectStatus(id, newStatus)
            
            if (result.code === 200) {
              wx.showToast({
                title: result.message,
                icon: 'success'
              })
              this.getProjectList()
            } else {
              wx.showToast({
                title: result.message || '操作失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('更新状态失败:', error)
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 删除项目
  deleteProject(e) {
    const { id, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '提示',
      content: `确定要删除项目"${name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.adminDeleteProject(id)
            
            if (result.code === 200) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              this.getProjectList()
            } else {
              wx.showToast({
                title: result.message || '删除失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('删除项目失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 翻页
  onPageChange(e) {
    const { type } = e.currentTarget.dataset
    let { page, pageSize, total } = this.data
    const totalPages = Math.ceil(total / pageSize)
    
    if (type === 'prev' && page > 1) {
      this.setData({
        page: page - 1
      }, () => {
        this.getProjectList()
      })
    } else if (type === 'next' && page < totalPages) {
      this.setData({
        page: page + 1
      }, () => {
        this.getProjectList()
      })
    }
  }
})