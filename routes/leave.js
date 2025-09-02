const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');

// 申请调休额度
router.post('/compensatory/apply', authMiddleware, [
  body('project_id').isInt().withMessage('项目ID必须是整数'),
  body('start_date').isDate().withMessage('开始日期格式不正确'),
  body('end_date').isDate().withMessage('结束日期格式不正确')
], leaveController.applyCompensatory);

// 申请请假
router.post('/apply', authMiddleware, [
  body('leave_type_id').isInt().withMessage('请假类型ID必须是整数'),
  body('start_date').isDate().withMessage('开始日期格式不正确'),
  body('end_date').isDate().withMessage('结束日期格式不正确'),
  body('reason').notEmpty().withMessage('请假原因不能为空')
], leaveController.applyLeave);

// 审批请假
router.post('/approve/:id', authMiddleware, requireRole(['admin', 'project_manager']), leaveController.approveLeave);

// 测试接口
router.get('/test', (req, res) => {
  res.json({ code: 200, message: 'Leave route working' });
});

module.exports = router;
