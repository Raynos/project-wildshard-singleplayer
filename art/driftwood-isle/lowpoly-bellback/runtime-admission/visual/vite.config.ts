import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { assertHeavyLease } from '../../../../../scripts/heavy-lane-lease.mjs';
export default defineConfig(({command}) => {
  if (command === 'build') assertHeavyLease('build');
  return { publicDir: false, build: { outDir: 'tmp/bellback-native-visual/bundle2', emptyOutDir: false,
    target: 'es2022', lib: { entry: resolve('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/diagnostic.ts'), formats: ['es'], fileName: () => 'diagnostic.js' },
    rolldownOptions: { output: { inlineDynamicImports: true } } } };
});
