import { BasePaymentProvider } from './base.provider.js';
import { PAYMENT_STATUS } from '../../../models/payment.model.js';

export class CashOnDeliveryProvider extends BasePaymentProvider {
  async processPayment({ amount, currency, orderNumber }) {
    const txnRef = `COD-REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      success: true,
      status: PAYMENT_STATUS.PENDING, // COD remains PENDING until seller collects cash at delivery/handshake
      transactionReference: txnRef,
      providerMetadata: {
        method: 'CASH_ON_DELIVERY',
        payableOnReceipt: amount,
        currency: currency || 'INR',
        orderNumber,
        collectionInstructions: 'Collect cash upon physical handover or delivery.',
      },
    };
  }

  async processRefund({ transactionReference, amount, reason }) {
    return {
      success: true,
      refundId: `COD-VOID-${Date.now()}`,
      providerMetadata: {
        method: 'CASH_ON_DELIVERY',
        originalTransaction: transactionReference,
        voidAmount: amount,
        reason: reason || 'Order cancelled before cash collection',
        note: 'Zero cash was collected, COD invoice voided.',
      },
    };
  }
}
