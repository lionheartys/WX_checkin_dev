// pages/admin/companyManagement/companyManagement.js
const api = require('../../../utils/request.js')

Page({
  data: {
    companies: [],
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
      company_name: '',
      valid_until: '',
      status: 1
    },
    editingId: null,
    loading: false,
    selectedCompanies: [],
    showBatchUpdateDialog: false,
    batchValidUntil: ''
  },

  onLoad() {
    this.getCompanyList()
  },

  onShow() {
    this.getCompanyList()
  },

  // 获取公司列表
  async getCompanyList() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const res = await api.adminGetCompanies({
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.selectedStatus,
        keyword: this.data.keyword
      })
      
      if (res.code === 200) {
        this.setData({
          companies: res.data.list,
          total: res.data.total
        })
      } else {
        wx.showToast({
          title: res.message || '获取失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('获取公司列表失败:', error)
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
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
      this.getCompanyList()
    })
  },

  // 状态筛选
  onStatusChange(e) {
    this.setData({
      selectedStatus: e.detail.value,
      page: 1
    }, () => {
      this.getCompanyList()
    })
  },

  // 显示添加对话框
  showAddCompany() {
    const today = new Date()
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    const defaultDate = `${nextYear.getFullYear()}-${String(nextYear.getMonth() + 1).padStart(2, '0')}-${String(nextYear.getDate()).padStart(2, '0')}`
    
    this.setData({
      showAddDialog: true,
      formData: {
        company_name: '',
        valid_until: defaultDate,
        status: 1
      }
    })
  },

  // 显示编辑对话框
  showEditCompany(e) {
    const company = e.currentTarget.dataset.company
    this.setData({
      showEditDialog: true,
      editingId: company.id,
      formData: {
        company_name: company.company_name,
        valid_until: company.valid_until.split('T')[0],
        status: company.status
      }
    })
  },

  // 关闭对话框
  closeDialog() {
    this.setData({
      showAddDialog: false,
      showEditDialog: false,
      showBatchUpdateDialog: false,
      formData: {
        company_name: '',
        valid_until: '',
        status: 1
      },
      editingId: null,
      batchValidUntil: ''
    })
  },

  // 表单输入
  onFormInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'formData.valid_until': e.detail.value
    })
  },

  // 批量更新日期选择
  onBatchDateChange(e) {
    this.setData({
      batchValidUntil: e.detail.value
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
    const { company_name, valid_until } = this.data.formData
    
    if (!company_name) {
      wx.showToast({
        title: '请输入公司名称',
        icon: 'none'
      })
      return
    }
    
    if (!valid_until) {
      wx.showToast({
        title: '请选择有效期',
        icon: 'none'
      })
      return
    }
    
    try {
      const res = await api.adminAddCompany(this.data.formData)
      
      if (res.code === 200) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })
        this.closeDialog()
        this.getCompanyList()
      } else {
        wx.showToast({
          title: res.message || '添加失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('添加公司失败:', error)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  // 提交编辑
  async submitEdit() {
    const { company_name, valid_until } = this.data.formData
    
    if (!company_name) {
      wx.showToast({
        title: '请输入公司名称',
        icon: 'none'
      })
      return
    }
    
    if (!valid_until) {
      wx.showToast({
        title: '请选择有效期',
        icon: 'none'
      })
      return
    }
    
    try {
      const res = await api.adminUpdateCompany(this.data.editingId, this.data.formData)
      
      if (res.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        this.closeDialog()
        this.getCompanyList()
      } else {
        wx.showToast({
          title: res.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('更新公司失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  // 切换公司状态
  async toggleStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const newStatus = status === 1 ? 0 : 1
    const message = newStatus === 1 ? '确定要启用该公司吗？' : '确定要禁用该公司吗？'
    
    wx.showModal({
      title: '提示',
      content: message,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.adminUpdateCompanyStatus(id, newStatus)
            
            if (result.code === 200) {
              wx.showToast({
                title: result.message,
                icon: 'success'
              })
              this.getCompanyList()
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

  // 删除公司
  deleteCompany(e) {
    const { id, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '提示',
      content: `确定要删除"${name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await api.adminDeleteCompany(id)
            
            if (result.code === 200) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              this.getCompanyList()
            } else {
              wx.showToast({
                title: result.message || '删除失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('删除公司失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 选择公司
  onSelectCompany(e) {
    const { id } = e.currentTarget.dataset
    const { selectedCompanies } = this.data
    const index = selectedCompanies.indexOf(id)
    
    if (index > -1) {
      selectedCompanies.splice(index, 1)
    } else {
      selectedCompanies.push(id)
    }
    
    this.setData({ selectedCompanies })
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { companies, selectedCompanies } = this.data
    
    if (selectedCompanies.length === companies.length) {
      this.setData({ selectedCompanies: [] })
    } else {
      this.setData({ 
        selectedCompanies: companies.map(c => c.id)
      })
    }
  },

  // 显示批量更新对话框
  showBatchUpdate() {
    if (this.data.selectedCompanies.length === 0) {
      wx.showToast({
        title: '请先选择公司',
        icon: 'none'
      })
      return
    }
    
    const today = new Date()
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    const defaultDate = `${nextYear.getFullYear()}-${String(nextYear.getMonth() + 1).padStart(2, '0')}-${String(nextYear.getDate()).padStart(2, '0')}`
    
    this.setData({
      showBatchUpdateDialog: true,
      batchValidUntil: defaultDate
    })
  },

  // 批量更新有效期
  async submitBatchUpdate() {
    if (!this.data.batchValidUntil) {
      wx.showToast({
        title: '请选择有效期',
        icon: 'none'
      })
      return
    }
    
    try {
      const res = await api.adminBatchUpdateCompanyValidity({
        company_ids: this.data.selectedCompanies,
        valid_until: this.data.batchValidUntil
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: '批量更新成功',
          icon: 'success'
        })
        this.setData({
          selectedCompanies: []
        })
        this.closeDialog()
        this.getCompanyList()
      } else {
        wx.showToast({
          title: res.message || '更新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('批量更新失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
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
        this.getCompanyList()
      })
    } else if (type === 'next' && page < totalPages) {
      this.setData({
        page: page + 1
      }, () => {
        this.getCompanyList()
      })
    }
  },

  // 格式化日期显示
  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
})