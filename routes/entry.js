const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// 申请入场
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const { project_id, location_id, entry_type, apply_reason } = req.body;
    const [result] = await pool.query(
      'INSERT INTO project_entries (user_id, project_id, location_id, entry_type, apply_reason) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, project_id, location_id, entry_type || 'entry', apply_reason]
    );
    res.json({ code: 200, message: '申请提交成功', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 申请离场
router.post('/leave', authMiddleware, async (req, res) => {
  try {
    const { project_id, location_id, leave_reason } = req.body;
    const [result] = await pool.query(
      'INSERT INTO project_entries (user_id, project_id, location_id, entry_type, apply_reason) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, project_id, location_id, 'exit', leave_reason]
    );
    res.json({ code: 200, message: '离场申请提交成功', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});
module.exports = router;
