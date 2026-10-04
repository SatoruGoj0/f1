/// <reference lib="webworker" />
// In-browser Whisper, used when the server has no transcription key.
// transformers.js is loaded from the CDN so it stays out of the main bundle.

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'onnx-community/whisper-base.en';

type Asr = (audio: Float32Array, opts?: Record<string, unknown>) => Promise<{ text: string }>;
let asr: Promise<Asr> | null = null;

function load(): Promise<Asr> {
  asr ??= (async () => {
    const { pipeline } = await import(/* @vite-ignore */ LIB);
    const hasGpu = 'gpu' in navigator && !!(await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter().catch(() => null));
    return pipeline('automatic-speech-recognition', MODEL, {
      device: hasGpu ? 'webgpu' : 'wasm',
      dtype: hasGpu ? 'fp32' : 'q8',
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress' && p.file?.endsWith('.onnx')) self.postMessage({ type: 'progress', progress: p.progress ?? 0 });
      },
    }) as Promise<Asr>;
  })();
  return asr;
}

self.onmessage = async (e: MessageEvent<{ id: string; audio: Float32Array }>) => {
  const { id, audio } = e.data;
  try {
    const run = await load();
    const out = await run(audio, { chunk_length_s: 30 });
    self.postMessage({ type: 'done', id, text: out.text.trim() });
  } catch (err) {
    asr = null;
    self.postMessage({ type: 'error', id, error: (err as Error).message });
  }
};
