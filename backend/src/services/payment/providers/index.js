import { PAYMENT_METHOD } from '../../../models/payment.model.js';
import { MockPaymentProvider } from './mock.provider.js';
import { CashOnDeliveryProvider } from './cod.provider.js';
import { ApiError } from '../../../utils/ApiError.js';

const mockProviderInstance = new MockPaymentProvider();
const codProviderInstance = new CashOnDeliveryProvider();

/**
 * Payment Provider Factory.
 * Resolves the appropriate gateway adapter based on payment method.
 * Pluggable slots for future providers (e.g. RazorpayProvider, StripeProvider).
 */
export const getPaymentProvider = (method) => {
  switch (method) {
    case PAYMENT_METHOD.MOCK_PAYMENT:
      return mockProviderInstance;
    case PAYMENT_METHOD.CASH_ON_DELIVERY:
      return codProviderInstance;
    default:
      throw new ApiError(
        400,
        `Unsupported payment method: [${method}]. Supported: ${Object.values(PAYMENT_METHOD).join(', ')}`,
        'UNSUPPORTED_PAYMENT_METHOD'
      );
  }
};
