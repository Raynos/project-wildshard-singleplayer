// SF58 (13), G168 / G115: a script the host switches off tells the player. The host reports the module once when it crosses
// its failure limit (never on a restored checkpoint), the notice turns that into one amber toast "SOMETHING IN THIS SHARD
// STOPPED WORKING" and, with Developer on only, the red strip "SCRIPT DISABLED · door.wasm · out of fuel ×3", both as text.
import { describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { ScriptHost, type ScriptDisabled } from '../src/engine/script/host';
import { ScriptWorld } from '../src/engine/script/effects';
import { scriptCause, scriptDisabledNotice } from '../src/game/shardfile/scriptNotice';
import { scriptSource } from './script/fixture';

function host(onDisabled: (disabled: ScriptDisabled) => void): ScriptHost {
  const world = new ScriptWorld({ fields: { 1: [0, 100] }, archetypes: [1], events: [1], maxEntities: 20 }, [1, 2].map((id) => ({ id, name: `door ${id}`, position: [0, 0, 0], fields: { 1: 0 }, frozen: false, interactive: true })));
  return new ScriptHost({ world, query: () => [], onDisabled });
}
/** Three strikes of an endless loop: the host stops each by fuel and switches the module off on the third. */
async function strikeOut(h: ScriptHost, name: string, entity: number, first: number): Promise<void> {
  h.install(name, await compileScript(scriptSource('while(true) {}', '', '0')));
  for (let k = 0; k < 3; k++) { h.beginTick(first + k); if (k > 0) h.resume(name, entity); h.call(name, entity, [first + k]); }
}

describe('G168: the host reports a disabled module once', () => {
  it('fires on the third strike only, with the module, its entity, the cause and the strike count', async () => {
    const seen: ScriptDisabled[] = [], h = host((d) => { seen.push(d); });
    await strikeOut(h, 'door.wasm', 1, 0);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ module: 'door.wasm', entity: 'door 1', failures: 3 });
    expect(seen[0]?.reason).toContain('fuel');
    h.beginTick(10); expect(h.call('door.wasm', 2, [10]).disabled).toBe(true); expect(seen).toHaveLength(1); // a disabled module stays quiet
  });
  it('a restored checkpoint that already holds the disabled module tells nobody again', async () => {
    const seen: ScriptDisabled[] = [], h = host((d) => { seen.push(d); });
    await strikeOut(h, 'door.wasm', 1, 0);
    const saved = h.checkpoint(), again: ScriptDisabled[] = [], fresh = host((d) => { again.push(d); });
    fresh.install('door.wasm', await compileScript(scriptSource('while(true) {}', '', '0')));
    fresh.restoreState(saved); expect(again).toEqual([]);
  });
});

describe('G168: the notice', () => {
  it('toasts once per shard session and names every disabled module in the Developer strip', () => {
    const toasts: string[] = [], alerts: string[] = [];
    const notice = scriptDisabledNotice({ toast: (t) => { toasts.push(t); }, devAlert: (t) => { alerts.push(t); } });
    notice({ module: 'door.wasm', entity: 'door 1', reason: 'Script fuel exhausted', failures: 3 });
    notice({ module: 'bell.wasm', entity: 'bell', reason: 'Script call-depth exhausted', failures: 3 });
    expect(toasts).toEqual(['SOMETHING IN THIS SHARD STOPPED WORKING']);
    expect(alerts).toEqual(['SCRIPT DISABLED · door.wasm · out of fuel ×3', 'SCRIPT DISABLED · bell.wasm · call depth ×3']);
  });
  it('turns host reasons into short causes', () => {
    expect(scriptCause('Script tick fuel exhausted')).toBe('out of fuel');
    expect(scriptCause('Query allowance')).toBe('too many queries');
    expect(scriptCause('Effect allowance')).toBe('too many effects');
    expect(scriptCause('Script abort')).toBe('trapped');
    expect(scriptCause('RuntimeError: unreachable executed somewhere deep in the module body')).toHaveLength(40);
  });
});
