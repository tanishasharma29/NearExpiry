import { Notification, NOTIFICATION_CHANNELS, EMAIL_STATUS } from '../../models/notification.model.js';
import { sendNotificationEmail } from './email.channel.js';

/**
 * Notification Dispatcher Architecture.
 *
 * Pluggable multi-channel event router.
 * Dispatches to:
 * 1. IN_APP -> Persistent MongoDB Notification collection
 * 2. EMAIL -> Nodemailer transport
 * 3. REALTIME -> Extensible hook for Socket.IO / SSE / WebSocket server
 * 4. QUEUE -> Extensible hook for BullMQ / Redis / RabbitMQ worker queues
 */
export class NotificationDispatcher {
  constructor() {
    this.customChannels = new Map();
    this.queueHook = null;
    this.realtimeHook = null;
  }

  /**
   * Register a custom channel handler for future extensibility (e.g. SMS, WhatsApp, WebPush)
   */
  registerChannel(channelName, handler) {
    this.customChannels.set(channelName, handler);
  }

  /**
   * Attach a realtime broker (e.g. Socket.IO instance or Redis pub/sub publisher)
   */
  attachRealtimeBroker(broker) {
    this.realtimeHook = broker;
  }

  /**
   * Attach a background job queue (e.g. BullMQ / Redis queue producer)
   */
  attachQueueProducer(queueProducer) {
    this.queueHook = queueProducer;
  }

  /**
   * Dispatch a notification payload across all requested channels.
   * Enforces strict deduplication via dedupKey.
   */
  async dispatch({
    recipient,
    recipientEmail = '',
    recipientRole = 'CUSTOMER',
    type,
    title,
    message,
    data = {},
    dedupKey = null,
    channels = [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.REALTIME],
    emailMetadata = {},
    actionText = null,
    actionUrl = null,
  }) {
    // 1. Deduplication Check (Database level)
    if (dedupKey) {
      const existing = await Notification.findOne({ dedupKey });
      if (existing) {
        return {
          isDuplicate: true,
          notification: existing,
          dispatchedChannels: [],
          message: 'Duplicate notification suppressed by dedupKey',
        };
      }
    }

    // 2. Queue Delegation Hook:
    // If a background queue producer is attached and asynchronous queueing is requested,
    // push job to queue instead of inline execution.
    if (this.queueHook && channels.includes(NOTIFICATION_CHANNELS.QUEUE)) {
      await this.queueHook.add('dispatch-notification', {
        recipient,
        recipientEmail,
        recipientRole,
        type,
        title,
        message,
        data,
        dedupKey,
        channels: channels.filter((c) => c !== NOTIFICATION_CHANNELS.QUEUE),
      });
      return { isQueued: true };
    }

    // 3. Channel: IN_APP (MongoDB)
    let createdNotification = null;
    if (channels.includes(NOTIFICATION_CHANNELS.IN_APP)) {
      try {
        createdNotification = await Notification.create({
          recipient,
          recipientEmail,
          recipientRole,
          type,
          title,
          message,
          data,
          dedupKey,
          channels,
          emailDelivery: {
            status: channels.includes(NOTIFICATION_CHANNELS.EMAIL)
              ? EMAIL_STATUS.PENDING
              : EMAIL_STATUS.SKIPPED,
          },
        });
      } catch (err) {
        // Handle race-condition duplicate key error on dedupKey
        if (err.code === 11000) {
          const duplicate = await Notification.findOne({ dedupKey });
          return {
            isDuplicate: true,
            notification: duplicate,
            dispatchedChannels: [],
            message: 'Duplicate notification suppressed by unique dedupKey constraint',
          };
        }
        throw err;
      }
    }

    // 4. Channel: EMAIL (Nodemailer)
    let emailResult = { status: EMAIL_STATUS.SKIPPED };
    if (channels.includes(NOTIFICATION_CHANNELS.EMAIL) && recipientEmail) {
      emailResult = await sendNotificationEmail({
        to: recipientEmail,
        subject: title,
        title,
        message,
        metadata: { ...data, ...emailMetadata },
        actionText,
        actionUrl,
      });

      if (createdNotification) {
        createdNotification.emailDelivery = {
          status: emailResult.status,
          sentAt: emailResult.sentAt || null,
          messageId: emailResult.messageId || null,
          error: emailResult.error || null,
        };
        await createdNotification.save();
      }
    }

    // 5. Channel: REALTIME (Socket.IO / Redis PubSub Hook)
    if (this.realtimeHook && channels.includes(NOTIFICATION_CHANNELS.REALTIME)) {
      try {
        this.realtimeHook.emitToUser(recipient.toString(), {
          notificationId: createdNotification?._id,
          type,
          title,
          message,
          data,
          createdAt: createdNotification?.createdAt || new Date(),
        });
      } catch (err) {
        console.error('[NotificationDispatcher] Realtime dispatch error:', err);
      }
    }

    // 6. Custom Channels
    for (const [name, handler] of this.customChannels.entries()) {
      if (channels.includes(name)) {
        try {
          await handler({ recipient, type, title, message, data });
        } catch (err) {
          console.error(`[NotificationDispatcher] Channel ${name} error:`, err);
        }
      }
    }

    return {
      isDuplicate: false,
      notification: createdNotification,
      emailResult,
      dispatchedChannels: channels,
    };
  }
}

export const defaultDispatcher = new NotificationDispatcher();
