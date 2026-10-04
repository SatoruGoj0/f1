export const COMPOUNDS: Record<string, { color: string; letter: string; text: string }> = {
  SOFT: { color: '#e8002d', letter: 'S', text: '#fff' },
  MEDIUM: { color: '#ffd12e', letter: 'M', text: '#111' },
  HARD: { color: '#f0f0ec', letter: 'H', text: '#111' },
  INTERMEDIATE: { color: '#43b02a', letter: 'I', text: '#fff' },
  WET: { color: '#0067ad', letter: 'W', text: '#fff' },
  UNKNOWN: { color: '#6b6f7a', letter: '?', text: '#fff' },
  TEST_UNKNOWN: { color: '#6b6f7a', letter: 'T', text: '#fff' },
};
export const compound = (c?: string) => COMPOUNDS[c ?? 'UNKNOWN'] ?? COMPOUNDS.UNKNOWN;

export const TRACK_STATUS: Record<string, { label: string; color: string; fg: string }> = {
  '1': { label: 'Track Clear', color: '#16a34a', fg: '#fff' },
  '2': { label: 'Yellow Flag', color: '#facc15', fg: '#111' },
  '3': { label: 'Flag', color: '#facc15', fg: '#111' },
  '4': { label: 'Safety Car', color: '#f59e0b', fg: '#111' },
  '5': { label: 'Red Flag', color: '#dc2626', fg: '#fff' },
  '6': { label: 'Virtual Safety Car', color: '#f59e0b', fg: '#111' },
  '7': { label: 'VSC Ending', color: '#f59e0b', fg: '#111' },
};

export const FLAG_COLORS: Record<string, string> = {
  GREEN: '#16a34a',
  CLEAR: '#16a34a',
  YELLOW: '#facc15',
  'DOUBLE YELLOW': '#facc15',
  RED: '#dc2626',
  BLUE: '#3b82f6',
  CHEQUERED: '#e5e7eb',
  'BLACK AND WHITE': '#9ca3af',
  BLACK: '#111827',
  'BLACK AND ORANGE': '#f97316',
};

export function teamColor(hex?: string) {
  return hex ? `#${hex.replace('#', '')}` : '#888';
}

export function fmtClock(ms: number, tz?: string) {
  if (!Number.isFinite(ms)) return '--:--:--';
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false, timeZone: tz });
}

export function fmtDuration(ms: number) {
  if (!Number.isFinite(ms)) return '--:--:--';
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function parseHms(s?: string) {
  if (!s) return NaN;
  const [h, m, sec] = s.split(':').map(Number);
  return ((h * 60 + m) * 60 + sec) * 1000;
}

/** "1:23.456" → ms */
export function parseLap(s?: string) {
  if (!s) return NaN;
  const parts = s.split(':');
  return parts.length === 2 ? (+parts[0] * 60 + +parts[1]) * 1000 : +parts[0] * 1000;
}

export function timeAgo(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
