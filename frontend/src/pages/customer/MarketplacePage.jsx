import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal, ArrowUpDown, X, MapPin } from 'lucide-react';
import api from '../../api/client';
import { ProductCard } from '../../components/common/ProductCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

export const MarketplacePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });

  // Filters state
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const expiryWindow = searchParams.get('expiryWindow') || '';
  const minDiscount = searchParams.get('minDiscount') || '';
  const sortBy = searchParams.get('sortBy') || 'expiry';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const maxDistanceKm = searchParams.get('maxDistanceKm') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Load categories
  useEffect(() => {
    api.get('/categories?status=ACTIVE')
      .then((res) => setCategories(res.data?.data?.categories || []))
      .catch(() => {});
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (expiryWindow) params.append('expiryWindow', expiryWindow);
      if (minDiscount) params.append('minDiscount', minDiscount);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (maxDistanceKm) params.append('maxDistanceKm', maxDistanceKm);
      params.append('page', page);
      params.append('limit', 12);

      const res = await api.get(`/marketplace/products?${params.toString()}`);
      const { products: items, pagination: pag } = res.data.data;
      setProducts(items || []);
      setPagination(pag || { page: 1, limit: 12, total: 0, pages: 1 });
    } catch (err) {
      console.error('Failed to fetch marketplace products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, expiryWindow, minDiscount, sortBy, sortOrder, maxDistanceKm, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Hyperlocal Marketplace</h1>
          <p className="text-sm text-gray-500">
            Real-time dynamic pricing powered by First-Expired-First-Out (FEFO) algorithms
          </p>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">Sort by:</span>
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              const next = new URLSearchParams(searchParams);
              next.set('sortBy', sb);
              next.set('sortOrder', so);
              setSearchParams(next);
            }}
            className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-medium text-gray-800 outline-none focus:border-brand-500"
          >
            <option value="expiry:asc">Expiry (Most Urgent First)</option>
            <option value="discount:desc">Discount (Highest % Off)</option>
            <option value="price:asc">Price (Lowest First)</option>
            <option value="price:desc">Price (Highest First)</option>
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        {/* Quick Expiry Windows */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px] whitespace-nowrap">
            Expiry Window:
          </span>
          <button
            onClick={() => updateParam('expiryWindow', '')}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition ${
              !expiryWindow ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Windows
          </button>
          <button
            onClick={() => updateParam('expiryWindow', 'CRITICAL')}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition ${
              expiryWindow === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            🚨 Critical (0-2 Days)
          </button>
          <button
            onClick={() => updateParam('expiryWindow', 'URGENT')}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition ${
              expiryWindow === 'URGENT' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
            }`}
          >
            ⏰ Urgent (3-7 Days)
          </button>
          <button
            onClick={() => updateParam('expiryWindow', 'APPROACHING')}
            className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition ${
              expiryWindow === 'APPROACHING' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            ⏳ Approaching (8-15 Days)
          </button>
        </div>

        {/* Category & Discount Selectors */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
          {/* Category Dropdown */}
          <select
            value={category}
            onChange={(e) => updateParam('category', e.target.value)}
            className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Min Discount Dropdown */}
          <select
            value={minDiscount}
            onChange={(e) => updateParam('minDiscount', e.target.value)}
            className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 outline-none"
          >
            <option value="">Any Discount</option>
            <option value="25">25%+ OFF</option>
            <option value="40">40%+ OFF</option>
            <option value="60">60%+ OFF</option>
            <option value="75">75% OFF</option>
          </select>

          {/* Active filter pills */}
          {(search || category || expiryWindow || minDiscount) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <LoadingSpinner text="Querying active FEFO batches..." />
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', p.toString());
                    setSearchParams(next);
                  }}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition ${
                    p === page
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="No products match your criteria"
          description="Try broadening your expiry window or clearing category filters to see more available lots."
          actionLabel="Clear All Filters"
          onAction={clearFilters}
        />
      )}
    </div>
  );
};
