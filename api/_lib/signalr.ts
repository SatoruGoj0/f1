import WebSocket from 'ws';

const BASE = 'https://livetiming.formula1.com/signalrcore';
const RS = '\x1e';

// Topics available to anonymous clients (CarData.z / Position.z require an F1TV token).
export const TOPICS = [
  'Heartbeat',
  'ExtrapolatedClock',
  'TopThree',
  'TimingStats',
  'TimingAppData',
  'WeatherData',
  'TrackStatus',
  'SessionStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'TimingData',
  'TeamRadio',
  'ChampionshipPrediction',
];

/** Opens a SignalR Core connection, subscribes, and resolves with the full state snapshot. */
export async function fetchLiveSnapshot(timeoutMs = 8000): Promise<Record<string, unknown>> {
  const neg = await fetch(`${BASE}/negotiate?negotiateVersion=1`, { method: 'POST' });
  if (!neg.ok) throw new Error(`negotiate failed: ${neg.status}`);
  const cookie = (neg.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const { connectionToken } = (await neg.json()) as { connectionToken: string };

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace('https', 'wss')}?id=${encodeURIComponent(connectionToken)}`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('snapshot timeout'));
    }, timeoutMs);
    const done = (fn: () => void) => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      fn();
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
      ws.send(JSON.stringify({ type: 1, invocationId: '1', target: 'Subscribe', arguments: [TOPICS] }) + RS);
    });
    ws.on('message', (data) => {
      for (const part of data.toString().split(RS)) {
        if (!part) continue;
        let msg: { type?: number; invocationId?: string; result?: Record<string, unknown>; error?: string };
        try { msg = JSON.parse(part); } catch { continue; }
        if (msg.type === 3 && msg.invocationId === '1') {
          if (msg.error) done(() => reject(new Error(msg.error)));
          else done(() => resolve(msg.result ?? {}));
        } else if (msg.type === 7) {
          done(() => reject(new Error(msg.error ?? 'connection closed by server')));
        }
      }
    });
    ws.on('error', (err) => done(() => reject(err)));
  });
}
