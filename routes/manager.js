// routes/manager.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// 所有项目管理员路由都需要认证和project_manager角色
router.use(authMiddleware);
router.use(requireRole(['project_manager']));

// 工具函数：检查是否有权限管理某项目
async function checkProjectPermission(userId, projectId) {
  const [rows] = await pool.query(
    'SELECT id FROM projects WHERE id = ? AND manager_id = ?',
    [projectId, userId]
  );
  return rows.length > 0;
}

/* -------------------- 项目 CRUD -------------------- */


// 1. 获取自己负责的项目列表
router.get('/projects', async (req, res) => {
  try {
    const managerId = req.user.id;
    // 前端传来的分页参数，可选
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    // 查询该 manager 的所有项目
    const [allProjects] = await pool.query(
      `SELECT * FROM projects WHERE manager_id = ? ORDER BY created_at DESC`,
      [managerId]
    );

    const total = allProjects.length;

    // 根据 page 和 pageSize 做分页
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const list = allProjects.slice(startIndex, endIndex);

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list,
        total
      }
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});


// 2. 创建项目（自动设置自己为项目管理员）
router.post('/project', async (req, res) => {
  try {
    const { project_name, general_unit, status = 1 } = req.body;
    const managerId = req.user.id;
    const managerName = req.user.username;

    // 检查重名
    const [existing] = await pool.query(
      'SELECT id FROM projects WHERE project_name = ?',
      [project_name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ code: 400, message: '项目名称已存在' });
    }

    const [result] = await pool.query(
      `INSERT INTO projects (project_name, general_unit, manager_id, manager_name, status)
       VALUES (?, ?, ?, ?, ?)`,
      [project_name, general_unit, managerId, managerName, status]
    );

    res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
});

// 3. 更新自己项目
router.put('/project/:id', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { id } = req.params;
    const { project_name, general_unit, status } = req.body;

    if (!(await checkProjectPermission(managerId, id))) {
      return res.status(403).json({ code: 403, message: '无权更新该项目' });
    }

    await pool.query(
      `UPDATE projects SET project_name = ?, general_unit = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [project_name, general_unit, status, id]
    );

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

// 4. 删除自己项目
router.delete('/project/:id', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { id } = req.params;

    if (!(await checkProjectPermission(managerId, id))) {
      return res.status(403).json({ code: 403, message: '无权删除该项目' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

/* -------------------- 打卡地 CRUD -------------------- */

// 5. 获取某项目的打卡地
router.get('/project/:id/checkin-locations', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { id } = req.params;

    if (!(await checkProjectPermission(managerId, id))) {
      return res.status(403).json({ code: 403, message: '无权访问该项目' });
    }

    const [locations] = await pool.query(
      `SELECT * FROM checkin_locations WHERE project_id = ? ORDER BY created_at DESC`,
      [id]
    );

    res.json({ code: 200, message: '获取成功', data: locations });
  } catch (error) {
    console.error('获取打卡地失败:', error);
    res.status(500).json({ code: 500, message: '获取失败' });
  }
});

// 6. 添加打卡地
router.post('/project/:id/checkin-location', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { id } = req.params;
    const {
      location_name,
      longitude,
      latitude,
      work_start_time,
      work_end_time,
      checkin_range = 200,
      abnormal_threshold = 30
    } = req.body;

    if (!(await checkProjectPermission(managerId, id))) {
      return res.status(403).json({ code: 403, message: '无权添加该项目的打卡地' });
    }

    const [result] = await pool.query(
      `INSERT INTO checkin_locations 
       (project_id, location_name, longitude, latitude, work_start_time, work_end_time, checkin_range, abnormal_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, location_name, longitude, latitude, work_start_time, work_end_time, checkin_range, abnormal_threshold]
    );

    res.json({ code: 200, message: '添加成功', data: { id: result.insertId } });
  } catch (error) {
    console.error('添加打卡地失败:', error);
    res.status(500).json({ code: 500, message: '添加失败' });
  }
});

// 7. 更新打卡地
router.put('/checkin-location/:id', async (req, res) => {
  try {
    const managerId = req.user.id;
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

    // 检查权限
    const [rows] = await pool.query(
      `SELECT project_id FROM checkin_locations WHERE id = ?`,
      [id]
    );
    if (!rows.length || !(await checkProjectPermission(managerId, rows[0].project_id))) {
      return res.status(403).json({ code: 403, message: '无权更新该打卡地' });
    }

    await pool.query(
      `UPDATE checkin_locations 
       SET location_name = ?, longitude = ?, latitude = ?, work_start_time = ?, work_end_time = ?, 
           checkin_range = ?, abnormal_threshold = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [location_name, longitude, latitude, work_start_time, work_end_time, checkin_range, abnormal_threshold, status, id]
    );

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    console.error('更新打卡地失败:', error);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

// 8. 删除打卡地
router.delete('/checkin-location/:id', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { id } = req.params;

    // 检查权限
    const [rows] = await pool.query(
      `SELECT project_id FROM checkin_locations WHERE id = ?`,
      [id]
    );
    if (!rows.length || !(await checkProjectPermission(managerId, rows[0].project_id))) {
      return res.status(403).json({ code: 403, message: '无权删除该打卡地' });
    }

    await pool.query('DELETE FROM checkin_locations WHERE id = ?', [id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    console.error('删除打卡地失败:', error);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

// 9. 统计数据（仅限当前项目）
router.get('/statistics', async (req, res) => {
  try {
    const managerId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // 1. 获取该项目管理员负责的项目 id 列表
    const [projects] = await pool.query(
      'SELECT id FROM projects WHERE manager_id = ?',
      [managerId]
    );
    if (projects.length === 0) {
      return res.json({
        code: 200,
        message: '无项目数据',
        data: {
          todayCheckins: 0,
          abnormalToday: 0,
          pendingMakeup: 0,
          pendingLeave: 0,
          pendingEntry: 0
        }
      });
    }
    const projectIds = projects.map(p => p.id);

    // 2. 今日打卡人数
    const [todayCheckinsRows] = await pool.query(
      `SELECT COUNT(DISTINCT cr.user_id) as count
       FROM checkin_records cr
       INNER JOIN checkin_locations cl ON cr.location_id = cl.id
       WHERE cl.project_id IN (?) AND DATE(cr.checkin_time) = ?`,
      [projectIds, today]
    );

    // 3. 今日异常打卡数
    const [abnormalTodayRows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM checkin_records cr
       INNER JOIN checkin_locations cl ON cr.location_id = cl.id
       WHERE cl.project_id IN (?) AND DATE(cr.checkin_time) = ?
         AND cr.checkin_status IN ('late','early','absent','abnormal')`,
      [projectIds, today]
    );

    // 4. 待审核补卡
    const [pendingMakeupRows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM makeup_applications ma
       INNER JOIN checkin_locations cl ON ma.location_id = cl.id
       WHERE cl.project_id IN (?) AND ma.status = 'pending'`,
      [projectIds]
    );

    // 5. 待审核请假
    const [pendingLeaveRows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM leave_applications la
       INNER JOIN project_entries pe ON la.user_id = pe.user_id
       WHERE pe.project_id IN (?) AND la.status = 'pending'`,
      [projectIds]
    );

    // 6. 待审批入场申请
    const [pendingEntryRows] = await pool.query(
      `SELECT COUNT(*) as count
       FROM project_entries pe
       WHERE pe.project_id IN (?) AND pe.status = 'pending'`,
      [projectIds]
    );

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        todayCheckins: todayCheckinsRows?.[0]?.count || 0,
        abnormalToday: abnormalTodayRows?.[0]?.count || 0,
        pendingMakeup: pendingMakeupRows?.[0]?.count || 0,
        pendingLeave: pendingLeaveRows?.[0]?.count || 0,
        pendingEntry: pendingEntryRows?.[0]?.count || 0
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

// 获取补卡申请列表（只查自己项目的）
router.get('/makeup-applications', async (req, res) => {
  try {
    const managerId = req.user.id;
    const { status = 'pending' } = req.query;

    // 先查项目 ID
    const [projects] = await pool.query(
      'SELECT id FROM projects WHERE manager_id = ?',
      [managerId]
    );
    if (projects.length === 0) {
      return res.json({ code: 200, message: '无项目数据', data: [] });
    }
    const projectIds = projects.map(p => p.id);

    // 查补卡申请
    const query = `
      SELECT ma.*, u.username, u.phone, cl.location_name, p.project_name
      FROM makeup_applications ma
      INNER JOIN users u ON ma.user_id = u.id
      INNER JOIN checkin_locations cl ON ma.location_id = cl.id
      INNER JOIN projects p ON cl.project_id = p.id
      WHERE cl.project_id IN (?) AND ma.status = ?
      ORDER BY ma.created_at DESC
    `;
    const [applications] = await pool.query(query, [projectIds, status]);

    res.json({
      code: 200,
      message: '获取成功',
      data: applications
    });
  } catch (error) {
    console.error('获取补卡申请失败:', error);
    res.status(500).json({ code: 500, message: '获取补卡申请失败', data: null });
  }
});

// 审批补卡申请
router.post('/audit-makeup', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const managerId = req.user.id;
    const { application_id, status, remark } = req.body;

    await connection.beginTransaction();

    // 检查申请是否属于自己项目
    const [apps] = await connection.query(
      `SELECT ma.*, cl.project_id 
       FROM makeup_applications ma
       INNER JOIN checkin_locations cl ON ma.location_id = cl.id
       WHERE ma.id = ?`,
      [application_id]
    );
    if (!apps.length) {
      await connection.rollback();
      return res.status(404).json({ code: 404, message: '申请不存在' });
    }
    const app = apps[0];

    const [checkProject] = await connection.query(
      'SELECT id FROM projects WHERE id = ? AND manager_id = ?',
      [app.project_id, managerId]
    );
    if (!checkProject.length) {
      await connection.rollback();
      return res.status(403).json({ code: 403, message: '无权审批该申请' });
    }

    // 更新申请状态
    await connection.query(
      `UPDATE makeup_applications 
       SET status = ?, approver_id = ?, approve_time = NOW(), approve_remark = ?
       WHERE id = ?`,
      [status, managerId, remark, application_id]
    );

    // 如果批准，插入补卡打卡记录
    if (status === 'approved') {
      const makeupDate = new Date(app.makeup_date);
      const year = makeupDate.getFullYear();
      const month = String(makeupDate.getMonth() + 1).padStart(2, '0');
      const day = String(makeupDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      const checkinTime = app.makeup_type === 'in'
        ? `${formattedDate} 09:00:00`
        : `${formattedDate} 18:00:00`;

      await connection.query(
        `INSERT INTO checkin_records 
         (user_id, location_id, checkin_type, checkin_time, longitude, latitude, checkin_status, remark)
         VALUES (?, ?, ?, ?, 0, 0, 'normal', ?)`,
        [app.user_id, app.location_id, app.makeup_type, checkinTime, '补卡记录']
      );
    }

    await connection.commit();
    res.json({ code: 200, message: '审批完成' });
  } catch (error) {
    await connection.rollback();
    console.error('审批补卡失败:', error);
    res.status(500).json({ code: 500, message: '审批补卡失败' });
  } finally {
    connection.release();
  }
});

// 获取项目管理员的入场申请列表
router.get('/entry-applications', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const managerId = req.user.id; // 当前登录用户ID（项目管理员）

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
      FROM project_entries AS pe
      LEFT JOIN users u ON pe.user_id = u.id
      LEFT JOIN projects p ON pe.project_id = p.id
      LEFT JOIN checkin_locations cl ON pe.location_id = cl.id
      LEFT JOIN users approver ON pe.approver_id = approver.id
      WHERE p.manager_id = ?   -- 限制只能看到自己管理的项目
    `;

    const params = [managerId];

    if (status !== 'all') {
      query += ' AND pe.status = ?';
      params.push(status);
    }

    query += ' ORDER BY pe.user_id, pe.project_id, pe.created_at DESC';

    const [applications] = await pool.query(query, params);

    // 分组
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

      groupedData[app.user_id].projects[app.project_id].applications.push(app);
    });

    const result = Object.values(groupedData).map(user => ({
      ...user,
      projects: Object.values(user.projects)
    }));

    res.json({ code: 200, message: '获取成功', data: result });
  } catch (error) {
    console.error('获取项目入场申请列表失败:', error);
    res.status(500).json({ code: 500, message: '获取失败', data: null });
  }
});


// 审批项目入场申请
router.post('/entry-applications/:id/approve', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { status, approve_remark } = req.body;
    const approver_id = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ code: 400, message: '无效的审批状态' });
    }

    await connection.beginTransaction();

    // 查询申请 + 验证项目归属
    const [applications] = await connection.query(
      `SELECT pe.*, p.manager_id 
       FROM project_entries pe
       JOIN projects p ON pe.project_id = p.id
       WHERE pe.id = ? AND pe.status = 'pending'`,
      [id]
    );

    if (applications.length === 0) {
      await connection.rollback();
      return res.status(404).json({ code: 404, message: '申请不存在或已处理' });
    }

    const application = applications[0];

    if (application.manager_id !== approver_id) {
      await connection.rollback();
      return res.status(403).json({ code: 403, message: '无权限审批该项目申请' });
    }

    // 更新审批状态
    await connection.query(
      `UPDATE project_entries 
       SET status=?, approver_id=?, approve_time=NOW(), approve_remark=? 
       WHERE id=?`,
      [status, approver_id, approve_remark, id]
    );

    await connection.commit();
    res.json({ code: 200, message: `${status === 'approved' ? '批准' : '拒绝'}成功` });
  } catch (error) {
    await connection.rollback();
    console.error('审批项目入场申请失败:', error);
    res.status(500).json({ code: 500, message: '审批失败', error: error.message });
  } finally {
    connection.release();
  }
});


// 项目管理员统计信息
router.get('/entry-applications/statistics', async (req, res) => {
  try {
    const managerId = req.user.id;

    const [stats] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN pe.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN pe.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN pe.status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(*) as total_count
      FROM project_entries pe
      JOIN projects p ON pe.project_id = p.id
      WHERE p.manager_id = ?
    `, [managerId]);

    res.json({ code: 200, message: '获取成功', data: stats[0] });
  } catch (error) {
    console.error('获取项目入场申请统计失败:', error);
    res.status(500).json({ code: 500, message: '获取失败', data: null });
  }
});


module.exports = router;
