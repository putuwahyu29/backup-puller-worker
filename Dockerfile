FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY bin ./bin
COPY src ./src
COPY entrypoint.sh ./

RUN mkdir -p /app/runtime/temp /app/runtime/state && \
    chown -R node:node /app && \
    chmod +x /app/entrypoint.sh /app/bin/backup-puller.js

USER node

VOLUME ["/app/runtime"]

ENTRYPOINT ["/app/entrypoint.sh"]
