import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
} from '../validators/notification.validator.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notification.controller.js';

const router = Router();

// All notification management routes require authentication
router.use(authenticate);

router.get('/', validateRequest(listNotificationsSchema), listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllAsRead);
router.patch('/:id/read', validateRequest(notificationIdParamSchema), markAsRead);
router.delete('/:id', validateRequest(notificationIdParamSchema), deleteNotification);

export default router;
