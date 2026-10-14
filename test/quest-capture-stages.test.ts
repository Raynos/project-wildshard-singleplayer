// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { HybridRuntimePlugin, type HybridRuntimeRows, type QuestCaptureRows } from '../src/game/plugin/headless';

class Capture extends HybridRuntimePlugin {
  protected get rows(): HybridRuntimeRows { throw new Error('Capture-only fixture has no world rows'); }
  protected build(): void { /* no world in this fixture */ }
  protected arm(): never { throw new Error('Capture-only fixture has no weapon'); }
  protected armed(): null { return null; }
  protected install(): void { /* no play scope in this fixture */ }
  bind(rows: QuestCaptureRows, flags: Flags, calls: ReadonlyMap<string, () => void>): void { this.bindQuestCapture(rows, flags, calls); }
}

test('capture stages use real saved flags and ordered actions, with preflight before effects', () => {
  const plugin = new Capture(), flags = new Flags('capture-behaviour', false);
  let ran = false;
  plugin.bind({ checkpoint: [{ flag: 'met' }, { call: 'interact' }] }, flags, new Map([['interact', () => { ran = flags.has('met'); }]]));
  plugin.stage('unknown'); expect(flags.has('met')).toBe(false);
  plugin.stage('checkpoint'); expect(ran).toBe(true); expect(flags.has('met')).toBe(true);
  expect(() => plugin.bind({ invalid: [{ flag: 'new' }, { call: 'absent' }] }, flags, new Map())).toThrow('Missing quest capture action');
  expect(flags.has('new')).toBe(false);
});
