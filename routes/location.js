const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// 获取打卡地点列表
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const [locations] = await pool.query(
      'SELECT l.*, p.project_name FROM checkin_locations l LEFT JOIN projects p ON l.project_id = p.id'
    );
    res.json({ code: 200, data: locations });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
