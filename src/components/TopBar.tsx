import React from 'react';
import { Maximize2, Minimize2, MapPin, Radio, Tv } from 'lucide-react';
import { LocationState } from '../types/domain';

interface TopBarProps {
  activeView: 'primary' | 'stream' | 'sender';
  onSelectView: (view: 'primary' | 'stream' | 'sender') => void;
  locationState: LocationState;
  onOpenZoneModal: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Top Bar Navigation Component
 * Strictly follows the 3-Zone Top Bar Contract with responsive shrink/truncation safety (`min-w-0`):
 * Zone 1: Single text element Brand Title
 * Zone 2: Clean single-line navigation links
 * Zone 3: 1-2 primary actions (Zone Selector & Fullscreen Kiosk Toggle)
 */
export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  locationState,
  onOpenZoneModal,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <header className="w-full flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-2.5 bg-[#081210] border-b border-white/10 shrink-0 min-w-0">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#paparan-utama"
        onClick={(e) => {
          e.preventDefault();
          onSelectView('primary');
        }}
        className="text-sm sm:text-base xl:text-lg font-bold tracking-tight text-slate-50 truncate min-w-0 max-w-[180px] sm:max-w-none"
      >
        Display Waktu Solat Malaysia
      </a>

      {/* Zone 2: Clean text navigation links */}
      <nav
        aria-label="Navigasi Utama"
        className="flex items-center gap-3 sm:gap-6 md:gap-7 text-xs sm:text-sm xl:text-base font-medium text-slate-300 shrink-0"
      >
        <button
          type="button"
          onClick={() => onSelectView('primary')}
          className={`inline-flex items-center gap-1.5 py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeView === 'primary'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-slate-300 hover:text-white'
          }`}
        >
          <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden xs:inline sm:inline">Paparan Waktu Solat</span>
          <span className="inline sm:hidden">Waktu Solat</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('stream')}
          className={`inline-flex items-center gap-1.5 py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeView === 'stream'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-slate-300 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">Paparan Siaran Langsung</span>
          <span className="inline sm:hidden">Siaran</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('sender')}
          className={`hidden md:inline-flex items-center gap-1.5 py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeView === 'sender'
              ? 'border-amber-400 text-amber-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span>Mod Kamera Telefon</span>
        </button>
      </nav>

      {/* Zone 3: 1-2 Primary Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenZoneModal}
          title="Pilih atau Kesan Zon Waktu Solat JAKIM"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs xl:text-sm font-semibold text-slate-100 bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-700/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono-tabular text-amber-300">
            {locationState.activeZone.code}
          </span>
          <span className="hidden xl:inline truncate max-w-[180px] text-slate-200">
            {locationState.activeZone.state}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Keluar Skrin Penuh' : 'Paparan Skrin Penuh (Kiosk)'}
          aria-label={isFullscreen ? 'Keluar Skrin Penuh' : 'Paparan Skrin Penuh'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs xl:text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
          )}
          <span className="hidden 2xl:inline">
            {isFullscreen ? 'Keluar Penuh' : 'Skrin Penuh'}
          </span>
        </button>
      </div>
    </header>
  );
};
