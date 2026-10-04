import { useLiveEstimator } from '../lib/live';
import { teamColor, TRACK_STATUS } from '../lib/format';
import { isRunning, type Row } from '../lib/model';
import { pointAtFraction, type TrackGeom } from '../lib/track';
import type { F1State, XY } from '../lib/types';

export function TrackMap({
  track,
  trackError,
  state,
  rows,
  now,
  positions,
  selected,
  onSelect,
}: {
  track: TrackGeom | null;
  trackError: string | null;
  state: F1State;
  rows: Row[];
  now: number;
  positions: Record<string, XY> | null;
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const estimate = useLiveEstimator();
  const status = state.TrackStatus?.Status ?? '1';
  const statusColor = status === '1' ? null : TRACK_STATUS[status]?.color;
  const running = isRunning(state);

  if (!track) {
    return (
      <section className="panel map">
        <header className="panel-head"><h2>Track</h2></header>
        <p className="empty">{trackError ?? 'Loading circuit…'}</p>
      </section>
    );
  }

  const r = track.size / 70;
  const cars: { row: Row; at: XY }[] = [];
  for (const row of rows) {
    if (row.line.Retired) continue;
    if (positions) {
      const p = positions[row.num];
      if (p) cars.push({ row, at: track.project(p) });
    } else {
      const f = estimate(row.num, row.line, track, now, running);
      if (f != null) cars.push({ row, at: pointAtFraction(track, f) });
    }
  }
  // Draw the selected car last so it sits on top.
  cars.sort((a, b) => (a.row.num === selected ? 1 : 0) - (b.row.num === selected ? 1 : 0) || b.row.position - a.row.position);

  const p0 = track.points[0];
  const p1 = track.points[Math.min(3, track.points.length - 1)];
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const fl = { x: -Math.sin(ang) * r * 1.8, y: Math.cos(ang) * r * 1.8 };

  return (
    <section className="panel map">
      <header className="panel-head">
        <h2>Track</h2>
        <span className="muted small">
          {positions ? 'GPS positions' : 'Positions estimated from timing mini-sectors'}
        </span>
      </header>
      <div className="map-wrap">
        <svg viewBox={track.viewBox} className="map-svg" role="img" aria-label="Track map with car positions">
          <path d={track.d} className="track-outer" strokeWidth={r * 1.6} />
          <path
            d={track.d}
            className="track-inner"
            strokeWidth={r * 0.9}
            style={statusColor ? { stroke: statusColor } : undefined}
          />
          <line
            x1={p0.x - fl.x}
            y1={p0.y - fl.y}
            x2={p0.x + fl.x}
            y2={p0.y + fl.y}
            className="finish"
            strokeWidth={r * 0.5}
          />
          {track.corners.map((c) => (
            <text
              key={c.label}
              x={c.at.x + c.dir.x * r * 3.2}
              y={c.at.y + c.dir.y * r * 3.2}
              className="corner"
              fontSize={r * 1.7}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {c.label}
            </text>
          ))}
          {cars.map(({ row, at }) => {
            const sel = row.num === selected;
            const dim = selected && !sel;
            return (
              <g
                key={row.num}
                className={`car ${sel ? 'sel' : ''} ${row.line.InPit ? 'inpit' : ''}`}
                style={{ transform: `translate(${at.x}px, ${at.y}px)`, opacity: dim ? 0.45 : 1 }}
                onClick={() => onSelect(sel ? null : row.num)}
              >
                <circle r={sel ? r * 1.35 : r} fill={teamColor(row.driver.TeamColour)} className="car-dot" strokeWidth={r * 0.25} />
                <text x={r * 1.6} y={-r * 1.2} fontSize={r * 1.9} strokeWidth={r * 0.45} className="car-label">
                  {row.driver.Tla}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
