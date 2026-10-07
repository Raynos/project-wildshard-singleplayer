// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { isDev, setDev } from '../../src/engine/core/devMode';
import { jsonSlot } from '../../src/engine/saves/slots';
import { buildDebugMenu } from '../../src/engine/ui/DebugMenu';
import { levelDebugRows, registerLevelDebugRow } from '../../src/engine/ui/debugOptions';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { pineOption } from '../../src/shards/pine-hollow/debug/options';

const disposers: (() => void)[] = [];
afterEach(() => { for (const off of disposers.splice(0)) off(); setDev(false); document.body.replaceChildren(); });
const spec: DebugRowSpec = { purpose: 'developer', id: 'fixture.tool', group: 'tools', label: 'Tool',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off',
  ask: 'E435', reviewBy: '2026-12-01', note: 'Developer fixture', change: () => undefined };

it('ignores a saved ON outside Developer, preserves the pick, and disposes its mode subscription', () => {
  setDev(false); const saved = jsonSlot('debug.plugin.fixture.fixture.tool', 'device'); saved.write('on');
  const changes: string[] = [], off = registerLevelDebugRow({ ...spec, change: value => { changes.push(value); } }, 'fixture'); disposers.push(off);
  const row = levelDebugRows().find(value => value.id === spec.id); if (row === undefined) throw new Error('Missing tool');
  expect(row.get()).toBe('off'); expect(changes).toEqual([]); row.set('on'); expect(changes).toEqual([]);
  expect(saved.read()).toBe('on'); setDev(true); expect(row.get()).toBe('on'); expect(changes).toEqual(['on']);
  setDev(false); expect(row.get()).toBe('off'); expect(changes).toEqual(['on', 'off']); expect(saved.read()).toBe('on');
  off(); setDev(true); expect(changes).toEqual(['on', 'off']); expect(levelDebugRows()).not.toContain(row);
});

it('renders Developer tools separately from comparison rows with the same registry and scope', () => {
  const scope = new Scope('developer-tools-fixture'); disposers.push(() => { scope.dispose(); });
  disposers.push(registerLevelDebugRow(spec, 'fixture'));
  const comparisonSpec: DebugRowSpec = { ...spec, id: 'fixture.comparison' }; delete comparisonSpec.purpose;
  disposers.push(registerLevelDebugRow(comparisonSpec, 'fixture'));
  const comparison = buildDebugMenu(document.createElement('div'), { scope });
  const tools = buildDebugMenu(document.createElement('div'), { scope, purpose: 'developer' });
  expect(comparison.row(spec.id)).toBeUndefined(); expect(tools.row(spec.id)).toBeDefined();
  expect(comparison.row('fixture.comparison')).toBeDefined(); expect(tools.row('fixture.comparison')).toBeUndefined();
  expect(tools.row('aimRing')).toBeDefined(); expect(comparison.row('aimRing')).toBeUndefined();
});

it('fences Pine direct diagnostic reads while retaining the owners memory-trim choice', () => {
  setDev(false);
  jsonSlot('debug.plugin.pine-hollow.pineLife', 'device').write('off');
  jsonSlot('debug.plugin.pine-hollow.cragView', 'device').write('normal');
  jsonSlot('debug.plugin.pine-hollow.pineMemoryTrim', 'device').write('on');
  expect(pineOption('pineLife')).toBe('on'); expect(pineOption('cragView')).toBe('shaded'); expect(pineOption('pineMemoryTrim')).toBe('on');
  setDev(true); expect(isDev()).toBe(true); expect(pineOption('pineLife')).toBe('off'); expect(pineOption('cragView')).toBe('normal');
});
