import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import { Layers, Plus } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [catName, setCatName] = useState('');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCategories();
      setCategories(data?.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await categoryService.createCategory({ name: catName, status: 'ACTIVE' });
      setCatName('');
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      alert(err.message || 'Failed to create category');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Category Master Management</h1>
          <p className="text-xs text-gray-500">Maintain standard grocery taxonomies</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving categories..." />
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c._id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                <div className="text-[11px] text-gray-400 mt-0.5">{c.productCount || 0} catalog item(s)</div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Active
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No categories found.
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create New Category">
        <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 uppercase mb-1">Category Title</label>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Dairy & Eggs, Bakery, Fresh Produce"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition"
          >
            Create Category
          </button>
        </form>
      </Modal>
    </div>
  );
};
