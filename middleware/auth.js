// middleware/auth.js - 认证中间件
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: '未提供认证令牌',
        data: null
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 从数据库获取用户信息
    const [users] = await pool.query(
      'SELECT id, openid, username, phone, company_id, role, status FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        message: '用户不存在',
        data: null
      });
    }

    if (users[0].status !== 'approved') {
      return res.status(403).json({
        code: 403,
        message: '用户未审批或已禁用',
        data: null
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证失败',
      data: null
    });
  }
};

// 角色权限中间件
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足',
        data: null
      });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole };