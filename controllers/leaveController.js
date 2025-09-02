// controllers/leaveController.js - 请假管理控制器
const pool = require('../config/database');
const moment = require('moment');
const { validationResult } = require('express-validator');

// 申请调休额度
exports.applyCompensatory = async (req, res) => {
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
    const { project_id, start_date, end_date } = req.body;
    
    await connection.beginTransaction();
    
    // 计算出差天数
    const startMoment = moment(start_date);
    const endMoment = moment(end_date);
    const businessDays = endMoment.diff(startMoment, 'days') + 1;
    
    if (businessDays < 14) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '出差天数不足14天，无法申请调休',
        data: null
      });
    }
    
    // 计算可调休天数（14天起，每10天1天调休）
    const quotaDays = Math.floor((businessDays - 14) / 10) + 1;
    
    // 插入调休额度申请
    const [result] = await connection.query(
      `INSERT INTO compensatory_quota 
       (user_id, project_id, start_date, end_date, business_days, quota_days) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, project_id, start_date, end_date, businessDays, quotaDays]
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: '调休额度申请提交成功',
      data: {
        applicationId: result.insertId,
        businessDays: businessDays,
        quotaDays: quotaDays
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('申请调休额度失败:', error);
    res.status(500).json({
      code: 500,
      message: '申请失败',
      data: null
    });
  } finally {
    connection.release();
  }
};

// 申请请假
exports.applyLeave = async (req, res) => {
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
    const { leave_type_id, start_date, end_date, reason } = req.body;
    
    await connection.beginTransaction();
    
    // 计算请假天数
    const startMoment = moment(start_date);
    const endMoment = moment(end_date);
    const leaveDays = endMoment.diff(startMoment, 'days') + 1;
    
    // 获取请假类型
    const [leaveTypes] = await connection.query(
      'SELECT * FROM leave_types WHERE id = ?',
      [leave_type_id]
    );
    
    if (leaveTypes.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '请假类型不存在',
        data: null
      });
    }
    
    const leaveType = leaveTypes[0];
    
    // 如果是调休，检查调休额度
    if (leaveType.type_code === 'compensatory') {
      const [quotas] = await connection.query(
        `SELECT SUM(quota_days - used_days) as available 
         FROM compensatory_quota 
         WHERE user_id = ? AND status = 'approved'`,
        [userId]
      );
      
      const available = quotas[0].available || 0;
      
      if (available < leaveDays) {
        await connection.rollback();
        return res.status(400).json({
          code: 400,
          message: `调休额度不足，可用${available}天`,
          data: null
        });
      }
    }
    
    // 检查是否有重叠的请假
    const [overlaps] = await connection.query(
      `SELECT * FROM leave_applications 
       WHERE user_id = ? 
       AND status IN ('pending', 'approved')
       AND ((start_date <= ? AND end_date >= ?) 
       OR (start_date <= ? AND end_date >= ?))`,
      [userId, start_date, start_date, end_date, end_date]
    );
    
    if (overlaps.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '该时间段已有请假申请',
        data: null
      });
    }
    
    // 插入请假申请
    const [result] = await connection.query(
      `INSERT INTO leave_applications 
       (user_id, leave_type_id, start_date, end_date, leave_days, reason) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, leave_type_id, start_date, end_date, leaveDays, reason]
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: '请假申请提交成功',
      data: {
        applicationId: result.insertId,
        leaveDays: leaveDays
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('申请请假失败:', error);
    res.status(500).json({
      code: 500,
      message: '申请失败',
      data: null
    });
  } finally {
    connection.release();
  }
};

// 审批请假
exports.approveLeave = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { status, approve_remark } = req.body;
    const approverId = req.user.id;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '审批状态不正确',
        data: null
      });
    }
    
    await connection.beginTransaction();
    
    // 获取请假申请信息
    const [applications] = await connection.query(
      `SELECT la.*, lt.type_code 
       FROM leave_applications la
       LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.id = ?`,
      [id]
    );
    
    if (applications.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '请假申请不存在',
        data: null
      });
    }
    
    const application = applications[0];
    
    if (application.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '该申请已处理',
        data: null
      });
    }
    
    // 更新申请状态
    await connection.query(
      `UPDATE leave_applications 
       SET status = ?, approver_id = ?, approve_time = NOW(), approve_remark = ? 
       WHERE id = ?`,
      [status, approverId, approve_remark, id]
    );
    
    // 如果是调休且审批通过，更新调休额度
    if (status === 'approved' && application.type_code === 'compensatory') {
      // 按先进先出原则扣除调休额度
      let remainingDays = application.leave_days;
      
      const [quotas] = await connection.query(
        `SELECT * FROM compensatory_quota 
         WHERE user_id = ? AND status = 'approved' AND quota_days > used_days
         ORDER BY created_at ASC`,
        [application.user_id]
      );
      
      for (const quota of quotas) {
        if (remainingDays <= 0) break;
        
        const available = quota.quota_days - quota.used_days;
        const deduct = Math.min(available, remainingDays);
        
        await connection.query(
          'UPDATE compensatory_quota SET used_days = used_days + ? WHERE id = ?',
          [deduct, quota.id]
        );
        
        remainingDays -= deduct;
      }
    }
    
    // 如果审批通过，在对应日期生成打卡记录
    if (status === 'approved') {
      const startDate = moment(application.start_date);
      const endDate = moment(application.end_date);
      
      // 获取用户的所有打卡地
      const [entries] = await connection.query(
        `SELECT pe.*, cl.* 
         FROM project_entries pe
         JOIN checkin_locations cl ON pe.location_id = cl.id
         WHERE pe.user_id = ? AND pe.entry_type = 'entry' AND pe.status = 'approved'`,
        [application.user_id]
      );
      
      // 为每个请假日期的每个打卡地生成请假记录
      for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
        for (const entry of entries) {
          // 生成上班打卡记录
          await connection.query(
            `INSERT INTO checkin_records 
             (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
              checkin_status, abnormal_reason, remark) 
             VALUES (?, ?, 'in', ?, ?, ?, 'leave', '请假', ?)`,
            [application.user_id, entry.location_id, 
             date.format('YYYY-MM-DD') + ' ' + entry.work_start_time,
             entry.longitude, entry.latitude, '请假自动生成']
          );
          
          // 生成下班打卡记录
          await connection.query(
            `INSERT INTO checkin_records 
             (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
              checkin_status, abnormal_reason, remark) 
             VALUES (?, ?, 'out', ?, ?, ?, 'leave', '请假', ?)`,
            [application.user_id, entry.location_id,
             date.format('YYYY-MM-DD') + ' ' + entry.work_end_time,
             entry.longitude, entry.latitude, '请假自动生成']
          );
        }
      }
    }
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: '审批成功',
      data: null
    });
  } catch (error) {
    await connection.rollback();
    console.error('审批请假失败:', error);
    res.status(500).json({
      code: 500,
      message: '审批失败',
      data: null
    });
  } finally {
    connection.release();
  }
};
