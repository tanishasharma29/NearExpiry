import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  User,
  Bell,
  Check,
  CheckCheck,
  Lock,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { notificationService } from '../services/notificationService';
import { sellerService } from '../services/sellerService';

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
      { label: 'Catalog Products', path: '/seller/products', icon: Package, requiresApproval: true },
      { label: 'FEFO Batches', path: '/seller/batches', icon: Layers, requiresApproval: true },
      { label: 'Inventory & Stock', path: '/seller/inventory', icon: Boxes, requiresApproval: true },
    ],
  },
  {
    title: 'RESCUE OPERATIONS',
    items: [
      { label: 'Expiry Alerts', path: '/seller/alerts', icon: BellRing, requiresApproval: true },
      { label: 'Store Orders', path: '/seller/orders', icon: ShoppingBag, requiresApproval: true },
      { label: 'Billing & Receipts', path: '/seller/billing', icon: Receipt, requiresApproval: true },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Store Analytics', path: '/seller/analytics', icon: BarChart3, requiresApproval: true },
    ],
  },
];

export const SellerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authoritative Verification State
  const [verificationData, setVerificationData] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const notifDropdownRef = useRef(null);

  // Fetch Verification Status
  const fetchVerificationStatus = async () => {
    try {
      const data = await sellerService.getVerificationStatus();
      setVerificationData(data?.data || data);
    } catch (err) {
      console.warn('Unable to retrieve seller verification status:', err?.message);
    } finally {
      setVerificationLoading(false);
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const [notifRes, unreadRes] = await Promise.all([
        notificationService.getNotifications({ limit: 10 }).catch(() => ({ notifications: [] })),
        notificationService.getUnreadCount().catch(() => ({ unreadCount: 0 })),
      ]);
      const notifList = notifRes?.data?.notifications || notifRes?.notifications || [];
      const count = unreadRes?.data?.unreadCount ?? unreadRes?.unreadCount ?? 0;
      setNotifications(notifList);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Unable to load seller notifications:', err?.message);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationStatus();
    fetchNotifications();
  }, [location.pathname]);

  // Real-time event listener for live notifications and badge updates
  useEffect(() => {
    if (!subscribe) return;
    const unsubOrder = subscribe('seller:order:new', () => {
      fetchNotifications();
    });
    const unsubNotif = subscribe('notification:new', () => {
      fetchNotifications();
    });
    const unsubInv = subscribe('inventory:changed', () => {
      fetchNotifications();
    });
    return () => {
      unsubOrder();
      unsubNotif();
      unsubInv();
    };
  }, [subscribe]);

  // Close mobile drawer whenever location/route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle ESC key to dismiss mobile drawer or notification dropdown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mobileMenuOpen) setMobileMenuOpen(false);
        if (notificationsOpen) setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, notificationsOpen]);

  // Dismiss notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Determine effective approval status
  const effectiveStatus =
    verificationData?.verificationStatus ||
    user?.verificationStatus ||
    (user?.store?.verificationStatus) ||
    'PENDING';

  const isApproved =
    verificationData?.isApproved ??
    (effectiveStatus === 'APPROVED' || user?.isApproved === true);

  const isRejected =
    verificationData?.isRejected ??
    (effectiveStatus === 'REJECTED');

  const rejectionReason =
    verificationData?.rejectionReason ||
    user?.sellerProfile?.rejectionReason ||
    null;

  // Find active navigation item title
  const activeNavItem = NAVIGATION_SECTIONS
    .flatMap((section) => section.items)
    .find((item) => item.path === location.pathname);

  const activeTitle = activeNavItem?.label || 'Seller Command Center';

  // Format date helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

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
          <div className={`p-2 rounded-lg border flex-shrink-0 ${
            isApproved
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isRejected
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">
              {verificationData?.store?.storeName || user?.storeName || 'Merchant Store'}
            </div>
            {isApproved ? (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>Verified Seller</span>
              </div>
            ) : isRejected ? (
              <div className="text-[11px] text-rose-400 flex items-center gap-1.5 font-medium mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                <span>Application Rejected</span>
              </div>
            ) : (
              <div className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                <span>Pending Verification</span>
              </div>
            )}
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
                const isLocked = item.requiresApproval && !isApproved;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold border-l-4 border-emerald-400 shadow-xs'
                        : isLocked
                        ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 opacity-80'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-emerald-400'
                            : isLocked
                            ? 'text-slate-500 group-hover:text-slate-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 flex-shrink-0" title="Locked until store approval" />
                    ) : isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    ) : null}
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

          {/* Right: Notification Bell, Engine Status & User Email */}
          <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
            {isApproved ? (
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dynamic Pricing Active</span>
              </div>
            ) : isRejected ? (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Permit Rejected</span>
              </div>
            ) : (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Verification In Review</span>
              </div>
            )}

            {/* In-App Notifications Bell Dropdown */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                title="In-App Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full border-2 border-white shadow-xs animate-in zoom-in-50">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center px-4">
                        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">No notifications yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Platform updates and verification alerts will appear here</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const isStoreApproved = notif.type === 'STORE_APPROVED';
                        const isStoreRejected = notif.type === 'STORE_REJECTED';

                        return (
                          <div
                            key={notif._id}
                            className={`p-3.5 hover:bg-slate-50 transition-colors flex gap-3 ${
                              !notif.isRead ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {isStoreApproved ? (
                                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                                  <ShieldCheck className="w-4 h-4" />
                                </div>
                              ) : isStoreRejected ? (
                                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                                  <ShieldAlert className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                                  <BellRing className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1 mb-0.5">
                                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                  {notif.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-1">
                                  {formatTimeAgo(notif.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {notif.message}
                              </p>
                              {!notif.isRead && (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    onClick={(e) => handleMarkAsRead(notif._id, e)}
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Mark as read</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
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

        {/* Page Outlet or Unapproved Gate */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {location.pathname !== '/seller/dashboard' && !isApproved ? (
            <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
                  isRejected
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {isRejected
                  ? 'Store Application Rejected'
                  : 'Store Application Under Review'}
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                {isRejected
                  ? (rejectionReason
                      ? `Your application was rejected: "${rejectionReason}". Store operational features are restricted.`
                      : 'Your seller permit application was rejected by compliance. Store operations are restricted.')
                  : 'Your merchant application is currently under compliance review. Catalog management, batch lots, inventory adjustments, and order processing will unlock immediately once approved.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/seller/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition shadow-xs"
                >
                  Return to Dashboard
                </Link>
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
                >
                  <Bell className="w-3.5 h-3.5 text-slate-500" />
                  <span>Check Notifications</span>
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

export default SellerLayout;
