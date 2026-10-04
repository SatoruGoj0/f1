import { list, RADIO_BASE } from '../lib/feed';
import { compound, fmtClock, teamColor } from '../lib/format';
import type { Row } from '../lib/model';
import type { Capture, F1State } from '../lib/types';

export function DriverPanel({
  row,
  state,
  captures,
  onClose,
  tz,
}: {
  row: Row;
  state: F1State;
  captures: (Capture & { t: number })[];
  onClose: () => void;
  tz?: string;
}) {
  const d = row.driver;
  const l = row.line;
  const color = teamColor(d.TeamColour);
  const stats = state.TimingStats?.Lines?.[row.num];
  const radios = captures.filter((c) => c.RacingNumber === row.num).slice(0, 8);
  const path = state.SessionInfo?.Path;
  const speeds = (['I1', 'I2', 'FL', 'ST'] as const).map((k) => ({
    k,
    v: l.Speeds?.[k]?.Value,
    best: stats?.BestSpeeds?.[k]?.Value,
    of: l.Speeds?.[k]?.OverallFastest,
  }));

  return (
    <aside className="driver-panel" style={{ ['--team' as string]: color }}>
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="dp-head">
        {d.HeadshotUrl && <img src={d.HeadshotUrl.replace('1col', '4col')} alt="" className="headshot" />}
        <div>
          <div className="dp-num mono">{row.num}</div>
          <div className="dp-name">
            {d.FirstName} <b>{d.LastName ?? d.FullName}</b>
          </div>
          <div className="muted">{d.TeamName}</div>
        </div>
      </div>

      <div className="dp-grid">
        <div><span className="muted small">Position</span><b>{row.position < 99 ? `P${row.position}` : '–'}</b></div>
        <div><span className="muted small">Grid</span><b>{row.gridPos ? `P${row.gridPos}` : '–'}</b></div>
        <div><span className="muted small">Laps</span><b>{l.NumberOfLaps ?? '–'}</b></div>
        <div><span className="muted small">Pit stops</span><b>{l.NumberOfPitStops ?? '–'}</b></div>
        <div><span className="muted small">Last lap</span><b className="mono">{l.LastLapTime?.Value || '–'}</b></div>
        <div><span className="muted small">Best lap</span><b className="mono">{l.BestLapTime?.Value || stats?.PersonalBestLapTime?.Value || '–'}</b></div>
        <div><span className="muted small">Gap</span><b className="mono">{l.GapToLeader || '–'}</b></div>
        <div><span className="muted small">Interval</span><b className="mono">{l.IntervalToPositionAhead?.Value || '–'}</b></div>
      </div>

      <h3>Sectors</h3>
      <div className="dp-sectors">
        {list(l.Sectors).map((s, i) => (
          <div key={i}>
            <span className="muted small">S{i + 1}</span>
            <b className={`mono ${s.OverallFastest ? 'purple' : s.PersonalFastest ? 'green' : ''}`}>{s.Value || s.PreviousValue || '–'}</b>
          </div>
        ))}
      </div>

      <h3>Speed traps (km/h)</h3>
      <div className="dp-sectors">
        {speeds.map((s) => (
          <div key={s.k}>
            <span className="muted small">{s.k}</span>
            <b className={`mono ${s.of ? 'purple' : ''}`}>{s.v || '–'}</b>
            {s.best && <span className="muted small">best {s.best}</span>}
          </div>
        ))}
      </div>

      <h3>Tyres</h3>
      <div className="dp-stints">
        {row.stints.map((s, i) => {
          const c = compound(s.Compound);
          return (
            <div key={i} className="dp-stint">
              <span className="tyre-dot" style={{ borderColor: c.color, color: c.color }}>{c.letter}</span>
              <span>
                Stint {i + 1}: {s.Compound?.toLowerCase() ?? '?'} · {Math.max(0, (s.TotalLaps ?? 0) - (s.StartLaps ?? 0))} laps
                {s.New === 'true' ? ' · new' : ` · used +${s.StartLaps ?? 0}`}
              </span>
            </div>
          );
        })}
        {!row.stints.length && <span className="muted">No stints yet</span>}
      </div>

      <h3>Recent radio</h3>
      <ul className="dp-radio">
        {radios.map((c) => (
          <li key={c.Path}>
            <span className="muted small">{fmtClock(c.t, tz)}</span>
            {path && <audio controls preload="none" src={RADIO_BASE + path + c.Path} />}
          </li>
        ))}
        {!radios.length && <li className="muted">No radio from this driver.</li>}
      </ul>
    </aside>
  );
}
