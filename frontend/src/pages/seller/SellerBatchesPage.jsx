import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  QrCode,
  Layers,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Flame,
  Clock,
  AlertTriangle,
  IndianRupee,
  CheckCircle2,
  X,
  Package,
  Calendar,
  ArrowUpDown,
  Boxes,
  ExternalLink,
} from 'lucide-react';
import { batchService } from '../../services/batchService';
import { productService } from '../../services/productService';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
  RiskIndicator,
} from '../../components/seller';

const batchSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  batchNumber: z.string().min(1, 'Batch / Lot number is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date required'),
  expiryDate: z.string().min(1, 'Expiry date required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1 unit'),
  originalPrice: z.coerce.number().min(0.01, 'Original retail price must be > 0'),
});

export const SellerBatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [serverError, setServerError] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [expiryWindowFilter, setExpiryWindowFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('FEFO_ASC'); // FEFO_ASC | FEFO_DESC | QTY_DESC | DISCOUNT_DESC

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(batchSchema),
  });

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setLoadError('');

      const [bData, pData] = await Promise.all([
        batchService.getBatches({ limit: 100 }),
        productService.getMyProducts({ limit: 100 }).catch(() => productService.getProducts({ limit: 100 })),
      ]);

      const bList = bData?.batches || bData?.data?.batches || (Array.isArray(bData) ? bData : []);
      const pList = pData?.products || pData?.data?.products || (Array.isArray(pData) ? pData : []);

      setBatches(bList);
      setProducts(pList);
    } catch (err) {
      console.error('Failed to load FEFO batches:', err);
      setLoadError('Unable to retrieve inventory lots. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await batchService.createBatch(data);
      setModalOpen(false);
      reset();
      loadData(true);
    } catch (err) {
      setServerError(err.message || 'Failed to register batch in NearExpiry system');
    }
  };

  const handleShowQr = async (batchId) => {
    try {
      const res = await batchService.getBatchQrCode(batchId);
      const data = res?.data || res;
      setQrData(data);
      setQrModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to generate cryptographic QR code');
    }
  };

  // Real Shelf-Life Risk Distribution Counts
  const riskCounts = useMemo(() => {
    return batches.reduce(
      (acc, b) => {
        const days = b.remainingDays !== undefined ? b.remainingDays : 999;
        if (days < 0 || b.status === 'EXPIRED') acc.expired += 1;
        else if (days === 0) acc.today += 1;
        else if (days <= 3 || b.status === 'CRITICAL') acc.critical += 1;
        else if (days <= 7) acc.urgent += 1;
        else if (days <= 15 || b.status === 'APPROACHING_EXPIRY') acc.approaching += 1;
        else acc.safe += 1;
        return acc;
      },
      { today: 0, critical: 0, urgent: 0, approaching: 0, safe: 0, expired: 0 }
    );
  }, [batches]);

  // Active Batches and KPIs
  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.status !== 'EXPIRED' && (b.remainingDays === undefined || b.remainingDays >= 0));
  }, [batches]);

  const totalActiveUnits = useMemo(() => {
    return activeBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  }, [activeBatches]);

  const criticalBatchesCount = riskCounts.today + riskCounts.critical;

  const inventoryValueAtRisk = useMemo(() => {
    return activeBatches
      .filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 7) || b.status === 'CRITICAL')
      .reduce((acc, b) => acc + (b.quantity || 0) * (b.originalPrice || 0), 0);
  }, [activeBatches]);

  const potentialRecoveryValue = useMemo(() => {
    return activeBatches
      .filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 7) || b.status === 'CRITICAL')
      .reduce((acc, b) => acc + (b.quantity || 0) * (b.currentPrice || 0), 0);
  }, [activeBatches]);

  // Filtered & Sorted Batches
  const filteredBatches = useMemo(() => {
    let result = batches.filter((b) => {
      const prodName = (typeof b.productId === 'object' ? b.productId?.name : '') || '';
      const prodBrand = (typeof b.productId === 'object' ? b.productId?.brand : '') || '';
      const batchNo = b.batchNumber || '';

      // Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = prodName.toLowerCase().includes(q);
        const matchBrand = prodBrand.toLowerCase().includes(q);
        const matchLot = batchNo.toLowerCase().includes(q);
        if (!matchTitle && !matchBrand && !matchLot) return false;
      }

      // Product Filter
      if (productFilter !== 'ALL') {
        const prodId = typeof b.productId === 'object' ? b.productId?._id : b.productId;
        if (prodId !== productFilter) return false;
      }

      // Expiry Window Filter
      if (expiryWindowFilter !== 'ALL') {
        const days = b.remainingDays !== undefined ? b.remainingDays : 999;
        const isExp = days < 0 || b.status === 'EXPIRED';

        if (expiryWindowFilter === 'EXPIRED' && !isExp) return false;
        if (expiryWindowFilter === 'TODAY' && (days !== 0 || isExp)) return false;
        if (expiryWindowFilter === 'CRITICAL' && (days < 0 || days > 3 || isExp)) return false;
        if (expiryWindowFilter === 'URGENT' && (days <= 3 || days > 7 || isExp)) return false;
        if (expiryWindowFilter === 'WATCH' && (days <= 7 || days > 15 || isExp)) return false;
        if (expiryWindowFilter === 'SAFE' && (days <= 15 || isExp)) return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (b.status !== statusFilter) return false;
      }

      return true;
    });

    // Sorting Logic
    result.sort((a, b) => {
      if (sortBy === 'FEFO_ASC') {
        // Earliest Expiry First (FEFO Default)
        return new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0);
      }
      if (sortBy === 'FEFO_DESC') {
        return new Date(b.expiryDate || 0) - new Date(a.expiryDate || 0);
      }
      if (sortBy === 'QTY_DESC') {
        return (b.quantity || 0) - (a.quantity || 0);
      }
      if (sortBy === 'DISCOUNT_DESC') {
        const discA = a.discountPercentage || a.appliedDiscountPercent || 0;
        const discB = b.discountPercentage || b.appliedDiscountPercent || 0;
        return discB - discA;
      }
      return 0;
    });

    return result;
  }, [batches, searchTerm, productFilter, expiryWindowFilter, statusFilter, sortBy]);

  // Identify FEFO Priority #1 Batch (Earliest active lot with quantity > 0)
  const fefoPriorityOne = useMemo(() => {
    const candidateBatches = [...activeBatches]
      .filter((b) => (b.quantity || 0) > 0)
      .sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0));

    return candidateBatches[0] || null;
  }, [activeBatches]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setProductFilter('ALL');
    setExpiryWindowFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('FEFO_ASC');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    productFilter !== 'ALL' ||
    expiryWindowFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortBy !== 'FEFO_ASC';

  if (loading) {
    return <LoadingSpinner text="Loading FEFO inventory batches..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <SellerPageHeader
        badge="FEFO INVENTORY CONTROL"
        title="FEFO Batch Center"
        subtitle="Prioritize the inventory that expires first, reduce waste, and rescue more value from every batch."
        showEngineStatus={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Sync batch telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Telemetry</span>
            </button>

            <button
              onClick={() => {
                setServerError('');
                setModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Register Batch</span>
            </button>
          </div>
        }
      />

      {/* 2. Error Banner */}
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

      {/* 3. Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <MerchantStatCard
          label="Active Lots"
          value={activeBatches.length}
          subtext="Under FEFO rotation"
          icon={Layers}
          variant="navy"
        />

        <MerchantStatCard
          label="Units in Lots"
          value={totalActiveUnits.toLocaleString('en-IN')}
          subtext="Available stock"
          icon={Boxes}
          variant="emerald"
        />

        <MerchantStatCard
          label="Critical Batches"
          value={criticalBatchesCount}
          subtext="Expires in ≤ 3 days"
          icon={AlertTriangle}
          variant="rose"
          badge={criticalBatchesCount > 0 ? 'Urgent' : null}
        />

        <MerchantStatCard
          label="Value At Risk"
          value={`₹${Math.round(inventoryValueAtRisk).toLocaleString('en-IN')}`}
          subtext="Lots in ≤ 7d window"
          icon={IndianRupee}
          variant="amber"
        />

        <MerchantStatCard
          label="Potential Recovery"
          value={`₹${Math.round(potentialRecoveryValue).toLocaleString('en-IN')}`}
          subtext="At current dynamic prices"
          icon={Flame}
          variant="emerald"
          badge="Rescue"
        />
      </div>

      {/* 4. FEFO Priority #1 Feature Card (Operational "Sell This First" Recommendation) */}
      {fefoPriorityOne && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                <Flame className="w-3.5 h-3.5" /> FEFO PRIORITY #1 — SELL THIS FIRST
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {fefoPriorityOne.batchNumber}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
              {typeof fefoPriorityOne.productId === 'object'
                ? fefoPriorityOne.productId?.name
                : 'Priority Inventory Lot'}
              {typeof fefoPriorityOne.productId === 'object' && fefoPriorityOne.productId?.brand && (
                <span className="text-slate-400 font-normal text-sm ml-2">
                  ({fefoPriorityOne.productId.brand})
                </span>
              )}
            </h3>

            <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
              <div>
                <span className="text-slate-400">Expires:</span>{' '}
                <strong className="text-white">
                  {new Date(fefoPriorityOne.expiryDate).toLocaleDateString()}
                </strong>{' '}
                <span className="text-rose-400 font-bold">
                  ({fefoPriorityOne.remainingDays === 0
                    ? 'Expires Today!'
                    : `${fefoPriorityOne.remainingDays}d remaining`})
                </span>
              </div>
              <div>•</div>
              <div>
                <span className="text-slate-400">Stock:</span>{' '}
                <strong className="text-white">{fefoPriorityOne.quantity} units</strong>
              </div>
              <div>•</div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Rescue Price:</span>{' '}
                <strong className="text-emerald-400 font-black">
                  ₹{Number(fefoPriorityOne.currentPrice).toFixed(2)}
                </strong>
                {fefoPriorityOne.originalPrice > fefoPriorityOne.currentPrice && (
                  <span className="line-through text-slate-500 text-[11px]">
                    ₹{Number(fefoPriorityOne.originalPrice).toFixed(2)}
                  </span>
                )}
                <span className="text-[10px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                  {fefoPriorityOne.discountPercentage || 0}% OFF
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => handleShowQr(fefoPriorityOne._id)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>View Batch QR</span>
            </button>
            <Link
              to="/seller/orders"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Check Order Queue</span>
            </Link>
          </div>
        </div>
      )}

      {/* 5. Expiry Risk Distribution Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Batch Shelf-Life Risk Spectrum
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              FEFO allocation prioritizes lots from left (critical/expiring today) to right (safe reserve stock).
            </p>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {batches.length} total lots
          </span>
        </div>

        <RiskIndicator mode="distribution" counts={riskCounts} showLabels={true} />
      </div>

      {/* 6. Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by lot number, product name, or brand..."
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

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Product Filter */}
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Products</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Expiry Window Filter */}
            <select
              value={expiryWindowFilter}
              onChange={(e) => setExpiryWindowFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Expiry Windows</option>
              <option value="TODAY">Expiring Today (0d)</option>
              <option value="CRITICAL">Critical (1–3d)</option>
              <option value="URGENT">Urgent (4–7d)</option>
              <option value="WATCH">Watch (8–15d)</option>
              <option value="SAFE">Safe (16+d)</option>
              <option value="EXPIRED">Expired</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="NORMAL">Normal</option>
              <option value="APPROACHING_EXPIRY">Approaching</option>
              <option value="CRITICAL">Critical</option>
              <option value="EXPIRED">Expired</option>
            </select>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="FEFO_ASC">FEFO: Earliest Expiry First</option>
              <option value="FEFO_DESC">Latest Expiry First</option>
              <option value="QTY_DESC">Highest Quantity</option>
              <option value="DISCOUNT_DESC">Highest Markdown %</option>
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

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Displaying <strong className="text-slate-900">{filteredBatches.length}</strong> of{' '}
            <strong className="text-slate-900">{batches.length}</strong> inventory lots
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] text-emerald-600 font-semibold">
              Filters applied
            </span>
          )}
        </div>
      </div>

      {/* 7. FEFO Batches Data Presentation (Desktop Table + Mobile Cards) */}
      {filteredBatches.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Desktop & Tablet Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">FEFO Priority</th>
                  <th className="py-3.5 px-4">Product & Brand</th>
                  <th className="py-3.5 px-4">Lot Number</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4">Remaining Shelf Life</th>
                  <th className="py-3.5 px-4">Available Units</th>
                  <th className="py-3.5 px-4">Rescue Pricing</th>
                  <th className="py-3.5 px-4 text-right">Batch QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredBatches.map((b, idx) => {
                  const prodName = typeof b.productId === 'object' ? b.productId?.name : 'Product';
                  const prodBrand = typeof b.productId === 'object' ? b.productId?.brand : '';
                  const isFirstPriority = idx === 0 && sortBy === 'FEFO_ASC' && b.quantity > 0 && b.status !== 'EXPIRED';

                  return (
                    <tr
                      key={b._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isFirstPriority ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Priority Rank */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black ${
                            isFirstPriority
                              ? 'bg-rose-500 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>

                      {/* Product Name & Brand */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 text-sm">{prodName}</div>
                          {prodBrand && (
                            <div className="text-slate-500 text-[11px] font-medium">{prodBrand}</div>
                          )}
                        </div>
                      </td>

                      {/* Batch Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {b.batchNumber}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4 text-slate-700">
                        {new Date(b.expiryDate).toLocaleDateString()}
                      </td>

                      {/* Remaining Shelf Life */}
                      <td className="py-3.5 px-4">
                        <RiskIndicator mode="single" days={b.remainingDays} status={b.status} />
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {b.quantity}{' '}
                          <span className="text-slate-500 font-normal text-xs">units</span>
                        </div>
                      </td>

                      {/* Pricing */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>₹{Number(b.currentPrice).toFixed(2)}</span>
                            {b.originalPrice > b.currentPrice && (
                              <span className="text-[11px] text-slate-400 line-through">
                                ₹{Number(b.originalPrice).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {b.discountPercentage > 0 && (
                            <div className="text-[10px] font-bold text-emerald-600">
                              {b.discountPercentage}% dynamic discount
                            </div>
                          )}
                        </div>
                      </td>

                      {/* QR Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleShowQr(b._id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          title="Generate / View Cryptographic QR"
                        >
                          <QrCode className="w-4 h-4 text-emerald-700" />
                          <span className="hidden lg:inline text-[11px] font-bold">QR</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredBatches.map((b, idx) => {
              const prodName = typeof b.productId === 'object' ? b.productId?.name : 'Product';
              const prodBrand = typeof b.productId === 'object' ? b.productId?.brand : '';
              const isFirstPriority = idx === 0 && sortBy === 'FEFO_ASC' && b.quantity > 0 && b.status !== 'EXPIRED';

              return (
                <div
                  key={b._id}
                  className={`p-4 space-y-3 ${isFirstPriority ? 'bg-emerald-50/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            isFirstPriority ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          FEFO #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600">
                          {b.batchNumber}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{prodName}</h4>
                      {prodBrand && <div className="text-xs text-slate-500">{prodBrand}</div>}
                    </div>

                    <RiskIndicator mode="single" days={b.remainingDays} status={b.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Available Stock</span>
                      <span className="font-bold text-slate-900">{b.quantity} units</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Expiry Date</span>
                      <span className="font-bold text-slate-900">
                        {new Date(b.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Dynamic Price</span>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>₹{Number(b.currentPrice).toFixed(2)}</span>
                        {b.originalPrice > b.currentPrice && (
                          <span className="text-[10px] text-slate-400 line-through">
                            ₹{Number(b.originalPrice).toFixed(2)}
                          </span>
                        )}
                        {b.discountPercentage > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600">
                            ({b.discountPercentage}% OFF)
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleShowQr(b._id)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>View QR</span>
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
            <Layers className="w-6 h-6" />
          </div>
          {hasActiveFilters ? (
            <div>
              <h3 className="text-base font-bold text-slate-900">No matching inventory lots</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No batches match your selected search query or expiry window filters.
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
              <h3 className="text-base font-bold text-slate-900">No active batches registered</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Register your first physical lot to enable automated FEFO allocation and shelf-life markdowns.
              </p>
              <button
                onClick={() => {
                  setServerError('');
                  setModalOpen(true);
                }}
                className="mt-4 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Register First Batch</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. Register Batch Modal (Preserving all fields and validation) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register New FEFO Batch"
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
              Catalog Product <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('productId')}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              <option value="">Select Catalog Item</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.brand ? `(${p.brand})` : ''}
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="text-rose-600 mt-1 font-semibold">{errors.productId.message}</p>
            )}
            {products.length === 0 && (
              <div className="mt-1.5 p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                <span>No master catalog items registered yet.</span>
                <Link to="/seller/products" className="font-bold underline text-amber-950">
                  + Add Product First
                </Link>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Lot / Batch Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('batchNumber')}
              placeholder="e.g. LOT-2026-OCT-01"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {errors.batchNumber && (
              <p className="text-rose-600 mt-1 font-semibold">{errors.batchNumber.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Manufacturing Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                {...register('manufacturingDate')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.manufacturingDate && (
                <p className="text-rose-600 mt-1 font-semibold">{errors.manufacturingDate.message}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Expiry / Best Before <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                {...register('expiryDate')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.expiryDate && (
                <p className="text-rose-600 mt-1 font-semibold">{errors.expiryDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Quantity (Units) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                {...register('quantity')}
                placeholder="20"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.quantity && (
                <p className="text-rose-600 mt-1 font-semibold">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Original Retail Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('originalPrice')}
                placeholder="100.00"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              {errors.originalPrice && (
                <p className="text-rose-600 mt-1 font-semibold">{errors.originalPrice.message}</p>
              )}
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl text-amber-900 text-[11px] border border-amber-200">
            ℹ️ NearExpiry's dynamic discount engine will automatically compute progressive price discounts based on remaining calendar days.
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
              {isSubmitting ? 'Registering...' : 'Register Batch in MongoDB'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Cryptographic Batch QR Code Modal (100% Preserved) */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Cryptographic Batch QR Code"
      >
        {qrData && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl inline-block shadow-inner">
              <img
                src={qrData.qrCodeDataUrl || qrData.qrDataUrl}
                alt="Batch QR Code"
                className="w-56 h-56 mx-auto"
              />
            </div>

            <div className="text-left text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div>
                <span className="font-bold text-slate-700">Batch Number:</span>{' '}
                <span className="font-mono text-slate-900">{qrData.batchNumber}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Expiry Date:</span>{' '}
                <span className="text-slate-900">
                  {new Date(qrData.expiryDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Verification Nonce:</span>{' '}
                <code className="text-slate-600 font-mono text-[10px] break-all">
                  {qrData.nonce || qrData.tokenNonce}
                </code>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold pt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Live server verification required upon customer scanning.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
