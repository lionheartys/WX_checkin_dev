// utils/wechat.js - 微信相关工具
const axios = require('axios');

// 获取微信openid
const getOpenId = async (code) => {
  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session`;
    const params = {
      appid: process.env.WX_APPID,
      secret: process.env.WX_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data.errcode) {
      throw new Error(response.data.errmsg);
    }
    
    return response.data;
  } catch (error) {
    console.error('获取openid失败:', error);
    throw error;
  }
};

module.exports = { getOpenId };