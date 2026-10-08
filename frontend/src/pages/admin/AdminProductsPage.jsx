import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Store,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Archive,
  RefreshCw,
  Search,
  ExternalLink,
  Tag,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Eye,
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

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Selected Product Dossier Drawer
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Delist Confirmation Modal
  const [delistModalOpen, setDelistModalOpen] = useState(false);
  const [productToDelist, setProductToDelist] = useState(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = {};
      if (statusFilter) queryParams.status = statusFilter;
      if (categoryFilter) queryParams.category = categoryFilter;
      if (search.trim()) queryParams.search = search.trim();

      const [productsRes, categoriesRes] = await Promise.allSettled([
        adminService.getProducts(queryParams),
        adminService.getCategories(),
      ]);

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value?.products || []);
      } else {
        throw new Error(productsRes.reason?.message || 'Failed to fetch catalog.');
      }

      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value?.categories || categoriesRes.value || []);
      }
    } catch (err) {
      console.error('Failed to retrieve catalog:', err);
      setError(err.message || 'Unable to query marketplace catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, categoryFilter]);

  // Client search refinement over loaded dataset
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const storeName = (p.storeId?.storeName || '').toLowerCase();
      const catName = (p.category?.name || '').toLowerCase();
      const id = (p._id || '').toLowerCase();
      return name.includes(q) || brand.includes(q) || storeName.includes(q) || catName.includes(q) || id.includes(q);
    });
  }, [products, search]);

  const activeCount = useMemo(() => {
    return products.filter((p) => p.status === 'ACTIVE').length;
  }, [products]);

  const moderateProduct = async (id, nextStatus, productTitle) => {
    try {
      setActionLoadingId(id);
      await adminService.moderateProduct(id, { status: nextStatus });

      const isDelisting = nextStatus === 'ARCHIVED';
      setFeedbackMessage({
        type: 'success',
        text: `Listing "${productTitle || 'Product'}" has been ${isDelisting ? 'delisted and archived' : 'restored to active marketplace'}.`,
      });

      // Synchronize in-memory products list
      setProducts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, status: nextStatus } : p))
      );

      // Synchronize drawer if viewing this product
      if (selectedProduct?._id === id) {
        setSelectedProduct((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }

      // Close modal if triggered from modal
      setDelistModalOpen(false);
      setProductToDelist(null);
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to moderate product status.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDossier = (product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

  const openDelistModal = (product) => {
    setProductToDelist(product);
    setDelistModalOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. COMMAND HEADER */}
      <AdminPageHeader
        eyebrow="MARKETPLACE GOVERNANCE"
        title="Catalog Moderation Workspace"
        subtitle="Inspect marketplace listings, audit merchant SKU representations, and control active catalog discovery across all retail stores."
        statusBadge={
          <AdminStatusBadge
            status="ACTIVE"
            label={`${activeCount} / ${products.length} Active Listings`}
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

      {/* 2. MODERATION CONTROL BAR */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by product title, brand, store, or SKU ID..."
        filters={[
          {
            id: 'statusFilter',
            label: 'Filter by Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: Tag,
            options: [
              { label: 'All Moderation States', value: '' },
              { label: 'Active Listings', value: 'ACTIVE' },
              { label: 'Delisted / Archived', value: 'ARCHIVED' },
              { label: 'Inactive Listings', value: 'INACTIVE' },
              { label: 'Draft Listings', value: 'DRAFT' },
            ],
          },
          {
            id: 'categoryFilter',
            label: 'Filter by Category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            icon: Layers,
            options: [
              { label: 'All Categories', value: '' },
              ...categories.map((c) => ({
                label: c.name,
                value: c._id,
              })),
            ],
          },
        ]}
        totalResults={products.length}
        filteredCount={filteredProducts.length}
        hasActiveFilters={Boolean(search || statusFilter || categoryFilter)}
        onClear={() => {
          setSearch('');
          setStatusFilter('');
          setCategoryFilter('');
        }}
      />

      {/* 3. PRODUCT INSPECTION DESK */}
      {loading ? (
        <LoadingSpinner text="Querying platform catalog records..." />
      ) : error ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title="Failed to Load Catalog"
          description={error}
          actionLabel="Retry Connection"
          onAction={fetchData}
        />
      ) : filteredProducts.length > 0 ? (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">Product SKU</th>
                  <th className="py-3.5 px-4">Merchant Store</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Listing Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredProducts.map((p) => {
                  const isActive = p.status === 'ACTIVE';
                  const isProcessing = actionLoadingId === p._id;

                  return (
                    <tr
                      key={p._id}
                      onClick={() => openDossier(p)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        !isActive ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Product SKU Identity */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-200 flex-shrink-0 bg-gray-50"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0 border border-purple-200">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm truncate max-w-xs">{p.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                              <span className="font-semibold text-gray-700">{p.brand}</span>
                              <span className="text-gray-300">•</span>
                              <span className="font-mono text-gray-400 text-[10px]">ID: {p._id.slice(-6).toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Store Context */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span>{p.storeId?.storeName || 'Merchant Store'}</span>
                        </div>
                        {p.storeId?.verificationStatus && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Permit: <span className="font-semibold">{p.storeId.verificationStatus}</span>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-semibold text-[11px] inline-block">
                          {p.category?.name || 'Category'}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5 pl-0.5">Unit: {p.unit || 'pcs'}</div>
                      </td>

                      {/* Listing Status */}
                      <td className="py-3.5 px-4">
                        <AdminStatusBadge
                          status={p.status || 'ACTIVE'}
                          label={
                            p.status === 'ACTIVE'
                              ? 'Active Listing'
                              : p.status === 'ARCHIVED'
                              ? 'Delisted / Archived'
                              : p.status
                          }
                          size="md"
                        />
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {formatDate(p.createdAt)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-5 text-right space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => openDelistModal(p)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold transition disabled:opacity-50"
                          >
                            Delist
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => moderateProduct(p._id, 'ACTIVE', p.name)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-2xs disabled:opacity-50"
                          >
                            {isProcessing ? 'Saving...' : 'Restore'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openDossier(p)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          Inspect
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
            {filteredProducts.map((p) => {
              const isActive = p.status === 'ACTIVE';
              const isProcessing = actionLoadingId === p._id;

              return (
                <div
                  key={p._id}
                  onClick={() => openDossier(p)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    !isActive ? 'bg-red-50/20 border-red-200' : 'bg-white border-gray-200/90'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0 bg-gray-50"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0 border border-purple-200">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-gray-900 text-sm truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.brand}</div>
                      <div className="text-xs text-purple-700 font-semibold flex items-center gap-1 mt-0.5">
                        <Store className="w-3.5 h-3.5" />
                        <span>{p.storeId?.storeName || 'Merchant Store'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 border-t border-b border-gray-100 mb-3">
                    <span className="text-gray-500">Category: {p.category?.name || 'N/A'}</span>
                    <AdminStatusBadge status={p.status || 'ACTIVE'} size="sm" />
                  </div>

                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => openDelistModal(p)}
                        disabled={isProcessing}
                        className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition"
                      >
                        Delist Listing
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => moderateProduct(p._id, 'ACTIVE', p.name)}
                        disabled={isProcessing}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition"
                      >
                        {isProcessing ? 'Saving...' : 'Restore Listing'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDossier(p)}
                      className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition"
                    >
                      Inspect Dossier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <AdminEmptyState
          icon={Package}
          title={
            statusFilter
              ? `No listings with status "${statusFilter}"`
              : categoryFilter
              ? 'No products found in this category'
              : 'No catalog listings found'
          }
          description={
            search
              ? `No products matched the search keyword "${search}".`
              : 'Try clearing your active filters to review all marketplace listings.'
          }
          actionLabel={statusFilter || categoryFilter || search ? 'Reset Filters' : undefined}
          onAction={() => {
            setSearch('');
            setStatusFilter('');
            setCategoryFilter('');
          }}
        />
      )}

      {/* 4. PRODUCT MODERATION DOSSIER DRAWER */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="CATALOG MODERATION DOSSIER"
        title={selectedProduct?.name || 'Product Details'}
        subtitle={`Brand: ${selectedProduct?.brand || 'N/A'} • Created on ${formatDate(selectedProduct?.createdAt)}`}
        footerActions={
          selectedProduct ? (
            <>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
              {selectedProduct.status === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    openDelistModal(selectedProduct);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Delist from Marketplace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => moderateProduct(selectedProduct._id, 'ACTIVE', selectedProduct.name)}
                  disabled={actionLoadingId === selectedProduct._id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {actionLoadingId === selectedProduct._id ? 'Restoring...' : 'Restore to Marketplace'}
                </button>
              )}
            </>
          ) : null
        }
      >
        {selectedProduct && (
          <div className="space-y-6 text-xs">
            {/* Status & Discovery Context */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block mb-1">
                  Marketplace Discovery Status
                </span>
                <AdminStatusBadge
                  status={selectedProduct.status || 'ACTIVE'}
                  label={
                    selectedProduct.status === 'ACTIVE'
                      ? 'Live on Marketplace'
                      : selectedProduct.status === 'ARCHIVED'
                      ? 'Delisted / Archived'
                      : selectedProduct.status
                  }
                  size="md"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block font-bold uppercase">Unit Type</span>
                <span className="font-extrabold text-gray-800">
                  {selectedProduct.unit || 'pcs'}
                </span>
              </div>
            </div>

            {/* A. Product Visual & Core Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-700" />
                <span>Product SKU Specifications</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                {selectedProduct.image && (
                  <div className="flex justify-center p-2 bg-gray-50 rounded-xl border border-gray-100">
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="max-h-44 object-contain rounded-lg"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Official Title</span>
                    <span className="font-bold text-gray-900 text-right max-w-xs">{selectedProduct.name}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Brand Name</span>
                    <span className="font-semibold text-gray-800">{selectedProduct.brand}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">SKU / Catalog ID</span>
                    <span className="font-mono text-gray-600 text-[11px]">{selectedProduct._id}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Slug Identifier</span>
                    <span className="font-mono text-gray-600 text-[11px]">{selectedProduct.slug || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* B. Merchant Store Context */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-purple-700" />
                <span>Merchant Store Ownership</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Owning Storefront</span>
                  <span className="font-bold text-gray-900">{selectedProduct.storeId?.storeName || 'Merchant Store'}</span>
                </div>
                {selectedProduct.storeId?.verificationStatus && (
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Merchant Permit Status</span>
                    <span className="font-semibold text-purple-700">{selectedProduct.storeId.verificationStatus}</span>
                  </div>
                )}
                {selectedProduct.sellerId && (
                  <div className="py-2 flex justify-between">
                    <span className="text-gray-500">Seller User ID</span>
                    <span className="font-mono text-gray-600 text-[11px]">{selectedProduct.sellerId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* C. Category Classification */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-700" />
                <span>Taxonomy Classification</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Marketplace Category</span>
                  <span className="font-bold text-gray-900">{selectedProduct.category?.name || 'Unassigned'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Unit of Measurement</span>
                  <span className="font-semibold text-gray-800">{selectedProduct.unit}</span>
                </div>
              </div>
            </div>

            {/* D. Product Description Text */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-700" />
                <span>Product Description</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-gray-700 leading-relaxed font-normal">
                {selectedProduct.description || 'No description provided by merchant.'}
              </div>
            </div>
          </div>
        )}
      </AdminDetailDrawer>

      {/* 5. DELIST CONFIRMATION MODAL */}
      <Modal
        isOpen={delistModalOpen}
        onClose={() => setDelistModalOpen(false)}
        title="Delist Marketplace Product"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600 leading-relaxed">
            You are about to delist and archive <span className="font-bold text-gray-900">{productToDelist?.name}</span> from the live marketplace.
          </p>

          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 font-medium">
            Customers will no longer be able to discover, search for, or add this product to their carts. The seller store will be notified of this catalog status change.
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDelistModalOpen(false)}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => moderateProduct(productToDelist?._id, 'ARCHIVED', productToDelist?.name)}
              disabled={actionLoadingId === productToDelist?._id}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {actionLoadingId === productToDelist?._id ? 'Delisting...' : 'Confirm Delisting'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminProductsPage;
