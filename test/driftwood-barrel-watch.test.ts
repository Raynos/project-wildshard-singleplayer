import barrelSource from '../src/shards/driftwood-isle/behaviour/barrels.as?raw';
import { expect, test } from 'vitest';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { decisionBindingMap } from '../src/format/decisionBindings';
import { DecisionHost, type DecisionScript } from '../src/engine/script/decision';
import { SCRIPT_V1_READS, type ScriptV1ReadName, type ScriptV1Command } from '../src/format/scriptAbiV1';
import { BARREL_DECISION } from '../src/shards/driftwood-isle/generators/barrelDecision';
import { BARREL_HALF } from '../src/engine/world/interact/barrel';

// G566: the tide barrel's never-jam watch (PHYSICS P7-L1 BarrelWatch) as Driftwood AS over declared body ops.
const [row] = BARREL_DECISION, BODY = 5, PLAYER = 0x7fffffff;
const registries = { bodies: new Map([['barrel', BODY]]) };
const home = { x: row.params.homeX, y: row.params.homeY, z: row.params.homeZ };
async function fixture() {
  const built = await compileDecisionScripts([row], registries, new Map([[row.source, barrelSource]]), { asLineCeiling: 200 });
  const script = built.rows[0], blob = built.blobs[0];
  if (script === undefined || blob === undefined) throw new Error('Missing barrel program');
  const scene = { barrel: { x: home.x, y: home.y + BARREL_HALF, z: home.z }, alive: true, player: { x: home.x + 30, y: home.y, z: home.z }, intent: { x: 0, z: 0 }, floor: home.y };
  const committed: ScriptV1Command[] = [];
  const declaration: DecisionScript = { ...script, ids: decisionBindingMap(script, registries).ids, reads: script.reads.filter((read): read is ScriptV1ReadName => Object.hasOwn(SCRIPT_V1_READS, read)), lists: ['declaredFloor'] };
  const host = new DecisionHost({ scripts: [declaration], bindings: [{ id: 1, script: row.id, self: 0, actors: [], instance: 0 }],
    seed: [1, 2], modules: new Map([[script.module, blob.bytes]]), world: { player: PLAYER,
      read: (op, a) => {
        if (op === SCRIPT_V1_READS.bodyAlive) return Number(scene.alive);
        if (op === SCRIPT_V1_READS.bodyX) return scene.barrel.x;
        if (op === SCRIPT_V1_READS.bodyY) return scene.barrel.y;
        if (op === SCRIPT_V1_READS.bodyZ) return scene.barrel.z;
        if (op === SCRIPT_V1_READS.playerIntent) return a === 0 ? scene.intent.x : scene.intent.z;
        if (a !== PLAYER) throw new Error('The barrel reads only the player');
        return op === SCRIPT_V1_READS.x ? scene.player.x : op === SCRIPT_V1_READS.y ? scene.player.y : scene.player.z;
      },
      list: (_op, _x, _z, out) => { out[0] = scene.floor; return 1; },
      failed: (_mode, _context, reason) => { throw new Error(reason); },
      prepare: commands => { const copy = structuredClone(commands); return { commit: () => { committed.push(...copy); } }; },
    } });
  host.enqueue(1, [1, 0, 0, 0, 0, 0]);
  let tick = 0;
  const run = (seconds: number): void => { for (const end = tick + Math.round(seconds * 60); tick < end;) host.step(++tick); };
  const homes = (): number => committed.filter(([op]) => op === 18).length;
  return { scene, committed, run, homes };
}

test('it spawns its declared body once and leaves a barrel at home alone', async () => {
  const f = await fixture(); f.scene.alive = false; f.run(0.2);
  expect(f.committed.filter(([op]) => op === 17)).toEqual([[17, 0, BODY, 0, 0]]);
  f.scene.alive = true; f.run(10); expect(f.homes()).toBe(0);
});

test('past its leash it goes home upright at once, onto its lifted home', async () => {
  const f = await fixture(); f.run(0.2);
  f.scene.barrel.x = home.x + row.params.leash + 1; f.run(0.3);
  expect(f.committed.find(([op]) => op === 18)).toEqual([18, BODY, home.x, home.y + BARREL_HALF + 0.01, home.z]);
});

test('lost offshore it goes home after 4 s, not before; on a tide plate never', async () => {
  const f = await fixture(); f.run(0.2);
  f.scene.barrel.x = home.x + 8; f.scene.floor = row.params.water - 2;
  f.run(3.6); expect(f.homes()).toBe(0);
  f.run(0.8); expect(f.homes()).toBe(1);
  const g = await fixture(); g.run(0.2);
  g.scene.barrel = { x: row.params.plateAX, y: row.params.plateAY + BARREL_HALF, z: row.params.plateAZ }; g.scene.floor = row.params.water - 2;
  g.run(10); expect(g.homes()).toBe(0);
});

test('wedged (pushed into for 4 s without moving) it goes home; a barrel that rolls on stays', async () => {
  const f = await fixture(); f.run(0.2);
  f.scene.barrel.x = home.x + 6; f.scene.player = { x: home.x + 5, y: home.y, z: home.z }; f.scene.intent = { x: 3, z: 0 };
  f.run(3.6); expect(f.homes()).toBe(0);
  f.run(0.8); expect(f.homes()).toBe(1);
  const g = await fixture(); g.run(0.2);
  g.scene.player = { x: home.x + 5, y: home.y, z: home.z }; g.scene.intent = { x: 3, z: 0 };
  for (let i = 0; i < 60; i++) { g.scene.barrel.x = home.x + 6 + i * 0.05; g.scene.player.x = g.scene.barrel.x - 1; g.run(0.1); }
  expect(g.homes()).toBe(0);
});
