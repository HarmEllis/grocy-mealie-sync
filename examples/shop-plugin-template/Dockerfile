FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node lib ./lib
COPY --chown=node:node src ./src
COPY --chown=node:node LICENSE ./
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
HEALTHCHECK --interval=30s --start-period=30s --timeout=5s CMD node -e "const fs=require('node:fs');process.exit(Date.now()-Number(fs.readFileSync('/data/heartbeat','utf8'))<60000?0:1)"
CMD ["node", "src/main.ts"]
