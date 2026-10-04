import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { CROSSROADS_CONFIG } from '../src/engine/core/crossroads';
/** Emits the self-running phone rig and the installed Three version into every production web build. */
export function crossroadsRigPlugin(build: string): Plugin {
  let root = process.cwd();
  return {
    name: 'wildshard-crossroads-rig',
    configResolved(config) { root = config.root; },
    generateBundle() {
      const emit = (name: string, source: string): void => { this.emitFile({ type: 'asset', fileName: `crossroads-rig/${name}`, source }); };
      emit('index.html', readFileSync(join(root, 'scripts/crossroads-rig/production.html'), 'utf8'));
      for (const name of ['core.js', 'phone.js']) emit(name, readFileSync(join(root, 'scripts/crossroads-rig', name), 'utf8'));
      emit('config.js', `export const BUILD = ${JSON.stringify(build)};\nexport const CFG = Object.freeze(${JSON.stringify(CROSSROADS_CONFIG)});\n`);
      for (const name of ['three.module.js', 'three.core.js']) emit(name, readFileSync(join(root, 'node_modules/three/build', name), 'utf8'));
    },
  };
}
