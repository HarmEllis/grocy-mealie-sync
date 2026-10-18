FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build && rm -rf .next/cache

FROM prod-deps AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# The custom server in server.mjs serves Next.js and the shop plugin WebSocket
# gateway on the same port, so the full (production-only) dependency tree and
# build output are shipped instead of Next's standalone bundle.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/next.config.ts /app/server.mjs ./
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.mjs"]
