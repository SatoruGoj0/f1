import { inflateRawSync } from 'node:zlib';
import { F1_STATIC, fetchText } from './http.js';

export interface Track {
  source: 'multiviewer' | 'derived';
  /** Outline points, starting at the start/finish line. */
  x: number[];
  y: number[];
  rotation: number;
  corners: { number: number; letter?: string; x: number; y: number }[];
  /** Outline point index at the end of each timing mini-sector, when known. */
  miniSectorsIndexes?: number[];
  derivedFrom?: string;
}

interface IndexSession { Key: number; Type: string; Name: string; StartDate: string; EndDate: string; GmtOffset: string; Path: string }
interface IndexMeeting { Circuit?: { Key: number }; Sessions: IndexSession[] }

export async function multiviewerTrack(circuitKey: number, year: number): Promise<Track | null> {
  for (let y = year; y >= year - 3; y--) {
    const r = await fetch(`https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${y}`, {
      headers: { 'User-Agent': 'f1-pitwall' },
    });
    if (!r.ok) continue;
    const d = (await r.json()) as {
      x: number[]; y: number[]; rotation: number; miniSectorsIndexes?: number[];
      corners: { number: number; letter?: string; trackPosition: { x: number; y: number } }[];
    };
    if (!d.x?.length) continue;
    return {
      source: 'multiviewer',
      x: d.x,
      y: d.y,
      rotation: d.rotation ?? 0,
      corners: (d.corners ?? []).map((c) => ({
        number: c.number,
        letter: c.letter || undefined,
        x: c.trackPosition.x,
        y: c.trackPosition.y,
      })),
      miniSectorsIndexes: d.miniSectorsIndexes,
    };
  }
  return null;
}

const OFFSET_RE = /^(\d+):(\d{2}):(\d{2})\.(\d+)(.*)$/;
function parseOffset(line: string): [number, string] | null {
  const m = OFFSET_RE.exec(line.trim());
  if (!m) return null;
  const ms = (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + Math.round(+`0.${m[4]}` * 1000);
  return [ms, m[5]];
}

export function parseUtc(s: string): number {
  // F1 timestamps may carry 7 fractional digits and sometimes no zone suffix.
  const m = /^(.*?T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) return Date.parse(s);
  return Date.parse(m[1] + (m[2] ? m[2].slice(0, 4) : '') + (m[3] ?? 'Z'));
}

function localToUtc(local: string, offset: string): number {
  const [h, mi] = offset.replace('-', '').split(':').map(Number);
  const sign = offset.startsWith('-') ? -1 : 1;
  return Date.parse(local + 'Z') - sign * (h * 60 + mi) * 60000;
}

/** Builds an outline from a driver's fastest lap in an archived session. */
export async function deriveTrack(path: string): Promise<Track | null> {
  const [pos, td] = await Promise.all([
    fetchText(F1_STATIC + path + 'Position.z.jsonStream'),
    fetchText(F1_STATIC + path + 'TimingData.jsonStream'),
  ]);
  if (!pos || !td) return null;

  let base = NaN;
  const per: Record<string, number[][]> = {};
  for (const line of pos.split('\n')) {
    const p = parseOffset(line);
    if (!p) continue;
    let json: { Position?: { Timestamp: string; Entries: Record<string, { Status: string; X: number; Y: number }> }[] };
    try {
      json = JSON.parse(inflateRawSync(Buffer.from(JSON.parse(p[1]), 'base64')).toString());
    } catch {
      continue;
    }
    for (const frame of json.Position ?? []) {
      const t = parseUtc(frame.Timestamp);
      if (Number.isNaN(base)) base = t - p[0];
      for (const [num, e] of Object.entries(frame.Entries ?? {})) {
        if (e.Status === 'OnTrack' && (e.X || e.Y)) (per[num] ??= []).push([t, e.X, e.Y]);
      }
    }
  }
  if (Number.isNaN(base)) return null;

  const laps: { num: string; start: number; end: number }[] = [];
  const last: Record<string, { n: number; t: number }> = {};
  for (const line of td.split('\n')) {
    const p = parseOffset(line);
    if (!p) continue;
    let obj: { Lines?: Record<string, { NumberOfLaps?: number }> };
    try {
      obj = JSON.parse(p[1]);
    } catch {
      continue;
    }
    for (const [num, l] of Object.entries(obj.Lines ?? {})) {
      if (typeof l?.NumberOfLaps !== 'number') continue;
      const t = base + p[0];
      const prev = last[num];
      if (prev && l.NumberOfLaps === prev.n + 1) laps.push({ num, start: prev.t, end: t });
      last[num] = { n: l.NumberOfLaps, t };
    }
  }
  laps.sort((a, b) => a.end - a.start - (b.end - b.start));

  for (const lap of laps.filter((l) => l.end - l.start > 40000).slice(0, 20)) {
    const pts = (per[lap.num] ?? []).filter(([t]) => t >= lap.start && t <= lap.end);
    if (pts.length < 150) continue;
    const [, x0, y0] = pts[0];
    const [, x1, y1] = pts[pts.length - 1];
    if (Math.hypot(x1 - x0, y1 - y0) > 1500) continue;
    const step = Math.max(1, Math.floor(pts.length / 900));
    const sampled = pts.filter((_, i) => i % step === 0);
    const x = sampled.map((p) => p[1]);
    const y = sampled.map((p) => p[2]);
    return { source: 'derived', x, y, rotation: principalRotation(x, y), corners: [], derivedFrom: path };
  }
  return null;
}

/** Rotation (degrees) that lays the track's longest axis horizontally. */
function principalRotation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return (-angle * 180) / Math.PI;
}

/** Archived sessions held at a circuit, newest first. */
export async function archivedSessionsAt(circuitKey: number, year: number): Promise<string[]> {
  const out: string[] = [];
  for (let y = year; y >= year - 2; y--) {
    const txt = await fetchText(`${F1_STATIC}${y}/Index.json`);
    if (!txt) continue;
    let idx: { Meetings: IndexMeeting[] };
    try {
      idx = JSON.parse(txt);
    } catch {
      continue;
    }
    const sessions = idx.Meetings.filter((m) => m.Circuit?.Key === circuitKey)
      .flatMap((m) => m.Sessions)
      .filter((s) => s.Path && localToUtc(s.EndDate, s.GmtOffset) < Date.now() - 30 * 60000)
      .sort((a, b) => localToUtc(b.StartDate, b.GmtOffset) - localToUtc(a.StartDate, a.GmtOffset));
    out.push(...sessions.map((s) => s.Path));
  }
  return out;
}
