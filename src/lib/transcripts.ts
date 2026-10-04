import { useSyncExternalStore } from 'react';
import { staticUrl } from './feed';

export interface Transcript {
  status: 'pending' | 'done' | 'error';
  text?: string;
  error?: string;
}

const store = new Map<string, Transcript>();
const listeners = new Set<() => void>();
let version = 0;
let modelProgress: number | null = null;

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function set(path: string, t: Transcript) {
  store.set(path, t);
  if (t.status === 'done') {
    try { localStorage.setItem(`radio:${path}`, t.text ?? ''); } catch { /* storage unavailable */ }
  }
  emit();
}

/** Whether the deployment has a server-side Whisper key. */
export const serverTranscription: Promise<boolean> = fetch('/api/transcribe?path=status')
  .then((r) => r.json())
  .then((b) => !!b.server)
  .catch(() => false);

// ---------- In-browser fallback ----------
let worker: Worker | null = null;
const waiting = new Map<string, (r: { text?: string; error?: string }) => void>();
let chain: Promise<unknown> = Promise.resolve();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') {
        modelProgress = m.progress;
        emit();
        return;
      }
      modelProgress = null;
      waiting.get(m.id)?.(m);
      waiting.delete(m.id);
      emit();
    };
  }
  return worker;
}

async function decode(path: string): Promise<Float32Array> {
  const buf = await fetch(staticUrl(path)).then((r) => {
    if (!r.ok) throw new Error(`clip ${r.status}`);
    return r.arrayBuffer();
  });
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const audio = await ctx.decodeAudioData(buf);
  return audio.getChannelData(0);
}

function browserTranscribe(path: string): Promise<string> {
  // One clip at a time: the model is heavy and shares one worker.
  const job = chain.then(async () => {
    const audio = await decode(path);
    return new Promise<string>((resolve, reject) => {
      waiting.set(path, (r) => (r.error ? reject(new Error(r.error)) : resolve(r.text ?? '')));
      getWorker().postMessage({ id: path, audio }, [audio.buffer]);
    });
  });
  chain = job.catch(() => undefined);
  return job;
}

// ---------- Public API ----------
export function requestTranscript(path: string, allowBrowser: boolean) {
  if (store.has(path) && store.get(path)!.status !== 'error') return;
  try {
    const cached = localStorage.getItem(`radio:${path}`);
    if (cached !== null) return set(path, { status: 'done', text: cached });
  } catch { /* storage unavailable */ }

  set(path, { status: 'pending' });
  serverTranscription
    .then(async (server) => {
      if (server) {
        const r = await fetch(`/api/transcribe?path=${encodeURIComponent(path)}`);
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
        return b.text as string;
      }
      if (!allowBrowser) throw new Error('disabled');
      return browserTranscribe(path);
    })
    .then((text) => set(path, { status: 'done', text }))
    .catch((err) => set(path, { status: 'error', error: (err as Error).message }));
}

export function useTranscripts() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return { get: (path: string) => store.get(path), modelProgress };
}
