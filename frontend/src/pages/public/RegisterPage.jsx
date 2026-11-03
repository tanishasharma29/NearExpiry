import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const registerCustomerSchema = z.object({
  name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name cannot exceed 80 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(/^[0-9+\s()-]{10,15}$/, 'Please enter a valid phone number (at least 10 digits)'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(64, 'Password cannot exceed 64 characters'),
});

export const RegisterPage = () => {
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerCustomerSchema),
    mode: 'onTouched',
  });

  const handleInputChange = () => {
    if (serverError) {
      setServerError('');
    }
  };

  const onSubmit = async (data) => {
    try {
      setServerError('');
      clearErrors();
      await registerCustomer(data);
      navigate('/marketplace');
    } catch (err) {
      // 1. Detect Network / Connectivity Failures
      const isNetworkError =
        !err.status ||
        err.message === 'Network Error' ||
        err.code === 'ERR_NETWORK' ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetworkError) {
        setServerError('Unable to connect to the server. Please check your internet connection and try again.');
        return;
      }

      // 2. Server 500+ Internal Errors
      if (err.status >= 500) {
        setServerError('A temporary server error occurred. Please try again later.');
        return;
      }

      // 3. Extract and map field-specific validation errors from backend
      const validationErrors = err.errors || err.data?.errors || [];
      let fieldErrorMapped = false;

      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        validationErrors.forEach((issue) => {
          // Normalize field name (e.g. 'body.email' -> 'email')
          const rawField = issue.field || '';
          const fieldName = rawField.replace(/^(body|query|params)\./, '');

          if (['name', 'email', 'phone', 'password'].includes(fieldName)) {
            setError(fieldName, {
              type: 'server',
              message: issue.message,
            });
            fieldErrorMapped = true;
          }
        });
      }

      // 4. Handle Duplicate Email Error specifically
      if (err.errorCode === 'DUPLICATE_EMAIL' || err.errorCode === 'DUPLICATE_KEY_ERROR') {
        const duplicateMsg = 'An account with this email already exists. Please sign in or use another email.';
        setError('email', {
          type: 'server',
          message: duplicateMsg,
        });
        setServerError(duplicateMsg);
        return;
      }

      // 5. Display general or summary message
      setServerError(err.message || (fieldErrorMapped ? 'Please correct the highlighted errors.' : 'Registration failed. Please check your details.'));
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-gray-200 shadow-xl space-y-6">
        <div className="text-center">
          <span className="text-4xl">🛍️</span>
          <h2 className="text-2xl font-black text-gray-900 mt-2">Create Customer Account</h2>
          <p className="text-sm text-gray-500">Rescue near-expiry foods & save money</p>
        </div>

        {serverError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
            <span className="font-medium leading-relaxed">{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              {...register('name', { onChange: handleInputChange })}
              placeholder="Aarav Sharma"
              className={`w-full px-3.5 py-2.5 text-sm bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.name
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
              }`}
            />
            {errors.name && <p className="text-red-600 text-xs mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              disabled={isSubmitting}
              {...register('email', { onChange: handleInputChange })}
              placeholder="aarav@example.com"
              className={`w-full px-3.5 py-2.5 text-sm bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
              }`}
            />
            {errors.email && <p className="text-red-600 text-xs mt-1 font-medium">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              disabled={isSubmitting}
              {...register('phone', { onChange: handleInputChange })}
              placeholder="9876543210"
              className={`w-full px-3.5 py-2.5 text-sm bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${
                errors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
              }`}
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1 font-medium">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={isSubmitting}
                {...register('password', { onChange: handleInputChange })}
                placeholder="••••••••"
                className={`w-full px-3.5 py-2.5 pr-10 text-sm bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1 font-medium">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" />
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
