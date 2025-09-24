#!/usr/bin/env bash
set -euo pipefail

PIDFILE=".run/node.pid"

if [[ ! -f "$PIDFILE" ]]; then
  echo "PID file not found, service may not be running."
  exit 0
fi

PID="$(cat "$PIDFILE")"

if kill -0 "$PID" 2>/dev/null; then
  echo "send SIGTERM to PID $PID..."
  kill "$PID"
  for i in {1..15}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "process has exited."
      rm -f "$PIDFILE"
      exit 0
    fi
    sleep 1
  done
  echo "forced terminatioon..."
  kill -9 "$PID" 2>/dev/null || true
else
  echo "PID $PID not found"
fi

rm -f "$PIDFILE"
echo "service is stopped."
