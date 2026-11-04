import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'nearexpiry_customer_location';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [location, setLocationState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved location from localStorage:', e);
    }
    return null;
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Sync with localStorage
  const setLocation = useCallback((newLoc) => {
    try {
      if (newLoc) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLoc));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save location to localStorage:', e);
    }
    setLocationState(newLoc);
    setLocationError(null);
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
  }, [setLocation]);

  const openLocationModal = useCallback(() => {
    setLocationError(null);
    setIsLocationModalOpen(true);
  }, []);

  const closeLocationModal = useCallback(() => {
    setIsLocationModalOpen(false);
    setLocationError(null);
  }, []);

  /**
   * Request device GPS coordinates with graceful permission handling
   */
  const requestDeviceLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const errMsg = 'Geolocation is not supported by your browser. Please enter your PIN code or city manually.';
      setLocationError(errMsg);
      return { success: false, error: errMsg };
    }

    setIsLocating(true);
    setLocationError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Build location object with coordinates
          let friendlyLabel = `GPS: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
          let city = '';
          let pincode = '';

          // Attempt lightweight reverse-geocoding (with short timeout and silent fallback)
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const detectedCity = addr.city || addr.town || addr.village || addr.county || '';
              const detectedPin = addr.postcode || '';
              const detectedSub = addr.suburb || addr.neighbourhood || '';
              if (detectedCity || detectedSub) {
                friendlyLabel = [detectedSub, detectedCity].filter(Boolean).join(', ');
              }
              city = detectedCity;
              pincode = detectedPin;
            }
          } catch {
            // Geocoding network failed or timed out — keep friendly GPS coordinates label
          }

          const locObj = {
            type: 'coords',
            value: `${lat.toFixed(4)},${lng.toFixed(4)}`,
            label: friendlyLabel,
            latitude: lat,
            longitude: lng,
            city,
            pincode,
            radiusKm: 25,
          };

          setLocation(locObj);
          setIsLocating(false);
          resolve({ success: true, location: locObj });
        },
        (error) => {
          setIsLocating(false);
          let message = 'Could not access your location.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location access was denied. You can manually enter your PIN code or city.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Device location is currently unavailable. Please enter your PIN code or city.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out. Please enter your PIN code or city.';
          }
          setLocationError(message);
          resolve({ success: false, error: message });
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  }, [setLocation]);

  const value = {
    location,
    setLocation,
    clearLocation,
    isLocationModalOpen,
    openLocationModal,
    closeLocationModal,
    requestDeviceLocation,
    isLocating,
    locationError,
    setLocationError,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useCustomerLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useCustomerLocation must be used within a LocationProvider');
  }
  return context;
};

export const useLocationContext = useCustomerLocation;

