import { useEffect, useRef, useState } from 'react';
import { list } from './feed';
import { miniSectorFraction, type TrackGeom } from './track';
import type { F1State, TimingLine } from './types';

const POLL_MS = 4000;

export function useLiveFeed(enabled: boolean) {
  const [state, setState] = useState<F1State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        const body = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        setState(body.state);
        setUpdatedAt(Date.now());
        setError(null);
      } catch (err) {
        if (alive) setError((err as Error).message);
      } finally {
        if (alive) timer = setTimeout(tick, document.hidden ? POLL_MS * 3 : POLL_MS);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled]);

  return { state, error, updatedAt };
}

export function segmentProgress(line: TimingLine) {
  const segs = list(line.Sectors).flatMap((s) => list(s.Segments));
  let done = 0;
  segs.forEach((s, i) => {
    if ((s.Status ?? 0) > 0) done = i + 1;
  });
  return { done, total: segs.length };
}

/**
 * Anonymous live timing has no car coordinates, so cars are placed on the
 * outline from the last completed timing mini-sector and extrapolated forward.
 */
export function useLiveEstimator() {
  const memo = useRef(new Map<string, { done: number; at: number }>());
  return (num: string, line: TimingLine, g: TrackGeom, now: number, running: boolean): number | null => {
    const { done, total } = segmentProgress(line);
    if (!total) return null;
    const m = memo.current;
    const prev = m.get(num);
    if (!prev || prev.done !== done) m.set(num, { done, at: now });
    const at = m.get(num)!.at;
    const lapMs = parseLapMs(line.LastLapTime?.Value) || parseLapMs(line.BestLapTime?.Value) || 95_000;
    const segMs = lapMs / total;
    const base = miniSectorFraction(g, done % total, total);
    const next = miniSectorFraction(g, (done % total) + 1, total);
    const k = running && !line.InPit && !line.Stopped ? Math.min((now - at) / segMs, 0.97) : 0;
    return base + (next - base) * Math.max(0, k);
  };
}

function parseLapMs(s?: string) {
  if (!s) return 0;
  const p = s.split(':');
  const v = p.length === 2 ? (+p[0] * 60 + +p[1]) * 1000 : +p[0] * 1000;
  return Number.isFinite(v) && v > 30_000 && v < 300_000 ? v : 0;
}
