# 微信打卡小程序后端 (WeChat Check-in Backend)

一个功能完整的企业考勤管理系统后端，支持微信小程序前端，提供打卡、请假、审批、统计等全套考勤管理功能。

## 📋 目录

- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [API文档](#api文档)
- [数据库设计](#数据库设计)
- [测试指南](#测试指南)
- [部署说明](#部署说明)
- [故障排查](#故障排查)

## 功能特性

### 核心功能
- **👤 用户管理**：用户注册、登录、角色权限控制（管理员/项目负责人/普通员工）
- **🏢 公司管理**：公司信息维护、有效期控制
- **📁 项目管理**：项目创建、负责人分配、项目转移
- **📍 打卡地管理**：设置打卡地点、时间、范围
- **✅ 打卡功能**：上下班打卡、位置验证、设备验证、异常检测
- **📝 请假管理**：请假申请、调休管理、审批流程
- **📊 考勤统计**：个人/团队考勤报表、数据导出
- **🔄 补卡申诉**：补卡申请、考勤异常申诉

### 业务特点
- 支持多公司、多项目、多打卡地点
- 基于地理位置的打卡范围验证
- 灵活的审批流程
- 完整的异常处理机制
- 调休额度自动计算

## 系统架构
┌─────────────────────────────────────────┐
│         微信小程序前端                    │
└────────────────┬────────────────────────┘
│ HTTPS/JSON
▼
┌─────────────────────────────────────────┐
│           Node.js 后端                   │
│  ┌─────────────────────────────────┐    │
│  │        Express 框架              │    │
│  ├─────────────────────────────────┤    │
│  │   Routes → Controllers → Models  │    │
│  └─────────────────────────────────┘    │
└────────────┬───────────────────────────┘
│
▼
┌─────────────────────────────────────────┐
│           MySQL 数据库                   │
└─────────────────────────────────────────┘

### 项目结构
wechat-checkin-backend/
├── app.js                  # 应用入口
├── package.json            # 项目配置
├── .env                    # 环境变量
├── config/                 # 配置文件
│   └── database.js        # 数据库配置
├── controllers/            # 控制器（业务逻辑）
│   ├── authController.js
│   ├── checkinController.js
│   └── ...
├── routes/                 # 路由定义
│   ├── auth.js
│   ├── checkin.js
│   └── ...
├── middleware/             # 中间件
│   └── auth.js            # 认证中间件
├── utils/                  # 工具函数
│   ├── location.js        # 位置计算
│   └── wechat.js          # 微信接口
└── database/               # 数据库脚本
└── init.sql           # 初始化SQL

## 技术栈

- **运行环境**: Node.js 18.x
- **框架**: Express 4.18
- **数据库**: MySQL 8.0
- **认证**: JWT (jsonwebtoken)
- **主要依赖**:
  - mysql2 - MySQL驱动
  - cors - 跨域支持
  - moment - 时间处理
  - geolib - 地理位置计算
  - express-validator - 参数验证
  - xlsx - Excel导出

## 快速开始

### 前置要求
- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

### 安装步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd wechat-checkin-backend
2. 安装依赖
bashnpm install
3. 配置环境变量
bashcp .env.example .env
# 编辑 .env 文件，配置数据库连接和JWT密钥
.env 文件示例：
envDB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=wechat_checkin
JWT_SECRET=your_jwt_secret_key
WX_APPID=your_wechat_appid      # 可选，测试时可用假值
WX_SECRET=your_wechat_secret    # 可选，测试时可用假值
PORT=3000
4. 初始化数据库
bash# 创建数据库
mysql -u root -p -e "CREATE DATABASE wechat_checkin;"

# 导入表结构
mysql -u root -p wechat_checkin < database/init.sql

# 导入测试数据（可选）
mysql -u root -p wechat_checkin < database/test_data.sql
5. 启动服务
bash# 开发环境
npm run dev

# 生产环境
npm start
服务启动后访问: http://localhost:3000
API文档
认证相关
用户注册
httpPOST /api/auth/register
Content-Type: application/json

{
  "username": "张三",
  "phone": "13800138000",
  "company_id": 1,
  "openid": "test_openid"
}
用户登录（测试用）
httpPOST /api/auth/login
Content-Type: application/json

{
  "username": "张三"
}
打卡相关
打卡
httpPOST /api/checkin/clock
Authorization: Bearer <token>
Content-Type: application/json

{
  "location_id": 1,
  "longitude": 121.4737,
  "latitude": 31.2304,
  "checkin_type": "in",
  "device_id": "device123"
}
获取打卡记录
httpGET /api/checkin/records/{userId}
简单打卡（测试用，无需认证）
httpPOST /api/checkin/simple-clock
Content-Type: application/json

{
  "user_id": 1,
  "type": "in"
}
更多API

公司管理: /api/company/*
项目管理: /api/project/*
用户管理: /api/user/*
请假管理: /api/leave/*
统计报表: /api/statistics/*

数据库设计
核心表结构
表名说明主要字段companies公司信息id, company_name, valid_untilusers用户信息id, username, phone, role, statusprojects项目信息id, project_name, manager_idcheckin_locations打卡地点id, project_id, longitude, latitudecheckin_records打卡记录id, user_id, location_id, checkin_timeleave_applications请假申请id, user_id, leave_type, start_date, end_date
用户角色

admin: 系统管理员 - 所有权限
project_manager: 项目负责人 - 管理自己的项目
staff: 普通员工 - 打卡和申请

测试指南
运行测试脚本
bash# 基础功能测试
./test_basic.sh

# 打卡功能测试
./test_checkin.sh

# 批量用户测试
./test_batch_users.sh

# 统计功能测试
./test_statistics.sh

# 运行所有测试
./run_all_tests.sh
手动测试
bash# 1. 创建测试用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"测试用户","phone":"13900000001","company_id":1,"openid":"test_001"}'

# 2. 登录获取token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"测试用户"}'

# 3. 打卡测试
curl -X POST http://localhost:3000/api/checkin/simple-clock \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"type":"in"}'
部署说明
Docker部署
bash# 构建镜像
docker build -t wechat-checkin-backend .

# 运行容器
docker run -d \
  --name checkin-backend \
  -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PASSWORD=your_password \
  wechat-checkin-backend
PM2部署
bash# 安装PM2
npm install -g pm2

# 启动应用
pm2 start app.js --name checkin-backend

# 保存配置
pm2 save
pm2 startup
Nginx配置示例
nginxserver {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
故障排查
常见问题
1. MySQL连接失败
bash# 检查MySQL服务
service mysql status

# 重启MySQL
service mysql restart

# 检查连接
mysql -u root -p -e "SELECT 1;"
2. 用户ID为空
bash# 确保有测试数据
mysql -u root -p wechat_checkin < database/test_data.sql
3. 打卡重复
bash# 查看重复记录
./check_duplicates.sh

# 清理测试数据
./clean_test_data.sh
4. Token认证失败

检查JWT_SECRET配置
确认token格式: Authorization: Bearer <token>
检查token是否过期

日志查看
bash# 查看应用日志
tail -f logs/app.log

# 查看PM2日志
pm2 logs checkin-backend

# 查看MySQL日志
tail -f /var/log/mysql/error.log
开发计划

 添加人脸识别打卡
 支持批量导入员工
 添加考勤提醒功能
 优化统计报表
 添加更多审批流程
 支持多语言

贡献指南
欢迎提交Issue和Pull Request！
许可证
MIT License
联系方式
如有问题，请提交Issue或联系项目维护者。

注意事项：

生产环境部署前请修改所有默认密码
确保数据库定期备份
建议使用HTTPS协议
定期更新依赖包以修复安全漏洞
// 40. 审批项目入场申请
router.post('/entry-applications/:id/approve', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { status, approve_remark } = req.body;
    const approver_id = req.user.id;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的审批状态'
      });
    }
    
    await connection.beginTransaction();
    
    // 检查申请是否存在且待审批
    const [applications] = await connection.query(
      'SELECT * FROM project_entries WHERE id = ? AND status = "pending"',
      [id]
    );
    
    if (applications.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '申请不存在或已处理'
      });
    }
    
    const application = applications[0];
    
    // 更新审批状态
    await connection.query(
      `UPDATE project_entries 
       SET status = ?, 
           approver_id = ?, 
           approve_time = NOW(), 
           approve_remark = ?
       WHERE id = ?`,
      [status, approver_id, approve_remark, id]
    );
    
    // 如果是批准离场申请，需要将对应的入场申请设为过期
    if (status === 'approved' && application.entry_type === 'exit') {
      await connection.query(
        `UPDATE project_entries 
         SET status = 'expired', 
             updated_at = NOW()
         WHERE user_id = ? 
           AND project_id = ? 
           AND location_id = ? 
           AND entry_type = 'entry' 
           AND status = 'approved'`,
        [application.user_id, application.project_id, application.location_id]
      );
      
      // 记录入场申请过期的操作日志
      await connection.query(
        `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
         VALUES (?, ?, ?, ?, ?)`,
        [
          approver_id,
          'EXPIRE_ENTRY',
          'PROJECT_ENTRY',
          application.user_id,
          JSON.stringify({ 
            reason: 'exit_approved',
            user_id: application.user_id,
            project_id: application.project_id,
            location_id: application.location_id,
            exit_application_id: id
          })
        ]
      );
    }
    
    // 记录审批操作日志
    await connection.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, ?, ?, ?, ?)`,
      [
        approver_id,
        status === 'approved' ? 'APPROVE_ENTRY' : 'REJECT_ENTRY',
        'PROJECT_ENTRY',
        id,
        JSON.stringify({ 
          status, 
          approve_remark,
          entry_type: application.entry_type
        })
      ]
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: `${status === 'approved' ? '批准' : '拒绝'}成功${
        status === 'approved' && application.entry_type === 'exit' ? '，相关入场申请已自动过期' : ''
      }`
    });
  } catch (error) {
    await connection.rollback();
    console.error('审批项目入场申请失败:', error);
    res.status(500).json({
      code: 500,
      message: '审批失败',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// pages/admin/entryApproval/entryApproval.js
const api = require('../../../utils/request.js')

Page({
  data: {
    applications: [],
    filteredApplications: [],
    currentFilter: 'all',
    currentFilterIndex: 0, // 添加索引用于picker
    filterOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审批' },
      { value: 'approved', label: '已批准' },
      { value: 'rejected', label: '已拒绝' }
    ],
    expandedUsers: {},
    expandedProjects: {},
    showApproveDialog: false,
    currentApproval: null,
    approveRemark: '',
    statistics: {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    }
  },

  onLoad() {
    this.loadApplications()
    this.loadStatistics()
  },

  onShow() {
    this.loadApplications()
    this.loadStatistics()
  },

  // 加载申请列表
  async loadApplications() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await api.adminGetEntryApplications({
        status: this.data.currentFilter === 'all' ? 'all' : this.data.currentFilter
      })
      
      if (res.code === 200) {
        // 格式化数据中的日期时间
        const formattedData = (res.data || []).map(userGroup => ({
          ...userGroup,
          projects: userGroup.projects.map(project => ({
            ...project,
            applications: project.applications.map(app => ({
              ...app,
              formatted_expect_leavetime: app.expect_leavetime ? this.formatDateTime(app.expect_leavetime) : '',
              formatted_created_at: this.formatDateTime(app.created_at),
              formatted_approve_time: app.approve_time ? this.formatDateTime(app.approve_time) : ''
            }))
          }))
        }))
        
        this.setData({
          applications: formattedData,
          filteredApplications: formattedData
        })
      } else {
        wx.showToast({
          title: res.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载申请列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载统计数据
  async loadStatistics() {
    try {
      const res = await api.adminGetEntryStatistics()
      
      if (res.code === 200) {
        this.setData({
          statistics: {
            pending: res.data.pending_count,
            approved: res.data.approved_count,
            rejected: res.data.rejected_count,
            total: res.data.total_count
          }
        })
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  // 切换用户展开/收起
  toggleUser(e) {
    const userId = e.currentTarget.dataset.userId
    const expandedUsers = this.data.expandedUsers
    expandedUsers[userId] = !expandedUsers[userId]
    
    this.setData({ expandedUsers })
  },

  // 切换项目展开/收起
  toggleProject(e) {
    const key = e.currentTarget.dataset.key
    const expandedProjects = this.data.expandedProjects
    expandedProjects[key] = !expandedProjects[key]
    
    this.setData({ expandedProjects })
  },

  // 切换筛选
  onFilterChange(e) {
    const filterIndex = e.detail.value
    const filterValue = this.data.filterOptions[filterIndex].value
    this.setData({
      currentFilter: filterValue,
      currentFilterIndex: filterIndex,
      expandedUsers: {},
      expandedProjects: {}
    })
    this.loadApplications()
  },

  // 显示审批对话框
  showApproveDialog(e) {
    const application = e.currentTarget.dataset.application
    const action = e.currentTarget.dataset.action
    const userGroup = e.currentTarget.dataset.usergroup
    
    this.setData({
      showApproveDialog: true,
      currentApproval: {
        ...application,
        username: userGroup.username,  // 添加用户名
        action
      },
      approveRemark: ''
    })
  },

  // 关闭审批对话框
  closeApproveDialog() {
    this.setData({
      showApproveDialog: false,
      currentApproval: null,
      approveRemark: ''
    })
  },

  // 输入审批备注
  onRemarkInput(e) {
    this.setData({
      approveRemark: e.detail.value
    })
  },

  // 确认审批
  async confirmApprove() {
    const { currentApproval, approveRemark } = this.data
    
    if (!currentApproval) return
    
    wx.showLoading({ title: '处理中...' })
    
    try {
      const res = await api.adminApproveEntry(currentApproval.id, {
        status: currentApproval.action,
        approve_remark: approveRemark
      })
      
      if (res.code === 200) {
        wx.showToast({
          title: res.message || (currentApproval.action === 'approved' ? '已批准' : '已拒绝'),
          icon: 'success'
        })
        
        this.closeApproveDialog()
        this.loadApplications()
        this.loadStatistics()
      } else {
        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('审批失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      expired: '已过期'
    }
    return map[status] || status
  },

  // 获取状态颜色
  getStatusColor(status) {
    const map = {
      pending: '#ff9800',
      approved: '#4caf50',
      rejected: '#f44336',
      expired: '#9e9e9e'
    }
    return map[status] || '#666'
  },

  // 获取申请类型文本
  getEntryTypeText(type) {
    return type === 'entry' ? '入场申请' : '离场申请'
  },

  // 获取申请类型颜色
  getEntryTypeColor(type) {
    return type === 'entry' ? '#2196f3' : '#ff5722'
  },

  // 下拉刷新
  onPullDownRefresh() {
    Promise.all([
      this.loadApplications(),
      this.loadStatistics()
    ]).then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
<view class="container">
  <!-- 头部统计 -->
  <view class="statistics-card">
    <view class="stat-item">
      <view class="stat-value" style="color: #ff9800;">{{statistics.pending}}</view>
      <view class="stat-label">待审批</view>
    </view>
    <view class="stat-item">
      <view class="stat-value" style="color: #4caf50;">{{statistics.approved}}</view>
      <view class="stat-label">已批准</view>
    </view>
    <view class="stat-item">
      <view class="stat-value" style="color: #f44336;">{{statistics.rejected}}</view>
      <view class="stat-label">已拒绝</view>
    </view>
    <view class="stat-item">
      <view class="stat-value">{{statistics.total}}</view>
      <view class="stat-label">总申请</view>
    </view>
  </view>

  <!-- 筛选栏 -->
  <view class="filter-bar">
    <picker mode="selector" range="{{filterOptions}}" range-key="label" value="{{currentFilterIndex}}" bindchange="onFilterChange">
      <view class="filter-selector">
        <text>{{filterOptions[currentFilterIndex].label}}</text>
        <text class="arrow">▼</text>
      </view>
    </picker>
  </view>

  <!-- 申请列表 -->
  <view class="applications-list" wx:if="{{filteredApplications.length > 0}}">
    <block wx:for="{{filteredApplications}}" wx:key="user_id" wx:for-item="userGroup">
      <!-- 用户分组 -->
      <view class="user-group">
        <view class="user-header" bindtap="toggleUser" data-user-id="{{userGroup.user_id}}">
          <view class="user-info">
            <text class="user-name">{{userGroup.username}}</text>
            <text class="user-phone">{{userGroup.phone}}</text>
          </view>
          <view class="expand-icon">{{expandedUsers[userGroup.user_id] ? '▼' : '▶'}}</view>
        </view>
        
        <!-- 项目列表 -->
        <view class="projects-list" wx:if="{{expandedUsers[userGroup.user_id]}}">
          <block wx:for="{{userGroup.projects}}" wx:key="project_id" wx:for-item="projectGroup">
            <view class="project-group">
              <view class="project-header" bindtap="toggleProject" data-key="{{userGroup.user_id + '_' + projectGroup.project_id}}">
                <text class="project-name">📁 {{projectGroup.project_name}}</text>
                <view class="expand-icon">{{expandedProjects[userGroup.user_id + '_' + projectGroup.project_id] ? '▼' : '▶'}}</view>
              </view>
              
              <!-- 申请列表 -->
              <view class="applications-items" wx:if="{{expandedProjects[userGroup.user_id + '_' + projectGroup.project_id]}}">
                <block wx:for="{{projectGroup.applications}}" wx:key="id" wx:for-item="app">
                  <view class="application-card">
                    <view class="app-header">
                      <view class="app-location">
                        <text class="location-icon">📍</text>
                        <text class="location-name">{{app.location_name}}</text>
                      </view>
                      <view class="app-status" style="color: {{getStatusColor(app.status)}}">
                        {{getStatusText(app.status)}}
                      </view>
                    </view>
                    
                    <!-- 申请类型标签 - 更突出的显示 -->
                    <view class="app-type-tag">
                      <view class="type-badge {{app.entry_type === 'entry' ? 'entry-badge' : 'exit-badge'}}" 
                            style="background-color: {{getEntryTypeColor(app.entry_type)}}">
                        {{app.entry_type === 'entry' ? '🔑' : '🚪'}} {{getEntryTypeText(app.entry_type)}}
                      </view>
                    </view>
                    
                    <view class="app-info">
                      <view class="info-row" wx:if="{{app.apply_reason}}">
                        <text class="info-label">申请原因：</text>
                        <text class="info-value">{{app.apply_reason}}</text>
                      </view>
                      
                      <view class="info-row" wx:if="{{app.expect_leavetime}}">
                        <text class="info-label">预计离场：</text>
                        <text class="info-value">{{app.formatted_expect_leavetime}}</text>
                      </view>
                      
                      <view class="info-row">
                        <text class="info-label">申请时间：</text>
                        <text class="info-value">{{app.formatted_created_at}}</text>
                      </view>
                      
                      <view class="info-row" wx:if="{{app.approver_name}}">
                        <text class="info-label">审批人：</text>
                        <text class="info-value">{{app.approver_name}}</text>
                      </view>
                      
                      <view class="info-row" wx:if="{{app.approve_time}}">
                        <text class="info-label">审批时间：</text>
                        <text class="info-value">{{app.formatted_approve_time}}</text>
                      </view>
                      
                      <view class="info-row" wx:if="{{app.approve_remark}}">
                        <text class="info-label">审批备注：</text>
                        <text class="info-value">{{app.approve_remark}}</text>
                      </view>
                    </view>
                    
                    <!-- 操作按钮 -->
                    <view class="action-buttons" wx:if="{{app.status === 'pending'}}">
                      <button class="btn-approve" bindtap="showApproveDialog" 
                              data-application="{{app}}" data-action="approved" data-usergroup="{{userGroup}}">
                        批准
                      </button>
                      <button class="btn-reject" bindtap="showApproveDialog" 
                              data-application="{{app}}" data-action="rejected" data-usergroup="{{userGroup}}">
                        拒绝
                      </button>
                    </view>
                  </view>
                </block>
              </view>
            </view>
          </block>
        </view>
      </view>
    </block>
  </view>

  <!-- 空状态 -->
  <view class="empty-state" wx:else>
    <text class="empty-icon">📋</text>
    <text class="empty-text">暂无{{currentFilter === 'pending' ? '待审批的' : currentFilter === 'approved' ? '已批准的' : currentFilter === 'rejected' ? '已拒绝的' : ''}}申请</text>
  </view>

  <!-- 审批对话框 -->
  <view class="dialog-mask" wx:if="{{showApproveDialog}}" bindtap="closeApproveDialog"></view>
  <view class="dialog" wx:if="{{showApproveDialog}}">
    <view class="dialog-header">
      <text>{{currentApproval.action === 'approved' ? '批准申请' : '拒绝申请'}}</text>
    </view>
    <view class="dialog-body">
      <view class="dialog-info">
        <text>用户：{{currentApproval.username}}</text>
        <text>地点：{{currentApproval.location_name}}</text>
        <text>类型：{{getEntryTypeText(currentApproval.entry_type)}}</text>
        <text wx:if="{{currentApproval.entry_type === 'exit' && currentApproval.action === 'approved'}}" 
              style="color: #ff9800; font-size: 12px; margin-top: 8px;">
          ⚠️ 批准离场申请将自动过期对应的入场记录
        </text>
      </view>
      <textarea 
        class="remark-input" 
        placeholder="请输入审批备注（可选）"
        value="{{approveRemark}}"
        bindinput="onRemarkInput"
        maxlength="200"
      />
    </view>
    <view class="dialog-footer">
      <button class="dialog-btn cancel" bindtap="closeApproveDialog">取消</button>
      <button class="dialog-btn confirm {{currentApproval.action === 'approved' ? 'approve' : 'reject'}}" 
              bindtap="confirmApprove">
        确定
      </button>
    </view>
  </view>

/* 新增的申请类型标签样式 */
.app-type-tag {
  margin: 8px 0;
  display: flex;
  justify-content: flex-start;
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  color: white;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  min-width: 80px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.entry-badge {
  background-color: #2196f3;
}

.exit-badge {
  background-color: #ff5722;
}

/* 对话框信息样式优化 */
.dialog-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.dialog-info text {
  font-size: 14px;
  color: #333;
  padding: 4px 0;
}

/* 筛选器样式优化 */
.filter-bar {
  margin: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-selector {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
  font-size: 14px;
}

.arrow {
  color: #999;
  font-size: 12px;
}

/* 统计卡片样式优化 */
.statistics-card {
  display: flex;
  justify-content: space-around;
  margin: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

/* 用户和项目组样式 */
.user-group {
  margin: 0 16px 16px 16px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-header {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.user-phone {
  font-size: 12px;
  color: #666;
}

.expand-icon {
  color: #999;
  font-size: 14px;
}

.project-header {
  padding: 12px 16px;
  background: #f1f3f4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
}

.project-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

/* 申请卡片样式 */
.application-card {
  margin: 8px 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.app-location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.location-icon {
  font-size: 14px;
}

.location-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.app-status {
  font-size: 12px;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid currentColor;
}

.app-info {
  margin: 12px 0;
}

.info-row {
  display: flex;
  margin-bottom: 6px;
  font-size: 13px;
}

.info-label {
  color: #666;
  min-width: 80px;
  flex-shrink: 0;
}

.info-value {
  color: #333;
  flex: 1;
  word-break: break-all;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.btn-approve, .btn-reject {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

.btn-approve {
  background: #4caf50;
  color: white;
}

.btn-reject {
  background: #f44336;
  color: white;
}

/* 对话框样式 */
.dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 400px;
  background: white;
  border-radius: 12px;
  z-index: 1001;
  overflow: hidden;
}

.dialog-header {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  text-align: center;
  font-weight: bold;
  color: #333;
}

.dialog-body {
  padding: 16px;
}

.remark-input {
  width: 100%;
  min-height: 80px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
}

.dialog-footer {
  display: flex;
  border-top: 1px solid #e9ecef;
}

.dialog-btn {
  flex: 1;
  padding: 16px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  background: white;
  color: #333;
}

.dialog-btn.cancel {
  border-right: 1px solid #e9ecef;
  color: #666;
}

.dialog-btn.confirm.approve {
  background: #4caf50;
  color: white;
}

.dialog-btn.confirm.reject {
  background: #f44336;
  color: white;
}

/* 空状态样式 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
}