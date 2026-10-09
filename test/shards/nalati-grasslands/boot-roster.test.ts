// oxlint-disable-next-line import/no-nodejs-modules -- The page's baked terrain grid is read from the in-tree asset.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { bakedSamplers, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import { TERRAIN } from '../../../src/shards/nalati-grasslands/world/terrain';
import { nalatiWetAt } from '../../../src/shards/nalati-grasslands/wet';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiBootRoster } from '../../../src/shards/nalati-grasslands/runtime/bootRoster';

/** creatures/sheepRaid.ts: the shepherd's horse, 12 m east and 16 m south of the first flock, facing it */
const SHEPHERDS_HORSE = 'creature:23';

function ground(): Parameters<typeof nalatiBootRoster>[0] {
  const bytes = readFileSync('public/assets/baked/nalati-grasslands/terrain.bin');
  const grid = parseBakedTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (grid === null) throw new Error('Missing Nalati terrain grid');
  const s = bakedSamplers(grid);
  return { normalY: (x, z) => s.normalAt(x, z)[1], heightAt: s.heightAt, waterLevel: () => TERRAIN.waterLevel(), wetAt: nalatiWetAt };
}

it('reproduces the page\'s boot roster id for id in plain Node: kinds, coats, herds, seeds and scales', () => {
  const bake = nalatiBake(), roster = nalatiBootRoster(ground(), { phase: 'day', storm: false });
  expect(roster.bodies.map(b => ({ id: b.id, kind: b.kind, variant: b.variant.id, herd: b.herd, seed: b.seed, scale: b.scale })))
    .toEqual(bake.actors.map(a => ({ id: a.id, kind: a.kind, variant: a.variant, herd: a.herd, seed: a.seed, scale: a.scale })));
  expect(roster.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.id) }))).toEqual(bake.herds);
  // creature:24 is the Golden King: spawned through his boss row, then parked out of the manager's list until the kurgan
  expect(roster.parked.map(b => [b.id, b.kind, b.variant.id])).toEqual([['creature:24', 'golden-king', 'king']]);
  expect(roster.bodies.every(b => Number.isFinite(b.position.x) && Number.isFinite(b.position.z) && Math.abs(b.position.x) <= 250 && Math.abs(b.position.z) <= 250)).toBe(true);
});

it('stands every body on the page\'s own tick-0 spot and heading (the bake reads each the frame it first exists)', () => {
  const bake = nalatiBake(), roster = nalatiBootRoster(ground(), { phase: 'day', storm: false });
  expect(roster.bodies.map(b => b.id)).toEqual(bake.spawns.map(s => s.id));
  roster.bodies.forEach((body, i) => {
    const spawn = bake.spawns[i]; if (spawn === undefined) throw new Error(`no tick-0 spawn for ${body.id}`);
    // the same arithmetic on the same grid: the spot and heading are the page's to the last bit, but the shepherd's horse's
    // heading, which his ring (creatures/sheepRaid.ts) turns in the frame ride.ts builds him, before the bake can see him
    expect([body.id, body.position.x, body.position.z]).toEqual([spawn.id, spawn.at[0], spawn.at[2]]);
    if (body.id === SHEPHERDS_HORSE) expect(Math.abs(body.yaw - spawn.yaw)).toBeLessThan(2.2 / 60);
    else expect(body.yaw).toBe(spawn.yaw);
  });
});

it('refuses a boot clock whose lair elites it does not model', () => {
  expect(() => nalatiBootRoster(ground(), { phase: 'dusk', storm: false })).toThrow(/kokbori/u);
});
