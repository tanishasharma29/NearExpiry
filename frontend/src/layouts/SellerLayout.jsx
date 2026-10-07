import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  BellRing,
  ShoppingBag,
  BarChart3,
  Store,
  LogOut,
  ExternalLink,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SellerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { label: 'Dashboard', path: '/seller/dashboard', icon: LayoutDashboard },
    { label: 'Catalog Products', path: '/seller/products', icon: Package },
    { label: 'FEFO Batches', path: '/seller/batches', icon: Layers },
    { label: 'Inventory & Stock', path: '/seller/inventory', icon: Boxes },
    { label: 'Expiry Alerts', path: '/seller/alerts', icon: BellRing },
    { label: 'Store Orders', path: '/seller/orders', icon: ShoppingBag },
    { label: 'Billing & Receipts', path: '/seller/billing', icon: Receipt },
    { label: 'Store Analytics', path: '/seller/analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800">
        {/* Brand Area */}
        <div className="p-5 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">⏳</span>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Near<span className="text-brand-400">Expiry</span></span>
              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Seller Merchant Hub</div>
            </div>
          </Link>
          <div className="mt-4 p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2.5">
            <Store className="w-4 h-4 text-brand-400 flex-shrink-0" />
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{user?.storeName || 'Merchant Store'}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Verified Seller
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link
            to="/marketplace"
            className="flex items-center justify-between text-xs text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              View Marketplace
            </span>
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-xs text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-950/40 transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              {navLinks.find((l) => l.path === location.pathname)?.label || 'Seller Portal'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 font-semibold px-2.5 py-1 rounded-full">
              Dynamic Pricing Engine Active
            </span>
            <div className="text-xs text-gray-500 font-medium">{user?.email}</div>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
