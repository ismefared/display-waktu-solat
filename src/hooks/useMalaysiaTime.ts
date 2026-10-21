import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import { getMalaysiaDateParts, MalaysiaDateParts } from '../domain/prayerEngine';

/**
 * Drift-free Malaysia Standard Time (Asia/Kuala_Lumpur) Wall-Clock Hook
 * Policy Compliance: Section 18 (Countdown), Section 27 (24/7 Stability)
 * Anchors every tick directly to `Date.now()` so there is zero cumulative timer drift.
 */

export function useMalaysiaTime() {
  const [nowEpochMs, setNowEpochMs] = useState<number>(() => Date.now());
  const [dateParts, setDateParts] = useState<MalaysiaDateParts>(() =>
    getMalaysiaDateParts(Date.now())
  );

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;
      const now = Date.now();
      setNowEpochMs(now);
      setDateParts(getMalaysiaDateParts(now));

      // Align next tick to the exact next wall-clock second boundary
      const msUntilNextSecond = 1000 - (now % 1000);
      timerId = setTimeout(tick, Math.max(100, msUntilNextSecond));
    };

    tick();

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, []);

  return {
    nowEpochMs,
    dateParts,
    timezone: APP_CONFIG.timezone,
  };
}
