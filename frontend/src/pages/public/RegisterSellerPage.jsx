import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const registerSellerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid business email required'),
  phone: z.string().min(10, 'Valid 10-digit mobile number required'),
  storeName: z.string().min(3, 'Store name must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSellerPage = () => {
  const { registerSeller } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSellerSchema),
  });

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await registerSeller(data);
      navigate('/seller/dashboard');
    } catch (err) {
      setServerError(err.message || 'Seller registration failed');
    }
  };

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
