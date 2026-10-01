/**
 * Abstract Payment Provider Interface.
 * Defines the contract that every payment gateway adapter must implement.
 * Allows adding real providers (Razorpay, Stripe, UPI) seamlessly without rewriting order logic.
 */
export class BasePaymentProvider {
  /**
   * Authorize and/or capture payment.
   * @param {Object} params
   * @returns {Promise<{ success: boolean, transactionReference: string, status: string, providerMetadata: Object, failureReason?: string }>}
   */
  async processPayment(params) {
    throw new Error('processPayment must be implemented by payment provider');
  }

  /**
   * Process refund for a previously captured transaction.
   * @param {Object} params
   * @returns {Promise<{ success: boolean, refundId: string, providerMetadata: Object }>}
   */
  async processRefund(params) {
    throw new Error('processRefund must be implemented by payment provider');
  }
}
