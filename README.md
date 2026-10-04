# F1 PitWall

Live Formula 1 team radio, race control, track map, tyres and timing — plus full session replays with GPS car positions.

- **Live**: `/api/live` opens F1's public SignalR feed, grabs the current state snapshot and caches it at the edge for a few seconds.
- **Replay**: `/api/static` proxies the official live-timing archive (`livetiming.formula1.com/static`); the browser rebuilds the session state at any instant.
- **Track map**: `/api/track` uses MultiViewer circuit outlines, or derives one from archived position data for new venues. Live car positions are estimated from timing mini-sectors (anonymous live feed has no GPS); replays use real positions.

```bash
npm install
npm run dev
```

Unofficial fan project, not affiliated with Formula 1.
