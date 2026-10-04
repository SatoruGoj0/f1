import { inflateSync, strFromU8 } from 'fflate';
import { parseStream, parseUtc } from './feed';
import type { XY } from './types';

/** Columnar car-position history decoded from `Position.z.jsonStream`. */
export class PositionHistory {
  constructor(
    readonly times: Float64Array,
    readonly cols: Map<string, { x: Float32Array; y: Float32Array }>,
  ) {}

  static decode(text: string): PositionHistory {
    const frames: { t: number; e: Record<string, { X: number; Y: number; Status?: string }> }[] = [];
    for (const [, payload] of parseStream(text)) {
      try {
        const b64 = JSON.parse(payload) as string;
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const json = JSON.parse(strFromU8(inflateSync(bin))) as {
          Position?: { Timestamp: string; Entries: Record<string, { X: number; Y: number; Status?: string }> }[];
        };
        for (const p of json.Position ?? []) frames.push({ t: parseUtc(p.Timestamp), e: p.Entries ?? {} });
      } catch {
        /* skip malformed line */
      }
    }
    frames.sort((a, b) => a.t - b.t);
    const n = frames.length;
    const times = new Float64Array(n);
    const cols = new Map<string, { x: Float32Array; y: Float32Array }>();
    frames.forEach((f, i) => {
      times[i] = f.t;
      for (const [num, e] of Object.entries(f.e)) {
        let c = cols.get(num);
        if (!c) {
          c = { x: new Float32Array(n).fill(NaN), y: new Float32Array(n).fill(NaN) };
          cols.set(num, c);
        }
        if (e.X || e.Y) {
          c.x[i] = e.X;
          c.y[i] = e.Y;
        }
      }
    });
    return new PositionHistory(times, cols);
  }

  get start() { return this.times[0] ?? NaN; }
  get end() { return this.times[this.times.length - 1] ?? NaN; }

  /** Interpolated positions at a UTC instant. */
  at(t: number): Record<string, XY> {
    const out: Record<string, XY> = {};
    const ts = this.times;
    if (!ts.length || t < ts[0]) return out;
    let lo = 0;
    let hi = ts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    const i = lo;
    const j = Math.min(i + 1, ts.length - 1);
    const span = ts[j] - ts[i];
    const k = span > 0 && span < 3000 ? (t - ts[i]) / span : 0;
    for (const [num, c] of this.cols) {
      // Walk back a few frames if this car has no sample in the current one.
      let a = i;
      while (a > 0 && a > i - 8 && Number.isNaN(c.x[a])) a--;
      if (Number.isNaN(c.x[a])) continue;
      if (a === i && !Number.isNaN(c.x[j])) {
        out[num] = { x: c.x[i] + (c.x[j] - c.x[i]) * k, y: c.y[i] + (c.y[j] - c.y[i]) * k };
      } else {
        out[num] = { x: c.x[a], y: c.y[a] };
      }
    }
    return out;
  }
}
