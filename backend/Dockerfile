# =========================================================================
# NearExpiry Backend Dockerfile
# Multi-stage image supporting both development and production
# =========================================================================

# -------------------------------------------------------------------------
# Stage 1: Base Environment & Dependency Manifests
# -------------------------------------------------------------------------
FROM node:20-alpine AS base

WORKDIR /app

# Copy dependency manifests for caching
COPY package.json package-lock.json ./

# -------------------------------------------------------------------------
# Stage 2: Development Stage (includes nodemon & devDependencies)
# -------------------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development
ENV PORT=5000

# Install all dependencies including devDependencies (nodemon, etc.)
RUN npm ci

# Copy backend source code
COPY src ./src

EXPOSE 5000

CMD ["npm", "run", "dev"]

# -------------------------------------------------------------------------
# Stage 3: Production Stage (lean, unprivileged, minimal runtime)
# -------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production
ENV PORT=5000

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

# Copy application source code
COPY src ./src

# Create uploads/logs directory and set ownership to unprivileged 'node' user
RUN mkdir -p /app/uploads /app/logs \
  && chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend service port
EXPOSE 5000

# Container healthcheck querying authoritative /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/v1/health || exit 1

# Launch application using exec form to ensure Node.js is PID 1
# and gracefully handles SIGTERM / SIGINT shutdown signals
CMD ["node", "src/server.js"]

