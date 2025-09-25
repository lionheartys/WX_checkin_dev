const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const locationsController = require('../controllers/locationsController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');

// 获取项目列表
router.get('/list', authMiddleware, projectController.getList);

// 创建项目
router.post('/create', authMiddleware, requireRole(['admin']), [
  body('project_name').notEmpty().withMessage('项目名称不能为空'),
  body('manager_id').isInt().withMessage('负责人ID必须是整数')
], projectController.create);

// 转移项目负责人
router.put('/transfer/:id', authMiddleware, projectController.transfer);

//拉取项目列表
router.post('/get-project-list', /*auth,*/ projectController.getProjectList);

// 拉取项目下所属地点列表
router.post('/get-project-locations-list', projectController.getProjectLocations);

// 申请项目入场/离场
router.post('/project-apply', projectController.applyProjectEntry);

// 用户获取可用的项目列表
router.post('/user-get-available-projects', locationsController.getAvailableProjectList);

// 测试接口
router.get('/test', (req, res) => {
  res.json({ code: 200, message: 'Project route working' });
});

module.exports = router;
