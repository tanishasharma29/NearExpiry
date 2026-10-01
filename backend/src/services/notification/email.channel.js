import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

// In-memory array of dispatched emails for testing and development verification
export const sentEmails = [];

export const getSentEmails = () => [...sentEmails];
export const clearSentEmails = () => {
  sentEmails.length = 0;
};

/**
 * Configure Nodemailer transport:
 * In test mode or when SMTP is not configured, uses JSON/mock transport.
 * In production with credentials, uses genuine SMTP host/port.
 */
let transporter = null;

export const getTransporter = () => {
  if (transporter) return transporter;

  const isTestOrLocal =
    process.env.NODE_ENV === 'test' ||
    !process.env.SMTP_USER ||
    process.env.SMTP_USER === '';

  if (isTestOrLocal) {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

/**
 * Render standard responsive NearExpiry HTML email layout.
 */
export const renderEmailLayout = ({ title, message, actionText, actionUrl, metadata = {} }) => {
  const metaRows = Object.entries(metadata)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding: 6px 12px; font-weight: 600; color: #475569; text-transform: capitalize; border-bottom: 1px solid #e2e8f0;">${k.replace(/([A-Z])/g, ' $1')}:</td>
        <td style="padding: 6px 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${v}</td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #047857; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">NearExpiry</h1>
              <p style="color: #a7f3d0; margin: 4px 0 0 0; font-size: 13px;">Sustainable Hyperlocal Rescue Marketplace</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${title}</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
              ${
                metaRows
                  ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                ${metaRows}
              </table>`
                  : ''
              }
              ${
                actionText && actionUrl
                  ? `
              <div style="text-align: center; margin-top: 24px;">
                <a href="${actionUrl}" style="background-color: #047857; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">${actionText}</a>
              </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0;">NearExpiry Hyperlocal Network • Automated System Notice</p>
              <p style="margin: 4px 0 0 0;">Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Send email through configured Nodemailer transport.
 */
export const sendNotificationEmail = async ({
  to,
  subject,
  title,
  message,
  metadata = {},
  actionText = null,
  actionUrl = null,
}) => {
  if (!to || !to.includes('@')) {
    return { status: 'SKIPPED', error: 'Invalid recipient email address' };
  }

  const html = renderEmailLayout({
    title: title || subject,
    message,
    actionText,
    actionUrl,
    metadata,
  });

  const text = `${title || subject}\n\n${message}\n\n${Object.entries(metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n\nPowered by NearExpiry`;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'NearExpiry <no-reply@nearexpiry.app>',
    to,
    subject,
    text,
    html,
  };

  try {
    const transport = getTransporter();
    const info = await transport.sendMail(mailOptions);

    const record = {
      to,
      subject,
      title: title || subject,
      message,
      metadata,
      html,
      text,
      messageId: info.messageId || `msg-${Date.now()}`,
      sentAt: new Date(),
    };
    sentEmails.push(record);

    return {
      status: 'SENT',
      messageId: record.messageId,
      sentAt: record.sentAt,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      error: error.message || 'Email dispatch failed',
    };
  }
};
