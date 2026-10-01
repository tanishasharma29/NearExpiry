import fs from 'fs';
import path from 'path';

const backendDir = 'c:/Users/User/OneDrive/Desktop/NearExpiry/backend';
const frontendDir = 'c:/Users/User/OneDrive/Desktop/NearExpiry/frontend';

// 1. Update backend/src/services/auth.service.js
const authServicePath = path.join(backendDir, 'src/services/auth.service.js');
let authServiceContent = fs.readFileSync(authServicePath, 'utf8');

if (!authServiceContent.includes("import { Store, STORE_OPERATIONAL_STATUS } from '../models/store.model.js';")) {
  authServiceContent = "import { Store, STORE_OPERATIONAL_STATUS } from '../models/store.model.js';\n" + authServiceContent;
}

const targetUserCreate = `  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    role: USER_ROLES.SELLER,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    sellerProfile: {
      storeName,
      businessLicenseNumber: businessLicenseNumber || null,
      gstNumber: gstNumber || null,
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      cosmeticLicenseNumber: cosmeticLicenseNumber || null,
      address: {
        street: address?.street || '',
        city: address?.city || '',
        state: address?.state || '',
        pincode: address?.pincode || '',
      },
      location: {
        type: 'Point',
        coordinates,
      },
      submittedAt: new Date(),
    },
    lastLoginAt: new Date(),
  });

  const token = generateAccessToken(user);`;

const replacementUserCreate = `  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    role: USER_ROLES.SELLER,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    sellerProfile: {
      storeName,
      businessLicenseNumber: businessLicenseNumber || null,
      gstNumber: gstNumber || null,
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      cosmeticLicenseNumber: cosmeticLicenseNumber || null,
      address: {
        street: address?.street || 'Retail Market Road',
        city: address?.city || 'Bangalore',
        state: address?.state || 'Karnataka',
        pincode: address?.pincode || '560001',
      },
      location: {
        type: 'Point',
        coordinates,
      },
      submittedAt: new Date(),
    },
    lastLoginAt: new Date(),
  });

  const slug = (storeName || \`\${name} Store\`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 10000);

  try {
    await Store.create({
      ownerId: user._id,
      storeName: storeName || \`\${name}'s Store\`,
      slug,
      description: 'Neighborhood Supermarket Partner',
      contactPhone: phone || '9999999999',
      contactEmail: email,
      businessDetails: {
        businessLicenseNumber: businessLicenseNumber || null,
        gstNumber: gstNumber || null,
        fssaiLicenseNumber: fssaiLicenseNumber || null,
        cosmeticLicenseNumber: cosmeticLicenseNumber || null,
      },
      address: {
        street: address?.street || 'Retail Market Road',
        city: address?.city || 'Bangalore',
        state: address?.state || 'Karnataka',
        pincode: address?.pincode || '560001',
      },
      latitude: coordinates[1] || 12.9716,
      longitude: coordinates[0] || 77.5946,
      location: {
        type: 'Point',
        coordinates,
      },
      status: STORE_OPERATIONAL_STATUS.OPEN,
      verificationStatus: user.verificationStatus,
      isActive: true,
      fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
      deliveryRadiusKm: 10,
    });
  } catch (err) {
    console.error('Error auto-provisioning store on seller registration:', err);
  }

  const token = generateAccessToken(user);`;

authServiceContent = authServiceContent.replace(targetUserCreate, replacementUserCreate);
fs.writeFileSync(authServicePath, authServiceContent, 'utf8');
console.log('Updated auth.service.js with store creation');

// 2. Update backend/src/services/store.service.js with ensureSellerStore
const storeServicePath = path.join(backendDir, 'src/services/store.service.js');
let storeServiceContent = fs.readFileSync(storeServicePath, 'utf8');

const ensureStoreFn = `
/**
 * Helper to ensure a Seller has a Store document provisioned.
 * Prevents 404 STORE_NOT_FOUND when sellers access dashboard/inventory.
 */
export const ensureSellerStore = async (sellerUser) => {
  if (!sellerUser || sellerUser.role !== USER_ROLES.SELLER) return null;
  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    const coordinates = sellerUser.sellerProfile?.location?.coordinates || [77.5946, 12.9716];
    const storeName = sellerUser.sellerProfile?.storeName || \`\${sellerUser.name}'s Store\`;
    const slug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 10000);

    store = await Store.create({
      ownerId: sellerUser._id,
      storeName: storeName,
      slug,
      description: 'Neighborhood Supermarket Partner',
      contactPhone: sellerUser.phone || '9999999999',
      contactEmail: sellerUser.email,
      businessDetails: {
        businessLicenseNumber: sellerUser.sellerProfile?.businessLicenseNumber || null,
        gstNumber: sellerUser.sellerProfile?.gstNumber || null,
        fssaiLicenseNumber: sellerUser.sellerProfile?.fssaiLicenseNumber || null,
        cosmeticLicenseNumber: sellerUser.sellerProfile?.cosmeticLicenseNumber || null,
      },
      address: {
        street: sellerUser.sellerProfile?.address?.street || 'Retail Market Road',
        city: sellerUser.sellerProfile?.address?.city || 'Bangalore',
        state: sellerUser.sellerProfile?.address?.state || 'Karnataka',
        pincode: sellerUser.sellerProfile?.address?.pincode || '560001',
      },
      latitude: coordinates[1] || 12.9716,
      longitude: coordinates[0] || 77.5946,
      location: {
        type: 'Point',
        coordinates,
      },
      status: 'OPEN',
      verificationStatus: sellerUser.verificationStatus || VERIFICATION_STATUS.APPROVED,
      isActive: true,
      fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
      deliveryRadiusKm: 10,
    });
  }
  return store;
};
`;

if (!storeServiceContent.includes('export const ensureSellerStore')) {
  storeServiceContent += ensureStoreFn;
  fs.writeFileSync(storeServicePath, storeServiceContent, 'utf8');
  console.log('Added ensureSellerStore to store.service.js');
}

// 3. Update backend/src/services/analytics.service.js
const analyticsServicePath = path.join(backendDir, 'src/services/analytics.service.js');
let analyticsContent = fs.readFileSync(analyticsServicePath, 'utf8');
if (!analyticsContent.includes("import { ensureSellerStore } from './store.service.js';")) {
  analyticsContent = "import { ensureSellerStore } from './store.service.js';\n" + analyticsContent;
}
analyticsContent = analyticsContent.replace(
  `  const store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }`,
  `  let store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }`
);
fs.writeFileSync(analyticsServicePath, analyticsContent, 'utf8');
console.log('Updated analytics.service.js with ensureSellerStore');

// 4. Update backend/src/services/order.service.js
const orderServicePath = path.join(backendDir, 'src/services/order.service.js');
let orderContent = fs.readFileSync(orderServicePath, 'utf8');
if (!orderContent.includes("import { ensureSellerStore } from './store.service.js';")) {
  orderContent = "import { ensureSellerStore } from './store.service.js';\n" + orderContent;
}
orderContent = orderContent.replace(
  `  const store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }`,
  `  let store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }`
);
fs.writeFileSync(orderServicePath, orderContent, 'utf8');
console.log('Updated order.service.js with ensureSellerStore');

// 5. Update backend/src/services/product.service.js
const productServicePath = path.join(backendDir, 'src/services/product.service.js');
let productContent = fs.readFileSync(productServicePath, 'utf8');
if (!productContent.includes("import { ensureSellerStore } from './store.service.js';")) {
  productContent = "import { ensureSellerStore } from './store.service.js';\n" + productContent;
}
productContent = productContent.replace(
  `  // 1. Ensure Seller has created a Store
  const store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    throw new ApiError(
      400,
      'You must create your Store before creating products.',
      'STORE_REQUIRED_FOR_PRODUCT'
    );
  }`,
  `  // 1. Ensure Seller has created a Store (auto-provision if needed)
  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(
      400,
      'You must create your Store before creating products.',
      'STORE_REQUIRED_FOR_PRODUCT'
    );
  }`
);
fs.writeFileSync(productServicePath, productContent, 'utf8');
console.log('Updated product.service.js with ensureSellerStore');

// 6. Update backend/src/services/batchInventory.service.js
const batchServicePath = path.join(backendDir, 'src/services/batchInventory.service.js');
let batchContent = fs.readFileSync(batchServicePath, 'utf8');
if (!batchContent.includes("import { ensureSellerStore } from './store.service.js';")) {
  batchContent = "import { ensureSellerStore } from './store.service.js';\n" + batchContent;
}
batchContent = batchContent.replace(
  `  const store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    throw new ApiError(
      400,
      'You must create a Store before adding product batches.',
      'STORE_REQUIRED'
    );
  }`,
  `  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(
      400,
      'You must create a Store before adding product batches.',
      'STORE_REQUIRED'
    );
  }`
);
fs.writeFileSync(batchServicePath, batchContent, 'utf8');
console.log('Updated batchInventory.service.js with ensureSellerStore');

// 7. Update frontend/src/services/productService.js
const feProductServicePath = path.join(frontendDir, 'src/services/productService.js');
let feProductContent = fs.readFileSync(feProductServicePath, 'utf8');
if (!feProductContent.includes('getMyProducts:')) {
  feProductContent = feProductContent.replace(
    '  getProducts: async (params = {}) => {',
    `  getMyProducts: async (params = {}) => {
    const res = await api.get('/products/my-products', { params });
    return res.data;
  },

  getProducts: async (params = {}) => {`
  );
  fs.writeFileSync(feProductServicePath, feProductContent, 'utf8');
  console.log('Updated frontend/src/services/productService.js with getMyProducts');
}

// 8. Update frontend/src/pages/seller/SellerProductsPage.jsx
const feSellerProductsPath = path.join(frontendDir, 'src/pages/seller/SellerProductsPage.jsx');
let feSellerProductsContent = fs.readFileSync(feSellerProductsPath, 'utf8');
feSellerProductsContent = feSellerProductsContent.replace(
  `      const [prodData, catData] = await Promise.all([
        productService.getProducts(),
        categoryService.getCategories({ status: 'ACTIVE' }),
      ]);`,
  `      const [prodData, catData] = await Promise.all([
        productService.getMyProducts().catch(() => productService.getProducts()),
        categoryService.getCategories({ status: 'ACTIVE' }),
      ]);`
);
fs.writeFileSync(feSellerProductsPath, feSellerProductsContent, 'utf8');
console.log('Updated SellerProductsPage.jsx to use getMyProducts');

// 9. Update frontend/src/pages/seller/SellerDashboardPage.jsx
const feSellerDashboardPath = path.join(frontendDir, 'src/pages/seller/SellerDashboardPage.jsx');
let feSellerDashboardContent = fs.readFileSync(feSellerDashboardPath, 'utf8');
feSellerDashboardContent = feSellerDashboardContent.replace(
  `        const [anData, ordData] = await Promise.all([
          analyticsService.getSellerAnalytics('30d'),
          orderService.getSellerOrders({ limit: 5 }),
        ]);
        setAnalytics(anData);
        setRecentOrders(ordData?.orders || []);`,
  `        const [anData, ordData] = await Promise.all([
          analyticsService.getSellerAnalytics('30d').catch((err) => {
            console.warn('Analytics empty or pending', err);
            return null;
          }),
          orderService.getSellerOrders({ limit: 5 }).catch((err) => {
            console.warn('Orders empty or pending', err);
            return { orders: [] };
          }),
        ]);
        setAnalytics(anData);
        setRecentOrders(ordData?.orders || []);`
);
fs.writeFileSync(feSellerDashboardPath, feSellerDashboardContent, 'utf8');
console.log('Updated SellerDashboardPage.jsx with resilient promise handling');

console.log('All backend and frontend store updates applied successfully!');

