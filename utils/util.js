const { request } = require("./request")

// 格式化时间
function formatTime(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()
  
    return `${year}-${addZero(month)}-${addZero(day)} ${addZero(hour)}:${addZero(minute)}:${addZero(second)}`
  }
  
  // 添加前导零
  function addZero(num) {
    return num < 10 ? `0${num}` : num.toString()
  }
  
  // 计算两点距离（简单版）
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const radLat1 = lat1 * Math.PI / 180
    const radLat2 = lat2 * Math.PI / 180
    const a = radLat1 - radLat2
    const b = lng1 * Math.PI / 180 - lng2 * Math.PI / 180
    
    let s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)))
    s = s * 6378.137
    s = Math.round(s * 10000) / 10000
    return s * 1000 // 返回米
  }
  function getCompanies() {
    return request({
      url: '/company/get_companies_name_and_id',
      method: 'GET'
    })
  }

  module.exports = {
    formatTime,
    calculateDistance,
    getCompanies
  //   getCompanies() {
  //   return request({
  //     url: '/company/get_companies_name_and_id',
  //     method: 'GET'
  //   })
  // }
  }