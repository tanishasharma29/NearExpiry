import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  Clock,
  Store,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Key,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminFilterBar,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminMotionContainer,
} from '../../components/admin';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected User Dossier Drawer
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = {};
      if (roleFilter) queryParams.role = roleFilter;
      if (statusFilter !== '') queryParams.isActive = statusFilter;
      if (search.trim()) queryParams.search = search.trim();

      const data = await adminService.getUsers(queryParams);
      setUsers(data?.users || []);
    } catch (err) {
      console.error('Failed to retrieve user accounts:', err);
      setError(err.message || 'Unable to retrieve platform account directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  // Client search refinement over loaded dataset
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const id = (u._id || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [users, search]);

  const activeCount = useMemo(() => {
    return users.filter((u) => u.isActive).length;
  }, [users]);

  const toggleStatus = async (userId, currentActive, userName) => {
    try {
      setActionLoadingId(userId);
      const nextActive = !currentActive;
      await adminService.updateUserStatus(userId, { isActive: nextActive });

      setFeedbackMessage({
        type: 'success',
        text: `Account for "${userName || 'User'}" has been ${nextActive ? 'reactivated' : 'suspended'}.`,
      });

      // Synchronize in-memory list
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: nextActive } : u))
      );

      // Synchronize drawer if open for this user
      if (selectedUser?._id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, isActive: nextActive } : null));
        setUserDetails((prev) =>
          prev ? { ...prev, user: { ...prev.user, isActive: nextActive } } : null
        );
      }
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to update account status.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDossier = async (user) => {
    setSelectedUser(user);
    setUserDetails(null);
    setDrawerOpen(true);
    try {
      setLoadingDetails(true);
      const details = await adminService.getUserById(user._id);
      setUserDetails(details);
    } catch (err) {
      console.warn('Could not fetch extra user details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadgeConfig = (role) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Administrator', status: 'ACTIVE', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'SELLER':
        return { label: 'Merchant Seller', status: 'APPROVED', color: 'bg-brand-50 text-brand-700 border-brand-200' };
      default:
        return { label: 'Customer Shopper', status: 'OPEN', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. COMMAND HEADER */}
      <AdminPageHeader
        eyebrow="PLATFORM GOVERNANCE"
        title="Platform Account Directory"
        subtitle="Manage platform accounts, role credentials, access permissions, and lifecycle status from one centralized identity registry."
        statusBadge={
          <AdminStatusBadge
            status="ACTIVE"
            label={`${activeCount} / ${users.length} Accounts Active`}
            size="sm"
          />
        }
      />

      {/* Action Feedback Banner */}
      {feedbackMessage && (
        <AdminMotionContainer
          animation="fade-slide-up"
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-gray-500 hover:text-gray-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </AdminMotionContainer>
      )}

      {/* 2. DIRECTORY CONTROL BAR */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, phone, or account ID..."
        filters={[
          {
            id: 'roleFilter',
            label: 'Filter by Role',
            value: roleFilter,
            onChange: setRoleFilter,
            icon: Shield,
            options: [
              { label: 'All Platform Roles', value: '' },
              { label: 'Customers (Shoppers)', value: 'CUSTOMER' },
              { label: 'Sellers (Merchants)', value: 'SELLER' },
              { label: 'Admins (Superusers)', value: 'ADMIN' },
            ],
          },
          {
            id: 'statusFilter',
            label: 'Filter by Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: UserCheck,
            options: [
              { label: 'All Statuses', value: '' },
              { label: 'Active Accounts', value: 'true' },
              { label: 'Suspended Accounts', value: 'false' },
            ],
          },
        ]}
        totalResults={users.length}
        filteredCount={filteredUsers.length}
        hasActiveFilters={Boolean(search || roleFilter || statusFilter !== '')}
        onClear={() => {
          setSearch('');
          setRoleFilter('');
          setStatusFilter('');
        }}
      />

      {/* 3. ACCOUNT DIRECTORY CONTENT */}
      {loading ? (
        <LoadingSpinner text="Retrieving platform account directory..." />
      ) : error ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title="Failed to Load Accounts"
          description={error}
          actionLabel="Retry Connection"
          onAction={fetchUsers}
        />
      ) : filteredUsers.length > 0 ? (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">User / Identity</th>
                  <th className="py-3.5 px-4">Contact Details</th>
                  <th className="py-3.5 px-4">Role / Permissions</th>
                  <th className="py-3.5 px-4">Account Access</th>
                  <th className="py-3.5 px-4">Registration Date</th>
                  <th className="py-3.5 px-5 text-right">Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredUsers.map((u) => {
                  const roleConfig = getRoleBadgeConfig(u.role);
                  const isProcessing = actionLoadingId === u._id;
                  const initial = (u.name || u.email || 'U').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={u._id}
                      onClick={() => openDossier(u)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        !u.isActive ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Identity */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0 border border-purple-200/70 shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{u.name}</div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              ID: {u._id.slice(-6).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="font-mono text-gray-800">{u.email}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{u.phone || 'Phone not set'}</div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${roleConfig.color}`}
                        >
                          <Shield className="w-3 h-3 flex-shrink-0" />
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        <AdminStatusBadge
                          status={u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          label={u.isActive ? 'Active Access' : 'Suspended'}
                          size="md"
                        />
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-5 text-right space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {u.role !== 'ADMIN' ? (
                          <button
                            type="button"
                            onClick={() => toggleStatus(u._id, u.isActive, u.name)}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                              u.isActive
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            } disabled:opacity-50`}
                          >
                            {isProcessing ? 'Updating...' : u.isActive ? 'Suspend' : 'Reactivate'}
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-400 px-2 py-1">
                            Protected Admin
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openDossier(u)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Flow */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map((u) => {
              const roleConfig = getRoleBadgeConfig(u.role);
              const isProcessing = actionLoadingId === u._id;
              const initial = (u.name || u.email || 'U').charAt(0).toUpperCase();

              return (
                <div
                  key={u._id}
                  onClick={() => openDossier(u)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    !u.isActive ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-200/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0 border border-purple-200">
                        {initial}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{u.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          ID: {u._id.slice(-6).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <AdminStatusBadge
                      status={u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      size="sm"
                    />
                  </div>

                  <div className="text-xs text-gray-500 space-y-0.5 mb-3 pt-1">
                    <div>Email: <span className="text-gray-700 font-mono">{u.email}</span></div>
                    <div>Phone: <span className="text-gray-700">{u.phone || 'N/A'}</span></div>
                    <div>Role: <span className="font-bold text-gray-800">{roleConfig.label}</span></div>
                    <div className="text-[10px] text-gray-400">Created: {formatDate(u.createdAt)}</div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {u.role !== 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => toggleStatus(u._id, u.isActive, u.name)}
                        disabled={isProcessing}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                          u.isActive
                            ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isProcessing ? 'Updating...' : u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDossier(u)}
                      className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                    >
                      View Dossier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <AdminEmptyState
          icon={Users}
          title={
            roleFilter
              ? `No ${roleFilter.toLowerCase()} accounts found`
              : statusFilter !== ''
              ? statusFilter === 'true'
                ? 'No active accounts found'
                : 'No suspended accounts found'
              : 'No accounts match your criteria'
          }
          description={
            search
              ? `No platform accounts matched the search keyword "${search}".`
              : roleFilter
              ? `There are currently no registered users matching role "${roleFilter}".`
              : 'Try clearing your active filters to review all registered platform accounts.'
          }
          actionLabel={roleFilter || statusFilter !== '' || search ? 'Reset Filters' : undefined}
          onAction={() => {
            setSearch('');
            setRoleFilter('');
            setStatusFilter('');
          }}
        />
      )}

      {/* 4. USER DOSSIER / ACCOUNT INSPECTION DRAWER */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="PLATFORM ACCOUNT DOSSIER"
        title={selectedUser?.name || 'Account Details'}
        subtitle={`Account ID: ${selectedUser?._id} • Registered ${formatDate(selectedUser?.createdAt)}`}
        footerActions={
          selectedUser?.role !== 'ADMIN' ? (
            <>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(selectedUser._id, selectedUser.isActive, selectedUser.name)}
                disabled={actionLoadingId === selectedUser?._id}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                  selectedUser?.isActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                } disabled:opacity-50`}
              >
                {actionLoadingId === selectedUser?._id
                  ? 'Saving...'
                  : selectedUser?.isActive
                  ? 'Suspend Account Access'
                  : 'Reactivate Account Access'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition"
            >
              Done Reviewing
            </button>
          )
        }
      >
        {selectedUser && (
          <div className="space-y-6 text-xs">
            {/* Status & Access Header */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block mb-1">
                  Access Permissions Status
                </span>
                <AdminStatusBadge
                  status={selectedUser.isActive ? 'ACTIVE' : 'SUSPENDED'}
                  label={selectedUser.isActive ? 'Active Platform Access' : 'Suspended by Admin'}
                  size="md"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Role Level</span>
                <span className="font-extrabold text-gray-800">
                  {selectedUser.role}
                </span>
              </div>
            </div>

            {/* A. Account Identity */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-700" />
                <span>Identity & Contact Details</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Legal Name</span>
                  <span className="font-bold text-gray-900">{selectedUser.name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Email Address</span>
                  <span className="font-mono text-gray-800">{selectedUser.email}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Contact Phone</span>
                  <span className="font-mono text-gray-800">{selectedUser.phone || 'Not provided'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Unique User ID</span>
                  <span className="font-mono text-[11px] text-gray-600">{selectedUser._id}</span>
                </div>
              </div>
            </div>

            {/* B. Account Lifecycle Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-700" />
                <span>Account Lifecycle Dates</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Account Created</span>
                  <span className="font-medium text-gray-900">{formatDate(selectedUser.createdAt)}</span>
                </div>
                {selectedUser.updatedAt && (
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Last Profile Update</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedUser.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* C. Real Activity & Operational Footprint */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-purple-700" />
                <span>Platform Operational Footprint</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                {loadingDetails ? (
                  <div className="py-3 text-center text-gray-400">Loading account footprint...</div>
                ) : userDetails ? (
                  <>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Total Orders Placed (Shopper)</span>
                      <span className="font-extrabold text-purple-700 text-sm">
                        {userDetails.ordersCount ?? 0}
                      </span>
                    </div>

                    {userDetails.store && (
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Operating Storefront</span>
                          <span className="font-bold text-gray-900">{userDetails.store.storeName}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-500">Store Status</span>
                          <span className="font-bold text-emerald-700">
                            {userDetails.store.isActive ? 'Active Storefront' : 'Store Offline'}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedUser.role === 'ADMIN' && (
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-900 text-[11px] font-medium flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
                        <span>Account equipped with platform superadmin security privileges.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-400 py-1">No additional footprint data available.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </AdminDetailDrawer>
    </div>
  );
};

export default AdminUsersPage;
