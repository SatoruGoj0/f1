import { F1_STATIC, query, sendJson, type Req, type Res } from './_lib/http.js';

const ALLOWED = /^\d{4}\/(Index\.json|[\w\-.]+\/[\w\-.]+\/[\w\-.]+\.(json|jsonStream))$/;

export default async function handler(req: Req, res: Res) {
  const path = query(req).get('path') ?? '';
  if (!ALLOWED.test(path) || path.includes('..')) return sendJson(res, 400, { error: 'invalid path' });

  const upstream = await fetch(F1_STATIC + path, { headers: { 'User-Agent': 'f1-pitwall' } });
  if (!upstream.ok) return sendJson(res, upstream.status, { error: `upstream ${upstream.status}` }, 'public, s-maxage=60');

  const body = (await upstream.text()).replace(/^﻿/, '');
  res.statusCode = 200;
  res.setHeader('Content-Type', path.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
  // Year index changes during a season; finished session files are effectively immutable.
  res.setHeader(
    'Cache-Control',
    path.endsWith('Index.json') ? 'public, s-maxage=300, stale-while-revalidate=600' : 'public, max-age=3600, s-maxage=86400',
  );
  res.end(body);
}
