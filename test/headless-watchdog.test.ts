// oxlint-disable-next-line import/no-nodejs-modules -- Construct and remove only this test's installed-style bundle directory.
import { mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The watchdog fixture must run in plain Node, outside Vitest's module transform.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve native worker entries and isolated fixture output paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Convert the installed-style runner path to a native ESM URL.
import { pathToFileURL } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- Use a disposable, uniquely owned bundle directory.
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { build } from 'vite';
import { rapierAlias } from '../vite/rapier';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';

const directory = mkdtempSync(resolve(tmpdir(), 'sf58-watchdog-'));
let bytes: number[] = [];
let fuelBytes: number[] = [];
beforeAll(async () => {
  bytes = Array.from(await compileScript(scriptSource('query(410,32768,33792);', '@external("env", "query") declare function query(kind:i32,request:i32,response:i32):i32;')));
  fuelBytes = Array.from(await compileScript(scriptSource('')));
  await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent', build: { outDir: directory, emptyOutDir: false, minify: false,
    lib: { entry: { runner: resolve('test/fixtures/headless/runner.ts'), slowWorker: resolve('test/fixtures/headless/slowWorker.ts'), headlessWorker: resolve('src/sdk/headlessWorker.ts') }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
    rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] },
  } });
  mkdirSync(resolve(directory, 'client/assets/physics'), { recursive: true }); cpSync('public/assets/physics/rapier.wasm', resolve(directory, 'client/assets/physics/rapier.wasm'));
}, 20_000);
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
function proof(mode: string): Record<string, unknown> {
  // Native module/world initialization competes with the full parallel gate; this child-process limit is separate from every runtime tick deadline.
  const output = execFileSync('node', ['--input-type=module', '-e', 'const fixture=await import(process.argv[1]); console.log(JSON.stringify(await fixture.run(process.argv[2],JSON.parse(process.argv[3]))));', pathToFileURL(resolve(directory, 'runner.js')).href, mode, JSON.stringify(mode === 'fuel' ? fuelBytes : bytes)], { encoding: 'utf8', timeout: 120_000 });
  const result: unknown = JSON.parse(output); if (typeof result !== 'object' || result === null || Array.isArray(result)) throw new Error('Missing Node worker proof'); return result as Record<string, unknown>;
}
it('preempts a finite-fuel WASM script blocked in a host query, publishes no unfinished effects, and resumes the committed snapshot', () => {
  const result = proof('slow'); expect(result).toMatchObject({ retained: 1, effects: 1, quarantined: true }); expect(result['elapsed']).toBeLessThan(5000);
});
it('counts aggregate commands across sources before any tick and protects detached checkpoints', () => { expect(proof('overflow')).toEqual({ accepted: 2, refused: 3, tick: 1 }); });
it('keeps the first-touch allowance bounded and preemptible', () => { expect(proof('cold')).toEqual({ retained: 0, effects: 0, quarantined: true }); });
// SDK observation retains fuel for 60 warm-up + three 60-tick windows; CPU excludes warm-up.
it('validates deterministically with a 1us declared runtime budget, advisory timing and exact native suffix replay', () => { expect(proof('normal')).toMatchObject({ ticks: 240, exact: true, timing: { samples: 180 } }); });
it('reports current-tick aggregate fuel and zero on sleepers without changing exact continuation', () => {
  const result = proof('fuel');
  expect(result).toMatchObject({ sleeping: 0, restoredSleeping: 0, sleepingMicros: 0, exact: true, fuel: { samples: 240, limit: 8_000_000 } });
  expect(result['due']).toBeGreaterThan(0);
  expect(result['dueMicros']).toBeGreaterThan(0);
  expect(result['scripts']).toMatchObject({ samples: 180 });
  const fuel = result['fuel'];
  if (typeof fuel !== 'object' || fuel === null) throw new Error('Missing fuel report');
  expect(Reflect.get(fuel, 'max')).toBe(result['due']);
  expect(Reflect.get(fuel, 'p95')).toBe(result['due']);
});
it('runs the real template under its declared wall deadline, retaining the exact completed tick if contended work is quarantined', () => {
  const result = proof('template');
  if (result['deadline'] === true) {
    expect(result['retainedExact']).toBe(true);
    expect(result['tick']).toBeGreaterThanOrEqual(0); expect(result['tick']).toBeLessThan(60); expect(result['snapshot']).toBeGreaterThan(0);
    const budget = result['budget']; if (typeof budget !== 'number') throw new Error('Missing declared deadline'); expect(result['elapsedMicros']).toBeGreaterThan(budget);
  } else expect(result).toMatchObject({ ticks: 60 });
}, 120_000);
