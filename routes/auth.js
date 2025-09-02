const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');

// 微信登录
router.post('/wxLogin', [
  body('code').notEmpty().withMessage('code不能为空')
], authController.wxLogin);

// 用户注册
router.post('/register', [
  body('openid').notEmpty().withMessage('openid不能为空'),
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('company_id').isInt().withMessage('公司ID必须是整数')
], authController.register);

// 测试用登录（不需要微信）
router.post('/login', async (req, res) => {
  const pool = require('../config/database');
  const jwt = require('jsonwebtoken');
  try {
    const { username } = req.body;
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    const token = jwt.sign(
      { userId: users[0].id, username: users[0].username },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      code: 200,
      message: '登录成功',
      data: { token, user: users[0] }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
