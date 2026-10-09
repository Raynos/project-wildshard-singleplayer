import { afterAll, describe, expect, it } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { registerSpecies, type ThinkCtx } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { declaredSkyRows } from '../../src/shards/far-reach/runtime/brains';
import { declaredDuneRows } from '../../src/shards/sunscar-dunes/runtime/brains';
import { SKY_GOAT, SKY_GOAT_LOOK } from '../../src/shards/far-reach/species/skyGoat';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from '../../src/shards/far-reach/species/driftRay';
import { GALE_WISP, GALE_WISP_LOOK } from '../../src/shards/far-reach/species/galeWisp';
import { DUNE_STRIDER } from '../../src/shards/sunscar-dunes/runtime/species/strider';
import { DUNE_STRIDER_LOOK } from '../../src/shards/sunscar-dunes/species/strider';
import { DUNE_RAY } from '../../src/shards/sunscar-dunes/runtime/species/duneRay';
import { DUNE_RAY_LOOK } from '../../src/shards/sunscar-dunes/species/duneRay';
import { setHome, bindPlayerPush, homeOf } from '../../src/shards/far-reach/species/rig';
import { creature } from '../fake/creature';
import { SkyGoatBrain } from '../fixtures/grazer-oracle/goat';
import { StriderBrain } from '../fixtures/grazer-oracle/strider';
import { DriftRayBrain } from '../fixtures/flight-oracle/orbit';
import { GaleWispBrain } from '../fixtures/flight-oracle/burst';
import { DuneRayBrain } from '../fixtures/flight-oracle/patrol';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { DECK, RAY_HOMES } from '../../src/shards/far-reach/layout';
import { STORM_ROC } from '../../src/shards/far-reach/species/stormRoc';
import { SAND_SKITTERER } from '../../src/shards/sunscar-dunes/species/skitterer';
import { DUNE_MATRIARCH } from '../../src/shards/sunscar-dunes/species/matriarch';

for (const [row, look] of [[SKY_GOAT, SKY_GOAT_LOOK], [DRIFT_RAY, DRIFT_RAY_LOOK], [GALE_WISP, GALE_WISP_LOOK], [DUNE_STRIDER, DUNE_STRIDER_LOOK], [DUNE_RAY, DUNE_RAY_LOOK]] as const) registerSpecies(speciesWithLook(row, look));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(() => { unbind(); bindPlayerPush(null); });
const rows = [SKY_GOAT, DRIFT_RAY, GALE_WISP, DUNE_STRIDER, DUNE_RAY];
// Shipping class bodies are retained only in the source-hashed oracle fixtures.
function shippingCallbacks(kind: string): { think: (actor: Animal, context: ThinkCtx) => void; act: (actor: Animal, context: ThinkCtx) => void } {
  let policy: SkyGoatBrain | StriderBrain | DriftRayBrain | GaleWispBrain | DuneRayBrain | undefined;
  const brain = (actor: Animal): NonNullable<typeof policy> => {
    if (policy === undefined) {
      switch (kind) {
        case 'skyGoat': policy = new SkyGoatBrain(actor); break;
        case 'duneStrider': policy = new StriderBrain(actor); break;
        case 'driftRay': policy = new DriftRayBrain(actor, homeOf(actor, RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: DECK + 14 })); break;
        case 'galeWisp': policy = new GaleWispBrain(actor); break;
        case 'duneRay': policy = new DuneRayBrain(actor); break;
        default: throw new Error('Missing shipping oracle');
      }
    }
    return policy;
  };
  return { think: (actor, context) => { brain(actor).think(context); }, act: (actor, context) => { brain(actor).act(context); } };
}
function replay(kind: string, declared: boolean): object {
  const original = rows.find(row => row.kind === kind);
  if (original === undefined) throw new Error('Missing shipping row');
  const selection = kind === 'duneRay' || kind === 'duneStrider' ? declaredDuneRows() : declaredSkyRows();
  const row = declared ? selection.rows.find(value => value.kind === kind) : { ...original, ...shippingCallbacks(kind) };
  if (row?.think === undefined || row.act === undefined) throw new Error('Missing selected policy');
  const variant = kind === 'skyGoat' ? 'cloud' : kind === 'galeWisp' ? 'gale' : 'dusk';
  const f = creature(kind, variant, {}, undefined, row.think, row.act);
  const y = kind === 'driftRay' || kind === 'duneRay' ? 14 : kind === 'galeWisp' ? 3 : 0;
  f.animal.position.set(7, y, 0); setHome(f.animal, { x: 0, z: 0, r: 12, y });
  const pushes: object[] = [], frames: object[] = [];
  bindPlayerPush(velocity => { pushes.push({ frame: f.frame, velocity: velocity.toArray() }); });
  for (let tick = 0; tick < 10000; tick++) {
    f.ctx.player.set(Math.sin(tick * 0.004) * 3, 0, tick > 7000 && tick < 8000 ? 90 : 2);
    f.ctx.calm = tick > 3000 && tick < 4000; f.ctx.reach = () => tick < 5000 || tick > 6000;
    f.ctx.claim = () => tick < 1000 || tick > 2000; f.ctx.mayAttack = f.ctx.claim;
    f.animal.mem['held'] = kind === 'duneRay' && tick > 4000 && tick < 5000 ? 1 : 0;
    f.advance(1); frames.push(f.animal.snapshot());
  }
  expect(selection.witness(f.animal) !== null).toBe(declared);
  expect(f.starts.length).toBeGreaterThan(0); expect(f.hits.length).toBeGreaterThan(0);
  return { frames, pushes, hits: f.hits, starts: f.starts, rng: f.ctx.rng.snapshot() };
}
describe('live declared grazer/flyer species callbacks', () => {
  it.each(rows.map(row => row.kind))('matches the captured shipping callbacks for 10,000 ticks: %s', kind => {
    expect(replay(kind, true)).toEqual(replay(kind, false));
  });
  it('has one declared ordinary policy table with unchanged unique/native rows and no shipping fallback callbacks', () => {
    for (const row of rows) { expect(row.think).toBeUndefined(); expect(row.act).toBeUndefined(); }
    const sky = declaredSkyRows(), dune = declaredDuneRows();
    expect(sky.rows.map(row => row.id)).toEqual([DRIFT_RAY, SKY_GOAT, GALE_WISP].map(row => row.id).concat(STORM_ROC.id));
    expect(dune.rows.map(row => row.kind)).toEqual(['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch']);
    expect(sky.rows[3]).toBe(STORM_ROC); expect(dune.rows[1]).toBe(SAND_SKITTERER); expect(dune.rows[3]).toBe(DUNE_MATRIARCH);
  });
});
