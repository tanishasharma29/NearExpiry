import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Package,
  AlertCircle,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  X,
  Boxes,
  IndianRupee,
} from 'lucide-react';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { batchService } from '../../services/batchService';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
  RiskIndicator,
} from '../../components/seller';

const productSchema = z.object({
  name: z.string().min(2, 'Product title must be at least 2 characters'),
  description: z.string().min(5, 'Description is required (minimum 5 characters)'),
  brand: z.string().min(1, 'Brand name is required'),
  category: z.string().min(1, 'Please select a product category'),
  unit: z.enum(['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle']),
  packageSize: z.string().optional(),
});

export const SellerProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [serverError, setServerError] = useState('');

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit: 'pack',
      packageSize: '1 pc',
    },
  });

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setLoadError('');

      const [prodData, catData, batchData] = await Promise.all([
        productService.getMyProducts({ limit: 100 }).catch(() => productService.getProducts({ limit: 100 })),
        categoryService.getCategories({ status: 'ACTIVE', limit: 100 }).catch(() => ({ categories: [] })),
        batchService.getBatches().catch(() => ({ batches: [] })),
      ]);

      const pList = prodData?.products || prodData?.data?.products || (Array.isArray(prodData) ? prodData : []);
      const cList = catData?.categories || catData?.data?.categories || (Array.isArray(catData) ? catData : []);
      const bList = batchData?.batches || (Array.isArray(batchData) ? batchData : []);

      setProducts(pList);
      setCategories(cList);
      setBatches(bList);
    } catch (err) {
      console.error('Failed to load catalog data:', err);
      setLoadError('Unable to load your product catalog. Please verify your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map batches by product ID for real stock and nearest expiry calculations
  const productMetricsMap = useMemo(() => {
    const map = new Map();

    batches.forEach((b) => {
      const prodId = typeof b.productId === 'object' ? b.productId?._id : b.productId;
      if (!prodId) return;

      if (!map.has(prodId)) {
        map.set(prodId, {
          activeBatches: [],
          totalStock: 0,
        });
      }

      const item = map.get(prodId);
      if (b.status !== 'EXPIRED' && (b.remainingDays === undefined || b.remainingDays >= 0)) {
        item.activeBatches.push(b);
        item.totalStock += b.quantity || 0;
      }
    });

    return map;
  }, [batches]);

  // Enrich products with inventory & shelf-life health
  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const metrics = productMetricsMap.get(p._id) || { activeBatches: [], totalStock: 0 };
      const activeBatches = metrics.activeBatches;

      // Sort batches by earliest expiry
      const sortedBatches = [...activeBatches].sort((a, b) => {
        return new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0);
      });

      const nearestBatch = sortedBatches[0] || null;
      const nearestDays = nearestBatch?.remainingDays !== undefined ? nearestBatch.remainingDays : null;
      const nearestExpiryDate = nearestBatch?.expiryDate ? new Date(nearestBatch.expiryDate) : null;

      // Determine product health status
      let health = 'HEALTHY';
      let healthLabel = 'Healthy';
      let healthVariant = 'emerald';

      if (activeBatches.length === 0) {
        health = 'NO_BATCH';
        healthLabel = 'No Active Lots';
        healthVariant = 'default';
      } else if (nearestDays !== null && nearestDays <= 3) {
        health = 'CRITICAL';
        healthLabel = 'Critical (≤3d)';
        healthVariant = 'rose';
      } else if (nearestDays !== null && nearestDays <= 7) {
        health = 'AT_RISK';
        healthLabel = 'At Risk (4–7d)';
        healthVariant = 'amber';
      } else if (nearestDays !== null && nearestDays <= 15) {
        health = 'WATCH';
        healthLabel = 'Watch (8–15d)';
        healthVariant = 'amber';
      }

      return {
        ...p,
        totalStock: metrics.totalStock,
        activeBatchCount: activeBatches.length,
        nearestBatch,
        nearestDays,
        nearestExpiryDate,
        health,
        healthLabel,
        healthVariant,
      };
    });
  }, [products, productMetricsMap]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return enrichedProducts.filter((p) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const catName = (typeof p.category === 'object' ? p.category?.name : '') || '';
        const matchTitle = p.name?.toLowerCase().includes(query);
        const matchBrand = p.brand?.toLowerCase().includes(query);
        const matchCat = catName.toLowerCase().includes(query);
        if (!matchTitle && !matchBrand && !matchCat) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        const catId = typeof p.category === 'object' ? p.category?._id : p.category;
        if (catId !== categoryFilter) return false;
      }

      // Health filter
      if (healthFilter !== 'ALL') {
        if (p.health !== healthFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (p.status !== statusFilter) return false;
      }

      return true;
    });
  }, [enrichedProducts, searchTerm, categoryFilter, healthFilter, statusFilter]);

  // Aggregate Catalog KPIs
  const totalProductsCount = enrichedProducts.length;
  const activeProductsCount = enrichedProducts.filter((p) => p.status === 'ACTIVE').length;
  const withActiveBatchesCount = enrichedProducts.filter((p) => p.activeBatchCount > 0).length;
  const atRiskProductsCount = enrichedProducts.filter(
    (p) => p.health === 'CRITICAL' || p.health === 'AT_RISK'
  ).length;

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setServerError('');
    setModalMode('CREATE');
    setSelectedProduct(null);
    reset({
      name: '',
      description: '',
      brand: '',
      category: '',
      unit: 'pack',
      packageSize: '1 pc',
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p) => {
    setServerError('');
    setModalMode('EDIT');
    setSelectedProduct(p);
    const catId = typeof p.category === 'object' ? p.category?._id : p.category;
    reset({
      name: p.name || '',
      description: p.description || '',
      brand: p.brand || '',
      category: catId || '',
      unit: p.unit || 'pack',
      packageSize: p.packageSize || '',
    });
    setModalOpen(true);
  };

  // Delete Product Handler
  const handleDeleteProduct = async (p) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove "${p.name}" from your catalog?`
    );
    if (!confirmDelete) return;

    try {
      await productService.deleteProduct(p._id);
      loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Submit Handler
  const onSubmit = async (data) => {
    try {
      setServerError('');
      if (modalMode === 'CREATE') {
        await productService.createProduct(data);
      } else if (modalMode === 'EDIT' && selectedProduct?._id) {
        await productService.updateProduct(selectedProduct._id, data);
      }
      setModalOpen(false);
      reset();
      loadData(true);
    } catch (err) {
      setServerError(err.message || 'Failed to save product in catalog');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setHealthFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    categoryFilter !== 'ALL' ||
    healthFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  if (loading) {
    return <LoadingSpinner text="Retrieving store product catalog..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header with Actions */}
      <SellerPageHeader
        badge="INVENTORY CONTROL"
        title="Product Catalog"
        subtitle="Manage your store master SKUs and monitor inventory levels, active lots, and nearest expiry dates."
        showEngineStatus={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Refresh catalog data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Product</span>
            </button>
          </div>
        }
      />

      {/* 2. Error Alert (if any) */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={() => loadData(true)}
            className="font-bold underline text-rose-950 hover:text-rose-700 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Catalog KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <MerchantStatCard
          label="Total Products"
          value={totalProductsCount}
          subtext="Master catalog items"
          icon={Package}
          variant="navy"
        />

        <MerchantStatCard
          label="Active Status"
          value={activeProductsCount}
          subtext="Available for store selling"
          icon={CheckCircle2}
          variant="emerald"
        />

        <MerchantStatCard
          label="With Active Lots"
          value={withActiveBatchesCount}
          subtext={`${totalProductsCount - withActiveBatchesCount} lots pending setup`}
          icon={Boxes}
          variant="sky"
        />

        <MerchantStatCard
          label="Products At Risk"
          value={atRiskProductsCount}
          subtext="Lots expiring in ≤ 7 days"
          icon={AlertTriangle}
          variant="rose"
          badge={atRiskProductsCount > 0 ? 'Urgent' : null}
        />
      </div>

      {/* 4. Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, brand, or category..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Shelf-Life Health Filter */}
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Shelf-Life States</option>
              <option value="HEALTHY">🟢 Healthy (15+d)</option>
              <option value="WATCH">🟡 Watch (8–15d)</option>
              <option value="AT_RISK">🟠 At Risk (4–7d)</option>
              <option value="CRITICAL">🔴 Critical (≤3d)</option>
              <option value="NO_BATCH">⚪ No Active Lots</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results Count Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-900">{filteredProducts.length}</strong> of{' '}
            <strong className="text-slate-900">{totalProductsCount}</strong> catalog products
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] text-emerald-600 font-semibold">
              Filters active
            </span>
          )}
        </div>
      </div>

      {/* 5. Products Presentation: Desktop Data Table & Mobile Cards */}
      {filteredProducts.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Desktop & Tablet Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Product & Brand</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Inventory Health</th>
                  <th className="py-3.5 px-4">Current Stock</th>
                  <th className="py-3.5 px-4">Nearest Expiry</th>
                  <th className="py-3.5 px-4">Rescue Pricing</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProducts.map((p) => {
                  const catName = typeof p.category === 'object' ? p.category?.name : (categories.find(c => c._id === p.category)?.name || 'Category');
                  const nearestBatch = p.nearestBatch;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Product Name & Brand */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                            {p.name}
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                            {p.brand && (
                              <span className="font-semibold text-slate-700">{p.brand}</span>
                            )}
                            {p.packageSize && <span>• {p.packageSize}</span>}
                            <span>• ({p.unit})</span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {catName}
                        </span>
                      </td>

                      {/* Health Status */}
                      <td className="py-3.5 px-4">
                        {p.health === 'NO_BATCH' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            No Active Lots
                          </span>
                        ) : (
                          <StatusBadge
                            status={p.health === 'AT_RISK' ? 'URGENT' : p.health}
                            label={p.healthLabel}
                            size="sm"
                          />
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-black text-slate-900 text-xs">
                            {p.totalStock} <span className="font-normal text-slate-500">units</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {p.activeBatchCount > 0 ? (
                              <span>{p.activeBatchCount} {p.activeBatchCount === 1 ? 'active lot' : 'active lots'}</span>
                            ) : (
                              <span className="text-amber-600 font-semibold">0 lots</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Nearest Expiry */}
                      <td className="py-3.5 px-4">
                        {nearestBatch ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-900 font-bold">
                              {p.nearestExpiryDate ? p.nearestExpiryDate.toLocaleDateString() : '—'}
                            </div>
                            <div className="text-[11px]">
                              {p.nearestDays !== null && (
                                <RiskIndicator mode="single" days={p.nearestDays} />
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Rescue Price */}
                      <td className="py-3.5 px-4">
                        {nearestBatch?.currentPrice !== undefined ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>₹{Number(nearestBatch.currentPrice).toFixed(2)}</span>
                              {nearestBatch.originalPrice && nearestBatch.originalPrice > nearestBatch.currentPrice && (
                                <span className="text-[11px] text-slate-400 line-through">
                                  ₹{Number(nearestBatch.originalPrice).toFixed(2)}
                                </span>
                              )}
                            </div>
                            {nearestBatch.appliedDiscountPercent > 0 && (
                              <div className="text-[10px] font-bold text-emerald-600">
                                {nearestBatch.appliedDiscountPercent}% dynamic discount
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to="/seller/batches"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Register / View Batches"
                          >
                            <Layers className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredProducts.map((p) => {
              const catName = typeof p.category === 'object' ? p.category?.name : (categories.find(c => c._id === p.category)?.name || 'Category');
              const nearestBatch = p.nearestBatch;

              return (
                <div key={p._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        {p.brand} • {catName}
                      </div>
                    </div>
                    <div>
                      {p.health === 'NO_BATCH' ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          No Lots
                        </span>
                      ) : (
                        <StatusBadge
                          status={p.health === 'AT_RISK' ? 'URGENT' : p.health}
                          label={p.healthLabel}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Stock</span>
                      <span className="font-bold text-slate-900">{p.totalStock} units</span>
                      <span className="text-slate-500 text-[10px] block">({p.activeBatchCount} active lots)</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Nearest Expiry</span>
                      {nearestBatch ? (
                        <div>
                          <div className="font-bold text-slate-900">
                            {p.nearestExpiryDate ? p.nearestExpiryDate.toLocaleDateString() : '—'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {p.nearestDays !== null ? `${p.nearestDays}d remaining` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  {nearestBatch?.currentPrice !== undefined && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500">Current Price:</span>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>₹{Number(nearestBatch.currentPrice).toFixed(2)}</span>
                        {nearestBatch.originalPrice > nearestBatch.currentPrice && (
                          <span className="text-[10px] text-slate-400 line-through">
                            ₹{Number(nearestBatch.originalPrice).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <Link
                      to="/seller/batches"
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg text-xs flex items-center gap-1 transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Manage Lots</span>
                    </Link>
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty States */
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          {hasActiveFilters ? (
            <div>
              <h3 className="text-base font-bold text-slate-900">No matching catalog products</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No products match your current search query or filter selection.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-bold text-slate-900">No products in your catalog yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Add your first master product SKU to begin registering inventory lots and automated dynamic discounts.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add First Product</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'CREATE' ? 'Add Master Catalog Product' : 'Edit Catalog Product'}
      >
        {serverError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Product Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Organic Cow Milk 1L"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.name && <p className="text-rose-600 mt-1 font-semibold">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Brand Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('brand')}
                placeholder="e.g. Amul"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.brand && <p className="text-rose-600 mt-1 font-semibold">{errors.brand.message}</p>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('category')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-rose-600 mt-1 font-semibold">{errors.category.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Unit Type <span className="text-rose-500">*</span>
              </label>
              <select
                {...register('unit')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="pack">pack</option>
                <option value="pcs">pcs</option>
                <option value="bottle">bottle</option>
                <option value="box">box</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Package Size (Optional)
              </label>
              <input
                type="text"
                {...register('packageSize')}
                placeholder="e.g. 500g, 1L"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              {...register('description')}
              placeholder="Product details, ingredients, storage requirements..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.description && (
              <p className="text-rose-600 mt-1 font-semibold">{errors.description.message}</p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting
                ? modalMode === 'CREATE' ? 'Creating...' : 'Updating...'
                : modalMode === 'CREATE' ? 'Save Catalog Product' : 'Update Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
