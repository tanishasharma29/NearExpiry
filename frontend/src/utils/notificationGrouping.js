/**
 * Time grouping utilities for NearExpiry Unified Notification Center.
 * Accurately clusters notifications into Today, Yesterday, and Earlier
 * using user's local timezone midnight calendar boundaries.
 */

export const groupNotificationsByTime = (notifications = []) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const groups = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  // Ensure notifications are sorted newest first
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const notif of sorted) {
    const time = new Date(notif.createdAt).getTime();
    if (isNaN(time)) {
      groups.earlier.push(notif);
    } else if (time >= startOfToday) {
      groups.today.push(notif);
    } else if (time >= startOfYesterday) {
      groups.yesterday.push(notif);
    } else {
      groups.earlier.push(notif);
    }
  }

  return groups;
};

/**
 * Maps notification types and keywords to human-friendly display categories.
 */
export const getNotificationCategoryMeta = (notif, role = 'SELLER') => {
  const type = notif?.type || '';
  const title = notif?.title || '';

  if (role === 'ADMIN') {
    if (title.includes('Seller Support') || title.includes('Support Request') || title.includes('Dispute') || type === 'COMPLAINT') {
      return { key: 'SUPPORT', label: 'Support & Disputes', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    if (title.includes('Document') || title.includes('KYC') || type === 'DOCUMENT_REQUEST') {
      return { key: 'VERIFICATION', label: 'Document Verification', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    if (title.includes('New Seller') || title.includes('Store Registration') || type === 'STORE_APPROVED' || type === 'STORE_REJECTED') {
      return { key: 'ONBOARDING', label: 'Store Onboarding', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    if (type === 'APPROACHING_EXPIRY' || type === 'CRITICAL_EXPIRY' || type === 'EXPIRED_INVENTORY' || type === 'LOW_STOCK') {
      return { key: 'INVENTORY', label: 'Inventory & Expiry', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
    if (type === 'NEW_ORDER' || type === 'ORDER_CONFIRMED' || type === 'ORDER_STATUS_UPDATE') {
      return { key: 'ORDERS', label: 'Platform Orders', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    return { key: 'SYSTEM', label: 'System & Security', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' };
  }

  // Seller Dashboard Categories
  if (type === 'NEW_ORDER' || type === 'ORDER_CONFIRMED' || type === 'ORDER_STATUS_UPDATE' || title.includes('Order')) {
    return { key: 'ORDERS', label: 'Orders & Sales', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
  if (type === 'APPROACHING_EXPIRY' || type === 'CRITICAL_EXPIRY' || type === 'EXPIRED_INVENTORY' || title.includes('Expiry')) {
    return { key: 'EXPIRY', label: 'Expiry Alerts', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (type === 'LOW_STOCK' || title.includes('Stock') || title.includes('Batch')) {
    return { key: 'INVENTORY', label: 'Inventory & Batches', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
  }
  if (type === 'STORE_APPROVED' || type === 'STORE_REJECTED' || title.includes('Document') || title.includes('Verification')) {
    return { key: 'COMPLIANCE', label: 'Store Compliance', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' };
  }
  return { key: 'SYSTEM', label: 'Announcements & Alerts', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' };
};
