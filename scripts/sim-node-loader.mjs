// Plain Node type stripping plus the same Rapier binding selection as the client/tests; no app identity or shard list.
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@dimforge/rapier3d-simd') return next('@dimforge/rapier3d-simd/rapier.js', context);
    if (/^\.\/rapier_wasm3d(?:\.js)?$/u.test(specifier)) return { url: new URL('../src/engine/physics/rapierBindings.ts', import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const at = new URL(specifier, context.parentURL);
      for (const suffix of ['', '.ts', '.js', '/index.ts', '/index.js']) {
        const url = new URL(at.href + suffix);
        if (existsSync(fileURLToPath(url)) && statSync(fileURLToPath(url)).isFile()) {
          if (/\/src\/engine\/(?:app\/runtime\.ts|render\/|ui\/|fx\/|anim\/|.*\/view\/)/u.test(url.href)) throw new Error(`Renderer dependency in Node simulation: ${url.href}`);
          return { url: url.href, shortCircuit: true };
        }
      }
    }
    const result = next(specifier, context);
    if (/\/src\/engine\/(?:app\/runtime\.ts|render\/|ui\/|fx\/|anim\/|.*\/view\/)/u.test(result.url)) throw new Error(`Renderer dependency in Node simulation: ${result.url}`);
    return result;
  },
});
