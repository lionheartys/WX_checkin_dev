#!/bin/bash

echo "=========================================="
echo "         压力测试（创建100条打卡记录）"
echo "=========================================="

# 获取所有用户ID
USER_IDS=$(mysql -u root -proot -N -e "USE wechat_checkin; SELECT id FROM users;" 2>/dev/null)
USER_ARRAY=($USER_IDS)
USER_COUNT=${#USER_ARRAY[@]}

if [ $USER_COUNT -eq 0 ]; then
  echo "没有用户，先创建一些用户"
  exit 1
fi

echo "找到 $USER_COUNT 个用户"

# 创建100条打卡记录
SUCCESS=0
FAILED=0

for i in {1..100}; do
  # 随机选择用户
  RANDOM_INDEX=$((RANDOM % USER_COUNT))
  USER_ID=${USER_ARRAY[$RANDOM_INDEX]}
  
  # 随机选择打卡类型
  if [ $((RANDOM % 2)) -eq 0 ]; then
    TYPE="in"
  else
    TYPE="out"
  fi
  
  # 发送请求
  curl -s -X POST http://localhost:3000/api/checkin/simple-clock \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID,\"type\":\"$TYPE\"}" > /dev/null
  
  if [ $? -eq 0 ]; then
    ((SUCCESS++))
    echo -n "."
  else
    ((FAILED++))
    echo -n "x"
  fi
  
  # 每20个换行
  if [ $((i % 20)) -eq 0 ]; then
    echo " [$i/100]"
  fi
done

echo ""
echo "=========================================="
echo "压力测试完成！"
echo "成功: $SUCCESS"
echo "失败: $FAILED"
echo "=========================================="

# 显示统计
mysql -u root -proot -e "
USE wechat_checkin;
SELECT COUNT(*) as '总打卡记录数' FROM checkin_records;" 2>/dev/null

