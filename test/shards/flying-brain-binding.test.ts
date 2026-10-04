import { afterAll, describe, expect, it } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { registerSpecies } from '../../src/engine/entities/species/registry';
import { speciesWithLook } from '../../src/engine/entities/species/look';
import { declaredSkyRows, selectSkyRows } from '../../src/shards/far-reach/runtime/brains';
import { declaredDuneRows, selectDuneRows } from '../../src/shards/sunscar-dunes/runtime/brains';
import { SKY_GOAT, SKY_GOAT_LOOK } from '../../src/shards/far-reach/species/skyGoat';
import { DRIFT_RAY, DRIFT_RAY_LOOK } from '../../src/shards/far-reach/species/driftRay';
import { GALE_WISP, GALE_WISP_LOOK } from '../../src/shards/far-reach/species/galeWisp';
import { DUNE_STRIDER, DUNE_STRIDER_LOOK } from '../../src/shards/sunscar-dunes/species/strider';
import { DUNE_RAY, DUNE_RAY_LOOK } from '../../src/shards/sunscar-dunes/species/duneRay';
import { setHome, bindPlayerPush } from '../../src/shards/far-reach/species/rig';
import { creature } from '../fake/creature';

for (const [row, look] of [[SKY_GOAT, SKY_GOAT_LOOK], [DRIFT_RAY, DRIFT_RAY_LOOK], [GALE_WISP, GALE_WISP_LOOK], [DUNE_STRIDER, DUNE_STRIDER_LOOK], [DUNE_RAY, DUNE_RAY_LOOK]] as const) registerSpecies(speciesWithLook(row, look));
const unbind = overrideTerrain({ heightAt: () => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(() => { unbind(); bindPlayerPush(null); });
const rows = [SKY_GOAT, DRIFT_RAY, GALE_WISP, DUNE_STRIDER, DUNE_RAY];
function replay(kind: string, declared: boolean): object {
  const original = rows.find(row => row.kind === kind);
  if (original === undefined) throw new Error('Missing shipping row');
  const selection = kind === 'duneRay' || kind === 'duneStrider' ? declaredDuneRows() : declaredSkyRows();
  const row = declared ? selection.rows.find(value => value.kind === kind) : original;
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
  it.each(rows.map(row => row.kind))('matches the actual shipping callbacks for 10,000 ticks: %s', kind => {
    expect(replay(kind, true)).toEqual(replay(kind, false));
  });
  it('keeps OFF shipping callbacks and memoizes the shared ON row per context', () => {
    let count = 0;
    const off = { debugRow: (row: Parameters<Parameters<typeof selectSkyRows>[0]['debugRow']>[0]) => { count++; row.change('off'); } };
    expect(selectSkyRows(off)).toBeNull(); expect(selectSkyRows(off)).toBeNull(); expect(count).toBe(1);
    const on = { debugRow: (row: Parameters<Parameters<typeof selectSkyRows>[0]['debugRow']>[0]) => { row.change('on'); } };
    const sky = selectSkyRows(on), dune = selectDuneRows(on);
    expect(sky?.rows.map(row => row.id)).toEqual([DRIFT_RAY, SKY_GOAT, GALE_WISP].map(row => row.id).concat('far.creature.stormRoc'));
    expect(dune?.rows.map(row => row.kind)).toEqual(['duneRay', 'sandSkitterer', 'duneStrider', 'duneMatriarch']);
  });
});
