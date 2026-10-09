import crypto from 'crypto';
import { getRedisClient, isRedisConnected } from '../config/redis.js';

// Standardized TTL definitions (in seconds)
export const CACHE_TTL = Object.freeze({
  CATEGORIES_LIST: 3600,       // 1 hour: Taxonomy changes infrequently
  CATEGORY_DETAIL: 3600,       // 1 hour
  PRODUCTS_LIST: 300,          // 5 minutes: Catalog search and listings
  PRODUCT_DETAIL: 900,         // 15 minutes: Product metadata
  MARKETPLACE_LIST: 180,       // 3 minutes: Hyperlocal deals and expiry-driven batches
  POPULAR_PRODUCTS: 600,       // 10 minutes: Top-selling products aggregation
});

/**
 * Creates a deterministic, collision-resistant hash from query parameters.
 */
export const buildQueryHash = (queryParams = {}) => {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return 'default';
  }

  // Sort keys alphabetically for determinism
  const sortedKeys = Object.keys(queryParams).sort();
  const normalized = {};

  for (const key of sortedKeys) {
    const val = queryParams[key];
    if (val !== undefined && val !== null && val !== '') {
      normalized[key] = typeof val === 'object' ? JSON.stringify(val) : String(val).trim();
    }
  }

  const serialized = JSON.stringify(normalized);
  return crypto.createHash('md5').update(serialized).digest('hex').slice(0, 16);
};

/**
 * Constructs standard namespaced Redis cache keys.
 */
export const buildCacheKey = (namespace, identifier, queryParams = null) => {
  const parts = ['nearexpiry', namespace];
  if (identifier) parts.push(String(identifier));
  if (queryParams) parts.push(buildQueryHash(queryParams));
  return parts.join(':');
};

/**
 * Reads a cached value from Redis. Returns null on miss or when Redis is offline.
 */
export const getCache = async (key) => {
  try {
    if (!isRedisConnected()) return null;
    const client = getRedisClient();
    if (!client) return null;

    const raw = await client.get(key);
    if (!raw) return null;

    return JSON.parse(raw);
  } catch (err) {
    // Non-blocking fallback
    return null;
  }
};

/**
 * Writes a serializable object to Redis with a TTL in seconds.
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
  try {
    if (!isRedisConnected()) return false;
    const client = getRedisClient();
    if (!client) return false;

    // Do not cache null, undefined, or error responses
    if (value === null || value === undefined) return false;

    const serialized = JSON.stringify(value);
    await client.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    // Non-blocking failure
    return false;
  }
};

/**
 * Deletes a single cache key.
 */
export const deleteCache = async (key) => {
  try {
    if (!isRedisConnected()) return false;
    const client = getRedisClient();
    if (!client) return false;

    await client.del(key);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Deletes all keys matching a specific pattern using non-blocking SCAN.
 * Protects Redis event loop from the latency spikes caused by KEYS *.
 */
export const invalidatePattern = async (pattern) => {
  try {
    if (!isRedisConnected()) return 0;
    const client = getRedisClient();
    if (!client) return 0;

    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys && keys.length > 0) {
        // Unlink is non-blocking (async memory reclaim) in Redis 4.0+
        await client.unlink(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    return totalDeleted;
  } catch (err) {
    return 0;
  }
};

/**
 * Universal Cache-Aside Runner:
 * 1. Checks Redis cache.
 * 2. On hit: returns deserialized data.
 * 3. On miss or offline: executes fetcherFn().
 * 4. Asynchronously writes to Redis.
 * 5. Returns authoritative database result.
 */
export const remember = async (key, ttlSeconds, fetcherFn) => {
  // 1. Try cache read
  const cached = await getCache(key);
  if (cached !== null) {
    return { data: cached, isCached: true };
  }

  // 2. Fetch authoritative data from database
  const freshData = await fetcherFn();

  // 3. Populate cache asynchronously (safe fail)
  if (freshData !== null && freshData !== undefined) {
    setCache(key, freshData, ttlSeconds).catch(() => {});
  }

  return { data: freshData, isCached: false };
};

// =========================================================================
// DOMAIN-SPECIFIC INVALIDATION HELPERS
// =========================================================================

/**
 * Invalidates all caches affected by category mutations.
 * Invalidate category details, category listings, and product listings.
 */
export const invalidateCategoryCache = async (categoryId = null) => {
  const promises = [
    invalidatePattern('nearexpiry:categories:list:*'),
    invalidatePattern('nearexpiry:products:list:*'),
    invalidatePattern('nearexpiry:marketplace:products:*'),
  ];
  if (categoryId) {
    promises.push(deleteCache(`nearexpiry:categories:detail:${categoryId}`));
  }
  await Promise.allSettled(promises);
};

/**
 * Invalidates all caches affected by product mutations.
 * Invalidates product detail, product listings, marketplace listings, and popular products.
 */
export const invalidateProductCache = async (productId = null, categoryId = null) => {
  const promises = [
    invalidatePattern('nearexpiry:products:list:*'),
    invalidatePattern('nearexpiry:marketplace:products:*'),
    deleteCache('nearexpiry:products:popular:*'),
    invalidatePattern('nearexpiry:products:popular:*'),
  ];
  if (productId) {
    promises.push(deleteCache(`nearexpiry:products:detail:${productId}`));
  }
  if (categoryId) {
    promises.push(invalidateCategoryCache(categoryId));
  }
  await Promise.allSettled(promises);
};

/**
 * Invalidates popular-product cache when orders or inventory changes.
 */
export const invalidatePopularProductsCache = async () => {
  await invalidatePattern('nearexpiry:products:popular:*');
};

