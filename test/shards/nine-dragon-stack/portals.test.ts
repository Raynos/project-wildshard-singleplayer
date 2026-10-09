import { describe, expect, it } from 'vitest';
import { ENTRY_ASPHALT } from '../../../src/engine/core/config';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { addPiece } from '../../../src/engine/physics/pieces';
import type { ColliderDesc } from '../../../src/engine/world/registry';
import { parsePortalLink, portalLinkEntries, portalLinkRules } from '../../../src/game/shardfile/portalLink';
import { createPortalTraversal, portalTransitioning } from '../../../src/game/shardfile/portalTraversal';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { fragmentColliders } from '../../../src/shards/nine-dragon-stack/world/colliders';
import { entryDeckColliders, portalFloorRows } from '../../../src/shards/nine-dragon-stack/world/floorRows';
import { PropsSchema } from '../../../src/game/shardfile/props';
import * as v from 'valibot';
import { withDecks } from '../../../src/shards/nine-dragon-stack/world/install';
import {
  DECK_PORTALS, DECK_PORTAL_A, PORTAL_FITS_DECK, SQUARE_ARRIVAL, SQUARE_PORTAL, TRIGGER_ADMITTED, deckArrival, exitDeck, inPortal, portalLinks,
  squareExitId, type Portal,
} from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { PORTAL_FADE, portalRide, type PortalRider } from '../../../src/shards/nine-dragon-stack/world/portalRide';
import route from '../../../scripts/physics-route.json';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// G224 (Jake, 2026-10-07): each of Nine Dragon's four road-height decks carries a portal to Lantern Square; the square's
// one portal out sends you back to the deck you came in by (north from a fresh spawn). SF8c: the four entries are the
// format's portalLink kind and the ride is its checked transfer.

const physicsWorld = async (): Promise<Physics> => new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
const motorFor = (physics: Physics): CharacterMotor => new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });

/** a real capsule walked at 5 m/s from `start` toward `to` through the colliders, until it is inside `portal` (or 12 s) */
async function walkInto(colliders: readonly ColliderDesc[], start: { x: number; y: number; z: number }, to: { x: number; z: number }, portal: Portal): Promise<{ inside: boolean; low: number; at: { x: number; y: number; z: number } }> {
  const physics = await physicsWorld();
  addPiece(physics, { id: 'walk', name: 'walk', category: 'buildings', file: 'test', colliders: [...colliders] });
  const motor = motorFor(physics);
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

/** a rider whose transfer follows the declared links without physics (the ride's own logic) */
function linkRider(position: { x: number; y: number; z: number }, log: { holds: boolean[]; settled: number[]; refuse: Set<string> }): PortalRider {
  const nodes = new Map<string, { at: readonly number[]; yaw: number }>(), links = new Map<string, string>();
  for (const { portal } of portalLinks()) {
    for (const n of [portal.road, portal.destination, portal.exit]) nodes.set(n.id, n);
    for (const l of portal.links) links.set(l.from, l.to);
  }
  return {
    position,
    hold: (on) => { log.holds.push(on); },
    teleport: (from) => {
      if (log.refuse.has(from)) throw new Error(`refused ${from}`);
      const to = links.get(from), n = to === undefined ? undefined : nodes.get(to);
      if (to === undefined || n === undefined) throw new Error('unbound');
      Object.assign(position, { x: n.at[0], y: n.at[1], z: n.at[2] });
      return { from, to, yaw: n.yaw };
    },
    settle: (yaw) => { log.settled.push(yaw); },
  };
}

describe('G224: Nine Dragon portals', () => {
  it('declares its four entries as portal links the format admits against its declared floors (SF8c)', () => {
    const links = portalLinks();
    expect(links.map((l) => l.edge)).toEqual(['north', 'east', 'south', 'west']);
    expect(source.entryways.map((row) => row.kind)).toEqual(['portalLink', 'portalLink', 'portalLink', 'portalLink']);
    expect(source.entryways.map((row) => row.portal)).toEqual(links.map((l) => parsePortalLink(l.portal)));
    expect(source.props?.colliders).toEqual(portalFloorRows());
    const entries = portalLinkEntries(source.entryways);
    expect(portalLinkRules(entries, source)).toEqual([]);
    // an undeclared floor is refused
    const props = v.parse(PropsSchema, { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [], colliders: portalFloorRows() });
    expect(portalLinkRules(entries, { props: { ...props, colliders: props.colliders.filter((row) => row.id !== 'square') }, meshCollision: null })).not.toEqual([]);
    // the four exits are one ring in the square: four exit nodes at the same spot, each bound back to its own road
    expect(new Set(links.map((l) => JSON.stringify(l.portal.exit.at))).size).toBe(1);
    expect(new Set(links.map((l) => l.portal.exit.id)).size).toBe(4);
  });

  it('declares each whole deck as its named floor: the 8 x 15 m socket at y = 0, the boxes the world installs', () => {
    const sorted = (list: readonly ColliderDesc[]): string[] => list.map((c) => JSON.stringify(c)).sort();
    expect(sorted(portalFloorRows().filter((row) => row.id.startsWith('deck.')).flatMap((row) => row.shapes))).toEqual(sorted(entryDeckColliders(false)));
    for (const row of portalFloorRows().filter((r) => r.id.startsWith('deck.'))) {
      const slab = row.shapes[0];
      if (slab?.kind !== 'box') throw new Error('a deck starts with its slab');
      expect(slab.y + slab.hy).toBeCloseTo(0, 9);
      // from the cell's edge (250) to the end wall, the opening and its parapets across
      expect(Math.max(Math.abs(slab.x), Math.abs(slab.z)) + Math.max(slab.hx, slab.hz)).toBeCloseTo(250, 9);
      expect(Math.min(slab.hx, slab.hz) * 2).toBeGreaterThanOrEqual(8);
    }
  });

  it('starts a ride only where the format admits the transfer, standing each deck ring on the socket clear of the parapets', async () => {
    expect(TRIGGER_ADMITTED).toBe(true);
    expect(PORTAL_FITS_DECK).toBe(true);
    expect(DECK_PORTAL_A).toBeLessThan(ENTRY_ASPHALT);
    for (const p of DECK_PORTALS) {
      // from a metre in off the road, straight in along the deck's axis
      const start = { x: p.mx + p.nx, y: 0.05, z: p.mz + p.nz };
      const r = await walkInto(entryDeckColliders(true), start, { x: p.x + p.nx * 5, z: p.z + p.nz * 5 }, p);
      expect(r.inside, p.edge).toBe(true);
      expect(r.low).toBeGreaterThan(-0.1);
      expect(Math.hypot(r.at.x - p.x, r.at.z - p.z)).toBeLessThan(1.25);
    }
    // a jump through the ring does not fire it (the feet must be on the ring's floor)
    const p = DECK_PORTALS[0]; if (p === undefined) throw new Error('north deck');
    expect(inPortal(p, p.x, 0.5, p.z)).toBe(false); expect(inPortal(p, p.x, 0, p.z)).toBe(true);
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

  it('lands every arrival on a floor: the square outside every ring, a deck inside its own ring only, facing out', () => {
    const all: Portal[] = [...DECK_PORTALS, SQUARE_PORTAL];
    expect(withDecks(SQUARE_ARRIVAL.x, SQUARE_ARRIVAL.z)).toBe(SQUARE_ARRIVAL.y);
    for (const p of all) expect(inPortal(p, SQUARE_ARRIVAL.x, SQUARE_ARRIVAL.y, SQUARE_ARRIVAL.z)).toBe(false);
    for (const d of DECK_PORTALS) {
      const pose = deckArrival(d);
      expect(withDecks(pose.x, pose.z)).toBe(pose.y);
      for (const p of all) expect(inPortal(p, pose.x, pose.y, pose.z)).toBe(p === d);
      // facing out along the road: forward (−sin yaw, −cos yaw) is the deck's outward axis
      expect(-Math.sin(pose.yaw)).toBeCloseTo(-d.nx, 9); expect(-Math.cos(pose.yaw)).toBeCloseTo(-d.nz, 9);
    }
  });

  it('rides deck -> square -> the deck you came in by: held from the touch, one checked transfer under the dark, faded back', () => {
    const position = { x: 0, y: 0, z: 0 }, veil: number[] = [], log = { holds: [] as boolean[], settled: [] as number[], refuse: new Set<string>() };
    const ride = portalRide(linkRider(position, log), (k) => { veil.push(k); });
    const run = (seconds: number): void => { for (let t = 0; t < seconds; t += 1 / 60) ride.step(1 / 60); };
    // a fresh spawn: the ring out sends you north
    expect(exitDeck(null).edge).toBe('north');
    for (const p of DECK_PORTALS) {
      Object.assign(position, { x: p.x, y: 0, z: p.z });
      ride.step(1 / 60); expect(ride.busy()).toBe(true); expect(log.holds.at(-1)).toBe(true);
      run(PORTAL_FADE.out - 0.05); expect(ride.rides().length % 2).toBe(0); // not moved before the dark
      run(PORTAL_FADE.hold + PORTAL_FADE.in + 0.1); expect(ride.busy()).toBe(false); expect(log.holds.at(-1)).toBe(false);
      expect(position).toEqual({ x: SQUARE_ARRIVAL.x, y: SQUARE_ARRIVAL.y, z: SQUARE_ARRIVAL.z });
      expect(log.settled.at(-1)).toBe(SQUARE_ARRIVAL.yaw); expect(ride.entered()).toBe(p.edge);
      // still standing where it put you: nothing fires again
      run(0.5); expect(ride.rides().length % 2).toBe(1);
      Object.assign(position, { x: SQUARE_PORTAL.x, y: SQUARE_PORTAL.y, z: SQUARE_PORTAL.z });
      run(PORTAL_FADE.out + PORTAL_FADE.hold + PORTAL_FADE.in + 0.2);
      const out = deckArrival(p);
      expect(position).toEqual({ x: out.x, y: out.y, z: out.z }); expect(log.settled.at(-1)).toBe(out.yaw);
      // arriving in the deck's own ring never bounces you back; stepping out of it re-arms it
      run(1); expect(ride.busy()).toBe(false);
      Object.assign(position, { x: p.x - p.nx * 3, y: 0, z: p.z - p.nz * 3 }); ride.step(1 / 60);
    }
    expect(ride.rides().map((r) => `${r.from}>${r.to}`)).toEqual(DECK_PORTALS.flatMap((p) => [`${p.id}>portal.square.arrival`, `${squareExitId(p.edge)}>${p.id}`]));
    expect(ride.refused()).toEqual([]);
    expect(Math.max(...veil)).toBe(1); expect(veil.at(-1)).toBe(0);
  });

  it('resumes exactly from a mid-ride snapshot (the headless host\'s continuation): the same transfer, the same veil', () => {
    const p = DECK_PORTALS[2]; if (p === undefined) throw new Error('south deck');
    const run = (ride: ReturnType<typeof portalRide>, n: number): void => { for (let i = 0; i < n; i++) ride.step(1 / 60); };
    const a = { x: p.x, y: 0, z: p.z }, veilA: number[] = [], logA = { holds: [] as boolean[], settled: [] as number[], refuse: new Set<string>() };
    const first = portalRide(linkRider(a, logA), (k) => { veilA.push(k); });
    run(first, 10); // held, before the transfer
    const saved = first.snapshot(); expect(saved).toMatchObject({ from: p.id, moved: false, armed: false, rides: [] }); expect(saved.t).toBeGreaterThan(0);
    const b = { ...a }, veilB: number[] = [], logB = { holds: [] as boolean[], settled: [] as number[], refuse: new Set<string>() };
    const second = portalRide(linkRider(b, logB), (k) => { veilB.push(k); });
    second.restore(structuredClone(saved));
    const mark = veilA.length;
    run(first, 60); run(second, 60);
    expect(second.snapshot()).toEqual(first.snapshot()); expect(b).toEqual(a); expect(veilB).toEqual(veilA.slice(mark));
    expect(second.rides().map((r) => r.from)).toEqual([p.id]); expect(second.entered()).toBe('south');
  });

  it('fades back where you stand when the format refuses the transfer (never an arbitrary move)', () => {
    const p = DECK_PORTALS[1]; if (p === undefined) throw new Error('east deck');
    const position = { x: p.x, y: 0, z: p.z }, log = { holds: [] as boolean[], settled: [] as number[], refuse: new Set([p.id]) };
    const ride = portalRide(linkRider(position, log), () => undefined);
    for (let t = 0; t < 1.2; t += 1 / 60) ride.step(1 / 60);
    expect(ride.refused()).toEqual([`refused ${p.id}`]); expect(ride.rides()).toEqual([]);
    expect(position).toEqual({ x: p.x, y: 0, z: p.z }); expect(log.settled).toEqual([]); expect(log.holds).toEqual([true, false]);
  });

  it('transfers a real capsule through the declared floors as the world installs them (pieces answering to their ids)', async () => {
    const physics = await physicsWorld();
    // world/install.ts: each declared floor row is its own piece whose colliders answer to the row's id
    for (const row of portalFloorRows()) addPiece(physics, { id: `nds-${row.id}`, name: row.id, category: 'buildings', file: 'test', surface: 'stone', colliders: row.shapes, colliderOwner: row.id });
    const motor = motorFor(physics), entries = portalLinkEntries(source.entryways);
    try {
      for (const p of DECK_PORTALS) {
        const feet = { x: p.x + p.nx * 0.4, y: 0, z: p.z + p.nz * 0.4 };
        motor.resetAt(feet);
        const traversal = createPortalTraversal(entries, source, { physics, motor, feet });
        const there = traversal.teleport(p.id);
        expect(there).toEqual({ from: p.id, to: 'portal.square.arrival', yaw: SQUARE_ARRIVAL.yaw });
        expect(feet).toEqual({ x: SQUARE_ARRIVAL.x, y: SQUARE_ARRIVAL.y, z: SQUARE_ARRIVAL.z }); expect(portalTransitioning(physics)).toBe(false);
        // standing at the square's ring, its exit bound to this deck sends you back out of the deck's ring
        Object.assign(feet, { x: SQUARE_PORTAL.x, y: SQUARE_PORTAL.y, z: SQUARE_PORTAL.z }); motor.resetAt(feet);
        expect(traversal.teleport(squareExitId(p.edge))).toEqual({ from: squareExitId(p.edge), to: p.id, yaw: deckArrival(p).yaw });
        expect(feet).toEqual({ x: p.x, y: 0, z: p.z });
        // away from the ring the transfer is refused and nothing moves
        Object.assign(feet, { x: p.x - p.nx * 3, y: 0, z: p.z - p.nz * 3 }); motor.resetAt(feet);
        expect(() => traversal.teleport(p.id)).toThrow('not standing at the bound source portal');
        expect(feet).toEqual({ x: p.x - p.nx * 3, y: 0, z: p.z - p.nz * 3 });
      }
    } finally { motor.dispose(); physics.dispose(); }
  });
});
