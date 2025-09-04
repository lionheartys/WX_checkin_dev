const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// 用户注册（带密码）
router.post('/register', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('两次密码不一致'),
  body('company_id').isInt().withMessage('公司ID必须是整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { username, phone, password, company_id, openid } = req.body;
    
    // 检查用户是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE phone = ? OR username = ?',
      [phone, username]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户名或手机号已存在',
        data: null
      });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const [result] = await pool.query(
      'INSERT INTO users (openid, username, phone, password, company_id, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [openid || `test_${Date.now()}`, username, phone, hashedPassword, company_id || 1, 'staff', 'approved']
    );
    
    res.json({
      code: 200,
      message: '注册成功',
      data: { userId: result.insertId }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      data: null
    });
  }
});

// 用户登录（带密码验证）
router.post('/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { username, password } = req.body;
    
    // 查询用户
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR phone = ?',
      [username, username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null
      });
    }
    
    const user = users[0];
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password || '');
    
    if (!isValidPassword) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null
      });
    }
    
    // 检查状态
    if (user.status !== 'approved') {
      return res.status(403).json({
        code: 403,
        message: '账号未审批或已禁用',
        data: null
      });
    }
    
    // 生成token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          role: user.role,
          company_id: user.company_id
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      data: null
    });
  }
});

module.exports = router;