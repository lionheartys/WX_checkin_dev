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
        
        // 格式化日期为 YYYY-MM-DD 格式
        const makeupDate = new Date(app.makeup_date);
        const year = makeupDate.getFullYear();
        const month = String(makeupDate.getMonth() + 1).padStart(2, '0');
        const day = String(makeupDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        // 构建正确格式的打卡时间
        const checkinTime = app.makeup_type === 'in' 
          ? `${formattedDate} 09:00:00`
          : `${formattedDate} 18:00:00`;
        
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

// 16. 获取待审批数量统计（包括请假）
router.get('/pending-counts', async (req, res) => {
  try {
    const { company_id } = req.user;
    
    // 获取待审核用户数
    const [users] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE company_id = ? AND status = "pending"',
      [company_id]
    );
    
    // 获取待审核补卡数
    const [makeup] = await pool.query(
      `SELECT COUNT(*) as count FROM makeup_applications ma
       INNER JOIN users u ON ma.user_id = u.id
       WHERE u.company_id = ? AND ma.status = 'pending'`,
      [company_id]
    );
    
    // 获取待审核请假数
    const [leave] = await pool.query(
      `SELECT COUNT(*) as count FROM leave_applications la
       INNER JOIN users u ON la.user_id = u.id
       WHERE u.company_id = ? AND la.status = 'pending'`,
      [company_id]
    );
    
    res.json({
      code: 200,
      data: {
        pendingUsers: users[0].count,
        pendingMakeup: makeup[0].count,
        pendingLeave: leave[0].count
      }
    });
  } catch (error) {
    console.error('获取待审批数量失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
});

// 17. 批量审批请假（可选）
router.post('/batch-audit-leave', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { application_ids, status, remark } = req.body;
    const admin_id = req.user.id;
    
    await connection.beginTransaction();
    
    let successCount = 0;
    for (const id of application_ids) {
      try {
        await connection.query(
          `UPDATE leave_applications 
           SET status = ?, approver_id = ?, approve_time = NOW(), approve_remark = ?
           WHERE id = ?`,
          [status, admin_id, remark || '批量审批', id]
        );
        successCount++;
      } catch (err) {
        console.error(`审批ID ${id} 失败:`, err);
      }
    }
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: `批量审批完成，成功处理 ${successCount}/${application_ids.length} 个申请`,
      data: { successCount }
    });
  } catch (error) {
    await connection.rollback();
    console.error('批量审批失败:', error);
    res.status(500).json({
      code: 500,
      message: '批量审批失败'
    });
  } finally {
    connection.release();
  }
});




// 后端查询打卡地列表
router.get('/checkin-locations', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT cl.*, p.project_name 
      FROM checkin_locations cl
      LEFT JOIN projects p ON cl.project_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status !== undefined) {
      query += ' AND cl.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY cl.created_at DESC';
    
    const [locations] = await pool.query(query, params);

    // 确认是否有数据
    // console.log('查询到的打卡地数据:', locations);
    
    res.json({
      code: 200,
      message: '获取成功',
      data: locations
    });
  } catch (error) {
    console.error('获取打卡地列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});



// 19. 添加打卡地
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
    
    const [result] = await pool.query(
      `INSERT INTO checkin_locations 
       (project_id, location_name, longitude, latitude, work_start_time, 
        work_end_time, checkin_range, abnormal_threshold) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, location_name, longitude, latitude, work_start_time,
       work_end_time, checkin_range || 200, abnormal_threshold || 30]
    );
    
    res.json({
      code: 200,
      message: '添加成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('添加打卡地失败:', error);
    res.status(500).json({
      code: 500,
      message: '添加失败',
      data: null
    });
  }
});

// 20. 更新打卡地
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
      abnormal_threshold
    } = req.body;
    
    await pool.query(
      `UPDATE checkin_locations 
       SET location_name = ?, longitude = ?, latitude = ?, 
           work_start_time = ?, work_end_time = ?, 
           checkin_range = ?, abnormal_threshold = ?
       WHERE id = ?`,
      [location_name, longitude, latitude, work_start_time,
       work_end_time, checkin_range, abnormal_threshold, id]
    );
    
    res.json({
      code: 200,
      message: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新打卡地失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
});

// 21. 启用/禁用打卡地
router.put('/checkin-location/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.query(
      'UPDATE checkin_locations SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      code: 200,
      message: status === 1 ? '启用成功' : '禁用成功',
      data: null
    });
  } catch (error) {
    console.error('更新打卡地状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '操作失败',
      data: null
    });
  }
});

// 22. 删除打卡地
router.delete('/checkin-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM checkin_locations WHERE id = ?', [id]);
    
    res.json({
      code: 200,
      message: '删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除打卡地失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除失败',
      data: null
    });
  }
});

// 23. 获取项目列表（用于选择）
router.get('/projects', async (req, res) => {
  try {
    const [projects] = await pool.query(
      // 'SELECT id, project_name FROM projects WHERE status = 1'
      'SELECT id, project_name FROM projects'
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: projects
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 24. 获取公司列表
router.get('/companies', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = '1 = 1';
    const params = [];
    
    // 状态筛选
    if (status !== undefined && status !== '') {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    // 关键词搜索
    if (keyword) {
      whereClause += ' AND company_name LIKE ?';
      params.push(`%${keyword}%`);
    }
    
    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM companies WHERE ${whereClause}`,
      params
    );
    
    // 获取列表
    const [companies] = await pool.query(
      `SELECT id, company_name, valid_until, status, created_at, updated_at,
        CASE 
          WHEN valid_until < CURDATE() THEN 'expired'
          WHEN valid_until <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'expiring'
          ELSE 'valid'
        END as validity_status
       FROM companies 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list: companies,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取公司列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 25. 添加公司
router.post('/company', async (req, res) => {
  try {
    const { company_name, valid_until, status = 1 } = req.body;
    
    // 检查公司名称是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM companies WHERE company_name = ?',
      [company_name]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '公司名称已存在',
        data: null
      });
    }
    
    const [result] = await pool.query(
      'INSERT INTO companies (company_name, valid_until, status) VALUES (?, ?, ?)',
      [company_name, valid_until, status]
    );
    
    res.json({
      code: 200,
      message: '添加成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('添加公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '添加失败',
      data: null
    });
  }
});

// 26. 更新公司信息
router.put('/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, valid_until, status } = req.body;
    
    // 检查公司是否存在
    const [company] = await pool.query(
      'SELECT id FROM companies WHERE id = ?',
      [id]
    );
    
    if (company.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    // 检查新名称是否与其他公司重复
    const [existing] = await pool.query(
      'SELECT id FROM companies WHERE company_name = ? AND id != ?',
      [company_name, id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '公司名称已存在',
        data: null
      });
    }
    
    await pool.query(
      'UPDATE companies SET company_name = ?, valid_until = ?, status = ? WHERE id = ?',
      [company_name, valid_until, status, id]
    );
    
    res.json({
      code: 200,
      message: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
});

// 27. 启用/禁用公司
router.put('/company/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 检查公司是否存在
    const [company] = await pool.query(
      'SELECT id, company_name FROM companies WHERE id = ?',
      [id]
    );
    
    if (company.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    await pool.query(
      'UPDATE companies SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      code: 200,
      message: status === 1 ? '启用成功' : '禁用成功',
      data: null
    });
  } catch (error) {
    console.error('更新公司状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '操作失败',
      data: null
    });
  }
});

// 28. 删除公司
router.delete('/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查公司是否存在
    const [company] = await pool.query(
      'SELECT id, company_name FROM companies WHERE id = ?',
      [id]
    );
    
    if (company.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    // 检查是否有关联数据（如果有用户表关联的话）
    // const [users] = await pool.query(
    //   'SELECT COUNT(*) as count FROM users WHERE company_id = ?',
    //   [id]
    // );
    // 
    // if (users[0].count > 0) {
    //   return res.status(400).json({
    //     code: 400,
    //     message: '该公司下还有用户，无法删除',
    //     data: null
    //   });
    // }
    
    await pool.query('DELETE FROM companies WHERE id = ?', [id]);
    
    res.json({
      code: 200,
      message: '删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除失败',
      data: null
    });
  }
});

// 29. 获取单个公司详情
router.get('/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [company] = await pool.query(
      `SELECT id, company_name, valid_until, status, created_at, updated_at,
        CASE 
          WHEN valid_until < CURDATE() THEN 'expired'
          WHEN valid_until <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'expiring'
          ELSE 'valid'
        END as validity_status
       FROM companies WHERE id = ?`,
      [id]
    );
    
    if (company.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: '获取成功',
      data: company[0]
    });
  } catch (error) {
    console.error('获取公司详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 30. 批量更新公司有效期
router.put('/companies/batch-update-validity', async (req, res) => {
  try {
    const { company_ids, valid_until } = req.body;
    
    if (!company_ids || company_ids.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '请选择要更新的公司',
        data: null
      });
    }
    
    await pool.query(
      'UPDATE companies SET valid_until = ? WHERE id IN (?)',
      [valid_until, company_ids]
    );
    
    res.json({
      code: 200,
      message: '批量更新成功',
      data: null
    });
  } catch (error) {
    console.error('批量更新公司有效期失败:', error);
    res.status(500).json({
      code: 500,
      message: '批量更新失败',
      data: null
    });
  }
});


// 31. 获取项目管理列表（带分页、搜索、筛选）
router.get('/projects-manage', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = '1 = 1';
    const params = [];
    
    // 状态筛选
    if (status !== undefined && status !== '') {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    
    // 关键词搜索（项目名称或总体单位）
    if (keyword) {
      whereClause += ' AND (p.project_name LIKE ? OR p.general_unit LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM projects p WHERE ${whereClause}`,
      params
    );
    
    // 获取列表（包含管理员信息）
    const [projects] = await pool.query(
      `SELECT p.*, u.username as manager_username, u.phone as manager_phone
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list: projects,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 32. 添加项目
router.post('/project', async (req, res) => {
  try {
    const { project_name, general_unit, manager_id, manager_name, status = 1 } = req.body;
    
    // 检查项目名称是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM projects WHERE project_name = ?',
      [project_name]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '项目名称已存在',
        data: null
      });
    }
    
    // 如果提供了manager_id，获取对应的用户姓名
    let finalManagerName = manager_name;
    if (manager_id) {
      const [user] = await pool.query(
        'SELECT username FROM users WHERE id = ?',
        [manager_id]
      );
      if (user.length > 0) {
        finalManagerName = user[0].username;
      }
    }
    
    const [result] = await pool.query(
      'INSERT INTO projects (project_name, general_unit, manager_id, manager_name, status) VALUES (?, ?, ?, ?, ?)',
      [project_name, general_unit, manager_id || null, finalManagerName, status]
    );
    
    res.json({
      code: 200,
      message: '添加成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('添加项目失败:', error);
    res.status(500).json({
      code: 500,
      message: '添加失败',
      data: null
    });
  }
});

// 33. 更新项目信息
router.put('/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, general_unit, manager_id, manager_name, status } = req.body;
    
    // 检查项目是否存在
    const [project] = await pool.query(
      'SELECT id FROM projects WHERE id = ?',
      [id]
    );
    
    if (project.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在',
        data: null
      });
    }
    
    // 检查新名称是否与其他项目重复
    const [existing] = await pool.query(
      'SELECT id FROM projects WHERE project_name = ? AND id != ?',
      [project_name, id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '项目名称已存在',
        data: null
      });
    }
    
    // 如果提供了manager_id，获取对应的用户姓名
    let finalManagerName = manager_name;
    if (manager_id) {
      const [user] = await pool.query(
        'SELECT username FROM users WHERE id = ?',
        [manager_id]
      );
      if (user.length > 0) {
        finalManagerName = user[0].username;
      }
    }
    
    await pool.query(
      'UPDATE projects SET project_name = ?, general_unit = ?, manager_id = ?, manager_name = ?, status = ? WHERE id = ?',
      [project_name, general_unit, manager_id || null, finalManagerName, status, id]
    );
    
    res.json({
      code: 200,
      message: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
});

// 34. 启用/禁用项目
router.put('/project/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 检查项目是否存在
    const [project] = await pool.query(
      'SELECT id, project_name FROM projects WHERE id = ?',
      [id]
    );
    
    if (project.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在',
        data: null
      });
    }
    
    await pool.query(
      'UPDATE projects SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      code: 200,
      message: status === 1 ? '启用成功' : '禁用成功',
      data: null
    });
  } catch (error) {
    console.error('更新项目状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '操作失败',
      data: null
    });
  }
});

// 35. 删除项目
router.delete('/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查项目是否存在
    const [project] = await pool.query(
      'SELECT id, project_name FROM projects WHERE id = ?',
      [id]
    );
    
    if (project.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在',
        data: null
      });
    }
    
    // 检查是否有关联数据（例如打卡记录）
    // 如果有其他表引用此项目，需要检查
    
    await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    
    res.json({
      code: 200,
      message: '删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除失败',
      data: null
    });
  }
});

// 36. 获取单个项目详情（修正版）
router.get('/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [project] = await pool.query(
      `SELECT p.*, u.username as manager_username, u.phone as manager_phone
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (project.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '项目不存在',
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: '获取成功',
      data: project[0]
    });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 37. 获取可用的项目负责人列表（修正版）
router.get('/available-managers', async (req, res) => {
  try {
    // 只获取已审核通过的用户作为可选的项目负责人
    const [users] = await pool.query(
      'SELECT id, username, phone FROM users WHERE status = "approved" ORDER BY username'
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: users
    });
  } catch (error) {
    console.error('获取可用负责人列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 38. 获取所有启用的公司列表（用于项目选择总体单位）
router.get('/companies-select', async (req, res) => {
  try {
    const [companies] = await pool.query(
      'SELECT id, company_name FROM companies WHERE status = 1 ORDER BY company_name'
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: companies
    });
  } catch (error) {
    console.error('获取公司列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 39. 获取项目入场申请列表
router.get('/entry-applications', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let query = `
      SELECT 
        pe.id,
        pe.user_id,
        pe.project_id,
        pe.location_id,
        pe.entry_type,
        pe.apply_reason,
        pe.status,
        pe.approve_time,
        pe.approve_remark,
        pe.expect_leavetime,
        pe.created_at,
        u.username,
        u.phone,
        p.project_name,
        cl.location_name,
        approver.username as approver_name
      FROM project_entries pe
      LEFT JOIN users u ON pe.user_id = u.id
      LEFT JOIN projects p ON pe.project_id = p.id
      LEFT JOIN checkin_locations cl ON pe.location_id = cl.id
      LEFT JOIN users approver ON pe.approver_id = approver.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status !== 'all') {
      query += ' AND pe.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY pe.user_id, pe.project_id, pe.created_at DESC';
    
    const [applications] = await pool.query(query, params);
    
    // 按用户和项目分组
    const groupedData = {};
    applications.forEach(app => {
      if (!groupedData[app.user_id]) {
        groupedData[app.user_id] = {
          user_id: app.user_id,
          username: app.username,
          phone: app.phone,
          projects: {}
        };
      }
      
      if (!groupedData[app.user_id].projects[app.project_id]) {
        groupedData[app.user_id].projects[app.project_id] = {
          project_id: app.project_id,
          project_name: app.project_name,
          applications: []
        };
      }
      
      groupedData[app.user_id].projects[app.project_id].applications.push({
        id: app.id,
        location_id: app.location_id,
        location_name: app.location_name,
        entry_type: app.entry_type,
        apply_reason: app.apply_reason,
        status: app.status,
        approve_time: app.approve_time,
        approve_remark: app.approve_remark,
        approver_name: app.approver_name,
        expect_leavetime: app.expect_leavetime,
        created_at: app.created_at
      });
    });
    
    // 转换为数组格式
    const result = Object.values(groupedData).map(user => ({
      ...user,
      projects: Object.values(user.projects)
    }));
    
    res.json({
      code: 200,
      message: '获取成功',
      data: result
    });
  } catch (error) {
    console.error('获取项目入场申请列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

// 40. 审批项目入场申请
router.post('/entry-applications/:id/approve', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { status, approve_remark } = req.body;
    const approver_id = req.user.id;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的审批状态'
      });
    }
    
    await connection.beginTransaction();
    
    // 检查申请是否存在且待审批
    const [applications] = await connection.query(
      'SELECT * FROM project_entries WHERE id = ? AND status = "pending"',
      [id]
    );
    
    if (applications.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '申请不存在或已处理'
      });
    }
    
    const application = applications[0];
    
    // 更新审批状态
    await connection.query(
      `UPDATE project_entries 
       SET status = ?, 
           approver_id = ?, 
           approve_time = NOW(), 
           approve_remark = ? 
       WHERE id = ?`,
      [status, approver_id, approve_remark, id]
    );
    
    // 如果是批准离场申请，检查预计离场时间并将对应的入场申请设为过期
    if (status === 'approved' && application.entry_type === 'exit') {
      const currentTime = new Date();  // 获取当前时间
      const expectLeaveTime = new Date(application.expect_leavetime);  // 预计离场时间

      // 检查当前时间是否已经达到预计离场时间
      if (currentTime >= expectLeaveTime) {
        // 更新对应的入场申请为 expired
        await connection.query(
          `UPDATE project_entries 
           SET status = 'expired', 
               updated_at = NOW() 
           WHERE user_id = ? 
             AND project_id = ? 
             AND location_id = ? 
             AND entry_type = 'entry' 
             AND status = 'approved'`,
          [application.user_id, application.project_id, application.location_id]
        );
        
        // 记录入场申请过期的操作日志
        await connection.query(
          `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
           VALUES (?, ?, ?, ?, ?)`,
          [
            approver_id,
            'EXPIRE_ENTRY',
            'PROJECT_ENTRY',
            application.user_id,
            JSON.stringify({ 
              reason: 'exit_approved',
              user_id: application.user_id,
              project_id: application.project_id,
              location_id: application.location_id,
              exit_application_id: id
            })
          ]
        );
      } else {
        // 离场时间未到，发送提醒消息（如果需要）
        console.log('预计离场时间尚未到达');
      }
    }
    
    // 记录审批操作日志
    await connection.query(
      `INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail)
       VALUES (?, ?, ?, ?, ?)`,
      [
        approver_id,
        status === 'approved' ? 'APPROVE_ENTRY' : 'REJECT_ENTRY',
        'PROJECT_ENTRY',
        id,
        JSON.stringify({ 
          status, 
          approve_remark,
          entry_type: application.entry_type
        })
      ]
    );
    
    await connection.commit();
    
    res.json({
      code: 200,
      message: `${status === 'approved' ? '批准' : '拒绝'}成功${
        status === 'approved' && application.entry_type === 'exit' ? '，相关入场申请已自动过期' : ''
      }`
    });
  } catch (error) {
    await connection.rollback();
    console.error('审批项目入场申请失败:', error);
    res.status(500).json({
      code: 500,
      message: '审批失败',
      error: error.message
    });
  } finally {
    connection.release();
  }
});


// 41. 获取项目入场申请统计
router.get('/entry-applications/statistics', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(*) as total_count
      FROM project_entries
    `);
    
    res.json({
      code: 200,
      message: '获取成功',
      data: stats[0]
    });
  } catch (error) {
    console.error('获取项目入场申请统计失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
});

module.exports = router;