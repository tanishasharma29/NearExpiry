import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  ExternalLink,
  Filter,
  Inbox,
  AlertCircle,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Layers,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { useSocket } from '../../context/SocketContext';
import { LoadingSpinner } from './LoadingSpinner';
import {
  groupNotificationsByTime,
  getNotificationCategoryMeta,
} from '../../utils/notificationGrouping';

export const NotificationCenter = ({
  role = 'SELLER',
  title = 'Notification Center',
  description = 'Manage and review notifications grouped by date with category filtering.',
  categories = [],
}) => {
  const navigate = useNavigate();
  const { subscribe } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unread'
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const isAdmin = role === 'ADMIN';
  const theme = {
    primaryBg: isAdmin ? 'bg-purple-700 hover:bg-purple-800' : 'bg-emerald-600 hover:bg-emerald-700',
    primaryText: isAdmin ? 'text-purple-700' : 'text-emerald-700',
    primaryBorder: isAdmin ? 'border-purple-200' : 'border-emerald-200',
    primaryLight: isAdmin ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700',
    dotColor: isAdmin ? 'bg-purple-600' : 'bg-emerald-500',
  };

  const fetchNotifications = useCallback(
    async (targetPage = 1, append = false, isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else if (append) setLoadingMore(true);
        else setLoading(true);

        setError(null);

        const params = {
          page: String(targetPage),
          limit: '20',
        };
        if (statusFilter === 'unread') {
          params.isRead = 'false';
        }

        const res = await notificationService.getNotifications(params);
        const data = res?.data || res || {};
        const notifList = data.notifications || [];
        const pagination = data.pagination || {};

        setNotifications((prev) => {
          if (append) {
            // Deduplicate incoming
            const existingIds = new Set(prev.map((n) => n._id));
            const fresh = notifList.filter((n) => !existingIds.has(n._id));
            return [...prev, ...fresh];
          }
          return notifList;
        });

        setPage(pagination.page || targetPage);
        setTotalPages(pagination.totalPages || 1);
        setTotal(pagination.total ?? notifList.length);
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setError(err.response?.data?.message || err.message || 'Unable to load notifications.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  // Real-time listener for incoming notifications
  useEffect(() => {
    if (!subscribe) return;

    const handleRealtimeNotif = (payload) => {
      if (!payload) return;
      const newNotif = payload.notification || payload;
      if (!newNotif?._id) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
      setTotal((prev) => prev + 1);
    };

    const unsubNotif = subscribe('notification:new', handleRealtimeNotif);
    const unsubAdmin = isAdmin ? subscribe('admin:alert', handleRealtimeNotif) : () => {};

    return () => {
      unsubNotif();
      unsubAdmin();
    };
  }, [subscribe, isAdmin]);

  // Filter notifications by selected category in memory
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (statusFilter === 'unread' && notif.isRead) return false;
      if (selectedCategory !== 'ALL') {
        const meta = getNotificationCategoryMeta(notif, role);
        if (meta.key !== selectedCategory) return false;
      }
      return true;
    });
  }, [notifications, statusFilter, selectedCategory, role]);

  // Group notifications into Today, Yesterday, and Earlier
  const timeGroups = useMemo(() => {
    return groupNotificationsByTime(filteredNotifications);
  }, [filteredNotifications]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const resolveTargetUrl = (notif) => {
    // 1. Complaint / Dispute notifications
    const cid =
      notif?.data?.complaintId ||
      notif?.metadata?.complaintId ||
      notif?.data?.entityId ||
      (notif?.entityModel === 'Complaint' ? notif?.entityId : null);

    const isComplaintNotice =
      Boolean(cid) ||
      notif?.actionUrl?.includes('/complaints') ||
      notif?.actionUrl?.includes('/support') ||
      notif?.title?.includes('Dispute') ||
      notif?.title?.includes('Complaint') ||
      notif?.message?.includes('dispute') ||
      notif?.message?.includes('complaint') ||
      notif?.title?.includes('NE-CMP-') ||
      notif?.message?.includes('NE-CMP-');

    if (isComplaintNotice) {
      const complaintIdToUse =
        cid ||
        (notif?.actionUrl?.includes('/admin/complaints/')
          ? notif.actionUrl.split('/').pop()
          : null) ||
        (notif?.actionUrl?.includes('complaintId=')
          ? new URLSearchParams(notif.actionUrl.split('?')[1]).get('complaintId')
          : null) ||
        (notif?.actionUrl?.includes('id=')
          ? new URLSearchParams(notif.actionUrl.split('?')[1]).get('id')
          : null);

      if (role === 'ADMIN') {
        return complaintIdToUse
          ? `/admin/support?id=${complaintIdToUse}`
          : '/admin/support';
      }
      if (role === 'SELLER') {
        return complaintIdToUse
          ? `/seller/complaints?complaintId=${complaintIdToUse}`
          : '/seller/complaints';
      }
      return '/customer/complaints';
    }

    // 2. Seller Verification / Onboarding / Credentials
    const sid =
      notif?.data?.sellerId ||
      notif?.metadata?.sellerId ||
      (notif?.entityModel === 'User' ? notif?.entityId : null) ||
      (notif?.actionUrl?.includes('sellerId=')
        ? new URLSearchParams(notif.actionUrl.split('?')[1]).get('sellerId')
        : null);

    const isSellerNotice =
      Boolean(sid) ||
      notif?.actionUrl?.includes('/admin/sellers') ||
      notif?.title?.includes('Document') ||
      notif?.title?.includes('Seller') ||
      notif?.title?.includes('Legal') ||
      notif?.title?.includes('Credential') ||
      notif?.title?.includes('KYC') ||
      notif?.title?.includes('Store Onboarding') ||
      notif?.category === 'COMPLIANCE' ||
      notif?.message?.includes('credential') ||
      notif?.message?.includes('PAN') ||
      notif?.message?.includes('GSTIN') ||
      notif?.message?.includes('FSSAI') ||
      notif?.message?.includes('verification') ||
      notif?.message?.includes('Seller:');

    if (isSellerNotice) {
      if (role === 'ADMIN') {
        return sid ? `/admin/sellers?sellerId=${sid}` : '/admin/sellers';
      }
      if (role === 'SELLER') return '/seller/dashboard';
    }

    // 3. Fallback to generic actionUrl if provided and safe
    if (notif?.actionUrl) {
      if (notif.actionUrl.startsWith('/admin/complaints/')) {
        const id = notif.actionUrl.split('/').pop();
        return `/admin/support?id=${id}`;
      }
      return notif.actionUrl;
    }

    return null;
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif._id);
    }
    const target = resolveTargetUrl(notif);
    if (target) {
      navigate(target);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchNotifications(page + 1, true);
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderGroup = (groupTitle, items, icon) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          {icon}
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
            {groupTitle}
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
            {items.length}
          </span>
        </div>

        <div className="space-y-2.5">
          {items.map((notif) => {
            const cat = getNotificationCategoryMeta(notif, role);

            return (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={`group relative p-4 rounded-2xl border transition-all duration-150 cursor-pointer ${
                  !notif.isRead
                    ? 'bg-white border-purple-200/90 shadow-sm hover:border-purple-300 ring-1 ring-purple-100/50'
                    : 'bg-gray-50/70 border-gray-200 hover:bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Read / Unread Indicator Dot */}
                  <div className="pt-1 flex-shrink-0">
                    <span
                      className={`block w-2.5 h-2.5 rounded-full transition-transform ${
                        !notif.isRead
                          ? `${theme.dotColor} animate-pulse scale-110 shadow-xs`
                          : 'bg-gray-300'
                      }`}
                      title={!notif.isRead ? 'Unread notification' : 'Read notification'}
                    />
                  </div>

                  {/* Notification Content Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${cat.badgeColor}`}
                        >
                          {cat.label}
                        </span>
                        <h4
                          className={`text-xs font-bold leading-tight ${
                            !notif.isRead ? 'text-gray-900 font-extrabold' : 'text-gray-700'
                          }`}
                        >
                          {notif.title}
                        </h4>
                      </div>

                      <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                        {groupTitle === 'Earlier'
                          ? formatFullDate(notif.createdAt)
                          : formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed font-normal whitespace-pre-wrap break-words">
                      {notif.message}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100/80">
                      <div>
                        {resolveTargetUrl(notif) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notif);
                            }}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold ${theme.primaryText} hover:underline`}
                          >
                            <span>
                              {role === 'SELLER' &&
                              (notif.data?.complaintId ||
                                notif.title?.includes('Dispute') ||
                                notif.title?.includes('NE-CMP-') ||
                                notif.message?.includes('dispute'))
                                ? 'Talk with Customer & Resolve'
                                : role === 'ADMIN' &&
                                  (notif.data?.complaintId ||
                                    notif.title?.includes('Dispute') ||
                                    notif.title?.includes('NE-CMP-') ||
                                    notif.message?.includes('dispute') ||
                                    notif.title?.includes('Complaint'))
                                ? 'Inspect Dispute Dossier'
                                : role === 'ADMIN' &&
                                  (notif.data?.sellerId ||
                                    notif.title?.includes('Document') ||
                                    notif.title?.includes('Seller') ||
                                    notif.message?.includes('credential') ||
                                    notif.message?.includes('verification'))
                                ? 'Inspect Seller Dossier'
                                : 'Open Details'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">Notice</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notif._id, e)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1 transition"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark read</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDelete(notif._id, e)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Dismiss notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${theme.primaryLight}`}>
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">{title}</h1>
            {unreadCount > 0 && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${theme.primaryLight} border ${theme.primaryBorder}`}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed font-normal">{description}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => fetchNotifications(1, false, true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className={`px-4 py-2 ${theme.primaryBg} text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5`}
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-3">
        {/* Status Tab Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Notifications ({total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'unread'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>Unread Only</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-[11px] text-gray-400 font-medium">
            Showing {filteredNotifications.length} of {total} notifications
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition text-xs ${
              selectedCategory === 'ALL'
                ? `${theme.primaryLight} ring-1 ${theme.primaryBorder}`
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition text-xs ${
                selectedCategory === cat.key
                  ? `${theme.primaryLight} ring-1 ${theme.primaryBorder}`
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body with Time-Grouped Lists */}
      {loading && !refreshing && (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-gray-500 font-medium mt-3">Loading notifications...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <div className="text-xs text-red-800 font-bold">{error}</div>
          <button
            type="button"
            onClick={() => fetchNotifications(1, false)}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition"
          >
            Retry Loading
          </button>
        </div>
      )}

      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="py-16 text-center bg-white rounded-3xl border border-gray-200 p-8 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">No Notifications</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {statusFilter === 'unread'
              ? 'You have read all your notifications. Great job staying up to date!'
              : 'There are currently no notifications matching your active category or filter.'}
          </p>
        </div>
      )}

      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="space-y-8">
          {renderGroup('Today', timeGroups.today, <Clock className="w-4 h-4 text-emerald-600" />)}
          {renderGroup('Yesterday', timeGroups.yesterday, <Calendar className="w-4 h-4 text-amber-600" />)}
          {renderGroup('Earlier', timeGroups.earlier, <Calendar className="w-4 h-4 text-gray-400" />)}

          {/* Load More Pagination */}
          {page < totalPages && (
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs shadow-xs transition disabled:opacity-50"
              >
                {loadingMore ? 'Loading Older Notifications...' : 'Load More Notifications'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

