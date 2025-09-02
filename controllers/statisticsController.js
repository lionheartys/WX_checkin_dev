// controllers/statisticsController.js - 考勤统计控制器
const pool = require('../config/database');
const moment = require('moment');
const XLSX = require('xlsx');

// 获取个人考勤统计
exports.getPersonalStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month, location_id } = req.query;
    
    // 构建日期范围
    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
    
    let whereClause = 'WHERE r.user_id = ? AND DATE(r.checkin_time) BETWEEN ? AND ?';
    const params = [userId, startDate, endDate];
    
    if (location_id) {
      whereClause += ' AND r.location_id = ?';
      params.push(location_id);
    }
    
    // 获取打卡记录
    const [records] = await pool.query(
      `SELECT r.*, l.location_name, p.project_name 
       FROM checkin_records r
       LEFT JOIN checkin_locations l ON r.location_id = l.id
       LEFT JOIN projects p ON l.project_id = p.id
       ${whereClause}
       ORDER BY r.checkin_time ASC`,
      params
    );
    
    // 统计数据
    const statistics = {
      totalDays: moment(endDate).diff(moment(startDate), 'days') + 1,
      normalDays: 0,
      lateDays: 0,
      earlyDays: 0,
      absentDays: 0,
      leaveDays: 0,
      abnormalDays: 0,
      records: records
    };
    
    // 按日期分组统计
    const dailyRecords = {};
    records.forEach(record => {
      const date = moment(record.checkin_time).format('YYYY-MM-DD');
      if (!dailyRecords[date]) {
        dailyRecords[date] = {
          in: null,
          out: null,
          status: 'normal'
        };
      }
      
      if (record.checkin_type === 'in') {
        dailyRecords[date].in = record;
      } else {
        dailyRecords[date].out = record;
      }
      
      // 更新状态
      if (record.checkin_status === 'late') {
        dailyRecords[date].status = 'late';
        statistics.lateDays++;
      } else if (record.checkin_status === 'early') {
        dailyRecords[date].status = 'early';
        statistics.earlyDays++;
      } else if (record.checkin_status === 'leave') {
        dailyRecords[date].status = 'leave';
        statistics.leaveDays++;
      } else if (record.checkin_status === 'abnormal') {
        dailyRecords[date].status = 'abnormal';
        statistics.abnormalDays++;
      }
    });
    
    // 计算正常天数
    statistics.normalDays = Object.values(dailyRecords).filter(d => d.status === 'normal').length;
    
    // 计算缺勤天数（应出勤天数 - 实际出勤天数 - 请假天数）
    const workDays = statistics.totalDays - 8; // 假设每月8天周末
    statistics.absentDays = workDays - Object.keys(dailyRecords).length;
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        statistics: statistics,
        dailyRecords: dailyRecords
      }
    });
  } catch (error) {
    console.error('获取个人考勤统计失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
};

// 导出考勤数据
exports.exportAttendance = async (req, res) => {
  try {
    const { start_date, end_date, format = 'excel', location_id } = req.query;
    
    let whereClause = 'WHERE DATE(r.checkin_time) BETWEEN ? AND ?';
    const params = [start_date, end_date];
    
    if (location_id) {
      whereClause += ' AND r.location_id = ?';
      params.push(location_id);
    }
    
    // 获取考勤数据
    const [records] = await pool.query(
      `SELECT r.*, u.username, u.phone, l.location_name, p.project_name, c.company_name
       FROM checkin_records r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN checkin_locations l ON r.location_id = l.id
       LEFT JOIN projects p ON l.project_id = p.id
       LEFT JOIN companies c ON u.company_id = c.id
       ${whereClause}
       ORDER BY r.checkin_time ASC`,
      params
    );
    
    if (format === 'excel') {
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      
      // 转换数据格式
      const wsData = records.map(record => ({
        '姓名': record.username,
        '手机号': record.phone,
        '公司': record.company_name,
        '项目': record.project_name,
        '打卡地': record.location_name,
        '打卡类型': record.checkin_type === 'in' ? '上班' : '下班',
        '打卡时间': moment(record.checkin_time).format('YYYY-MM-DD HH:mm:ss'),
        '打卡状态': {
          'normal': '正常',
          'late': '迟到',
          'early': '早退',
          'absent': '缺勤',
          'leave': '请假',
          'holiday': '休假',
          'abnormal': '异常'
        }[record.checkin_status],
        '异常原因': record.abnormal_reason || '',
        '备注': record.remark || ''
      }));
      
      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, '考勤记录');
      
      // 生成Excel文件
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_${start_date}_${end_date}.xlsx`);
      
      res.send(buffer);
    } else {
      // 返回JSON格式
      res.json({
        code: 200,
        message: '导出成功',
        data: records
      });
    }
  } catch (error) {
    console.error('导出考勤数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '导出失败',
      data: null
    });
  }
};

// 申诉考勤异常
exports.appealAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { record_id, appeal_reason } = req.body;
    
    // 检查打卡记录是否存在且属于该用户
    const [records] = await pool.query(
      'SELECT * FROM checkin_records WHERE id = ? AND user_id = ?',
      [record_id, userId]
    );
    
    if (records.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '打卡记录不存在',
        data: null
      });
    }
    
    // 检查是否已有申诉
    const [existingAppeals] = await pool.query(
      'SELECT * FROM attendance_appeals WHERE record_id = ? AND status = ?',
      [record_id, 'pending']
    );
    
    if (existingAppeals.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '该记录已有待处理的申诉',
        data: null
      });
    }
    
    // 创建申诉
    const [result] = await pool.query(
      'INSERT INTO attendance_appeals (user_id, record_id, appeal_reason) VALUES (?, ?, ?)',
      [userId, record_id, appeal_reason]
    );
    
    res.json({
      code: 200,
      message: '申诉提交成功',
      data: {
        appealId: result.insertId
      }
    });
  } catch (error) {
    console.error('申诉考勤异常失败:', error);
    res.status(500).json({
      code: 500,
      message: '申诉失败',
      data: null
    });
  }
};