import { localToUtc, merge, parseStream, parseUtc, staticUrl } from './feed';
import { PositionHistory } from './positions';
import type { F1State } from './types';

export interface ArchiveSession {
  key: number;
  name: string;
  type: string;
  path: string;
  startUtc: number;
  endUtc: number;
}
export interface ArchiveMeeting {
  key: number;
  name: string;
  location: string;
  country: string;
  circuitKey: number;
  sessions: ArchiveSession[];
}

interface RawIndex {
  Meetings: {
    Key: number;
    Name: string;
    Location: string;
    Country?: { Name?: string };
    Circuit?: { Key: number };
    Sessions: { Key: number; Name: string; Type: string; Path?: string; StartDate: string; EndDate: string; GmtOffset: string }[];
  }[];
}

export async function loadYearIndex(year: number): Promise<ArchiveMeeting[]> {
  const r = await fetch(staticUrl(`${year}/Index.json`));
  if (!r.ok) return [];
  const idx = (await r.json()) as RawIndex;
  return idx.Meetings.map((m) => ({
    key: m.Key,
    name: m.Name,
    location: m.Location,
    country: m.Country?.Name ?? '',
    circuitKey: m.Circuit?.Key ?? 0,
    sessions: m.Sessions.filter((s) => s.Path).map((s) => ({
      key: s.Key,
      name: s.Name,
      type: s.Type,
      path: s.Path!,
      startUtc: localToUtc(s.StartDate, s.GmtOffset),
      endUtc: localToUtc(s.EndDate, s.GmtOffset),
    })),
  }));
}

const TOPICS = [
  'SessionInfo',
  'DriverList',
  'TimingData',
  'TimingAppData',
  'TimingStats',
  'RaceControlMessages',
  'TeamRadio',
  'TrackStatus',
  'WeatherData',
  'LapCount',
  'ExtrapolatedClock',
  'SessionStatus',
  'SessionData',
  'Heartbeat',
];

interface Ev { t: number; topic: string; data: unknown }

const CHECKPOINT_MS = 20_000;

/** Reconstructs the feed state of an archived session at any instant. */
export class Replay {
  readonly start: number;
  readonly end: number;
  /** When the session actually went green (first "Started" status), if known. */
  readonly startedAt: number;
  private checkpoints: { t: number; i: number; state: F1State }[] = [];
  private cursor: { t: number; i: number; state: F1State };

  constructor(
    private events: Ev[],
    readonly positions: PositionHistory | null,
  ) {
    this.start = events[0]?.t ?? 0;
    this.end = events[events.length - 1]?.t ?? 0;
    let state: F1State = {};
    let next = this.start;
    let started = NaN;
    events.forEach((e, i) => {
      while (e.t >= next) {
        this.checkpoints.push({ t: next, i, state });
        next += CHECKPOINT_MS;
      }
      state = { ...state, [e.topic]: merge(state[e.topic], e.data) };
      if (Number.isNaN(started) && e.topic === 'SessionStatus' && (state.SessionStatus?.Status === 'Started')) started = e.t;
    });
    this.checkpoints.push({ t: Infinity, i: events.length, state });
    this.startedAt = Number.isNaN(started) ? this.start : started;
    this.cursor = { t: this.start, i: 0, state: {} };
  }

  stateAt(t: number): F1State {
    let { i, state } = this.cursor;
    if (t < this.cursor.t || t - this.cursor.t > CHECKPOINT_MS * 2) {
      let lo = 0;
      let hi = this.checkpoints.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (this.checkpoints[mid].t <= t) lo = mid;
        else hi = mid - 1;
      }
      ({ i, state } = this.checkpoints[lo]);
    }
    const ev = this.events;
    while (i < ev.length && ev[i].t <= t) {
      state = { ...state, [ev[i].topic]: merge(state[ev[i].topic], ev[i].data) };
      i++;
    }
    this.cursor = { t, i, state };
    return state;
  }
}

export async function loadReplay(path: string, onProgress: (msg: string) => void): Promise<Replay> {
  let done = 0;
  const texts = await Promise.all(
    TOPICS.map(async (topic) => {
      const r = await fetch(staticUrl(`${path}${topic}.jsonStream`));
      onProgress(`Loading timing feeds… ${++done}/${TOPICS.length + 1}`);
      return [topic, r.ok ? await r.text() : ''] as const;
    }),
  );
  const posText = await fetch(staticUrl(`${path}Position.z.jsonStream`)).then((r) => (r.ok ? r.text() : ''));
  onProgress('Decoding car positions…');
  await new Promise((r) => setTimeout(r, 0));

  const parsed = texts.map(([topic, text]) => [topic, parseStream(text)] as const);
  // Stream offsets are relative to the feed start; anchor them with Heartbeat UTC stamps.
  let base = NaN;
  for (const [topic, lines] of parsed) {
    if (topic !== 'Heartbeat') continue;
    for (const [off, payload] of lines) {
      try {
        const utc = parseUtc(JSON.parse(payload).Utc);
        if (!Number.isNaN(utc)) {
          base = utc - off;
          break;
        }
      } catch { /* keep looking */ }
    }
  }
  const positions = posText ? PositionHistory.decode(posText) : null;
  if (Number.isNaN(base)) base = positions?.start ?? 0;

  const events: Ev[] = [];
  for (const [topic, lines] of parsed) {
    for (const [off, payload] of lines) {
      try {
        events.push({ t: base + off, topic, data: JSON.parse(payload) });
      } catch { /* skip */ }
    }
  }
  events.sort((a, b) => a.t - b.t);
  return new Replay(events, positions);
}
