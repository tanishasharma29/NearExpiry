import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Truck, Store, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { cartService } from '../../services/cartService';
import { useCart } from '../../context/CartContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const checkoutSchema = z.object({
  fulfillmentType: z.enum(['PICKUP', 'LOCAL_DELIVERY']),
  paymentMethod: z.enum(['MOCK_PAYMENT', 'CASH_ON_DELIVERY']),
  recipientName: z.string().optional(),
  contactPhone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

export const CheckoutPage = () => {
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const pricing = cart?.pricingSummary || { subtotal: 0, discounts: 0, finalTotal: 0 };

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fulfillmentType: 'PICKUP',
      paymentMethod: 'MOCK_PAYMENT',
      recipientName: '',
      contactPhone: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
  });

  const selectedFulfillment = watch('fulfillmentType');
  const selectedPayment = watch('paymentMethod');

  const onSubmit = async (data) => {
    try {
      setServerError('');
      const orderPayload = {
        fulfillmentType: data.fulfillmentType,
        paymentMethod: data.paymentMethod,
        ...(data.fulfillmentType === 'LOCAL_DELIVERY' && {
          deliveryAddress: {
            recipientName: data.recipientName,
            contactPhone: data.contactPhone,
            street: data.street,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
          },
        }),
      };

      // Pre-flight cart checkout validation with backend
      await cartService.validateCheckout();

      // 1. Create order
      const createdOrder = await orderService.createOrder(orderPayload);
      const targetOrderId = createdOrder?._id || createdOrder?.data?._id || createdOrder?.order?._id;

      if (!targetOrderId) {
        throw new Error('Order creation failed: No order reference returned.');
      }

      // 2. Process Payment with required idempotencyKey and structure
      try {
        const idempotencyKey = `pay_${targetOrderId}_${Date.now()}`;
        await paymentService.processPayment({
          orderId: targetOrderId,
          method: data.paymentMethod,
          idempotencyKey,
          paymentDetails: {
            simulateFailure: false,
          },
        });
      } catch (payErr) {
        console.warn('Payment processing notice:', payErr);
        // Even if mock payment threw, order is already created in DB; customer will proceed to order tracker
      }

      await fetchCart();
      navigate(`/orders/${targetOrderId}?new=true`);
    } catch (err) {
      setServerError(err.message || 'Checkout failed. Please try again.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Checkout</h1>
        <p className="text-sm text-gray-500">Confirm fulfillment method and complete your reservation</p>
      </div>

      {serverError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Fulfillment Type Selection */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900">1. Fulfillment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className={`border-2 rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition ${
                selectedFulfillment === 'PICKUP' ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" value="PICKUP" {...register('fulfillmentType')} className="sr-only" />
                <Store className="w-6 h-6 text-brand-600" />
                <div className="font-bold text-sm text-gray-900">Self Pickup</div>
                <div className="text-xs text-gray-500">Collect directly from neighborhood retailer</div>
              </label>

              <label className={`border-2 rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition ${
                selectedFulfillment === 'LOCAL_DELIVERY' ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" value="LOCAL_DELIVERY" {...register('fulfillmentType')} className="sr-only" />
                <Truck className="w-6 h-6 text-brand-600" />
                <div className="font-bold text-sm text-gray-900">Local Delivery</div>
                <div className="text-xs text-gray-500">Quick hyperlocal dispatch to your address</div>
              </label>
            </div>

            {selectedFulfillment === 'LOCAL_DELIVERY' && (
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase">Delivery Address</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <input
                    type="text"
                    {...register('recipientName')}
                    placeholder="Recipient Name"
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
                  />
                  <input
                    type="tel"
                    {...register('contactPhone')}
                    placeholder="Contact Phone"
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
                  />
                  <input
                    type="text"
                    {...register('street')}
                    placeholder="Street Address"
                    className="col-span-2 p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
                  />
                  <input
                    type="text"
                    {...register('city')}
                    placeholder="City"
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
                  />
                  <input
                    type="text"
                    {...register('pincode')}
                    placeholder="Pincode"
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900">2. Payment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className={`border-2 rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition ${
                selectedPayment === 'MOCK_PAYMENT' ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" value="MOCK_PAYMENT" {...register('paymentMethod')} className="sr-only" />
                <CreditCard className="w-6 h-6 text-brand-600" />
                <div className="font-bold text-sm text-gray-900">Online Mock Payment</div>
                <div className="text-xs text-gray-500">Instant simulated UPI / Card verification</div>
              </label>

              <label className={`border-2 rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition ${
                selectedPayment === 'CASH_ON_DELIVERY' ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" value="CASH_ON_DELIVERY" {...register('paymentMethod')} className="sr-only" />
                <Banknote className="w-6 h-6 text-brand-600" />
                <div className="font-bold text-sm text-gray-900">Pay at Store / COD</div>
                <div className="text-xs text-gray-500">Pay cash upon batch pickup or arrival</div>
              </label>
            </div>
          </div>
        </div>

        {/* Price Confirmation Sidebar */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 h-fit">
          <h2 className="text-lg font-bold text-gray-900">Review Totals</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Catalog Subtotal</span>
              <span>₹{Number(pricing.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-700 font-semibold">
              <span>Near-Expiry Savings</span>
              <span>-₹{Number(pricing.discounts || 0).toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between text-base font-black text-gray-900">
              <span>Payable Now</span>
              <span className="text-xl text-brand-700">₹{Number(pricing.finalTotal || 0).toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg transition text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Placing Order...' : 'Confirm & Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
};
