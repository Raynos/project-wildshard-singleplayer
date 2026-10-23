import { expect, test } from 'vitest';
import { build } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the tiny real compiler fixture.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve that compiler fixture without changing process cwd.
import { resolve } from 'node:path';
import { bootModuleFiles, bootModulesPlugin, startupImports } from '../vite/bootModules';

test('startup roots follow the executed entry function, excluding title, recovery and error entry branches', () => {
  expect(startupImports(`
    function title() { return import('./title'); }
    async function startSelected() { await import('./first'); await import('@engine/second'); await import('./first'); }
    function recovery() { return import('./recovery'); }
  `)).toEqual(['./first', '@engine/second']);
  expect(() => startupImports('function title() {}')).toThrow('Missing selected startup');
  expect(() => startupImports('function startSelected() { return import(variable); }')).toThrow('literal source');
  expect(() => startupImports('function startSelected() { if (optional) return import("./optional"); }')).toThrow('Conditional startup imports');
  expect(() => startupImports('function startSelected() { return () => import("./later"); }')).toThrow('Deferred startup imports');
  expect(startupImports('function startSelected() { return retried(() => import("./required")); }')).toEqual(['./required']);
  const actual = startupImports(readFileSync('src/entry.ts', 'utf8'));
  expect(actual).toContain('./game/session/session');
  expect(actual).not.toContain('./engine/ui/StartTitle');
  expect(actual.length).toBe(new Set(actual).size);
});

test('static closures deduplicate shared/cyclic chunks, count UTF-8 and CSS, and exclude optional imports and asset URLs', () => {
  const bundle = {
    'assets/entry.js': { type: 'chunk', code: 'é', modules: { '/entry.ts': {} }, imports: ['assets/shared.js'], dynamicImports: ['assets/optional.js'], assets: ['assets/picture.webp'] },
    'assets/other.js': { type: 'chunk', code: 'ab', modules: { '/other.ts': {} }, imports: ['assets/shared.js'] },
    'assets/shared.js': { type: 'chunk', code: 'x', imports: ['assets/entry.js'] },
    'assets/optional.js': { type: 'chunk', code: 'optional' },
    'assets/main.css': { type: 'asset', source: 'abc' },
    'assets/picture.webp': { type: 'asset', source: new Uint8Array(1000) },
  };
  expect(bootModuleFiles(bundle, ['/entry.ts', '/other.ts'])).toEqual([
    ['/assets/entry.js', 2], ['/assets/main.css', 3], ['/assets/other.js', 2], ['/assets/shared.js', 1],
  ]);
  expect(() => bootModuleFiles(bundle, ['/missing.ts'])).toThrow('Missing or ambiguous');
  expect(() => bootModuleFiles({ ...bundle, duplicate: { ...bundle['assets/entry.js'] } }, ['/entry.ts'])).toThrow('ambiguous');
  expect(() => bootModuleFiles({ 'assets/entry.js': { ...bundle['assets/entry.js'], imports: ['missing'] } }, ['/entry.ts'])).toThrow('Missing boot module dependency');
});

test('the actual Vite plugin emits exact module body sizes into the existing document without fetching optional code', async () => {
  mkdirSync('tmp/vite-boot-modules', { recursive: true });
  const root = mkdtempSync(resolve('tmp/vite-boot-modules/case-'));
  try {
    mkdirSync(resolve(root, 'src/game/shardfile'), { recursive: true });
    writeFileSync(resolve(root, 'index.html'), '<html><head></head><body><script type="module" src="/src/entry.ts"></script></body></html>');
    writeFileSync(resolve(root, 'src/entry.ts'), `
      window.optionalClient = () => import('./game/shardfile/client');
      window.title = () => import('./title');
      async function startSelected() { return (await import('./first')).value; }
      void startSelected().then(value => { window.value = value; });
    `);
    writeFileSync(resolve(root, 'src/first.ts'), 'import "./main.css"; export const value = "π";');
    writeFileSync(resolve(root, 'src/main.css'), 'body { color: red; }');
    writeFileSync(resolve(root, 'src/title.ts'), 'export const title = "optional title";');
    writeFileSync(resolve(root, 'src/game/shardfile/client.ts'), 'export const client = "compiled client";');
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [bootModulesPlugin()],
      build: { write: false, minify: false, cssCodeSplit: false } });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one generated bundle');
    const html = result.output.find(file => file.fileName === 'index.html');
    if (html?.type !== 'asset' || typeof html.source !== 'string') throw new Error('Missing emitted HTML');
    const match = /<script type="application\/json" id="boot-module-files">([^<]+)<\/script>/u.exec(html.source);
    if (match?.[1] === undefined) throw new Error('Missing emitted module facts');
    const rows: unknown = JSON.parse(match[1]);
    if (typeof rows !== 'object' || rows === null || !('common' in rows) || !('client' in rows)) throw new Error('Missing banks');
    const expected = (stems: readonly string[]): [string, number][] => result.output.filter(file => stems.some(stem => file.fileName.includes(stem)) || file.fileName.endsWith('.css')).map((file): [string, number] => {
      const bytes = file.type === 'chunk' ? file.code : file.source;
      return [`/${file.fileName}`, typeof bytes === 'string' ? new TextEncoder().encode(bytes).byteLength : bytes.byteLength];
    }).sort(([left], [right]) => left.localeCompare(right));
    expect(rows.common).toEqual(expected(['/first-', '/index-']));
    expect(rows.client).toEqual(expected(['/client-']));
    expect(JSON.stringify(rows)).not.toContain('/title-');
    expect(readFileSync(resolve(root, 'index.html'), 'utf8')).not.toContain('boot-module-files');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
