import { expect, test } from 'vitest';
import { build, type Plugin } from 'vite';
import { assertNoTopLevelAwait, noTopLevelAwait } from '../vite/noTopLevelAwait';

test.each([
  'await ready;',
  'await using resource = acquire();',
  'export const value = await ready;',
  'if (enabled) { await ready; }',
  'for await (const value of source) { consume(value); }',
  'class Model extends (await base()) {}',
  'const object = { [await key()]: function () {} };',
  'class Model { [await key()]() {} }',
])('rejects module evaluation suspension: %s', code => {
  expect(() => assertNoTopLevelAwait('assets/lazy.js', code)).toThrow('Top-level await in emitted app chunk assets/lazy.js');
});

test.each([
  'export async function ready() { await work(); }',
  'export async function ready() { await using resource = acquire(); }',
  'const ready = async () => { await work(); }; export { ready };',
  'void (async function () { await work(); })();',
  'class Model { async ready() { await work(); } }',
  'const model = { async ready() { for await (const value of source) consume(value); } };',
  '// await work();\nconst text = "await work()"; const pattern = /await/;',
])('allows function-local await and inert text: %s', code => {
  expect(() => assertNoTopLevelAwait('assets/lazy.js', code)).not.toThrow();
});

test('unparseable emitted JavaScript refuses instead of passing unchecked', () => {
  expect(() => assertNoTopLevelAwait('assets/broken.js', 'export const = ;')).toThrow('Cannot check emitted app JavaScript assets/broken.js');
});

function compile(entry: string, lazy: string, extra: readonly Plugin[] = []) {
  const modules: Readonly<Record<string, string>> = { 'virtual:entry': entry, 'virtual:lazy': lazy };
  return build({ configFile: false, logLevel: 'silent', publicDir: false,
    plugins: [{ name: 'virtual-await-fixture', resolveId(id) { return Object.hasOwn(modules, id) ? id : null; }, load(id) { return modules[id]; } }, ...extra, noTopLevelAwait()],
    build: { target: 'esnext', minify: true, write: false,
      rolldownOptions: { input: 'virtual:entry', output: { entryFileNames: 'entry.js', chunkFileNames: 'lazy-[hash].js' } } } });
}

test.each(['entry', 'lazy'])('the real build refuses top-level await in the emitted %s chunk', async location => {
  const entry = location === 'entry' ? 'export const value = await Promise.resolve(1);' : 'globalThis.load = () => import("virtual:lazy");';
  await expect(compile(entry, 'export const value = await Promise.resolve(1);')).rejects.toThrow(/Top-level await in emitted app chunk (?:entry|lazy-[\w-]+)\.js/u);
});

test('the real build checks generated worker assets as well as transformed chunks', async () => {
  const worker: Plugin = { name: 'worker-output-fixture', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'assets/worker.js', source: 'await initialize();' });
  } };
  await expect(compile('export const value = 1;', '', [worker])).rejects.toThrow('Top-level await in emitted app chunk assets/worker.js');
});

test('ordinary emitted dynamic imports and async readiness remain buildable', async () => {
  const result = await compile('globalThis.load = () => import("virtual:lazy");',
    'export async function ready() { return await Promise.resolve(1); }');
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one emitted bundle');
  expect(result.output.some(file => file.type === 'chunk' && file.isDynamicEntry)).toBe(true);
});

test('the guard checks code added by a late output hook', async () => {
  const late: Plugin = { name: 'late-output-fixture', generateBundle: { order: 'post', handler(_options, bundle) {
    for (const file of Object.values(bundle)) if (file.type === 'chunk') file.code += '\nawait initialize();';
  } } };
  await expect(compile('globalThis.started = true;', '', [late])).rejects.toThrow('Top-level await in emitted app chunk entry.js');
});
