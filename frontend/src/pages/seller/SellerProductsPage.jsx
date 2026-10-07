import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Package, AlertCircle } from 'lucide-react';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(5, 'Description is required'),
  brand: z.string().min(1, 'Brand is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.enum(['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle']),
  packageSize: z.string().optional(),
});

export const SellerProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit: 'pack',
      packageSize: '1 pc',
    },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodData, catData] = await Promise.all([
        productService.getMyProducts({ limit: 100 }).catch(() => productService.getProducts({ limit: 100 })),
        categoryService.getCategories({ status: 'ACTIVE', limit: 100 }),
      ]);
      const pList = prodData?.products || prodData?.data?.products || (Array.isArray(prodData) ? prodData : []);
      const cList = catData?.categories || catData?.data?.categories || (Array.isArray(catData) ? catData : []);
      setProducts(pList);
      setCategories(cList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await productService.createProduct(data);
      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      setServerError(err.message || 'Failed to create product');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Master Product Catalog</h1>
          <p className="text-xs text-gray-500">Manage master SKUs before registering individual expiry batches</p>
        </div>
        <button
          onClick={() => {
            setServerError('');
            setModalOpen(true);
          }}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" /> Add Catalog Product
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading catalog products..." />
      ) : products.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-900">{p.name}</td>
                  <td className="py-3 px-4 text-gray-700">{p.brand}</td>
                  <td className="py-3 px-4 text-gray-600">{p.category?.name || 'Category'}</td>
                  <td className="py-3 px-4 text-gray-600">{p.packageSize ? `${p.packageSize} ` : ''}({p.unit})</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No products in your catalog yet. Click "Add Catalog Product" to begin.
        </div>
      )}

      {/* Add Product Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Master Catalog Product">
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 uppercase mb-1">Product Title</label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Organic Cow Milk 1L"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
            />
            {errors.name && <p className="text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Brand</label>
              <input
                type="text"
                {...register('brand')}
                placeholder="e.g. Amul"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
              {errors.brand && <p className="text-red-600 mt-1">{errors.brand.message}</p>}
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Category</label>
              <select
                {...register('category')}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-red-600 mt-1">{errors.category.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Unit</label>
              <select
                {...register('unit')}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
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
              <label className="block font-bold text-gray-700 uppercase mb-1">Package Size</label>
              <input
                type="text"
                {...register('packageSize')}
                placeholder="e.g. 500g, 1L"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase mb-1">Description</label>
            <textarea
              rows={3}
              {...register('description')}
              placeholder="Product details, ingredients, storage requirements..."
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
            />
            {errors.description && <p className="text-red-600 mt-1">{errors.description.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow transition"
          >
            {isSubmitting ? 'Creating...' : 'Save Product'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
