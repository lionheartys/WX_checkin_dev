// controllers/authController.js - 认证控制器
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { getOpenId } = require('../utils/wechat');
const { validationResult } = require('express-validator');

// 微信登录
exports.wxLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { code } = req.body;
    
    // 获取openid
    const wxData = await getOpenId(code);
    const { openid, session_key } = wxData;
    
    // 查询用户是否存在
    const [users] = await pool.query(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );
    
    if (users.length === 0) {
      // 用户不存在，返回需要注册
      return res.json({
        code: 200,
        message: '需要注册',
        data: {
          needRegister: true,
          openid: openid
        }
      });
    }
    
    const user = users[0];
    
    // 检查用户状态
    if (user.status !== 'approved') {
      return res.status(403).json({
        code: 403,
        message: user.status === 'pending' ? '账号待审批' : '账号已被禁用',
        data: null
      });
    }
    
    // 检查公司有效期
    const [companies] = await pool.query(
      'SELECT * FROM companies WHERE id = ? AND valid_until >= CURDATE()',
      [user.company_id]
    );
    
    if (companies.length === 0) {
      return res.status(403).json({
        code: 403,
        message: '公司已过期或不存在',
        data: null
      });
    }
    
    // 生成token
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: {
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
      message: '登录失败',
      data: null
    });
  }
};

// 用户注册
exports.register = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { openid, username, phone, company_id, device_id } = req.body;
    
    await connection.beginTransaction();
    
    // 检查用户是否已存在
    const [existingUsers] = await connection.query(
      'SELECT * FROM users WHERE openid = ? OR phone = ?',
      [openid, phone]
    );
    
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '用户已存在',
        data: null
      });
    }
    
    // 插入新用户
    const [result] = await connection.query(
      'INSERT INTO users (openid, username, phone, company_id, device_id, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [openid, username, phone, company_id, device_id, 'staff', 'pending']
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: '注册成功，等待审批',
      data: {
        userId: result.insertId
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      message: '注册失败',
      data: null
    });
  } finally {
    connection.release();
  }
};
