const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { authMiddleware, requireRole } = require('../middleware/auth');

// 获取个人考勤统计
router.get('/personal', authMiddleware, statisticsController.getPersonalStatistics);

// 导出考勤数据（管理员）
router.get('/export', authMiddleware, requireRole(['admin']), statisticsController.exportAttendance);

// 申诉考勤异常
router.post('/appeal', authMiddleware, statisticsController.appealAttendance);

// 测试接口
router.get('/test', (req, res) => {
  res.json({ code: 200, message: 'Statistics route working' });
});

module.exports = router;
