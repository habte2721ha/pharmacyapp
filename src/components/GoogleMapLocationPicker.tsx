import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, MapMouseEvent, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, Check, X, Compass, AlertCircle, Sparkles } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Default center: Addis Ababa, Ethiopia (9.0102, 38.7612)
const DEFAULT_CENTER = { lat: 9.0102, lng: 38.7612 };

interface LocationPickerProps {
  initialAddress?: string;
  onSelectLocation: (locationData: { address: string; lat?: number; lng?: number }) => void;
  onClose: () => void;
}

// Inner map handler component to access Google Maps hooks
function MapLocationHandler({
  selectedPos,
  setSelectedPos,
  setAddressText,
  searchQuery,
  setSearchQuery
}: {
  selectedPos: { lat: number; lng: number };
  setSelectedPos: (pos: { lat: number; lng: number }) => void;
  setAddressText: (addr: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');

  // Reverse Geocode coordinates to address string
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (geocodingLib) {
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const formatted = results[0].formatted_address;
          setAddressText(formatted);
        } else {
          setAddressText(`Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        }
      });
    } else {
      setAddressText(`Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    }
  }, [geocodingLib, setAddressText]);

  // Handle map click to place pin
  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const newPos = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setSelectedPos(newPos);
      reverseGeocode(newPos.lat, newPos.lng);
    }
  };

  // Perform text search if user submitted search query
  useEffect(() => {
    if (!placesLib || !searchQuery.trim()) return;

    const service = new placesLib.PlacesService(document.createElement('div'));
    service.textSearch({ query: searchQuery }, (results, status) => {
      if (status === placesLib.PlacesServiceStatus.OK && results && results[0]) {
        const place = results[0];
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const newPos = { lat, lng };
          setSelectedPos(newPos);
          if (place.formatted_address) {
            setAddressText(place.formatted_address);
          } else {
            reverseGeocode(lat, lng);
          }
          if (map) {
            map.panTo(newPos);
            map.setZoom(16);
          }
        }
      }
    });
  }, [placesLib, searchQuery, map, setSelectedPos, setAddressText, reverseGeocode]);

  return (
    <>
      <Map
        defaultCenter={selectedPos}
        defaultZoom={15}
        mapId="DEMO_MAP_ID"
        onClick={handleMapClick}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <AdvancedMarker
          position={selectedPos}
          draggable={true}
          onDragEnd={(e) => {
            if (e.latLng) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              const newPos = { lat, lng };
              setSelectedPos(newPos);
              reverseGeocode(lat, lng);
            }
          }}
        >
          <Pin background="#ea580c" glyphColor="#ffffff" borderColor="#9a3412" scale={1.2} />
        </AdvancedMarker>
      </Map>
    </>
  );
}

export default function GoogleMapLocationPicker({
  initialAddress = '',
  onSelectLocation,
  onClose
}: LocationPickerProps) {
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [addressText, setAddressText] = useState(initialAddress || '');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [gettingGps, setGettingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Handle GPS location click
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGettingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSelectedPos(newPos);
        setAddressText(`My Location (GPS: ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)})`);
        setGettingGps(false);
      },
      (err) => {
        console.warn('GPS Error:', err);
        setGpsError('Unable to retrieve GPS coordinates. Please click directly on the map.');
        setGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmLocation = () => {
    if (!addressText.trim()) {
      alert('Please select a location on the map or enter address text.');
      return;
    }
    onSelectLocation({
      address: addressText.trim(),
      lat: selectedPos.lat,
      lng: selectedPos.lng
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <MapPin className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">Set Delivery Location on Google Map</h3>
              <p className="text-[11px] text-emerald-100">Tap anywhere on map or use GPS to set exact drop-off spot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Action Controls Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveSearch(searchInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search area, neighborhood, or building name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shrink-0 transition"
            >
              Search
            </button>
          </form>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={gettingGps}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Navigation className={`w-3.5 h-3.5 ${gettingGps ? 'animate-spin' : ''}`} />
              <span>{gettingGps ? 'Detecting GPS...' : 'Use My Current GPS Location'}</span>
            </button>

            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block">
              Coordinates: {selectedPos.lat.toFixed(4)}, {selectedPos.lng.toFixed(4)}
            </span>
          </div>

          {gpsError && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{gpsError}</span>
            </div>
          )}
        </div>

        {/* Interactive Google Map Container */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] bg-slate-100 dark:bg-slate-950">
          {hasValidKey ? (
            <APIProvider apiKey={API_KEY} version="weekly">
              <MapLocationHandler
                selectedPos={selectedPos}
                setSelectedPos={setSelectedPos}
                setAddressText={setAddressText}
                searchQuery={activeSearch}
                setSearchQuery={setActiveSearch}
              />
            </APIProvider>
          ) : (
            /* Interactive Map View (Google Maps API or OpenStreetMap Interactive Map) */
            <div className="relative w-full h-full min-h-[300px] flex flex-col">
              {hasValidKey ? (
                <APIProvider apiKey={API_KEY} version="weekly">
                  <MapLocationHandler
                    selectedPos={selectedPos}
                    setSelectedPos={setSelectedPos}
                    setAddressText={setAddressText}
                    searchQuery={activeSearch}
                    setSearchQuery={setActiveSearch}
                  />
                </APIProvider>
              ) : (
                <div className="relative w-full h-full flex flex-col bg-slate-900 text-white overflow-hidden">
                  {/* Interactive OpenStreetMap Map Frame */}
                  <iframe
                    title="Interactive Location Map"
                    width="100%"
                    height="100%"
                    className="w-full h-full border-0 min-h-[260px] opacity-90 hover:opacity-100 transition"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedPos.lng - 0.035}%2C${selectedPos.lat - 0.025}%2C${selectedPos.lng + 0.035}%2C${selectedPos.lat + 0.025}&layer=mapnik&marker=${selectedPos.lat}%2C${selectedPos.lng}`}
                  />

                  {/* Interactive Quick Pin Subcity Overlay */}
                  <div className="absolute top-2 left-2 right-2 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-slate-700/80 shadow-xl space-y-1.5 z-10">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-emerald-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tap Subcity / Landmark to Pin Location:</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Addis Ababa</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {[
                        { name: 'Bole Medhanealem', lat: 8.9972, lng: 38.7865, sub: 'Bole Subcity, Near Medhanealem Church' },
                        { name: 'Kazanchis / ECA', lat: 9.0182, lng: 38.7635, sub: 'Kirkos Subcity, Kazanchis Business District' },
                        { name: 'CMC Michael', lat: 9.0225, lng: 38.8231, sub: 'Yeka Subcity, CMC Michael Square' },
                        { name: 'Sarbet / AU', lat: 8.9950, lng: 38.7390, sub: 'Nifas Silk Subcity, Near African Union' },
                        { name: 'Megenagna Square', lat: 9.0190, lng: 38.8010, sub: 'Yeka Subcity, Megenagna Station' },
                        { name: 'Gotera Interchange', lat: 8.9830, lng: 38.7580, sub: 'Nifas Silk Subcity, Gotera Condo' },
                        { name: 'Piassa / Churchhill', lat: 9.0320, lng: 38.7520, sub: 'Arada Subcity, Piassa Commercial Area' },
                        { name: 'Merkato Market', lat: 9.0300, lng: 38.7380, sub: 'Addis Ketema Subcity, Merkato Main Street' },
                        { name: 'Mexico Square', lat: 9.0105, lng: 38.7470, sub: 'Kirkos Subcity, Mexico Square' },
                        { name: 'Summit Condo', lat: 9.0280, lng: 38.8520, sub: 'Bole Subcity, Summit Phase 1' },
                        { name: 'Bethel Hospital', lat: 8.9850, lng: 38.7050, sub: 'Kolfe Keraniyo Subcity, Bethel Area' },
                        { name: 'Gerji Imperial', lat: 9.0060, lng: 38.8020, sub: 'Bole Subcity, Gerji Alsam Tower' },
                        { name: 'Lideta / Balcha', lat: 9.0140, lng: 38.7360, sub: 'Lideta Subcity, Near Balcha Hospital' }
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            const newPos = { lat: item.lat, lng: item.lng };
                            setSelectedPos(newPos);
                            setAddressText(`${item.name}, ${item.sub}, Addis Ababa`);
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            addressText.includes(item.name)
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105'
                              : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Location Confirmation Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Selected Delivery Address & Landmarks
            </label>
            <input
              type="text"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="e.g. Bole Road, Near Friendship Building, House #102, Addis Ababa"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLocation}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
