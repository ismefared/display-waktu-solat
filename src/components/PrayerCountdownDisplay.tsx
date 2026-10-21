import React from 'react';
import { Clock, BellRing, Sparkles } from 'lucide-react';
import { OverlayDensity, ResolvedPrayerState } from '../types/domain';

interface PrayerCountdownDisplayProps {
  resolvedPrayer: ResolvedPrayerState | null;
  overlayDensity?: OverlayDensity;
  activeZoneCode?: string;
  activeZoneName?: string;
  currentTimeFormatted?: string;
  className?: string;
}

export const PrayerCountdownDisplay: React.FC<PrayerCountdownDisplayProps> = ({
  resolvedPrayer,
  overlayDensity = 'standard',
  activeZoneCode,
  activeZoneName,
  currentTimeFormatted,
  className = '',
}) => {
  if (!resolvedPrayer) {
    return null;
  }

  const { nextPrayer, countdown } = resolvedPrayer;
  const isFinal15Minutes = countdown.totalSeconds <= 15 * 60 && countdown.totalSeconds > 0;
  const isFinalMinute = countdown.totalSeconds <= 60 && countdown.totalSeconds > 0;
  const isZeroOrEntering = countdown.totalSeconds === 0;

  // Split formatted digits for smooth tabular layout
  const hh = String(countdown.hours).padStart(2, '0');
  const mm = String(countdown.minutes).padStart(2, '0');
  const ss = String(countdown.seconds).padStart(2, '0');

  // Minimal density layout
  if (overlayDensity === 'minimal') {
    return (
      <div
        data-testid="prayer-overlay-card"
        data-density="minimal"
        className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-[#061A14]/90 backdrop-blur-md border ${
          isFinalMinute
            ? 'border-amber-400 shadow-amber-500/20 shadow-lg'
            : isFinal15Minutes
            ? 'border-amber-400/70'
            : 'border-emerald-500/30'
        } rounded-xl text-white select-none transition-all duration-300 ${className}`}
      >
        <BellRing
          className={`w-3.5 h-3.5 ${
            isFinal15Minutes
              ? 'text-amber-400 motion-safe:animate-pulse'
              : 'text-emerald-400'
          }`}
        />
        <span className="text-xs font-bold text-amber-300">
          {nextPrayer.labelBM} ({nextPrayer.time24})
        </span>
        <span aria-hidden="true" className="text-slate-500">
          ·
        </span>
        <span
          data-testid="prayer-countdown-digits"
          className="font-mono-tabular font-black text-sm tracking-wider text-amber-400"
        >
          -{countdown.formatted}
        </span>
      </div>
    );
  }

  // Compact density layout
  if (overlayDensity === 'compact') {
    return (
      <div
        data-testid="prayer-overlay-card"
        data-density="compact"
        className={`pointer-events-auto flex items-center gap-3 px-4 py-2 bg-[#061A14]/90 backdrop-blur-md border ${
          isFinalMinute
            ? 'border-amber-400 shadow-amber-500/25 shadow-xl'
            : isFinal15Minutes
            ? 'border-amber-400/80'
            : 'border-emerald-500/40'
        } rounded-xl text-white select-none transition-all duration-300 ${className}`}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
          {currentTimeFormatted && (
            <span className="font-mono-tabular text-xs font-semibold text-slate-300">
              {currentTimeFormatted}
            </span>
          )}
        </div>
        <span aria-hidden="true" className="text-slate-600">
          |
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">Solat Seterusnya:</span>
          <strong className="text-xs sm:text-sm font-bold text-amber-300">
            {nextPrayer.labelBM} ({nextPrayer.time24})
          </strong>
        </div>
        <div
          data-testid="prayer-countdown-digits"
          className={`font-mono-tabular text-base sm:text-lg font-black tracking-wider ${
            isFinalMinute
              ? 'text-amber-400 motion-safe:animate-pulse'
              : isFinal15Minutes
              ? 'text-amber-300'
              : 'text-amber-400'
          }`}
        >
          -{countdown.formatted}
        </div>
        {isFinal15Minutes && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/40 rounded-md">
            <Sparkles className="w-3 h-3 text-amber-400" />
            15m Menjelang
          </span>
        )}
      </div>
    );
  }

  // Standard Density Card (Default TV Broadcast Overlay)
  return (
    <aside
      aria-label="Maklumat Solat dan Unduran Masa Semasa Siaran"
      data-testid="prayer-overlay-card"
      data-density="standard"
      className={`pointer-events-auto relative bg-[#061A14]/90 backdrop-blur-md border ${
        isFinalMinute
          ? 'border-amber-400 shadow-amber-500/20 shadow-2xl'
          : isFinal15Minutes
          ? 'border-amber-400/70 shadow-lg'
          : 'border-emerald-500/40 shadow-xl'
      } rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 text-white max-w-sm sm:max-w-md select-none transition-all duration-300 ${className}`}
    >
      {/* Header: Zone & Live Clock */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
            Waktu Solat JAKIM
          </div>
          {activeZoneCode && (
            <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">
              Zon {activeZoneCode} {activeZoneName ? `(${activeZoneName})` : ''}
            </div>
          )}
        </div>

        {currentTimeFormatted && (
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400 font-medium">
              Waktu Semasa
            </div>
            <div className="font-mono-tabular text-xs sm:text-sm font-bold text-emerald-300">
              {currentTimeFormatted}
            </div>
          </div>
        )}
      </div>

      {/* Main Body: Next Prayer Details & Big Animated Tabular Countdown */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300">
          <span>Solat Seterusnya:</span>
          <strong className="text-amber-300 font-bold text-sm sm:text-base">
            {nextPrayer.labelBM} ({nextPrayer.time24})
          </strong>
        </div>

        {/* Tabular Digit Transitions */}
        <div className="pt-1 flex items-baseline justify-between gap-2">
          <div
            data-testid="prayer-countdown-digits"
            className={`font-mono-tabular text-3xl sm:text-4xl font-black tracking-tight ${
              isFinalMinute
                ? 'text-amber-400 motion-safe:animate-pulse'
                : isFinal15Minutes
                ? 'text-amber-300'
                : 'text-amber-400'
            }`}
          >
            <span className="text-slate-400 mr-0.5">-</span>
            <span>{hh}</span>
            <span className="text-slate-500 mx-0.5">:</span>
            <span>{mm}</span>
            <span className="text-slate-500 mx-0.5">:</span>
            <span>{ss}</span>
          </div>

          {/* 15-Minute or Final-Minute Visual Indicator */}
          {isFinalMinute ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 bg-amber-500 text-slate-950 rounded-lg shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              SAAT AKHIR
            </span>
          ) : isFinal15Minutes ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/50 rounded-lg">
              <Sparkles className="w-3 h-3 text-amber-400" />
              15 MINIT
            </span>
          ) : isZeroOrEntering ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
              MASUK WAKTU
            </span>
          ) : null}
        </div>
      </div>
    </aside>
  );
};
