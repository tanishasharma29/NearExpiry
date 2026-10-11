# NearExpiry — Production Deployment Checklist (Phase 26)

> **Document Status**: Step-by-Step Operator Runbook  
> **Target Audience**: Student Operator / Administrator  
> **Convention**: Every action is clearly labeled with its operational status:
> - `[PLANNING/DOC ONLY]` — Background guidance or architectural context.
> - `[MANUAL ACTION REQUIRED]` — Action the operator must perform in an external dashboard or terminal.
> - `[OPTIONAL FUTURE IMPROVEMENT]` — Optimization that can be deferred.
> - `[APPROVAL REQUIRED]` — Step requiring user approval before execution.

---

## 1. Phase 1 — Pre-Deployment Preparation

- [ ] `[PLANNING/DOC ONLY]` Review [`docs/PHASE_26_DEPLOYMENT_PLAN.md`](file:///c:/Users/User/OneDrive/Desktop/NearExpiry/docs/PHASE_26_DEPLOYMENT_PLAN.md) to understand the recommended architecture (Vercel + Render + MongoDB Atlas).
- [ ] `[MANUAL ACTION REQUIRED]` Verify Git repository status on the local machine:
  ```powershell
  git status
  ```
  Ensure all desired changes are committed to the `main` branch.
- [ ] `[MANUAL ACTION REQUIRED]` Generate 3 independent, cryptographically secure 32-byte secret keys:
  ```powershell
  node -e "console.log('JWT_SECRET: ' + require('crypto').randomBytes(32).toString('hex'))"
  node -e "console.log('JWT_REFRESH_SECRET: ' + require('crypto').randomBytes(32).toString('hex'))"
  node -e "console.log('QR_SIGNING_SECRET: ' + require('crypto').randomBytes(32).toString('hex'))"
  ```
  Store these securely in an offline password manager. Never commit them to Git.
- [ ] `[MANUAL ACTION REQUIRED]` Create accounts on the required hosting platforms (if not already created):
  - [MongoDB Atlas](https://www.mongodb.com/atlas)
  - [Render](https://render.com) (or [Railway](https://railway.app))
  - [Vercel](https://vercel.com)
  - [Cloudinary](https://cloudinary.com) (Optional for media uploads)

---

## 2. Phase 2 — MongoDB Atlas Provisioning

- [ ] `[MANUAL ACTION REQUIRED]` Create an Atlas Organization and Project named `NearExpiry-Production`.
- [ ] `[MANUAL ACTION REQUIRED]` Deploy an **M0 Free Cluster** (Shared) in AWS region `ap-south-1 (Mumbai)` named `nearexpiry-cluster`.
- [ ] `[MANUAL ACTION REQUIRED]` Add a Database User under **Database Access**:
  - Username: `nearexpiry_app_user`
  - Password: Strong generated password
  - Privileges: `Read and write to any database`
- [ ] `[MANUAL ACTION REQUIRED]` Configure Network Access under **Network Access**:
  - Add IP Address: `0.0.0.0/0` (Allow Access from Anywhere) with comment "PaaS dynamic IP access".
- [ ] `[MANUAL ACTION REQUIRED]` Retrieve the connection string URI under **Connect** > **Drivers**:
  ```
  mongodb+srv://nearexpiry_app_user:<password>@nearexpiry-cluster.xxxx.mongodb.net/nearexpiry?retryWrites=true&w=majority&appName=NearExpiry
  ```
- [ ] `[MANUAL ACTION REQUIRED]` Test the Atlas connection from your local terminal:
  ```powershell
  mongosh "<your_mongodb_uri>"
  ```
  Confirm connection succeeds with `{ ok: 1 }`.

---

## 3. Phase 3 — Backend Web Service Deployment (Render)

- [ ] `[MANUAL ACTION REQUIRED]` In Render Dashboard, click **New +** > **Web Service**.
- [ ] `[MANUAL ACTION REQUIRED]` Connect your GitHub repository.
- [ ] `[MANUAL ACTION REQUIRED]` Configure service parameters:
  - **Name**: `nearexpiry-api`
  - **Region**: `Singapore` or `Frankfurt`
  - **Root Directory**: `backend`
  - **Environment**: `Node`
  - **Build Command**: `npm ci --omit=dev`
  - **Start Command**: `node src/server.js`
  - **Instance Type**: `Free`
- [ ] `[MANUAL ACTION REQUIRED]` Set Backend Environment Variables in Render:
  - `NODE_ENV`: `production`
  - `API_PREFIX`: `/api/v1`
  - `MONGODB_URI`: `<your_atlas_connection_uri>`
  - `JWT_SECRET`: `<generated_jwt_secret>`
  - `JWT_REFRESH_SECRET`: `<generated_jwt_refresh_secret>`
  - `QR_SIGNING_SECRET`: `<generated_qr_signing_secret>`
  - `BCRYPT_SALT_ROUNDS`: `12`
  - `RATE_LIMIT_WINDOW_MS`: `900000`
  - `RATE_LIMIT_MAX_REQUESTS`: `150`
  - `REDIS_ENABLED`: `false` (or provide Upstash credentials if enabled)
  - `CORS_ORIGIN`: `https://nearexpiry.vercel.app` (or your temporary Vercel project URL)
  - `CLIENT_URL`: `https://nearexpiry.vercel.app`
- [ ] `[MANUAL ACTION REQUIRED]` Set Health Check Path: `/api/v1/health`.
- [ ] `[APPROVAL REQUIRED]` Click **Deploy Web Service** to launch the backend build.
- [ ] `[MANUAL ACTION REQUIRED]` Monitor deploy logs until `🚀 NearExpiry Backend running in [PRODUCTION] mode` appears.
- [ ] `[MANUAL ACTION REQUIRED]` Copy your assigned backend URL: `https://<your-service>.onrender.com`.
- [ ] `[MANUAL ACTION REQUIRED]` Verify health endpoint in browser or terminal:
  ```powershell
  curl https://<your-service>.onrender.com/api/v1/health
  ```
  Confirm response: `{"success":true,"message":"NearExpiry API is running"}`.

---

## 4. Phase 4 — Frontend Client Deployment (Vercel)

- [ ] `[MANUAL ACTION REQUIRED]` Verify `vercel.json` exists in `frontend/`:
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
- [ ] `[MANUAL ACTION REQUIRED]` In Vercel Dashboard, click **Add New...** > **Project** and import your GitHub repository.
- [ ] `[MANUAL ACTION REQUIRED]` Configure project build settings:
  - **Framework Preset**: `Vite`
  - **Root Directory**: `frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
  - **Install Command**: `npm ci`
- [ ] `[MANUAL ACTION REQUIRED]` Set Frontend Environment Variables in Vercel:
  - `VITE_API_URL`: `https://<your-service>.onrender.com/api/v1`
  - `VITE_SOCKET_URL`: `https://<your-service>.onrender.com`
- [ ] `[APPROVAL REQUIRED]` Click **Deploy** to start the frontend production build.
- [ ] `[MANUAL ACTION REQUIRED]` Copy your assigned Vercel URL: `https://<your-project>.vercel.app`.
- [ ] `[MANUAL ACTION REQUIRED]` Update the backend's `CORS_ORIGIN` in Render with the exact Vercel URL to ensure cross-origin requests are authorized.

---

## 5. Phase 5 — Post-Deployment Verification & Smoke Tests

- [ ] `[MANUAL ACTION REQUIRED]` **Landing Page**: Navigate to `https://<your-project>.vercel.app/` — verify branding, navigation header, and product categories load.
- [ ] `[MANUAL ACTION REQUIRED]` **SPA Direct Navigation**: Open a new browser tab directly to `https://<your-project>.vercel.app/marketplace` — verify page renders and does not return a 404.
- [ ] `[MANUAL ACTION REQUIRED]` **Network Traffic Audit**:
  - Open Browser DevTools > **Network** tab.
  - Verify all API calls target `https://<your-service>.onrender.com/api/v1/...` and return HTTP 200.
  - Confirm zero mixed-content warnings (all assets use HTTPS).
  - Confirm zero references to `localhost` or port `5000`.
- [ ] `[MANUAL ACTION REQUIRED]` **Customer Registration & Login**:
  - Register a new customer account (`customer_test@nearexpiry.test`).
  - Verify JWT token is saved in `localStorage`.
- [ ] `[MANUAL ACTION REQUIRED]` **Real-time Socket.IO Connection**:
  - Inspect Network tab > **WS** filter.
  - Verify WebSocket handshake reaches `https://<your-service>.onrender.com/socket.io/?...` with HTTP 101 Switching Protocols.
- [ ] `[MANUAL ACTION REQUIRED]` **Store Seller Flow**:
  - Register a test seller (`seller_test@nearexpiry.test`) with a store profile.
  - Verify seller dashboard displays appropriate verification status.
- [ ] `[MANUAL ACTION REQUIRED]` **Order Checkout & FEFO Inventory**:
  - Add a product to the cart.
  - Complete a test order checkout.
  - Verify order confirmation appears and inventory updates accurately.

---

## 6. Phase 6 — Continuous Monitoring & Maintenance

- [ ] `[MANUAL ACTION REQUIRED]` Set up a free HTTP health check on [UptimeRobot](https://uptimerobot.com):
  - Monitor URL: `https://<your-service>.onrender.com/api/v1/health`
  - Interval: 5 to 10 minutes (keeps the free-tier service warm and alerts on failure).
- [ ] `[OPTIONAL FUTURE IMPROVEMENT]` Purchase a custom domain (e.g. `nearexpiry.in`) and configure DNS records on Vercel and Render.
- [ ] `[OPTIONAL FUTURE IMPROVEMENT]` Enable Upstash Redis (`REDIS_ENABLED=true`) when marketplace browsing traffic exceeds 100 requests/minute.
- [ ] `[OPTIONAL FUTURE IMPROVEMENT]` Integrate Cloudinary API credentials in backend environment variables for automated image uploads.

---

## 7. Phase 7 — Emergency Rollback Procedures

- [ ] `[PLANNING/DOC ONLY]` **Frontend Emergency Rollback**:
  - Navigate to Vercel Dashboard > Project > **Deployments**.
  - Select previous known good deployment > Click `...` > **Instant Rollback**.
- [ ] `[PLANNING/DOC ONLY]` **Backend Emergency Rollback**:
  - Navigate to Render Dashboard > Web Service > **Deploys**.
  - Select previous working commit > Click **Rollback to this deploy**.
- [ ] `[PLANNING/DOC ONLY]` **Database Disaster Recovery**:
  - Restore data using `mongorestore` with `--drop` flag from an offline `mongodump` archive.

