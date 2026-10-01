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
import { Cart } from '../src/models/cart.model.js';
import { InventoryAudit } from '../src/models/inventory.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Cart & Checkout Validation Integration Suite', () => {
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
  let productOrganicMilkId;
  let criticalYogurtBatchId;
  let approachingYogurtBatchId;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Admin & Default Pricing Rules
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cart Admin',
        email: `cart.admin.${ts}@nearexpiry.test`,
        phone: '9876510001',
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Customer
    const custRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cart Customer',
        email: `cart.customer.${ts}@nearexpiry.test`,
        phone: '9876510002',
        password: 'Password123!',
      }),
    });
    customerToken = (await custRes.json()).data.token;

    // 3. Categories
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Cart Dairy ${ts}`, status: 'ACTIVE' }),
    });
    dairyCategoryId = (await catRes.json()).data.category._id;

    const cat2Res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Cart Bakery ${ts}`, status: 'ACTIVE' }),
    });
    bakeryCategoryId = (await cat2Res.json()).data.category._id;

    // 4. Seller 1 (Near Store)
    const s1Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cart Seller Near',
        email: `cart.seller1.${ts}@nearexpiry.test`,
        phone: '9876510003',
        password: 'Password123!',
        storeName: `Indiranagar SuperStore ${ts}`,
      }),
    });
    seller1Token = (await s1Res.json()).data.token;

    const st1Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        storeName: `Indiranagar SuperStore ${ts}`,
        contactPhone: '9876510003',
        address: { street: '100ft Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        latitude: 12.9784,
        longitude: 77.6408,
      }),
    });
    nearStoreId = (await st1Res.json()).data.store._id;
    await Store.findByIdAndUpdate(nearStoreId, { verificationStatus: 'APPROVED', isActive: true });

    // 5. Seller 2 (Far Store)
    const s2Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cart Seller Far',
        email: `cart.seller2.${ts}@nearexpiry.test`,
        phone: '9876510004',
        password: 'Password123!',
        storeName: `Mysuru Bakery Hub ${ts}`,
      }),
    });
    seller2Token = (await s2Res.json()).data.token;

    const st2Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        storeName: `Mysuru Bakery Hub ${ts}`,
        contactPhone: '9876510004',
        address: { street: 'Sayyaji Rd', city: 'Mysuru', state: 'Karnataka', pincode: '570001' },
        latitude: 12.2958,
        longitude: 76.6394,
      }),
    });
    farStoreId = (await st2Res.json()).data.store._id;
    await Store.findByIdAndUpdate(farStoreId, { verificationStatus: 'APPROVED', isActive: true });

    // 6. Products
    // Product 1: Greek Yogurt (Near Store) - MRP 200
    const p1Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Epigamia Greek Yogurt ${ts}`,
        description: 'Greek Yogurt 400g',
        brand: 'Epigamia',
        category: dairyCategoryId,
        unit: 'g',
      }),
    });
    productGreekYogurtId = (await p1Res.json()).data.product._id;

    // Product 2: Sourdough Bread (Far Store) - MRP 300
    const p2Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        name: `Artisan Sourdough Loaf ${ts}`,
        description: 'Country Sourdough Bread',
        brand: 'BakerStreet',
        category: bakeryCategoryId,
        unit: 'g',
      }),
    });
    productSourdoughBreadId = (await p2Res.json()).data.product._id;

    // Product 3: Organic Milk (Near Store) - MRP 100
    const p3Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Amul Organic Milk 1L ${ts}`,
        description: 'Pasteurized Organic Whole Milk',
        brand: 'Amul',
        category: dairyCategoryId,
        unit: 'l',
      }),
    });
    productOrganicMilkId = (await p3Res.json()).data.product._id;

    const mfgDate = new Date(Date.now() - 15 * 86400000).toISOString();
    const exp2Days = new Date(Date.now() + 2 * 86400000).toISOString(); // 0-2 days -> 75% off (MRP 200 -> 50)
    const exp10Days = new Date(Date.now() + 10 * 86400000).toISOString(); // 8-15 days -> 40% off (MRP 200 -> 120)
    const exp5Days = new Date(Date.now() + 5 * 86400000).toISOString(); // 3-7 days -> 60% off (MRP 300 -> 120)

    // Greek Yogurt Batch 1: 2 days left (qty: 2) -> Critical (75% off -> ₹50)
    const b1Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        batchNumber: `YOG-CRIT-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp2Days,
        quantity: 2,
        originalPrice: 200,
      }),
    });
    criticalYogurtBatchId = (await b1Res.json()).data.batch._id;

    // Greek Yogurt Batch 2: 10 days left (qty: 10) -> Approaching (40% off -> ₹120)
    const b2Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        batchNumber: `YOG-APPR-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp10Days,
        quantity: 10,
        originalPrice: 200,
      }),
    });
    approachingYogurtBatchId = (await b2Res.json()).data.batch._id;

    // Sourdough Bread Batch (Far Store): 5 days left (qty: 5) -> 60% off -> ₹120
    await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        productId: productSourdoughBreadId,
        batchNumber: `BRD-CRIT-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp5Days,
        quantity: 5,
        originalPrice: 300,
      }),
    });

    // Organic Milk Batch: 10 days left (qty: 5) -> 40% off -> ₹60
    await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        productId: productOrganicMilkId,
        batchNumber: `MLK-APPR-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: exp10Days,
        quantity: 5,
        originalPrice: 100,
      }),
    });
  });

  after(async () => {
    const pIds = [productGreekYogurtId, productSourdoughBreadId, productOrganicMilkId].filter(Boolean);
    await Cart.deleteMany({});
    await InventoryAudit.deleteMany({ productId: { $in: pIds } });
    await Batch.deleteMany({ productId: { $in: pIds } });
    await Product.deleteMany({ _id: { $in: pIds } });
    await Category.deleteMany({ _id: { $in: [dairyCategoryId, bakeryCategoryId].filter(Boolean) } });
    await Store.deleteMany({ _id: { $in: [nearStoreId, farStoreId].filter(Boolean) } });
    await User.deleteMany({ email: /@nearexpiry\.test$/ });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. Retrieves empty cart with zero totals and canCheckout: false', async () => {
    const res = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.pricingSummary.subtotal, 0);
    assert.equal(body.data.pricingSummary.discounts, 0);
    assert.equal(body.data.pricingSummary.finalTotal, 0);
    assert.equal(body.data.canCheckout, false);
    assert.equal(body.data.items.length, 0);
  });

  it('2. Adds item to cart and dynamically calculates backend pricing without trusting frontend prices', async () => {
    // Add 1 unit of Greek Yogurt (should allocate from earliest expiring batch: 2 days left -> 75% off -> ₹50)
    const addRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        quantity: 1,
      }),
    });
    assert.equal(addRes.status, 200);
    const addBody = await addRes.json();

    assert.equal(addBody.data.items.length, 1);
    const item = addBody.data.items[0];
    assert.equal(item.productId.toString(), productGreekYogurtId.toString());
    assert.equal(item.isAvailable, true);
    assert.equal(item.itemStatus, 'AVAILABLE');
    assert.equal(item.pricing.unitOriginalPrice, 200);
    assert.equal(item.pricing.unitFinalPrice, 50); // 75% discount
    assert.equal(item.pricing.lineOriginalTotal, 200);
    assert.equal(item.pricing.lineDiscountTotal, 150);
    assert.equal(item.pricing.lineFinalTotal, 50);

    // Cart pricing summary
    assert.equal(addBody.data.pricingSummary.subtotal, 200);
    assert.equal(addBody.data.pricingSummary.discounts, 150);
    assert.equal(addBody.data.pricingSummary.finalTotal, 50);
    assert.equal(addBody.data.canCheckout, true);
  });

  it('3. Performs multi-batch FEFO blended pricing when requested quantity spans multiple lots', async () => {
    // Update Greek Yogurt quantity to 3.
    // Batch 1 has 2 units @ ₹50 (75% off) = ₹100
    // Batch 2 has 1 unit @ ₹120 (40% off) = ₹120
    // Total lineFinalTotal = ₹220, subtotal = 3 * 200 = ₹600, discount = ₹380, blended unit price = ₹73.33
    const updateRes = await fetch(`${baseUrl}/cart/items/${productGreekYogurtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ quantity: 3 }),
    });
    assert.equal(updateRes.status, 200);
    const body = await updateRes.json();

    const item = body.data.items[0];
    assert.equal(item.requestedQuantity, 3);
    assert.equal(item.batchAllocations.length, 2);
    assert.equal(item.batchAllocations[0].allocatedQuantity, 2);
    assert.equal(item.batchAllocations[0].unitDiscountedPrice, 50);
    assert.equal(item.batchAllocations[1].allocatedQuantity, 1);
    assert.equal(item.batchAllocations[1].unitDiscountedPrice, 120);

    assert.equal(item.pricing.lineOriginalTotal, 600);
    assert.equal(item.pricing.lineFinalTotal, 220);
    assert.equal(item.pricing.lineDiscountTotal, 380);
    assert.equal(item.pricing.unitFinalPrice, 73.33);

    assert.equal(body.data.pricingSummary.subtotal, 600);
    assert.equal(body.data.pricingSummary.discounts, 380);
    assert.equal(body.data.pricingSummary.finalTotal, 220);
    assert.equal(body.data.canCheckout, true);
  });

  it('4. Enforces single-store cart policy and supports replaceCart override', async () => {
    // Attempt adding Sourdough Bread from Far Store (Mysuru) while Near Store items exist
    const conflictRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: productSourdoughBreadId,
        quantity: 1,
      }),
    });
    assert.equal(conflictRes.status, 409);
    const conflictBody = await conflictRes.json();
    assert.equal(conflictBody.errorCode, 'CART_STORE_CONFLICT');

    // Add with replaceCart = true -> clears previous store items and adds Sourdough Bread
    const replaceRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: productSourdoughBreadId,
        quantity: 2,
        replaceCart: true,
      }),
    });
    assert.equal(replaceRes.status, 200);
    const replaceBody = await replaceRes.json();

    assert.equal(replaceBody.data.items.length, 1);
    assert.equal(replaceBody.data.items[0].productId.toString(), productSourdoughBreadId.toString());
    assert.equal(replaceBody.data.store._id.toString(), farStoreId.toString());
    // 2 units of Sourdough Bread: 60% off ₹300 -> ₹120 each -> lineFinalTotal: 240, subtotal: 600, discount: 360
    assert.equal(replaceBody.data.pricingSummary.subtotal, 600);
    assert.equal(replaceBody.data.pricingSummary.discounts, 360);
    assert.equal(replaceBody.data.pricingSummary.finalTotal, 240);

    // Switch back to Near Store for subsequent tests
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: productGreekYogurtId,
        quantity: 1,
        replaceCart: true,
      }),
    });
  });

  it('5. Detects insufficient stock when requested quantity exceeds available lot inventory', async () => {
    // Total available yogurt across both batches is 12 (2 + 10). Requesting 15 should flag INSUFFICIENT_STOCK.
    const exceedRes = await fetch(`${baseUrl}/cart/items/${productGreekYogurtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ quantity: 15 }),
    });
    assert.equal(exceedRes.status, 200);
    const exceedBody = await exceedRes.json();

    const item = exceedBody.data.items[0];
    assert.equal(item.isAvailable, false);
    assert.equal(item.itemStatus, 'INSUFFICIENT_STOCK');
    assert.equal(item.availableQuantity, 12);
    assert.equal(exceedBody.data.hasUnavailableItems, true);
    assert.equal(exceedBody.data.canCheckout, false);
    assert.equal(exceedBody.data.blockingIssues.length, 1);
    assert.equal(exceedBody.data.blockingIssues[0].issue, 'INSUFFICIENT_STOCK');

    // Reset back to quantity 2 (fully available)
    await fetch(`${baseUrl}/cart/items/${productGreekYogurtId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ quantity: 2 }),
    });
  });

  it('6. Detects expired batches, blocks checkout, and allows auto-pruning via syncCart', async () => {
    // Create an expired product batch
    const pExpRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Expired Cheddar ${ts}`,
        description: 'Expired lot test',
        brand: 'DairyCraft',
        category: dairyCategoryId,
        unit: 'g',
      }),
    });
    const expiredProductId = (await pExpRes.json()).data.product._id;

    // Directly insert an EXPIRED batch
    await Batch.create({
      productId: expiredProductId,
      storeId: nearStoreId,
      sellerId: (await Product.findById(expiredProductId)).sellerId,
      batchNumber: `EXP-${ts}`,
      manufacturingDate: new Date(Date.now() - 30 * 86400000),
      expiryDate: new Date(Date.now() - 1 * 86400000),
      quantity: 10,
      originalPrice: 150,
      currentPrice: 37.5,
      discountPercentage: 75,
      remainingDays: -1,
      status: 'EXPIRED',
      isPurchasable: false,
    });

    // Attempting to add expired product directly via API is rejected
    const addExpRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: expiredProductId,
        quantity: 1,
      }),
    });
    assert.equal(addExpRes.status, 400);

    // Simulate an item that expired while sitting in the cart
    await Cart.findOneAndUpdate(
      { userId: (await User.findOne({ email: `cart.customer.${ts}@nearexpiry.test` }))._id },
      {
        $push: {
          items: {
            productId: expiredProductId,
            storeId: nearStoreId,
            quantity: 1,
            priceSnapshotAtAdd: { unitOriginalPrice: 150, unitDiscountedPrice: 37.5 },
          },
        },
      }
    );

    // Retrieve cart: must flag item as EXPIRED and block checkout
    const cartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const cartBody = await cartRes.json();
    assert.equal(cartBody.data.hasUnavailableItems, true);
    assert.equal(cartBody.data.canCheckout, false);
    const expItem = cartBody.data.items.find((i) => i.productId.toString() === expiredProductId.toString());
    assert.equal(expItem.isAvailable, false);
    assert.equal(expItem.itemStatus, 'EXPIRED');

    // Checkout validation must fail with 422
    const checkoutValRes = await fetch(`${baseUrl}/cart/checkout-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ storeId: nearStoreId }),
    });
    assert.equal(checkoutValRes.status, 422);

    // Sync / Prune Cart: auto-cleans the expired item
    const syncRes = await fetch(`${baseUrl}/cart/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.data.modified, true);
    assert.equal(syncBody.data.prunedItems.length, 1);
    assert.equal(syncBody.data.summary.hasUnavailableItems, false);
    assert.equal(syncBody.data.summary.canCheckout, true);

    // Clean up expired product test doc
    await Product.findByIdAndDelete(expiredProductId);
    await Batch.deleteMany({ productId: expiredProductId });
  });

  it('7. Detects dynamic price changes and notifies customer with price change notice', async () => {
    // Add Organic Milk: current price is ₹60 (40% off ₹100 for 10 days left)
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: productOrganicMilkId,
        quantity: 1,
      }),
    });

    // Simulate time passing or dynamic price change: batch is now critical (75% off -> ₹25)
    await Batch.findOneAndUpdate(
      { productId: productOrganicMilkId },
      {
        $set: {
          currentPrice: 25,
          discountPercentage: 75,
          remainingDays: 1,
          status: 'CRITICAL',
        },
      }
    );

    // Retrieve cart: should detect price change from ₹60 to ₹25
    const cartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const cartBody = await cartRes.json();
    const milkItem = cartBody.data.items.find((i) => i.productId.toString() === productOrganicMilkId.toString());

    assert.equal(milkItem.priceChanged, true);
    assert.equal(milkItem.priceChangeNotice.direction, 'DECREASED');
    assert.equal(milkItem.pricing.unitFinalPrice, 25);
  });

  it('8. Validates checkout pre-flight successfully and executes atomic stock reservation', async () => {
    // Checkout Pre-Flight Validation
    const valRes = await fetch(`${baseUrl}/cart/checkout-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ storeId: nearStoreId }),
    });
    assert.equal(valRes.status, 200);
    const valBody = await valRes.json();
    assert.equal(valBody.data.canProceed, true);
    assert.ok(valBody.data.items.length >= 2);

    // Initial stock for critical yogurt batch
    const initialBatch = await Batch.findById(criticalYogurtBatchId);
    const initialAvailable = initialBatch.quantity;
    const initialReserved = initialBatch.reservedQuantity;

    // Atomic Stock Reservation
    const resRes = await fetch(`${baseUrl}/cart/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert.equal(resRes.status, 200);
    const resBody = await resRes.json();
    assert.equal(resBody.data.success, true);

    // Verify batch stock was atomically locked: available decreased, reserved increased
    const afterBatch = await Batch.findById(criticalYogurtBatchId);
    assert.ok(afterBatch.quantity < initialAvailable);
    assert.ok(afterBatch.reservedQuantity > initialReserved);

    // Verify InventoryAudit log record was created
    const audits = await InventoryAudit.find({
      batchId: criticalYogurtBatchId,
      actionType: 'STOCK_RESERVATION',
    });
    assert.ok(audits.length >= 1);
  });

  it('9. Removes items and clears cart cleanly', async () => {
    // Remove Organic Milk
    const removeRes = await fetch(`${baseUrl}/cart/items/${productOrganicMilkId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(removeRes.status, 200);
    const removeBody = await removeRes.json();
    assert.equal(
      removeBody.data.items.some((i) => i.productId.toString() === productOrganicMilkId.toString()),
      false
    );

    // Clear entire cart
    const clearRes = await fetch(`${baseUrl}/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(clearRes.status, 200);
    const clearBody = await clearRes.json();
    assert.equal(clearBody.data.items.length, 0);
    assert.equal(clearBody.data.pricingSummary.finalTotal, 0);
  });
});
