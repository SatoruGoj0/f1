import { fmtClock, fmtDuration, TRACK_STATUS } from '../lib/format';
import { isRunning, remaining } from '../lib/model';
import type { F1State } from '../lib/types';

export function Header({
  state,
  now,
  mode,
  setMode,
  liveInfo,
  next,
}: {
  state: F1State;
  now: number;
  mode: 'live' | 'archive';
  setMode: (m: 'live' | 'archive') => void;
  liveInfo: { error: string | null; updatedAt: number };
  next?: { label: string; at: number } | null;
}) {
  const info = state.SessionInfo;
  const running = isRunning(state);
  const ts = TRACK_STATUS[state.TrackStatus?.Status ?? ''];
  const rem = remaining(state, now, running);
  const lap = state.LapCount;
  const w = state.WeatherData;
  const status = state.SessionStatus?.Status;
  const stale = mode === 'live' && liveInfo.updatedAt && Date.now() - liveInfo.updatedAt > 15000;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">F1</span>
        <span className="brand-text">
          Pit<b>Wall</b>
        </span>
      </div>

      <div className="session">
        <div className="session-name">
          {info?.Meeting?.Name ?? 'Formula 1'} <span className="muted">· {info?.Name ?? '—'}</span>
        </div>
        <div className="muted small">
          {info?.Meeting?.Circuit?.ShortName}
          {info?.Meeting?.Country?.Name ? `, ${info.Meeting.Country.Name}` : ''}
        </div>
      </div>

      <div className="stats">
        {ts && (
          <span className="pill" style={{ background: ts.color, color: ts.fg }}>
            {ts.label}
          </span>
        )}
        {status && <span className={`pill ghost ${running ? 'live-dot' : ''}`}>{status}</span>}
        {lap?.TotalLaps ? (
          <div className="stat">
            <span className="muted small">Lap</span>
            <b className="mono">
              {lap.CurrentLap ?? '–'}/{lap.TotalLaps}
            </b>
          </div>
        ) : null}
        <div className="stat">
          <span className="muted small">Remaining</span>
          <b className="mono">{fmtDuration(rem)}</b>
        </div>
        {w && (
          <div className="stat weather" title={`Humidity ${w.Humidity}% · Pressure ${w.Pressure} mbar · Wind ${w.WindSpeed} m/s @ ${w.WindDirection}°`}>
            <span className="muted small">Air / Track</span>
            <b className="mono">
              {w.AirTemp}° / {w.TrackTemp}°
            </b>
          </div>
        )}
        {w && (
          <div className="stat weather">
            <span className="muted small">Wind · Rain</span>
            <b className="mono">
              {w.WindSpeed}m/s · {w.Rainfall === '1' ? 'Yes' : 'No'}
            </b>
          </div>
        )}
        <div className="stat">
          <span className="muted small">{mode === 'live' ? 'Your time' : 'Replay time'}</span>
          <b className="mono">{fmtClock(now)}</b>
        </div>
      </div>

      <div className="mode">
        {mode === 'live' && (
          <span className={`conn ${liveInfo.error || stale ? 'bad' : 'ok'}`} title={liveInfo.error ?? 'Connected'}>
            {liveInfo.error ? 'Feed error' : stale ? 'Reconnecting' : 'Live feed'}
          </span>
        )}
        {mode === 'live' && next && !running && (
          <span className="next muted small">
            Next: {next.label} in {fmtDuration(next.at - now)}
          </span>
        )}
        <div className="seg-control big">
          <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>
            ● Live
          </button>
          <button className={mode === 'archive' ? 'on' : ''} onClick={() => setMode('archive')}>
            ⟲ Replay
          </button>
        </div>
      </div>
    </header>
  );
}
