import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Tag,
  FolderTree,
  ArrowUpDown,
  ChevronRight,
  Hash,
  FileText,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  LayoutGrid,
  List,
  RefreshCw,
  Info,
  Archive,
  Power,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
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

export const AdminCategoriesPage = () => {
  // Master Category State
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search, Filters & Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Selected Category Inspection Dossier (Drawer)
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Action status / Feedback
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Auto-dismiss feedback message after 4.5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Fetch Categories from Admin Service (which returns real productCount)
  const fetchCategories = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await adminService.getCategories();
      // Handle array or payload wrapper { categories: [...] }
      const list = Array.isArray(res) ? res : res?.categories || res?.data || [];
      setCategories(list);

      // If a category was currently open in drawer, update its data
      if (selectedCategory) {
        const updated = list.find((c) => c._id === selectedCategory._id);
        if (updated) setSelectedCategory(updated);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err?.message || 'Failed to retrieve categories from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Copy helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Helper to slugify category name for live preview
  const generateSlugPreview = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  // Platform Metrics
  const metrics = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.status === 'ACTIVE').length;
    const inactive = categories.filter((c) => c.status === 'INACTIVE').length;
    const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
    const maxProducts = categories.reduce((max, c) => Math.max(max, c.productCount || 0), 0);

    return { total, active, inactive, totalProducts, maxProducts };
  }, [categories]);

  // Filtered and Sorted Categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter((cat) => {
        // Status Filter
        if (statusFilter && cat.status !== statusFilter) return false;

        // Search Filter (by name, slug, or description)
        if (search.trim()) {
          const query = search.trim().toLowerCase();
          const matchName = cat.name?.toLowerCase().includes(query);
          const matchSlug = cat.slug?.toLowerCase().includes(query);
          const matchDesc = cat.description?.toLowerCase().includes(query);
          if (!matchName && !matchSlug && !matchDesc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '');
          case 'name-desc':
            return (b.name || '').localeCompare(a.name || '');
          case 'skus-desc':
            return (b.productCount || 0) - (a.productCount || 0);
          case 'skus-asc':
            return (a.productCount || 0) - (b.productCount || 0);
          case 'recent':
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          default:
            return 0;
        }
      });
  }, [categories, search, statusFilter, sortBy]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      status: 'ACTIVE',
    });
    setFormError('');
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (category) => {
    setCategoryToEdit(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      status: category.status || 'ACTIVE',
    });
    setFormError('');
    setEditModalOpen(true);
  };

  // Open Delete / Retire Modal
  const handleOpenDeleteModal = (category) => {
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  // Inspect Category in Drawer
  const handleInspectCategory = (category) => {
    setSelectedCategory(category);
    setDrawerOpen(true);
  };

  // Create Category Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setFormError('Category name must be at least 2 characters.');
      return;
    }
    if (trimmedName.length > 80) {
      setFormError('Category name cannot exceed 80 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      await categoryService.createCategory({
        name: trimmedName,
        description: formData.description.trim(),
        status: formData.status,
      });

      setCreateModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Category "${trimmedName}" created successfully and registered in platform taxonomy.`,
      });
      fetchCategories();
    } catch (err) {
      console.error('Create category error:', err);
      setFormError(err?.message || 'Failed to create category. Ensure the name is unique.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Category Handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!categoryToEdit) return;

    const trimmedName = formData.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setFormError('Category name must be at least 2 characters.');
      return;
    }
    if (trimmedName.length > 80) {
      setFormError('Category name cannot exceed 80 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      await categoryService.updateCategory(categoryToEdit._id, {
        name: trimmedName,
        description: formData.description.trim(),
        status: formData.status,
      });

      setEditModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Category "${trimmedName}" updated successfully.`,
      });
      fetchCategories();
    } catch (err) {
      console.error('Update category error:', err);
      setFormError(err?.message || 'Failed to update category. Ensure the name is unique.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Status Toggle (ACTIVE <-> INACTIVE)
  const handleToggleStatus = async (category) => {
    const nextStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setActionLoadingId(category._id);
      await categoryService.updateCategory(category._id, { status: nextStatus });
      setFeedback({
        type: 'success',
        message: `Category "${category.name}" status changed to ${nextStatus}.`,
      });
      fetchCategories();
    } catch (err) {
      console.error('Toggle status error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to update category status.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete / Retire Confirmation Handler
  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      setSubmitting(true);
      const res = await categoryService.deleteCategory(categoryToDelete._id);

      setDeleteModalOpen(false);
      if (drawerOpen && selectedCategory?._id === categoryToDelete._id) {
        setDrawerOpen(false);
      }

      setFeedback({
        type: 'info',
        message:
          res?.message ||
          (categoryToDelete.productCount > 0
            ? `Category marked INACTIVE to protect ${categoryToDelete.productCount} linked catalog SKUs.`
            : 'Category permanently removed from taxonomy.'),
      });
      fetchCategories();
    } catch (err) {
      console.error('Delete category error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to retire category.',
      });
    } finally {
      setSubmitting(false);
      setCategoryToDelete(null);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSortBy('name-asc');
  };

  const hasActiveFilters = Boolean(search || statusFilter || sortBy !== 'name-asc');

  // Format Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Taxonomy Command Header */}
      <AdminPageHeader
        eyebrow="MARKETPLACE TAXONOMY"
        title="Taxonomy & Category Master"
        subtitle="Standardized grocery classification, catalog indexing, and SKU distribution governance across all seller stores."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Category Master' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {metrics.active} of {metrics.total} Active
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchCategories(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh categories"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
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

      {/* 2. Taxonomy Health Matrix / Executive Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Categories */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-sm flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Taxonomies</div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">
              {metrics.total}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Defined platform roots</div>
          </div>
        </AdminMotionContainer>

        {/* Active Taxonomies */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-sm flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Status</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight mt-0.5">
              {metrics.active}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Available for cataloging</div>
          </div>
        </AdminMotionContainer>

        {/* Inactive / Staged Taxonomies */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-sm flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 flex-shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Inactive / Retired</div>
            <div className="text-xl sm:text-2xl font-black text-gray-700 tracking-tight mt-0.5">
              {metrics.inactive}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Hidden from store filters</div>
          </div>
        </AdminMotionContainer>

        {/* Linked Catalog SKUs */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-sm flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Linked Catalog SKUs</div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">
              {metrics.totalProducts}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Total products indexed</div>
          </div>
        </AdminMotionContainer>
      </div>

      {/* 3. Taxonomy Control Bar & Filter Interface */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories by name, slug, or description keywords..."
        filters={[
          {
            id: 'status',
            label: 'Filter by Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: Filter,
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active Only' },
              { value: 'INACTIVE', label: 'Inactive Only' },
            ],
          },
          {
            id: 'sort',
            label: 'Sort Ordering',
            value: sortBy,
            onChange: setSortBy,
            icon: ArrowUpDown,
            options: [
              { value: 'name-asc', label: 'Name (A to Z)' },
              { value: 'name-desc', label: 'Name (Z to A)' },
              { value: 'skus-desc', label: 'Highest SKU Density' },
              { value: 'skus-asc', label: 'Lowest SKU Density' },
              { value: 'recent', label: 'Recently Created' },
            ],
          },
        ]}
        totalResults={categories.length}
        filteredCount={filteredCategories.length}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
        extraActions={
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Taxonomy Matrix Grid"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Compact Index Table"
              aria-label="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* 4. Taxonomy Structure / Explorer Views */}
      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-200/90 shadow-sm flex flex-col items-center justify-center">
          <LoadingSpinner text="Retrieving platform taxonomies and catalog distribution..." />
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-3xl border border-red-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Taxonomy Synchronization Error</h3>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchCategories(false)}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <AdminEmptyState
          icon={Layers}
          title={hasActiveFilters ? 'No matching taxonomies' : 'No categories configured'}
          description={
            hasActiveFilters
              ? 'No platform categories match your current search criteria or status filter.'
              : 'The marketplace taxonomy is currently empty. Initialize standard grocery categories to start indexing store products.'
          }
          actionLabel={hasActiveFilters ? 'Reset Filters' : 'Create First Category'}
          actionIcon={hasActiveFilters ? RotateCcw : Plus}
          onAction={hasActiveFilters ? handleClearFilters : handleOpenCreateModal}
        />
      ) : viewMode === 'grid' ? (
        /* View Mode A: Taxonomy Node Matrix (Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => {
            const skuPercentage = metrics.maxProducts > 0
              ? Math.min(100, Math.round(((category.productCount || 0) / metrics.maxProducts) * 100))
              : 0;

            const isUpdating = actionLoadingId === category._id;

            return (
              <AdminMotionContainer
                key={category._id}
                hoverEffect
                className={`bg-white rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                  category.status === 'ACTIVE'
                    ? 'border-gray-200/90 hover:border-purple-300'
                    : 'border-gray-200 bg-gray-50/50 opacity-90'
                }`}
              >
                {/* Card Top: Header & Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                          category.status === 'ACTIVE'
                            ? 'bg-purple-50 text-purple-700 border-purple-100'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        <Tag className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate tracking-tight">
                          {category.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200/60 truncate max-w-[140px]">
                            /{category.slug || 'slug'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <AdminStatusBadge status={category.status} size="sm" />
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem] leading-relaxed">
                    {category.description || (
                      <span className="italic text-gray-400">No operational description provided.</span>
                    )}
                  </p>

                  {/* Catalog SKU Distribution Gauge */}
                  <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-semibold flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-gray-400" /> Catalog SKUs
                      </span>
                      <span className="font-extrabold text-gray-900">
                        {category.productCount || 0}{' '}
                        <span className="font-normal text-gray-400 text-[10px]">products</span>
                      </span>
                    </div>

                    {/* Visual Density Meter Bar */}
                    <div className="w-full bg-gray-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          category.productCount > 0 ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                        style={{ width: `${Math.max(4, skuPercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Metadata & Action Controls */}
                <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>{formatDate(category.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status Toggle Button */}
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleToggleStatus(category)}
                      className={`p-1.5 rounded-lg text-xs font-semibold border transition ${
                        category.status === 'ACTIVE'
                          ? 'text-gray-500 hover:text-amber-700 hover:bg-amber-50 border-gray-200'
                          : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border-gray-200'
                      }`}
                      title={category.status === 'ACTIVE' ? 'Deactivate category' : 'Activate category'}
                      aria-label="Toggle status"
                    >
                      <Power className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(category)}
                      className="p-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:text-purple-700 hover:bg-purple-50 border border-gray-200 transition"
                      title="Edit taxonomy details"
                      aria-label="Edit category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Inspect Dossier Button */}
                    <button
                      type="button"
                      onClick={() => handleInspectCategory(category)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 transition"
                      title="Inspect complete dossier"
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
      ) : (
        /* View Mode B: Compact Master Index Table */
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Taxonomy Name & Slug</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4 text-center">Catalog SKUs</th>
                  <th scope="col" className="py-3 px-4">Description Scope</th>
                  <th scope="col" className="py-3 px-4">Created Date</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredCategories.map((category) => {
                  const isUpdating = actionLoadingId === category._id;

                  return (
                    <tr
                      key={category._id}
                      className="hover:bg-purple-50/30 transition-colors duration-150 group"
                    >
                      {/* Name & Slug */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 group-hover:text-purple-700 transition">
                              {category.name}
                            </div>
                            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                              /{category.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <AdminStatusBadge status={category.status} size="sm" />
                      </td>

                      {/* Catalog SKUs */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[11px]">
                          <Layers className="w-3 h-3 text-gray-400" />
                          {category.productCount || 0}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-gray-500 truncate text-[11px]">
                          {category.description || <span className="italic text-gray-300">None</span>}
                        </p>
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-gray-400 text-[11px] whitespace-nowrap">
                        {formatDate(category.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(category)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-amber-700 hover:bg-amber-50 border border-gray-200 transition"
                            title={category.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            <Power className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(category)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-purple-700 hover:bg-purple-50 border border-gray-200 transition"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInspectCategory(category)}
                            className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 bg-purple-50 border border-purple-200/80 transition"
                            title="Inspect Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Category Inspection Dossier (Drawer) */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="TAXONOMY DOSSIER"
        title={selectedCategory?.name || 'Category Inspection'}
        subtitle={`System Identifier: ${selectedCategory?._id || 'N/A'}`}
        footerActions={
          selectedCategory && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => handleOpenDeleteModal(selectedCategory)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Retire Category</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleStatus(selectedCategory);
                  }}
                  disabled={actionLoadingId === selectedCategory._id}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition ${
                    selectedCategory.status === 'ACTIVE'
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{selectedCategory.status === 'ACTIVE' ? 'Set Inactive' : 'Set Active'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditModal(selectedCategory);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Category</span>
                </button>
              </div>
            </div>
          )
        }
      >
        {selectedCategory && (
          <div className="space-y-6 text-xs">
            {/* Identity & Status Card */}
            <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Classification Record
                </span>
                <AdminStatusBadge status={selectedCategory.status} size="md" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Category Name</div>
                  <div className="font-extrabold text-gray-900 text-sm mt-0.5">{selectedCategory.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">URL Slug</div>
                  <div className="font-mono text-purple-700 font-bold mt-0.5">/{selectedCategory.slug}</div>
                </div>
              </div>

              {/* Mongo Document ID with copy button */}
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Document ID</div>
                  <div className="font-mono text-gray-700 text-[11px] mt-0.5">{selectedCategory._id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyId(selectedCategory._id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Catalog Density & SKU Distribution */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Catalog Distribution
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {selectedCategory.productCount || 0} Linked Products
                </span>
              </div>

              <p className="text-gray-500 text-[11px] leading-relaxed">
                Products registered under this category inherit this taxonomy key across customer search indexes, seller inventory dashboards, and dynamic pricing rules.
              </p>

              {/* Density Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Relative Density in Platform Catalog</span>
                  <span>
                    {metrics.maxProducts > 0
                      ? `${Math.round(((selectedCategory.productCount || 0) / metrics.maxProducts) * 100)}% of peak category`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        metrics.maxProducts > 0
                          ? Math.max(5, Math.min(100, ((selectedCategory.productCount || 0) / metrics.maxProducts) * 100))
                          : 5
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Description & Scope */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Operational Description
              </span>
              <p className="text-gray-700 leading-relaxed text-xs">
                {selectedCategory.description || (
                  <span className="italic text-gray-400">
                    No descriptive guidance provided for this category. Administrators can edit to add grocery scope details.
                  </span>
                )}
              </p>
            </div>

            {/* Timestamps & Governance Audit */}
            <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-200 text-gray-600 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Created At:</span>
                <span className="font-semibold text-gray-800">{formatDate(selectedCategory.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Modified:</span>
                <span className="font-semibold text-gray-800">{formatDate(selectedCategory.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created By:</span>
                <span className="font-mono text-gray-700">
                  {selectedCategory.createdBy ? String(selectedCategory.createdBy) : 'System Pre-seed'}
                </span>
              </div>
            </div>

            {/* Safety Notice regarding Category Deactivation */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>Taxonomy Integrity Protection</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Deactivating a category hides it from customer navigation filters while safely retaining historical batch records, seller SKU mappings, and order items.
              </p>
            </div>
          </div>
        )}
      </AdminDetailDrawer>

      {/* 6. Create Category Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Marketplace Taxonomy"
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
              Category Name *
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Dairy & Eggs, Fresh Produce, Bakery"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            />
            {formData.name.trim() && (
              <div className="mt-1 text-[11px] text-gray-400 font-mono">
                Auto slug preview: <span className="text-purple-700 font-bold">/{generateSlugPreview(formData.name)}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Taxonomy Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white font-semibold text-gray-800 transition"
            >
              <option value="ACTIVE">ACTIVE — Available for store listing & customer filters</option>
              <option value="INACTIVE">INACTIVE — Staged/Hidden from platform navigation</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Description Scope (Optional)
              </label>
              <span className="text-[10px] text-gray-400">
                {formData.description.length}/500 chars
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe grocery products covered under this taxonomy (e.g., Artisanal breads, rolls, croissants, and morning pastries with quick shelf-life markdown)."
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition resize-none"
            />
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
              disabled={submitting}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register Taxonomy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Edit Category Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Category: ${categoryToEdit?.name || ''}`}
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
              Category Name *
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition"
            />
            {formData.name.trim() && (
              <div className="mt-1 text-[11px] text-gray-400 font-mono">
                Updated slug preview: <span className="text-purple-700 font-bold">/{generateSlugPreview(formData.name)}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Taxonomy Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white font-semibold text-gray-800 transition"
            >
              <option value="ACTIVE">ACTIVE — Available for store listing & customer filters</option>
              <option value="INACTIVE">INACTIVE — Staged/Hidden from platform navigation</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Description Scope
              </label>
              <span className="text-[10px] text-gray-400">
                {formData.description.length}/500 chars
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:border-purple-600 focus:bg-white transition resize-none"
            />
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
              disabled={submitting}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Retire / Delete Category Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Retire Marketplace Taxonomy"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Safe Deletion Guarantee</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              If any catalog products ({categoryToDelete?.productCount || 0} currently linked) reference{' '}
              <strong className="text-gray-900 font-semibold">{categoryToDelete?.name}</strong>, the backend will safely transition this category to <span className="font-bold uppercase">INACTIVE</span> rather than hard-deleting, preserving database integrity.
            </p>
          </div>

          <p className="text-gray-600">
            Are you sure you want to retire <strong className="text-gray-900 font-bold">{categoryToDelete?.name}</strong> from active marketplace indexing?
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
              disabled={submitting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Retire'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCategoriesPage;
