import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Builds a single self-contained IIFE bundle for the Tampermonkey userscript.
 * `scripts/build-userscript.mjs` wraps the JavaScript and extracted CSS in the
 * userscript metadata and shadow-root bootstrapper.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-userscript',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/userscript-entry.tsx'),
      name: 'OneSwaggerUserScript',
      formats: ['iife'],
      fileName: () => 'one-swagger-app.js',
      cssFileName: 'one-swagger-app',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
