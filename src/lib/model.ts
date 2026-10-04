import { list, parseUtc } from './feed';
import { parseHms } from './format';
import type { Capture, Driver, F1State, RcMessage, Stint, TimingLine } from './types';

export interface Row {
  num: string;
  driver: Driver;
  line: TimingLine;
  stints: Stint[];
  gridPos?: number;
  position: number;
}

export function drivers(state: F1State): Record<string, Driver> {
  const out: Record<string, Driver> = {};
  for (const [k, d] of Object.entries(state.DriverList ?? {})) {
    if (d && typeof d === 'object' && (d.Tla || d.RacingNumber)) out[k] = { ...d, RacingNumber: d.RacingNumber ?? k };
  }
  return out;
}

export function rows(state: F1State): Row[] {
  const ds = drivers(state);
  const lines = state.TimingData?.Lines ?? {};
  const app = state.TimingAppData?.Lines ?? {};
  const nums = new Set([...Object.keys(ds), ...Object.keys(lines)].filter((n) => /^\d+$/.test(n)));
  return [...nums]
    .map((num) => {
      const line = lines[num] ?? {};
      const pos = Number(line.Position) || line.Line || ds[num]?.Line || 99;
      return {
        num,
        driver: ds[num] ?? { RacingNumber: num, Tla: num },
        line,
        stints: list(app[num]?.Stints),
        gridPos: Number(app[num]?.GridPos) || undefined,
        position: pos,
      };
    })
    .sort((a, b) => a.position - b.position);
}

export function sessionKind(state: F1State): 'race' | 'quali' | 'practice' {
  const t = `${state.SessionInfo?.Type ?? ''} ${state.SessionInfo?.Name ?? ''}`.toLowerCase();
  if (t.includes('qualifying') || t.includes('shootout')) return 'quali';
  if (t.includes('race') || t.includes('sprint')) return 'race';
  return 'practice';
}

export function captures(state: F1State): (Capture & { t: number })[] {
  return list(state.TeamRadio?.Captures)
    .map((c) => ({ ...c, t: parseUtc(c.Utc) }))
    .sort((a, b) => b.t - a.t);
}

export function messages(state: F1State): (RcMessage & { t: number })[] {
  return list(state.RaceControlMessages?.Messages)
    .map((m) => ({ ...m, t: parseUtc(m.Utc) }))
    .sort((a, b) => b.t - a.t);
}

export function remaining(state: F1State, now: number, running: boolean): number {
  const c = state.ExtrapolatedClock;
  if (!c?.Remaining) return NaN;
  const rem = parseHms(c.Remaining);
  if (!c.Extrapolating || !running) return rem;
  return Math.max(0, rem - (now - parseUtc(c.Utc)));
}

export function isRunning(state: F1State) {
  const s = state.SessionStatus?.Status;
  return s === 'Started' || s === 'Resumed';
}
