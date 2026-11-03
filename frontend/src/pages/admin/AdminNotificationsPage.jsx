import React from 'react';
import { NotificationCenter } from '../../components/common/NotificationCenter';

const ADMIN_CATEGORIES = [
  { key: 'ONBOARDING', label: 'Store Onboarding' },
  { key: 'VERIFICATION', label: 'Document Verification' },
  { key: 'SUPPORT', label: 'Support & Inquiries' },
  { key: 'ORDERS', label: 'Platform Orders' },
  { key: 'INVENTORY', label: 'Inventory & Expiry' },
  { key: 'SYSTEM', label: 'Security & System' },
];

export const AdminNotificationsPage = () => {
  return (
    <NotificationCenter
      role="ADMIN"
      title="Admin Notification Command Desk"
      description="Centralized timeline of merchant registrations, document verification requests, support tickets, and system alerts."
      categories={ADMIN_CATEGORIES}
    />
  );
};

export default AdminNotificationsPage;
