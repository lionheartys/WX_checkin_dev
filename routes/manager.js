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
    const [todayCheckins] = await pool.query(
      `SELECT COUNT(DISTINCT cr.user_id) as count
       FROM checkin_records cr
       INNER JOIN checkin_locations cl ON cr.location_id = cl.id
       WHERE cl.project_id IN (?) AND DATE(cr.checkin_time) = ?`,
      [projectIds, today]
    );

    // 3. 今日异常打卡数
    const [abnormalToday] = await pool.query(
      `SELECT COUNT(*) as count
       FROM checkin_records cr
       INNER JOIN checkin_locations cl ON cr.location_id = cl.id
       WHERE cl.project_id IN (?) AND DATE(cr.checkin_time) = ?
         AND cr.checkin_status IN ('late','early','absent','abnormal')`,
      [projectIds, today]
    );

    // 4. 待审核补卡
    const [pendingMakeup] = await pool.query(
      `SELECT COUNT(*) as count
       FROM makeup_applications ma
       INNER JOIN checkin_locations cl ON ma.location_id = cl.id
       WHERE cl.project_id IN (?) AND ma.status = 'pending'`,
      [projectIds]
    );

    // 5. 待审核请假
    const [pendingLeave] = await pool.query(
      `SELECT COUNT(*) as count
       FROM leave_applications la
       INNER JOIN project_entries pe ON la.user_id = pe.user_id
       WHERE pe.project_id IN (?) AND la.status = 'pending'`,
      [projectIds]
    );

    // 6. 待审批入场申请
    const [pendingEntry] = await pool.query(
      `SELECT COUNT(*) as count
       FROM project_entries pe
       WHERE pe.project_id IN (?) AND pe.status = 'pending'`,
      [projectIds]
    );

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        todayCheckins: todayCheckins[0].count,
        abnormalToday: abnormalToday[0].count,
        pendingMakeup: pendingMakeup[0].count,
        pendingLeave: pendingLeave[0].count,
        pendingEntry: pendingEntry[0].count
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


module.exports = router;
