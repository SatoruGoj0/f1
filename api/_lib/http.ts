import type { IncomingMessage, ServerResponse } from 'node:http';

export type Req = IncomingMessage;
export type Res = ServerResponse;

export function query(req: Req): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams;
}

export function sendJson(res: Res, status: number, body: unknown, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

export const F1_STATIC = 'https://livetiming.formula1.com/static/';

export async function fetchText(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: { 'User-Agent': 'f1-pitwall' } });
  if (!r.ok) return null;
  return (await r.text()).replace(/^﻿/, '');
}
