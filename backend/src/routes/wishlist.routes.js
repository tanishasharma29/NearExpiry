import { Router } from 'express';
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from '../controllers/marketplace.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { wishlistAddSchema } from '../validators/marketplace.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', getWishlist);
router.post('/', validateRequest(wishlistAddSchema), addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
