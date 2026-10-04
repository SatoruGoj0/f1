import { useEffect, useState } from 'react';
import type { XY } from './types';

export interface TrackData {
  source: 'multiviewer' | 'derived';
  x: number[];
  y: number[];
  rotation: number;
  corners: { number: number; letter?: string; x: number; y: number }[];
  miniSectorsIndexes?: number[];
}

export interface TrackGeom {
  points: XY[];
  d: string;
  viewBox: string;
  size: number;
  cum: number[];
  length: number;
  corners: { label: string; at: XY; dir: XY }[];
  project: (p: XY) => XY;
  miniSectorsIndexes?: number[];
}

const cache = new Map<string, Promise<TrackData | null>>();

export function useTrack(circuit?: number, year?: number, path?: string) {
  const [track, setTrack] = useState<TrackGeom | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!circuit) return;
    const key = `${circuit}/${year}`;
    let p = cache.get(key);
    if (!p) {
      const qs = new URLSearchParams({ circuit: String(circuit), year: String(year ?? ''), path: path ?? '' });
      p = fetch(`/api/track?${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      cache.set(key, p);
    }
    let alive = true;
    setError(null);
    p.then((t) => {
      if (!alive) return;
      if (!t) {
        cache.delete(key);
        setError('Track outline unavailable');
        setTrack(null);
      } else setTrack(buildGeom(t));
    });
    return () => {
      alive = false;
    };
  }, [circuit, year, path]);
  return { track, error };
}

export function buildGeom(t: TrackData): TrackGeom {
  // MultiViewer outlines need a quarter-turn to match broadcast orientation.
  const deg = t.source === 'multiviewer' ? t.rotation + 90 : t.rotation;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (Math.min(...t.x) + Math.max(...t.x)) / 2;
  const cy = (Math.min(...t.y) + Math.max(...t.y)) / 2;
  const rot = (p: XY): XY => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: dx * cos - dy * sin, y: dy * cos + dx * sin };
  };
  const pts = t.x.map((x, i) => rot({ x, y: t.y[i] }));
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const size = Math.max(maxX - minX, maxY - minY);
  const pad = size * 0.08;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const closing = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  const length = cum[cum.length - 1] + closing;

  const centroid = {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  };
  const corners = t.corners.map((c) => {
    const at = rot({ x: c.x, y: c.y });
    // Push labels outward from the track's centre so they sit beside the tarmac.
    const vx = at.x - centroid.x;
    const vy = at.y - centroid.y;
    const n = Math.hypot(vx, vy) || 1;
    return { label: `${c.number}${c.letter ?? ''}`, at, dir: { x: vx / n, y: vy / n } };
  });

  return {
    points: pts,
    d: 'M' + pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join('L') + 'Z',
    viewBox,
    size,
    cum,
    length,
    corners,
    project: rot,
    miniSectorsIndexes: t.miniSectorsIndexes,
  };
}

/** Point at a fraction of a lap (0 = start/finish line). */
export function pointAtFraction(g: TrackGeom, f: number): XY {
  const target = (((f % 1) + 1) % 1) * g.length;
  const { cum, points } = g;
  if (target >= cum[cum.length - 1]) {
    const a = points[points.length - 1];
    const b = points[0];
    const k = (target - cum[cum.length - 1]) / (g.length - cum[cum.length - 1] || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo];
  const b = points[lo + 1] ?? points[0];
  const k = (target - cum[lo]) / ((cum[lo + 1] ?? g.length) - cum[lo] || 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Lap fraction at the end of mini-sector `k` of `total`. */
export function miniSectorFraction(g: TrackGeom, k: number, total: number): number {
  const idx = g.miniSectorsIndexes;
  if (idx && idx.length === total && k > 0) {
    const pi = Math.min(idx[k - 1], g.cum.length - 1);
    return g.cum[pi] / g.length;
  }
  return k / total;
}
