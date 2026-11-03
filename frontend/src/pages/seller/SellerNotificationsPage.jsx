import React from 'react';
import { NotificationCenter } from '../../components/common/NotificationCenter';

const SELLER_CATEGORIES = [
  { key: 'ORDERS', label: 'Orders & Sales' },
  { key: 'EXPIRY', label: 'Expiry Alerts' },
  { key: 'INVENTORY', label: 'Inventory & Batches' },
  { key: 'COMPLIANCE', label: 'Store Compliance' },
  { key: 'SYSTEM', label: 'Platform Announcements' },
];

export const SellerNotificationsPage = () => {
  return (
    <NotificationCenter
      role="SELLER"
      title="Seller Notification Center"
      description="Stay updated with order requests, approaching expiry batches, inventory alerts, and compliance requests."
      categories={SELLER_CATEGORIES}
    />
  );
};

export default SellerNotificationsPage;
