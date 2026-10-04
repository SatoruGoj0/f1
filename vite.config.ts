import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Serves /api/* from the Vercel function files during `vite dev`.
function vercelApi(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/(\w+)/.exec(req.url ?? '');
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          await mod.default(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({ plugins: [react(), vercelApi()] });
