# NearExpiry — Containerization & Orchestration Guide (Docker & Docker Compose)

This document provides complete instructions for containerizing, orchestrating, developing, and deploying the **NearExpiry** MERN application using Docker and Docker Compose.

---

## 1. Architecture & Network Topology

In the NearExpiry containerized architecture, services communicate over a private Docker bridge network (`nearexpiry-network`) using Docker's internal DNS resolution.

```
                                 [ Web Browser / Client ]
                                            │
                                ┌───────────┴───────────┐
                       HTTP:80  │                       │ (Dev: 5173 / 5000)
                                ▼                       ▼
                     ┌─────────────────────┐   ┌─────────────────────┐
                     │  frontend (Nginx)   │   │  Vite Dev Server    │
                     └──────────┬──────────┘   └──────────┬──────────┘
                                │                         │
                   Reverse Proxy│                         │ Direct API / Proxy
                 /api/v1 & /socket.io                     │
                                ▼                         ▼
                     ┌───────────────────────────────────────────────┐
                     │          backend (Node.js / Express)          │
                     │          Internal Port: 5000                  │
                     └───────────────┬───────────────────────┬───────┘
                                     │                       │
                        DNS: mongodb:27017      DNS: redis:6379
                                     ▼                       ▼
                     ┌─────────────────────┐   ┌─────────────────────┐
                     │       mongodb       │   │        redis        │
                     │  (mongo:7.0 Image)  │   │  (redis:7-alpine)   │
                     │  Volume: mongodb_data│   │  Volume: redis_data │
                     └─────────────────────┘   └─────────────────────┘
```

### Key Principles:
1. **Single Entry Point in Production**: In production, only the `frontend` container (Nginx) publishes port `80` to the host.
2. **Reverse Proxy & WebSocket Upgrades**: Nginx automatically forwards `/api/v1/*` to `http://backend:5000/api/v1/*` and `/socket.io/*` to `http://backend:5000/socket.io/*` with HTTP/1.1 `Upgrade: websocket` headers. The browser needs only to speak to port `80`.
3. **Internal Data Isolation**: MongoDB (`mongodb:27017`) and Redis (`redis:6379`) are strictly internal to `nearexpiry-network` in production and have zero exposed ports on the host machine.
4. **Resilient Caching**: The backend connects to Redis using service DNS (`redis:6379`). If Redis is unavailable or restarted, the backend falls back safely to MongoDB without dropping requests.

---

## 2. Prerequisites

- **Docker Engine**: Version `20.10.0` or later
- **Docker Compose**: Version `v2.0.0` or later (`docker compose` command)
- Verify installation on your system:
  ```bash
  docker --version
  docker compose version
  ```

---

## 3. Environment Setup

Before launching the stack, create your environment file from the provided template:

```bash
# From repository root:
cp .env.docker.example .env
```

### Key Environment Variables

| Variable | Description | Default / Example | Required in Prod |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Runtime environment mode | `production` or `development` | Yes |
| `PORT_FRONTEND` | Host port for frontend web client | `80` (prod), `5173` (dev) | Yes |
| `PORT_BACKEND` | Host port for backend API | `5000` | Optional in prod |
| `MONGODB_URI` | Internal MongoDB connection string | `mongodb://mongodb:27017/nearexpiry` | Yes |
| `REDIS_ENABLED` | Enable Redis cache-aside engine | `true` | Recommended |
| `REDIS_HOST` | Internal Redis service hostname | `redis` | Yes (if Redis on) |
| `REDIS_PORT` | Internal Redis service port | `6379` | Yes (if Redis on) |
| `JWT_SECRET` | 256-bit cryptographically secure key | `min 32 characters` | **MANDATORY** |
| `JWT_REFRESH_SECRET`| 256-bit refresh token key | `min 32 characters` | **MANDATORY** |
| `QR_SIGNING_SECRET` | HMAC signature key for QR codes | `min 32 characters` | **MANDATORY** |
| `CORS_ORIGIN` | Allowed HTTP Origins (comma-separated)| `http://localhost,http://localhost:80` | Yes |
| `CLIENT_URL` | Base frontend URL for links | `http://localhost` | Yes |

> [!WARNING]
> Never deploy to production with placeholder secrets. Generate fresh 256-bit cryptographic secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 4. Development Workflow

The development configuration enables:
- Source code bind-mounts for real-time hot reloading (Nodemon for backend, Vite HMR for frontend).
- Containerized Linux `node_modules` preserved via anonymous volumes.
- Host port mapping for MongoDB (`27017`) and Redis (`6379`) to allow inspection with MongoDB Compass and RedisInsight.

### 4.1 Starting the Development Stack
```bash
# Build and start development containers in the foreground
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or run in detached background mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### 4.2 Accessing Services in Development
- **Frontend (Vite HMR)**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **API Health Check**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
- **MongoDB**: `mongodb://localhost:27017/nearexpiry`
- **Redis**: `redis://localhost:6379`

### 4.3 Stopping Development Containers
```bash
# Stop containers while safely preserving database volumes
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

---

## 5. Production Deployment

The production configuration features:
- Multi-stage Docker builds.
- Unprivileged `node` non-root user running Node.js in the backend container.
- Vite bundle compiled ahead-of-time and served via lightweight Nginx Alpine.
- Gzip compression, SPA client-side routing, and WebSocket reverse proxying.
- Log rotation (`json-file`, max 20MB, 5 files) to prevent disk exhaustion.
- Zero public exposure for MongoDB and Redis.

### 5.1 Starting the Production Stack
```bash
# Build and run production containers in detached mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 5.2 Checking Service Health
```bash
docker compose ps
```
All four services (`mongodb`, `redis`, `backend`, `frontend`) will report `(healthy)`.

### 5.3 Viewing Logs
```bash
# Stream all logs
docker compose logs -f

# Stream logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
docker compose logs -f redis
```

### 5.4 Graceful Shutdown
```bash
# Safely stop the stack (Node.js receives SIGTERM and gracefully closes HTTP & DB connections)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

---

## 6. Volume Persistence & Backups

### 6.1 Persistent Volumes
NearExpiry stores stateful data in two Docker named volumes:
- `nearexpiry_mongodb_data`: Stores all MongoDB WiredTiger database files.
- `nearexpiry_redis_data`: Stores Redis append-only persistence files (`appendonly.aof`).

Stopping or restarting containers using `docker compose down` **DOES NOT** delete these volumes.

> [!CAUTION]
> Running `docker compose down -v` will **PERMANENTLY DESTROY** all database and cache volumes. Never run `docker compose down -v` on an environment containing real data.

### 6.2 Creating a MongoDB Backup
To take a live backup of MongoDB while the container is running:
```bash
# Export MongoDB dump from inside the container to local host directory
docker compose exec -T mongodb mongodump --archive --gzip > nearexpiry_backup_$(date +%Y%m%d_%H%M%S).gz
```

### 6.3 Restoring a MongoDB Backup
```bash
# Restore archive into MongoDB container
docker compose exec -T mongodb mongorestore --archive --gzip < nearexpiry_backup_20261009.gz
```

---

## 7. Troubleshooting & Common Issues

### Issue 1: Backend Cannot Connect to MongoDB
- **Symptom**: `[MongoDB] Server starting while waiting for MongoDB on 27017...`
- **Cause**: Using `localhost:27017` instead of `mongodb:27017` inside the container.
- **Solution**: Ensure `MONGODB_URI=mongodb://mongodb:27017/nearexpiry` in `.env`.

### Issue 2: Socket.IO Connection Fails Through Proxy
- **Symptom**: Polling works, but WebSocket connection fails with `WebSocket connection to 'ws://localhost/socket.io/...' failed`.
- **Cause**: Missing `Upgrade` and `Connection` HTTP headers in reverse proxy.
- **Solution**: Verify `frontend/nginx.conf` contains `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";`.

### Issue 3: Direct URL Refresh Returns 404 in Production
- **Symptom**: Navigating to `http://localhost/admin/categories` works when clicked in React, but refreshing the browser gives a 404 Not Found error.
- **Cause**: Nginx attempting to look for a physical file at `/admin/categories`.
- **Solution**: Verify `frontend/nginx.conf` includes SPA fallback: `try_files $uri $uri/ /index.html;`.

### Issue 4: Port Conflict on Host
- **Symptom**: `Bind for 0.0.0.0:80 failed: port is already allocated`.
- **Solution**: In `.env`, change `PORT_FRONTEND` to another open port (e.g. `PORT_FRONTEND=8080`). Access via `http://localhost:8080`.

---

## 8. Security & Production Checklist

Before exposing NearExpiry to the public internet:
1. **SSL/TLS Termination**: Place an external reverse proxy (Cloudflare, AWS ALB, Traefik, or Certbot Nginx) in front of the stack to enforce HTTPS and WSS (secure WebSockets).
2. **Secrets Rotation**: Store all JWT, QR, and Redis credentials in a dedicated secrets manager (Docker Secrets, Vault, or AWS Secrets Manager) rather than plaintext files.
3. **Database Authentication**: Enable MongoDB user authentication (`MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`) and reflect the credentials in `MONGODB_URI`.
4. **Regular Image Updates**: Regularly run `docker compose pull` and rebuild base images with updated Alpine security patches.

