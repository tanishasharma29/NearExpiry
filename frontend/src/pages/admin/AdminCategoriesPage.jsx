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
  AlertTriangle,
  Tag,
  FolderTree,
  ArrowUpDown,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Info,
  Archive,
  Power,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  // Reset to page 1 when search, filter, sort, or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy, pageSize]);

  // Pagination Calculations
  const totalFiltered = filteredCategories.length;
  const isAllPages = pageSize === 'all';
  const effectivePageSize = isAllPages ? Math.max(1, totalFiltered) : Number(pageSize);
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalFiltered / effectivePageSize));

  // Current slice of categories for data table
  const paginatedCategories = useMemo(() => {
    if (isAllPages) return filteredCategories;
    const start = (currentPage - 1) * effectivePageSize;
    return filteredCategories.slice(start, start + effectivePageSize);
  }, [filteredCategories, currentPage, effectivePageSize, isAllPages]);

  const startIndex = totalFiltered === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endIndex = isAllPages
    ? totalFiltered
    : Math.min(currentPage * effectivePageSize, totalFiltered);

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
    <div className="max-w-7xl mx-auto space-y-5">
      {/* 1. Taxonomy Command Header */}
      <AdminPageHeader
        eyebrow="MARKETPLACE GOVERNANCE"
        title="Taxonomy & Category Master"
        subtitle="Manage product classification, catalog discoverability, and category availability across the marketplace."
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
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-2xs disabled:opacity-50"
              title="Refresh categories"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
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
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
              {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
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

      {/* 2. Top Summary Area (Slim, Information-Dense Metric Strip) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Total Categories */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0">
            <FolderTree className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Categories</div>
            <div className="text-lg sm:text-xl font-black text-gray-900 tracking-tight mt-0.5">
              {metrics.total}
            </div>
          </div>
        </div>

        {/* Active Categories */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Categories</div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 tracking-tight mt-0.5">
              {metrics.active}
            </div>
          </div>
        </div>

        {/* Inactive / Retired */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 flex items-center justify-center shrink-0">
            <Archive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Inactive / Retired</div>
            <div className="text-lg sm:text-xl font-black text-gray-700 tracking-tight mt-0.5">
              {metrics.inactive}
            </div>
          </div>
        </div>

        {/* Linked Catalog SKUs */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Linked Catalog SKUs</div>
            <div className="text-lg sm:text-xl font-black text-gray-900 tracking-tight mt-0.5">
              {metrics.totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search, Filters & Sorting Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search
              className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category by name, slug, or description keywords..."
              aria-label="Search categories"
              className="w-full pl-9 pr-9 py-2 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-purple-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="relative flex-1 sm:flex-initial min-w-[130px]">
              <div className="relative flex items-center">
                <select
                  id="category-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by Status"
                  className="w-full sm:w-auto appearance-none bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 text-xs font-semibold text-gray-700 pl-8 pr-7 py-2 rounded-xl outline-none transition cursor-pointer focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
                <Filter
                  className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none"
                  aria-hidden="true"
                />
                <div className="absolute right-2.5 pointer-events-none text-gray-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Sort Order */}
            <div className="relative flex-1 sm:flex-initial min-w-[150px]">
              <div className="relative flex items-center">
                <select
                  id="category-sort-order"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort Ordering"
                  className="w-full sm:w-auto appearance-none bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 text-xs font-semibold text-gray-700 pl-8 pr-7 py-2 rounded-xl outline-none transition cursor-pointer focus:ring-2 focus:ring-purple-100"
                >
                  <option value="name-asc">Name (A to Z)</option>
                  <option value="name-desc">Name (Z to A)</option>
                  <option value="skus-desc">Highest Catalog SKUs</option>
                  <option value="skus-asc">Lowest Catalog SKUs</option>
                  <option value="recent">Recently Created</option>
                </select>
                <ArrowUpDown
                  className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none"
                  aria-hidden="true"
                />
                <div className="absolute right-2.5 pointer-events-none text-gray-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Reset / Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-700 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-red-100"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter and Page Size Info */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500 font-medium">
          <div>
            Showing <strong className="text-gray-900">{totalFiltered}</strong> of{' '}
            <strong className="text-gray-900">{categories.length}</strong> categories
            {hasActiveFilters && (
              <span className="ml-2 text-purple-700 font-semibold">• Filters Active</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg px-2 py-0.5 outline-none cursor-pointer focus:border-purple-500"
              aria-label="Select rows per page"
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={35}>35</option>
              <option value={50}>50</option>
              <option value="all">All ({categories.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Taxonomy Data Table Workspace */}
      {loading ? (
        <div className="bg-white p-16 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col items-center justify-center">
          <LoadingSpinner text="Retrieving platform taxonomies and catalog distribution..." />
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-2xl border border-red-200 shadow-2xs text-center max-w-lg mx-auto space-y-4">
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
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
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
              : 'The marketplace taxonomy is currently empty. Add standard grocery categories to start indexing store products.'
          }
          actionLabel={hasActiveFilters ? 'Reset Filters' : 'Create First Category'}
          actionIcon={hasActiveFilters ? RotateCcw : Plus}
          onAction={hasActiveFilters ? handleClearFilters : handleOpenCreateModal}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          {/* Desktop & Tablet High-Quality Data Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/90 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Category</th>
                  <th scope="col" className="py-3 px-4">Slug</th>
                  <th scope="col" className="py-3 px-4 text-center">Catalog SKUs</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Created</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {paginatedCategories.map((category) => {
                  const isUpdating = actionLoadingId === category._id;

                  return (
                    <tr
                      key={category._id}
                      onClick={() => handleInspectCategory(category)}
                      className="hover:bg-purple-50/25 transition-colors duration-150 group cursor-pointer"
                    >
                      {/* Column 1: Category Name & Icon + Snippet */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition ${
                              category.status === 'ACTIVE'
                                ? 'bg-purple-50 text-purple-700 border-purple-100 group-hover:border-purple-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            <Tag className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-sm">
                            <div className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition truncate">
                              {category.name}
                            </div>
                            {category.description && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                {category.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Slug */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/70">
                          /{category.slug}
                        </span>
                      </td>

                      {/* Column 3: Catalog SKUs (Real count) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                            category.productCount > 0
                              ? 'bg-purple-50 text-purple-800 border border-purple-100'
                              : 'bg-gray-100 text-gray-500 border border-gray-200/60'
                          }`}
                        >
                          <Layers className="w-3 h-3 text-purple-600" />
                          <span>{category.productCount || 0}</span>
                          <span className="font-normal text-[10px] text-gray-400">SKUs</span>
                        </span>
                      </td>

                      {/* Column 4: Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <AdminStatusBadge status={category.status} size="sm" />
                      </td>

                      {/* Column 5: Created Date */}
                      <td className="py-3 px-4 text-gray-500 text-[11px] whitespace-nowrap">
                        {formatDate(category.createdAt)}
                      </td>

                      {/* Column 6: Actions (Inspect, Edit, Status Toggle, Retire) */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Inspect */}
                          <button
                            type="button"
                            onClick={() => handleInspectCategory(category)}
                            className="p-1.5 rounded-lg text-purple-700 hover:text-purple-900 hover:bg-purple-100/70 bg-purple-50 border border-purple-200/70 transition"
                            title="Inspect category dossier"
                            aria-label={`Inspect ${category.name}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(category)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-purple-700 hover:bg-purple-50 border border-gray-200 transition"
                            title="Edit category details"
                            aria-label={`Edit ${category.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(category)}
                            className={`p-1.5 rounded-lg border transition ${
                              category.status === 'ACTIVE'
                                ? 'text-gray-500 hover:text-amber-700 hover:bg-amber-50 border-gray-200'
                                : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border-gray-200'
                            }`}
                            title={category.status === 'ACTIVE' ? 'Deactivate category' : 'Activate category'}
                            aria-label={`Toggle status for ${category.name}`}
                          >
                            <Power className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Retire / Delete */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(category)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition"
                            title="Retire category from taxonomy"
                            aria-label={`Retire ${category.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout for Viewports < 768px */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginatedCategories.map((category) => {
              const isUpdating = actionLoadingId === category._id;

              return (
                <div
                  key={category._id}
                  onClick={() => handleInspectCategory(category)}
                  className="p-3.5 space-y-2.5 hover:bg-purple-50/20 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          category.status === 'ACTIVE'
                            ? 'bg-purple-50 text-purple-700 border-purple-100'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{category.name}</h4>
                        <div className="font-mono text-[10px] text-gray-400 truncate">/{category.slug}</div>
                      </div>
                    </div>
                    <AdminStatusBadge status={category.status} size="sm" />
                  </div>

                  {category.description && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                      {category.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span className="inline-flex items-center gap-1 font-bold text-gray-800">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>{category.productCount || 0} linked SKUs</span>
                    </span>

                    <span className="text-gray-400 text-[10px]">
                      Created {formatDate(category.createdAt)}
                    </span>
                  </div>

                  {/* Mobile Actions */}
                  <div
                    className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleInspectCategory(category)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 transition"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(category)}
                      className="p-1 rounded-lg text-gray-600 hover:bg-gray-100 border border-gray-200 transition"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleToggleStatus(category)}
                      className="p-1 rounded-lg text-gray-600 hover:bg-gray-100 border border-gray-200 transition"
                      title="Toggle Status"
                    >
                      <Power className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(category)}
                      className="p-1 rounded-lg text-red-600 hover:bg-red-50 border border-gray-200 transition"
                      title="Retire"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Client-Side Pagination Control Bar */}
          {!isAllPages && totalPages > 1 && (
            <div className="p-3.5 sm:p-4 bg-gray-50/60 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="text-gray-500 font-medium">
                Showing <strong className="text-gray-900">{startIndex}</strong> to{' '}
                <strong className="text-gray-900">{endIndex}</strong> of{' '}
                <strong className="text-gray-900">{totalFiltered}</strong> categories
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - currentPage) <= 1) return true;
                      return false;
                    })
                    .map((pageNumber, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && pageNumber - prev > 1;

                      return (
                        <React.Fragment key={pageNumber}>
                          {showEllipsis && (
                            <span className="text-gray-400 px-1 text-xs">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                              currentPage === pageNumber
                                ? 'bg-purple-700 text-white shadow-2xs'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Category Inspection Dossier (Drawer) */}
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
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
          <div className="space-y-5 text-xs">
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
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
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
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
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
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Taxonomy Integrity Protection</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Deactivating a category hides it from customer navigation filters while safely retaining historical batch records, seller SKU mappings, and order items.
              </p>
            </div>
          </div>
        )}
      </AdminDetailDrawer>

      {/* 7. Create Category Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Marketplace Taxonomy"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register Taxonomy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Edit Category Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Category: ${categoryToEdit?.name || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
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
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Retire / Delete Category Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Retire Marketplace Taxonomy"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
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
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-xs disabled:opacity-50"
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
