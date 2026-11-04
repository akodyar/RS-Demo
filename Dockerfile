# ==============================================================================
# HOMEHUB PLATFORM — MULTI-STAGE PRODUCTION DOCKERFILE
# ==============================================================================

# --- Stage 1: Builder ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and assets
COPY . .

# Run production build (Vite client SPA + esbuild server bundle)
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:22-alpine AS runner

# Install tini for PID 1 signal forwarding and zombie reaping
RUN apk add --no-cache tini postgresql-client

WORKDIR /app

# Create non-root system user and group
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 --ingroup nodejs nodejs

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled artifacts and assets from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Drop root privileges
USER nodejs

# Expose production application port
EXPOSE 3000

# Container liveness healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Launch production server via tini init wrapper
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.cjs"]
