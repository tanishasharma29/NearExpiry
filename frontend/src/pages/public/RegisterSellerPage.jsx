import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store, AlertCircle, Eye, EyeOff, CheckCircle2, LifeBuoy, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SellerSupportModal } from '../../components/seller/SellerSupportModal';

const registerSellerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[0-9+\s()-]{10,15}$/, 'Phone number must be between 10 and 15 digits'),
  storeName: z.string().min(3, 'Store name must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const RegisterSellerPage = () => {
  const { registerSeller } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSellerSchema),
    mode: 'onTouched',
  });

  const handleInputChange = () => {
    if (serverError) setServerError('');
  };

  const onSubmit = async (data) => {
    try {
      setServerError('');
      clearErrors();
      await registerSeller(data);
      setRegisteredSuccess(true);
    } catch (err) {
      if (!err.status || err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        setServerError('Unable to connect to the server. Please check your internet connection and try again.');
        return;
      }
      if (err.status >= 500) {
        setServerError('An unexpected server error occurred. Please try again later.');
        return;
      }
      const validationErrors = err.errors || err.data?.errors || [];
      let fieldErrorMapped = false;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        validationErrors.forEach((issue) => {
          const rawField = issue.field || '';
          const fieldName = rawField.replace(/^(body|query|params)\./, '');
          if (['name', 'email', 'phone', 'storeName', 'password'].includes(fieldName)) {
            setError(fieldName, { type: 'server', message: issue.message });
            fieldErrorMapped = true;
          }
        });
      }
      if (err.errorCode === 'DUPLICATE_EMAIL' || err.errorCode === 'DUPLICATE_KEY_ERROR') {
        const duplicateMsg = 'An account with this email already exists. Please sign in or use another email.';
        setError('email', { type: 'server', message: duplicateMsg });
        setServerError(duplicateMsg);
        return;
      }
      setServerError(err.message || (fieldErrorMapped ? 'Please correct the highlighted errors.' : 'Seller registration failed.'));
    }
  };

  if (registeredSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white p-8 rounded-3xl border border-gray-200 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">Store Registered Successfully</h2>
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed text-left">
              “Your store has been registered successfully. For this demo, the administrator may approve your store without legal documents. Contact admin support if document verification is required.”
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/seller/dashboard')}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
            >
              <span>Proceed to Seller Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs"
            >
              <LifeBuoy className="w-4 h-4 text-brand-600" />
              <span>Contact Admin Support</span>
            </button>
          </div>

          <SellerSupportModal
            isOpen={supportModalOpen}
            onClose={() => setSupportModalOpen(false)}
            defaultSubject="Store Legal Document Verification Request"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl border border-gray-200 shadow-xl space-y-6">
        <div className="text-center">
          <span className="text-4xl">🏪</span>
          <h2 className="text-2xl font-black text-gray-900 mt-2">Become a Seller Partner</h2>
          <p className="text-sm text-gray-500">Sell your near-expiry inventory & prevent revenue loss</p>
        </div>

        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Owner Name
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="Ramesh Patel"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition"
              />
              {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Store Name
              </label>
              <input
                type="text"
                {...register('storeName')}
                placeholder="Patel Supermart"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition"
              />
              {errors.storeName && <p className="text-red-600 text-xs mt-1">{errors.storeName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Business Email
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="store@patelsupermart.com"
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition"
            />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              {...register('phone')}
              placeholder="9876543211"
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition"
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-md"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Store className="w-4 h-4" />
            {isSubmitting ? 'Registering...' : 'Register Store & Start Selling'}
          </button>
        </form>

        <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">
            Sign In to Seller Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
