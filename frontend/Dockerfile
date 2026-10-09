# =========================================================================
# NearExpiry Frontend Dockerfile
# Multi-stage image supporting both development (Vite HMR) and production (Nginx)
# =========================================================================

# -------------------------------------------------------------------------
# Stage 1: Base Environment & Dependency Manifests
# -------------------------------------------------------------------------
FROM node:20-alpine AS base

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies required by Vite)
RUN npm ci

# -------------------------------------------------------------------------
# Stage 2: Development Stage (Vite HMR Dev Server)
# -------------------------------------------------------------------------
FROM base AS development

COPY . .

EXPOSE 5173

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5173/ || exit 1

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# -------------------------------------------------------------------------
# Stage 3: Builder Stage (Compiles production bundle into /app/dist)
# -------------------------------------------------------------------------
FROM base AS builder

COPY . .

# Build-time environment arguments (baked into client bundle by Vite)
ARG VITE_API_URL="/api/v1"
ARG VITE_SOCKET_URL=""

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

# Compile production bundle to /app/dist
RUN npm run build

# -------------------------------------------------------------------------
# Stage 4: Production Stage (Serves static assets with Nginx)
# -------------------------------------------------------------------------
FROM nginx:alpine AS production

# Remove default Nginx welcome site
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA routing and API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Container healthcheck targeting the dedicated /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/healthz || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

