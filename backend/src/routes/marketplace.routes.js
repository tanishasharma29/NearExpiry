import { Router } from 'express';
import {
  browseMarketplace,
  getMarketplaceProductDetails,
  getMarketplaceProductBatches,
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from '../controllers/marketplace.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  browseMarketplaceSchema,
  wishlistAddSchema,
} from '../validators/marketplace.validator.js';

const router = Router();

// 1. Browse, Search, Filter & Sort Marketplace Deals
router.get(
  '/products',
  optionalAuthenticate,
  validateRequest(browseMarketplaceSchema),
  browseMarketplace
);

router.get(
  '/nearby',
  optionalAuthenticate,
  validateRequest(browseMarketplaceSchema),
  browseMarketplace
);

// 2. View Product Details & Available Non-Expired Batches in FEFO Order
router.get('/products/:productId', optionalAuthenticate, getMarketplaceProductDetails);
router.get('/products/:productId/batches', optionalAuthenticate, getMarketplaceProductBatches);

// 3. Customer Wishlist Endpoints
router.get('/wishlist', authenticate, getWishlist);
router.post('/wishlist', authenticate, validateRequest(wishlistAddSchema), addToWishlist);
router.delete('/wishlist/:productId', authenticate, removeFromWishlist);

export default router;
