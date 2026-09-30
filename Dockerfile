FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY bin/ ./bin/
COPY instructions.md ./instructions.md
COPY manifest.json ./manifest.json

ENV NODE_ENV=production \
    CRAWLER_URL=http://192.168.1.2:3000 \
    HTTP_PORT=8768 \
    HTTP_HOST=0.0.0.0 \
    LOG_LEVEL=info

EXPOSE 8768

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8768/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js", "daemon"]
