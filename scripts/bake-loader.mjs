// Node module hooks that let scripts/bake-*.mjs import the game's TypeScript chunk modules directly
// (Node ≥ 23 strips types itself): extensionless relative imports resolve to `.ts`, and Vite-style
// image imports (`import thumb from './thumbs/x.jpg'`) become a module whose default export is the path.
//   node --import ./scripts/bake-loader.mjs scripts/bake-chunk.mjs
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IMAGE = /\.(jpe?g|png|webp|svg|hdr)$/i;
registerHooks({
  resolve(specifier, context, next) {
    if (IMAGE.test(specifier)) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true, format: 'module' };
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['.ts', '/index.ts']) { const u = new URL(base.href + ext); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (IMAGE.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url.replace(/^.*\/src\//, '/src/'))};`, shortCircuit: true };
    return next(url, context);
  },
});
