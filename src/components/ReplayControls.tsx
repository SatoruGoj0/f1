import { useEffect, useState } from 'react';
import { fmtDuration } from '../lib/format';
import { loadYearIndex, type ArchiveMeeting, type ArchiveSession } from '../lib/replay';

const FIRST_YEAR = 2018;

export function ArchivePicker({
  onLoad,
  loading,
  currentPath,
}: {
  onLoad: (s: ArchiveSession, m: ArchiveMeeting) => void;
  loading: string | null;
  currentPath?: string;
}) {
  const thisYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(thisYear);
  const [meetings, setMeetings] = useState<ArchiveMeeting[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadYearIndex(year).then((ms) => {
      if (!alive) return;
      const done = ms
        .map((m) => ({ ...m, sessions: m.sessions.filter((s) => s.endUtc < Date.now() - 20 * 60000) }))
        .filter((m) => m.sessions.length);
      setMeetings(done);
      const last = done[done.length - 1];
      setMeetingKey(last?.key ?? null);
      setSessionKey(last?.sessions[last.sessions.length - 1]?.key ?? null);
    });
    return () => {
      alive = false;
    };
  }, [year]);

  const meeting = meetings.find((m) => m.key === meetingKey);
  const session = meeting?.sessions.find((s) => s.key === sessionKey);

  return (
    <div className="picker">
      <select value={year} onChange={(e) => setYear(+e.target.value)} aria-label="Season">
        {Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i).map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <select
        value={meetingKey ?? ''}
        onChange={(e) => {
          const m = meetings.find((x) => x.key === +e.target.value);
          setMeetingKey(m?.key ?? null);
          setSessionKey(m?.sessions[m.sessions.length - 1]?.key ?? null);
        }}
        aria-label="Grand Prix"
      >
        {meetings.map((m) => (
          <option key={m.key} value={m.key}>
            {m.name} — {m.location}
          </option>
        ))}
      </select>
      <select value={sessionKey ?? ''} onChange={(e) => setSessionKey(+e.target.value)} aria-label="Session">
        {meeting?.sessions.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        className="primary"
        disabled={!session || !!loading || session.path === currentPath}
        onClick={() => session && meeting && onLoad(session, meeting)}
      >
        {loading ? 'Loading…' : 'Load replay'}
      </button>
      {loading && <span className="muted small">{loading}</span>}
    </div>
  );
}

export const SPEEDS = [1, 2, 5, 10, 30, 60];

export function ReplayBar({
  start,
  end,
  t,
  playing,
  speed,
  onSeek,
  onToggle,
  onSpeed,
}: {
  start: number;
  end: number;
  t: number;
  playing: boolean;
  speed: number;
  onSeek: (t: number) => void;
  onToggle: () => void;
  onSpeed: (s: number) => void;
}) {
  return (
    <div className="replay-bar">
      <button className="play big" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <button className="ghost-btn" onClick={() => onSeek(Math.max(start, t - 30000))}>−30s</button>
      <button className="ghost-btn" onClick={() => onSeek(Math.min(end, t + 30000))}>+30s</button>
      <span className="mono small">{fmtDuration(t - start)}</span>
      <input
        type="range"
        min={start}
        max={end}
        step={1000}
        value={t}
        onChange={(e) => onSeek(+e.target.value)}
        className="scrub"
        aria-label="Replay position"
      />
      <span className="mono small muted">{fmtDuration(end - start)}</span>
      <div className="seg-control">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'on' : ''} onClick={() => onSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
