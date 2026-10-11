# NearExpiry — GitHub Actions CI/CD Guide (Phase 26)

> **Document Status**: Continuous Integration & Delivery Automation Plan  
> **Target Audience**: Student Developers, DevOps Engineers  
> **Workflow File**: `.github/workflows/ci-cd.yml` (Proposed Blueprint)

---

## 1. Overview of the CI/CD Pipeline

Continuous Integration and Continuous Delivery (CI/CD) ensures that whenever code is committed or a pull request is opened:
1. All automated backend unit and integration tests are executed in an isolated Linux runner.
2. The frontend React application compiles without bundling errors or missing dependencies.
3. Docker Compose configuration syntax is verified against base and production overrides.
4. Only when all quality checks pass is an automated deployment triggered to the cloud hosting providers.

```
                    ┌────────────────────────────┐
                    │    Push / PR to 'main'     │
                    └─────────────┬──────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           ▼                      ▼                      ▼
┌─────────────────────┐┌─────────────────────┐┌─────────────────────┐
│ 1. Backend Tests    ││ 2. Frontend Build   ││ 3. Docker Compose   │
│ - Node 20 Alpine    ││ - Node 20 Runner    ││    Validation       │
│ - MongoDB In-Memory ││ - Vite Build        ││ - Base Config       │
│ - Run 185 tests     ││ - Assets to dist/   ││ - Prod Config       │
└──────────┬──────────┘└──────────┬──────────┘└──────────┬──────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │ (All checks pass)
                                  ▼
                    ┌────────────────────────────┐
                    │ 4. Production Deployment   │
                    │ - Trigger Vercel Deploy Hook│
                    │ - Trigger Render Deploy Hook│
                    └────────────────────────────┘
```

---

## 2. Proposed GitHub Actions Workflow YAML

Create the workflow file at `.github/workflows/ci-cd.yml` in the repository root:

```yaml
name: NearExpiry CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # =========================================================================
  # 1. Backend Verification & Automated Test Suite
  # =========================================================================
  backend-tests:
    name: Backend Test Suite (Node.js 20)
    runs-on: ubuntu-latest

    services:
      # Ephemeral MongoDB service container for isolated testing
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017

      # Ephemeral Redis service container
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install Backend Dependencies
        working-directory: backend
        run: npm ci

      - name: Run Full Backend Regression Tests
        working-directory: backend
        env:
          NODE_ENV: test
          PORT: 5001
          MONGODB_URI: mongodb://127.0.0.1:27017/nearexpiry_test
          REDIS_ENABLED: true
          REDIS_HOST: 127.0.0.1
          REDIS_PORT: 6379
          JWT_SECRET: test_ci_cd_cryptographic_jwt_signing_key_32_chars_min
          JWT_REFRESH_SECRET: test_ci_cd_refresh_secret_key_32_characters_minimum
          QR_SIGNING_SECRET: test_ci_cd_qr_verification_signing_secret_key_32
        run: npm test

  # =========================================================================
  # 2. Frontend Production Compilation Check
  # =========================================================================
  frontend-build:
    name: Frontend Vite Production Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Frontend Dependencies
        working-directory: frontend
        run: npm ci

      - name: Compile Production Bundle
        working-directory: frontend
        env:
          VITE_API_URL: /api/v1
          VITE_SOCKET_URL: ""
        run: npm run build

  # =========================================================================
  # 3. Docker Compose Configuration Validation
  # =========================================================================
  docker-validation:
    name: Docker Configuration Validation
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Validate Base Compose
        run: docker compose config --quiet

      - name: Validate Production Compose Override
        env:
          JWT_SECRET: ci_cd_placeholder_jwt_secret_min_32_characters_for_validation
          JWT_REFRESH_SECRET: ci_cd_placeholder_refresh_secret_min_32_characters_for_validation
          QR_SIGNING_SECRET: ci_cd_placeholder_qr_secret_min_32_characters_for_validation
        run: docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet

  # =========================================================================
  # 4. Continuous Deployment (Executes ONLY on Push to 'main')
  # =========================================================================
  deploy:
    name: Trigger Cloud Deployments
    needs: [backend-tests, frontend-build, docker-validation]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - name: Trigger Render Backend Deploy Hook
        if: env.RENDER_DEPLOY_HOOK_URL != ''
        env:
          RENDER_DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        run: |
          echo "Triggering Render backend deployment..."
          curl -s -X POST "$RENDER_DEPLOY_HOOK_URL"

      - name: Trigger Vercel Frontend Deploy Hook
        if: env.VERCEL_DEPLOY_HOOK_URL != ''
        env:
          VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}
        run: |
          echo "Triggering Vercel frontend deployment..."
          curl -s -X POST "$VERCEL_DEPLOY_HOOK_URL"
```

---

## 3. Explaining Each Major Workflow Step

### 3.1 Job 1: `backend-tests`
* **Service Containers**: GitHub Actions automatically spins up official `mongo:7.0` and `redis:7-alpine` Docker containers alongside the runner, mapping standard ports `27017` and `6379`.
* **Deterministic Environment**: The test runner sets `NODE_ENV: test` and supplies temporary 32-character test secrets. Real production secrets are never used in test runners.
* **Coverage**: Runs the full 185-test suite (`npm test`), including Socket.IO real-time event tests and Redis cache failover tests. If even a single test fails, the entire pipeline aborts immediately, blocking deployment.

### 3.2 Job 2: `frontend-build`
* **Dependency Locking**: Uses `npm ci` with `cache: 'npm'` pointing to `frontend/package-lock.json`, speeding up build times from ~1 minute to under 15 seconds.
* **Vite Production Compiler**: Executes `npm run build` (`vite build`). This verifies that all JSX syntax, Tailwind classes, and Rollup chunking rules (`manualChunks` for vendor, charts, and forms) bundle without errors.

### 3.3 Job 3: `docker-validation`
* **Syntax & Interpolation Gate**: Runs `docker compose config` against both base and production files. If any variable syntax error, indentation mismatch, or port misconfiguration occurs, GitHub Actions reports a configuration failure.

### 3.4 Job 4: `deploy`
* **Execution Condition**: Evaluates `needs: [backend-tests, frontend-build, docker-validation]`. It only executes if every preceding job passed with status `success`.
* **Deploy Hooks**: Uses lightweight HTTPS Webhook URLs provided by Vercel and Render. This avoids storing broad-scope API credentials or SSH private keys inside GitHub Actions.

---

## 4. Required GitHub Repository Secrets

In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions** and configure:

| Secret Name | Source Provider | Purpose |
| :--- | :--- | :--- |
| `RENDER_DEPLOY_HOOK_URL` | Render Dashboard > Web Service > Settings > **Deploy Hook** | Triggers an immediate zero-downtime rebuild on Render when main branch updates. |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel Dashboard > Project > Settings > Git > **Deploy Hooks** | Triggers an immediate production bundle compilation and CDN propagation on Vercel. |

> [!NOTE]
> If you connect your GitHub repository directly to Vercel and Render using their native GitHub Apps, deployments trigger automatically on Git push. In that case, you do not even need Deploy Hooks; GitHub Actions acts purely as a status check gate (Branch Protection Rule).

---

## 5. Setting Up Branch Protection Rules

To prevent accidental pushes of broken code to the production deployment branch:
1. Go to your GitHub repository > **Settings** > **Branches**.
2. Click **Add branch ruleset** or **Add branch protection rule**.
3. Set branch pattern: `main`.
4. Enable the following protections:
   * **Require a pull request before merging**.
   * **Require status checks to pass before merging**:
     * Check `Backend Test Suite (Node.js 20)`.
     * Check `Frontend Vite Production Build`.
     * Check `Docker Configuration Validation`.
   * **Do not allow bypassing the above settings**.
5. Save changes. Now, any code must pass all tests in a Pull Request before it can reach the live site.

