import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * AdminDetailDrawer
 * Slide-in administrative panel for inspecting detailed records (e.g., Seller KYC,
 * Order Transaction Dossiers, Product Flagged Details, Audit Diff Streams) without leaving the view.
 */
export const AdminDetailDrawer = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  subtitle,
  children,
  footerActions,
  width = 'max-w-xl',
  className = '',
}) => {
  // Listen for Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div
          className={`w-screen ${width} bg-white shadow-2xl flex flex-col transform transition-transform duration-250 ease-out motion-reduce:transform-none ${className}`}
        >
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/70 flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {eyebrow && (
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded">
                  {eyebrow}
                </span>
              )}
              <h2
                id="admin-drawer-title"
                className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-gray-500 leading-relaxed font-normal">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-purple-600"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>

          {/* Drawer Footer Actions */}
          {footerActions && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/60 flex items-center justify-end gap-3 flex-shrink-0">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDetailDrawer;

