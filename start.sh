#!/usr/bin/env bash
set -euo pipefail

APP="${APP:-app.js}"
NODE_ARGS="${NODE_ARGS:-}"      # 额外 Node 参数可以通过设置环境变量来添加，例如：NODE_ARGS="--inspect=9229 --enable-source-maps"
RUNDIR=".run"
LOGDIR="logs"
PIDFILE="$RUNDIR/node.pid"

mkdir -p "$RUNDIR" "$LOGDIR"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "service is running，PID=$(cat "$PIDFILE")"
  exit 0
fi

# 后台启动，记录 PID 与日志
nohup node $NODE_ARGS "$APP" >>"$LOGDIR/app.out.log" 2>>"$LOGDIR/app.err.log" &
echo $! > "$PIDFILE"

echo "service is started：PID=$(cat "$PIDFILE")，log file：$LOGDIR/app.out.log / app.err.log"
