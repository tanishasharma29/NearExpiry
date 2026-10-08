import React, { useState, useEffect } from 'react';
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
  Menu,
  X,
  Activity,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAVIGATION_SECTIONS = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', path: '/seller/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      { label: 'Catalog Products', path: '/seller/products', icon: Package },
      { label: 'FEFO Batches', path: '/seller/batches', icon: Layers },
      { label: 'Inventory & Stock', path: '/seller/inventory', icon: Boxes },
    ],
  },
  {
    title: 'RESCUE OPERATIONS',
    items: [
      { label: 'Expiry Alerts', path: '/seller/alerts', icon: BellRing },
      { label: 'Store Orders', path: '/seller/orders', icon: ShoppingBag },
      { label: 'Billing & Receipts', path: '/seller/billing', icon: Receipt },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Store Analytics', path: '/seller/analytics', icon: BarChart3 },
    ],
  },
];

export const SellerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer whenever location/route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Find active navigation item title
  const activeNavItem = NAVIGATION_SECTIONS
    .flatMap((section) => section.items)
    .find((item) => item.path === location.pathname);

  const activeTitle = activeNavItem?.label || 'Seller Command Center';

  // Navigation menu contents reusable across desktop & mobile drawer
  const renderNavigationContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <Link
          to="/"
          className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
          aria-label="NearExpiry Home"
        >
          <span className="text-2xl select-none" role="img" aria-label="Hourglass">
            ⏳
          </span>
          <div className="leading-tight">
            <span className="text-lg font-black text-white tracking-tight">
              Near<span className="text-emerald-400">Expiry</span>
            </span>
            <div className="text-[10px] uppercase tracking-wider text-emerald-400/90 font-bold">
              Merchant Hub
            </div>
          </div>
        </Link>

        {/* Merchant Store Status Card */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/70 border border-slate-700/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {user?.storeName || 'Merchant Store'}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>Verified Seller</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Navigation Links */}
      <nav
        className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800"
        aria-label="Merchant Navigation"
      >
        {NAVIGATION_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold border-l-4 border-emerald-400 shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-800/80 space-y-2">
        <Link
          to="/marketplace"
          className="flex items-center justify-between text-xs text-slate-400 hover:text-white p-2.5 rounded-xl hover:bg-slate-800/80 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <span className="flex items-center gap-2.5">
            <ExternalLink className="w-4 h-4 text-slate-400" />
            <span>View Marketplace</span>
          </span>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 text-xs text-rose-400 hover:text-rose-300 p-2.5 rounded-xl hover:bg-rose-950/40 transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* 1. Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-slate-800 z-20">
        {renderNavigationContent()}
      </aside>

      {/* 2. Mobile / Tablet Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        <div className="relative h-full">
          {renderNavigationContent()}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 3. Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          {/* Right: Engine Status & User Email */}
          <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dynamic Pricing Active</span>
            </div>

            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200 text-xs font-medium text-slate-600">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                {user?.email ? user.email.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <span className="hidden md:inline truncate max-w-[180px]">
                {user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
