# RSP Dashboard Client - Production Dockerfile
# Next.js 16 with React 19
#
# Build context MUST be the Dashboard/ directory (not Dashboard/client/), so the
# client generator scripts can read the repo-level source-of-truth files
# (Dashboard/VERSION, Dashboard/server/schema.yaml) at the same relative paths
# they use in local dev. Build with:
#   docker build -f Dashboard/client/Dockerfile -t rsp-dashboard-client:<ver> Dashboard/

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app/client

COPY --from=deps /app/client/node_modules ./node_modules

# Source-of-truth files needed by client/scripts/generate-*.js.
# Place them where the generator scripts expect (Dashboard/ root layout).
COPY VERSION /app/VERSION
COPY server/schema.yaml /app/server/schema.yaml

COPY client/. .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/client/public ./public
COPY --from=builder /app/client/.next/standalone ./
COPY --from=builder /app/client/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
