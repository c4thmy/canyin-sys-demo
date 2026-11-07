#!/usr/bin/env bash
#
# 演示冒烟：构建并逐条请求 12 条路由，断言 HTTP 200 + 关键文案。
#
#   bash scripts/smoke.sh            # 本机：npm run build + next start -p 3100
#   bash scripts/smoke.sh --docker   # 容器：docker compose up -d --build（3000）
#
# 任何一条失败都会以非 0 退出并打印失败路由；脚本结束时会清理自己启动的进程/容器。

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="local"
case "${1:-}" in
  "")
    ;;
  --docker)
    MODE="docker"
    ;;
  *)
    echo "用法: bash scripts/smoke.sh [--docker]" >&2
    exit 2
    ;;
esac

if [[ "$MODE" == "docker" ]]; then
  PORT=3000
else
  PORT="${SMOKE_PORT:-3100}"
fi
BASE_URL="http://127.0.0.1:${PORT}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/canyin-smoke.XXXXXX")"
SERVER_PID=""
DOCKER_STARTED=0
FAILURES=0
FAILED_ROUTES=()

# route|页面必须出现的关键文本
ROUTES=(
  "/|利润桥"
  "/revenue/structure|先看结构，再看异动"
  "/revenue/same-store|94.77"
  "/revenue/store/S01|同店横向对比"
  "/revenue/channel|增收提价"
  "/revenue/product|套餐量价分解"
  "/insights|异动原点"
  "/dashboard|门店收入排行"
  "/data|导入批次"
  "/data/templates|门店收入模板"
  "/data/import|上传并解析"
  "/reports|生成报告"
  "/reports/templates|老板版"
)

log() {
  printf '%s\n' "$*"
}

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.1
    done
    kill -9 "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ "$DOCKER_STARTED" -eq 1 ]]; then
    docker compose down --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

record_failure() {
  FAILURES=$((FAILURES + 1))
  FAILED_ROUTES+=("$1")
  log "  ✗ $1  → $2"
}

wait_for_http() {
  local attempt
  for attempt in $(seq 1 120); do
    if curl -fsS -o /dev/null -m 2 "${BASE_URL}/" 2>/dev/null; then
      return 0
    fi
    if [[ -n "$SERVER_PID" ]] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    sleep 0.5
  done
  return 1
}

check_route() {
  local route="$1"
  local expect="$2"
  local body="$TMP_DIR/body.html"
  local status

  status="$(curl -sS -m 20 -o "$body" -w '%{http_code}' "${BASE_URL}${route}" 2>"$TMP_DIR/curl.err")"
  if [[ "$status" != "200" ]]; then
    record_failure "$route" "HTTP ${status:-000}"
    return
  fi
  if ! grep -qF -- "$expect" "$body"; then
    record_failure "$route" "页面缺少关键文本「${expect}」"
    return
  fi
  log "  ✓ ${route}  (HTTP 200 · 含「${expect}」)"
}

# ---------- 启动 ----------
if [[ "$MODE" == "docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    log "未找到 docker，无法执行 --docker 模式"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log "Docker 守护进程未运行：请先启动 Docker Desktop，再执行 bash scripts/smoke.sh --docker"
    exit 1
  fi

  log "==> docker compose up -d --build（端口 ${PORT}）"
  DOCKER_STARTED=1
  if ! docker compose up -d --build >"$TMP_DIR/docker.log" 2>&1; then
    tail -40 "$TMP_DIR/docker.log"
    log "docker compose 构建/启动失败"
    exit 1
  fi
else
  log "==> npm run build"
  if ! npm run build >"$TMP_DIR/build.log" 2>&1; then
    tail -40 "$TMP_DIR/build.log"
    log "构建失败"
    exit 1
  fi

  log "==> next start -p ${PORT}"
  # 用临时数据目录：冒烟始终跑在演示数据上，不受本机已导入数据影响
  CANYIN_DATA_DIR="$TMP_DIR/uploads" ./node_modules/.bin/next start -p "$PORT" -H 127.0.0.1 >"$TMP_DIR/server.log" 2>&1 &
  SERVER_PID=$!
fi

if ! wait_for_http; then
  log "服务未在 60 秒内就绪：${BASE_URL}"
  if [[ -f "$TMP_DIR/server.log" ]]; then
    tail -30 "$TMP_DIR/server.log"
  fi
  if [[ -f "$TMP_DIR/docker.log" ]]; then
    tail -30 "$TMP_DIR/docker.log"
  fi
  exit 1
fi

# ---------- 断言 ----------
log "==> 检查 ${#ROUTES[@]} 条路由"
for entry in "${ROUTES[@]}"; do
  check_route "${entry%%|*}" "${entry#*|}"
done

# ---------- 收尾 ----------
if [[ "$MODE" == "docker" && "$DOCKER_STARTED" -eq 1 ]]; then
  log "==> docker compose down"
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  DOCKER_STARTED=0
fi

if [[ "$FAILURES" -ne 0 ]]; then
  log ""
  log "冒烟失败：${FAILURES} 条路由"
  for route in "${FAILED_ROUTES[@]}"; do
    log "  - ${route}"
  done
  exit 1
fi

log ""
log "冒烟通过：${#ROUTES[@]} 条路由全部 HTTP 200 且关键文本存在。"
