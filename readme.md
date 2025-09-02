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