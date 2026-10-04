import { archivedSessionsAt, deriveTrack, multiviewerTrack } from './_lib/track.js';
import { query, sendJson, type Req, type Res } from './_lib/http.js';

export default async function handler(req: Req, res: Res) {
  const q = query(req);
  const circuit = Number(q.get('circuit'));
  const year = Number(q.get('year')) || new Date().getUTCFullYear();
  const path = q.get('path') ?? '';
  if (!circuit) return sendJson(res, 400, { error: 'circuit required' });

  try {
    const mv = await multiviewerTrack(circuit, year);
    if (mv) return sendJson(res, 200, mv, 'public, s-maxage=604800, stale-while-revalidate=86400');

    // No published outline (e.g. a new venue): derive one from archived position data.
    const candidates = await archivedSessionsAt(circuit, year);
    if (/^\d{4}\/[\w\-./]+\/$/.test(path)) candidates.unshift(path);
    for (const p of [...new Set(candidates)].slice(0, 4)) {
      const t = await deriveTrack(p);
      if (t) return sendJson(res, 200, t, 'public, s-maxage=86400, stale-while-revalidate=86400');
    }
    sendJson(res, 404, { error: 'no track outline available yet' }, 'public, s-maxage=600');
  } catch (err) {
    sendJson(res, 500, { error: (err as Error).message });
  }
}
