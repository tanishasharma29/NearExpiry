# NearExpiry — Production Scaling Roadmap (Phase 26)

> **Document Status**: Production Scalability & Capacity Planning Architecture  
> **Target Audience**: Technical Founders, Systems Architects, Engineering Leads  
> **Planning Horizon**: Student MVP (Stage A) ➔ Growing Commercial Usage (Stage B) ➔ Production Scale (Stage C)

---

## 1. Scalability Principles for NearExpiry

NearExpiry's core value proposition is high-throughput real-time inventory allocation under strict FEFO (First-Expired, First-Out) rules, dynamic discount recalculations, and counter-level QR code handovers.

Premature scaling (introducing Kubernetes clusters, distributed microservices, or complex message queues before achieving product-market fit) creates unnecessary financial strain and maintenance overhead for a student project. The recommended strategy is **metric-driven, phased scaling**: upgrade infrastructure only when measurable thresholds are reached.

```
       Stage A: Student MVP                Stage B: Growing Commercial              Stage C: High-Volume Production
   (0 - 500 Daily Active Users)          (500 - 5,000 Daily Active Users)         (5,000 - 50,000+ Daily Active Users)
    ┌──────────────────────────┐           ┌───────────────────────────┐           ┌───────────────────────────┐
    │ - Vercel Free Edge CDN   │           │ - Custom Domain Edge CDN  │           │ - Multi-Region Edge CDN   │
    │ - 1 Node/Express Instance│   ───▶    │ - 1 Always-On 2GB Instance│   ───▶    │ - Auto-Scaled Node Nodes  │
    │ - MongoDB Atlas M0 (Free)│           │ - MongoDB Atlas M10/Flex  │           │ - MongoDB Replica Cluster │
    │ - Redis Fallback / Free  │           │ - Managed Redis (Upstash) │           │ - Redis Cluster + Adapter │
    │ Cost: ₹0 - ₹500 / month  │           │ Cost: ₹1,500 - ₹3,500 / mo│           │ Cost: ₹8,000 - ₹20,000 /mo│
    └──────────────────────────┘           └───────────────────────────┘           └───────────────────────────┘
```

---

## 2. Stage A — Student Deployment & Initial MVP

### 2.1 Target Scale & Workload
* **Target Audience**: Academic evaluators, initial beta testers, 5–10 pilot retail stores.
* **Daily Active Users (DAU)**: 10 to 500 users.
* **Concurrent Checkouts**: 1 to 5 orders per minute.
* **Data Volume**: Under 100 MB of database storage (a few thousand products and batches).

### 2.2 Infrastructure Configuration
* **Frontend**: React 18 SPA hosted on **Vercel Hobby** (Free tier). Global edge caching of static HTML/JS/CSS assets.
* **Backend**: Single Node.js 20 Express instance on **Render Web Service (Free Tier)** or **Railway ($5/mo ≈ ₹420/mo)**.
* **Database**: **MongoDB Atlas M0 Free Cluster** (512 MB shared RAM/storage, 500 concurrent connections).
* **Caching**: **Database-Direct Fallback** (`REDIS_ENABLED=false`) or **Upstash Redis Free Tier** (256 MB, 500k commands/month).
* **Media**: **Cloudinary Free Tier** (25 credits/month for product images).
* **Real-time**: Single in-process Socket.IO instance handling WebSocket connections directly.
* **Background Jobs**: In-process `node-cron` running midnight expiry processing and startup sync.

### 2.3 Estimated Monthly Cost (Stage A)
* **PaaS Free Tier**: **₹0 / month**
* **With Always-On Backend Upgrade**: **₹420 – ₹590 / month**

### 2.4 Limitations & Trade-offs
* Render free tier exhibits a ~50-second cold start when idle.
* In-process cron jobs pause during idle periods (mitigated by startup sync upon waking up).
* Atlas M0 does not support automated cloud backup snapshots (requires manual `mongodump`).

---

## 3. Stage B — Growing Commercial Usage

### 3.1 Upgrade Triggers & Metrics
Transition from Stage A to Stage B when any of the following metrics are observed:
1. **Traffic**: Active daily users exceed 500, or checkout frequency exceeds 20 orders/minute.
2. **Database Storage**: MongoDB Atlas data usage crosses 350 MB (70% of M0's 512 MB limit).
3. **Database Performance**: Mongoose query latency exceeds 200ms during peak evening marketplace hours.
4. **Reliability**: Evaluators or real customers report cold-start delays.

### 3.2 Infrastructure Configuration
* **Frontend**: Vercel Pro ($20/mo) or Vercel Hobby with a custom registered domain (`nearexpiry.in`).
* **Backend**: Upgraded to **Render Starter or Standard** (2 GB RAM, 1 Dedicated vCPU, $15–$25/mo ≈ ₹1,250–₹2,100/mo). Zero sleep, 24/7 continuous cron job execution.
* **Database**: Upgraded to **MongoDB Atlas Flex or M10 Dedicated Tier** ($10–$30/mo):
  * Automated point-in-time snapshot backups.
  * Dedicated vCPU and memory.
  * Storage auto-expansion up to 10 GB.
* **Caching**: Active **Upstash Redis** (Pay-as-you-go, ~$3–$10/mo) or a managed Redis instance.
  * `REDIS_ENABLED=true` accelerates marketplace deal queries and product catalog lookups with sub-5ms latency.
* **Media**: Cloudinary Plus Tier ($25/mo) or continued Free Tier with client-side image compression before upload.
* **Monitoring**: Sentry (free tier for error tracking) + UptimeRobot for continuous latency alerts.

### 3.3 Estimated Monthly Cost (Stage B)
* **Estimated Monthly Budget**: **₹1,500 to ₹3,500 / month** ($18 to $42 USD).

### 3.4 Key Architectural Improvements
* Compound database indexes on `{ storeId: 1, expiryDate: 1, status: 1 }` to keep FEFO queries under 10ms.
* Rate limiting increased and tuned to prevent aggressive scraping of promotional deals.

---

## 4. Stage C — Production Scale & Regional Growth

### 4.1 Upgrade Triggers & Metrics
Transition to Stage C when:
1. **Traffic**: Daily active users exceed 5,000, across 100+ participating retail stores.
2. **Concurrency**: Sustained peak checkouts exceed 100 transactions/minute.
3. **Compute Saturation**: Backend CPU utilization averages above 70% during peak flash-sale hours.
4. **WebSocket Load**: Concurrent open Socket.IO connections exceed 2,000 per instance.

### 4.2 Infrastructure Configuration

```
                                  [ Web & Mobile Clients ]
                                             │
                                             ▼
                                ┌──────────────────────────┐
                                │ Cloudflare Enterprise /  │
                                │   Fastly Edge WAF & CDN  │
                                └────────────┬─────────────┘
                                             │
                                             ▼
                                ┌──────────────────────────┐
                                │ Managed Cloud Load       │
                                │ Balancer (AWS ALB / GCP) │
                                └────────────┬─────────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     ▼                       ▼                       ▼
          ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
          │  Backend Instance 1 │ │  Backend Instance 2 │ │  Backend Instance N │
          │  (Node/Express API) │ │  (Node/Express API) │ │  (Autoscaling Node) │
          └──────────┬──────────┘ └──────────┬──────────┘ └──────────┬──────────┘
                     │                       │                       │
                     └───────────────────────┼───────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     │                                               │
                     ▼                                               ▼
          ┌─────────────────────┐                         ┌─────────────────────┐
          │  Redis Cluster 7    │                         │ MongoDB Atlas M30   │
          │  - Cache-Aside Layer│                         │  Replica Set (3 Node│
          │  - @socket.io/redis-│                         │ - Primary (Writes)  │
          │    adapter (Pub/Sub)│                         │ - 2x Secondaries    │
          └─────────────────────┘                         └─────────────────────┘
```

#### Key Architecture Changes in Stage C:
1. **Horizontal Backend Autoscaling**:
   * Multiple stateless Node.js container instances running behind a cloud load balancer.
2. **Socket.IO Distributed Adapter**:
   * When multiple backend instances exist, clients connected to Instance 1 cannot receive broadcasts triggered by Instance 2 without a message broker.
   * Attach `@socket.io/redis-adapter` (or Redis Streams adapter). Every `inventory:changed`, `order:new`, or `admin:alert` event publishes to Redis Pub/Sub, delivering events across all backend nodes seamlessly.
3. **Dedicated Background Worker**:
   * Decouple the hourly and midnight `expiryScheduler` jobs out of the API process into a dedicated lightweight worker process (e.g. BullMQ backed by Redis).
4. **MongoDB Replica Set with Read Preference**:
   * Route heavy analytic and reporting queries to MongoDB secondary read replicas (`ReadPreference.secondaryPreferred`), keeping the primary node dedicated to high-speed ACID order checkouts.

### 4.3 Estimated Monthly Cost (Stage C)
* **Estimated Monthly Budget**: **₹8,000 to ₹20,000 / month** ($95 to $240 USD).

---

## 5. Summary Table: Metrics, Triggers & Scaling Decisions

| Stage | Target DAU | Monthly Cost (INR) | Recommended Infrastructure | Key Scaling Action |
| :--- | :--- | :--- | :--- | :--- |
| **Stage A (MVP)** | 0 – 500 | **₹0 – ₹500** | Vercel + Render/Railway + Atlas M0 + DB-Direct / Upstash | Deploy decoupled PaaS; keep Redis optional; use single instance. |
| **Stage B (Growth)** | 500 – 5,000 | **₹1,500 – ₹3,500** | Vercel + 2GB Always-On Node + Atlas Flex/M10 + Active Redis | Register custom domain; activate Redis caching; enable automated Atlas backups. |
| **Stage C (Scale)** | 5,000 – 50,000+ | **₹8,000 – ₹20,000** | Autoscaled Node + Redis Cluster + Atlas M30 Replica Set | Add `@socket.io/redis-adapter`; decouple worker jobs; load balance horizontally. |

> [!TIP]
> **Golden Rule for Student Projects**: Never upgrade to Stage B or Stage C based on theoretical traffic projections. Scale only when production metrics, server memory graphs, or database capacity explicitly demand it.

