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

// 获取请假类型列表
router.get('/types', authMiddleware, async (req, res) => {
  const pool = require('../config/database');
  try {
    const [types] = await pool.query(
      'SELECT * FROM leave_types WHERE status = 1 ORDER BY id'
    );
    res.json({
      code: 200,
      data: types
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取请假类型失败'
    });
  }
});

// 获取用户请假记录
router.get('/applications/:userId', authMiddleware, async (req, res) => {
  const pool = require('../config/database');
  try {
    const [applications] = await pool.query(
      `SELECT la.*, lt.type_name 
       FROM leave_applications la
       LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.user_id = ?
       ORDER BY la.created_at DESC`,
      [req.params.userId]
    );
    res.json({
      code: 200,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取请假记录失败'
    });
  }
});

// 获取用户调休额度
router.get('/compensatory/quota/:userId', authMiddleware, async (req, res) => {
  const pool = require('../config/database');
  try {
    const [quotas] = await pool.query(
      `SELECT 
        SUM(quota_days) as total,
        SUM(used_days) as used,
        SUM(quota_days - used_days) as available
       FROM compensatory_quota 
       WHERE user_id = ? AND status = 'approved'`,
      [req.params.userId]
    );
    
    res.json({
      code: 200,
      data: {
        total: quotas[0].total || 0,
        used: quotas[0].used || 0,
        available: quotas[0].available || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取调休额度失败'
    });
  }
});

// 获取调休规则配置
router.get('/compensatory/rules', authMiddleware, async (req, res) => {
  // 这里可以从数据库配置表读取，或者返回固定值
  res.json({
    code: 200,
    data: {
      min_business_days: 14,      // 最少出差天数
      extra_days_per_quota: 10,   // 每10天获得1天调休
      base_quota_days: 1          // 基础调休天数
    }
  });
});
