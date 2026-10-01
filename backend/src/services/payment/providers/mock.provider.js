import { BasePaymentProvider } from './base.provider.js';
import { PAYMENT_STATUS } from '../../../models/payment.model.js';

export class MockPaymentProvider extends BasePaymentProvider {
  async processPayment({ amount, currency, orderNumber, metadata = {} }) {
    // If test explicitly requests a simulated failure
    if (metadata.simulateFailure === true) {
      return {
        success: false,
        status: PAYMENT_STATUS.FAILED,
        transactionReference: `MOCK-FAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        failureReason: metadata.failureReason || 'Simulated card/bank decline',
        providerMetadata: {
          gateway: 'MOCK_GATEWAY',
          declineCode: 'INSUFFICIENT_FUNDS',
          simulated: true,
        },
      };
    }

    const txnRef = `MOCK-TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      success: true,
      status: PAYMENT_STATUS.SUCCESS,
      transactionReference: txnRef,
      providerMetadata: {
        gateway: 'MOCK_GATEWAY',
        authCode: `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
        capturedAmount: amount,
        currency: currency || 'INR',
        orderNumber,
        processedAt: new Date().toISOString(),
      },
    };
  }

  async processRefund({ transactionReference, amount, reason }) {
    return {
      success: true,
      refundId: `MOCK-REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      providerMetadata: {
        gateway: 'MOCK_GATEWAY',
        originalTransaction: transactionReference,
        refundedAmount: amount,
        reason: reason || 'Customer order cancellation',
        processedAt: new Date().toISOString(),
      },
    };
  }
}
