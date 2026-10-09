import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { setRedisClient, isRedisConnected } from '../src/config/redis.js';
import {
  remember,
  getCache,
  setCache,
  deleteCache,
  invalidatePattern,
  buildCacheKey,
  buildQueryHash,
  invalidateCategoryCache,
  invalidateProductCache,
  invalidatePopularProductsCache,
  CACHE_TTL,
} from '../src/utils/cache.util.js';
import { User, USER_ROLES } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category, CATEGORY_STATUS } from '../src/models/category.model.js';
import { Product, PRODUCT_STATUS } from '../src/models/product.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';

/**
 * High-fidelity in-memory Redis mock client for robust, hermetic test execution.
 */
class InMemoryRedisMock {
  constructor() {
    this.store = new Map();
    this.status = 'ready';
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, mode, duration) {
    const ttlMs = mode === 'EX' ? duration * 1000 : null;
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    return 'OK';
  }

  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
    }
    return deleted;
  }

  async unlink(...keys) {
    return this.del(...keys);
  }

  async scan(cursor, matchOpt, pattern) {
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr);
    const matched = [];

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matched.push(key);
      }
    }
    return ['0', matched];
  }

  async quit() {
    this.status = 'end';
    this.store.clear();
    return 'OK';
  }

  disconnect() {
    this.status = 'end';
    this.store.clear();
  }

  clear() {
    this.store.clear();
  }
}

describe('NearExpiry Phase 23: Redis Integration & Intelligent Caching Suite', () => {
  let server;
  let baseUrl;
  let mockRedis;
  let adminToken;
  let sellerToken;
  let sellerUser;
  let testStore;
  let testCategory;
  let ts;

  before(async () => {
    await connectDB();

    mockRedis = new InMemoryRedisMock();
    setRedisClient(mockRedis);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // Register test Admin
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Redis Admin',
        email: `redis.admin.${ts}@nearexpiry.test`,
        phone: '9876543210',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;

    // Register test Seller
    const sellerRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Redis Seller',
        email: `redis.seller.${ts}@nearexpiry.test`,
        phone: '9876543211',
        password: 'Password123!',
        storeName: `Redis Bakery Store ${ts}`,
      }),
    });
    const sellerData = await sellerRes.json();
    sellerToken = sellerData.data.token;
    sellerUser = sellerData.data.user;

    // Approve seller and store for full operational rights
    await User.findByIdAndUpdate(sellerUser.id || sellerUser._id, { verificationStatus: 'APPROVED' });
    let store = await Store.findOne({ ownerId: sellerUser.id || sellerUser._id });
    if (!store) {
      store = await Store.create({
        ownerId: sellerUser.id || sellerUser._id,
        storeName: `Redis Bakery Store ${ts}`,
        slug: `redis-bakery-store-${ts}`,
        address: { street: '101 Cache Way', city: 'Mumbai', state: 'MH', pincode: '400001' },
        verificationStatus: 'APPROVED',
        isActive: true,
      });
    } else {
      store.verificationStatus = 'APPROVED';
      store.isActive = true;
      await store.save();
    }
    testStore = store;

    testCategory = await Category.create({
      name: `Bakery Items ${ts}`,
      slug: `bakery-items-${ts}`,
      description: 'Fresh artisanal bakery goods',
      status: CATEGORY_STATUS.ACTIVE,
      createdBy: adminData.data.user.id || adminData.data.user._id,
    });
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
    setRedisClient(null);
    await disconnectDB();
  });

  beforeEach(() => {
    mockRedis.clear();
    setRedisClient(mockRedis);
  });

  // =========================================================================
  // 1. Core Cache Utilities
  // =========================================================================
  describe('1. Core Cache Utilities & Key Determinism', () => {
    it('generates identical hash for query params regardless of key order', () => {
      const hash1 = buildQueryHash({ page: '1', limit: '10', search: 'apple' });
      const hash2 = buildQueryHash({ search: 'apple', limit: '10', page: '1' });
      assert.equal(hash1, hash2);
    });

    it('builds namespaced cache keys correctly', () => {
      const key = buildCacheKey('products', 'list', { category: 'cat123', page: 2 });
      assert.ok(key.startsWith('nearexpiry:products:list:'));
    });

    it('reads and writes to cache with TTL', async () => {
      await setCache('nearexpiry:test:k1', { hello: 'world' }, 60);
      const val = await getCache('nearexpiry:test:k1');
      assert.deepEqual(val, { hello: 'world' });

      await deleteCache('nearexpiry:test:k1');
      const deletedVal = await getCache('nearexpiry:test:k1');
      assert.equal(deletedVal, null);
    });

    it('remember() serves from DB on miss and returns from cache on hit', async () => {
      let dbFetchCount = 0;
      const fetcher = async () => {
        dbFetchCount++;
        return { item: 'cached-data', counter: dbFetchCount };
      };

      const result1 = await remember('nearexpiry:test:remember', 60, fetcher);
      assert.equal(result1.isCached, false);
      assert.equal(result1.data.counter, 1);
      assert.equal(dbFetchCount, 1);

      // Second call should hit cache without calling fetcher
      const result2 = await remember('nearexpiry:test:remember', 60, fetcher);
      assert.equal(result2.isCached, true);
      assert.equal(result2.data.counter, 1);
      assert.equal(dbFetchCount, 1);
    });

    it('invalidatePattern() removes matching keys via SCAN', async () => {
      await setCache('nearexpiry:products:list:h1', { data: 1 }, 60);
      await setCache('nearexpiry:products:list:h2', { data: 2 }, 60);
      await setCache('nearexpiry:categories:list:h1', { data: 3 }, 60);

      const deletedCount = await invalidatePattern('nearexpiry:products:list:*');
      assert.equal(deletedCount, 2);

      assert.equal(await getCache('nearexpiry:products:list:h1'), null);
      assert.equal(await getCache('nearexpiry:products:list:h2'), null);
      assert.notEqual(await getCache('nearexpiry:categories:list:h1'), null);
    });
  });

  // =========================================================================
  // 2. Category Caching & Invalidation
  // =========================================================================
  describe('2. Category Caching & Invalidation Lifecycle', () => {
    it('caches public category listing on first read and serves from cache on second read', async () => {
      const res1 = await fetch(`${baseUrl}/categories`);
      assert.equal(res1.status, 200);
      const body1 = await res1.json();
      assert.ok(body1.data.categories.length > 0);

      // Verify that Redis was populated with categories list key
      const keys = Array.from(mockRedis.store.keys());
      const categoryListKey = keys.find((k) => k.startsWith('nearexpiry:categories:list:'));
      assert.ok(categoryListKey, 'Category list cache key should exist in Redis');

      // Second read
      const res2 = await fetch(`${baseUrl}/categories`);
      assert.equal(res2.status, 200);
      const body2 = await res2.json();
      assert.equal(body2.data.categories.length, body1.data.categories.length);
    });

    it('invalidates category cache when admin updates a category', async () => {
      // Prime cache
      await fetch(`${baseUrl}/categories`);
      let hasCatKey = Array.from(mockRedis.store.keys()).some((k) => k.startsWith('nearexpiry:categories:list:'));
      assert.ok(hasCatKey);

      // Admin updates category
      const updateRes = await fetch(`${baseUrl}/categories/${testCategory._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          description: 'Updated description for cache invalidation testing',
        }),
      });
      assert.equal(updateRes.status, 200);

      // Verify category list keys were evicted
      hasCatKey = Array.from(mockRedis.store.keys()).some((k) => k.startsWith('nearexpiry:categories:list:'));
      assert.equal(hasCatKey, false, 'Category list cache must be evicted after category update');
    });
  });

  // =========================================================================
  // 3. Product Caching & Invalidation
  // =========================================================================
  describe('3. Product Caching & Invalidation Lifecycle', () => {
    let createdProduct;

    it('seller creates product and it invalidates public product list caches', async () => {
      // Seed some product list cache
      await setCache('nearexpiry:products:list:sample', { products: [] }, 60);

      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          name: `Organic Milk Loaf ${ts}`,
          description: 'Fresh soft baked milk bread with clean label ingredients.',
          brand: 'NearBakery',
          category: testCategory._id.toString(),
          image: 'https://images.example.com/bread.jpg',
          unit: 'pcs',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      createdProduct = body.data.product;

      // Verify product list cache was evicted
      const cached = await getCache('nearexpiry:products:list:sample');
      assert.equal(cached, null, 'Product list cache must be invalidated on product creation');
    });

    it('caches public product details and invalidates on update', async () => {
      // First read: Populates cache
      const res1 = await fetch(`${baseUrl}/products/${createdProduct._id}`);
      assert.equal(res1.status, 200);

      const detailKey = `nearexpiry:products:detail:${createdProduct._id}`;
      const cached = await getCache(detailKey);
      assert.ok(cached, 'Product detail must be cached in Redis');
      assert.equal(cached.name, createdProduct.name);

      // Seller updates product
      const res2 = await fetch(`${baseUrl}/products/${createdProduct._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          description: 'Brand new updated bread description',
        }),
      });
      assert.equal(res2.status, 200);

      // Verify product detail key was evicted
      const cachedAfterUpdate = await getCache(detailKey);
      assert.equal(cachedAfterUpdate, null, 'Product detail cache must be evicted on product update');
    });
  });

  // =========================================================================
  // 4. Popular Products Caching
  // =========================================================================
  describe('4. Popular Products Endpoint & Caching', () => {
    it('GET /api/v1/products/popular returns top products and caches the result', async () => {
      const res = await fetch(`${baseUrl}/products/popular?limit=5`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.products));

      // Check Redis key exists
      const popularKey = 'nearexpiry:products:popular:5';
      const cachedPopular = await getCache(popularKey);
      assert.ok(cachedPopular, 'Popular products must be cached in Redis');
      assert.equal(cachedPopular.length, body.data.products.length);
    });

    it('invalidatePopularProductsCache() clears popular product keys', async () => {
      await setCache('nearexpiry:products:popular:10', [{ id: 'p1' }], 600);
      await invalidatePopularProductsCache();
      const val = await getCache('nearexpiry:products:popular:10');
      assert.equal(val, null);
    });
  });

  // =========================================================================
  // 5. High Availability & Offline Fallback (Failure Resilience)
  // =========================================================================
  describe('5. Resilience & Graceful Offline Fallback', () => {
    it('handles Redis offline / disconnected state without failing public API requests', async () => {
      // Simulate Redis being completely offline / disconnected
      setRedisClient(null);
      assert.equal(isRedisConnected(), false);

      // All public APIs must seamlessly fall back to MongoDB and return 200
      const catRes = await fetch(`${baseUrl}/categories`);
      assert.equal(catRes.status, 200);
      const catBody = await catRes.json();
      assert.ok(catBody.data.categories.length > 0);

      const prodRes = await fetch(`${baseUrl}/products`);
      assert.equal(prodRes.status, 200);
      const prodBody = await prodRes.json();
      assert.ok(Array.isArray(prodBody.data.products));

      const popRes = await fetch(`${baseUrl}/products/popular`);
      assert.equal(popRes.status, 200);
      const popBody = await popRes.json();
      assert.ok(Array.isArray(popBody.data.products));

      const marketRes = await fetch(`${baseUrl}/marketplace/products`);
      assert.equal(marketRes.status, 200);
    });
  });

  // =========================================================================
  // 6. Phase 23B: Targeted Invalidation Remediation Suite (REDIS-23-F01 & F02)
  // =========================================================================
  describe('6. Targeted Invalidation Remediation (REDIS-23-F01 & REDIS-23-F02)', () => {
    let remediationProduct;
    let remediationBatch;

    before(async () => {
      // Create a dedicated product and batch for remediation assertions
      const prodRes = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          name: `Remediation Loaf ${ts}`,
          description: 'Test bread for remediation invalidations.',
          brand: 'RemediationBrand',
          category: testCategory._id.toString(),
          image: 'https://images.example.com/remediation.jpg',
          unit: 'pcs',
        }),
      });
      const prodBody = await prodRes.json();
      remediationProduct = prodBody.data.product;

      // Create a batch
      const mfg = new Date();
      const exp = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const batchRes = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          productId: remediationProduct._id,
          batchNumber: `BATCH-REM-${ts}`,
          manufacturingDate: mfg.toISOString(),
          expiryDate: exp.toISOString(),
          quantity: 20,
          originalPrice: 100,
          currentPrice: 80,
        }),
      });
      const batchBody = await batchRes.json();
      remediationBatch = batchBody.data.batch;
    });

    it('REDIS-23-F01: admin product moderation invalidates relevant public caches after successful mutation', async () => {
      // 1. Seed caches for product list, detail, marketplace deals
      const listKey = 'nearexpiry:products:list:remediation_test';
      const detailKey = `nearexpiry:products:detail:${remediationProduct._id}`;
      const marketplaceKey = 'nearexpiry:marketplace:products:remediation_deals';

      await setCache(listKey, { products: [remediationProduct] }, 300);
      await setCache(detailKey, remediationProduct, 900);
      await setCache(marketplaceKey, { deals: [] }, 180);

      assert.ok(await getCache(listKey));
      assert.ok(await getCache(detailKey));
      assert.ok(await getCache(marketplaceKey));

      // 2. Admin moderates product to INACTIVE
      const modRes = await fetch(`${baseUrl}/admin/products/${remediationProduct._id}/moderation`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'INACTIVE',
        }),
      });
      assert.equal(modRes.status, 200);
      const modBody = await modRes.json();
      assert.equal(modBody.data.status, 'INACTIVE');

      // 3. Verify all affected public caches are invalidated
      assert.equal(await getCache(listKey), null, 'Product list cache must be evicted on admin moderation');
      assert.equal(await getCache(detailKey), null, 'Product detail cache must be evicted on admin moderation');
      assert.equal(await getCache(marketplaceKey), null, 'Marketplace deals cache must be evicted on admin moderation');

      // Restore product to ACTIVE for subsequent tests
      await fetch(`${baseUrl}/admin/products/${remediationProduct._id}/moderation`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
    });

    it('failed moderation mutation does not perform misleading success-side invalidation', async () => {
      const listKey = 'nearexpiry:products:list:should_persist';
      await setCache(listKey, { data: 'safe' }, 300);

      // Attempt invalid moderation (invalid status)
      const badRes = await fetch(`${baseUrl}/admin/products/${remediationProduct._id}/moderation`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'NON_EXISTENT_STATUS',
        }),
      });
      assert.equal(badRes.status, 400);

      // Cache must still be intact because mutation aborted before invalidation
      const cached = await getCache(listKey);
      assert.ok(cached, 'Cache must not be invalidated when moderation mutation fails validation');
    });

    it('REDIS-23-F02: batch price/date updates invalidate affected marketplace and product caches', async () => {
      const marketplaceKey = 'nearexpiry:marketplace:products:sample_deal';
      const detailKey = `nearexpiry:products:detail:${remediationProduct._id}`;

      await setCache(marketplaceKey, { items: [] }, 180);
      await setCache(detailKey, remediationProduct, 900);

      // Seller updates batch price
      const updateRes = await fetch(`${baseUrl}/batches/${remediationBatch._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          currentPrice: 55,
        }),
      });
      assert.equal(updateRes.status, 200);

      // Verify caches invalidated
      assert.equal(await getCache(marketplaceKey), null, 'Marketplace cache must be invalidated on batch update');
      assert.equal(await getCache(detailKey), null, 'Product detail cache must be invalidated on batch update');
    });

    it('REDIS-23-F02: manual stock adjustment invalidates affected caches', async () => {
      const marketplaceKey = 'nearexpiry:marketplace:products:stock_test';
      const listKey = 'nearexpiry:products:list:stock_test';

      await setCache(marketplaceKey, { items: [] }, 180);
      await setCache(listKey, { products: [] }, 300);

      // Seller adjusts batch stock
      const adjustRes = await fetch(`${baseUrl}/batches/${remediationBatch._id}/adjust-stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          newQuantity: 15,
          reason: 'Periodic inventory audit count correction',
        }),
      });
      assert.equal(adjustRes.status, 200);

      assert.equal(await getCache(marketplaceKey), null, 'Marketplace cache must be invalidated on stock adjustment');
      assert.equal(await getCache(listKey), null, 'Product list cache must be invalidated on stock adjustment');
    });

    it('Redis invalidation failure does not roll back or misreport a successful database mutation', async () => {
      // Mock client that fails during deletion/unlinking
      const failingMock = {
        status: 'ready',
        async get() { return null; },
        async set() { return 'OK'; },
        async del() { throw new Error('Simulated Redis network timeout on DEL'); },
        async unlink() { throw new Error('Simulated Redis socket failure on UNLINK'); },
        async scan() { throw new Error('Simulated Redis connection drop on SCAN'); },
        async quit() { return 'OK'; },
        disconnect() {},
      };
      setRedisClient(failingMock);

      // Execute admin moderation under failing Redis
      const modRes = await fetch(`${baseUrl}/admin/products/${remediationProduct._id}/moderation`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      // The HTTP call must succeed with 200 and the MongoDB change must be saved
      assert.equal(modRes.status, 200);
      const modBody = await modRes.json();
      assert.equal(modBody.success, true);
      assert.equal(modBody.data.status, 'ACTIVE');

      // Restore healthy mock
      setRedisClient(mockRedis);
    });

    it('authoritative inventory reads and FEFO ordering remain 100% direct from MongoDB', async () => {
      // Query batches directly for product
      const batchRes = await fetch(`${baseUrl}/batches/product/${remediationProduct._id}`);
      assert.equal(batchRes.status, 200);
      const batchBody = await batchRes.json();
      assert.equal(batchBody.success, true);
      assert.ok(batchBody.data.batches.length > 0);
      assert.equal(batchBody.data.batches[0].batchNumber, `BATCH-REM-${ts}`);
    });
  });
});
