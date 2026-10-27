import { expect, test } from 'vitest';
import { controlChunkSelector, controlChunkFileName, controlChunkGroups } from '../scripts/app-build/controlChunks';
import { build } from 'vite';
import { writtenBundle } from '../scripts/app-build/writtenBundle';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the owned miniature emitted-entry fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Create and remove only this test's miniature build files.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { readModuleFiles } from '../src/engine/boot/download';

test('control batches retain title, session, lazy and shard boundaries through cycles', () => {
  const root = '/fixture';
  const edges: Readonly<Record<string, readonly string[]>> = {
    '/fixture/src/entry.ts': ['/fixture/src/shared.ts'],
    '/fixture/src/game/session/session.ts': ['/fixture/src/sessionOnly.ts', '/fixture/src/shared.ts'],
    '/fixture/src/core.ts': ['/fixture/src/game/session/session.ts', '/fixture/src/services.ts', '/fixture/src/shards/one/manifest.ts'],
    '/fixture/src/services.ts': ['/fixture/src/core.ts'],
  };
  const graph = { getModuleInfo: (id: string) => ({ importedIds: edges[id] ?? [] }) };
  const select = controlChunkSelector(root, ['/fixture/src/entry.ts', '/fixture/src/core.ts']);
  expect(select('/fixture/src/shared.ts', graph)).toBeNull();
  expect(select('/fixture/src/entry.ts', graph)).toBeNull();
  expect(select('/fixture/src/sessionOnly.ts', graph)).toBe('control-session');
  expect(select('/fixture/src/services.ts', graph)).toBe('control-startup');
  expect(select('/fixture/src/lazyExplorer.ts', graph)).toBeNull();
  expect(select('/fixture/src/calibration.ts', graph)).toBeNull();
  expect(select('/fixture/src/shards/one/manifest.ts', graph)).toBeNull();
  expect(select('/fixture/src/styles.css', graph)).toBeNull();
  const title = controlChunkSelector(root, [], 'title');
  expect(title('/fixture/src/shared.ts', graph)).toBe('title-boundary');
  expect(title('/fixture/src/services.ts', graph)).toBeNull();
});

test('a subsequent build uses its own graph, including changed optional requirements', () => {
  const graph = { getModuleInfo: () => ({ importedIds: [] }) };
  const first = controlChunkSelector('/fixture', ['/fixture/src/first.ts']);
  const second = controlChunkSelector('/fixture', ['/fixture/src/second.ts']);
  expect(first('/fixture/src/first.ts', graph)).toBe('control-startup');
  expect(first('/fixture/src/second.ts', graph)).toBeNull();
  expect(second('/fixture/src/first.ts', graph)).toBeNull();
  expect(second('/fixture/src/second.ts', graph)).toBe('control-startup');
});

test('entry-aware chunk labels preserve the strict named module bank contract', () => {
  const pattern = controlChunkFileName({ name: 'title-boundary~main~session' });
  expect(pattern).toBe('assets/title-boundary-main-session-[hash].js');
  const file = `/${pattern.replace('[hash]', '012345ab')}`;
  expect(readModuleFiles([[file, 42]])).toEqual([[file, 42]]);
  expect(() => readModuleFiles([['/assets/title~session.js', 42]])).toThrow('Invalid boot module file');
});

test('calibration initial code stays outside the actual public HTML static closure', async () => {
  mkdirSync('tmp/control-chunks', { recursive: true });
  const root = mkdtempSync(resolve('tmp/control-chunks/entries-'));
  try {
    for (const folder of ['src/engine/ui', 'src/engine/app', 'src/game/grid', 'src/game/travel', 'calibration']) mkdirSync(resolve(root, folder), { recursive: true });
    writeFileSync(resolve(root, 'index.html'), '<script type="module" src="/src/entry.ts"></script>');
    writeFileSync(resolve(root, 'calibration/index.html'), '<script type="module" src="/calibration/entry.ts"></script>');
    writeFileSync(resolve(root, 'calibration/entry.ts'), 'import {runtime} from "../src/engine/app/runtime"; globalThis.calibration = runtime;');
    writeFileSync(resolve(root, 'src/engine/app/runtime.ts'), 'globalThis.runtimeStarted = performance.now(); export const runtime = globalThis.runtimeStarted;');
    writeFileSync(resolve(root, 'src/core.ts'), 'import {runtime} from "./engine/app/runtime"; export const control = runtime;');
    const title = ['engine/ui/StartTitle', 'game/mainMenu', 'game/grid/pageEntry', 'game/travel/travel'];
    for (const file of title) writeFileSync(resolve(root, `src/${file}.ts`), 'export const label = "title";');
    writeFileSync(resolve(root, 'src/entry.ts'), `async function startSelected(){return import('./core');}
      globalThis.launch = startSelected; globalThis.title = () => Promise.all([${title.map(file => `import('./${file}')`).join(',')}]);`);
    const outDir = resolve(root, 'dist');
    await build({ root, configFile: false, logLevel: 'silent', build: { outDir, manifest: true, sourcemap: 'hidden',
      rolldownOptions: { input: { main: resolve(root, 'index.html'), calibration: resolve(root, 'calibration/index.html') },
        preserveEntrySignatures: false, output: { strictExecutionOrder: true, chunkFileNames: controlChunkFileName,
          codeSplitting: { groups: controlChunkGroups(root) } } } } });
    const bundle = writtenBundle(outDir, root);
    const modules = (entry: string): Set<string> => {
      const pending = Object.entries(bundle).filter(([, file]) => file.facadeModuleId === resolve(root, entry)).map(([name]) => name);
      expect(pending).toHaveLength(1);
      const found = new Set<string>(), names = new Set<string>();
      while (pending.length > 0) {
        const name = pending.pop();
        if (name === undefined || found.has(name)) continue;
        found.add(name); const file = bundle[name];
        if (file === undefined) throw new Error('Missing actual emitted dependency');
        pending.push(...file.imports ?? []);
        for (const id of Object.keys(file.modules ?? {})) names.add(id);
      }
      return names;
    };
    const runtime = resolve(root, 'src/engine/app/runtime.ts');
    expect(modules('index.html').has(runtime)).toBe(false);
    expect(modules('calibration/index.html').has(runtime)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
