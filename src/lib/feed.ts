import type { Coll } from './types';

/** Immutable deep merge with F1 feed semantics: index-keyed objects patch arrays. */
export function merge(target: unknown, src: unknown): unknown {
  if (src === null || typeof src !== 'object') return src;
  if (Array.isArray(src)) return src;
  const patch = src as Record<string, unknown>;
  if (Array.isArray(target)) {
    const out = target.slice();
    for (const k of Object.keys(patch)) {
      const i = Number(k);
      if (Number.isInteger(i)) out[i] = merge(out[i], patch[k]);
    }
    return out;
  }
  const out: Record<string, unknown> =
    target && typeof target === 'object' ? { ...(target as Record<string, unknown>) } : {};
  for (const k of Object.keys(patch)) {
    if (k === '_deleted') {
      for (const d of patch[k] as string[]) delete out[d];
      continue;
    }
    out[k] = merge(out[k], patch[k]);
  }
  return out;
}

/** Normalises a feed collection (array or index-keyed object) to an array. */
export function list<T>(c: Coll<T> | undefined | null): T[] {
  if (!c) return [];
  if (Array.isArray(c)) return c.filter((x) => x != null);
  return Object.keys(c)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => +a - +b)
    .map((k) => c[k])
    .filter((x) => x != null);
}

const OFFSET_RE = /^(\d+):(\d{2}):(\d{2})\.(\d+)(.*)$/;

/** Parses a `.jsonStream` file into [offsetMs, payload] pairs. */
export function parseStream(text: string): [number, string][] {
  const out: [number, string][] = [];
  for (const raw of text.replace(/^﻿/, '').split('\n')) {
    const m = OFFSET_RE.exec(raw.trim());
    if (!m) continue;
    const ms = (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + Math.round(+`0.${m[4]}` * 1000);
    out.push([ms, m[5]]);
  }
  return out;
}

/** Parses F1 UTC timestamps (up to 7 fractional digits, zone suffix optional). */
export function parseUtc(s: string | undefined): number {
  if (!s) return NaN;
  const m = /^(.*?T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) return Date.parse(s);
  return Date.parse(m[1] + (m[2] ? m[2].slice(0, 4) : '') + (m[3] ?? 'Z'));
}

export function localToUtc(local: string, offset: string): number {
  const [h, mi] = offset.replace('-', '').split(':').map(Number);
  const sign = offset.startsWith('-') ? -1 : 1;
  return Date.parse(local + 'Z') - sign * (h * 60 + mi) * 60000;
}

export function staticUrl(path: string) {
  return `/api/static?path=${encodeURIComponent(path)}`;
}

export const RADIO_BASE = 'https://livetiming.formula1.com/static/';
