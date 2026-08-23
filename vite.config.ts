import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@overlays': path.resolve(__dirname, 'src/renderer/overlays'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
      '@styles': path.resolve(__dirname, 'src/renderer/styles'),
    },
  },
});
