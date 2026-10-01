import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  Layers,
  Sliders,
  Boxes,
  BarChart3,
  ShieldAlert,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { label: 'Overview Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Seller Verification', path: '/admin/sellers', icon: Store },
    { label: 'User Directory', path: '/admin/users', icon: Users },
    { label: 'Catalog Moderation', path: '/admin/products', icon: Package },
    { label: 'Category Master', path: '/admin/categories', icon: Layers },
    { label: 'Dynamic Pricing Rules', path: '/admin/pricing', icon: Sliders },
    { label: 'Global Inventory Radar', path: '/admin/inventory', icon: Boxes },
    { label: 'Platform Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-gray-950 text-gray-200 flex flex-col flex-shrink-0 border-r border-gray-800">
        <div className="p-5 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">⏳</span>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Near<span className="text-brand-400">Expiry</span></span>
              <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">Admin Command Center</div>
            </div>
          </Link>
          <div className="mt-3 px-2 py-1 bg-purple-950/60 border border-purple-800/80 rounded text-[11px] text-purple-300 font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            Superadmin Access
          </div>
        </div>

        {/* Nav Links */}
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
                    ? 'bg-purple-700 text-white font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-800 space-y-2">
          <Link
            to="/marketplace"
            className="flex items-center justify-between text-xs text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-900 transition"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Live Marketplace
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

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              {navLinks.find((l) => l.path === location.pathname)?.label || 'Admin Control Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2.5 py-1 rounded-full">
              System Audit Logging Enabled
            </span>
            <div className="text-xs text-gray-500 font-medium">{user?.email}</div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
