
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');

// 测试用：直接登录（跳过微信认证）
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    
    // 查询或创建测试用户
    let [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      // 创建测试用户
      const [result] = await pool.query(
        'INSERT INTO users (openid, username, phone, company_id, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [`test_${Date.now()}`, username, '13800000000', 1, 'staff', 'approved']
      );
      
      [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
    }
    
    const user = users[0];
    
    // 生成token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
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
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// 测试用：简单打卡（不验证位置）
router.post('/checkin', async (req, res) => {
  try {
    const { userId, type } = req.body;
    
    // 先检查是否有打卡地点
    const [locations] = await pool.query('SELECT * FROM checkin_locations LIMIT 1');
    
    let locationId = 1;
    if (locations.length === 0) {
      // 创建一个默认打卡地点
      const [result] = await pool.query(
        'INSERT INTO checkin_locations (project_id, location_name, longitude, latitude, work_start_time, work_end_time) VALUES (?, ?, ?, ?, ?, ?)',
        [1, '测试地点', 121.4737, 31.2304, '09:00:00', '18:00:00']
      );
      locationId = result.insertId;
    } else {
      locationId = locations[0].id;
    }
    
    // 插入打卡记录
    const [result] = await pool.query(
      'INSERT INTO checkin_records (user_id, location_id, checkin_type, checkin_time, longitude, latitude, checkin_status) VALUES (?, ?, ?, NOW(), ?, ?, ?)',
      [userId, locationId, type || 'in', 121.4737, 31.2304, 'normal']
    );
    
    res.json({
      code: 200,
      message: '打卡成功',
      data: {
        recordId: result.insertId,
        time: new Date().toLocaleString('zh-CN')
      }
    });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, phone, role, status FROM users');
    res.json({
      code: 200,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

// 获取打卡记录
router.get('/records/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [records] = await pool.query(
      'SELECT * FROM checkin_records WHERE user_id = ? ORDER BY checkin_time DESC LIMIT 10',
      [userId]
    );
    res.json({
      code: 200,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message
    });
  }
});

module.exports = router;
