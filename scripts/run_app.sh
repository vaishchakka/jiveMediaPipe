#!/usr/bin/env bash
set -euo pipefail

# Simple launcher for backend (Flask via uvicorn/asgi) and frontend (React) with cleanup
# - Detects an available API port (prefers 5000, falls back to 5050)
# - Uses uvicorn (with asgiref WSGI adapter) if available; otherwise falls back to Flask dev server
# - Exposes REACT_APP_API_BASE for the frontend
# - Shows URLs and tails logs on failure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
cd "$REPO_ROOT"

LOG_DIR="/tmp/jive"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
FE_LOG="$LOG_DIR/frontend.log"

pick_api_port() {
  local candidates=(5000 5050 5051 5052)
  local port
  for port in "${candidates[@]}"; do
    if ! lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  # fall back to 5050 if all are taken (may fail later if in use)
  echo 5050
}

API_PORT="$(pick_api_port)"
API_URL="http://localhost:${API_PORT}"

# Start backend (uvicorn if available)
echo "🌐 Starting backend on ${API_URL} ..."
if command -v uvicorn >/dev/null 2>&1; then
  if python -c "import asgiref" >/dev/null 2>&1; then
    : "${API_WORKERS:=1}"
    nohup uvicorn asgi_app:app --host 127.0.0.1 --port "${API_PORT}" --workers "${API_WORKERS}" >"${API_LOG}" 2>&1 &
  else
    echo "⚠️ Python package 'asgiref' not found; falling back to Flask dev server"
    export FLASK_APP=api_server.py
    nohup flask run -p "${API_PORT}" >"${API_LOG}" 2>&1 &
  fi
else
  echo "⚠️ uvicorn not found; falling back to Flask dev server"
  export FLASK_APP=api_server.py
  nohup flask run -p "${API_PORT}" >"${API_LOG}" 2>&1 &
fi
API_PID=$!

# small wait then verify
sleep 1
if ! lsof -nP -iTCP:${API_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ Backend failed to start. See ${API_LOG}"
  exit 1
fi

echo "✅ Backend running: ${API_URL}"

pick_fe_port() {
  local start=${FRONTEND_PORT:-3000}
  local port=$start
  local end=$((start+10))
  while [ $port -le $end ]; do
    if ! lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
    port=$((port+1))
  done
  # fallback to 3000 if nothing free in range
  echo 3000
}

FE_PORT="$(pick_fe_port)"

# Start frontend (React)
echo "⚛️  Starting frontend (React) on http://localhost:${FE_PORT} ..."
# Pass API base and PORT to the React dev server
( export REACT_APP_API_BASE="${API_URL}" PORT="${FE_PORT}" BROWSER=none; nohup npm start --prefix frontend >"${FE_LOG}" 2>&1 & )
FE_PID=$!

# small wait then verify
sleep 2
if ! lsof -nP -iTCP:${FE_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ Frontend failed to start. See ${FE_LOG}"
  # Cleanup backend on failure
  kill "$API_PID" >/dev/null 2>&1 || true
  exit 1
fi

echo ""
echo "🎉 App is starting!"
echo "   API:    ${API_URL}"
echo "   Front:  http://localhost:${FE_PORT}"
echo "Logs:"
echo "   API log: ${API_LOG}"
echo "   FE  log: ${FE_LOG}"
echo ""
echo "Press Ctrl+C to stop (from the same shell that started this script)."

cleanup() {
  echo "\n🛑 Stopping services..."
  kill "$FE_PID" >/dev/null 2>&1 || true
  kill "$API_PID" >/dev/null 2>&1 || true
  exit 0
}

trap cleanup INT TERM

# Wait on both PIDs
tail --pid="$API_PID" -f /dev/null 2>/dev/null &
TAIL_API=$!
tail --pid="$FE_PID" -f /dev/null 2>/dev/null &
TAIL_FE=$!
wait "$TAIL_API" "$TAIL_FE"
