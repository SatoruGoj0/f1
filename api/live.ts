import { fetchLiveSnapshot } from './_lib/signalr.js';
import { sendJson, type Req, type Res } from './_lib/http.js';

export default async function handler(_req: Req, res: Res) {
  try {
    const state = await fetchLiveSnapshot();
    // Short shared CDN cache so many viewers share one upstream connection.
    sendJson(res, 200, { fetchedAt: Date.now(), state }, 'public, max-age=0, s-maxage=3, stale-while-revalidate=6');
  } catch (err) {
    sendJson(res, 502, { error: (err as Error).message });
  }
}
