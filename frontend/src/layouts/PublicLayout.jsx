import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Search, ShoppingCart, User, Heart, Store, Shield, LogOut, Menu, X } from 'lucide-react';
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

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/marketplace');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Banner: Urgency & Mission */}
      <div className="bg-brand-700 text-white text-xs py-1.5 px-4 text-center font-medium">
        🌱 Save up to 75% on fresh near-expiry food • Reduce household waste & save local groceries!
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl">⏳</span>
              <div>
                <span className="text-xl font-extrabold text-gray-900 tracking-tight">Near<span className="text-brand-600">Expiry</span></span>
                <span className="hidden md:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">Hyperlocal</span>
              </div>
            </Link>

            {/* Global Search Bar */}
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
            <div className="flex items-center gap-3">
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
              >
                <Heart className="w-5 h-5" />
                {wishlist?.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart Icon */}
              <Link
                to="/cart"
                className="relative p-2 text-gray-600 hover:text-brand-600 transition rounded-full hover:bg-gray-100"
                title="Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItemCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-brand-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                    {totalItemCount}
                  </span>
                )}
              </Link>

              {/* User Dropdown / Auth Links */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
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
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
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

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 sm:hidden text-gray-600 rounded-lg hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Search Input */}
          <div className="pb-3 sm:hidden">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-full outline-none"
                />
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 mt-16 border-t border-gray-800">
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
