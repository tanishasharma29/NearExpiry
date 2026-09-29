import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import sellerRoutes from './seller.routes.js';
import storeRoutes from './store.routes.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import batchRoutes from './batch.routes.js';
import inventoryRoutes from './inventory.routes.js';
import pricingRoutes from './pricing.routes.js';
import expiryRoutes from './expiry.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import wishlistRoutes from './wishlist.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/sellers', sellerRoutes);
router.use('/stores', storeRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/batches', batchRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/pricing', pricingRoutes);
router.use('/expiry', expiryRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/wishlist', wishlistRoutes);

export default router;
