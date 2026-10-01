import mongoose from 'mongoose';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../src/models/user.model.js';
import { Store, STORE_OPERATIONAL_STATUS } from '../src/models/store.model.js';
import { Category, CATEGORY_STATUS } from '../src/models/category.model.js';
import { Product, PRODUCT_STATUS } from '../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nearexpiry';

const seed = async () => {
  console.log('[Seed] Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // 1. Admin Account
  let admin = await User.findOne({ email: 'admin@nearexpiry.com' });
  if (!admin) {
    admin = await User.create({
      name: 'System Administrator',
      email: 'admin@nearexpiry.com',
      password: 'Password123!',
      phone: '9876500001',
      role: USER_ROLES.ADMIN,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
    });
    console.log('✔ Admin user created: admin@nearexpiry.com / Password123!');
  } else {
    admin.password = 'Password123!';
    admin.role = USER_ROLES.ADMIN;
    admin.verificationStatus = VERIFICATION_STATUS.APPROVED;
    admin.isActive = true;
    await admin.save();
    console.log('✔ Admin user updated: admin@nearexpiry.com / Password123!');
  }

  // Seed default price rules
  await resetDefaultPriceRulesService(admin._id);

  // 2. Seller Account
  let seller = await User.findOne({ email: 'seller@nearexpiry.com' });
  if (!seller) {
    seller = await User.create({
      name: 'FreshMart Owner',
      email: 'seller@nearexpiry.com',
      password: 'Password123!',
      phone: '9876500002',
      role: USER_ROLES.SELLER,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
      sellerProfile: {
        storeName: 'FreshMart Hyperlocal Groceries',
        businessLicenseNumber: 'BL-99281',
        gstNumber: '29ABCDE1234F1Z5',
        fssaiLicenseNumber: '11223344556677',
        address: {
          street: '100 Feet Road, Indiranagar',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560038',
        },
        location: {
          type: 'Point',
          coordinates: [77.6408, 12.9716],
        },
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    console.log('✔ Seller user created: seller@nearexpiry.com / Password123!');
  } else {
    seller.password = 'Password123!';
    seller.role = USER_ROLES.SELLER;
    seller.verificationStatus = VERIFICATION_STATUS.APPROVED;
    seller.isActive = true;
    await seller.save();
    console.log('✔ Seller user updated: seller@nearexpiry.com / Password123!');
  }

  // Seller Store
  let store = await Store.findOne({ ownerId: seller._id });
  if (!store) {
    store = await Store.create({
      ownerId: seller._id,
      storeName: 'FreshMart Hyperlocal Groceries',
      slug: 'freshmart-hyperlocal-bangalore',
      description: 'Your neighborhood trusted grocery store offering premium near-expiry discounts.',
      contactPhone: '9876500002',
      contactEmail: 'seller@nearexpiry.com',
      businessDetails: {
        businessLicenseNumber: 'BL-99281',
        gstNumber: '29ABCDE1234F1Z5',
        fssaiLicenseNumber: '11223344556677',
      },
      address: {
        street: '100 Feet Road, Indiranagar',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560038',
      },
      latitude: 12.9716,
      longitude: 77.6408,
      location: {
        type: 'Point',
        coordinates: [77.6408, 12.9716],
      },
      status: STORE_OPERATIONAL_STATUS.OPEN,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
      fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
      deliveryRadiusKm: 15,
    });
    console.log('✔ Seller store created: FreshMart Hyperlocal Groceries');
  }

  // 3. Customer Account
  let customer = await User.findOne({ email: 'customer@nearexpiry.com' });
  if (!customer) {
    customer = await User.create({
      name: 'Priya Sharma',
      email: 'customer@nearexpiry.com',
      password: 'Password123!',
      phone: '9876500003',
      role: USER_ROLES.CUSTOMER,
      verificationStatus: VERIFICATION_STATUS.NOT_APPLICABLE,
      isActive: true,
    });
    console.log('✔ Customer user created: customer@nearexpiry.com / Password123!');
  } else {
    customer.password = 'Password123!';
    customer.role = USER_ROLES.CUSTOMER;
    customer.isActive = true;
    await customer.save();
    console.log('✔ Customer user updated: customer@nearexpiry.com / Password123!');
  }

  // Seed Categories & Products if not present
  let dairyCat = await Category.findOne({ name: 'Dairy & Eggs' });
  if (!dairyCat) {
    dairyCat = await Category.create({
      name: 'Dairy & Eggs',
      description: 'Fresh milk, yogurts, cheeses, and farm eggs.',
      status: CATEGORY_STATUS.ACTIVE,
      createdBy: admin._id,
    });
  }

  let bakeryCat = await Category.findOne({ name: 'Bakery & Snacks' });
  if (!bakeryCat) {
    bakeryCat = await Category.create({
      name: 'Bakery & Snacks',
      description: 'Artisan bread, croissants, chips, and snacks.',
      status: CATEGORY_STATUS.ACTIVE,
      createdBy: admin._id,
    });
  }

  let yogurt = await Product.findOne({ name: 'Organic Greek Yogurt 500g' });
  if (!yogurt) {
    yogurt = await Product.create({
      name: 'Organic Greek Yogurt 500g',
      description: 'Rich and creamy Greek yogurt packed with high protein.',
      brand: 'Epigamia',
      category: dairyCat._id,
      sellerId: seller._id,
      storeId: store._id,
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop',
      unit: 'pcs',
      status: PRODUCT_STATUS.ACTIVE,
    });

    const now = new Date();
    const expiry3Days = new Date(now.getTime() + 3 * 86400000);
    await Batch.create({
      productId: yogurt._id,
      storeId: store._id,
      sellerId: seller._id,
      batchNumber: 'LOT-YOG-001',
      manufacturingDate: new Date(now.getTime() - 10 * 86400000),
      expiryDate: expiry3Days,
      quantity: 25,
      initialQuantity: 25,
      reservedQuantity: 0,
      soldQuantity: 0,
      originalPrice: 200,
      currentPrice: 80,
      discountPercentage: 60,
      status: BATCH_STATUS.CRITICAL,
      isPurchasable: true,
    });
    console.log('✔ Seeded Demo Product & Batch: Organic Greek Yogurt 500g');
  }

  await mongoose.disconnect();
  console.log('[Seed] Completed successfully.');
};

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
