import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

// Route Guards & Layouts
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import { SellerLayout } from './layouts/SellerLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public & Customer Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { RegisterSellerPage } from './pages/public/RegisterSellerPage';
import { AboutUsPage } from './pages/public/AboutUsPage';
import { MarketplacePage } from './pages/customer/MarketplacePage';
import { ProductDetailsPage } from './pages/customer/ProductDetailsPage';
import { CartPage } from './pages/customer/CartPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { OrdersPage } from './pages/customer/OrdersPage';
import { OrderDetailsPage } from './pages/customer/OrderDetailsPage';
import { OrderInvoicePage } from './pages/customer/OrderInvoicePage';
import { WishlistPage } from './pages/customer/WishlistPage';
import { ProfilePage } from './pages/customer/ProfilePage';

// Seller Pages
import { SellerDashboardPage } from './pages/seller/SellerDashboardPage';
import { SellerProductsPage } from './pages/seller/SellerProductsPage';
import { SellerBatchesPage } from './pages/seller/SellerBatchesPage';
import { SellerInventoryPage } from './pages/seller/SellerInventoryPage';
import { SellerExpiryAlertsPage } from './pages/seller/SellerExpiryAlertsPage';
import { SellerOrdersPage } from './pages/seller/SellerOrdersPage';
import { SellerBillingPage } from './pages/seller/SellerBillingPage';
import { SellerAnalyticsPage } from './pages/seller/SellerAnalyticsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminSellersPage } from './pages/admin/AdminSellersPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminPricingPage } from './pages/admin/AdminPricingPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminSupportPage } from './pages/admin/AdminSupportPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <Routes>
              {/* 1. Public & Guest Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/product/:id" element={<ProductDetailsPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/register-seller" element={<RegisterSellerPage />} />
                <Route path="/about" element={<AboutUsPage />} />
                <Route path="/about-us" element={<AboutUsPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />

                {/* 2. Customer Protected Routes */}
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <OrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <OrderDetailsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:id/invoice"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'SELLER', 'ADMIN']}>
                      <OrderInvoicePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* 3. Seller Protected Portal */}
              <Route
                path="/seller"
                element={
                  <ProtectedRoute allowedRoles={['SELLER']}>
                    <SellerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/seller/dashboard" replace />} />
                <Route path="dashboard" element={<SellerDashboardPage />} />
                <Route path="products" element={<SellerProductsPage />} />
                <Route path="batches" element={<SellerBatchesPage />} />
                <Route path="inventory" element={<SellerInventoryPage />} />
                <Route path="alerts" element={<SellerExpiryAlertsPage />} />
                <Route path="orders" element={<SellerOrdersPage />} />
                <Route path="billing" element={<SellerBillingPage />} />
                <Route path="analytics" element={<SellerAnalyticsPage />} />
              </Route>

              {/* 4. Admin Protected Command Center */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="sellers" element={<AdminSellersPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="pricing" element={<AdminPricingPage />} />
                <Route path="inventory" element={<AdminInventoryPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
