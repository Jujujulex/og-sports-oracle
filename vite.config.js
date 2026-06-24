import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves from a subpath; Vercel (and `vite dev`) serve from root.
  base: process.env.VERCEL ? '/' : '/og-sports-oracle/'
});
