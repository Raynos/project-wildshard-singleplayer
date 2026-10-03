// Node module hooks that let scripts/bake-*.mjs import the game's TypeScript chunk modules directly
// (Node ≥ 23 strips types itself): extensionless relative imports resolve to `.ts`, and Vite-style
// image imports (`import thumb from './thumbs/x.jpg'`) become a module whose default export is the path.
//   node --import ./scripts/bake-loader.mjs scripts/bake-chunk.mjs
import { registerHooks } from 'node:module';
import { existsSync, statSync, globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IMAGE = /\.(jpe?g|png|webp|svg|hdr)$/i;
// a side-effect stylesheet import (`import './status.css'`) is a no-op under Node: the bakers never draw UI
const STYLE = /\.css(\?.*)?$/i;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@dimforge/rapier3d-simd') return next('@dimforge/rapier3d-simd/rapier.js', context);
    if (/^\.\/rapier_wasm3d(\.js)?$/.test(specifier)) return { url: new URL('../src/engine/physics/rapierBindings.ts', import.meta.url).href, shortCircuit: true };
    // Let Node apply package.json's imports (including extension-preserving image entries) before image handling.
    // A raw # specifier in new URL() is a fragment, not an asset path.
    if (specifier.startsWith('#')) return next(specifier, context);
    if (IMAGE.test(specifier) || STYLE.test(specifier)) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true, format: 'module' };
    // `./bytes.generated` has a dot but no real extension: resolve anything that is not a file as it stands. A folder
    // with a `.ts` of the same name beside it is the file, as in Vite and tsc (E306: `src/shards/driftwood-isle/manifest.ts` and
    // its models in `src/shards/driftwood-isle/models/`)
    const at = specifier.startsWith('.') && context.parentURL?.startsWith('file:') ? fileURLToPath(new URL(specifier, context.parentURL)) : null;
    if (at !== null && (!existsSync(at) || statSync(at).isDirectory())) {
      const base = new URL(specifier, context.parentURL);
      for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) { const u = new URL(base.href + ext); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (STYLE.test(url)) return { format: 'module', source: 'export default "";', shortCircuit: true };
    if (IMAGE.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url.replace(/^.*\/src\//, '/src/'))};`, shortCircuit: true };
    const out = next(url, context);
    // Vite's `import.meta.env` (a dev-only console hook in a builder) is undefined under Node: a production build's values
    if (!url.endsWith('.ts')) return out;
    const src = out.source, text = typeof src === 'string' ? src : src instanceof Uint8Array ? new TextDecoder().decode(src) : '';
    let source = text.replaceAll('import.meta.env', '({ DEV: false, PROD: true, MODE: "production" })');
    /** @type {string[]} */
    const imports = [];
    source = source.replaceAll(/import\.meta\.glob(?:<[^>]+>)?\((\[[^\]]*\]|'[^']*'),\s*(\{[^}]*\})\)/g, (_match, patterns, options) => {
      if (!/eager:\s*true/.test(options)) throw new Error(`bake-loader: only eager globs are supported in ${url}`);
      /** @type {unknown} */
      const parsed = JSON.parse(patterns.replaceAll("'", '"'));
      const list = typeof parsed === 'string' ? [parsed] : Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
      if (list.length === 0) throw new Error(`bake-loader: invalid glob in ${url}`);
      const cwd = fileURLToPath(new URL('.', url));
      const exclude = list.filter((p) => p.startsWith('!')).map((p) => p.slice(1).replace(/^\.\//, ''));
      const files = globSync(list.filter((p) => !p.startsWith('!')), { cwd, exclude }).sort();
      return `({ ${files.map((file) => {
        const key = file.startsWith('.') ? file : `./${file}`;
        if (/query:\s*'\?raw'/.test(options)) return `${JSON.stringify(key)}: ${JSON.stringify(readFileSync(new URL(key, url), 'utf8'))}`;
        const name = `__bakeGlob${imports.length}`;
        imports.push(`import * as ${name} from ${JSON.stringify(key)};`);
        return `${JSON.stringify(key)}: ${name}`;
      }).join(', ')} })`;
    });
    return source !== text ? { ...out, source: `${imports.join('\n')}\n${source}` } : out;
  },
});

// E405 E414: the app identity, before any engine module runs (a bake that builds an App reads saves, which need
// the game's save prefix). The same module the page entries run first.
await import('../src/identity.ts');
