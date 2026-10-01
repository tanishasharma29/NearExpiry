import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Package, ShieldAlert, Archive } from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/products');
      setProducts(res.data?.data?.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const moderateProduct = async (id, nextStatus) => {
    try {
      await api.patch(`/admin/products/${id}/moderation`, { status: nextStatus });
      fetchProducts();
    } catch (err) {
      alert(err.message || 'Failed to moderate product');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Catalog Moderation</h1>
        <p className="text-xs text-gray-500">Audit products listed across all seller stores</p>
      </div>

      {loading ? (
        <LoadingSpinner text="Querying platform catalog..." />
      ) : products.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Product Title</th>
                <th className="py-3 px-4">Store</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-900">{p.name}</td>
                  <td className="py-3 px-4 text-gray-700">{p.storeId?.storeName || 'Store'}</td>
                  <td className="py-3 px-4 text-gray-500">{p.brand}</td>
                  <td className="py-3 px-4 text-gray-500">{p.category?.name || 'Category'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {p.status === 'ACTIVE' ? (
                      <button
                        onClick={() => moderateProduct(p._id, 'ARCHIVED')}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Delist / Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => moderateProduct(p._id, 'ACTIVE')}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No products to moderate.
        </div>
      )}
    </div>
  );
};
