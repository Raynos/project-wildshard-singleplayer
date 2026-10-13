// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the exact HTML helper emitted by the floor harness.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A fresh origin verifies fixtures before the game's first module.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';

const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
const debug = readFileSync('scripts/debug-settings.mjs', 'utf8');
const writer = debug.slice(debug.indexOf('export function writeSaveFixture('), debug.indexOf('/** @param {{addInitScript: Function}} target')).replace('export function', 'function');
const serializer = debug.slice(debug.indexOf('export function saveFixtureCode('), debug.indexOf('/** Browser-side raw JSON codec')).replace('export function', 'function');
const fixtures = source.slice(source.indexOf('const fixture ='), source.indexOf('const query ='));
const helper = source.split('\n').find(line => line.includes('writeFileSync(helper, html.replace'));
if (helper === undefined) throw new Error('Safari HTML helper writer is missing');

it.each(['on', 'off'])('seeds a fresh Safari origin before modules boot with Developer %s', developer => {
  let html = '';
  runInNewContext(`${writer}\n${serializer}\n${fixtures}\n${helper}`, {
    settings: { buildPacing: 'on', fps: 'auto' }, developer, deviceSaves: {}, publicGrid: false,
    helper: 'helper.html', html: '<html><head></head><body></body></html>',
    HARNESS_PINS: JSON.stringify({ seed: 357, capture: null }),
    ERROR_SCRIPT: '', CONSOLE_SCRIPT: '', GL_TIME_SCRIPT: '', TASK_CLOCK: '', travelGl: '',
    writeFileSync: (_path: string, value: string) => { html = value; },
  });
  const script = /<script>(.*?)<\/script>/su.exec(html)?.[1];
  if (script === undefined) throw new Error('Pre-boot helper script is missing');
  const keys = new Map<string, string>(), window = {};
  const storage = { getItem: (key: string) => keys.get(key) ?? null, setItem: (key: string, value: string) => { keys.set(key, value); } };
  runInNewContext(script, { localStorage: storage, sessionStorage: storage, window });
  const read = (scope: string): unknown => JSON.parse(keys.get(`wildshard.save.v2.${scope}`) ?? '{}');
  expect(read('device')).toMatchObject({ keys: { devMode: { data: developer === 'on' } } });
  expect(read('global')).toMatchObject({ keys: { settings: { data: { tier: 'phone', buildPacing: 'on', fps: 'auto' } }, gfx: { data: { dpr: '2' } } } });
  expect(window).toMatchObject({ __wildshardHarness: { seed: 357, capture: null } });
});

it('keeps every platform standing camera outside cell-owned terrain on the permanent road', () => {
  const declaration = source.split('\n').find(line => line.startsWith('const GRID_POSES ='));
  if (declaration === undefined) throw new Error('Grid camera declaration missing');
  const poses: unknown = runInNewContext(`${declaration}\nGRID_POSES`);
  if (!Array.isArray(poses)) throw new Error('Grid camera inventory missing');
  expect(poses.length).toBeGreaterThan(0);
  const assembly = new GridAssembly({ developer: true, devserver: true });
  for (const pose of poses) {
    if (typeof pose !== 'object' || pose === null) throw new Error('Invalid camera');
    const x: unknown = Reflect.get(pose, 'x'), z: unknown = Reflect.get(pose, 'z');
    if (typeof x !== 'number' || typeof z !== 'number') throw new Error('Invalid camera coordinates');
    expect(assembly.at(x, z)).toBeUndefined();
  }
});
