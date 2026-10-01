import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getUserNotificationsService,
  getUnreadNotificationCountService,
  markNotificationAsReadService,
  markAllNotificationsAsReadService,
  deleteNotificationService,
} from '../services/notification.service.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const result = await getUserNotificationsService(req.user._id, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Notifications retrieved successfully', result)
  );
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await getUnreadNotificationCountService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Unread notification count retrieved', result)
  );
});

export const markAsRead = asyncHandler(async (req, res) => {
  const result = await markNotificationAsReadService(req.params.id, req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Notification marked as read', result)
  );
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsAsReadService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'All notifications marked as read', result)
  );
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const result = await deleteNotificationService(req.params.id, req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Notification dismissed', result)
  );
});
