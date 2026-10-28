// oxlint-disable-next-line import/no-nodejs-modules -- The trusted projection uses the actual native host's item authority.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the entire native state without numeric tolerance.
import { deepStrictEqual } from 'node:assert';
import { expect, test } from 'vitest';
import { projectItemFields } from '../src/game/shardfile/clientItems';
import { ItemRuntime } from '../src/engine/combat/items';
import { DeclaredScriptWorld, SCRIPT_STATE_OP, type ScriptStateDeclaration } from '../src/engine/script/state';
import { emptyShardfile } from '../src/sdk/author';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const current = (source: Parameters<typeof projectItemFields>[0], runtimes: Parameters<typeof projectItemFields>[1]) =>
  (lane: Parameters<typeof projectItemFields>[2], player: number): void => { projectItemFields(source, runtimes, lane, player); };

// Complete original producer at d367be79c6, with only its stable inputs bound.
const before: typeof current = (source, runtimes) => (lane, player) => {
  const effects = (source.targets.itemFields ?? []).map(row => {
    const item = runtimes.get(row.item); if (item === undefined) throw new Error('Missing authoritative item projection');
    return { op: SCRIPT_STATE_OP.player, a: row.fieldId, b: row.property === 'fuel' ? item.remainingFuel : Number(item.lightOn), c: 0, d: 0 };
  });
  if (effects.length > 0) lane.world.prepare(effects, player, 0, 0).commit();
};
const rapier = loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
class RuntimeReads extends Map<string, ItemRuntime> {
  onRead: (() => void) | undefined;
  override get(id: string): ItemRuntime | undefined { this.onRead?.(); return super.get(id); }
}
async function fixture(make: typeof current) {
  const host = createSimHost(SIM_LEVEL, { rapier: await rapier });
  const item = new ItemRuntime({ id: 'light', kind: 'tool', action: null, fuelSeconds: 4, intensity: 1 }, {
    actor: host.player.health, combat: host.combat, hook: null, targets: () => [],
    effect: () => { throw new Error('Projection must not apply a combat effect'); },
  });
  const source = emptyShardfile({ slug: 'projection', name: 'Projection', author: 'Test', revision: 1, seed: 1 });
  source.targets.itemFields = [{ item: 'light', fieldId: 1, property: 'fuel' }, { item: 'light', fieldId: 2, property: 'lit' }];
  const player = [{ id: 1, name: 'fuel', type: 'f64', privacy: 'public', default: 1, min: 0, max: 1 },
    { id: 2, name: 'lit', type: 'i32', privacy: 'public', default: 0, min: 0, max: 1 }] satisfies ScriptStateDeclaration['player'];
  source.state.player = player;
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 1 },
    [{ id: 1, name: 'owner', position: [0, 0, 0], fields: {}, frozen: false, interactive: false }], { shared: [], player }, new Map([[1, host.player.id]]));
  const runtimes = new RuntimeReads([['light', item]]), project = make(source, runtimes);
  return { host, item, source, world, runtimes, project: () => { project({ world }, 1); } };
}

test('every projected native field, content revision and transaction fence matches the original over live item ticks', async () => {
  const old = await fixture(before), now = await fixture(current);
  try {
    for (let tick = 0; tick < 160; tick++) {
      for (const f of [old, now]) {
        if (tick % 19 === 0) f.item.queue(3);
        if (tick % 37 === 0) f.item.queue(4);
        f.item.step(tick, 0.125);
        if (tick % 11 === 0) f.source.targets.itemFields?.reverse();
        const stale = f.world.prepare([], 1, 0, 0); f.project();
        expect(() => { stale.commit(); }).toThrow('Stale declared-state transaction');
        const saved = f.world.checkpoint(); f.world.restoreState(saved); deepStrictEqual(f.world.checkpoint(), saved);
      }
      deepStrictEqual(now.world.checkpoint(), old.world.checkpoint());
      expect(now.world.contentRevision).toBe(old.world.contentRevision);
    }
  } finally { old.host.dispose(); now.host.dispose(); }
});

test('missing items, invalid fields and an empty declaration retain original atomic refusal and recovery', async () => {
  const old = await fixture(before), now = await fixture(current);
  try {
    for (const f of [old, now]) {
      f.project(); const saved = f.world.checkpoint();
      f.runtimes.delete('light'); expect(f.project).toThrow('Missing authoritative item projection');
      deepStrictEqual(f.world.checkpoint(), saved); f.runtimes.set('light', f.item);
      const row = f.source.targets.itemFields?.[1]; if (row === undefined) throw new Error('Missing admitted projection row');
      f.item.restore({ ...f.item.snapshot(), fuel: 0.25 }); row.fieldId = 99;
      expect(f.project).toThrow('Undeclared or invalid state field'); deepStrictEqual(f.world.checkpoint(), saved);
      row.fieldId = 2; f.project();
      const sparse: typeof row[] = []; sparse.length = 2; sparse[1] = row;
      f.source.targets.itemFields = sparse; f.project();
      f.source.targets.itemFields = [];
      const pending = f.world.prepare([], 1, 0, 0); f.project(); expect(() => { pending.commit(); }).not.toThrow();
    }
    deepStrictEqual(now.world.checkpoint(), old.world.checkpoint());
  } finally { old.host.dispose(); now.host.dispose(); }
});

test('seven nested item reads and a thrown read cannot overwrite an outer projection or its next call', async () => {
  const run = async (make: typeof current) => {
    const f = await fixture(make), reads: number[] = []; let depth = 0;
    try {
      f.runtimes.onRead = () => {
        reads[depth] = (reads[depth] ?? 0) + 1;
        if (reads[depth] === 2 && depth < 6) {
          f.item.restore({ ...f.item.snapshot(), fuel: (depth + 1) / 8 }); depth++;
          try { f.project(); } finally { depth--; }
        }
      };
      f.project(); const nested = f.world.checkpoint();
      f.runtimes.onRead = () => { throw new Error('Original item read refusal'); };
      expect(f.project).toThrow('Original item read refusal'); deepStrictEqual(f.world.checkpoint(), nested);
      f.runtimes.onRead = undefined; f.project();
      return { reads, nested, next: f.world.checkpoint(), revision: f.world.contentRevision };
    } finally { f.host.dispose(); }
  };
  deepStrictEqual(await run(current), await run(before));
});
