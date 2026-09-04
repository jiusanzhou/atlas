# syntax=docker/dockerfile:1

# ---------- builder ----------
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

# Chromium comes from apk in the runtime stage, so puppeteer must not download
# its own (~300MB) copy here.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---------- runtime ----------
FROM node:22-alpine

# Chromium backs the PNG export route; nss/freetype/harfbuzz and the font
# packages are what let it start headless and render CJK text rather than boxes.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-cjk

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# `output: "standalone"` traces the runtime dependency subset, so no install
# happens here. static/ and public/ are not traced and must be copied in.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Chromium needs a writable home for its profile and crash dumps.
RUN mkdir -p /home/node/.cache && chown -R node:node /home/node

USER node

EXPOSE 3000

CMD ["node", "server.js"]
