import { build } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

/** Build only an isolated native component, reading engine modules directly
 * from landed main revisions. This never exports or modifies a repository. */
export async function buildComponents(control, candidate, out, candidateDrawHooks, candidateModule = 'src/engine/render/drawHooks.ts') {
  if (!['src/engine/render/drawHooks.ts', 'src/engine/render/uploadOwnership.ts'].includes(candidateModule)) throw new Error('Unknown isolated component module');
  const root = resolve('.');
  if (!resolve(out).startsWith(`${resolve(root, 'tmp')}/`)) throw new Error('Components require repository tmp output');
  const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const revisions = {};
  // An explicit one-file fixture lets a cut earn component parity before it
  // lands. Every other engine module still comes from the pinned revision.
  const overlay = candidateDrawHooks === undefined ? undefined : readFileSync(candidateDrawHooks, 'utf8');
  for (const [side, input] of Object.entries({ control, candidate })) {
    const revision = git(['rev-parse', '--verify', `${input}^{commit}`]).trim();
    execFileSync('git', ['merge-base', '--is-ancestor', revision, 'main']);
    revisions[side] = revision;
    const paths = new Set(git(['ls-tree', '-r', '--name-only', revision, '--', 'src/engine']).trim().split('\n'));
    const sources = new Map();
    await build({ configFile: false, plugins: [{ name: 'landed-component-engine', enforce: 'pre',
      resolveId(source, importer) {
        if (!source.startsWith('.') || !importer || !relative(root, importer).startsWith('src/engine/')) return null;
        for (const extension of ['', '.ts', '.mjs']) {
          const target = resolve(importer, '..', source + extension);
          if (paths.has(relative(root, target))) return target;
        }
        return null;
      },
      load(id) {
        const path = relative(root, id.split('?')[0]);
        if (!path.startsWith('src/engine/') || !/\.(ts|mjs)$/u.test(path)) return null;
        const source = side === 'candidate' && path === candidateModule && overlay !== undefined
          ? overlay : git(['show', `${revision}:${path}`]);
        sources.set(path, createHash('sha256').update(source).digest('hex'));
        return source;
      },
    }], define: { 'import.meta.env.DEV': 'false', __BUILD_ID__: '"draw-component"', __TITLE_ASSET_URLS__: '{}' },
    build: { outDir: resolve(out, side), emptyOutDir: true, copyPublicDir: false, minify: false,
      lib: { entry: 'scripts/perf/draw-hook-component-scene.mjs', formats: ['es'], fileName: 'entry' },
      rolldownOptions: { output: { codeSplitting: false } } } });
    writeFileSync(resolve(out, `${side}-sources.json`), JSON.stringify({ revision, sources: Object.fromEntries(sources),
      overlay: side === 'candidate' && overlay !== undefined ? {path:candidateModule,sha256:createHash('sha256').update(overlay).digest('hex')} : null }, null, 2));
  }
  return revisions;
}
