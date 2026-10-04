import { useState } from 'react';
import { FLAG_COLORS, fmtClock } from '../lib/format';
import type { RcMessage } from '../lib/types';

type Msg = RcMessage & { t: number };

const FILTERS: { id: string; label: string; test: (m: Msg) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'flags', label: 'Flags', test: (m) => m.Category === 'Flag' },
  { id: 'sc', label: 'SC/VSC', test: (m) => m.Category === 'SafetyCar' || /SAFETY CAR|VSC/.test(m.Message) },
  { id: 'stewards', label: 'Stewards', test: (m) => /PENALTY|INVESTIGATION|NOTED|STEWARDS|REPRIMAND|DELETED/.test(m.Message) },
  { id: 'drs', label: 'DRS', test: (m) => m.Category === 'Drs' || /DRS/.test(m.Message) },
];

function icon(m: Msg) {
  if (m.Category === 'Flag') return { bg: FLAG_COLORS[m.Flag ?? ''] ?? '#6b7280', label: m.Flag === 'CHEQUERED' ? '🏁' : '⚑' };
  if (m.Category === 'SafetyCar') return { bg: '#f59e0b', label: m.Mode === 'VIRTUAL SAFETY CAR' ? 'VSC' : 'SC' };
  if (m.Category === 'Drs') return { bg: '#0ea5e9', label: 'DRS' };
  if (/PENALTY/.test(m.Message)) return { bg: '#dc2626', label: '!' };
  if (/INVESTIGATION|NOTED/.test(m.Message)) return { bg: '#f97316', label: '?' };
  if (/DELETED/.test(m.Message)) return { bg: '#64748b', label: '✕' };
  return { bg: '#334155', label: 'i' };
}

export function RaceControl({ messages, tz }: { messages: Msg[]; tz?: string }) {
  const [filter, setFilter] = useState('all');
  const f = FILTERS.find((x) => x.id === filter)!;
  const shown = messages.filter(f.test);
  return (
    <section className="panel rc">
      <header className="panel-head">
        <h2>Race Control</h2>
        <div className="seg-control">
          {FILTERS.map((x) => (
            <button key={x.id} className={x.id === filter ? 'on' : ''} onClick={() => setFilter(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </header>
      <ul className="feed">
        {shown.map((m, i) => {
          const ic = icon(m);
          return (
            <li key={`${m.Utc}-${i}`} className="rc-item">
              <span className="rc-icon" style={{ background: ic.bg, color: ic.bg === '#facc15' || ic.bg === '#e5e7eb' ? '#111' : '#fff' }}>
                {ic.label}
              </span>
              <div>
                <div className="rc-meta muted small">
                  {fmtClock(m.t, tz)}
                  {m.Lap ? ` · Lap ${m.Lap}` : ''}
                  {m.Scope === 'Sector' && m.Sector ? ` · Sector ${m.Sector}` : ''}
                </div>
                <div className="rc-msg">{m.Message}</div>
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="empty">No messages.</li>}
      </ul>
    </section>
  );
}
