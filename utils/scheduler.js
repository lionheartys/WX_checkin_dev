// utils/scheduler.js - 定时任务
const cron = require('node-cron');
const pool = require('../config/database');
const moment = require('moment');

// 每天凌晨1点检查缺勤情况
cron.schedule('0 1 * * *', async () => {
  console.log('开始检查昨日缺勤情况...');
  
  try {
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
    
    // 获取所有已入场的用户和打卡地
    const [entries] = await pool.query(
      `SELECT pe.*, cl.*, u.username 
       FROM project_entries pe
       JOIN checkin_locations cl ON pe.location_id = cl.id
       JOIN users u ON pe.user_id = u.id
       WHERE pe.entry_type = 'entry' AND pe.status = 'approved'`
    );
    
    for (const entry of entries) {
      // 检查上班打卡
      const [inRecords] = await pool.query(
        `SELECT * FROM checkin_records 
         WHERE user_id = ? AND location_id = ? AND checkin_type = 'in' 
         AND DATE(checkin_time) = ?`,
        [entry.user_id, entry.location_id, yesterday]
      );
      
      if (inRecords.length === 0) {
        // 创建缺勤记录
        await pool.query(
          `INSERT INTO checkin_records 
           (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
            checkin_status, abnormal_reason) 
           VALUES (?, ?, 'in', ?, ?, ?, 'absent', '未打卡')`,
          [entry.user_id, entry.location_id, 
           yesterday + ' ' + entry.work_start_time,
           entry.longitude, entry.latitude]
        );
      }
      
      // 检查下班打卡
      const [outRecords] = await pool.query(
        `SELECT * FROM checkin_records 
         WHERE user_id = ? AND location_id = ? AND checkin_type = 'out' 
         AND DATE(checkin_time) = ?`,
        [entry.user_id, entry.location_id, yesterday]
      );
      
      if (outRecords.length === 0) {
        // 创建缺勤记录
        await pool.query(
          `INSERT INTO checkin_records 
           (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
            checkin_status, abnormal_reason) 
           VALUES (?, ?, 'out', ?, ?, ?, 'absent', '未打卡')`,
          [entry.user_id, entry.location_id,
           yesterday + ' ' + entry.work_end_time,
           entry.longitude, entry.latitude]
        );
      }
    }
    
    console.log('缺勤检查完成');
  } catch (error) {
    console.error('缺勤检查失败:', error);
  }
});

module.exports = {
  startScheduler: () => {
    console.log('定时任务已启动');
  }
};