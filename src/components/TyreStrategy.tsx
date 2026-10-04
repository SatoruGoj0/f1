import { compound, teamColor } from '../lib/format';
import type { Row } from '../lib/model';

export function TyreStrategy({
  rows,
  totalLaps,
  currentLap,
  selected,
  onSelect,
}: {
  rows: Row[];
  totalLaps?: number;
  currentLap?: number;
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const spans = rows.map((r) => {
    let lap = 0;
    return {
      row: r,
      stints: r.stints.map((s) => {
        const len = Math.max(0, (s.TotalLaps ?? 0) - (s.StartLaps ?? 0));
        const seg = { from: lap, len, s };
        lap += len;
        return seg;
      }),
      laps: lap,
    };
  });
  const maxLaps = Math.max(totalLaps ?? 0, currentLap ?? 0, ...spans.map((s) => s.laps), 1);

  return (
    <section className="panel strategy">
      <header className="panel-head">
        <h2>Tyre Strategy</h2>
        <span className="muted small">
          {currentLap ? `Lap ${currentLap}${totalLaps ? ` / ${totalLaps}` : ''}` : `${maxLaps} laps`}
        </span>
      </header>
      <div className="strat-scroll">
        {spans.map(({ row, stints }) => (
          <div
            key={row.num}
            className={`strat-row ${selected === row.num ? 'sel' : ''}`}
            onClick={() => onSelect(selected === row.num ? null : row.num)}
          >
            <span className="strat-name">
              <span className="bar" style={{ background: teamColor(row.driver.TeamColour) }} />
              {row.driver.Tla}
            </span>
            <div className="strat-track">
              {stints.map(({ from, len, s }, i) => {
                const c = compound(s.Compound);
                return (
                  <div
                    key={i}
                    className="stint"
                    title={`${s.Compound ?? '?'} · ${len} laps · ${s.New === 'true' ? 'new' : `used (${s.StartLaps ?? 0} laps)`}`}
                    style={{
                      left: `${(from / maxLaps) * 100}%`,
                      width: `${Math.max((len / maxLaps) * 100, 0.6)}%`,
                      background: c.color,
                      color: c.text,
                    }}
                  >
                    {len >= maxLaps * 0.06 ? `${c.letter}${s.New === 'true' ? '' : '*'} ${len}` : ''}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!rows.length && <p className="empty">No stint data.</p>}
      </div>
      <div className="legend">
        {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map((k) => (
          <span key={k}>
            <i style={{ background: compound(k).color }} /> {k.toLowerCase()}
          </span>
        ))}
        <span className="muted">* used set</span>
      </div>
    </section>
  );
}
