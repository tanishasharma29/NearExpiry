import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  addToCartSchema,
  updateCartItemQuantitySchema,
  removeCartItemSchema,
  checkoutValidateSchema,
} from '../validators/cart.validator.js';
import {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  checkoutValidate,
  syncCart,
  reserveCartStock,
} from '../controllers/cart.controller.js';

const router = Router();

// All cart endpoints require authenticated CUSTOMER
router.use(authenticate);
router.use(authorizeRoles('CUSTOMER'));

router.get('/', getCart);
router.delete('/', clearCart);
router.post('/items', validateRequest(addToCartSchema), addItemToCart);
router.put('/items/:productId', validateRequest(updateCartItemQuantitySchema), updateCartItemQuantity);
router.delete('/items/:productId', validateRequest(removeCartItemSchema), removeCartItem);

// Checkout validation & stock reservation gates
router.post('/checkout-validate', validateRequest(checkoutValidateSchema), checkoutValidate);
router.post('/sync', syncCart);
router.post('/reserve', reserveCartStock);

export default router;
