import React from 'react';
import { User, Mail, Phone, Shield, Package, LogOut, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProfilePage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Account Profile</h1>
        <p className="text-sm text-gray-500">Manage your credentials, orders, and rescue impact</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-black text-2xl">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 mt-1">
              <Shield className="w-3 h-3 text-brand-600" />
              Role: {user?.role}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Mail className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase">Email</div>
              <div className="text-gray-800 font-medium">{user?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Phone className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase">Phone</div>
              <div className="text-gray-800 font-medium">{user?.phone || 'Not provided'}</div>
            </div>
          </div>
        </div>

        <div className="pt-4 flex flex-wrap gap-4 items-center justify-between border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl font-semibold text-sm transition"
            >
              <Package className="w-4 h-4" />
              View Past Orders
            </Link>
            <Link
              to="/customer/complaints"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-xl font-semibold text-sm transition"
            >
              <LifeBuoy className="w-4 h-4 text-amber-600" />
              Support & Complaints
            </Link>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-semibold text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
