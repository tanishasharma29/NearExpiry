# NearExpiry — Production Deployment Plan (Phase 26)

> **Document Status**: Production Architecture & Deployment Blueprint  
> **Target Audience**: Student Developers, DevOps Engineers, System Administrators  
> **Budget Tier**: Low-Cost / Free-Tier Optimized (₹0 to ₹600/month initial budget)  
> **Application Stack**: MERN (React 18 + Vite 5, Node 20 + Express 4, MongoDB 7, Redis 7, Socket.IO 4)

---

## 1. Executive Summary & Verified Codebase Baseline

NearExpiry is an expiry-aware, hyperlocal B2C e-commerce marketplace connecting customers with verified retail stores selling surplus and near-expiry FMCG products at dynamic markdowns.

Before planning production deployment, an inspection of the actual repository established the following implementation baseline:

### 1.1 Verified Repository Architecture
* **Frontend**:
  * **Framework**: React 18.3.1, Vite 5.4.9, Tailwind CSS 3.4.14.
  * **Routing**: Single Page Application (SPA) driven by `react-router-dom` (v6.27.0) with client-side history API routing.
  * **Build Pipeline**: `npm run build` (`vite build`) outputting minified HTML, CSS, and JS bundles to `frontend/dist/`.
  * **Environment Variables**:
    * `import.meta.env.VITE_API_URL`: Base REST API endpoint (defaults to `/api/v1` for same-origin proxy or `http://localhost:5000/api/v1` for dev).
    * `import.meta.env.VITE_SOCKET_URL`: Socket.IO endpoint (defaults to extracting `origin` from `VITE_API_URL` or `window.location.origin`).
* **Backend**:
  * **Framework**: Node.js 20 (ES Modules `type: "module"`), Express 4.21.1, Mongoose 8.8.1.
  * **Entry Point**: `src/server.js` (HTTP server attached to Express and Socket.IO).
  * **Start Command**: `npm start` (`node src/server.js`).
  * **API Prefix**: `/api/v1` (governed by `env.API_PREFIX`).
  * **Health Endpoint**: `/api/v1/health` (HTTP 200 `{ success: true, message: "NearExpiry API is running" }`).
  * **Port Binding**: Binds dynamically to `process.env.PORT` (defaults to `5000`).
* **Authentication**:
  * **Token Type**: Signed JSON Web Tokens (`jsonwebtoken` v9.0.3) containing `sub` (userId), `email`, `role`, `verificationStatus`, and `tokenVersion`.
  * **Transmission**: Sent by the client via HTTP request header `Authorization: Bearer <token>` (stored in `localStorage`) and simultaneously set as an HTTP-only cookie (`nearexpiry_token`).
  * **Revocation**: Instant token revocation via database `tokenVersion` checks on every authenticated request and Socket.IO handshake.
* **CORS**:
  * Managed by `corsOptions` in `backend/src/config/cors.js`.
  * Accepts comma-separated list of origins via `CORS_ORIGIN`.
  * Enforces `credentials: true`. Because credentials are enabled, wildcard `*` is strictly forbidden by modern browsers for cross-origin fetch/XHR requests.
* **Real-time WebSockets**:
  * Socket.IO 4.8.4 initialized on the HTTP server in `backend/src/config/socket.js`.
  * Handshake middleware authenticates connecting sockets using JWT tokens (`socket.handshake.auth.token`).
  * Real-time events support customer private rooms (`user:<userId>`), store rooms (`store:<storeId>`), and administrative channels (`admin:alerts`).
* **Caching & Fallback**:
  * Redis caching via `ioredis` v6.0.0 in `backend/src/config/redis.js`.
  * Governed by `env.REDIS_ENABLED`.
  * When `REDIS_ENABLED=false` or when Redis is offline/unreachable, the application engages a zero-downtime database-direct fallback: all catalog, product, and batch queries execute safely against MongoDB without throwing unhandled errors or dropping user requests.
* **Media & File Storage**:
  * Product and store schemas currently store image links as URL strings (`image: { type: String, default: "https://placehold.co/600x600?text=NearExpiry+Product" }`).
  * URL format is validated via strict HTTP/HTTPS regular expressions in validators.
  * Direct file upload pipelines require cloud storage integration (Cloudinary) to host merchant product photos and complaint evidence assets.
* **Background Jobs**:
  * In-process scheduler driven by `node-cron` v4.6.0 in `backend/src/jobs/index.js`.
  * Executes daily midnight FEFO expiry sweeps (`0 0 * * *`) and hourly price recalculation checks (`0 * * * *`).
  * Executes an idempotent `STARTUP_SYNC` job on server boot to update dynamic pricing and lock expired inventory immediately.

---

## 2. Student-Friendly Architecture Recommendations & Cost Comparison

As a student with a limited budget, the primary goals are:
1. **Zero or near-zero starting cost** while building and demonstrating the project.
2. **High availability and reliability** for evaluators and real users.
3. **No complex operations** (avoiding costly managed Kubernetes, multi-zone clusters, or complex microservices).
4. **Clean upgrade path** to production scaling when traffic warrants it.

### 2.1 Architecture Option 1: Modern Cloud Platform PaaS (RECOMMENDED)

In this decoupled architecture, static assets are globally distributed on an edge CDN, while the Node.js API runs as a managed web service, MongoDB is hosted on managed database infrastructure, and Redis operates in fallback or serverless mode.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTPS                        │ WSS / HTTPS
               ▼                              ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│    Frontend Host (Vercel)    │ │   Backend Host (Render /    │
│  - React 18 SPA + Vite build │ │           Railway)          │
│  - Global Edge CDN           │ │ - Express API + Socket.IO   │
│  - HTTPS Auto-SSL            │ │ - node-cron In-Process Jobs │
│  - Instant GitHub deploys    │ │ - Automatic TLS Termination │
└──────────────────────────────┘ └──────────────┬──────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     │ MONGODB_URI (TLS)                                   │ REDIS_URL (TLS)
                     ▼                                                     ▼
┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐
│         MongoDB Atlas (M0 Free Tier)         │ │         Upstash Redis (Free Tier)           │
│ - 512 MB Storage                             │ │ - 256 MB Cache                              │
│ - 500 Concurrent Connections                 │ │ - 500,000 Commands/Month                    │
│ - Automated TLS Encryption                   │ │ - Or Database-Direct Fallback (₹0)          │
└──────────────────────────────────────────────┘ └─────────────────────────────────────────────┘
```

#### Provider Breakdown:
1. **Frontend**: **Vercel Hobby Plan** (Cost: **₹0**)
   * 100 GB monthly bandwidth, unlimited deployments, automatic HTTPS via Let's Encrypt, global edge CDN.
   * Native support for Vite build output and SPA rewrite rules.
2. **Backend**: **Render Web Service** (Cost: **₹0** Free Tier, or **₹590/month** on Starter Plan)
   * Free Tier includes 512 MB RAM, 0.1 CPU, 750 free instance hours per month, and native WebSocket support.
   * *Free Tier Limitation*: Spins down after 15 minutes of inactivity; initial wake-up takes ~50 seconds.
   * *Alternative*: **Railway Hobby Plan** ($5/mo ≈ **₹420/month**) providing continuous, non-sleeping execution with persistent WebSockets and cron jobs.
3. **Database**: **MongoDB Atlas M0 Free Cluster** (Cost: **₹0**)
   * 512 MB storage, 500 max connections, triple-node replica set, TLS encryption.
4. **Media Storage**: **Cloudinary Free Plan** (Cost: **₹0**)
   * 25 monthly credits (up to 25 GB managed storage or 25,000 transformations), CDN delivery.
5. **Caching**: **Database-Direct Mode** initially (`REDIS_ENABLED=false`, Cost: **₹0**) or **Upstash Redis Free Tier** (Cost: **₹0**, 256 MB, 500,000 commands/month).

---

### 2.2 Architecture Option 2: Single-Node Linux VPS with Docker Compose (ALTERNATIVE)

Deploying the verified [`docker-compose.prod.yml`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/docker-compose.prod.yml) stack to an entry-level Linux Virtual Private Server (VPS).

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS:443 / HTTP:80
                               ▼
┌─────────────────────────────────────────────────────────────┐
│     Single Cloud VPS (Hetzner Cloud CX22 / DigitalOcean)    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                Host Nginx + Certbot                   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Reverse Proxy Port 80        │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     Docker Network: nearexpiry-network (Phase 25)     │  │
│  │  ┌──────────────┐     ┌──────────────┐                │  │
│  │  │   frontend   │────▶│   backend    │                │  │
│  │  │(Nginx Static)│     │(Node/Express)│                │  │
│  │  └──────────────┘     └──────┬───────┘                │  │
│  │                              │                        │  │
│  │                ┌─────────────┴─────────────┐          │  │
│  │                ▼                           ▼          │  │
│  │         ┌──────────────┐            ┌──────────────┐  │  │
│  │         │   mongodb    │            │    redis     │  │  │
│  │         │  (mongo:7.0) │            │(redis:7-alp.)│  │  │
│  │         └──────────────┘            └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Provider Breakdown:
* **Host**: Hetzner Cloud CX22 (2 vCPU, 4 GB RAM, 40 GB NVMe SSD) at ~€3.79/month (**₹350/month**) or DigitalOcean Basic Droplet at $6/month (**₹500/month**).
* **Architecture**: Direct reuse of Phase 25 Docker images without modification.
* **Trade-offs**: Requires manual Linux server maintenance, security hardening, firewall management, and manual database backup scripts.

---

### 2.3 Detailed Monthly Cost Comparison (INR)

| Component | Architecture 1 (Free PaaS MVP) | Architecture 1 (Always-On PaaS) | Architecture 2 (Single VPS Docker) |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel Hobby: **₹0** | Vercel Hobby: **₹0** | Hosted on VPS: **₹0** |
| **Backend** | Render Free Tier: **₹0** | Render Starter / Railway: **₹420 – ₹590** | Included in VPS: **₹0** |
| **Database** | MongoDB Atlas M0: **₹0** | MongoDB Atlas M0: **₹0** | Local Docker Mongo: **₹0** |
| **Redis** | Disabled / Upstash: **₹0** | Upstash Redis Free: **₹0** | Local Docker Redis: **₹0** |
| **Cloudinary** | Free Tier (25 credits): **₹0** | Free Tier: **₹0** | Free Tier: **₹0** |
| **Domain Name** | Free subdomain (`.vercel.app`): **₹0** | Custom `.in` domain: **₹45/mo** (₹540/yr) | Custom `.in` domain: **₹45/mo** |
| **Total Estimated Cost** | **₹0 / month** | **₹465 – ₹635 / month** | **₹350 – ₹545 / month** |

> **Recommendation**: Start with **Architecture 1 (Free PaaS MVP)** at **₹0/month**. Evaluators can test all features using free subdomains. If cold starts become an inconvenience during demonstrations, upgrade only the backend to Render Starter ($7/mo) or Railway ($5/mo).

---

## 3. Frontend Deployment Plan (Vercel)

### 3.1 GitHub Repository Setup
1. Push the NearExpiry repository to GitHub on branch `main`.
2. Ensure [`.gitignore`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/.gitignore) is present in the repository root and excludes all local `.env` files.

### 3.2 Project Creation on Vercel
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project** and import your GitHub repository.
3. Configure the build and project settings:
   * **Framework Preset**: `Vite` (automatically detected).
   * **Root Directory**: Click *Edit* and select `frontend`.
   * **Build Command**: `npm run build` (runs `vite build`).
   * **Output Directory**: `dist` (default Vite production build output).
   * **Install Command**: `npm ci` or `npm install`.

### 3.3 Production Environment Variables
In the Vercel Project Settings under **Environment Variables**, add:
* `VITE_API_URL`: `https://<your-backend-app>.onrender.com/api/v1`
* `VITE_SOCKET_URL`: `https://<your-backend-app>.onrender.com`

> [!IMPORTANT]
> Both variables must begin with `https://` (not `http://` or `localhost`). Vite statically bakes these values into the compiled JavaScript bundle at build time. Whenever these variables change, you must trigger a new deployment.

### 3.4 React Router SPA Routing Configuration
Vite generates a client-side Single Page Application. Direct browser navigation to deep routes (e.g. `/marketplace`, `/seller/dashboard`, `/login`) or pressing browser refresh will produce a 404 error on Vercel unless rewrite rules are provided.

To support client-side routing, create a `vercel.json` file inside the `frontend/` directory:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 3.5 Verification Checklist After Deployment
* Navigate to `https://<your-app>.vercel.app/` — landing page renders without console errors.
* Navigate directly to `https://<your-app>.vercel.app/marketplace` via URL bar — page loads correctly without 404.
* Open Browser DevTools > Network tab: Confirm API calls target `https://<your-backend-app>.onrender.com/api/v1/...` with status 200/201.
* Check WebSocket connection in Network > WS tab: Status 101 Switching Protocols against the backend domain.

---

## 4. Backend Deployment Plan (Render / Railway)

### 4.1 Deployment on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Select your GitHub repository.
4. Configure service parameters:
   * **Name**: `nearexpiry-api`
   * **Region**: `Singapore` or `Frankfurt` (choose the region closest to your users and MongoDB Atlas cluster).
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm ci --omit=dev`
   * **Start Command**: `node src/server.js` (or `npm start`)
   * **Instance Type**: `Free` (512 MB RAM, 0.1 CPU)

### 4.2 Port Binding and Health Checks
* Render dynamically injects a `PORT` environment variable (e.g., `10000`).
* NearExpiry's [`backend/src/server.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/server.js#L20) binds directly to `env.PORT`:
  ```javascript
  server.listen(env.PORT, () => { ... });
  ```
* Set Render's **Health Check Path** to `/api/v1/health`. Render verifies this path before directing traffic to newly deployed instances.

### 4.3 WebSocket & Proxy Configuration
* Render provides built-in SSL termination (`https://` and `wss://`).
* In [`backend/src/app.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/app.js#L15), `app.set('trust proxy', 1)` is already configured, ensuring `express-rate-limit` and client IP logging accurately inspect `X-Forwarded-For` headers from the proxy.
* Socket.IO handshakes (`polling` and `websocket`) operate transparently over port 443.

### 4.4 Managing Cold Starts on Free Tier
On Render's Free tier, the service spins down after 15 minutes of inactivity.
* **Impact**: The first HTTP request after inactivity takes 45–60 seconds to respond while the container starts.
* **Cron Impact**: In-process `node-cron` jobs will pause during inactive sleep windows. However, NearExpiry's [`initializeBackgroundJobs()`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/jobs/index.js#L12-L18) runs a `STARTUP_SYNC` on every server boot, immediately correcting batch statuses and dynamic markdowns upon waking up.
* **Mitigation (Free)**: Configure a free uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com)) to ping `https://<your-api>.onrender.com/api/v1/health` every 10 minutes to keep the service warm during testing hours.

---

## 5. MongoDB Atlas Setup & Data Migration

### 5.1 Cluster Provisioning
1. Register for an account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a new Organization and Project named `NearExpiry-Production`.
3. Click **Deploy a Database** and select **M0 Free** (Shared).
4. Choose Cloud Provider: **AWS**, Region: **ap-south-1 (Mumbai)** or the closest available region to minimize network latency.
5. Set Cluster Name: `nearexpiry-cluster`.

### 5.2 Security & Least-Privilege Access
1. **Database User**:
   * Navigate to **Database Access** > **Add New Database User**.
   * Authentication Method: **Password**.
   * Username: `nearexpiry_app_user`.
   * Password: Generate a secure 32-character random string (avoid symbols like `@`, `:`, `/`, or percent-encode them).
   * Database User Privileges: Select **Built-in Role** > **Read and write to any database** (or restrict strictly to `nearexpiry` database).
2. **Network Access (IP Whitelist)**:
   * Navigate to **Network Access** > **Add IP Address**.
   * Since PaaS platforms (Render, Railway, Vercel) use dynamic outbound IP addresses, select **Allow Access from Anywhere** (`0.0.0.0/0`).
   * *Security Guard*: Because the database has a strong user password, SCRAM-SHA-256 authentication, and TLS encryption, `0.0.0.0/0` is standard and safe for managed PaaS applications without dedicated static IP egress.

### 5.3 Connection String Construction
1. Under Database Deployments, click **Connect** > **Drivers** (Node.js).
2. Copy the SRV URI format:
   ```
   mongodb+srv://nearexpiry_app_user:<password>@nearexpiry-cluster.xxxx.mongodb.net/nearexpiry?retryWrites=true&w=majority&appName=NearExpiry
   ```
3. Test connectivity locally in PowerShell before setting in production:
   ```powershell
   mongosh "mongodb+srv://nearexpiry-cluster.xxxx.mongodb.net/nearexpiry" --username nearexpiry_app_user
   ```

### 5.4 Database Initialization Strategy
Do **NOT** copy development test orders or volatile scratch data to production.
1. When the backend connects to MongoDB Atlas for the first time, Mongoose creates collection indexes automatically.
2. In [`backend/src/server.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/server.js#L18), the startup hook seeds default dynamic pricing rules (`priceRules`) into the clean database.
3. To seed initial product categories, log in as the newly created Admin user or execute a clean category seed script:
   ```powershell
   node -e "import('./src/seeds/category.seed.js')"
   ```

---

## 6. Environment Variables and Secrets Matrix

The following matrix documents every environment variable utilized by NearExpiry.

| Variable Name | Required? | Service | Scope | Purpose | Example / Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Backend | Backend Private | Sets application environment mode | `production` |
| `PORT` | **Yes** | Backend | Backend Private | Web service port binding | `10000` (PaaS provided) or `5000` |
| `API_PREFIX` | **Yes** | Backend | Backend Private | Prefix for REST API route mounts | `/api/v1` |
| `MONGODB_URI` | **Yes** | Backend | **SECRET** | Authenticated Atlas connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/nearexpiry` |
| `CORS_ORIGIN` | **Yes** | Backend | Backend Private | Allowed frontend origins (comma-separated) | `https://nearexpiry.vercel.app` |
| `CLIENT_URL` | **Yes** | Backend | Backend Private | Public frontend root domain | `https://nearexpiry.vercel.app` |
| `JWT_SECRET` | **Yes** | Backend | **SECRET** | HMAC signing key for JWT tokens (min 32 chars) | `3dcffe61...` (64-character hex) |
| `JWT_EXPIRES_IN` | No | Backend | Backend Private | Lifetime for access tokens | `7d` |
| `JWT_REFRESH_SECRET`| **Yes** | Backend | **SECRET** | Refresh token HMAC secret (min 32 chars) | `196d8ef8...` (64-character hex) |
| `JWT_REFRESH_EXPIRES_IN` | No | Backend | Backend Private | Lifetime for refresh tokens | `30d` |
| `QR_SIGNING_SECRET` | **Yes** | Backend | **SECRET** | HMAC key for tamper-proof pickup QR tokens | `c102d394...` (64-character hex) |
| `BCRYPT_SALT_ROUNDS`| No | Backend | Backend Private | Work factor for password hashing | `12` |
| `RATE_LIMIT_WINDOW_MS` | No | Backend | Backend Private | Rate limiting time window in milliseconds | `900000` (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Backend | Backend Private | Max requests permitted per IP per window | `150` |
| `REDIS_ENABLED` | **Yes** | Backend | Backend Private | Toggles Redis cache layer (`true` or `false`) | `false` (for ₹0 setup) or `true` |
| `REDIS_URL` | Optional | Backend | **SECRET** | Standard connection URI for managed Redis | `rediss://default:token@cluster.upstash.io:6379` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Backend | Backend Private | Cloudinary tenant account name | `nearexpiry-prod` |
| `CLOUDINARY_API_KEY` | Optional | Backend | Backend Private | Cloudinary API Key | `918273645192837` |
| `CLOUDINARY_API_SECRET` | Optional | Backend | **SECRET** | Cloudinary API Secret Key | `abCdeFghIjklMnop` |
| `VITE_API_URL` | **Yes** | Frontend | **PUBLIC** | Full URL to backend REST API | `https://nearexpiry-api.onrender.com/api/v1` |
| `VITE_SOCKET_URL` | **Yes** | Frontend | **PUBLIC** | Full URL to backend Socket.IO origin | `https://nearexpiry-api.onrender.com` |

> [!CAUTION]
> Variables prefixed with `VITE_` are publicly accessible in client browser sources. Never store database credentials, JWT secrets, or cloud API keys in variables prefixed with `VITE_`.

### 6.1 Generating Cryptographically Secure Secrets
Run the following Node command in PowerShell to generate independent 32-byte (64-hex character) secrets:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Generate three distinct keys for:
1. `JWT_SECRET`
2. `JWT_REFRESH_SECRET`
3. `QR_SIGNING_SECRET`

---

## 7. CORS, HTTPS, Domain, and DNS Strategy

### 7.1 Cross-Origin Resource Sharing (CORS) Configuration
Because the frontend and backend are hosted on separate domains (`*.vercel.app` and `*.onrender.com`):
1. In the backend settings, set `CORS_ORIGIN`:
   ```env
   CORS_ORIGIN=https://nearexpiry.vercel.app
   ```
2. If supporting a custom domain later:
   ```env
   CORS_ORIGIN=https://nearexpiry.vercel.app,https://nearexpiry.in,https://www.nearexpiry.in
   ```
3. **No Trailing Slashes**: Never include trailing slashes in origins (use `https://nearexpiry.in`, not `https://nearexpiry.in/`).
4. **No Wildcard with Credentials**: Since `credentials: true` is configured in `backend/src/config/cors.js`, setting `CORS_ORIGIN=*` will cause modern browsers to block all authenticated API requests.

### 7.2 Custom Domain Setup (Optional Stage)
If purchasing a custom domain (e.g., `nearexpiry.in` via Namecheap or Cloudflare Registrar for ~₹500/year):
* **Frontend DNS**:
  * In Vercel, navigate to **Settings** > **Domains** > Add `nearexpiry.in` and `www.nearexpiry.in`.
  * Add the DNS records in your domain registrar:
    * `A` record for `@` pointing to `76.76.21.21` (Vercel IP).
    * `CNAME` record for `www` pointing to `cname.vercel-dns.com`.
* **Backend DNS**:
  * In Render, navigate to **Settings** > **Custom Domains** > Add `api.nearexpiry.in`.
  * In your registrar, add a `CNAME` record:
    * `CNAME` for `api` pointing to your Render onrender address (`nearexpiry-api.onrender.com`).
* **HTTPS Certificates**: Both Vercel and Render issue and renew Let's Encrypt SSL/TLS certificates automatically with zero configuration.

---

## 8. Cloudinary Media Storage Setup

### 8.1 Why Cloudinary is Recommended for NearExpiry
* Platforms like Render and Railway have **ephemeral filesystems**: any images saved to local disk (`/app/uploads`) are deleted whenever the container restarts, sleeps, or redeploys.
* Cloudinary provides persistent cloud hosting, automated format conversion (WebP/AVIF), and responsive resizing for product listings.

### 8.2 Integration Workflow
1. Register for a free account at [cloudinary.com](https://cloudinary.com).
2. Retrieve your **Cloud Name**, **API Key**, and **API Secret** from the Cloudinary Console Dashboard.
3. Configure these exclusively in the backend environment variables.
4. When a merchant uploads a product photo or a customer uploads complaint evidence, the backend streams the image to Cloudinary folder `nearexpiry/products` and stores the resulting secure HTTPS URL (`https://res.cloudinary.com/...`) in MongoDB.
5. In the Cloudinary Console, enable **Auto-Formatting** and **Auto-Quality** (`f_auto,q_auto`) to minimize bandwidth usage against the 25-credit monthly quota.

---

## 9. Optional Redis & Socket.IO Considerations

### 9.1 Can NearExpiry Run Safely Without Redis?
**Yes.** In Phase 23, NearExpiry was engineered with intelligent cache decoupling:
* When `REDIS_ENABLED=false` is set in the environment:
  [`backend/src/config/redis.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/config/redis.js#L16-L21) logs:
  `ℹ️ [Redis] Caching is disabled (REDIS_ENABLED=false). Running in database-direct mode.`
* The cache utility helper (`remember()`) catches the null client and immediately executes the database query fallback.
* All FEFO batch calculations, order creation transactions, and user logins run with 100% ACID consistency directly against MongoDB.

### 9.2 When to Enable Redis
Enable Redis when:
1. Public marketplace browsing traffic increases beyond 100 requests per minute.
2. Category listings and popular products are queried frequently.
3. You set up a free Upstash Redis instance (256 MB) and provide `REDIS_URL=rediss://default:<token>@<host>:6379` with `REDIS_ENABLED=true`.

### 9.3 Socket.IO Multi-Instance Scaling Rule
* **Single Backend Instance**: In-memory Socket.IO rooms (`user:<id>`, `store:<id>`, `admin:alerts`) work natively.
* **Multiple Backend Instances**: If you scale the backend to 2 or more instances in the future, clients connected to Instance A cannot receive events emitted from Instance B unless you install `@socket.io/redis-adapter` backed by Redis. For the student MVP, a single backend instance is sufficient and avoids adapter complexity.

---

## 10. Operational Logging, Monitoring & Reliability

### 10.1 Structured Logging
* [`backend/src/app.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/app.js#L25) uses `morgan('combined')` in production, writing standard Apache-style access logs (client IP, HTTP method, path, status, response time) to stdout.
* The centralized error handler ([`backend/src/middleware/error.middleware.js`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/backend/src/middleware/error.middleware.js)) sanitizes stack traces, ensuring internal database connection strings and passwords are never leaked in API error responses.

### 10.2 Uptime Monitoring (Zero Cost)
Set up a free monitor on [UptimeRobot](https://uptimerobot.com) or [BetterStack](https://betterstack.com):
* **Monitor Type**: HTTP(s).
* **URL**: `https://<your-backend-app>.onrender.com/api/v1/health`.
* **Interval**: Every 5 to 10 minutes.
* **Notification**: Email / SMS alerts if the health endpoint returns non-200 or times out.
* **Bonus**: Pinging every 10 minutes prevents Render Free tier from spinning down during daytime evaluation hours.

### 10.3 Database Backups on MongoDB Atlas M0
Atlas M0 does not support automated cloud backup snapshots. To protect production data:
1. Schedule a monthly manual export using `mongodump` from PowerShell:
   ```powershell
   mongodump --uri="mongodb+srv://nearexpiry_app_user:<password>@nearexpiry-cluster.xxxx.mongodb.net/nearexpiry" --out="./backup_$(Get-Date -Format 'yyyyMMdd')"
   ```
2. Store the encrypted backup on a secure local drive or private cloud storage.

---

## 11. Rollback & Disaster Recovery Procedures

### 11.1 Frontend Rollback (Instant)
If a bad frontend release breaks the UI:
1. Open the **Vercel Dashboard** > Select Project > **Deployments**.
2. Locate the previous stable deployment.
3. Click the three dots (`...`) > **Instant Rollback**.
4. Vercel routes 100% of CDN traffic back to the prior build in less than 5 seconds.

### 11.2 Backend Rollback
1. In the **Render Dashboard**, navigate to the **Deploys** tab.
2. Select the commit hash of the previous known working build.
3. Click **Rollback to this deploy**.
4. The service will rebuild and deploy the prior commit without downtime.

### 11.3 Database Recovery
If bad data is written to MongoDB Atlas:
1. Use `mongorestore` to restore from the latest `mongodump` archive:
   ```powershell
   mongorestore --uri="mongodb+srv://nearexpiry_app_user:<password>@nearexpiry-cluster.xxxx.mongodb.net/nearexpiry" --drop ./backup_20261011/nearexpiry
   ```
2. The `--drop` flag replaces affected collections with their backup state.

