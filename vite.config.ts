/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // served from https://jonasward.github.io/chocolade-chaud/
  base: '/chocolade-chaud/',
  plugins: [react()],
  build: {
    // gh-pages deploys this folder
    outDir: 'build',
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
