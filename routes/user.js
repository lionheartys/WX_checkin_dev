const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// 获取待审批用户
router.get('/pending', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const [users] = await pool.query(
      "SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.json({ code: 200, data: users });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 审批用户
router.post('/approve/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { status, remark } = req.body;
    await pool.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    res.json({ code: 200, message: '审批成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
