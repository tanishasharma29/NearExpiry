import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Sliders,
  RefreshCw,
  RotateCcw,
  Plus,
  AlertCircle,
  Play,
  CheckCircle2,
  Tag,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  Search,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Percent,
  ChevronRight,
  X,
  Info,
  Power,
  AlertTriangle,
  Calculator,
  Flame,
  CheckCheck,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import api from '../../api/client';
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

export const AdminPricingPage = () => {
  // Master Rules State
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filtering
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [sortBy, setSortBy] = useState('priority-desc');

  // Selected Rule Inspection Dossier (Drawer)
  const [selectedRule, setSelectedRule] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sweep & Engine Operation States
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    minDays: '',
    maxDays: '',
    isUnbounded: false,
    discountPercentage: '',
    categoryId: '',
    priority: 1,
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Action status / Feedback
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Simulation State
  const [simInput, setSimInput] = useState({
    originalPrice: 100,
    remainingDays: 14,
    categoryId: '',
    quantity: 1,
  });
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  // Auto-dismiss feedback message after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Fetch Pricing Rules & Categories
  const fetchRules = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Prefer populated /pricing/rules endpoint, fallback to /admin/pricing-rules
      const [rulesRes, categoriesRes] = await Promise.allSettled([
        api.get('/pricing/rules').catch(() => adminService.getPricingRules()),
        categoryService.getCategories().catch(() => []),
      ]);

      if (rulesRes.status === 'fulfilled') {
        const payload = rulesRes.value;
        const list = Array.isArray(payload)
          ? payload
          : payload?.rules || payload?.data?.rules || [];
        setRules(list);

        // Keep drawer selected rule in sync
        if (selectedRule) {
          const updated = list.find((r) => r._id === selectedRule._id);
          if (updated) setSelectedRule(updated);
        }
      } else {
        throw rulesRes.reason || new Error('Failed to retrieve pricing rules');
      }

      if (categoriesRes.status === 'fulfilled') {
        const catPayload = categoriesRes.value;
        const catList = Array.isArray(catPayload)
          ? catPayload
          : catPayload?.categories || catPayload?.data || [];
        setCategories(catList);
      }
    } catch (err) {
      console.error('Pricing rules fetch error:', err);
      setError(err?.message || 'Failed to connect to pricing engine service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRule]);

  useEffect(() => {
    fetchRules();
  }, []);

  // Copy helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Rule Metrics (Contextual summaries based on real backend data)
  const metrics = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.isActive).length;
    const inactive = rules.filter((r) => !r.isActive).length;
    const globalCount = rules.filter((r) => !r.categoryId).length;
    const categoryCount = rules.filter((r) => Boolean(r.categoryId)).length;
    const maxDiscount = rules.reduce((max, r) => Math.max(max, r.discountPercentage || 0), 0);

    return { total, active, inactive, globalCount, categoryCount, maxDiscount };
  }, [rules]);

  // Filtered and Sorted Rules
  const filteredRules = useMemo(() => {
    return rules
      .filter((r) => {
        // Status Filter
        if (statusFilter === 'ACTIVE' && !r.isActive) return false;
        if (statusFilter === 'INACTIVE' && r.isActive) return false;

        // Scope Filter
        if (scopeFilter === 'GLOBAL' && r.categoryId) return false;
        if (scopeFilter === 'CATEGORY' && !r.categoryId) return false;

        // Search Filter (by rule name or ID)
        if (search.trim()) {
          const query = search.trim().toLowerCase();
          const matchName = r.name?.toLowerCase().includes(query);
          const matchId = r._id?.toLowerCase().includes(query);
          const matchCat = typeof r.categoryId === 'object' && r.categoryId?.name?.toLowerCase().includes(query);
          if (!matchName && !matchId && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'priority-desc':
            return (b.priority || 1) - (a.priority || 1) || (a.minDays - b.minDays);
          case 'shelf-life-asc':
            return (a.minDays || 0) - (b.minDays || 0);
          case 'shelf-life-desc':
            return (b.minDays || 0) - (a.minDays || 0);
          case 'discount-desc':
            return (b.discountPercentage || 0) - (a.discountPercentage || 0);
          case 'discount-asc':
            return (a.discountPercentage || 0) - (b.discountPercentage || 0);
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '');
          default:
            return 0;
        }
      });
  }, [rules, search, statusFilter, scopeFilter, sortBy]);

  // Pricing Sweep Action
  const handleTriggerSweep = async () => {
    try {
      setSweeping(true);
      const res = await adminService.triggerPricingSweep();
      const scanned = res?.batchesScanned ?? res?.summary?.batchesScanned ?? 0;
      setSweepResult({
        scanned,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setFeedback({
        type: 'success',
        message: `Dynamic pricing sweep executed successfully. ${scanned} inventory batch(es) evaluated.`,
      });
      fetchRules(true);
    } catch (err) {
      console.error('Trigger sweep failed:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to trigger dynamic pricing sweep.',
      });
    } finally {
      setSweeping(false);
    }
  };

  // Reset to Defaults Action
  const handleResetDefaults = async () => {
    try {
      setResetting(true);
      await adminService.resetPricingRules();
      setResetModalOpen(false);
      setFeedback({
        type: 'success',
        message: 'All dynamic pricing rules reset back to standard platform 6-tier defaults.',
      });
      fetchRules();
    } catch (err) {
      console.error('Reset defaults failed:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to reset dynamic pricing rules.',
      });
    } finally {
      setResetting(false);
    }
  };

  // Quick Status Toggle (Active / Inactive)
  const handleToggleStatus = async (rule) => {
    try {
      setActionLoadingId(rule._id);
      const nextActive = !rule.isActive;
      await api.patch(`/pricing/rules/${rule._id}`, { isActive: nextActive });
      setFeedback({
        type: 'success',
        message: `Rule "${rule.name}" is now ${nextActive ? 'ACTIVE' : 'INACTIVE'}. Affected batches recalculated.`,
      });
      fetchRules();
    } catch (err) {
      console.error('Toggle status error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to update rule status.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      minDays: '',
      maxDays: '',
      isUnbounded: false,
      discountPercentage: '',
      categoryId: '',
      priority: 1,
      isActive: true,
    });
    setFormError('');
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rule) => {
    setRuleToEdit(rule);
    const catId = typeof rule.categoryId === 'object' ? rule.categoryId?._id : rule.categoryId || '';
    setFormData({
      name: rule.name || '',
      minDays: rule.minDays !== undefined ? String(rule.minDays) : '',
      maxDays: rule.maxDays !== null && rule.maxDays !== undefined ? String(rule.maxDays) : '',
      isUnbounded: rule.maxDays === null || rule.maxDays === undefined,
      discountPercentage: rule.discountPercentage !== undefined ? String(rule.discountPercentage) : '',
      categoryId: catId,
      priority: rule.priority || 1,
      isActive: Boolean(rule.isActive),
    });
    setFormError('');
    setEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (rule) => {
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  };

  // Open Drawer
  const handleInspectRule = (rule) => {
    setSelectedRule(rule);
    setDrawerOpen(true);
  };

  // Create Rule Submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const minDaysNum = parseInt(formData.minDays, 10);
    const maxDaysNum = formData.isUnbounded ? null : parseInt(formData.maxDays, 10);
    const discountNum = parseFloat(formData.discountPercentage);

    if (isNaN(minDaysNum) || minDaysNum < 0) {
      setFormError('Min Days must be an integer >= 0.');
      return;
    }
    if (!formData.isUnbounded && (isNaN(maxDaysNum) || maxDaysNum < minDaysNum)) {
      setFormError('Max Days must be greater than or equal to Min Days.');
      return;
    }
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      setFormError('Discount percentage must be between 0% and 100%.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');

      const payload = {
        name: formData.name.trim(),
        minDays: minDaysNum,
        maxDays: maxDaysNum,
        discountPercentage: discountNum,
        categoryId: formData.categoryId || null,
        priority: parseInt(formData.priority, 10) || (formData.categoryId ? 10 : 1),
        isActive: formData.isActive,
      };

      const res = await api.post('/pricing/rules', payload);
      setCreateModalOpen(false);

      const batchesUpdated = res?.recalculationSummary?.batchesUpdated ?? 0;
      setFeedback({
        type: 'success',
        message: `Pricing rule "${payload.name}" created. ${batchesUpdated} batch(es) repriced.`,
      });
      fetchRules();
    } catch (err) {
      console.error('Create rule error:', err);
      setFormError(err?.message || 'Failed to create pricing rule.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Edit Rule Submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!ruleToEdit) return;

    const minDaysNum = parseInt(formData.minDays, 10);
    const maxDaysNum = formData.isUnbounded ? null : parseInt(formData.maxDays, 10);
    const discountNum = parseFloat(formData.discountPercentage);

    if (isNaN(minDaysNum) || minDaysNum < 0) {
      setFormError('Min Days must be an integer >= 0.');
      return;
    }
    if (!formData.isUnbounded && (isNaN(maxDaysNum) || maxDaysNum < minDaysNum)) {
      setFormError('Max Days must be greater than or equal to Min Days.');
      return;
    }
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      setFormError('Discount percentage must be between 0% and 100%.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError('');

      const payload = {
        name: formData.name.trim(),
        minDays: minDaysNum,
        maxDays: maxDaysNum,
        discountPercentage: discountNum,
        categoryId: formData.categoryId || null,
        priority: parseInt(formData.priority, 10) || 1,
        isActive: formData.isActive,
      };

      const res = await api.patch(`/pricing/rules/${ruleToEdit._id}`, payload);
      setEditModalOpen(false);

      const batchesUpdated = res?.recalculationSummary?.batchesUpdated ?? 0;
      setFeedback({
        type: 'success',
        message: `Pricing rule "${payload.name}" updated. ${batchesUpdated} batch(es) repriced.`,
      });
      fetchRules();
    } catch (err) {
      console.error('Update rule error:', err);
      setFormError(err?.message || 'Failed to update pricing rule.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Rule Confirmation
  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;

    try {
      setFormSubmitting(true);
      const res = await api.delete(`/pricing/rules/${ruleToDelete._id}`);
      setDeleteModalOpen(false);

      if (drawerOpen && selectedRule?._id === ruleToDelete._id) {
        setDrawerOpen(false);
      }

      const batchesUpdated = res?.recalculationSummary?.batchesUpdated ?? 0;
      setFeedback({
        type: 'info',
        message: `Pricing rule "${ruleToDelete.name}" deleted. ${batchesUpdated} batch(es) recalculated.`,
      });
      fetchRules();
    } catch (err) {
      console.error('Delete rule error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to delete pricing rule.',
      });
    } finally {
      setFormSubmitting(false);
      setRuleToDelete(null);
    }
  };

  // Execute Dynamic Pricing Simulation (calls existing /pricing/simulate endpoint)
  const handleRunSimulation = async (e) => {
    if (e) e.preventDefault();
    const priceNum = parseFloat(simInput.originalPrice);
    const daysNum = parseInt(simInput.remainingDays, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      setSimError('Original price must be greater than 0.');
      return;
    }
    if (isNaN(daysNum)) {
      setSimError('Remaining days must be a valid integer.');
      return;
    }

    try {
      setSimLoading(true);
      setSimError(null);

      const payload = {
        originalPrice: priceNum,
        remainingDays: daysNum,
        quantity: parseInt(simInput.quantity, 10) || 1,
        categoryId: simInput.categoryId || null,
      };

      const res = await api.post('/pricing/simulate', payload);
      // res returns { originalPrice, remainingDays, discountPercentage, finalPrice, status, isPurchasable, appliedRuleId, appliedRuleName }
      setSimResult(res?.data || res);
    } catch (err) {
      console.error('Simulation calculation error:', err);
      setSimError(err?.message || 'Simulation calculation failed.');
    } finally {
      setSimLoading(false);
    }
  };

  // Set quick simulation presets
  const applySimPreset = (days, price = 100) => {
    setSimInput((prev) => ({ ...prev, remainingDays: days, originalPrice: price }));
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setScopeFilter('');
    setSortBy('priority-desc');
  };

  const hasActiveFilters = Boolean(search || statusFilter || scopeFilter || sortBy !== 'priority-desc');

  // Format category helper
  const getCategoryName = (cat) => {
    if (!cat) return null;
    if (typeof cat === 'object') return cat.name;
    const found = categories.find((c) => c._id === cat);
    return found ? found.name : 'Category Scope';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Pricing Command Header */}
      <AdminPageHeader
        eyebrow="PRICING CONTROL"
        title="Dynamic Pricing Control Center"
        subtitle="Manage automated pricing rules, inspect trigger conditions, simulate pricing outcomes, and control the platform pricing engine."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Dynamic Pricing' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {metrics.active} of {metrics.total} Rules Active
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm"
              title="Reset rules to default 6 tiers"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerSweep}
              disabled={sweeping}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/90 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Trigger dynamic pricing sweep across all inventory batches"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin text-purple-600' : 'text-purple-600'}`} />
              <span>{sweeping ? 'Running Sweep...' : 'Trigger Sweep'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rule</span>
            </button>
          </div>
        }
      />

      {/* Inline Feedback Banner */}
      {feedback && (
        <AdminMotionContainer animation="fade-slide-up">
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : feedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
              {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              <span className="truncate">{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        </AdminMotionContainer>
      )}

      {/* 2. Pricing Engine Operational Control & Sweep Status Strip */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 text-sm tracking-tight">
                  Automated FEFO Shelf-Life Pricing Engine
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Engine Operational
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Evaluates database-configured discount brackets against remaining batch days. Rule 1 lockout protects expired goods (remainingDays &lt; 0).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Engine Sweep</div>
              <div className="text-xs font-bold text-gray-800">
                {sweepResult ? `${sweepResult.scanned} batches scanned at ${sweepResult.timestamp}` : 'Ready for on-demand trigger'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTriggerSweep}
              disabled={sweeping}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin' : ''}`} />
              <span>{sweeping ? 'Sweeping...' : 'Run Pricing Sweep'}</span>
            </button>
          </div>
        </div>

        {/* Engine Operational Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Active Tier Brackets</span>
            <div className="text-lg font-black text-gray-900 mt-0.5">{metrics.active} Active Rules</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Max Tier Markdown</span>
            <div className="text-lg font-black text-purple-700 mt-0.5">{metrics.maxDiscount}% OFF Max</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Global Default Rules</span>
            <div className="text-lg font-black text-gray-900 mt-0.5">{metrics.globalCount} Rules</div>
          </div>
          <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Category Scoped Rules</span>
            <div className="text-lg font-black text-gray-900 mt-0.5">{metrics.categoryCount} Custom Scopes</div>
          </div>
        </div>
      </div>

      {/* 3. Rule Control & Filter Bar */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search pricing rules by name, ID, or category keyword..."
        filters={[
          {
            id: 'status',
            label: 'Rule Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: Filter,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active Rules Only' },
              { value: 'INACTIVE', label: 'Disabled Rules Only' },
            ],
          },
          {
            id: 'scope',
            label: 'Rule Scope',
            value: scopeFilter,
            onChange: setScopeFilter,
            icon: Tag,
            options: [
              { value: '', label: 'All Scopes' },
              { value: 'GLOBAL', label: 'Global Marketplace Only' },
              { value: 'CATEGORY', label: 'Category Scoped Only' },
            ],
          },
          {
            id: 'sort',
            label: 'Sort Ordering',
            value: sortBy,
            onChange: setSortBy,
            icon: ArrowUpDown,
            options: [
              { value: 'priority-desc', label: 'Priority (High to Low)' },
              { value: 'shelf-life-asc', label: 'Shelf Life (Min Days Asc)' },
              { value: 'shelf-life-desc', label: 'Shelf Life (Min Days Desc)' },
              { value: 'discount-desc', label: 'Discount % (Highest First)' },
              { value: 'discount-asc', label: 'Discount % (Lowest First)' },
              { value: 'name-asc', label: 'Rule Name (A to Z)' },
            ],
          },
        ]}
        totalResults={rules.length}
        filteredCount={filteredRules.length}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
      />

      {/* 4. Pricing Rule Workspace & Simulation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Rule Logic Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                Configured Pricing Rules Matrix
              </h3>
              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredRules.length}
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              Evaluated sequentially by priority &amp; shelf-life bracket
            </span>
          </div>

          {loading ? (
            <div className="bg-white p-16 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <LoadingSpinner text="Retrieving dynamic pricing rules from database..." />
            </div>
          ) : error ? (
            <div className="bg-white p-12 rounded-3xl border border-red-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Pricing Engine Synchronization Error</h4>
                <p className="text-xs text-gray-500 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchRules(false)}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Retry Connection
              </button>
            </div>
          ) : filteredRules.length === 0 ? (
            <AdminEmptyState
              icon={Sliders}
              title={hasActiveFilters ? 'No matching pricing rules' : 'No rules configured'}
              description={
                hasActiveFilters
                  ? 'No rules matched your search query or filter criteria.'
                  : 'The pricing rules collection is currently empty. Click "Reset Defaults" to seed the standard 6 tiers.'
              }
              actionLabel={hasActiveFilters ? 'Reset Filters' : 'Seed Default 6 Tiers'}
              actionIcon={hasActiveFilters ? RotateCcw : Plus}
              onAction={hasActiveFilters ? handleClearFilters : handleResetDefaults}
            />
          ) : (
            <div className="space-y-3.5">
              {filteredRules.map((rule) => {
                const categoryScopeName = getCategoryName(rule.categoryId);
                const isUpdating = actionLoadingId === rule._id;

                return (
                  <AdminMotionContainer
                    key={rule._id}
                    hoverEffect
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition space-y-3.5 ${
                      rule.isActive
                        ? 'border-gray-200/90 hover:border-purple-300'
                        : 'border-gray-200 bg-gray-50/60 opacity-80'
                    }`}
                  >
                    {/* Top Row: Identity, Priority, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-gray-900 text-sm tracking-tight">
                            {rule.name}
                          </h4>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                            Priority {rule.priority || 1}
                          </span>
                          {categoryScopeName ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {categoryScopeName}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                              Global Scope
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                          ID: {rule._id}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <AdminStatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                      </div>
                    </div>

                    {/* Rule Logic Flow: IF (Conditions) -> THEN (Pricing Action) */}
                    <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100/90 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* IF (Trigger Condition) */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-600" /> IF (Shelf Life Condition)
                        </div>
                        <div className="font-bold text-gray-800 text-xs">
                          {rule.maxDays === null || rule.maxDays === undefined ? (
                            <span>Remaining Days &ge; {rule.minDays} days (Unbounded)</span>
                          ) : (
                            <span>{rule.minDays} to {rule.maxDays} days remaining</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {categoryScopeName ? `Applies strictly to "${categoryScopeName}" products` : 'Applies marketplace-wide across all grocery SKUs'}
                        </div>
                      </div>

                      {/* THEN (Pricing Action) */}
                      <div className="space-y-1 md:border-l md:border-gray-200 md:pl-3">
                        <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Percent className="w-3 h-3 text-emerald-600" /> THEN (Dynamic Action)
                        </div>
                        <div className="font-black text-emerald-700 text-sm flex items-center gap-1.5">
                          <span>{rule.discountPercentage}% Markdown</span>
                          <span className="text-[11px] text-gray-400 font-normal">
                            (Base &times; {(1 - (rule.discountPercentage || 0) / 100).toFixed(2)})
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Automatic FEFO reduction applied upon inventory scan
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applySimPreset(rule.minDays, 100)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition"
                          title="Simulate rule calculation"
                        >
                          <Play className="w-3 h-3" />
                          <span>Simulate in Studio</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Status Toggle */}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleStatus(rule)}
                          className={`p-1.5 rounded-lg text-xs font-semibold border transition ${
                            rule.isActive
                              ? 'text-gray-500 hover:text-amber-700 hover:bg-amber-50 border-gray-200'
                              : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border-gray-200'
                          }`}
                          title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
                        >
                          <Power className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rule)}
                          className="p-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:text-purple-700 hover:bg-purple-50 border border-gray-200 transition"
                          title="Edit rule parameters"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Inspect Dossier */}
                        <button
                          type="button"
                          onClick={() => handleInspectRule(rule)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </div>
                  </AdminMotionContainer>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Pricing Simulation Studio (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-purple-700" />
              <span>Simulation Studio</span>
            </h3>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Sandbox Only
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-4">
            <div>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                Price Rule Evaluator
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Test how the backend engine resolves pricing for arbitrary shelf-life and base price inputs without modifying production data.
              </p>
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Test Presets:</span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => applySimPreset(65, 100)}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  65d (Fresh)
                </button>
                <button
                  type="button"
                  onClick={() => applySimPreset(25, 100)}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  25d (Smart)
                </button>
                <button
                  type="button"
                  onClick={() => applySimPreset(10, 100)}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  10d (Clearance)
                </button>
                <button
                  type="button"
                  onClick={() => applySimPreset(4, 100)}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  4d (Flash)
                </button>
                <button
                  type="button"
                  onClick={() => applySimPreset(1, 100)}
                  className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                >
                  1d (Rescue)
                </button>
                <button
                  type="button"
                  onClick={() => applySimPreset(-1, 100)}
                  className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition"
                >
                  -1d (Expired)
                </button>
              </div>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-3.5 text-xs">
              {simError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{simError}</span>
                </div>
              )}

              {/* Original Price */}
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Base Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={simInput.originalPrice}
                  onChange={(e) => setSimInput({ ...simInput, originalPrice: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition text-xs font-semibold"
                />
              </div>

              {/* Remaining Days */}
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Remaining Days until Expiry *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={simInput.remainingDays}
                  onChange={(e) => setSimInput({ ...simInput, remainingDays: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition text-xs font-semibold"
                />
              </div>

              {/* Optional Category */}
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Category Scope (Optional)
                </label>
                <select
                  value={simInput.categoryId}
                  onChange={(e) => setSimInput({ ...simInput, categoryId: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition text-xs"
                >
                  <option value="">Global (All Categories)</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={simLoading}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {simLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Simulation</span>
                  </>
                )}
              </button>
            </form>

            {/* Simulation Outcome Display */}
            {simResult && (
              <AdminMotionContainer
                animation="fade-slide-up"
                className="mt-4 p-4 rounded-xl border bg-gray-50 border-gray-200/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Simulation Outcome
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                    NO LIVE PRICE CHANGE
                  </span>
                </div>

                {/* Price Transformation */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Original</span>
                    <span className="text-sm font-bold text-gray-500 line-through">
                      ₹{simResult.originalPrice?.toFixed(2)}
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-gray-400" />

                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">Calculated Discount</span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {simResult.discountPercentage}% OFF
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-gray-400" />

                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase">Proposed Final</span>
                    <span className="text-lg font-black text-purple-700">
                      ₹{simResult.finalPrice?.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Matched Rule & Batch Purchasability Status */}
                <div className="pt-2 border-t border-gray-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Matched Rule:</span>
                    <span className="font-bold text-gray-800 truncate max-w-[170px]">
                      {simResult.appliedRuleName || 'Default Zero Discount'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Batch Purchasable:</span>
                    <span className={`font-bold ${simResult.isPurchasable ? 'text-emerald-700' : 'text-red-700'}`}>
                      {simResult.isPurchasable ? 'YES (Active for checkout)' : 'NO (Locked/Expired)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calculated Status:</span>
                    <span className="font-mono text-gray-700 uppercase">
                      {simResult.status}
                    </span>
                  </div>
                </div>
              </AdminMotionContainer>
            )}
          </div>
        </div>
      </div>

      {/* 5. Pricing Rule Dossier (Inspection Drawer) */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="PRICING RULE DOSSIER"
        title={selectedRule?.name || 'Pricing Rule Details'}
        subtitle={`Rule Identifier: ${selectedRule?._id || 'N/A'}`}
        footerActions={
          selectedRule && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => handleOpenDeleteModal(selectedRule)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Rule</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedRule)}
                  disabled={actionLoadingId === selectedRule._id}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition ${
                    selectedRule.isActive
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{selectedRule.isActive ? 'Disable Rule' : 'Activate Rule'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedRule)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Parameters</span>
                </button>
              </div>
            </div>
          )
        }
      >
        {selectedRule && (
          <div className="space-y-6 text-xs">
            {/* Identity & Status */}
            <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Rule Specification
                </span>
                <AdminStatusBadge status={selectedRule.isActive ? 'ACTIVE' : 'INACTIVE'} size="md" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Rule Name</div>
                  <div className="font-extrabold text-gray-900 text-sm mt-0.5">{selectedRule.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Priority Rank</div>
                  <div className="font-bold text-purple-700 text-sm mt-0.5">Priority {selectedRule.priority || 1}</div>
                </div>
              </div>

              {/* Document ID with copy button */}
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Database ObjectId</div>
                  <div className="font-mono text-gray-700 text-[11px] mt-0.5">{selectedRule._id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyId(selectedRule._id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Trigger Conditions */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Trigger Criteria &amp; Thresholds
              </span>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Shelf-Life Min Days:</span>
                  <span className="font-bold text-gray-900">{selectedRule.minDays} days</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Shelf-Life Max Days:</span>
                  <span className="font-bold text-gray-900">
                    {selectedRule.maxDays !== null && selectedRule.maxDays !== undefined
                      ? `${selectedRule.maxDays} days`
                      : 'Unbounded (∞)'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Scope Restriction:</span>
                  <span className="font-bold text-gray-900">
                    {getCategoryName(selectedRule.categoryId) || 'Global (Applies to all grocery SKUs)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Action */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Dynamic Markdown Action
              </span>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-emerald-800 font-bold text-xs">Discount Applied:</span>
                  <span className="text-lg font-black text-emerald-700">
                    {selectedRule.discountPercentage}% OFF
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700">
                  Formula: FinalPrice = BasePrice &times; {(1 - (selectedRule.discountPercentage || 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Timestamps & Governance */}
            <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-200 text-gray-600 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Created:</span>
                <span className="font-semibold text-gray-800">
                  {selectedRule.createdAt ? new Date(selectedRule.createdAt).toLocaleString() : 'System Seed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Modified:</span>
                <span className="font-semibold text-gray-800">
                  {selectedRule.updatedAt ? new Date(selectedRule.updatedAt).toLocaleString() : 'System Seed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Modified By:</span>
                <span className="font-mono text-gray-700">
                  {selectedRule.updatedBy ? String(selectedRule.updatedBy) : 'Admin Console'}
                </span>
              </div>
            </div>
          </div>
        )}
      </AdminDetailDrawer>

      {/* 6. Create Rule Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Dynamic Pricing Rule"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 8–15 Days (Half-Life Clearance)"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Min Days *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.minDays}
                onChange={(e) => setFormData({ ...formData, minDays: e.target.value })}
                placeholder="e.g. 8"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Max Days {formData.isUnbounded ? '(Unbounded)' : '*'}
              </label>
              <input
                type="number"
                min={formData.minDays || 0}
                step="1"
                disabled={formData.isUnbounded}
                required={!formData.isUnbounded}
                value={formData.isUnbounded ? '' : formData.maxDays}
                onChange={(e) => setFormData({ ...formData, maxDays: e.target.value })}
                placeholder={formData.isUnbounded ? '∞ Unbounded' : 'e.g. 15'}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createUnbounded"
              checked={formData.isUnbounded}
              onChange={(e) => setFormData({ ...formData, isUnbounded: e.target.checked })}
              className="rounded text-purple-700 focus:ring-purple-600"
            />
            <label htmlFor="createUnbounded" className="text-gray-700 font-semibold cursor-pointer select-none">
              Unbounded upper limit (e.g. 61+ days without maximum ceiling)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Discount Percentage (0–100%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                placeholder="e.g. 40"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Evaluation Priority
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Category Scope (Optional)
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            >
              <option value="">Global Default (All Categories)</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded text-purple-700 focus:ring-purple-600"
            />
            <label htmlFor="createActive" className="text-gray-700 font-semibold cursor-pointer select-none">
              Activate rule immediately upon creation
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {formSubmitting ? 'Registering...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Edit Rule Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Rule: ${ruleToEdit?.name || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Min Days *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.minDays}
                onChange={(e) => setFormData({ ...formData, minDays: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Max Days {formData.isUnbounded ? '(Unbounded)' : '*'}
              </label>
              <input
                type="number"
                min={formData.minDays || 0}
                step="1"
                disabled={formData.isUnbounded}
                required={!formData.isUnbounded}
                value={formData.isUnbounded ? '' : formData.maxDays}
                onChange={(e) => setFormData({ ...formData, maxDays: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editUnbounded"
              checked={formData.isUnbounded}
              onChange={(e) => setFormData({ ...formData, isUnbounded: e.target.checked })}
              className="rounded text-purple-700 focus:ring-purple-600"
            />
            <label htmlFor="editUnbounded" className="text-gray-700 font-semibold cursor-pointer select-none">
              Unbounded upper limit (no maximum ceiling)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Discount Percentage (0–100%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                Evaluation Priority
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Category Scope
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            >
              <option value="">Global Default (All Categories)</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded text-purple-700 focus:ring-purple-600"
            />
            <label htmlFor="editActive" className="text-gray-700 font-semibold cursor-pointer select-none">
              Rule Active in Engine
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : 'Save Parameters'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Delete Rule Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Pricing Rule"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
              <span>Confirm Rule Removal</span>
            </div>
            <p className="text-[11px] text-red-800 leading-relaxed">
              Deleting this rule will immediately trigger a recalculation across all inventory batches that previously matched this bracket.
            </p>
          </div>

          <p className="text-gray-600">
            Are you sure you want to delete <strong className="text-gray-900 font-bold">{ruleToDelete?.name}</strong>?
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {formSubmitting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 9. Reset Defaults Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Default 6-Tier Rules"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <RotateCcw className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>System Tier Re-seed</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              This will reset the global pricing brackets back to the platform standard:
              <br />• 61+ days: 0% OFF
              <br />• 31–60 days: 10% OFF
              <br />• 16–30 days: 25% OFF
              <br />• 8–15 days: 40% OFF
              <br />• 3–7 days: 60% OFF
              <br />• 0–2 days: 75% OFF
            </p>
          </div>

          <p className="text-gray-600">
            All active batches will be dynamically re-evaluated according to these standard brackets.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={resetting}
              onClick={handleResetDefaults}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Confirm Reset to Defaults'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPricingPage;
