// routes/admin.js - 管理员路由
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// 所有管理员路由都需要认证和admin角色
router.use(authMiddleware);
router.use(requireRole(['admin']));

// 1. 获取待审核的用户注册列表
router.get('/pending-users', async (req, res) => {
  try {
    const { company_id } = req.user;
    const query = `
      SELECT u.id, u.username, u.phone, u.role, u.status, u.created_at,
             c.company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.company_id = ? AND u.status = 'pending'
      ORDER BY u.created_at DESC
    `;
    
    const [users] = await pool.query(query, [company_id]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: users 
    });
  } catch (error) {
    console.error('获取待审核用户失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取待审核用户失败',
      data: null 
    });
  }
});

// 2. 审核用户注册
router.post('/audit-user', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { user_id, status, remark } = req.body;
    const admin_id = req.user.id;
    
    await connection.beginTransaction();
    
    // 更新用户状态
    await connection.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, user_id]
    );
    
    // 记录操作日志
    await connection.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'audit_user', 'user', '1', ?)`,
      [admin_id, user_id, JSON.stringify({ status, remark })]
    );
    
    await connection.commit();
    res.json({ 
      code: 200,
      message: '审核完成',
      data: null 
    });
  } catch (error) {
    await connection.rollback();
    console.error('审核用户失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '审核用户失败',
      data: null 
    });
  } finally {
    connection.release();
  }
});

// 3. 获取公司所有员工打卡记录
router.get('/checkin-records', async (req, res) => {
  try {
    const { company_id } = req.user;
    const { start_date, end_date, user_id, location_id, status } = req.query;
    
    let query = `
      SELECT cr.*, u.username, u.phone, cl.location_name, p.project_name
      FROM checkin_records cr
      INNER JOIN users u ON cr.user_id = u.id
      INNER JOIN checkin_locations cl ON cr.location_id = cl.id
      INNER JOIN projects p ON cl.project_id = p.id
      WHERE u.company_id = ?
    `;
    
    const params = [company_id];
    
    if (start_date && end_date) {
      query += ' AND DATE(cr.checkin_time) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    if (user_id) {
      query += ' AND cr.user_id = ?';
      params.push(user_id);
    }
    
    if (location_id) {
      query += ' AND cr.location_id = ?';
      params.push(location_id);
    }
    
    if (status) {
      query += ' AND cr.checkin_status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY cr.checkin_time DESC LIMIT 100';
    
    const [records] = await pool.query(query, params);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: records 
    });
  } catch (error) {
    console.error('获取打卡记录失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取打卡记录失败',
      data: null 
    });
  }
});

// 4. 获取异常打卡记录
router.get('/abnormal-records', async (req, res) => {
  try {
    const { company_id } = req.user;
    const query = `
      SELECT cr.*, u.username, u.phone, cl.location_name, p.project_name
      FROM checkin_records cr
      INNER JOIN users u ON cr.user_id = u.id
      INNER JOIN checkin_locations cl ON cr.location_id = cl.id
      INNER JOIN projects p ON cl.project_id = p.id
      WHERE u.company_id = ? 
        AND cr.checkin_status IN ('late', 'early', 'absent', 'abnormal')
      ORDER BY cr.checkin_time DESC
      LIMIT 100
    `;
    
    const [records] = await pool.query(query, [company_id]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: records 
    });
  } catch (error) {
    console.error('获取异常记录失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取异常记录失败',
      data: null 
    });
  }
});

// 5. 获取待审核的补卡申请
router.get('/makeup-applications', async (req, res) => {
  try {
    const { company_id } = req.user;
    const { status = 'pending' } = req.query;
    
    const query = `
      SELECT ma.*, u.username, u.phone, cl.location_name, p.project_name
      FROM makeup_applications ma
      INNER JOIN users u ON ma.user_id = u.id
      INNER JOIN checkin_locations cl ON ma.location_id = cl.id
      INNER JOIN projects p ON cl.project_id = p.id
      WHERE u.company_id = ? AND ma.status = ?
      ORDER BY ma.created_at DESC
    `;
    
    const [applications] = await pool.query(query, [company_id, status]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: applications 
    });
  } catch (error) {
    console.error('获取补卡申请失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取补卡申请失败',
      data: null 
    });
  }
});

// 6. 审批补卡申请
router.post('/audit-makeup', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { application_id, status, remark } = req.body;
    const admin_id = req.user.id;
    
    await connection.beginTransaction();
    
    // 更新补卡申请状态
    await connection.query(
      `UPDATE makeup_applications 
       SET status = ?, approver_id = ?, approve_time = NOW(), approve_remark = ?
       WHERE id = ?`,
      [status, admin_id, remark, application_id]
    );
    
    // 如果批准，插入打卡记录
    if (status === 'approved') {
      const [application] = await connection.query(
        'SELECT * FROM makeup_applications WHERE id = ?',
        [application_id]
      );
      
      if (application[0]) {
        const app = application[0];
        const checkinTime = app.makeup_type === 'in' 
          ? `${app.makeup_date} 09:00:00`
          : `${app.makeup_date} 18:00:00`;
        
        await connection.query(
          `INSERT INTO checkin_records 
           (user_id, location_id, checkin_type, checkin_time, longitude, latitude, 
            checkin_status, remark)
           VALUES (?, ?, ?, ?, 0, 0, 'normal', ?)`,
          [app.user_id, app.location_id, app.makeup_type, checkinTime, '补卡记录']
        );
      }
    }
    
    // 记录操作日志
    await connection.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'audit_makeup', 'makeup_application', ?, ?)`,
      [admin_id, application_id, JSON.stringify({ status, remark })]
    );
    
    await connection.commit();
    res.json({ 
      code: 200,
      message: '审批完成',
      data: null 
    });
  } catch (error) {
    await connection.rollback();
    console.error('审批补卡失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '审批补卡失败',
      data: null 
    });
  } finally {
    connection.release();
  }
});

// 7. 获取打卡地点列表
router.get('/checkin-locations', async (req, res) => {
  try {
    const { company_id } = req.user;
    const query = `
      SELECT cl.*, p.project_name, p.general_unit
      FROM checkin_locations cl
      INNER JOIN projects p ON cl.project_id = p.id
      INNER JOIN users u ON p.manager_id = u.id
      WHERE u.company_id = ?
      ORDER BY p.project_name, cl.location_name
    `;
    
    const [locations] = await pool.query(query, [company_id]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: locations 
    });
  } catch (error) {
    console.error('获取打卡地点失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取打卡地点失败',
      data: null 
    });
  }
});

// 8. 创建打卡地点
router.post('/checkin-location', async (req, res) => {
  try {
    const {
      project_id,
      location_name,
      longitude,
      latitude,
      work_start_time,
      work_end_time,
      checkin_range,
      abnormal_threshold
    } = req.body;
    
    const admin_id = req.user.id;
    
    const [result] = await pool.query(
      `INSERT INTO checkin_locations 
       (project_id, location_name, longitude, latitude, work_start_time, 
        work_end_time, checkin_range, abnormal_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, location_name, longitude, latitude, work_start_time,
       work_end_time, checkin_range || 200, abnormal_threshold || 30]
    );
    
    // 记录操作日志
    await pool.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'create_location', 'checkin_location', ?, ?)`,
      [admin_id, result.insertId, JSON.stringify(req.body)]
    );
    
    res.json({ 
      code: 200,
      message: '创建成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('创建打卡地点失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '创建打卡地点失败',
      data: null 
    });
  }
});

// 9. 更新打卡地点
router.put('/checkin-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      location_name,
      longitude,
      latitude,
      work_start_time,
      work_end_time,
      checkin_range,
      abnormal_threshold,
      status
    } = req.body;
    
    const admin_id = req.user.id;
    
    await pool.query(
      `UPDATE checkin_locations 
       SET location_name = ?, longitude = ?, latitude = ?, 
           work_start_time = ?, work_end_time = ?, 
           checkin_range = ?, abnormal_threshold = ?, status = ?
       WHERE id = ?`,
      [location_name, longitude, latitude, work_start_time, work_end_time,
       checkin_range, abnormal_threshold, status, id]
    );
    
    // 记录操作日志
    await pool.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'update_location', 'checkin_location', ?, ?)`,
      [admin_id, id, JSON.stringify(req.body)]
    );
    
    res.json({ 
      code: 200,
      message: '更新成功',
      data: null 
    });
  } catch (error) {
    console.error('更新打卡地点失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '更新打卡地点失败',
      data: null 
    });
  }
});

// 10. 获取项目列表
router.get('/projects', async (req, res) => {
  try {
    const { company_id } = req.user;
    const query = `
      SELECT p.*, u.username as manager_name
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE u.company_id = ?
      ORDER BY p.project_name
    `;
    
    const [projects] = await pool.query(query, [company_id]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: projects 
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取项目列表失败',
      data: null 
    });
  }
});

// 11. 获取统计数据
router.get('/statistics', async (req, res) => {
  try {
    const { company_id } = req.user;
    const today = new Date().toISOString().split('T')[0];
    
    // 待审核用户数
    const [pendingUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND status = "pending"',
      [company_id]
    );
    
    // 待审核补卡数
    const [pendingMakeup] = await pool.query(
      `SELECT COUNT(*) as count FROM makeup_applications ma
       INNER JOIN users u ON ma.user_id = u.id
       WHERE u.company_id = ? AND ma.status = "pending"`,
      [company_id]
    );
    
    // 今日异常打卡数
    const [abnormalToday] = await pool.query(
      `SELECT COUNT(*) as count FROM checkin_records cr
       INNER JOIN users u ON cr.user_id = u.id
       WHERE u.company_id = ? AND DATE(cr.checkin_time) = ?
       AND cr.checkin_status IN ('late', 'early', 'absent', 'abnormal')`,
      [company_id, today]
    );
    
    // 总员工数
    const [totalUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND status = "approved"',
      [company_id]
    );
    
    // 今日打卡人数
    const [todayCheckins] = await pool.query(
      `SELECT COUNT(DISTINCT cr.user_id) as count 
       FROM checkin_records cr
       INNER JOIN users u ON cr.user_id = u.id
       WHERE u.company_id = ? AND DATE(cr.checkin_time) = ?`,
      [company_id, today]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        pendingUsers: pendingUsers[0].count,
        pendingMakeup: pendingMakeup[0].count,
        abnormalToday: abnormalToday[0].count,
        totalUsers: totalUsers[0].count,
        todayCheckins: todayCheckins[0].count
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取统计数据失败',
      data: null 
    });
  }
});

// 12. 获取所有用户列表
router.get('/users', async (req, res) => {
  try {
    const { company_id } = req.user;
    const [users] = await pool.query(
      `SELECT id, username, phone, company_id, role, status, created_at 
       FROM users 
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [company_id]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 13. 更新用户状态
router.put('/user/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const admin_id = req.user.id;
    
    if (!['approved', 'pending', 'disabled'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '状态值无效',
        data: null
      });
    }
    
    await pool.query(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    
    // 记录操作日志
    await pool.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'update_user_status', 'user', ?, ?)`,
      [admin_id, id, JSON.stringify({ status })]
    );
    
    res.json({
      code: 200,
      message: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
});

// 14. 获取请假申请列表（扩展功能）
router.get('/leave-applications', async (req, res) => {
  try {
    const { company_id } = req.user;
    const { status = 'pending' } = req.query;
    
    const query = `
      SELECT la.*, u.username, u.phone, lt.type_name
      FROM leave_applications la
      INNER JOIN users u ON la.user_id = u.id
      INNER JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE u.company_id = ? AND la.status = ?
      ORDER BY la.created_at DESC
    `;
    
    const [applications] = await pool.query(query, [company_id, status]);
    res.json({ 
      code: 200,
      message: '获取成功',
      data: applications 
    });
  } catch (error) {
    console.error('获取请假申请失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '获取请假申请失败',
      data: null 
    });
  }
});

// 15. 审批请假申请（扩展功能）
router.post('/audit-leave', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { application_id, status, remark } = req.body;
    const admin_id = req.user.id;
    
    await connection.beginTransaction();
    
    // 更新请假申请状态
    await connection.query(
      `UPDATE leave_applications 
       SET status = ?, approver_id = ?, approve_time = NOW(), approve_remark = ?
       WHERE id = ?`,
      [status, admin_id, remark, application_id]
    );
    
    // 记录操作日志
    await connection.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, 'audit_leave', 'leave_application', ?, ?)`,
      [admin_id, application_id, JSON.stringify({ status, remark })]
    );
    
    await connection.commit();
    res.json({ 
      code: 200,
      message: '审批完成',
      data: null 
    });
  } catch (error) {
    await connection.rollback();
    console.error('审批请假失败:', error);
    res.status(500).json({ 
      code: 500,
      message: '审批请假失败',
      data: null 
    });
  } finally {
    connection.release();
  }
});

module.exports = router;