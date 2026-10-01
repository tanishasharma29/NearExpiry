import { SecurityLog, SECURITY_EVENT_TYPES } from '../models/securityLog.model.js';

export { SECURITY_EVENT_TYPES };

/**
 * Dispatches an asynchronous security audit log event.
 * Fails safely without throwing errors that could interrupt request lifecycle.
 */
export const recordSecurityEvent = async ({
  eventType,
  userId = null,
  email = null,
  role = null,
  ipAddress = null,
  userAgent = null,
  path = null,
  method = null,
  statusCode = null,
  details = {},
}) => {
  try {
    await SecurityLog.create({
      eventType,
      userId,
      email,
      role,
      ipAddress,
      userAgent,
      path,
      method,
      statusCode,
      details,
    });
  } catch (err) {
    // Non-blocking security logging fallback
    console.error(`[SecurityAudit] Failed to record event ${eventType}:`, err.message);
  }
};
