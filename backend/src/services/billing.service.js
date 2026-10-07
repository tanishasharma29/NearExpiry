import mongoose from 'mongoose';
import { BillReceipt } from '../models/billReceipt.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { Store } from '../models/store.model.js';
import { User, USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { getTransporter, sentEmails } from './notification/email.channel.js';
import { ensureSellerStore } from './store.service.js';

/**
 * Generate unique bill receipt number: RCPT-YYYYMMDD-XXXX
 */
const generateReceiptNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `RCPT-${dateStr}-${randomSuffix}`;
};

/**
 * Render standard HTML receipt layout for email dispatch
 */
export const renderBillReceiptHtml = (bill, downloadUrl) => {
  const storeAddress =
    typeof bill.storeInfo.address === 'object'
      ? `${bill.storeInfo.address.street || ''}, ${bill.storeInfo.address.city || ''} ${bill.storeInfo.address.pincode || ''}`
      : bill.storeInfo.address || 'Local Neighborhood Store';

  const itemsHtml = bill.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 8px; vertical-align: top;">
        <strong style="color: #0f172a; font-size: 14px;">${item.productName}</strong>
        ${item.brand ? `<div style="font-size: 12px; color: #64748b;">Brand: ${item.brand}</div>` : ''}
        ${
          item.batchAllocations?.length > 0
            ? `<div style="font-size: 11px; color: #047857; margin-top: 4px; font-family: monospace;">
                ${item.batchAllocations
                  .map(
                    (b) =>
                      `Lot #${b.batchNumber} (Exp: ${new Date(b.expiryDate).toLocaleDateString()}) - ${b.allocatedQuantity} unit(s)`
                  )
                  .join('<br />')}
              </div>`
            : ''
        }
      </td>
      <td style="padding: 12px 8px; text-align: center; vertical-align: top; font-weight: 600; color: #334155;">
        ${item.requestedQuantity}
      </td>
      <td style="padding: 12px 8px; text-align: right; vertical-align: top; color: #94a3b8; text-decoration: line-through;">
        ₹${Number(item.lineOriginalAmount || 0).toFixed(2)}
      </td>
      <td style="padding: 12px 8px; text-align: right; vertical-align: top; font-weight: 700; color: #0f172a;">
        ₹${Number(item.lineDiscountedAmount || 0).toFixed(2)}
      </td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bill Receipt - NearExpiry</title>
</head>
<body style="margin: 0; padding: 24px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #047857; padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">NearExpiry</h1>
              <p style="margin: 4px 0 0; color: #a7f3d0; font-size: 13px; font-weight: 500;">
                Official Tax & Counter Delivery Receipt
              </p>
            </td>
          </tr>

          <!-- Receipt Details -->
          <tr>
            <td style="padding: 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="vertical-align: top; width: 50%; font-size: 13px; color: #475569; line-height: 1.5;">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Billed To:</span><br />
                    <strong style="color: #0f172a; font-size: 15px;">${bill.customerInfo?.name || 'Valued Customer'}</strong><br />
                    ${bill.customerInfo?.email || ''}<br />
                    ${bill.customerInfo?.phone || ''}
                  </td>
                  <td style="vertical-align: top; width: 50%; font-size: 13px; color: #475569; line-height: 1.5; text-align: right;">
                    <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Store Merchant:</span><br />
                    <strong style="color: #0f172a; font-size: 15px;">${bill.storeInfo?.storeName || 'Neighborhood Store'}</strong><br />
                    ${storeAddress}<br />
                    <span style="display: inline-block; margin-top: 6px; font-size: 12px; font-family: monospace; background-color: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                      Receipt: ${bill.receiptNumber}
                    </span>
                  </td>
                </tr>
              </table>

              <div style="background-color: #f1f5f9; padding: 10px 14px; border-radius: 8px; font-size: 12px; color: #475569; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <span>Order Ref: <strong style="color: #0f172a; font-family: monospace;">#${bill.orderNumber}</strong></span>
                <span>Delivered: <strong>${new Date(bill.deliveredAt).toLocaleString()}</strong></span>
                <span>Fulfillment: <strong>${bill.fulfillmentType}</strong></span>
              </div>

              <!-- Itemized Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #64748b; text-transform: uppercase;">
                    <th style="padding: 10px 8px; text-align: left;">Product & Lot</th>
                    <th style="padding: 10px 8px; text-align: center;">Qty</th>
                    <th style="padding: 10px 8px; text-align: right;">Catalog</th>
                    <th style="padding: 10px 8px; text-align: right;">Near-Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Totals Breakdown -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td width="55%"></td>
                  <td width="45%">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569; line-height: 1.8;">
                      <tr>
                        <td>Catalog Subtotal:</td>
                        <td style="text-align: right; color: #0f172a; font-weight: 600;">₹${Number(bill.pricingSummary.subtotal).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="color: #16a34a; font-weight: 600;">Near-Expiry Savings:</td>
                        <td style="text-align: right; color: #16a34a; font-weight: 700;">-₹${Number(bill.pricingSummary.discounts).toFixed(2)}</td>
                      </tr>
                      ${
                        bill.pricingSummary.deliveryFee > 0
                          ? `<tr>
                              <td>Delivery Fee:</td>
                              <td style="text-align: right; color: #0f172a; font-weight: 600;">₹${Number(bill.pricingSummary.deliveryFee).toFixed(2)}</td>
                            </tr>`
                          : ''
                      }
                      <tr style="border-top: 2px solid #047857; font-size: 16px;">
                        <td style="padding-top: 8px; font-weight: 800; color: #0f172a;">Total Paid:</td>
                        <td style="padding-top: 8px; text-align: right; font-weight: 900; color: #047857;">₹${Number(bill.pricingSummary.finalTotal).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="font-size: 11px; color: #64748b; text-align: right; padding-top: 4px;">
                          Payment: <strong>${bill.paymentMethod}</strong> • Status: <strong style="color: #047857;">${bill.paymentStatus}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              ${
                downloadUrl
                  ? `
              <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <a href="${downloadUrl}" style="background-color: #047857; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(4,120,87,0.3);">
                  Download / Print Bill Receipt
                </a>
              </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0;">NearExpiry Hyperlocal Zero-Waste Network • Tax Invoice Verified</p>
              <p style="margin: 4px 0 0;">Items sold with authentic FEFO batch allocation tags.</p>
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
 * 1. Create or Retrieve Bill Receipt upon Order Delivery (Atomic & Idempotent)
 */
export const generateBillReceiptService = async (orderId, options = {}) => {
  const existingReceipt = await BillReceipt.findOne({ orderId }).lean();
  if (existingReceipt) {
    return existingReceipt;
  }

  const order = await Order.findById(orderId)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'storeName address contactPhone contactEmail')
    .lean();

  if (!order) {
    throw new ApiError(404, 'Order not found for billing receipt generation.', 'ORDER_NOT_FOUND');
  }

  const receiptNumber = await generateReceiptNumber();
  const customer = order.customerId || {};
  const store = order.storeId || {};

  const billDocData = {
    receiptNumber,
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerId: customer._id || order.customerId,
    customerInfo: {
      name: customer.name || 'Customer',
      email: customer.email || '',
      phone: customer.phone || '',
    },
    storeId: store._id || order.storeId,
    storeInfo: {
      storeName: store.storeName || 'Neighborhood Store',
      address: store.address || '',
      contactPhone: store.contactPhone || '',
      contactEmail: store.contactEmail || '',
    },
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      brand: item.brand || '',
      unit: item.unit || 'pcs',
      requestedQuantity: item.requestedQuantity,
      blendedUnitPrice: item.blendedUnitPrice,
      lineOriginalAmount: item.lineOriginalAmount,
      lineDiscountedAmount: item.lineDiscountedAmount,
      lineSavingsAmount: item.lineSavingsAmount || 0,
      batchAllocations: (item.batchAllocations || []).map((b) => ({
        batchId: b.batchId,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        allocatedQuantity: b.allocatedQuantity,
        originalUnitPrice: b.originalUnitPrice || 0,
        discountedUnitPrice: b.discountedUnitPrice || 0,
        savings: b.savings || 0,
      })),
    })),
    pricingSummary: {
      subtotal: order.pricingSummary?.subtotal || 0,
      discounts: order.pricingSummary?.discounts || 0,
      deliveryFee: order.pricingSummary?.deliveryFee || 0,
      finalTotal: order.pricingSummary?.finalTotal || 0,
      totalSavings:
        order.pricingSummary?.totalSavings ||
        order.pricingSummary?.discounts ||
        0,
      itemCount: order.pricingSummary?.itemCount || order.items?.length || 0,
      totalUnits: order.pricingSummary?.totalUnits || 0,
    },
    paymentMethod: order.paymentMethod || 'CASH_ON_DELIVERY',
    paymentStatus: order.paymentStatus || 'PAID',
    fulfillmentType: order.fulfillmentType || 'PICKUP',
    deliveredAt: new Date(),
    verifiedBy: options.verifiedBy || 'Store Staff',
  };

  const receipt = await BillReceipt.create(billDocData);

  // Dispatch Asynchronous Email with Bill Receipt to Customer
  const customerEmail = customer.email;
  if (customerEmail && customerEmail.includes('@')) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const downloadUrl = `${clientUrl}/orders/${order._id}/invoice`;

    const htmlContent = renderBillReceiptHtml(receipt, downloadUrl);
    const textContent = `NearExpiry Bill Receipt #${receipt.receiptNumber}\nOrder #${receipt.orderNumber}\nTotal: ₹${receipt.pricingSummary.finalTotal}\nDownload Receipt: ${downloadUrl}`;

    try {
      const transporter = getTransporter();
      const mailOptions = {
        from: process.env.SMTP_FROM || 'NearExpiry <no-reply@nearexpiry.app>',
        to: customerEmail,
        subject: `Your Bill Receipt for Order #${receipt.orderNumber} - NearExpiry`,
        text: textContent,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      sentEmails.push({
        to: customerEmail,
        subject: mailOptions.subject,
        messageId: info?.messageId || `bill-${Date.now()}`,
        sentAt: new Date(),
      });

      receipt.emailSent = true;
      receipt.emailSentAt = new Date();
      receipt.emailMessageId = info?.messageId || `msg-${Date.now()}`;
      await receipt.save();
    } catch (emailErr) {
      console.error('[Billing] Failed to send receipt email to customer:', emailErr.message);
    }
  }

  return receipt;
};

/**
 * 2. Get Bill Receipt by Order ID (Accessible by owning Customer, Store Seller, or Admin)
 */
export const getBillReceiptByOrderIdService = async (orderId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  let receipt = await BillReceipt.findOne({ orderId }).lean();

  // If receipt doesn't exist yet, check if order is DELIVERED and generate it on-the-fly
  if (!receipt) {
    const order = await Order.findById(orderId).lean();
    if (order && order.status === ORDER_STATUS.DELIVERED) {
      receipt = await generateBillReceiptService(orderId, {
        verifiedBy: userActor.name || userActor.email,
      });
    } else {
      throw new ApiError(404, 'Bill receipt not available until order is completed/delivered.', 'RECEIPT_NOT_FOUND');
    }
  }

  // Authorization Check
  if (userActor.role === USER_ROLES.CUSTOMER) {
    if (receipt.customerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only view your own receipts.', 'FORBIDDEN');
    }
  } else if (userActor.role === USER_ROLES.SELLER) {
    const store = await ensureSellerStore(userActor);
    if (!store || store._id.toString() !== receipt.storeId.toString()) {
      throw new ApiError(403, 'Forbidden: You can only view receipts for your own store.', 'FORBIDDEN');
    }
  }

  return receipt;
};

/**
 * 3. Get All Store Billing Receipts for Seller Dashboard
 */
export const getSellerBillReceiptsService = async (sellerUser, query = {}) => {
  const store = await ensureSellerStore(sellerUser);
  if (!store) {
    throw new ApiError(404, 'No store found registered to this seller.', 'STORE_NOT_FOUND');
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = { storeId: store._id };

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { receiptNumber: searchRegex },
      { orderNumber: searchRegex },
      { 'customerInfo.name': searchRegex },
      { 'customerInfo.email': searchRegex },
    ];
  }

  const [receipts, total, aggregateStats] = await Promise.all([
    BillReceipt.find(filter).sort({ deliveredAt: -1 }).skip(skip).limit(limit).lean(),
    BillReceipt.countDocuments(filter),
    BillReceipt.aggregate([
      { $match: { storeId: store._id } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricingSummary.finalTotal' },
          totalSavingsGranted: { $sum: '$pricingSummary.discounts' },
          totalReceiptsCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const stats = aggregateStats[0] || {
    totalRevenue: 0,
    totalSavingsGranted: 0,
    totalReceiptsCount: 0,
  };

  return {
    store: {
      _id: store._id,
      storeName: store.storeName,
    },
    receipts,
    summary: {
      totalReceipts: stats.totalReceiptsCount,
      totalRevenueBilled: Math.round(stats.totalRevenue * 100) / 100,
      totalSavingsGranted: Math.round(stats.totalSavingsGranted * 100) / 100,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 4. Get Customer's Personal Billing Receipts
 */
export const getCustomerBillReceiptsService = async (customerId, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = { customerId };

  const [receipts, total] = await Promise.all([
    BillReceipt.find(filter).sort({ deliveredAt: -1 }).skip(skip).limit(limit).lean(),
    BillReceipt.countDocuments(filter),
  ]);

  return {
    receipts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
