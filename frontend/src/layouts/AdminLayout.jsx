import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  Layers,
  Sliders,
  Boxes,
  ShoppingBag,
  LifeBuoy,
  BarChart3,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Admin Navigation Groups
 * Structured into six conceptual platform administration domains.
 * Only currently implemented routes are active.
 */
const NAV_GROUPS = [
  {
    group: 'OVERVIEW',
    items: [
      { label: 'Overview Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    group: 'MARKETPLACE GOVERNANCE',
    items: [
      { label: 'Seller Verification', path: '/admin/sellers', icon: Store },
      { label: 'User Directory', path: '/admin/users', icon: Users },
      { label: 'Catalog Moderation', path: '/admin/products', icon: Package },
      { label: 'Category Master', path: '/admin/categories', icon: Layers },
    ],
  },
  {
    group: 'PLATFORM OPERATIONS',
    items: [
      { label: 'Global Inventory Radar', path: '/admin/inventory', icon: Boxes },
      { label: 'Platform Orders', path: '/admin/orders', icon: ShoppingBag },
      { label: 'Support & Disputes', path: '/admin/support', icon: LifeBuoy },
    ],
  },
  {
    group: 'PRICING CONTROL',
    items: [
      { label: 'Dynamic Pricing Rules', path: '/admin/pricing', icon: Sliders },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { label: 'Platform Analytics', path: '/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'SECURITY & ACCOUNTABILITY',
    items: [
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
    ],
  },
];

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle body scroll lock & Escape key for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Determine current active item and domain group for top header display
  let activeItem = null;
  let activeGroup = null;
  for (const g of NAV_GROUPS) {
    const found = g.items.find((item) => item.path === location.pathname);
    if (found) {
      activeItem = found;
      activeGroup = g.group;
      break;
    }
  }

  const userInitial = (user?.name || user?.email || 'A').charAt(0).toUpperCase();

  // Reusable Sidebar Content Component (shared between desktop & mobile drawer)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-800/80 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="text-2xl transition-transform group-hover:scale-105 motion-reduce:group-hover:scale-100">
            ⏳
          </span>
          <div>
            <div className="text-lg font-black text-white tracking-tight leading-tight">
              Near<span className="text-purple-400">Expiry</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-purple-300 font-bold">
              Admin Command Center
            </div>
          </div>
        </Link>

        {mobileMenuOpen && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-900 transition focus:outline-none focus:ring-1 focus:ring-purple-500"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Admin Role Credential Pill */}
      <div className="px-5 py-3 border-b border-gray-800/60 bg-gray-900/40">
        <div className="px-2.5 py-1.5 bg-purple-950/70 border border-purple-800/60 rounded-xl text-[11px] text-purple-300 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>Superadmin Access</span>
          </div>
          <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-900 text-purple-200">
            {user?.role || 'ADMIN'}
          </span>
        </div>
      </div>

      {/* Domain Grouped Navigation */}
      <nav
        aria-label="Admin Navigation"
        className="flex-1 px-3 py-4 space-y-5 overflow-y-auto"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-purple-400/80">
              {group.group}
            </div>
            <div className="space-y-0.5 pt-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 motion-reduce:transition-none ${
                      isActive
                        ? 'bg-purple-700 text-white shadow-sm font-bold border-l-2 border-purple-300'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-gray-900/80'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Utility Controls */}
      <div className="p-4 border-t border-gray-800/80 bg-gray-900/30 space-y-1.5">
        <Link
          to="/marketplace"
          className="flex items-center justify-between text-xs text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-900 transition font-medium"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            Live Marketplace
          </span>
          <span className="text-[10px] text-gray-500 uppercase font-semibold">Storefront</span>
        </Link>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs text-red-400 hover:text-red-300 p-2 rounded-xl hover:bg-red-950/40 transition font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-gray-800 sticky top-0 h-screen z-20">
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile / Tablet Off-Canvas Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Navigation Menu"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Off-canvas panel */}
          <div className="relative w-72 max-w-[85vw] flex-1 flex flex-col transform transition-transform duration-200 ease-out motion-reduce:transform-none z-10 shadow-2xl">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* 3. Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Command Header */}
        <header className="h-16 bg-white border-b border-gray-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          {/* Left: Mobile Toggle & Active Module Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-purple-600"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              {activeGroup && (
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 leading-none mb-0.5">
                  {activeGroup}
                </div>
              )}
              <h1 className="text-base sm:text-lg font-black text-gray-900 truncate leading-tight">
                {activeItem?.label || 'Admin Control Panel'}
              </h1>
            </div>
          </div>

          {/* Right: Operational Status & Admin Identity */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Truthful Platform Operational Status Chip */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
              <span>Platform Operations Active</span>
            </div>

            {/* Authenticated Admin Identity */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div
                className="w-8 h-8 rounded-xl bg-purple-700 text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0"
                title={user?.email || 'Admin'}
              >
                {userInitial}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[150px]">
                  {user?.name || 'Administrator'}
                </div>
                <div className="text-[11px] text-gray-500 leading-tight truncate max-w-[150px]">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Admin Page Content Surface */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
