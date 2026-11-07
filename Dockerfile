# syntax=docker/dockerfile:1

# ---- 依赖层：只复制 lockfile，最大化利用构建缓存 ----
FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next 的 musl 原生依赖在 Alpine 上需要 glibc 兼容层
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- 构建层：next build --webpack 产出 .next/standalone ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 运行层：只用 standalone 产物，非 root 运行 ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# data/seed 是运行时数据源（loadSeed 读取 process.cwd()/data/seed），必须进镜像
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
# 运行时写入目录（导入数据与报告），由 compose 挂卷持久化
RUN mkdir -p /app/data/uploads && chown nextjs:nodejs /app/data/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
