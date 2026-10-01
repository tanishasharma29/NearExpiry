import React from 'react';
import { MapPin } from 'lucide-react';

export const DistanceBadge = ({ distanceKm, storeName, city }) => {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <MapPin className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
      <span className="truncate max-w-[130px] font-medium text-gray-700">{storeName || 'Hyperlocal Store'}</span>
      {distanceKm !== undefined && distanceKm !== null && (
        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[11px] font-semibold">
          {Number(distanceKm).toFixed(1)} km
        </span>
      )}
      {city && <span className="text-gray-400 hidden sm:inline">({city})</span>}
    </div>
  );
};
