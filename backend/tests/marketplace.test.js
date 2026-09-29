import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch } from '../src/models/batch.model.js';
import { InventoryAudit } from '../src/models/inventory.model.js';
import { Wishlist } from '../src/models/wishlist.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Customer Marketplace & Wishlist Integration Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let seller1Token;
  let seller2Token;
  let customerToken;
  let dairyCategoryId;
  let bakeryCategoryId;
  let nearStoreId;
  let farStoreId;
  let productGreekYogurtId;
  let productSourdoughBreadId;
  let productExpiredCheeseId;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Register Admin & Reset Default Price Rules
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MP Admin',
        email: `mp.admin.${ts}@nearexpiry.test`,
        phone: '9876500001',
        password: 'Password123!'
      })
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Register Customer
    const custRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MP Customer',
        email: `mp.customer.${ts}@nearexpiry.test`,
        phone: '9876500002',
        password: 'Password123!'
      })
    });
    customerToken = (await custRes.json()).data.token;

    // 3. Create Categories
    const dairyRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `MP Dairy ${ts}`, status: 'ACTIVE' })
    });
    dairyCategoryId = (await dairyRes.json()).data.category._id;

    const bakeryRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `MP Bakery ${ts}`, status: 'ACTIVE' })
    });
    bakeryCategoryId = (await bakeryRes.json()).data.category._id;

    // 4. Register Seller 1 (Near Store in Bengaluru Indiranagar: 12.9784, 77.6408)
    const s1Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MP Seller Near',
        email: `mp.seller1.${ts}@nearexpiry.test`,
        phone: '9876500003',
        password: 'Password123!',
        storeName: `Indiranagar Fresh ${ts}`
      })
    });
    seller1Token = (await s1Res.json()).data.token;

    const st1Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        storeName: `Indiranagar Fresh ${ts}`,
        contactPhone: '9876500003',
        address: { street: '100ft Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        latitude: 12.9784,
        longitude: 77.6408
      })
    });
    nearStoreId = (await st1Res.json()).data.store._id;

    // Approve Near Store via Admin
    await Store.findByIdAndUpdate(nearStoreId, { verificationStatus: 'APPROVED', isActive: true });

    // 5. Register Seller 2 (Far Store in Mysuru ~140 km away: 12.2958, 76.6394)
    const s2Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MP Seller Far',
        email: `mp.seller2.${ts}@nearexpiry.test`,
        phone: '9876500004',
        password: 'Password123!',
        storeName: `Mysuru Organic ${ts}`
      })
    });
    seller2Token = (await s2Res.json()).data.token;

    const st2Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        storeName: `Mysuru Organic ${ts}`,
        contactPhone: '9876500004',
        address: { street: 'Sayyaji Rao Rd', city: 'Mysuru', state: 'Karnataka', pincode: '570001' },
        latitude: 12.2958,
        longitude: 76.6394
      })
    });
    farStoreId = (await st2Res.json()).data.store._id;
    await Store.findByIdAndUpdate(farStoreId, { verificationStatus: 'APPROVED', isActive: true });

    // 6. Create Products
    const p1Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Epigamia Greek Yogurt ${ts}`,
        description: 'High protein artisanal Greek yogurt',
        brand: 'Epigamia',
        category: dairyCategoryId,
        unit: 'g'
      })
    });
    productGreekYogurtId = (await p1Res.json()).data.product._id;

    const p2Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        name: `Artisan Sourdough Loaf ${ts}`,
        description: 'Slow-fermented country sourdough bread',
        brand: 'BakerStreet',
        category: bakeryCategoryId,
        unit: 'g'
      })
    });
    productSourdoughBreadId = (await p2Res.json()).data.product._id;

    const p3Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Vintage Expired Cheddar ${ts}`,
        description: 'Aged cheddar block (expired test)',
        brand: 'DairyCraft',
        category: dairyCategoryId,
        unit: 'g'
      })
    });
    productExpiredCheeseId = (await p3Res.json()).data.product._id;

    const mfgDate = new Date(Date.now() - 15 * 86400000).toISOString();
    const exp2Days = new Date(Date.now() + 2 * 86400000).toISOString();
    const exp10Days = new Date(Date.now() + 10 * 86400000).toISOString();
    const exp5Days = new Date(Date.now() + 5 * 86400000).toISOString();

    // Create 2 batches for Greek Yogurt (2 days -> 75% off -> ₹50, and 10 days -> 40% off -> ₹120)
    await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        batchNumber: `YOG-CRIT-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp2Days,
        quantity: 12,
        originalPrice: 200
      })
    });

    await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        batchNumber: `YOG-APPR-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp10Days,
        quantity: 20,
        originalPrice: 200
      })
    });

    // Create 1 batch for Sourdough Bread at farStore (5 days -> 60% off -> ₹120)
    await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        productId: productSourdoughBreadId,
        batchNumber: `BRD-CRIT-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp5Days,
        quantity: 8,
        originalPrice: 300
      })
    });

    // Create 1 EXPIRED batch directly in DB for productExpiredCheeseId
    const expiredProductDoc = await Product.findById(productExpiredCheeseId);
    await Batch.create({
      productId: productExpiredCheeseId,
      storeId: nearStoreId,
      sellerId: expiredProductDoc.sellerId,
      batchNumber: `CHS-EXP-${ts}`,
      manufacturingDate: new Date(Date.now() - 30 * 86400000),
      expiryDate: new Date(Date.now() - 2 * 86400000),
      quantity: 15,
      reservedQuantity: 0,
      originalPrice: 450,
      currentPrice: 112.5,
      discountPercentage: 75,
      remainingDays: -2,
      status: 'EXPIRED',
      isPurchasable: false
    });
  });

  after(async () => {
    const productIds = [
      productGreekYogurtId,
      productSourdoughBreadId,
      productExpiredCheeseId
    ].filter(Boolean);

    await Wishlist.deleteMany({ productId: { $in: productIds } });
    await InventoryAudit.deleteMany({ productId: { $in: productIds } });
    await Batch.deleteMany({ productId: { $in: productIds } });
    await Product.deleteMany({ _id: { $in: productIds } });
    await Category.deleteMany({ _id: { $in: [dairyCategoryId, bakeryCategoryId].filter(Boolean) } });
    await Store.deleteMany({ _id: { $in: [nearStoreId, farStoreId].filter(Boolean) } });
    await User.deleteMany({ email: /@nearexpiry\.test$/ });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. Browses purchasable products in FEFO order and strictly excludes EXPIRED products', async () => {
    const res = await fetch(`${baseUrl}/marketplace/products?search=Epigamia%20Greek%20Yogurt%20${ts}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.products.length, 1);

    const item = body.data.products[0];
    assert.equal(item.productId.toString(), productGreekYogurtId.toString());
    assert.equal(item.pricingAndInventory.fefoPrice, 50); // 75% discount on ₹200
    assert.equal(item.pricingAndInventory.fefoDiscountPercentage, 75);
    assert.equal(item.pricingAndInventory.totalAvailableQuantity, 32); // 12 + 20
    assert.equal(item.pricingAndInventory.activeBatchCount, 2);

    // Ensure expired cheese never appears in browse
    const expiredRes = await fetch(
      `${baseUrl}/marketplace/products?search=Vintage%20Expired%20Cheddar%20${ts}`
    );
    assert.equal(expiredRes.status, 200);
    const expiredBody = await expiredRes.json();
    assert.equal(expiredBody.data.products.length, 0);
  });

  it('2. Supports filtering by category, expiry window, and nearby geospatial coordinates', async () => {
    // Filter by expiryWindow = 0_2_DAYS & category
    const windowRes = await fetch(
      `${baseUrl}/marketplace/products?expiryWindow=0_2_DAYS&category=${dairyCategoryId}`
    );
    assert.equal(windowRes.status, 200);
    const windowBody = await windowRes.json();

    const foundWindowIds = windowBody.data.products.map((i) => i.productId.toString());
    assert.ok(foundWindowIds.includes(productGreekYogurtId.toString()));

    // Filter by nearby coordinates around Indiranagar (10 km radius) -> includes nearStore (Greek Yogurt), excludes Mysuru farStore (Sourdough Bread)
    const nearbyRes = await fetch(
      `${baseUrl}/marketplace/products?latitude=12.9784&longitude=77.6408&radiusKm=10&sortBy=distance&sortOrder=asc`
    );
    assert.equal(nearbyRes.status, 200);
    const nearbyBody = await nearbyRes.json();

    const foundNearbyIds = nearbyBody.data.products.map((i) => i.productId.toString());
    assert.ok(foundNearbyIds.includes(productGreekYogurtId.toString()));
    assert.ok(!foundNearbyIds.includes(productSourdoughBreadId.toString()));
  });

  it('3. Returns product details & FEFO-ordered purchasable batches while marking expired product non-purchasable', async () => {
    const detailRes = await fetch(`${baseUrl}/marketplace/products/${productGreekYogurtId}`);
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();

    assert.equal(detailBody.data.product._id.toString(), productGreekYogurtId.toString());
    assert.equal(detailBody.data.isPurchasable, true);
    assert.equal(detailBody.data.availableBatches.length, 2);
    // First batch must be FEFO (2 days remaining before 10 days remaining)
    assert.ok(detailBody.data.availableBatches[0].remainingDays <= detailBody.data.availableBatches[1].remainingDays);

    // Expired product detail should return 0 availableBatches and isPurchasable: false
    const expiredDetailRes = await fetch(`${baseUrl}/marketplace/products/${productExpiredCheeseId}`);
    assert.equal(expiredDetailRes.status, 200);
    const expiredDetailBody = await expiredDetailRes.json();
    assert.equal(expiredDetailBody.data.isPurchasable, false);
    assert.equal(expiredDetailBody.data.availableBatches.length, 0);
  });

  it('4. Allows customer to add, list (with live FEFO pricing), and remove wishlist items', async () => {
    // Add Greek Yogurt to wishlist
    const addRes = await fetch(`${baseUrl}/wishlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        targetDiscountPercentage: 50,
        notes: 'Buy for weekend breakfast'
      })
    });
    assert.equal(addRes.status, 201);

    // Get wishlist with live FEFO pricing
    const listRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();

    assert.equal(listBody.data.count, 1);
    assert.equal(listBody.data.wishlist[0].isCurrentlyPurchasable, true);
    assert.equal(listBody.data.wishlist[0].livePricingSummary.currentPrice, 50);

    // Remove from wishlist
    const delRes = await fetch(`${baseUrl}/wishlist/${productGreekYogurtId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(delRes.status, 200);

    const emptyRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const emptyBody = await emptyRes.json();
    assert.equal(emptyBody.data.count, 0);
  });
});
