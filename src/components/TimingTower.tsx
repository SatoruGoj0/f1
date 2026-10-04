import { list } from '../lib/feed';
import { compound, teamColor } from '../lib/format';
import { sessionKind, type Row } from '../lib/model';
import type { F1State, Sector, TimingLine } from '../lib/types';

const SEG_COLORS: Record<number, string> = {
  2048: '#facc15',
  2049: '#22c55e',
  2051: '#a855f7',
  2064: '#3b82f6',
  2052: '#facc15',
};

function sectorClass(s?: Sector) {
  if (!s?.Value) return '';
  if (s.OverallFastest) return 'purple';
  if (s.PersonalFastest) return 'green';
  return 'yellow';
}

function gapFor(line: TimingLine, kind: string, part: number) {
  if (kind === 'race') {
    return { gap: line.GapToLeader ?? '', int: line.IntervalToPositionAhead?.Value ?? '' };
  }
  const stats = list(line.Stats);
  const st = stats[part - 1] ?? stats[stats.length - 1];
  return {
    gap: st?.TimeDiffToFastest ?? line.TimeDiffToFastest ?? '',
    int: st?.TimeDifftoPositionAhead ?? line.TimeDiffToPositionAhead ?? '',
  };
}

function bestFor(line: TimingLine, kind: string, part: number) {
  if (kind === 'quali') {
    const b = list(line.BestLapTimes);
    return b[part - 1]?.Value || line.BestLapTime?.Value || '';
  }
  return line.BestLapTime?.Value ?? '';
}

export function TimingTower({
  state,
  rows,
  selected,
  onSelect,
}: {
  state: F1State;
  rows: Row[];
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const kind = sessionKind(state);
  const part = state.TimingData?.SessionPart ?? 1;
  const fastestLapOwner = rows.find((r) => r.line.BestLapTime?.Value && r.line.BestLapTime?.OverallFastest)?.num;

  return (
    <section className="panel tower">
      <header className="panel-head">
        <h2>Timing</h2>
        <span className="muted">
          {kind === 'quali' ? `Q${part}` : kind === 'race' ? 'Race' : 'Practice'} · {rows.length} drivers
        </span>
      </header>
      <div className="tower-scroll">
        <table className="tower-table">
          <thead>
            <tr>
              <th>P</th>
              <th className="left">Driver</th>
              <th>{kind === 'race' ? 'Gap' : 'Gap'}</th>
              <th>Int</th>
              <th>Last</th>
              <th>Best</th>
              <th className="sectors-h">Sectors</th>
              <th>Tyre</th>
              <th>Pit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { gap, int } = gapFor(r.line, kind, part);
              const sectors = list(r.line.Sectors);
              const stint = r.stints[r.stints.length - 1];
              const c = compound(stint?.Compound);
              const out = r.line.Retired || r.line.Stopped || r.line.KnockedOut;
              const delta = kind === 'race' && r.gridPos ? r.gridPos - r.position : 0;
              return (
                <tr
                  key={r.num}
                  className={`${selected === r.num ? 'sel' : ''} ${out ? 'out' : ''}`}
                  onClick={() => onSelect(selected === r.num ? null : r.num)}
                >
                  <td className="pos">
                    {r.position < 99 ? r.position : '–'}
                    {delta !== 0 && <span className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>}
                  </td>
                  <td className="left drv">
                    <span className="bar" style={{ background: teamColor(r.driver.TeamColour) }} />
                    <span className="tla">{r.driver.Tla}</span>
                    <span className="num muted">{r.num}</span>
                    {r.line.InPit && <span className="badge pit">PIT</span>}
                    {r.line.PitOut && !r.line.InPit && <span className="badge out">OUT</span>}
                    {r.line.Retired && <span className="badge ret">RET</span>}
                    {r.line.Stopped && !r.line.Retired && <span className="badge ret">STOP</span>}
                    {r.line.KnockedOut && <span className="badge ko">KO</span>}
                    {fastestLapOwner === r.num && <span className="badge fl">FL</span>}
                  </td>
                  <td className="mono">{r.position === 1 && kind === 'race' ? (gap || 'Leader') : gap}</td>
                  <td className={`mono ${r.line.IntervalToPositionAhead?.Catching ? 'catching' : ''}`}>{int}</td>
                  <td className={`mono ${r.line.LastLapTime?.OverallFastest ? 'purple' : r.line.LastLapTime?.PersonalFastest ? 'green' : ''}`}>
                    {r.line.LastLapTime?.Value ?? ''}
                  </td>
                  <td className={`mono ${r.line.BestLapTime?.OverallFastest ? 'purple' : ''}`}>{bestFor(r.line, kind, part)}</td>
                  <td className="sectors">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="sector">
                        <div className="segs">
                          {list(sectors[i]?.Segments).map((s, j) => (
                            <i key={j} style={{ background: SEG_COLORS[s.Status ?? 0] ?? 'var(--seg-empty)' }} />
                          ))}
                        </div>
                        <span className={`mono ${sectorClass(sectors[i])}`}>{sectors[i]?.Value || '–'}</span>
                      </div>
                    ))}
                  </td>
                  <td>
                    {stint ? (
                      <span className="tyre" title={`${stint.Compound} · ${stint.New === 'true' ? 'new' : 'used'}`}>
                        <span className="tyre-dot" style={{ borderColor: c.color, color: c.color }}>
                          {c.letter}
                        </span>
                        <span className="mono muted">{stint.TotalLaps ?? 0}L</span>
                      </span>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                  <td className="mono muted">{r.line.NumberOfPitStops ?? (r.stints.length ? r.stints.length - 1 : '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="empty">Waiting for timing data…</p>}
      </div>
    </section>
  );
}
