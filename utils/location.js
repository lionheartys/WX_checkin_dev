// utils/location.js - 位置相关工具
const geolib = require('geolib');

// 计算两点之间的距离(米)
const calculateDistance = (point1, point2) => {
  return geolib.getDistance(
    { latitude: point1.latitude, longitude: point1.longitude },
    { latitude: point2.latitude, longitude: point2.longitude }
  );
};

// 检查是否在打卡范围内
const isInRange = (userLocation, checkinLocation, range) => {
  const distance = calculateDistance(userLocation, checkinLocation);
  return {
    inRange: distance <= range,
    distance: distance
  };
};

module.exports = { calculateDistance, isInRange };

// routes/auth.js - 认证路由
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');

// 微信登录
router.post('/wxLogin', [
  body('code').notEmpty().withMessage('code不能为空')
], authController.wxLogin);

// 用户注册
router.post('/register', [
  body('openid').notEmpty().withMessage('openid不能为空'),
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('company_id').isInt().withMessage('公司ID必须是整数')
], authController.register);

module.exports = router;
