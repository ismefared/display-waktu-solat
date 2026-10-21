import React, { useMemo, useState } from 'react';
import { Check, Compass, MapPin, Search, X } from 'lucide-react';
import { JAKIM_STATES, JAKIM_ZONES } from '../data/jakimZones';
import { LocationState, PrayerZone } from '../types/domain';

interface ZoneSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationState: LocationState;
  onSelectManualZone: (zoneCode: string) => void;
  onTriggerAutoDetect: () => void;
  isDetecting: boolean;
}

/**
 * Location Detection & Manual JAKIM Prayer Zone Selection Modal
 * Traceability: LOC-001 (Auto Geolocation + Status), LOC-002 (Manual Fallback without silent override)
 */
export const ZoneSelectorModal: React.FC<ZoneSelectorModalProps> = ({
  isOpen,
  onClose,
  locationState,
  onSelectManualZone,
  onTriggerAutoDetect,
  isDetecting,
}) => {
  const [selectedState, setSelectedState] = useState<string>(
    locationState.activeZone.state
  );
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredZones = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return JAKIM_ZONES.filter((zone) => {
      if (q) {
        return (
          zone.code.toLowerCase().includes(q) ||
          zone.name.toLowerCase().includes(q) ||
          zone.state.toLowerCase().includes(q)
        );
      }
      return zone.state === selectedState;
    });
  }, [selectedState, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-zone-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
    >
      <div className="w-full max-w-4xl bg-[#0A1513] border border-white/15 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#07100E] border-b border-white/10">
          <div>
            <h2
              id="modal-zone-title"
              className="text-xl font-bold text-slate-50"
            >
              Tetapan Lokasi & Zon Waktu Solat JAKIM
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Pilih zon waktu solat rasmi JAKIM secara manual atau kesan lokasi peranti secara automatik.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Tetapan Zon"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Location Status & Auto-Detect Control (LOC-001) */}
        <div className="px-6 py-4 bg-emerald-950/30 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Mod Semasa:</span>
              <span className="font-semibold text-amber-300">
                {locationState.mode === 'AUTO'
                  ? 'Pengesanan Lokasi Automatik (GPS)'
                  : 'Pilihan Zon Manual'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Status: {locationState.status}</span>
            </div>
            <div className="text-sm sm:text-base font-semibold text-slate-100">
              {locationState.activeZone.code} — {locationState.activeZone.name} (
              {locationState.activeZone.state})
            </div>
            <p className="text-xs text-slate-300">
              {locationState.statusMessageBM}
              {locationState.coordinates && (
                <span className="font-mono-tabular text-slate-400 ml-2">
                  ({locationState.coordinates.lat.toFixed(4)}°N,{' '}
                  {locationState.coordinates.lng.toFixed(4)}°E)
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={isDetecting}
            onClick={onTriggerAutoDetect}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>
              {isDetecting ? 'Mengesan Lokasi...' : 'Kesan Lokasi Automatik'}
            </span>
          </button>
        </div>

        {/* Search & State Filter (LOC-002) */}
        <div className="px-6 py-3.5 border-b border-white/10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#081210]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kod zon (cth: WLY01, SGR01) atau nama daerah..."
              className="w-full pl-10 pr-4 py-2 bg-[#060D0C] border border-white/15 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Kosongkan Carian
            </button>
          )}
        </div>

        {/* Main Body: States Sidebar + Zone List */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[340px]">
          {/* State Selector Column */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto p-3 space-y-1 bg-[#07100E]">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">
              Senarai Negeri ({JAKIM_STATES.length})
            </div>
            {JAKIM_STATES.map((stateName) => {
              const isSelected = !searchTerm && selectedState === stateName;
              return (
                <button
                  key={stateName}
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedState(stateName);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-900/60 text-amber-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{stateName}</span>
                  {locationState.activeZone.state === stateName && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Zones List Column */}
          <div className="md:col-span-8 overflow-y-auto p-4 space-y-2.5 bg-[#0A1513]">
            {filteredZones.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Tiada zon ditemui untuk carian &ldquo;{searchTerm}&rdquo;.
              </div>
            ) : (
              filteredZones.map((zone: PrayerZone) => {
                const isActive = zone.code === locationState.activeZone.code;
                return (
                  <button
                    key={zone.code}
                    type="button"
                    onClick={() => {
                      onSelectManualZone(zone.code);
                      onClose();
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-colors flex items-start justify-between gap-4 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-950/70 border-amber-400/70 text-slate-50'
                        : 'bg-[#07100E] border-white/10 hover:border-white/25 text-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-tabular font-bold text-base text-amber-400">
                          {zone.code}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-emerald-300">
                          {zone.state}
                        </span>
                      </div>
                      <p className="text-sm text-slate-100 leading-snug">
                        {zone.name}
                      </p>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                          <Check className="w-4 h-4" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Pilih</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#07100E] border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Sumber Zon Rasmi: Portal e-Solat JAKIM (60 Zon Seluruh Malaysia)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
