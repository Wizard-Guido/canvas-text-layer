import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite config used only for building the demos site that gets deployed to
// GitHub Pages at https://wizard-guido.github.io/canvas-text-layer/.
// The library itself is built via the `build:esm` / `build:cjs` / `build:dts`
// scripts in package.json (using bun build + tsc); vite is not involved there.
export default defineConfig({
  root: 'demos',
  // Must match the repo name so assets resolve under /canvas-text-layer/...
  base: '/canvas-text-layer/',
  build: {
    outDir: '../dist-demos',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'demos/index.html'),
        'markdown-chat': resolve(__dirname, 'demos/markdown-chat/index.html'),
      },
    },
  },
});
