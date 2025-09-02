const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');

// 获取公司列表
router.get('/list', authMiddleware, requireRole(['admin']), companyController.getList);

// 创建公司
router.post('/create', authMiddleware, requireRole(['admin']), [
  body('company_name').notEmpty().withMessage('公司名称不能为空'),
  body('valid_until').isDate().withMessage('有效期格式不正确')
], companyController.create);

// 更新公司
router.put('/update/:id', authMiddleware, requireRole(['admin']), companyController.update);

// 删除公司
router.delete('/delete/:id', authMiddleware, requireRole(['admin']), companyController.delete);

// 测试接口
router.get('/test', (req, res) => {
  res.json({ code: 200, message: 'Company route working' });
});

module.exports = router;
