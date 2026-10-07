import mongoose from 'mongoose';
import { Category, CATEGORY_STATUS } from '../src/models/category.model.js';
import { User, USER_ROLES } from '../src/models/user.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nearexpiry';

export const CURATED_CATEGORIES = [
  {
    name: 'Dairy & Eggs',
    description: 'Fresh milk, curd, paneer, yogurts, cheeses, and farm eggs with short shelf-life deals.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Bakery & Bread',
    description: 'Fresh bread, pav, buns, cakes, cookies, croissants, and daily artisanal bakes.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Fruits & Vegetables',
    description: 'Farm fresh fruits, seasonal green veggies, salads, and ripe produce at markdown prices.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Snacks & Munchies',
    description: 'Chips, crisps, namkeen, roasted nuts, biscuits, and savory evening snacks.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Beverages & Juices',
    description: 'Cold-pressed juices, milkshakes, soft drinks, artisan tea, and brewed coffees.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Meat, Seafood & Poultry',
    description: 'High-protein fresh chicken, mutton cuts, farm eggs, and fresh fish.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Pantry & Staples',
    description: 'Grains, organic flours, rice, pulses, cooking oils, ghee, and everyday spices.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Packaged & Instant Foods',
    description: 'Noodles, pasta, gourmet sauces, breakfast cereals, spreads, and ready meals.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Chocolates & Sweets',
    description: 'Premium chocolates, Indian sweets, confectionery, and dessert treats.',
    status: CATEGORY_STATUS.ACTIVE,
  },
  {
    name: 'Personal Care & Household',
    description: 'Bath soaps, shampoos, skincare essentials, sanitizers, and cleaning supplies.',
    status: CATEGORY_STATUS.ACTIVE,
  },
];

export const seedCuratedCategories = async () => {
  console.log('[Seed] Connecting to MongoDB:', MONGODB_URI);
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI);
  }

  // Get or find system admin
  const admin = await User.findOne({ role: USER_ROLES.ADMIN }).lean();
  const adminId = admin?._id || null;

  let seededCount = 0;
  for (const catData of CURATED_CATEGORIES) {
    const existing = await Category.findOne({ name: catData.name });
    if (!existing) {
      await Category.create({
        ...catData,
        createdBy: adminId,
      });
      seededCount++;
      console.log(`  ✔ Created category: [${catData.name}]`);
    } else {
      if (existing.status !== CATEGORY_STATUS.ACTIVE) {
        existing.status = CATEGORY_STATUS.ACTIVE;
        await existing.save();
        console.log(`  ✔ Activated category: [${catData.name}]`);
      }
    }
  }

  console.log(`[Seed] Curated categories seeding finished. Added ${seededCount} new categories.`);
};

// Auto-run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  seedCuratedCategories()
    .then(async () => {
      await mongoose.disconnect();
      console.log('[Seed] Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error seeding categories:', err);
      process.exit(1);
    });
}

