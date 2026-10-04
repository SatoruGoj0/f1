import { F1_STATIC, query, RADIO_PATH, sendJson, type Req, type Res } from './_lib/http.js';

// Any OpenAI-compatible Whisper endpoint works; Groq has a free tier.
const PROVIDERS = [
  { key: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
  { key: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' },
];

const PROMPT =
  'Formula 1 team radio between a driver and race engineer. Box, box. DRS. Copy. Push now. Tyres, softs, mediums, hards, inters. Safety car, VSC. Gap, delta, pit window.';

export default async function handler(req: Req, res: Res) {
  const provider = PROVIDERS.find((p) => process.env[p.key]);
  const path = query(req).get('path') ?? '';
  if (path === 'status') return sendJson(res, 200, { server: !!provider }, 'public, s-maxage=300');
  if (!provider) return sendJson(res, 501, { error: 'no transcription key configured' }, 'public, s-maxage=300');
  if (!RADIO_PATH.test(path) || path.includes('..')) return sendJson(res, 400, { error: 'invalid path' });

  try {
    const clip = await fetch(F1_STATIC + path, { headers: { 'User-Agent': 'f1-pitwall' } });
    if (!clip.ok) return sendJson(res, 404, { error: `clip ${clip.status}` }, 'public, s-maxage=60');

    const form = new FormData();
    form.append('file', new Blob([await clip.arrayBuffer()], { type: 'audio/mpeg' }), 'radio.mp3');
    form.append('model', provider.model);
    form.append('language', 'en');
    form.append('prompt', PROMPT);
    form.append('response_format', 'json');
    form.append('temperature', '0');

    const r = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env[provider.key]}` },
      body: form,
    });
    if (!r.ok) return sendJson(res, 502, { error: `transcription failed: ${r.status} ${(await r.text()).slice(0, 200)}` });
    const { text } = (await r.json()) as { text: string };
    // Clips never change, so let the CDN keep each transcript for a year.
    sendJson(res, 200, { text: text.trim(), source: 'server' }, 'public, max-age=86400, s-maxage=31536000, immutable');
  } catch (err) {
    sendJson(res, 500, { error: (err as Error).message });
  }
}
