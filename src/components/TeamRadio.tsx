import { useEffect, useRef, useState } from 'react';
import { RADIO_BASE } from '../lib/feed';
import { fmtClock, teamColor, timeAgo } from '../lib/format';
import type { Capture, Driver } from '../lib/types';

type Cap = Capture & { t: number };

export function TeamRadio({
  captures,
  drivers,
  sessionPath,
  now,
  selected,
  onSelect,
  tz,
}: {
  captures: Cap[];
  drivers: Record<string, Driver>;
  sessionPath?: string;
  now: number;
  selected: string | null;
  onSelect: (n: string | null) => void;
  tz?: string;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]);

  const url = (c: Cap) => (sessionPath ? RADIO_BASE + sessionPath + c.Path : '');

  const play = (src: string) => {
    const a = audio.current;
    if (!a || !src) return;
    if (playing === src && !a.paused) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = src;
    a.play().then(() => setPlaying(src)).catch(() => setPlaying(null));
  };

  // Queue clips that appear after the first render when auto-play is on.
  useEffect(() => {
    const keys = captures.map((c) => c.Path);
    if (!seen.current) {
      seen.current = new Set(keys);
      return;
    }
    const fresh = captures.filter((c) => !seen.current!.has(c.Path)).reverse();
    fresh.forEach((c) => seen.current!.add(c.Path));
    if (autoplay && fresh.length) {
      queue.current.push(...fresh.map(url));
      const a = audio.current;
      if (a && (a.paused || a.ended)) {
        const next = queue.current.shift();
        if (next) play(next);
      }
    }
  }, [captures, autoplay]);

  useEffect(() => {
    seen.current = null;
    queue.current = [];
  }, [sessionPath]);

  const shown = onlySelected && selected ? captures.filter((c) => c.RacingNumber === selected) : captures;

  return (
    <section className="panel radio">
      <header className="panel-head">
        <h2>Team Radio</h2>
        <div className="head-tools">
          {selected && (
            <label className="toggle">
              <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
              {drivers[selected]?.Tla ?? selected} only
            </label>
          )}
          <label className="toggle">
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            Auto-play new
          </label>
        </div>
      </header>
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
        onEnded={() => {
          setProgress(0);
          const next = queue.current.shift();
          if (next) play(next);
          else setPlaying(null);
        }}
        onPause={() => setPlaying((p) => (audio.current?.ended ? null : p))}
      />
      <ul className="feed">
        {shown.map((c) => {
          const d = drivers[c.RacingNumber];
          const src = url(c);
          const isPlaying = playing === src;
          return (
            <li key={c.Path} className={`radio-item ${isPlaying ? 'playing' : ''}`}>
              <button className="play" onClick={() => play(src)} aria-label={isPlaying ? 'Pause' : 'Play radio'}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <div className="radio-body">
                <div className="radio-top">
                  <button className="chip" style={{ borderColor: teamColor(d?.TeamColour) }} onClick={() => onSelect(c.RacingNumber)}>
                    <span className="bar" style={{ background: teamColor(d?.TeamColour) }} />
                    {d?.Tla ?? c.RacingNumber}
                  </button>
                  <span className="muted small">{d?.TeamName}</span>
                  <span className="muted small right" title={fmtClock(c.t, tz)}>
                    {fmtClock(c.t, tz)} · {timeAgo(c.t, now)}
                  </span>
                </div>
                <div className="wave">
                  <div className="wave-fill" style={{ width: isPlaying ? `${progress * 100}%` : '0%' }} />
                </div>
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="empty">No team radio yet.</li>}
      </ul>
    </section>
  );
}
