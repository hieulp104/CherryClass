# TeamCherry — bản chạy thật. Build từ thư mục gốc dự án:
#   docker compose -f docker-compose.prod.yml build

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall chạy `prisma generate`, sinh src/generated.
RUN npm ci --no-audit --no-fund

FROM deps AS builder
ARG APP_URL=https://teamcherry.io.vn
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV APP_URL=$APP_URL
COPY . .
# Giá trị giả chỉ để build qua; không trang nào kết nối DB lúc build. Giá trị thật nằm trong .env trên VPS.
# Giới hạn heap vì build ngay trên VPS dùng chung với web khác.
RUN NODE_OPTIONS=--max-old-space-size=1536 DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" AUTH_SECRET="chi-dung-luc-build" npx next build
# Gói script khởi tạo thành một file để image migrate không phải chứa cả node_modules.
RUN npx esbuild prisma/bootstrap.ts --bundle --platform=node --format=esm --outfile=/app/bootstrap.mjs \
    --banner:js="import{createRequire}from'node:module';const require=createRequire(import.meta.url);"

# Áp dụng migration + khởi tạo lần đầu. Chạy xong là dừng.
FROM node:22-bookworm-slim AS migrate
LABEL app=teamcherry
WORKDIR /migrate
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package-lock.json ./
RUN npm init -y >/dev/null \
    && npm install --no-audit --no-fund \
      "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
      "dotenv@$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version")" \
    && rm package-lock.json
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY --from=builder /app/bootstrap.mjs ./bootstrap.mjs

# Web app: chỉ gồm những file standalone cần, chạy bằng user thường.
FROM node:22-bookworm-slim AS app
LABEL app=teamcherry
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=512
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
