import { useEffect, useRef, useState } from 'react';
import { RADIO_BASE } from '../lib/feed';
import { fmtClock, teamColor, timeAgo } from '../lib/format';
import { requestTranscript, serverTranscription, useTranscripts } from '../lib/transcripts';
import type { Capture, Driver } from '../lib/types';

const TEXT_PREF = 'radioText';
const AUTO_TRANSCRIBE = 12;

function readPref() {
  try { return localStorage.getItem(TEXT_PREF); } catch { return null; }
}

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
  const transcripts = useTranscripts();
  const [server, setServer] = useState<boolean | null>(null);
  const [textOn, setTextOn] = useState(readPref() === '1');

  useEffect(() => {
    serverTranscription.then((s) => {
      setServer(s);
      if (s && readPref() !== '0') setTextOn(true);
    });
  }, []);

  const toggleText = (on: boolean) => {
    setTextOn(on);
    try { localStorage.setItem(TEXT_PREF, on ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  const clipPath = (c: Cap) => (sessionPath ? sessionPath + c.Path : '');

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

  // Transcribe the newest clips automatically while text mode is on.
  useEffect(() => {
    if (!textOn || server === null || !sessionPath) return;
    for (const c of shown.slice(0, AUTO_TRANSCRIBE)) requestTranscript(sessionPath + c.Path, true);
  }, [textOn, server, sessionPath, shown]);

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
          <label
            className="toggle"
            title={server ? 'Transcribe radio with Whisper' : 'Transcribe in your browser (one-time ~75 MB model download)'}
          >
            <input type="checkbox" checked={textOn} onChange={(e) => toggleText(e.target.checked)} />
            Text{server === false ? ' (in-browser)' : ''}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            Auto-play new
          </label>
        </div>
      </header>
      {transcripts.modelProgress != null && (
        <div className="model-progress small muted">
          Downloading speech model… {Math.round(transcripts.modelProgress)}%
          <div className="wave"><div className="wave-fill" style={{ width: `${transcripts.modelProgress}%` }} /></div>
        </div>
      )}
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
                <RadioText path={clipPath(c)} state={transcripts.get(clipPath(c))} />
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="empty">No team radio yet.</li>}
      </ul>
    </section>
  );
}

export function RadioText({ path, state }: { path: string; state?: ReturnType<ReturnType<typeof useTranscripts>['get']> }) {
  if (!path) return null;
  if (!state || (state.status === 'error' && state.error === 'disabled')) {
    return (
      <button className="link small" onClick={() => requestTranscript(path, true)}>
        Show text
      </button>
    );
  }
  if (state.status === 'pending') return <div className="radio-text pending small">Transcribing…</div>;
  if (state.status === 'error') {
    return (
      <button className="link small error" onClick={() => requestTranscript(path, true)} title={state.error}>
        Transcription failed. Retry
      </button>
    );
  }
  return <div className="radio-text">{state.text ? `“${state.text}”` : <span className="muted small">(no speech)</span>}</div>;
}
