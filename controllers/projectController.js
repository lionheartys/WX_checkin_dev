// controllers/projectController.js - 项目管理控制器
const pool = require('../config/database');
const { validationResult } = require('express-validator');

function toMysqlDatetimeOrNull(input) {
  if (!input) return null;
  if (input instanceof Date) {
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const y = input.getFullYear();
    const m = pad(input.getMonth() + 1);
    const d = pad(input.getDate());
    const hh = pad(input.getHours());
    const mm = pad(input.getMinutes());
    const ss = pad(input.getSeconds());
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
  return String(input);
}

// 获取项目列表
exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = '';
    const params = [];

    // 项目负责人只能看到自己的项目
    if (userRole === 'project_manager') {
      whereClause = 'WHERE p.manager_id = ?';
      params.push(userId);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM projects p ${whereClause}`,
      params
    );

    const [projects] = await pool.query(
      `SELECT p.*, u.username as manager_name 
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       ${whereClause}
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
};

// 创建项目
exports.create = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { project_name, general_unit, manager_id, manager_name } = req.body;

    // 验证管理员是否存在且角色正确
    const [managers] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role IN (?, ?)',
      [manager_id, 'admin', 'project_manager']
    );

    if (managers.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '指定的负责人不存在或权限不足',
        data: null
      });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (project_name, general_unit, manager_id, manager_name) VALUES (?, ?, ?, ?)',
      [project_name, general_unit, manager_id, manager_name || managers[0].username]
    );

    res.json({
      code: 200,
      message: '创建成功',
      data: {
        projectId: result.insertId
      }
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({
      code: 500,
      message: '创建失败',
      data: null
    });
  }
};

// 转移项目负责人
exports.transfer = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { new_manager_id, new_manager_name } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    await connection.beginTransaction();

    // 获取项目信息
    const [projects] = await connection.query(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    if (projects.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        message: '项目不存在',
        data: null
      });
    }

    const project = projects[0];

    // 权限检查：只有管理员或当前负责人可以转移
    if (userRole !== 'admin' && project.manager_id !== userId) {
      await connection.rollback();
      return res.status(403).json({
        code: 403,
        message: '无权转移该项目',
        data: null
      });
    }

    // 验证新负责人
    const [newManagers] = await connection.query(
      'SELECT * FROM users WHERE id = ? AND role IN (?, ?)',
      [new_manager_id, 'admin', 'project_manager']
    );

    if (newManagers.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        message: '新负责人不存在或权限不足',
        data: null
      });
    }

    // 更新项目负责人
    await connection.query(
      'UPDATE projects SET manager_id = ?, manager_name = ? WHERE id = ?',
      [new_manager_id, new_manager_name || newManagers[0].username, id]
    );

    // 记录操作日志
    await connection.query(
      'INSERT INTO operation_logs (user_id, operation_type, target_type, target_id, operation_detail) VALUES (?, ?, ?, ?, ?)',
      [userId, 'transfer_project', 'project', id, `转移项目负责人从${project.manager_id}到${new_manager_id}`]
    );

    await connection.commit();

    res.json({
      code: 200,
      message: '转移成功',
      data: null
    });
  } catch (error) {
    await connection.rollback();
    console.error('转移项目负责人失败:', error);
    res.status(500).json({
      code: 500,
      message: '转移失败',
      data: null
    });
  } finally {
    connection.release();
  }
};

//获取项目列表
exports.getProjectList = async (req, res) => {
  try {
    // 只取启用项目，按创建时间倒序（可按需改为 project_name 排序）
    const sql = `
      SELECT id, project_name
      FROM projects
      WHERE status = 1
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(sql);

    return res.status(200).json(rows);
  } catch (err) {
    console.error('getProjectList error:', err);
    return res.status(500).json({ message: '获取项目列表失败' });
  }
};

// 拉取项目下所属打卡地
exports.getProjectLocations = async (req, res) => {
  try {
    const projectId = Number(req.body?.project_id ?? req.query?.project_id);
    if (!projectId || Number.isNaN(projectId)) {
      return res.status(400).json({ message: 'project_id 参数缺失或不合法' });
    }

    const sql = `
      SELECT id, location_name
      FROM checkin_locations
      WHERE project_id = ? AND status = 1
      ORDER BY location_name ASC
    `;
    const [rows] = await pool.query(sql, [projectId]);

    return res.status(200).json(rows);
  } catch (err) {
    console.error('getProjectLocations error:', err);
    return res.status(500).json({ message: '获取打卡地列表失败' });
  }
};

exports.applyProjectEntry = async (req, res) => {
  try {
    const {
      user_id,
      project_id,
      location_id,
      entry_type,
      expect_leavetime,
      apply_reason
    } = req.body || {};

    if (!user_id || !project_id || !location_id || !entry_type) {
      return res.status(422).json({ message: '缺少必填字段：user_id / project_id / location_id / entry_type' });
    }
    if (!['entry', 'exit'].includes(entry_type)) {
      return res.status(422).json({ message: 'entry_type 必须为 entry 或 exit' });
    }

    if (entry_type === 'entry' && !expect_leavetime) {
      return res.status(422).json({ message: '入场申请需提供预计离场时间' });
    }

    const expectLeave = toMysqlDatetimeOrNull(expect_leavetime);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 校验用户、项目、地点存在且启用（项目/地点按需校验启用状态）
      const [[userRow]] = await conn.query('SELECT id FROM users WHERE id = ?', [user_id]);
      if (!userRow) {
        await conn.rollback();
        conn.release();
        return res.status(422).json({ message: '用户不存在' });
      }

      // —— 业务去重 —— //
      const [dupRows] = await conn.query(
        `SELECT id FROM project_entries
         WHERE user_id=? AND project_id=? AND location_id=? AND entry_type=? AND status IN ('pending')`,
        [user_id, project_id, location_id, entry_type]
      );
      if (dupRows.length) {
        await conn.rollback();
        conn.release();
        return res.status(200).json({
          code: 409,
          message: '已存在相同类型的待审批申请'
        });
      }

      // —— 插入 —— //
      const sql = `
        INSERT INTO project_entries
          (user_id, project_id, location_id, entry_type, apply_reason, expect_leavetime, status)
        VALUES
          (?, ?, ?, ?, ?, ?, 'pending')
      `;
      const params = [
        user_id,
        project_id,
        location_id,
        entry_type,                 // 'entry' | 'exit'
        apply_reason || null,
        expect_leavetime || null    // 'YYYY-MM-DD HH:mm:ss'，与列名一致
      ];
      const [result] = await pool.query(sql, params);

      res.status(200).json({
        code: 201,
        id: result.insertId, status: 'pending'
      });

      await conn.commit();

    } catch (e) {
      console.log('applyProjectEntry inner error:', e);
      if (conn) await conn.rollback();
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(200).json({ code: 409, message: '已存在相同类型的申请' });
      }
      console.error(e);
      res.status(500).json({ code: 500, message: '提交失败' });
    } finally {
      if (conn) conn.release();
    }

  } catch (err) {
    console.error('applyProjectEntry error:', err);
    return res.status(500).json({ code: 500, message: '服务器错误' });
  }
};