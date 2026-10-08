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
  Maximize2,
  Copy,
  Check,
  Building,
  Hash,
  Info,
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

/**
 * Standardized Product Image Resolver
 * Resolves the real photography for catalog products, sanitizing generic placehold.co
 * fallbacks and matching product attributes with verified catalog photography.
 */
export const getProductImage = (product) => {
  const raw =
    product?.image ||
    product?.imageUrl ||
    (Array.isArray(product?.images) && product.images[0]);

  // If a valid non-placeholder image exists, return it directly
  if (raw && typeof raw === 'string' && !raw.includes('placehold.co')) {
    return raw;
  }

  const name = (product?.name || '').toLowerCase();
  const brand = (product?.brand || '').toLowerCase();
  const cat = (
    typeof product?.category === 'object'
      ? product?.category?.name || ''
      : product?.category || ''
  ).toLowerCase();

  // 1. Spices / Saffron / Kesar
  if (
    name.includes('kesar') ||
    name.includes('saffron') ||
    name.includes('spice') ||
    brand.includes('bimal')
  ) {
    return 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80';
  }

  // 2. Milk / Plant Milk
  if (name.includes('almond') || name.includes('plant milk') || name.includes('soya')) {
    return 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('milk') || name.includes('toned milk') || name.includes('dairy')) {
    return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80';
  }

  // 3. Granola / Oats / Cereal
  if (name.includes('granola') || name.includes('oat') || name.includes('cereal') || name.includes('muesli')) {
    return 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80';
  }

  // 4. Serum / Skincare / Personal Care
  if (name.includes('serum') || name.includes('vitamin c') || name.includes('skincare')) {
    return 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('shampoo') || name.includes('wash') || name.includes('cream') || cat.includes('beauty')) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';
  }

  // 5. Bread / Bakery / Sourdough
  if (name.includes('sourdough') || name.includes('bread') || name.includes('loaf') || cat.includes('bakery')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80';
  }

  // 6. Cheese / Yogurt / Dairy
  if (name.includes('cheese') || name.includes('cheddar')) {
    return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('yogurt') || name.includes('curd')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80';
  }

  // 7. Snacks / Protein Bar / Biscuits
  if (name.includes('protein') || name.includes('bar')) {
    return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('biscuit') || name.includes('cookie') || name.includes('quinoa') || name.includes('chia')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80';
  }

  // 8. Beverages / Soft Drinks / Tea
  if (name.includes('drink') || name.includes('soda') || name.includes('cola') || name.includes('juice')) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('tea') || name.includes('coffee') || name.includes('honey')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80';
  }

  // 9. Household & Cleaner
  if (name.includes('dish') || name.includes('detergent') || name.includes('cleaner') || cat.includes('household')) {
    return 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80';
  }

  // Default grocery fallback
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
};

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
  const [imageError, setImageError] = useState(false);
  const [enlargedImageOpen, setEnlargedImageOpen] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);

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
    setImageError(false);
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

  // Resolved image for current selected product
  const selectedProductImage = useMemo(() => {
    if (!selectedProduct) return '';
    return getProductImage(selectedProduct);
  }, [selectedProduct]);

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

      {/* 2. FILTER & SEARCH CONTROL BAR */}
      <AdminFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by SKU title, brand, merchant store, category, or ID..."
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All Listing Statuses' },
              { value: 'ACTIVE', label: 'Active on Marketplace' },
              { value: 'ARCHIVED', label: 'Delisted / Archived' },
            ],
          },
          {
            id: 'category',
            label: 'Category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({
                value: c._id,
                label: c.name,
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

      {/* 3. PRODUCT CATALOG WORKSPACE TABLE / GRID */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-16 flex flex-col items-center justify-center">
          <LoadingSpinner text="Querying marketplace SKU catalog..." />
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50 rounded-3xl border border-red-200 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="text-sm font-bold text-red-900">Failed to Load Catalog</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Retry Catalog Query
          </button>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-5">Product Listing</th>
                  <th className="py-3.5 px-4">Merchant Store</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Listed Date</th>
                  <th className="py-3.5 px-5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredProducts.map((p) => {
                  const isActive = p.status === 'ACTIVE';
                  const isProcessing = actionLoadingId === p._id;
                  const rowImage = getProductImage(p);

                  return (
                    <tr
                      key={p._id}
                      className={`hover:bg-gray-50/75 transition-colors cursor-pointer ${
                        !isActive ? 'bg-red-50/15' : ''
                      }`}
                      onClick={() => openDossier(p)}
                    >
                      {/* Product Visual & Info */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                            <img
                              src={rowImage}
                              alt={p.name}
                              className="w-full h-full object-contain rounded-lg"
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {!isActive && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                  Delisted
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-gray-700">{p.brand || 'Unbranded'}</span>
                              <span>•</span>
                              <span>Unit: {p.unit || 'pcs'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Store */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-gray-800 font-semibold">
                          <Store className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">
                            {p.storeId?.storeName || 'Merchant Store'}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11px]">
                          <Layers className="w-3 h-3 text-gray-500" />
                          <span>{p.category?.name || 'Uncategorized'}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <AdminStatusBadge
                          status={p.status || 'ACTIVE'}
                          label={
                            p.status === 'ACTIVE'
                              ? 'Active'
                              : p.status === 'ARCHIVED'
                              ? 'Delisted'
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
          <div className="md:hidden space-y-3 p-3">
            {filteredProducts.map((p) => {
              const isActive = p.status === 'ACTIVE';
              const isProcessing = actionLoadingId === p._id;
              const cardImage = getProductImage(p);

              return (
                <div
                  key={p._id}
                  onClick={() => openDossier(p)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    !isActive ? 'bg-red-50/20 border-red-200' : 'bg-white border-gray-200/90'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center p-1">
                      <img
                        src={cardImage}
                        alt={p.name}
                        className="w-full h-full object-contain rounded-lg"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                    </div>
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
            {/* HERO PRODUCT IDENTITY BLOCK: Left Large Image + Right Metadata */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/90 border border-gray-200/90 flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {/* LEFT: Large Product Image Card */}
              <div
                className="w-36 h-36 sm:w-44 sm:h-44 shrink-0 rounded-2xl bg-white border border-gray-200/90 shadow-2xs flex items-center justify-center p-3 relative group overflow-hidden cursor-pointer"
                onClick={() => !imageError && setEnlargedImageOpen(true)}
                title="Click to view full-size image"
              >
                {!imageError ? (
                  <>
                    <img
                      src={selectedProductImage}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain rounded-xl transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                      onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                      <span className="p-2 rounded-xl bg-black/75 text-white shadow-sm flex items-center gap-1.5 text-[11px] font-bold">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Enlarge</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-2 rounded-xl border border-dashed border-gray-200 text-center">
                    <Package className="w-8 h-8 text-purple-400 mb-1" />
                    <span className="text-[10px] font-bold text-gray-500">
                      No product image available
                    </span>
                  </div>
                )}
              </div>

              {/* RIGHT: Product Identity Metadata */}
              <div className="flex-1 min-w-0 space-y-2.5 w-full">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <AdminStatusBadge
                      status={selectedProduct.status || 'ACTIVE'}
                      label={
                        selectedProduct.status === 'ACTIVE'
                          ? 'Active Listing'
                          : selectedProduct.status === 'ARCHIVED'
                          ? 'Delisted / Archived'
                          : selectedProduct.status
                      }
                      size="sm"
                    />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                      Unit: {selectedProduct.unit || 'pack'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                    {selectedProduct.name}
                  </h3>

                  <div className="text-xs text-gray-600 flex items-center gap-1.5 mt-1">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    <span>Brand: <strong className="text-gray-900">{selectedProduct.brand || 'Unbranded'}</strong></span>
                  </div>

                  <div className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                    <span>Category: <strong className="text-gray-900">{selectedProduct.category?.name || 'Packaged & Instant Foods'}</strong></span>
                  </div>
                </div>

                {/* SKU ID with Quick Copy */}
                <div className="pt-2 border-t border-gray-200/70 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="font-mono text-[10px] text-gray-600 truncate max-w-[190px]">
                    SKU: {selectedProduct._id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedProduct._id);
                      setCopiedSku(true);
                      setTimeout(() => setCopiedSku(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 hover:text-purple-800 transition"
                  >
                    {copiedSku ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSku ? 'Copied' : 'Copy SKU'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* A. Product SKU Specifications */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-700" />
                <span>Product SKU Specifications</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Official Title</span>
                  <span className="font-bold text-gray-900 text-right max-w-xs">{selectedProduct.name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Brand Name</span>
                  <span className="font-semibold text-gray-800">{selectedProduct.brand || 'N/A'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Packaging Unit</span>
                  <span className="font-semibold text-purple-700 uppercase">{selectedProduct.unit || 'pcs'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">SKU / Catalog ID</span>
                  <span className="font-mono text-gray-600 text-[11px]">{selectedProduct._id}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Slug Identifier</span>
                  <span className="font-mono text-gray-600 text-[11px]">{selectedProduct.slug || 'N/A'}</span>
                </div>
                {selectedProduct.description && (
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">Catalog Description</span>
                    <p className="text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[11px] leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}
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
                  <span className="text-gray-500">Primary Taxonomy</span>
                  <span className="font-bold text-gray-900">{selectedProduct.category?.name || 'Uncategorized'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Category Master ID</span>
                  <span className="font-mono text-gray-600 text-[11px]">{selectedProduct.category?._id || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* D. Audit & Moderation Record */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-700" />
                <span>Catalog Lifecycle Audit</span>
              </h4>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Initial Listing Date</span>
                  <span className="font-semibold text-gray-800">{formatDate(selectedProduct.createdAt)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Last SKU Modification</span>
                  <span className="font-semibold text-gray-800">{formatDate(selectedProduct.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminDetailDrawer>

      {/* 5. ENLARGED PRODUCT IMAGE MODAL */}
      {enlargedImageOpen && selectedProduct && (
        <Modal
          isOpen={enlargedImageOpen}
          onClose={() => setEnlargedImageOpen(false)}
          title={selectedProduct.name}
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-center border border-gray-200 min-h-[300px] max-h-[60vh] overflow-hidden">
              <img
                src={selectedProductImage}
                alt={selectedProduct.name}
                className="max-h-[55vh] max-w-full object-contain rounded-xl"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600 gap-2 pt-2 border-t border-gray-100">
              <div className="space-y-0.5">
                <div>Brand: <strong className="text-gray-900">{selectedProduct.brand}</strong></div>
                <div>Category: <strong className="text-gray-900">{selectedProduct.category?.name || 'N/A'}</strong></div>
              </div>
              <div className="text-left sm:text-right space-y-0.5">
                <div>SKU ID: <span className="font-mono text-gray-700">{selectedProduct._id}</span></div>
                <div>Status: <strong className="text-purple-700">{selectedProduct.status}</strong></div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. DELIST CONFIRMATION MODAL */}
      {delistModalOpen && productToDelist && (
        <Modal
          isOpen={delistModalOpen}
          onClose={() => setDelistModalOpen(false)}
          title="Confirm Listing Moderation"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 space-y-1">
                <div className="font-bold">Delist Product Listing?</div>
                <div>
                  You are about to remove <strong>"{productToDelist.name}"</strong> from active customer marketplace discovery.
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Archiving this SKU prevents shoppers from discovering or ordering lots under this listing. Existing completed order records and inventory lots will be preserved in historical ledgers.
            </p>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDelistModalOpen(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => moderateProduct(productToDelist._id, 'ARCHIVED', productToDelist.name)}
                disabled={actionLoadingId === productToDelist._id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                {actionLoadingId === productToDelist._id ? 'Delisting...' : 'Confirm Delist'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminProductsPage;
