# =========================================================================
# Multi-Stage Secure Dockerfile for StudyCloud Next.js Application
# Security Features:
# - Multi-stage minimal footprint build
# - Runs as unprivileged non-root user (USER node)
# - No hardcoded secrets or build tokens embedded
# - Alpine Linux minimal attack surface
# =========================================================================

# 1. Dependency stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies strictly using package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment flags during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# 3. Production Runner stage (Non-root minimal runtime)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use existing non-root node user provided by node:alpine (UID 1000)
USER node

# Copy public assets and build outputs with ownership assigned to non-root user
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
