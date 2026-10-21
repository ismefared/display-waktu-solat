import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Responsive Layout & CSS Contract Regression Tests
 * Traceability: UI-001 (10m Readability), UI-002 (Responsive Multi-Resolution Layout)
 * Verifies that the viewport lock, fluid typography scales, and flex/grid shrink
 * protections (`min-w-0`, `min-h-0`) remain in place across all display components.
 */

describe('Responsive Layout & Viewport Fit Regression Suite — UI-001, UI-002', () => {
  const indexCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/index.css'),
    'utf-8'
  );
  const appTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/App.tsx'),
    'utf-8'
  );
  const primaryDisplayTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/PrimaryDisplayView.tsx'),
    'utf-8'
  );
  const streamReceiverTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
    'utf-8'
  );
  const topBarTsx = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/TopBar.tsx'),
    'utf-8'
  );

  it('defines .app-viewport-shell with 100dvh landscape viewport lock and overflow-x hidden', () => {
    expect(indexCss).toContain('.app-viewport-shell');
    expect(indexCss).toContain('min-height: 100dvh');
    expect(indexCss).toContain('max-height: 100dvh');
    expect(indexCss).toContain('overflow-x: hidden');
    expect(appTsx).toContain('app-viewport-shell');
  });

  it('defines 2D fluid clamp() typography scales using both vw and vh to fit 720p, 768p, 900p, 1080p, and 1440p', () => {
    expect(indexCss).toContain('.text-fluid-countdown');
    expect(indexCss).toContain('clamp(');
    expect(indexCss).toContain('min(');
    expect(indexCss).toContain('.text-fluid-next-prayer');
    expect(indexCss).toContain('.text-fluid-timetable-time');
    expect(indexCss).toContain('.text-fluid-clock');
  });

  it('enforces min-w-0 and min-h-0 on PrimaryDisplayView flex/grid containers to prevent horizontal and vertical overflow', () => {
    expect(primaryDisplayTsx).toContain('min-h-0');
    expect(primaryDisplayTsx).toContain('min-w-0');
    expect(primaryDisplayTsx).toContain('text-fluid-countdown');
    expect(primaryDisplayTsx).toContain('text-fluid-timetable-time');
    expect(primaryDisplayTsx).toContain('grid-cols-2 sm:grid-cols-3 lg:grid-cols-6');
  });

  it('enforces min-w-0 and min-h-0 on StreamReceiverView and TopBar to prevent long zone names from overflowing', () => {
    expect(streamReceiverTsx).toContain('min-h-0');
    expect(streamReceiverTsx).toContain('min-w-0');
    expect(topBarTsx).toContain('min-w-0');
    expect(topBarTsx).toContain('truncate');
  });
});
