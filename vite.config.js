import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { getMatches, getAnalysis, getStandings } from './api/_sports';

// Dev-only middleware that mirrors the Vercel serverless functions, so
// `npm run dev` serves real data from /api/* just like production (Vite
// alone doesn't run the /api functions). Reads FOOTBALL_DATA_KEY from .env.
function devApi(env) {
  const key = env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_KEY;
  return {
    name: 'dev-sports-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        try {
          let payload;
          if (url.pathname === '/api/matches') {
            payload = await getMatches(key);
          } else if (url.pathname === '/api/analysis') {
            payload = await getAnalysis(key, Object.fromEntries(url.searchParams));
          } else if (url.pathname === '/api/standings') {
            payload = await getStandings(key);
          } else {
            return next();
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        } catch (err) {
          res.statusCode = err?.status ?? 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message ?? 'Server error', detail: err?.detail }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), devApi(env)],
    // GitHub Pages serves from a subpath; Vercel (and `vite dev`) serve from root.
    base: process.env.VERCEL ? '/' : '/og-sports-oracle/',
  };
});
