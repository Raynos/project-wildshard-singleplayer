// oxlint-disable-next-line import/no-nodejs-modules -- Compare admitted existing mover bytes with compiled build-only shared sources.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { bridgeScriptSources } from '../src/commons/scripts';
import { compileScript } from '../scripts/compile-script.mjs';
import { contentHash } from '../src/sdk/project';
import { ScriptHost } from '../src/engine/script/host';
import { ScriptWorld } from '../src/engine/script/effects';
import { MOVER_FIELD_RANGES, moverScriptEntities } from '../src/game/shardfile/movers';
import { moverQueries } from '../src/game/shardfile/moverRuntime';
import { MOVERS as DRIFT } from '../src/shards/driftwood-isle/data/movers';
import { MOVERS as SKY } from '../src/shards/far-reach/data/movers';

const wrapper = `export {abi_version,init,in_ptr,in_cap,out_ptr,out_cap,out_count} from './commons/abi';\nexport {on_tick} from './commons/bridge';\n`;

it('compiles the pinned shared setup and bridge deterministically and retains both shards exact 10000-tick effects', async () => {
  const shared = bridgeScriptSources(); expect(shared.version).toBe('0.0.0');
  const bytes = await compileScript(wrapper, { maximumPages: 1, sources: shared.sources });
  expect(await compileScript(wrapper, { maximumPages: 1, sources: shared.sources })).toEqual(bytes);
  for (const [slug, row] of [['driftwood-isle', DRIFT.find(r => r.kind === 'chain')], ['far-reach', SKY.find(r => r.id === 'far.winch.bridge')]] as const) {
    if (row === undefined) throw new Error('Missing shared bridge');
    const file = slug === 'driftwood-isle' ? 'bridge.as' : 'bridges.as';
    const source = readFileSync(new URL(`../src/shards/${slug}/behaviour/${file}`, import.meta.url), 'utf8');
    expect(await compileScript(source, { maximumPages: 1, sources: shared.sources })).toEqual(bytes);
    expect(contentHash(bytes)).toBe(row.module);
    // Keep the original admitted bytes as the behavioral oracle after author wrappers move to the commons.
    const original = new Uint8Array(readFileSync(new URL(`../src/shards/${slug}/assets/9453386c27dba27025de07a77332893489dc0042345dac6cd8e6bf7cfce1703d`, import.meta.url)));
    const create = (module: Uint8Array) => {
      const host = new ScriptHost({ world: new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities([row])), query: moverQueries([row], () => []) });
      host.install('bridge', module); return host;
    };
    const before = create(original), after = create(bytes);
    for (let tick = 1; tick <= 10000; tick++) {
      const action = tick === 2 ? 1 : tick === 20 ? 2 : tick === 200 ? 3 : 0;
      const fields = before.world.entity(row.entity)?.fields; if (fields === undefined) throw new Error('Missing bridge state');
      const input = [tick, 1 / 60, action, row.entity, tick > 10 ? 3 : 0, row.input.length, ...[1, 2, 3, 4, 5, 6].map(id => fields[id] ?? 0)];
      before.beginTick(tick); after.beginTick(tick);
      const a = before.call('bridge', row.entity, input), b = after.call('bridge', row.entity, input);
      expect(a.ok).toBe(true); expect(b.ok).toBe(true); expect(b.effects).toEqual(a.effects);
      expect(after.world.entity(row.entity)).toEqual(before.world.entity(row.entity));
    }
  }
  expect(contentHash(bytes)).toMatch(/^[a-f0-9]{64}$/u);
}, 30_000);

it('keeps virtual module reads inside the explicit source map', async () => {
  await expect(compileScript(wrapper)).rejects.toThrow('AssemblyScript compile failed');
  for (const name of ['../escape.ts', '/absolute.ts', 'main.ts']) await expect(compileScript(wrapper, { sources: { [name]: '' } })).rejects.toThrow('Invalid virtual');
});
