import { useEffect, useMemo, useState } from 'react';
import { DriverPanel } from './components/DriverPanel';
import { Header } from './components/Header';
import { RaceControl } from './components/RaceControl';
import { ArchivePicker, ReplayBar } from './components/ReplayControls';
import { TeamRadio } from './components/TeamRadio';
import { TimingTower } from './components/TimingTower';
import { TrackMap } from './components/TrackMap';
import { TyreStrategy } from './components/TyreStrategy';
import { useLiveFeed } from './lib/live';
import { captures, drivers, messages, rows } from './lib/model';
import { loadReplay, loadYearIndex, type Replay } from './lib/replay';
import { useTrack } from './lib/track';
import type { F1State } from './lib/types';

type Mode = 'live' | 'archive';

function initialReplayPath() {
  const p = new URLSearchParams(location.search).get('replay');
  return p && /^\d{4}\/[\w\-./]+\/$/.test(p) ? p : null;
}

export default function App() {
  const [mode, setModeRaw] = useState<Mode>(initialReplayPath() ? 'archive' : 'live');
  const [selected, setSelected] = useState<string | null>(null);
  const [wall, setWall] = useState(Date.now());

  // Live
  const live = useLiveFeed(mode === 'live');
  const [next, setNext] = useState<{ label: string; at: number } | null>(null);

  // Replay
  const [replay, setReplay] = useState<Replay | null>(null);
  const [replayPath, setReplayPath] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const setMode = (m: Mode) => {
    setModeRaw(m);
    setSelected(null);
    if (m === 'live') {
      setPlaying(false);
      history.replaceState(null, '', location.pathname);
    } else if (replayPath) {
      history.replaceState(null, '', `?replay=${encodeURIComponent(replayPath)}`);
    }
  };

  const openReplay = async (path: string) => {
    setLoading('Fetching session…');
    setLoadError(null);
    setPlaying(false);
    try {
      const r = await loadReplay(path, setLoading);
      setReplay(r);
      setReplayPath(path);
      setT(r.startedAt);
      setSelected(null);
      history.replaceState(null, '', `?replay=${encodeURIComponent(path)}`);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    const p = initialReplayPath();
    if (p) openReplay(p);
  }, []);

  // Clock: wall time for live, simulated session time for replays.
  useEffect(() => {
    const id = setInterval(() => {
      setWall(Date.now());
      if (mode === 'archive' && playing && replay) {
        setT((x) => {
          const n = x + 200 * speed;
          if (n >= replay.end) {
            setPlaying(false);
            return replay.end;
          }
          return n;
        });
      }
    }, 200);
    return () => clearInterval(id);
  }, [mode, playing, speed, replay]);

  // Upcoming session countdown for the live view.
  useEffect(() => {
    if (mode !== 'live') return;
    loadYearIndex(new Date().getUTCFullYear()).then((ms) => {
      const upcoming = ms
        .flatMap((m) => m.sessions.map((s) => ({ label: `${m.name} ${s.name}`, at: s.startUtc })))
        .filter((s) => s.at > Date.now())
        .sort((a, b) => a.at - b.at)[0];
      setNext(upcoming ?? null);
    });
  }, [mode]);

  const state: F1State = useMemo(() => {
    if (mode === 'live') return live.state ?? {};
    return replay ? replay.stateAt(t) : {};
  }, [mode, live.state, replay, t]);

  const now = mode === 'live' ? wall : t;
  const positions = mode === 'archive' && replay?.positions ? replay.positions.at(t) : null;

  const info = state.SessionInfo;
  const year = Number((info?.Path ?? '').slice(0, 4)) || new Date().getUTCFullYear();
  const { track, error: trackError } = useTrack(info?.Meeting?.Circuit?.Key, year, info?.Path);

  const allRows = useMemo(() => rows(state), [state]);
  const ds = useMemo(() => drivers(state), [state]);
  const caps = useMemo(() => captures(state), [state]);
  const msgs = useMemo(() => messages(state), [state]);
  const selectedRow = allRows.find((r) => r.num === selected);

  return (
    <div className="app">
      <Header state={state} now={now} mode={mode} setMode={setMode} liveInfo={live} next={next} />

      {mode === 'archive' && (
        <div className="archive-strip">
          <ArchivePicker
            onLoad={(s) => openReplay(s.path)}
            loading={loading}
            currentPath={replayPath ?? undefined}
          />
          {loadError && <span className="error small">{loadError}</span>}
          {replay && (
            <ReplayBar
              start={replay.start}
              end={replay.end}
              t={t}
              playing={playing}
              speed={speed}
              onSeek={setT}
              onToggle={() => setPlaying((p) => !p)}
              onSpeed={setSpeed}
            />
          )}
        </div>
      )}

      {mode === 'archive' && !replay && !loading && (
        <div className="notice">Pick a season, Grand Prix and session above to replay it with GPS car positions, team radio and race control.</div>
      )}
      {mode === 'live' && live.error && !live.state && (
        <div className="notice error">Couldn’t reach the live timing feed ({live.error}). Retrying…</div>
      )}

      <main className="grid">
        <TimingTower state={state} rows={allRows} selected={selected} onSelect={setSelected} />
        <TrackMap
          track={track}
          trackError={trackError}
          state={state}
          rows={allRows}
          now={now}
          positions={positions}
          selected={selected}
          onSelect={setSelected}
        />
        <TyreStrategy
          rows={allRows}
          totalLaps={state.LapCount?.TotalLaps}
          currentLap={state.LapCount?.CurrentLap}
          selected={selected}
          onSelect={setSelected}
        />
        <TeamRadio
          captures={caps}
          drivers={ds}
          sessionPath={info?.Path}
          now={now}
          selected={selected}
          onSelect={setSelected}
        />
        <RaceControl messages={msgs} />
      </main>

      {selectedRow && (
        <DriverPanel row={selectedRow} state={state} captures={caps} onClose={() => setSelected(null)} />
      )}

      <footer className="foot muted small">
        Unofficial fan project — not affiliated with Formula 1. Timing data and radio © Formula One World Championship Limited.
      </footer>
    </div>
  );
}
