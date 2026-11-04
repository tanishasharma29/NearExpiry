import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  X,
  Check,
  AlertCircle,
  Building2,
  Store,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { useCustomerLocation } from '../../context/LocationContext';
import { branchService } from '../../services/branchService';
import { storeService } from '../../services/storeService';

const QUICK_LOCATIONS = [
  { label: 'Indiranagar, Bangalore', pincode: '560038', city: 'Bangalore' },
  { label: 'Koramangala, Bangalore', pincode: '560034', city: 'Bangalore' },
  { label: 'Whitefield, Bangalore', pincode: '560066', city: 'Bangalore' },
  { label: 'Jayanagar, Bangalore', pincode: '560041', city: 'Bangalore' },
  { label: 'Mumbai Central', pincode: '400008', city: 'Mumbai' },
  { label: 'Delhi NCR', pincode: '110001', city: 'Delhi' },
];

export const LocationModal = () => {
  const {
    location,
    setLocation,
    clearLocation,
    isLocationModalOpen,
    closeLocationModal,
    requestDeviceLocation,
    isLocating,
    locationError,
    setLocationError,
  } = useCustomerLocation();

  const [inputVal, setInputVal] = useState('');
  const [activeBranches, setActiveBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (!isLocationModalOpen) return;
    let isMounted = true;
    setLoadingBranches(true);

    const loadBranches = async () => {
      try {
        let list = [];
        // Primary strategy: Dedicated public active branches endpoint
        try {
          const res = await branchService.getActiveBranches();
          list = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.branches)
            ? res.branches
            : res?.data?.branches || [];
        } catch (e) {
          console.warn('getActiveBranches endpoint unavailable, attempting fallback discovery:', e);
        }

        // Fallback strategy 1: Authenticated seller own-store branches
        if (!list || list.length === 0) {
          try {
            const myRes = await branchService.getMyBranches();
            const myBranches = myRes?.data?.branches || myRes?.branches || [];
            if (Array.isArray(myBranches) && myBranches.length > 0) {
              list = myBranches.map((b) => ({
                _id: b._id,
                name: b.name,
                storeId: b.storeId,
                address: b.address,
                contactPhone: b.contactPhone,
                operatingHours: b.operatingHours,
                isPrimary: b.isPrimary,
              }));
            }
          } catch (_) {
            // Not a logged-in seller, continue
          }
        }

        // Fallback strategy 2: Public stores discovery
        if (!list || list.length === 0) {
          try {
            const storeRes = await storeService.getStores();
            const stores =
              storeRes?.stores ||
              storeRes?.data?.stores ||
              (Array.isArray(storeRes) ? storeRes : []);
            if (stores.length > 0) {
              const branchPromises = stores.slice(0, 5).map((s) =>
                branchService.getStoreBranches(s._id).catch(() => ({ branches: [] }))
              );
              const branchResults = await Promise.all(branchPromises);
              const collected = [];
              branchResults.forEach((r) => {
                const brs = r?.branches || r?.data?.branches || [];
                collected.push(...brs);
              });
              if (collected.length > 0) {
                list = collected;
              }
            }
          } catch (_) {}
        }

        if (isMounted) {
          setActiveBranches(list || []);
        }
      } catch (err) {
        console.warn('Failed to load active branches for location picker:', err);
      } finally {
        if (isMounted) setLoadingBranches(false);
      }
    };

    loadBranches();

    return () => {
      isMounted = false;
    };
  }, [isLocationModalOpen]);

  if (!isLocationModalOpen) return null;

  const handleBranchSelect = (br) => {
    setLocation({
      type: 'branch',
      branchId: br._id,
      storeId: br.storeId,
      pincode: br.address?.pincode,
      city: br.address?.city,
      label: `${br.name} (${br.address?.city || ''}${br.address?.pincode ? ` - ${br.address.pincode}` : ''})`,
      value: br.address?.pincode || br.address?.city || br.name,
    });
    closeLocationModal();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const query = inputVal.trim();
    if (!query) {
      setLocationError('Please enter a PIN code, city, or locality.');
      return;
    }

    const isSixDigitPin = /^\d{6}$/.test(query);
    const newLocation = {
      type: isSixDigitPin ? 'pincode' : 'city',
      value: query,
      label: query,
      pincode: isSixDigitPin ? query : undefined,
      city: !isSixDigitPin ? query : undefined,
    };

    setLocation(newLocation);
    setInputVal('');
    closeLocationModal();
  };

  const handleQuickSelect = (loc) => {
    setLocation({
      type: 'pincode',
      value: loc.pincode,
      label: loc.label,
      pincode: loc.pincode,
      city: loc.city,
    });
    closeLocationModal();
  };

  const handleGpsClick = async () => {
    const res = await requestDeviceLocation();
    if (res.success) {
      closeLocationModal();
    }
  };

  const handleClear = () => {
    clearLocation();
    closeLocationModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeLocationModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/80 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 id="location-modal-title" className="text-base font-extrabold text-gray-900">
                Choose Your Location
              </h3>
              <p className="text-xs text-gray-500">
                Discover near-expiry groceries from stores in your area
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeLocationModal}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Device Location Button */}
          <button
            type="button"
            onClick={handleGpsClick}
            disabled={isLocating}
            className="w-full py-3 px-4 rounded-xl border border-brand-200 bg-brand-50/60 hover:bg-brand-100/70 text-brand-900 font-bold text-sm flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-60 shadow-xs"
          >
            <Navigation className={`w-4 h-4 text-brand-700 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Detecting your location...' : 'Use My Current Location (GPS)'}</span>
          </button>

          {/* Error Message */}
          {locationError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{locationError}</span>
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider absolute">
              or enter manually
            </span>
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter 6-digit PIN code or City (e.g. 560038, Bangalore)..."
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  if (locationError) setLocationError(null);
                }}
                className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition outline-none font-medium"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-xs"
              >
                Apply
              </button>
            </div>
          </form>

          {/* Registered Store Branches & Fulfillment Outlets */}
          {loadingBranches && activeBranches.length === 0 && (
            <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-xl animate-pulse flex items-center justify-center gap-2">
              <Store className="w-3.5 h-3.5 text-brand-600 animate-spin" />
              <span>Discovering nearby store branches...</span>
            </div>
          )}

          {activeBranches.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-brand-600" />
                  <span>Store Outlets & Pickup Branches</span>
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  {activeBranches.length} active
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {activeBranches.map((br) => {
                  const isSelected =
                    location?.branchId === br._id ||
                    (location?.pincode && br.address?.pincode === location.pincode);
                  const cityStr = br.address?.city || '';
                  const pinStr = br.address?.pincode ? ` - ${br.address.pincode}` : '';
                  const locLine = [br.address?.locality || br.address?.street, cityStr].filter(Boolean).join(', ');

                  return (
                    <button
                      key={br._id}
                      type="button"
                      onClick={() => handleBranchSelect(br)}
                      className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/70 text-brand-900 shadow-2xs font-semibold'
                          : 'border-gray-200/90 hover:border-brand-300 hover:bg-gray-50/80 bg-white text-gray-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs truncate text-gray-900">
                            {br.name}
                          </span>
                          {br.isPrimary && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                              Main Store
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          <span>{locLine}{pinStr}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Location Suggestions */}
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Popular Areas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LOCATIONS.map((loc) => {
                const isSelected =
                  location?.pincode === loc.pincode ||
                  (location?.city?.toLowerCase() === loc.city.toLowerCase() && !location?.pincode);
                return (
                  <button
                    key={loc.pincode}
                    type="button"
                    onClick={() => handleQuickSelect(loc)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-xs font-semibold'
                        : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700'
                    }`}
                  >
                    <span>{loc.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Selection / Reset */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            {location ? (
              <div className="flex items-center gap-1.5 text-gray-600 truncate">
                <span className="text-gray-400">Selected:</span>
                <span className="font-bold text-brand-700 truncate">{location.label || location.value}</span>
              </div>
            ) : (
              <span className="text-gray-400">Currently showing: All Locations</span>
            )}

            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>All Locations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

