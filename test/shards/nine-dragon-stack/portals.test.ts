import { describe, expect, it } from 'vitest';
import { ENTRY_ASPHALT } from '../../../src/engine/core/config';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import type { ColliderDesc } from '../../../src/engine/world/registry';
import { parsePortalLink, portalLinkRules } from '../../../src/game/shardfile/portalLink';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { fragmentColliders } from '../../../src/shards/nine-dragon-stack/world/colliders';
import { entryDeckColliders, portalFloorRows } from '../../../src/shards/nine-dragon-stack/world/entries';
import { PropsSchema } from '../../../src/game/shardfile/props';
import * as v from 'valibot';
import { withDecks } from '../../../src/shards/nine-dragon-stack/world/install';
import { DECK_PORTALS, DECK_PORTAL_A, PORTAL_FITS_DECK, SQUARE_ARRIVAL, SQUARE_PORTAL, deckArrival, exitDeck, inPortal, portalLinks, type Portal } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { PORTAL_FADE, portalRide } from '../../../src/shards/nine-dragon-stack/world/portalRide';
import route from '../../../scripts/physics-route.json';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// G224 (Jake, 2026-10-07): each of Nine Dragon's four road-height decks carries a portal to Lantern Square; the square's
// one portal out sends you back to the deck you came in by (north from a fresh spawn).

/** a real capsule walked at 5 m/s from `start` toward `to` through the colliders, until it is inside `portal` (or 12 s) */
async function walkInto(colliders: readonly ColliderDesc[], start: { x: number; y: number; z: number }, to: { x: number; z: number }, portal: Portal): Promise<{ inside: boolean; low: number; at: { x: number; y: number; z: number } }> {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  for (const c of colliders) {
    if (c.kind !== 'box') continue;
    const body = physics.world.createRigidBody(physics.R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z));
    physics.world.createCollider(physics.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz), body);
  }
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
  const feet = { ...start }; let vy = 0, low = feet.y, inside = false;
  try {
    for (let i = 0; i < 720 && !inside; i++) {
      physics.step(); vy -= 22 / 60;
      const dx = to.x - feet.x, dz = to.z - feet.z, d = Math.hypot(dx, dz) || 1;
      const moved = motor.move(feet, { x: (dx / d) * 5 / 60, y: vy / 60, z: (dz / d) * 5 / 60 }); if (moved.grounded && vy < 0) vy = 0;
      low = Math.min(low, feet.y);
      inside = inPortal(portal, feet.x, feet.y, feet.z);
    }
  } finally { motor.dispose(); physics.dispose(); }
  return { inside, low, at: feet };
}

describe('G224: Nine Dragon portals', () => {
  it('declares four portal links the format admits against its declared floors (SF8c portalLink rules)', () => {
    const links = portalLinks();
    expect(links.map((l) => l.edge)).toEqual(['north', 'east', 'south', 'west']);
    const entries = links.map((l) => ({ edge: l.edge, portal: parsePortalLink(l.portal) }));
    const props = v.parse(PropsSchema, { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [], colliders: portalFloorRows() });
    expect(portalLinkRules(entries, { props, meshCollision: null })).toEqual([]);
    // an undeclared floor is refused
    expect(portalLinkRules(entries, { props: { ...props, colliders: props.colliders.filter((row) => row.id !== 'square') }, meshCollision: null })).not.toEqual([]);
    // the four exits are one ring in the square: four exit nodes at the same spot, each bound back to its own road
    expect(new Set(links.map((l) => JSON.stringify(l.portal.exit.at))).size).toBe(1);
    expect(new Set(links.map((l) => l.portal.exit.id)).size).toBe(4);
    // the entries stay ordinary until the schema wires the portal-link kind
    expect(source.entryways.map((row) => row.kind ?? 'ground')).toEqual(['ground', 'ground', 'ground', 'ground']);
  });

  it('stands each deck ring on the socket clear of the parapets, and its trigger is reached by a walker coming in off the road', async () => {
    expect(PORTAL_FITS_DECK).toBe(true);
    expect(DECK_PORTAL_A).toBeLessThan(ENTRY_ASPHALT);
    for (const p of DECK_PORTALS) {
      // from a metre in off the road, straight in along the deck's axis
      const start = { x: p.mx + p.nx, y: 0.05, z: p.mz + p.nz };
      const r = await walkInto(entryDeckColliders(true), start, { x: p.x + p.nx * 5, z: p.z + p.nz * 5 }, p);
      expect(r.inside, p.edge).toBe(true);
      expect(r.low).toBeGreaterThan(-0.1);
    }
  });

  it('walks the square from the arrival to the ring out through its floor and fronts', async () => {
    const c = fragmentColliders(), start = { x: SQUARE_ARRIVAL.x, y: SQUARE_ARRIVAL.y + 0.05, z: SQUARE_ARRIVAL.z };
    const r = await walkInto([...c.floors, ...c.fronts], start, { x: SQUARE_PORTAL.x, z: SQUARE_PORTAL.z - 2 }, SQUARE_PORTAL);
    expect(r.inside).toBe(true); expect(r.low).toBeGreaterThan(SQUARE_ARRIVAL.y - 0.1);
  });

  it('keeps every ring off the fixed walk route (scripts/physics-route.json): the walk ruler stays a walk', () => {
    for (const leg of route['nine-dragon-stack']) {
      const pts = [leg.start, ...leg.waypoints];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a === undefined || b === undefined) continue;
        for (let k = 0; k <= 50; k++) {
          const x = a.x + ((b.x - a.x) * k) / 50, z = a.z + ((b.z - a.z) * k) / 50;
          for (const p of [...DECK_PORTALS, SQUARE_PORTAL]) expect(inPortal(p, x, p.y, z), `${leg.name} crosses ${p.id}`).toBe(false);
        }
      }
    }
  });

  it('lands every arrival on a floor, outside every trigger', () => {
    const all: Portal[] = [...DECK_PORTALS, SQUARE_PORTAL];
    for (const pose of [SQUARE_ARRIVAL, ...DECK_PORTALS.map(deckArrival)]) {
      expect(withDecks(pose.x, pose.z)).toBe(pose.y);
      for (const p of all) expect(inPortal(p, pose.x, pose.y, pose.z)).toBe(false);
    }
  });

  it('rides deck -> square -> the deck you came in by, fading out, moving once under the dark, fading back', () => {
    const position = { x: 0, y: 0, z: 0 }, spawns: { x: number; y: number; z: number; yaw: number }[] = [], veil: number[] = [];
    const ride = portalRide({ position, spawn: (x, z, yaw, y) => { position.x = x; position.z = z; position.y = y ?? 0; spawns.push({ x, y: y ?? 0, z, yaw }); } }, (k) => { veil.push(k); });
    const run = (seconds: number): void => { for (let t = 0; t < seconds; t += 1 / 60) ride.step(1 / 60); };
    // a fresh spawn: the ring out sends you north
    expect(exitDeck(null).edge).toBe('north');
    for (const p of DECK_PORTALS) {
      Object.assign(position, { x: p.x, y: 0, z: p.z });
      ride.step(1 / 60); expect(ride.busy()).toBe(true);
      run(PORTAL_FADE.out - 0.05); expect(spawns.length % 2).toBe(0); // not moved before the dark
      run(PORTAL_FADE.hold + PORTAL_FADE.in + 0.1); expect(ride.busy()).toBe(false);
      expect(spawns.at(-1)).toEqual(SQUARE_ARRIVAL); expect(ride.entered()).toBe(p.edge);
      // still standing where it put you: nothing fires again
      run(0.5); expect(spawns.length % 2).toBe(1);
      Object.assign(position, { x: SQUARE_PORTAL.x, y: SQUARE_PORTAL.y, z: SQUARE_PORTAL.z });
      run(PORTAL_FADE.out + PORTAL_FADE.hold + PORTAL_FADE.in + 0.2);
      expect(spawns.at(-1)).toEqual(deckArrival(p));
    }
    expect(spawns).toHaveLength(8);
    expect(ride.rides()).toEqual(DECK_PORTALS.flatMap((p) => [p.id, SQUARE_PORTAL.id]));
    expect(Math.max(...veil)).toBe(1); expect(veil.at(-1)).toBe(0);
  });
});
