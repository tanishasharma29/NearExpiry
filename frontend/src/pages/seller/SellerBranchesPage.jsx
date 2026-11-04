import React, { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Store,
  Phone,
  Mail,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit2,
  Power,
  Boxes,
  Layers,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { branchService } from '../../services/branchService';
import { SellerPageHeader, MerchantStatCard } from '../../components/seller';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SellerBranchesPage = () => {
  const [branches, setBranches] = useState([]);
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [editingBranch, setEditingBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Inventory Modal
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedBranchInventory, setSelectedBranchInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Form State
  const initialForm = {
    name: '',
    street: '',
    locality: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    contactPhone: '',
    contactEmail: '',
    operatingHours: '09:00 AM - 09:00 PM',
    latitude: '',
    longitude: '',
    isPrimary: false,
  };
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const fetchBranches = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setErrorMsg('');

      const res = await branchService.getMyBranches();
      const branchList = res?.data?.branches || res?.branches || [];
      const store = res?.data?.store || res?.store || null;

      setBranches(branchList);
      setStoreInfo(store);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load store branches.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreateModal = () => {
    setModalMode('CREATE');
    setEditingBranch(null);
    setForm(initialForm);
    setFormErrors({});
    setBranchModalOpen(true);
  };

  const openEditModal = (branch) => {
    setModalMode('EDIT');
    setEditingBranch(branch);
    setForm({
      name: branch.name || '',
      street: branch.address?.street || '',
      locality: branch.address?.locality || '',
      city: branch.address?.city || '',
      state: branch.address?.state || '',
      pincode: branch.address?.pincode || '',
      landmark: branch.address?.landmark || '',
      contactPhone: branch.contactPhone || '',
      contactEmail: branch.contactEmail || '',
      operatingHours: branch.operatingHours || '09:00 AM - 09:00 PM',
      latitude: branch.latitude !== null && branch.latitude !== undefined ? branch.latitude : '',
      longitude: branch.longitude !== null && branch.longitude !== undefined ? branch.longitude : '',
      isPrimary: Boolean(branch.isPrimary),
    });
    setFormErrors({});
    setBranchModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Branch name is required';
    if (!form.street.trim()) errs.street = 'Street address is required';
    if (!form.city.trim()) errs.city = 'City is required';
    if (!form.state.trim()) errs.state = 'State is required';
    if (!form.pincode.trim()) errs.pincode = 'PIN code is required';
    else if (!/^\d{4,10}$/.test(form.pincode.trim())) errs.pincode = 'Valid PIN code required';
    if (!form.contactPhone.trim()) errs.contactPhone = 'Contact phone is required';
    else if (!/^\d{10,15}$/.test(form.contactPhone.trim().replace(/\D/g, ''))) {
      errs.contactPhone = 'Valid 10-15 digit phone number required';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        name: form.name.trim(),
        address: {
          street: form.street.trim(),
          locality: form.locality.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          landmark: form.landmark.trim(),
        },
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        operatingHours: form.operatingHours.trim() || '09:00 AM - 09:00 PM',
        latitude: form.latitude !== '' ? Number(form.latitude) : null,
        longitude: form.longitude !== '' ? Number(form.longitude) : null,
        isPrimary: Boolean(form.isPrimary),
      };

      if (modalMode === 'CREATE') {
        await branchService.createBranch(payload);
        setSuccessMsg(`Branch "${payload.name}" registered successfully.`);
      } else {
        await branchService.updateBranch(editingBranch._id, payload);
        setSuccessMsg(`Branch "${payload.name}" updated successfully.`);
      }

      setBranchModalOpen(false);
      await fetchBranches(true);
    } catch (err) {
      console.error('Branch submission failed:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimary = async (branch) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await branchService.setPrimaryBranch(branch._id);
      setSuccessMsg(`"${branch.name}" is now the primary pickup branch.`);
      await fetchBranches(true);
    } catch (err) {
      console.error('Failed to set primary branch:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update primary branch.');
    }
  };

  const handleToggleStatus = async (branch) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const targetState = !branch.isActive;
      await branchService.toggleBranchStatus(branch._id, targetState);
      setSuccessMsg(`Branch "${branch.name}" ${targetState ? 'activated' : 'deactivated'}.`);
      await fetchBranches(true);
    } catch (err) {
      console.error('Failed to toggle branch status:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to toggle status.');
    }
  };

  const handleInspectInventory = async (branch) => {
    try {
      setInventoryLoading(true);
      setInventoryModalOpen(true);
      const res = await branchService.getBranchInventory(branch._id);
      setSelectedBranchInventory(res?.data || res);
    } catch (err) {
      console.error('Failed to load branch inventory:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Unable to load branch inventory telemetry.');
    } finally {
      setInventoryLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.isActive).length;
    const primary = branches.find((b) => b.isPrimary);
    return {
      total,
      active,
      primaryName: primary?.name || 'Not Designated',
    };
  }, [branches]);

  if (loading) {
    return <LoadingSpinner text="Loading store branches..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-8 sm:pb-12">
      {/* 1. Header */}
      <SellerPageHeader
        badge="STORE & LOCATIONS"
        title="Store Branches & Fulfillment Outlets"
        subtitle="Manage physical pickup locations, address credentials, and branch-dedicated inventory lots."
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => fetchBranches(true)}
              disabled={refreshing}
              className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 focus:outline-none"
              title="Refresh branches"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Branch</span>
            </button>
          </div>
        }
      />

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <MerchantStatCard
          label="Total Branches"
          value={kpis.total}
          subtext="Configured store locations"
          icon={Store}
          variant="navy"
        />

        <MerchantStatCard
          label="Active Pickup Points"
          value={kpis.active}
          subtext="Ready for customer checkout"
          icon={MapPin}
          variant="emerald"
        />

        <MerchantStatCard
          label="Primary Branch"
          value={kpis.primaryName}
          subtext="Default customer fulfillment node"
          icon={Star}
          variant="amber"
        />
      </div>

      {/* 3. Branch List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Fulfillment Locations</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {branches.length}
            </span>
          </h2>
        </div>

        {branches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No Branches Registered</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your store&apos;s physical branches or outlets so customers can select their preferred location during pickup orders.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register First Branch</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => {
              const fullAddress = [
                branch.address?.street,
                branch.address?.locality,
                `${branch.address?.city || ''}, ${branch.address?.state || ''} - ${branch.address?.pincode || ''}`,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={branch._id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between relative ${
                    branch.isPrimary
                      ? 'border-emerald-300 ring-1 ring-emerald-200 shadow-sm'
                      : branch.isActive
                      ? 'border-slate-200 hover:border-slate-300'
                      : 'border-slate-200 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Title + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug truncate">
                          {branch.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {branch.isPrimary && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Star className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                              Primary Branch
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              branch.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {branch.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openEditModal(branch)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Address Details */}
                    <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed line-clamp-2">{fullAddress}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{branch.contactPhone}</span>
                      </div>

                      {branch.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{branch.contactEmail}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{branch.operatingHours || '09:00 AM - 09:00 PM'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleInspectInventory(branch)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1.5 transition text-[11px]"
                    >
                      <Boxes className="w-3 h-3 text-slate-500" />
                      <span>Stock View</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {!branch.isPrimary && branch.isActive && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(branch)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg transition text-[11px]"
                        >
                          Make Primary
                        </button>
                      )}

                      {!branch.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(branch)}
                          className={`p-1.5 rounded-lg border transition ${
                            branch.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200'
                              : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                          title={branch.isActive ? 'Deactivate branch' : 'Activate branch'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Add / Edit Branch Modal */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-5 sm:p-6 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {modalMode === 'CREATE' ? 'Add Store Branch' : 'Edit Store Branch'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Physical location for customer pickup and inventory batch allocation.
                </p>
              </div>
              <button
                onClick={() => setBranchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Branch Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Branch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Indiranagar Metro Hub, Koramangala 4th Block"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                />
                {formErrors.name && <p className="text-rose-600 text-[10px] mt-1">{formErrors.name}</p>}
              </div>

              {/* Street Address */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="e.g. #45 100ft Road"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                />
                {formErrors.street && <p className="text-rose-600 text-[10px] mt-1">{formErrors.street}</p>}
              </div>

              {/* Locality & Landmark */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Locality / Sector</label>
                  <input
                    type="text"
                    value={form.locality}
                    onChange={(e) => setForm({ ...form, locality: e.target.value })}
                    placeholder="e.g. Indiranagar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Landmark (Optional)</label>
                  <input
                    type="text"
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                    placeholder="e.g. Near Metro Pillar 42"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                </div>
              </div>

              {/* City, State, PIN */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Bangalore"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                  {formErrors.city && <p className="text-rose-600 text-[10px] mt-1">{formErrors.city}</p>}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="Karnataka"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                  {formErrors.state && <p className="text-rose-600 text-[10px] mt-1">{formErrors.state}</p>}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="560038"
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                  {formErrors.pincode && <p className="text-rose-600 text-[10px] mt-1">{formErrors.pincode}</p>}
                </div>
              </div>

              {/* Contact Phone & Email */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                  {formErrors.contactPhone && <p className="text-rose-600 text-[10px] mt-1">{formErrors.contactPhone}</p>}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="branch@store.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={form.operatingHours}
                  onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
                  placeholder="e.g. 08:30 AM - 09:30 PM"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none text-xs"
                />
              </div>

              {/* Coordinates (Optional) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 mb-1 text-[11px]">Latitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="12.9784"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1 text-[11px]">Longitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="77.6408"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Primary Checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800 text-xs">
                  Designate as Store Primary Branch
                </span>
              </label>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBranchModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition text-xs shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : modalMode === 'CREATE' ? 'Create Branch' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Branch Inventory Inspection Modal */}
      {inventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 sm:p-6 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-emerald-600" />
                  <span>Branch Inventory — {selectedBranchInventory?.branch?.name || 'Loading...'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocated batch lots physically stored at this location.
                </p>
              </div>
              <button
                onClick={() => setInventoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inventoryLoading ? (
              <LoadingSpinner text="Loading branch inventory telemetry..." />
            ) : selectedBranchInventory ? (
              <div className="space-y-4">
                {/* Telemetry chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Total Lots</div>
                    <div className="text-base font-black text-slate-900">
                      {selectedBranchInventory.telemetry?.totalBatches || 0}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Available Units</div>
                    <div className="text-base font-black text-emerald-900">
                      {selectedBranchInventory.telemetry?.totalUnits || 0}
                    </div>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">Critical Lots</div>
                    <div className="text-base font-black text-rose-900">
                      {selectedBranchInventory.telemetry?.criticalLots || 0}
                    </div>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">Approaching</div>
                    <div className="text-base font-black text-amber-900">
                      {selectedBranchInventory.telemetry?.approachingLots || 0}
                    </div>
                  </div>
                </div>

                {/* Batch Table */}
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                  {selectedBranchInventory.batches?.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No active batches currently allocated to this branch.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Product & Lot</th>
                          <th className="p-2.5">Units</th>
                          <th className="p-2.5">Expiry</th>
                          <th className="p-2.5">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBranchInventory.batches.map((b) => (
                          <tr key={b._id} className="hover:bg-slate-50/70">
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900">{b.productId?.name || 'Item'}</div>
                              <div className="text-[10px] font-mono text-slate-400">Lot #{b.batchNumber}</div>
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{b.quantity}</td>
                            <td className="p-2.5 text-slate-600">
                              {b.remainingDays}d ({new Date(b.expiryDate).toLocaleDateString()})
                            </td>
                            <td className="p-2.5 font-bold text-emerald-700">₹{b.currentPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setInventoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerBranchesPage;

