// controllers/checkinController.js - 打卡控制器
const pool = require('../config/database');
const moment = require('moment');
const { isInRange } = require('../utils/location');
const { validationResult } = require('express-validator');

// 打卡
exports.clockIn = async (req, res) => {
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

    const userId = req.user.id;
    const { location_id, longitude, latitude, checkin_type, device_id, remark } = req.body;
    
    await connection.beginTransaction();
    
    // 检查是否已入场
    const [entries] = await connection.query(
      `SELECT * FROM project_entries 
       WHERE user_id = ? AND location_id = ? AND entry_type = 'entry' AND status = 'approved'`,
      [userId, location_id]
    );
    
    if (entries.length === 0) {
      await connection.rollback();
      return res.status(403).json({
        code: 403,
        message: '未入场或入场申请未通过',
        data: null
      });
    }
    
    // 检查是否已离场*****
    const [exits] = await connection.query(
      `SELECT * FROM project_entries 
       WHERE user_id = ? AND location_id = ? AND entry_type = 'exit' AND status = 'approved'`,
      [userId, location_id]
    );
    
    if (exits.length > 0) {
      await connection.rollback();
      return res.status(403).json({
        code: 403,
        message: '已离场项目无法打卡',
        data: null
      });
    }

    // 获取打卡地信息
    const [locations] = await connection.query(
      'SELECT * FROM checkin_locations WHERE id = ? AND status = 1',
      [location_id]
    );
    
    if (locations.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '打卡地不存在或已禁用',
        data: null
      });
    }
    
    const location = locations[0];
    
    // 检查今日是否已打卡
    const today = moment().format('YYYY-MM-DD');
    const [todayRecords] = await connection.query(
      `SELECT * FROM checkin_records 
       WHERE user_id = ? AND location_id = ? AND checkin_type = ? 
       AND DATE(checkin_time) = ?`,
      [userId, location_id, checkin_type, today]
    );
    
    if (todayRecords.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '今日已打卡',
        data: null
      });
    }
    
    // 检查位置是否在范围内
    const locationCheck = isInRange(
      { latitude, longitude },
      { latitude: location.latitude, longitude: location.longitude },
      location.checkin_range
    );
    
    // 检查时间是否正常
    const now = moment();
    const checkinTime = now.format('YYYY-MM-DD HH:mm:ss');
    let checkinStatus = 'normal';
    let abnormalReason = null;
    
    if (checkin_type === 'in') {
      const workStart = moment(now.format('YYYY-MM-DD') + ' ' + location.work_start_time);
      const lateThreshold = workStart.clone().add(location.abnormal_threshold, 'minutes');
      
      if (now.isAfter(lateThreshold)) {
        checkinStatus = 'late';
        abnormalReason = `迟到${now.diff(workStart, 'minutes')}分钟`;
      }
    } else {
      const workEnd = moment(now.format('YYYY-MM-DD') + ' ' + location.work_end_time);
      const earlyThreshold = workEnd.clone().subtract(location.abnormal_threshold, 'minutes');
      
      if (now.isBefore(earlyThreshold)) {
        checkinStatus = 'early';
        abnormalReason = `早退${workEnd.diff(now, 'minutes')}分钟`;
      }
    }
    
    // 检查设备是否异常
    const isDeviceAbnormal = device_id !== req.user.device_id ? 1 : 0;
    if (isDeviceAbnormal) {
      checkinStatus = 'abnormal';
      abnormalReason = (abnormalReason ? abnormalReason + '；' : '') + '非常用设备';
    }
    
    // 检查位置是否异常
    const isLocationAbnormal = !locationCheck.inRange ? 1 : 0;
    if (isLocationAbnormal) {
      checkinStatus = 'abnormal';
      abnormalReason = (abnormalReason ? abnormalReason + '；' : '') + 
        `不在打卡范围内(距离${locationCheck.distance}米)`;
    }
    
    // 插入打卡记录
    const [result] = await connection.query(
      `INSERT INTO checkin_records 
       (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
        device_id, checkin_status, abnormal_reason, is_device_abnormal, 
        is_location_abnormal, remark) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, location_id, checkin_type, checkinTime, longitude, latitude,
       device_id, checkinStatus, abnormalReason, isDeviceAbnormal,
       isLocationAbnormal, remark]
    );
    
    // 如果是第一次使用该设备且打卡正常，更新常用设备
    if (!isDeviceAbnormal && device_id && device_id !== req.user.device_id) {
      await connection.query(
        'UPDATE users SET device_id = ? WHERE id = ?',
        [device_id, userId]
      );
    }
    
    await connection.commit();
    
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
      message: '打卡失败',
      data: null
    });
  } finally {
    connection.release();
  }
};

// 获取今日打卡记录
exports.getTodayRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = moment().format('YYYY-MM-DD');
    
    const [records] = await pool.query(
      `SELECT r.*, l.location_name, p.project_name 
       FROM checkin_records r
       LEFT JOIN checkin_locations l ON r.location_id = l.id
       LEFT JOIN projects p ON l.project_id = p.id
       WHERE r.user_id = ? AND DATE(r.checkin_time) = ?
       ORDER BY r.checkin_time DESC`,
      [userId, today]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: records
    });
  } catch (error) {
    console.error('获取今日打卡记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
};

// 获取打卡历史
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { start_date, end_date, page = 1, pageSize = 20 } = req.query;
    
    let whereClause = 'WHERE r.user_id = ?';
    const params = [userId];
    
    if (start_date) {
      whereClause += ' AND DATE(r.checkin_time) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND DATE(r.checkin_time) <= ?';
      params.push(end_date);
    }
    
    const offset = (page - 1) * pageSize;
    
    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM checkin_records r ${whereClause}`,
      params
    );
    
    // 获取列表
    const [records] = await pool.query(
      `SELECT r.*, l.location_name, p.project_name 
       FROM checkin_records r
       LEFT JOIN checkin_locations l ON r.location_id = l.id
       LEFT JOIN projects p ON l.project_id = p.id
       ${whereClause}
       ORDER BY r.checkin_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list: records,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取打卡历史失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
};

// 补卡申请
exports.applyMakeup = async (req, res) => {
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

    const userId = req.user.id;
    const { location_id, makeup_date, makeup_type, reason } = req.body;
    
    await connection.beginTransaction();
    
    // 检查是否已有补卡申请
    const [existing] = await connection.query(
      `SELECT * FROM makeup_applications 
       WHERE user_id = ? AND location_id = ? AND makeup_date = ? AND makeup_type = ?`,
      [userId, location_id, makeup_date, makeup_type]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '已存在相同的补卡申请',
        data: null
      });
    }
    
    // 插入补卡申请
    const [result] = await connection.query(
      `INSERT INTO makeup_applications 
       (user_id, location_id, makeup_date, makeup_type, reason) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, location_id, makeup_date, makeup_type, reason]
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: '补卡申请提交成功',
      data: {
        applicationId: result.insertId
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('补卡申请失败:', error);
    res.status(500).json({
      code: 500,
      message: '补卡申请失败',
      data: null
    });
  } finally {
    connection.release();
  }
};
