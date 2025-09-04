const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authMiddleware } = require('../middleware/auth');
const { body } = require('express-validator');

// 打卡
router.post('/clock', authMiddleware, [
  body('location_id').isInt().withMessage('打卡地ID必须是整数'),
  body('longitude').isFloat().withMessage('经度格式不正确'),
  body('latitude').isFloat().withMessage('纬度格式不正确'),
  body('checkin_type').isIn(['in', 'out']).withMessage('打卡类型不正确')
], checkinController.clockIn);

// 获取今日打卡记录
router.get('/today', authMiddleware, checkinController.getTodayRecords);

// 获取打卡历史
router.get('/history', authMiddleware, checkinController.getHistory);

// 补卡申请
router.post('/makeup', authMiddleware, [
  body('location_id').isInt().withMessage('打卡地ID必须是整数'),
  body('makeup_date').isDate().withMessage('日期格式不正确'),
  body('makeup_type').isIn(['in', 'out']).withMessage('补卡类型不正确'),
  body('reason').notEmpty().withMessage('补卡原因不能为空')
], checkinController.applyMakeup);



// 新增：获取打卡配置接口
router.get('/config', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { projectId } = req.query;
    
    // 根据项目ID获取最新的打卡配置
    const [rows] = await pool.query(
      `SELECT * FROM checkin_locations 
       WHERE project_id = ? AND status = 1 
       ORDER BY id DESC 
       LIMIT 1`,
      [projectId || 1]
    );
    
    if (rows.length > 0) {
      res.json({
        code: 200,
        data: rows[0]
      });
    } else {
      res.json({
        code: 404,
        message: '未找到打卡配置'
      });
    }
  } catch (error) {
    console.error('获取打卡配置失败:', error);
    res.status(500).json({ 
      code: 500, 
      message: '获取打卡配置失败'
    });
  }
});

// 测试用简单打卡（不需要认证和入场验证）
router.post('/simple-clock', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { user_id, type } = req.body;
    
    // 获取默认打卡地点
    const [locations] = await pool.query('SELECT id FROM checkin_locations LIMIT 1');
    let locationId = locations.length > 0 ? locations[0].id : 1;
    
    const [result] = await pool.query(
      'INSERT INTO checkin_records (user_id, location_id, checkin_type, checkin_time, longitude, latitude, checkin_status) VALUES (?, ?, ?, NOW(), ?, ?, ?)',
      [user_id, locationId, type || 'in', 121.4737, 31.2304, 'normal']
    );
    
    res.json({
      code: 200,
      message: '打卡成功',
      data: { recordId: result.insertId }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取打卡记录（简单版）
router.get('/records/:userId', async (req, res) => {
  const pool = require('../config/database');
  try {
    const [records] = await pool.query(
      'SELECT * FROM checkin_records WHERE user_id = ? ORDER BY checkin_time DESC LIMIT 10',
      [req.params.userId]
    );
    res.json({ code: 200, data: records });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
