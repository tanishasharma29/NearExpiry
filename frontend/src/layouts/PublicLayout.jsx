import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  User,
  Heart,
  Store,
  Shield,
  LogOut,
  Menu,
  X,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const PublicLayout = () => {
  const { user, isAuthenticated, isSeller, isAdmin, logout } = useAuth();
  const { totalItemCount } = useCart();
  const { wishlist } = useWishlist();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Automatically close mobile menu when navigating to another page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/marketplace');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      {/* Top Banner: Urgency & Mission */}
      <div className="bg-brand-700 text-white text-[11px] sm:text-xs py-1.5 px-3 text-center font-medium truncate">
        🌱 Save up to 75% on fresh near-expiry food • Reduce household waste!
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <span className="text-xl sm:text-2xl select-none">⏳</span>
              <div className="flex items-center">
                <span className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  Near<span className="text-brand-600">Expiry</span>
                </span>
                <span className="hidden md:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">
                  Hyperlocal
                </span>
              </div>
            </Link>

            {/* Global Search Bar (Desktop/Tablet) */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products, brands, near-expiry deals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-full focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition outline-none"
                />
              </div>
            </form>

            {/* Nav Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Link
                to="/about"
                className="hidden md:inline-flex items-center text-sm font-semibold text-gray-700 hover:text-brand-600 transition"
              >
                About Us
              </Link>
              <Link
                to="/marketplace"
                className="hidden md:inline-flex items-center text-sm font-semibold text-gray-700 hover:text-brand-600 transition"
              >
                Marketplace
              </Link>
              {isAuthenticated && (
                <Link
                  to="/customer/complaints"
                  className="hidden md:inline-flex items-center text-sm font-semibold text-gray-700 hover:text-brand-600 transition"
                >
                  My Complaints
                </Link>
              )}

              {/* Wishlist Icon */}
              <Link
                to="/wishlist"
                className="relative p-2 text-gray-600 hover:text-red-500 transition rounded-full hover:bg-gray-100"
                title="Wishlist"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlist?.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-in zoom-in">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart Icon */}
              <Link
                to="/cart"
                className="relative p-2 text-gray-600 hover:text-brand-600 transition rounded-full hover:bg-gray-100"
                title="Cart"
                aria-label="Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItemCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-brand-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-in zoom-in">
                    {totalItemCount}
                  </span>
                )}
              </Link>

              {/* Desktop User Dropdown / Auth Links */}
              {isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
                  {isSeller && (
                    <Link
                      to="/seller/dashboard"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 transition"
                    >
                      <Store className="w-3.5 h-3.5" />
                      Seller Portal
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-900 hover:bg-purple-200 transition"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    className="p-1.5 rounded-full text-gray-700 hover:bg-gray-100 transition"
                    title="Profile & Orders"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
                  <Link
                    to="/login"
                    className="px-3.5 py-1.5 text-sm font-semibold text-gray-700 hover:text-brand-600 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition"
                  >
                    Join Free
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 sm:hidden text-gray-700 rounded-lg hover:bg-gray-100 active:bg-gray-200 focus:outline-none"
                aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6 text-gray-800" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Search Input */}
          <div className="pb-2.5 sm:hidden">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search deals, milk, snacks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 top-[105px] z-50 flex flex-col bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Drawer Body */}
            <div className="bg-white border-b border-gray-200 shadow-2xl p-4 max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-top-4 duration-200">
              {/* User Header / Guest Prompt */}
              {isAuthenticated ? (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100/60 rounded-2xl border border-emerald-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      {user?.name ? user.name[0].toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{user?.name || 'Shopper'}</div>
                      <div className="text-[11px] text-gray-500 truncate">{user?.email}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    {user?.role || 'Customer'}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-br from-emerald-50 via-brand-50/50 to-white rounded-2xl border border-brand-200/60 text-center space-y-3">
                  <div className="text-xs font-semibold text-brand-800">
                    Welcome to NearExpiry! Join now to save up to 75% on fresh near-expiry food.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      className="w-full py-2.5 text-center text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-xs"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="w-full py-2.5 text-center text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs"
                    >
                      Join Free
                    </Link>
                  </div>
                </div>
              )}

              {/* Core Links */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                  Discover
                </div>
                <Link
                  to="/marketplace"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingBag className="w-4 h-4 text-brand-600" />
                    <span>Browse Marketplace Deals</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link
                  to="/about"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span>About NearExpiry</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link
                  to="/wishlist"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>My Wishlist</span>
                  </span>
                  {wishlist?.length > 0 && (
                    <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                      {wishlist.length}
                    </span>
                  )}
                </Link>
                <Link
                  to="/cart"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-semibold text-sm transition"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4 text-brand-600" />
                    <span>Shopping Cart</span>
                  </span>
                  {totalItemCount > 0 && (
                    <span className="text-xs bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full">
                      {totalItemCount} items
                    </span>
                  )}
                </Link>
              </div>

              {/* Customer Account Links */}
              {isAuthenticated && (
                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                    My Account
                  </div>
                  <Link
                    to="/orders"
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-medium text-sm transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>Order History</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-medium text-sm transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>Profile & Settings</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                  <Link
                    to="/customer/complaints"
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-gray-800 font-medium text-sm transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span>Disputes & Complaints</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </div>
              )}

              {/* Business / Management Portals */}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                  Business Portals
                </div>
                {isSeller ? (
                  <Link
                    to="/seller/dashboard"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 text-amber-900 font-bold text-sm border border-amber-200 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Store className="w-4 h-4 text-amber-600" />
                      <span>Seller Command Center</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-amber-600" />
                  </Link>
                ) : (
                  <Link
                    to="/register-seller"
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-800 font-medium text-sm transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Store className="w-4 h-4 text-emerald-600" />
                      <span>Become a Retail Partner</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 text-purple-900 font-bold text-sm border border-purple-200 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Admin Command Center</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-purple-600" />
                  </Link>
                )}
              </div>

              {/* Sign Out Option */}
              {isAuthenticated && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Click-away backdrop dismiss */}
            <div
              className="flex-1"
              onClick={() => setMobileMenuOpen(false)}
            />
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="bg-gray-900 text-gray-300 py-10 sm:py-12 mt-12 sm:mt-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⏳</span>
                <span className="text-xl font-bold text-white">Near<span className="text-brand-400">Expiry</span></span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Hyperlocal dynamic near-expiry grocery marketplace. Connecting neighborhood sellers and conscious shoppers to rescue expiring food at deep discounts.
              </p>
              <div className="text-xs text-brand-400 font-semibold">Zero Waste • Maximum Savings</div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">For Shoppers</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/marketplace" className="hover:text-brand-400 transition">Browse Deals</Link></li>
                <li><Link to="/about" className="hover:text-brand-400 transition font-medium text-brand-300">About NearExpiry</Link></li>
                <li><Link to="/orders" className="hover:text-brand-400 transition">Order History</Link></li>
                <li><Link to="/customer/complaints" className="hover:text-brand-400 transition">Disputes & Complaints</Link></li>
                <li><Link to="/wishlist" className="hover:text-brand-400 transition">My Wishlist</Link></li>
                <li><Link to="/cart" className="hover:text-brand-400 transition">Shopping Cart</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">For Retailers</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/register-seller" className="hover:text-brand-400 transition">Register as a Seller</Link></li>
                <li><Link to="/seller/dashboard" className="hover:text-brand-400 transition">Seller Dashboard</Link></li>
                <li><Link to="/seller/batches" className="hover:text-brand-400 transition">FEFO Inventory Management</Link></li>
                <li><Link to="/seller/analytics" className="hover:text-brand-400 transition">Store Analytics</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">System & Trust</h4>
              <ul className="space-y-2 text-xs">
                <li><span className="text-gray-400">Dynamic Pricing Rules (0 - 75% OFF)</span></li>
                <li><span className="text-gray-400">Authoritative Expiry Status Tracking</span></li>
                <li><span className="text-gray-400">Cryptographic QR Verification</span></li>
                <li><Link to="/admin/dashboard" className="hover:text-brand-400 transition">Admin Command Center</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 text-xs text-gray-500 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>© {new Date().getFullYear()} NearExpiry Marketplace. All rights reserved.</div>
            <div className="flex gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Food Safety Compliance</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
