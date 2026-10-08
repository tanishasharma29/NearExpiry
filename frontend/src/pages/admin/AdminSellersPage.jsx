import React, { useEffect, useState, useMemo } from 'react';
import {
  Store,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Search,
  ExternalLink,
  Clock,
  FileText,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminFilterBar,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminMotionContainer,
} from '../../components/admin';

export const AdminSellersPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected seller dossier drawer
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Rejection modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [sellerToReject, setSellerToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = {};
      if (statusFilter) queryParams.verificationStatus = statusFilter;
      if (search.trim()) queryParams.search = search.trim();

      const data = await adminService.getSellers(queryParams);
      setSellers(data?.sellers || []);
    } catch (err) {
      console.error('Failed to retrieve sellers:', err);
      setError(err.message || 'Unable to load seller verification records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, [statusFilter]);

  // Handle live client search filter over loaded list or re-fetch on search enter
  const filteredSellers = useMemo(() => {
    if (!search.trim()) return sellers;
    const q = search.toLowerCase();
    return sellers.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const storeName = (s.sellerProfile?.storeName || s.store?.storeName || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || storeName.includes(q) || phone.includes(q);
    });
  }, [sellers, search]);

  const pendingCount = useMemo(() => {
    return sellers.filter((s) => s.verificationStatus === 'PENDING').length;
  }, [sellers]);

  const handleApprove = async (sellerId, storeName) => {
    try {
      setActionLoadingId(sellerId);
      await adminService.updateSellerApproval(sellerId, { status: 'APPROVED' });
      setFeedbackMessage({
        type: 'success',
        text: `Seller permit approved and store activated for "${storeName || 'Merchant'}".`,
      });
      if (drawerOpen && selectedSeller?._id === sellerId) {
        setSelectedSeller((prev) => (prev ? { ...prev, verificationStatus: 'APPROVED' } : null));
      }
      await fetchSellers();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to approve seller permit.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (seller) => {
    setSellerToReject(seller);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please specify an official reason for rejection.');
      return;
    }
    const sellerId = sellerToReject?._id;
    try {
      setActionLoadingId(sellerId);
      await adminService.updateSellerApproval(sellerId, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
      setFeedbackMessage({
        type: 'success',
        text: `Seller application rejected for "${sellerToReject?.sellerProfile?.storeName || sellerToReject?.name}".`,
      });
      setRejectModalOpen(false);
      setSellerToReject(null);
      setRejectionReason('');
      if (drawerOpen && selectedSeller?._id === sellerId) {
        setSelectedSeller((prev) =>
          prev
            ? {
                ...prev,
                verificationStatus: 'REJECTED',
                sellerProfile: { ...prev.sellerProfile, rejectionReason: rejectionReason.trim() },
              }
            : null
        );
      }
      await fetchSellers();
    } catch (err) {
      alert(err.message || 'Failed to record rejection.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDossier = (seller) => {
    setSelectedSeller(seller);
    setDrawerOpen(true);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. COMMAND HEADER */}
      <AdminPageHeader
        eyebrow="MARKETPLACE GOVERNANCE"
        title="Seller Verification & Onboarding"
        subtitle="Review retailer KYC applications, verify food permits and business identity, and control which merchants can operate on NearExpiry."
        statusBadge={
          <AdminStatusBadge
            status={pendingCount > 0 ? 'PENDING' : 'HEALTHY'}
            label={pendingCount > 0 ? `${pendingCount} Pending Review` : 'Queue Cleared'}
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
              <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
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

      {/* 2. VERIFICATION CONTROL BAR */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by seller name, store, email, or phone..."
        filters={[
          {
            id: 'verificationStatus',
            label: 'Filter by Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: ShieldCheck,
            options: [
              { label: 'All Applications', value: '' },
              { label: 'Pending Review', value: 'PENDING' },
              { label: 'Approved Sellers', value: 'APPROVED' },
              { label: 'Rejected Applicants', value: 'REJECTED' },
            ],
          },
        ]}
        totalResults={sellers.length}
        filteredCount={filteredSellers.length}
        hasActiveFilters={Boolean(search || statusFilter)}
        onClear={() => {
          setSearch('');
          setStatusFilter('');
        }}
      />

      {/* 3. PRIMARY REVIEW QUEUE */}
      {loading ? (
        <LoadingSpinner text="Retrieving seller verification registry..." />
      ) : error ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title="Unable to Retrieve Seller Registry"
          description={error}
          actionLabel="Retry Connection"
          onAction={fetchSellers}
        />
      ) : filteredSellers.length > 0 ? (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">Seller / Owner</th>
                  <th className="py-3.5 px-4">Store Profile</th>
                  <th className="py-3.5 px-4">Contact Details</th>
                  <th className="py-3.5 px-4">KYC Status</th>
                  <th className="py-3.5 px-4">Application Date</th>
                  <th className="py-3.5 px-5 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredSellers.map((s) => {
                  const isPending = s.verificationStatus === 'PENDING';
                  const storeName = s.sellerProfile?.storeName || s.store?.storeName || 'Store';
                  const isProcessing = actionLoadingId === s._id;

                  return (
                    <tr
                      key={s._id}
                      onClick={() => openDossier(s)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        isPending ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Owner Identity */}
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
                          ID: {s._id.slice(-6).toUpperCase()}
                        </div>
                      </td>

                      {/* Store Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span>{storeName}</span>
                        </div>
                        {s.store?.address?.city && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {s.store.address.city}, {s.store.address.state || ''}
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-gray-600">
                        <div>{s.email}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{s.phone || 'Phone not set'}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <AdminStatusBadge
                          status={s.verificationStatus || 'PENDING'}
                          size="md"
                        />
                      </td>

                      {/* Application Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {formatDate(s.createdAt)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-5 text-right space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(s._id, storeName)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {isProcessing ? 'Saving...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectModal(s)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDossier(s)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            View Dossier
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Flow */}
          <div className="md:hidden space-y-3">
            {filteredSellers.map((s) => {
              const isPending = s.verificationStatus === 'PENDING';
              const storeName = s.sellerProfile?.storeName || s.store?.storeName || 'Store';
              const isProcessing = actionLoadingId === s._id;

              return (
                <div
                  key={s._id}
                  onClick={() => openDossier(s)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isPending ? 'bg-amber-50/30 border-amber-200' : 'bg-white border-gray-200/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                      <div className="text-xs text-purple-700 font-semibold flex items-center gap-1 mt-0.5">
                        <Store className="w-3.5 h-3.5" />
                        <span>{storeName}</span>
                      </div>
                    </div>
                    <AdminStatusBadge status={s.verificationStatus || 'PENDING'} size="sm" />
                  </div>

                  <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                    <div>Email: {s.email}</div>
                    <div>Phone: {s.phone || 'N/A'}</div>
                    <div className="text-[10px] text-gray-400">Registered: {formatDate(s.createdAt)}</div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(s._id, storeName)}
                          disabled={isProcessing}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition"
                        >
                          {isProcessing ? 'Saving...' : 'Approve Permit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(s)}
                          disabled={isProcessing}
                          className="flex-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold text-xs transition"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openDossier(s)}
                        className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                      >
                        Inspect Dossier
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <AdminEmptyState
          icon={Store}
          title={statusFilter ? `No ${statusFilter.toLowerCase()} seller records` : 'No seller applicants found'}
          description={
            statusFilter === 'PENDING'
              ? 'All retailer registration applications have been verified. No pending permits in the review queue.'
              : search
              ? `No registered sellers match the criteria "${search}".`
              : 'There are currently no retail sellers registered in the marketplace.'
          }
          actionLabel={statusFilter || search ? 'Reset Filters' : undefined}
          onAction={() => {
            setSearch('');
            setStatusFilter('');
          }}
        />
      )}

      {/* 4. SELLER DOSSIER / DETAIL DRAWER */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="SELLER VERIFICATION DOSSIER"
        title={selectedSeller?.sellerProfile?.storeName || selectedSeller?.store?.storeName || selectedSeller?.name || 'Seller Details'}
        subtitle={`Owner Account: ${selectedSeller?.name} • Registered on ${formatDate(selectedSeller?.createdAt)}`}
        footerActions={
          selectedSeller?.verificationStatus === 'PENDING' ? (
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
                onClick={() => {
                  setDrawerOpen(false);
                  openRejectModal(selectedSeller);
                }}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition"
              >
                Reject Application
              </button>
              <button
                type="button"
                onClick={() => {
                  handleApprove(selectedSeller._id, selectedSeller?.sellerProfile?.storeName || selectedSeller?.name);
                }}
                disabled={actionLoadingId === selectedSeller?._id}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                {actionLoadingId === selectedSeller?._id ? 'Approving...' : 'Approve & Activate Store'}
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
        {selectedSeller && (
          <div className="space-y-6 text-xs">
            {/* Status & Review Summary */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block mb-1">
                  Current Verification State
                </span>
                <AdminStatusBadge status={selectedSeller.verificationStatus || 'PENDING'} size="md" />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Store Status</span>
                <span className="font-extrabold text-gray-800">
                  {selectedSeller.store?.isActive ? 'Active Storefront' : 'Store Disabled'}
                </span>
              </div>
            </div>

            {/* Rejection Notice if rejected */}
            {selectedSeller.verificationStatus === 'REJECTED' && selectedSeller.sellerProfile?.rejectionReason && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span>Rejection Reason Recorded:</span>
                </div>
                <p className="text-xs text-red-700 font-medium">
                  {selectedSeller.sellerProfile.rejectionReason}
                </p>
                {selectedSeller.sellerProfile.reviewedAt && (
                  <p className="text-[10px] text-red-500 pt-1">
                    Reviewed on {formatDate(selectedSeller.sellerProfile.reviewedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Section A: Seller Identity */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-purple-700" />
                <span>Owner & Identity Information</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Legal Owner Name</span>
                  <span className="font-bold text-gray-900">{selectedSeller.name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Email Address</span>
                  <span className="font-mono text-gray-800">{selectedSeller.email}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Phone Number</span>
                  <span className="font-mono text-gray-800">{selectedSeller.phone || 'Not provided'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Platform Account ID</span>
                  <span className="font-mono text-[11px] text-gray-600">{selectedSeller._id}</span>
                </div>
              </div>
            </div>

            {/* Section B: Available KYC & Business Credentials */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-700" />
                <span>Business & Tax Credentials</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">PAN Number</span>
                  <span className="font-mono font-bold text-gray-900">
                    {selectedSeller.sellerProfile?.panNumber || 'Not provided'}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">GSTIN Registration</span>
                  <span className="font-mono font-bold text-gray-900">
                    {selectedSeller.sellerProfile?.gstinNumber || 'Not provided'}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">FSSAI Food License</span>
                  <span className="font-mono font-bold text-gray-900">
                    {selectedSeller.sellerProfile?.fssaiNumber || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section C: Store Location Details */}
            {selectedSeller.store && (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-700" />
                  <span>Store Physical Address</span>
                </h4>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-1.5 text-gray-700">
                  <div className="font-bold text-gray-900">{selectedSeller.store.storeName}</div>
                  <div>{selectedSeller.store.address?.street || 'Street address not provided'}</div>
                  <div>
                    {selectedSeller.store.address?.city || ''}{selectedSeller.store.address?.state ? `, ${selectedSeller.store.address.state}` : ''} {selectedSeller.store.address?.pincode ? `- ${selectedSeller.store.address.pincode}` : ''}
                  </div>
                  {selectedSeller.store.contactPhone && (
                    <div className="text-[11px] text-gray-500 pt-1">
                      Store Line: {selectedSeller.store.contactPhone}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminDetailDrawer>

      {/* 5. REJECTION REASON CONFIRMATION MODAL */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Retailer Application"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Provide the formal justification for rejecting{' '}
            <span className="font-bold text-gray-900">
              {sellerToReject?.sellerProfile?.storeName || sellerToReject?.name}
            </span>.
            This explanation will be permanently recorded in the merchant dossier.
          </p>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
              Rejection Notice Reason *
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Invalid or expired FSSAI food permit license; incomplete business address documentation."
              className="w-full p-3 bg-gray-50 border border-gray-300 focus:border-red-600 rounded-xl outline-none text-xs text-gray-900 transition focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={actionLoadingId === sellerToReject?._id || !rejectionReason.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {actionLoadingId === sellerToReject?._id ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminSellersPage;
