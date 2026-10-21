import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, AlertTriangle, Info, Bell } from 'lucide-react';
import { AnnouncementItem, TickerConfig } from '../types/domain';
import { AnnouncementService } from '../services/announcementService';

interface AnnouncementTickerProps {
  announcements?: AnnouncementItem[];
  tickerConfig?: TickerConfig;
  nowEpochMs?: number;
  className?: string;
}

const SPEED_SECONDS_MAP: Record<TickerConfig['speed'], number> = {
  SLOW: 45,
  NORMAL: 30,
  FAST: 18,
};

export const AnnouncementTicker: React.FC<AnnouncementTickerProps> = ({
  announcements = [],
  tickerConfig,
  nowEpochMs = Date.now(),
  className = '',
}) => {
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeCycleIndex, setActiveCycleIndex] = useState<number>(0);

  const activeAnnouncements = useMemo(() => {
    return AnnouncementService.filterActiveAnnouncements(
      announcements,
      nowEpochMs
    );
  }, [announcements, nowEpochMs]);

  const effectiveConfig: TickerConfig = tickerConfig || {
    speed: 'NORMAL',
    staticFallbackText:
      'Sila lurus dan rapatkan saf serta senyapkan telefon bimbit anda di dalam dewan solat.',
    enabled: true,
  };

  // Auto-cycle index for static fallback or reduced-motion environments
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      if (!isPaused) {
        setActiveCycleIndex((prev) => (prev + 1) % activeAnnouncements.length);
      }
    }, (SPEED_SECONDS_MAP[effectiveConfig.speed] || 30) * 1000);

    return () => clearInterval(interval);
  }, [activeAnnouncements.length, effectiveConfig.speed, isPaused]);

  if (!effectiveConfig.enabled) {
    return null;
  }

  const hasAnnouncements = activeAnnouncements.length > 0;
  const currentItem = hasAnnouncements
    ? activeAnnouncements[activeCycleIndex % activeAnnouncements.length]
    : null;

  const durationSec = SPEED_SECONDS_MAP[effectiveConfig.speed] || 30;

  return (
    <footer
      aria-label="Pengumuman Pentadbiran Masjid"
      data-testid="announcement-ticker"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={`w-full bg-[#030B09]/95 backdrop-blur-md border-t border-amber-500/30 text-white flex items-center shadow-2xl relative z-30 select-none overflow-hidden ${className}`}
    >
      {/* Left Anchor Badge: Icon & Label */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 sm:py-3 bg-[#081F17] border-r border-amber-500/20 z-10 shadow-lg">
        {currentItem?.priority === 'URGENT' ? (
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0 motion-safe:animate-bounce" />
        ) : currentItem?.priority === 'IMPORTANT' ? (
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-300 whitespace-nowrap">
          PENGUMUMAN
        </span>
      </div>

      {/* Ticker Stage Area */}
      <div className="flex-1 min-w-0 overflow-hidden relative py-2.5 sm:py-3 px-4">
        {hasAnnouncements ? (
          /* Marquee Track */
          <div
            className={`flex items-center gap-8 whitespace-nowrap will-change-transform ${
              isPaused ? 'animation-play-state-paused' : ''
            }`}
            style={{
              animation: `tickerScroll ${durationSec}s linear infinite`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          >
            {activeAnnouncements.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                data-testid="announcement-ticker-item"
                className="inline-flex items-center gap-3 shrink-0"
              >
                {/* Priority Badge */}
                {item.priority === 'URGENT' && (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">
                    Penting
                  </span>
                )}
                {item.priority === 'IMPORTANT' && (
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[11px] sm:text-xs uppercase tracking-wider">
                    Perhatian
                  </span>
                )}
                {item.title && (
                  <strong className="text-amber-300 font-bold text-sm sm:text-base lg:text-lg">
                    {item.title}:
                  </strong>
                )}
                <span
                  data-testid="announcement-ticker-text"
                  className="text-slate-100 font-medium text-sm sm:text-base lg:text-lg leading-normal tracking-wide drop-shadow"
                >
                  {item.message}
                </span>
                <span aria-hidden="true" className="text-amber-500/60 mx-2 text-lg">
                  ◆
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Static Fallback Announcement */
          <div
            data-testid="announcement-ticker-static"
            className="flex items-center gap-2.5 text-sm sm:text-base text-slate-200 font-medium"
          >
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span
              data-testid="announcement-ticker-text"
              className="truncate"
            >
              {effectiveConfig.staticFallbackText}
            </span>
          </div>
        )}
      </div>

      {/* Right Controls or Item Counter */}
      {hasAnnouncements && activeAnnouncements.length > 1 && (
        <div className="hidden sm:flex shrink-0 items-center gap-1.5 px-3 py-1 text-slate-400 font-mono-tabular text-xs">
          <span>{activeAnnouncements.length} mesej</span>
        </div>
      )}

      {/* Marquee Keyframes Inline Definition to Ensure Self-Containment */}
      <style>{`
        @keyframes tickerScroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="announcement-ticker"] .will-change-transform {
            animation: none !important;
            transform: none !important;
            white-space: normal;
          }
        }
      `}</style>
    </footer>
  );
};
