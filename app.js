// app.js - 主应用文件
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 导入路由
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const userRoutes = require('./routes/user');
const projectRoutes = require('./routes/project');
const locationRoutes = require('./routes/location');
const entryRoutes = require('./routes/entry');
const checkinRoutes = require('./routes/checkin');
const leaveRoutes = require('./routes/leave');
const statisticsRoutes = require('./routes/statistics');
// 添加测试
const testRoutes = require('./routes/test');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/entry', entryRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/statistics', statisticsRoutes);
// 添加测试
app.use('/api/test', testRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    code: err.status || 500,
    message: err.message || '服务器内部错误',
    data: null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
