// Node module hooks that let scripts/bake-*.mjs import the game's TypeScript chunk modules directly
// (Node ≥ 23 strips types itself): extensionless relative imports resolve to `.ts`, and Vite-style
// image imports (`import thumb from './thumbs/x.jpg'`) become a module whose default export is the path.
//   node --import ./scripts/bake-loader.mjs scripts/bake-chunk.mjs
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IMAGE = /\.(jpe?g|png|webp|svg|hdr)$/i;
registerHooks({
  resolve(specifier, context, next) {
    // Let Node apply package.json's imports (including extension-preserving image entries) before image handling.
    // A raw # specifier in new URL() is a fragment, not an asset path.
    if (specifier.startsWith('#')) return next(specifier, context);
    if (IMAGE.test(specifier)) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true, format: 'module' };
    // `./bytes.generated` has a dot but no real extension: resolve anything that is not a file as it stands. A folder
    // with a `.ts` of the same name beside it is the file, as in Vite and tsc (E306: `src/shards/driftwood-isle/manifest.ts` and
    // its models in `src/shards/driftwood-isle/models/`)
    const at = specifier.startsWith('.') && context.parentURL?.startsWith('file:') ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (at !== null && (!existsSync(at) || (statSync(at).isDirectory() && existsSync(`${at}.ts`)))) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['.ts', '/index.ts']) { const u = new URL(base.href + ext); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (IMAGE.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url.replace(/^.*\/src\//, '/src/'))};`, shortCircuit: true };
    const out = next(url, context);
    // Vite's `import.meta.env` (a dev-only console hook in a builder) is undefined under Node: a production build's values
    if (!url.endsWith('.ts')) return out;
    const src = out.source, text = typeof src === 'string' ? src : src instanceof Uint8Array ? new TextDecoder().decode(src) : '';
    if (text.includes('import.meta.env')) return { ...out, source: text.replaceAll('import.meta.env', '({ DEV: false, PROD: true, MODE: "production" })') };
    return out;
  },
});
