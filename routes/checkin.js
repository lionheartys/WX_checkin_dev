const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinController');
const { authMiddleware } = require('../middleware/auth');
const { body } = require('express-validator');

// 修复时区问题 - 使用 moment-timezone
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Shanghai'); // 设置默认时区为中国时间

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
router.post('/config', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { locationId } = req.body.locationId;

    if (!locationId) {
      return res.status(400).json({
        code: 400,
        message: '打卡地点ID不能为空'
      });
    }

    // 根据项目ID获取最新的打卡配置
    const [rows] = await pool.query(
      `SELECT * FROM checkin_locations 
       WHERE id = ? AND status = 1 
       ORDER BY id DESC 
       LIMIT 1`,
      [locationId]
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

router.post('/simple-clock', async (req, res) => {
  const pool = require('../config/database');
  const connection = await pool.getConnection();

  try {
    const { user_id, type, longitude, latitude, remark } = req.body;

    await connection.beginTransaction();

    // 获取默认打卡地点及配置
    const [locations] = await connection.query(
      `SELECT * FROM checkin_locations 
       WHERE status = 1 
       ORDER BY id DESC 
       LIMIT 1`
    );

    if (locations.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '未找到有效的打卡地点配置'
      });
    }

    const location = locations[0];
    const locationId = location.id;

    // 使用中国时区的当前时间
    const now = moment().tz('Asia/Shanghai');
    const today = now.format('YYYY-MM-DD');

    // 检查今日是否已打卡
    const [todayRecords] = await connection.query(
      `SELECT * FROM checkin_records 
       WHERE user_id = ? AND location_id = ? AND checkin_type = ? 
       AND DATE(checkin_time) = ?`,
      [user_id, locationId, type || 'in', today]
    );

    if (todayRecords.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: `今日已${type === 'out' ? '下班' : '上班'}打卡`,
        data: null
      });
    }

    // 判断打卡状态（迟到、早退、正常）
    const checkinTime = now.format('YYYY-MM-DD HH:mm:ss');
    let checkinStatus = 'normal';
    let abnormalReason = null;

    // 调试日志（可选，正式环境可以删除）
    console.log('当前北京时间:', now.format('YYYY-MM-DD HH:mm:ss'));
    console.log('打卡类型:', type);

    if (type === 'in' || !type) {  // 上班打卡
      const workStartTime = location.work_start_time || '09:00:00';
      const abnormalThreshold = parseInt(location.abnormal_threshold) || 30;

      // 构建今天的上班时间（使用中国时区）
      const workStart = moment.tz(`${today} ${workStartTime}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      const lateThreshold = workStart.clone().add(abnormalThreshold, 'minutes');

      // 调试日志
      console.log('上班时间:', workStart.format('YYYY-MM-DD HH:mm:ss'));
      console.log('迟到阈值:', lateThreshold.format('YYYY-MM-DD HH:mm:ss'));
      console.log('是否迟到:', now.isAfter(lateThreshold));

      // 判断是否迟到
      if (now.isAfter(lateThreshold)) {
        checkinStatus = 'late';
        const lateMinutes = now.diff(workStart, 'minutes');
        abnormalReason = `迟到${lateMinutes}分钟`;

        // 如果有备注，添加到异常原因中
        if (remark) {
          abnormalReason += `；备注：${remark}`;
        }
      }
    } else if (type === 'out') {  // 下班打卡
      const workEndTime = location.work_end_time || '18:00:00';
      const abnormalThreshold = parseInt(location.abnormal_threshold) || 30;

      // 构建今天的下班时间（使用中国时区）
      const workEnd = moment.tz(`${today} ${workEndTime}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      const earlyThreshold = workEnd.clone().subtract(abnormalThreshold, 'minutes');

      // 调试日志
      console.log('下班时间:', workEnd.format('YYYY-MM-DD HH:mm:ss'));
      console.log('早退阈值:', earlyThreshold.format('YYYY-MM-DD HH:mm:ss'));
      console.log('是否早退:', now.isBefore(earlyThreshold));

      // 判断是否早退
      if (now.isBefore(earlyThreshold)) {
        checkinStatus = 'early';
        const earlyMinutes = workEnd.diff(now, 'minutes');
        abnormalReason = `早退${earlyMinutes}分钟`;

        // 如果有备注，添加到异常原因中
        if (remark) {
          abnormalReason += `；备注：${remark}`;
        }
      }
    }

    console.log('最终打卡状态:', checkinStatus);
    console.log('异常原因:', abnormalReason);

    // 插入打卡记录
    const [result] = await connection.query(
      `INSERT INTO checkin_records 
       (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
        checkin_status, abnormal_reason, remark, is_device_abnormal, is_location_abnormal) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        user_id,
        locationId,
        type || 'in',
        checkinTime,
        longitude || location.longitude,
        latitude || location.latitude,
        checkinStatus,
        abnormalReason,
        remark || null
      ]
    );

    await connection.commit();

    // 返回打卡结果
    res.json({
      code: 200,
      message: '打卡成功',
      data: {
        recordId: result.insertId,
        checkinTime: checkinTime,
        status: checkinStatus,
        abnormalReason: abnormalReason
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('打卡失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '打卡失败'
    });
  } finally {
    connection.release();
  }
});

// 获取打卡记录（简单版）
router.get('/records/:userId', async (req, res) => {
  const pool = require('../config/database');
  try {
    const [records] = await pool.query(
      `SELECT r.*, l.location_name, p.project_name
       FROM checkin_records r
       LEFT JOIN checkin_locations l ON r.location_id = l.id
       LEFT JOIN projects p ON l.project_id = p.id
       WHERE r.user_id = ? 
       ORDER BY r.checkin_time DESC 
       LIMIT 10`,
      [req.params.userId]
    );
    res.json({ code: 200, data: records });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有可用的打卡地点（用于补卡）
router.get('/available-locations', authMiddleware, checkinController.getAllAvailableLocations);

module.exports = router;