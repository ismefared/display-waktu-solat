import React from 'react';
import {
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  MapPin,
  RefreshCw,
  Sun,
} from 'lucide-react';
import {
  formatGregorianDateBM,
  formatTime24Short,
  MalaysiaDateParts,
  parseAndFormatHijriDateBM,
} from '../domain/prayerEngine';
import {
  DailyZikirItem,
  DataFreshnessState,
  IslamicEventItem,
  LocationState,
  MalaysianHistoryItem,
  PrayerApiPayload,
  ResolvedPrayerState,
  WeatherData,
} from '../types/domain';

interface PrimaryDisplayViewProps {
  dateParts: MalaysiaDateParts;
  prayerPayload: PrayerApiPayload | null;
  prayerFreshness: 'LIVE' | 'STALE';
  prayerErrorNotice: string | null;
  resolvedPrayer: ResolvedPrayerState | null;
  locationState: LocationState;
  onOpenZoneModal: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  weatherData: WeatherData | null;
  weatherState: DataFreshnessState;
  weatherStatusBM: string;
  islamicEvent: {
    todayEvent: IslamicEventItem | null;
    upcomingEvent: IslamicEventItem;
    statusMessageBM: string;
  };
  malaysianHistory: MalaysianHistoryItem;
  dailyZikir: DailyZikirItem;
}

function formatUpdatedClock(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) return '--:--';
  try {
    const d = new Date(new Date(isoTimestamp).getTime() + 8 * 3600 * 1000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '--:--';
  }
}

function renderWeatherIcon(code: WeatherData['conditionCode'] | undefined) {
  switch (code) {
    case 'THUNDERSTORM':
      return <CloudLightning className="w-8 h-8 xl:w-10 xl:h-10 text-amber-400 shrink-0" />;
    case 'RAIN':
      return <CloudRain className="w-8 h-8 xl:w-10 xl:h-10 text-sky-400 shrink-0" />;
    case 'CLOUDY':
      return <Cloud className="w-8 h-8 xl:w-10 xl:h-10 text-slate-300 shrink-0" />;
    default:
      return <Sun className="w-8 h-8 xl:w-10 xl:h-10 text-amber-300 shrink-0" />;
  }
}

/**
 * Primary 10-Metre Display View
 * Responsive across 1280x720, 1366x768, 1600x900, 1920x1080, 2560x1440, and narrow viewports.
 * Strictly enforces the 8-Level Responsive Priority Hierarchy (Section 6) and
 * prevents horizontal/vertical clipping via `min-w-0`, `min-h-0`, and fluid `clamp()` sizing.
 */
export const PrimaryDisplayView: React.FC<PrimaryDisplayViewProps> = ({
  dateParts,
  prayerPayload,
  prayerFreshness,
  prayerErrorNotice,
  resolvedPrayer,
  locationState,
  onOpenZoneModal,
  onRefreshData,
  isRefreshing,
  weatherData,
  weatherState,
  weatherStatusBM,
  islamicEvent,
  malaysianHistory,
  dailyZikir,
}) => {
  const gregorianDisplay = formatGregorianDateBM(dateParts);
  const hijriParsed = parseAndFormatHijriDateBM(
    resolvedPrayer?.todaySchedule.hijri || ''
  );

  const isApproachingPrayer =
    resolvedPrayer && resolvedPrayer.countdown.totalSeconds <= 900;

  return (
    <main className="flex-1 min-h-0 min-w-0 w-full max-w-[2560px] mx-auto display-main-grid flex flex-col justify-between overflow-x-hidden lg:overflow-hidden">
      {/* Notice Banner if Offline or Stale Prayer Data */}
      {prayerErrorNotice && (
        <div
          role="status"
          className="w-full px-3.5 py-1.5 bg-amber-950/60 border border-amber-500/40 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0 min-w-0"
        >
          <span className="truncate min-w-0">{prayerErrorNotice}</span>
          <button
            type="button"
            onClick={onRefreshData}
            className="inline-flex items-center gap-1.5 font-semibold text-amber-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Cuba Semula</span>
          </button>
        </div>
      )}

      {/* ===================================================================
          ROW 1: LEVEL 3 (Dates & Live Clock) + LEVEL 4 (Location & Zone)
         =================================================================== */}
      <section
        aria-label="Tarikh, Lokasi dan Waktu Semasa"
        className="w-full bg-[#0A1614] border border-white/10 rounded-xl display-panel-pad flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6 shrink-0 min-w-0"
      >
        {/* Left: Level 3 (Gregorian + Hijri Dates) & Level 4 (Active Zone) */}
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-300/90 font-medium">
            <span>Takwim Rasmi Malaysia</span>
            <span aria-hidden="true">·</span>
            <span>Sumber: {prayerPayload?.source || 'e-Solat JAKIM'}</span>
            <span aria-hidden="true">·</span>
            <span>
              Dikemas kini: {formatUpdatedClock(prayerPayload?.fetchedAt)}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                prayerFreshness === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              Status: {prayerFreshness === 'LIVE' ? 'Langsung (Sah)' : 'Data Simpanan (Stale)'}
            </span>
          </div>

          {/* Dual Calendar Display (CAL-001 & CAL-002) - Fluid 10m Scale */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
            <h1 className="text-fluid-date-primary font-extrabold tracking-tight text-slate-50">
              {gregorianDisplay}
            </h1>
            <span
              aria-hidden="true"
              className="text-lg xl:text-2xl text-amber-400 font-bold"
            >
              /
            </span>
            <p className="text-fluid-date-hijri font-bold text-amber-300">
              {hijriParsed.formattedBM}
            </p>
          </div>

          {/* Location & Prayer Zone Bar (LOC-001 & LOC-002) */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-300 min-w-0">
            <span className="font-mono-tabular font-bold text-amber-400 shrink-0">
              Zon {locationState.activeZone.code}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-100 truncate max-w-full sm:max-w-[460px] xl:max-w-[680px]">
              {locationState.activeZone.name}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400 shrink-0">
              {locationState.mode === 'AUTO'
                ? 'Lokasi Dikesan (GPS)'
                : 'Pilihan Manual'}
            </span>
            <button
              type="button"
              onClick={onOpenZoneModal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4 shrink-0 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Tukar Zon</span>
            </button>
          </div>
        </div>

        {/* Right: Current Malaysia Standard Time Clock */}
        <div className="flex flex-row lg:flex-col items-baseline lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-white/10 pt-2.5 lg:pt-0 lg:pl-6 shrink-0 gap-3">
          <div className="text-xs font-medium text-slate-400 flex items-center gap-2">
            <span>Waktu Piawai Malaysia (UTC+8)</span>
            <button
              type="button"
              onClick={onRefreshData}
              title="Kemas kini data sekarang"
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`}
              />
            </button>
          </div>
          <div
            aria-label="Waktu Semasa Malaysia"
            className="font-mono-tabular text-fluid-clock font-extrabold tracking-tight text-slate-50"
          >
            {dateParts.time24WithSeconds}
          </div>
          {resolvedPrayer?.todaySchedule && (
            <div className="hidden sm:block text-xs text-slate-400 font-mono-tabular">
              Imsak: {formatTime24Short(resolvedPrayer.todaySchedule.imsak)} · Dhuha:{' '}
              {formatTime24Short(resolvedPrayer.todaySchedule.dhuha)}
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================
          ROW 2 (HERO STAGE): LEVEL 1 (NEXT PRAYER & COUNTDOWN)
          + LEVEL 5 (WEATHER) & LEVEL 8 (DAILY ZIKIR)
         =================================================================== */}
      <section className="flex-1 min-h-0 min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-3 xl:gap-4 items-stretch">
        {/* LEVEL 1 FOCAL ANCHOR: Next Prayer & Giant 10m Countdown (7 Cols) */}
        <div
          aria-label="Waktu Solat Seterusnya dan Kiraan Masa"
          className={`lg:col-span-7 min-h-0 min-w-0 rounded-xl display-hero-pad border flex flex-col justify-between transition-colors ${
            isApproachingPrayer
              ? 'bg-[#0F241F] border-amber-400/80'
              : 'bg-[#0B1916] border-emerald-500/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm xl:text-base font-semibold text-amber-300">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span>Waktu Solat Seterusnya</span>
              {resolvedPrayer?.nextPrayer.isTomorrow && (
                <span className="text-xs font-normal text-slate-300">
                  · Hari Esok
                </span>
              )}
            </div>

            {resolvedPrayer?.currentPrayer && (
              <div className="text-xs sm:text-sm xl:text-base text-slate-300">
                <span>Waktu Semasa: </span>
                <strong className="text-emerald-300 font-bold font-mono-tabular">
                  {resolvedPrayer.currentPrayer.labelBM} (
                  {resolvedPrayer.currentPrayer.time24})
                </strong>
              </div>
            )}
          </div>

          {resolvedPrayer ? (
            <div className="my-2 sm:my-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 min-w-0">
              <div className="min-w-0">
                <div className="text-fluid-next-prayer font-extrabold tracking-tight text-white truncate">
                  {resolvedPrayer.nextPrayer.labelBM}
                </div>
                <div className="text-sm sm:text-base xl:text-lg text-emerald-300 font-medium mt-1 font-mono-tabular">
                  Masuk Waktu Pada Jam {resolvedPrayer.nextPrayer.time24}
                </div>
              </div>

              {/* Giant 10-Metre Tabular Countdown (PR-003) */}
              <div className="sm:text-right shrink-0">
                <div className="text-xs font-medium text-slate-400 mb-1">
                  Tempoh Menuju Waktu {resolvedPrayer.nextPrayer.labelBM}
                </div>
                <div
                  data-testid="next-prayer-countdown"
                  className="font-mono-tabular text-fluid-countdown font-extrabold tracking-tight text-amber-400"
                >
                  {resolvedPrayer.countdown.formatted}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-base">
              Memuatkan kiraan waktu solat...
            </div>
          )}

          <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="truncate">
              Kiraan detik disegerakkan dengan Waktu Piawai Malaysia
            </span>
            <span className="font-mono-tabular text-slate-400 shrink-0">
              Jam:Minit:Saat
            </span>
          </div>
        </div>

        {/* Right Column (5 Cols): LEVEL 5 (Weather) + LEVEL 8 (Daily Zikir) */}
        <div className="lg:col-span-5 min-h-0 min-w-0 flex flex-col gap-3 xl:gap-4 justify-between">
          {/* LEVEL 5: Malaysian Local Weather Panel (WX-001) */}
          <div
            aria-label="Maklumat Cuaca Tempatan"
            className="bg-[#0A1614] border border-white/10 rounded-xl display-panel-pad flex flex-col justify-between gap-1.5 shrink-0 min-w-0"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400 min-w-0">
              <span className="truncate">Cuaca Tempatan · MetMalaysia</span>
              <span className="shrink-0 font-mono-tabular">
                {weatherState === 'LIVE' &&
                  `Dikemas kini: ${formatUpdatedClock(weatherData?.fetchedAt)}`}
                {weatherState === 'STALE' &&
                  `Simpanan (${formatUpdatedClock(weatherData?.fetchedAt)})`}
                {weatherState === 'LOADING' && 'Memuatkan...'}
                {(weatherState === 'UNAVAILABLE' || weatherState === 'ERROR') &&
                  'Tidak Tersedia'}
              </span>
            </div>

            {weatherData ? (
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {renderWeatherIcon(weatherData.conditionCode)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base xl:text-lg font-bold text-slate-100 truncate">
                      {weatherData.locationName}
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-300 font-medium leading-snug truncate">
                      {weatherData.summaryForecast} ({weatherData.summaryWhen})
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono-tabular text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-50 leading-none">
                    {weatherData.currentEstimateTemp}°C
                  </div>
                  <div className="font-mono-tabular text-xs text-slate-400 mt-0.5">
                    {weatherData.minTemp}°C – {weatherData.maxTemp}°C
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs sm:text-sm text-slate-400">
                {weatherStatusBM}
              </div>
            )}

            {weatherData && (
              <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-300 min-w-0">
                <span className="truncate">Pagi: {weatherData.morningForecast}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">Petang: {weatherData.afternoonForecast}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">Malam: {weatherData.nightForecast}</span>
              </div>
            )}
          </div>

          {/* LEVEL 8: Daily Zikir Recommendation (ZIK-001) */}
          <div
            aria-label="Zikir Harian"
            className="flex-1 min-h-0 min-w-0 bg-[#0A1614] border border-white/10 rounded-xl display-panel-pad flex flex-col justify-between gap-1.5 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-amber-300/90 font-medium min-w-0">
              <span className="truncate">Zikir Harian · {dailyZikir.titleBM}</span>
              <span className="text-slate-400 shrink-0">{dailyZikir.recommendedCount}</span>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-fluid-arabic text-slate-50 text-right leading-snug line-clamp-2"
            >
              {dailyZikir.arabicText}
            </p>

            <div className="space-y-0.5 min-w-0">
              <p className="text-xs text-emerald-300/90 italic truncate">
                &ldquo;{dailyZikir.transliterationBM}&rdquo;
              </p>
              <p className="text-xs sm:text-sm text-slate-200 leading-snug line-clamp-2">
                {dailyZikir.translationBM}
              </p>
            </div>

            <div className="pt-1 border-t border-white/10 text-xs text-slate-400 truncate">
              Rujukan Sahih: {dailyZikir.sourceReference}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          ROW 3 (LEVEL 2): FULL-WIDTH 6-COLUMN PRAYER TIMETABLE (PR-001)
          Subuh · Syuruk · Zohor · Asar · Maghrib · Isyak
         =================================================================== */}
      <section aria-label="Jadual Waktu Solat Harian" className="shrink-0 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 xl:gap-4">
          {resolvedPrayer?.prayerItems.map((item) => {
            return (
              <div
                key={item.key}
                data-testid={`prayer-card-${item.key}`}
                className={`min-w-0 rounded-xl display-panel-pad border transition-colors flex flex-col justify-between ${
                  item.isNext
                    ? 'bg-[#102822] border-2 border-amber-400 shadow-lg'
                    : item.isCurrent
                    ? 'bg-[#0D201B] border-emerald-500/60'
                    : 'bg-[#0A1614] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span
                    className={`text-sm sm:text-base xl:text-lg font-bold truncate ${
                      item.isNext
                        ? 'text-amber-300'
                        : item.isCurrent
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {item.labelBM}
                  </span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-sm sm:text-base text-slate-400 shrink-0"
                  >
                    {item.labelArabic}
                  </span>
                </div>

                <div
                  className={`font-mono-tabular text-fluid-timetable-time font-extrabold tracking-tight my-1 xl:my-2 ${
                    item.isNext
                      ? 'text-white'
                      : item.isCurrent
                      ? 'text-emerald-100'
                      : 'text-slate-100'
                  }`}
                >
                  {item.time24}
                </div>

                <div className="text-xs font-medium truncate">
                  {item.isNext ? (
                    <span className="text-amber-300 font-semibold">
                      Waktu Seterusnya
                    </span>
                  ) : item.isCurrent ? (
                    <span className="text-emerald-400">Waktu Semasa</span>
                  ) : (
                    <span className="text-slate-500">Takwim JAKIM</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================
          ROW 4 (LEVELS 6 & 7): ISLAMIC EVENT (ISL-001) & MALAYSIAN HISTORY (MY-001)
         =================================================================== */}
      <section
        aria-label="Peristiwa Islam dan Sejarah Malaysia"
        className="grid grid-cols-1 lg:grid-cols-2 gap-3 xl:gap-4 shrink-0 min-w-0"
      >
        {/* Islamic Event Card (ISL-001) */}
        <div className="min-w-0 bg-[#0A1614] border border-white/10 rounded-xl display-panel-pad flex flex-col justify-between gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 font-medium min-w-0">
            <span className="shrink-0">Peristiwa Takwim Islam</span>
            <span className="text-slate-400 truncate">{islamicEvent.statusMessageBM}</span>
          </div>

          {islamicEvent.todayEvent ? (
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-50 truncate">
                {islamicEvent.todayEvent.titleBM}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-snug line-clamp-2">
                {islamicEvent.todayEvent.descriptionBM}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                Tiada Peristiwa Khas Islam Pada Hari Ini ({hijriParsed.formattedBM})
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-snug line-clamp-2">
                Peristiwa Penting Seterusnya:{' '}
                <strong className="text-amber-300">
                  {islamicEvent.upcomingEvent.titleBM}
                </strong>{' '}
                pada{' '}
                <span className="text-emerald-300">
                  {islamicEvent.upcomingEvent.hijriDateDisplay}
                </span>
                . {islamicEvent.upcomingEvent.descriptionBM}
              </p>
            </div>
          )}

          <div className="pt-1 border-t border-white/10 text-xs text-slate-400 truncate">
            Sumber: {islamicEvent.todayEvent?.sourceReference || islamicEvent.upcomingEvent.sourceReference}
          </div>
        </div>

        {/* Malaysian Historical Event Card (MY-001) */}
        <div className="min-w-0 bg-[#0A1614] border border-white/10 rounded-xl display-panel-pad flex flex-col justify-between gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-300 font-medium min-w-0">
            <span className="shrink-0">Hari Ini Dalam Sejarah Malaysia</span>
            <span className="text-slate-400 font-mono-tabular truncate">
              {malaysianHistory.dateDisplayBM}
            </span>
          </div>

          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-50 truncate">
              {malaysianHistory.titleBM} ({malaysianHistory.year})
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-snug line-clamp-2">
              {malaysianHistory.descriptionBM}
            </p>
          </div>

          <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-2 text-xs text-slate-400 min-w-0">
            <span className="truncate">Sumber: {malaysianHistory.sourceReference}</span>
            <span className="shrink-0">
              {malaysianHistory.isExactDateMatch
                ? 'Tarikh Tepat Hari Ini'
                : 'Arkib Sejarah Bulan Ini'}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
};
