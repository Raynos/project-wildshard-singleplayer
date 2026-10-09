// oxlint-disable-next-line import/no-nodejs-modules -- The admission check reads the committed, content-addressed islet module.
import { readFileSync } from 'node:fs';
import { LIFT_MODULE } from '../../../src/shards/far-reach/data/liftModule';
import { BRIDGE_MODULE } from '../../../src/shards/far-reach/data/bridgeModule';
import { describe, expect, it } from 'vitest';
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '../../../src/engine/core/config';
import { contentHash } from '../../../src/sdk/project';
import { validateShardfileAssets } from '../../../src/game/shardfile/validate';
import { socketLiftEntries, socketLiftRules } from '../../../src/game/shardfile/socketLift';
import { validateEntrywayClearance } from '../../../src/game/shardfile/entryClearance';
import { parseMovers } from '../../../src/game/shardfile/movers';
import { ISLET, RISING_ISLETS } from '../../../src/shards/far-reach/world/islets';
import { ISLET_ISLE, isletBoxes, lipCollider } from '../../../src/shards/far-reach/world/risingIslet';
import { CROWN, ISLES, KEEPER, NEST, SPIRES, STEP, type Isle } from '../../../src/shards/far-reach/data/layout';
import { apothem, rimAlong, spireAt } from '../../../src/shards/far-reach/layout';
import { MOVERS } from '../../../src/shards/far-reach/data/movers';
import source from '../../../src/shards/far-reach/shard.config';

// SHARD-PLATFORM SF49-g (Jake's G99 / G183, the Rising Islet): at each edge midpoint a stone lip at road height, a grass
// islet resting against it that rises on chains to a gate isle ~50 m in and 25 m up, a rope bridge on to an island.
const deg = (rise: number, run: number): number => (Math.atan2(Math.abs(rise), run) * 180) / Math.PI;
const inside = (isle: Isle, x: number, z: number): boolean => Math.hypot(x - isle.x, z - isle.z) < rimAlong(isle, Math.atan2(z - isle.z, x - isle.x));

describe('Sky Reach Rising Islet entries', () => {
  it('declares four socketLift entries: a static approach over a full-width stone lip at y = 0 to the islet, a road gate, the gate isle beyond', () => {
    expect(source.entryways.map((row) => [row.edge, row.kind, row.width])).toEqual(['north', 'east', 'south', 'west'].map((edge) => [edge, 'socketLift', ENTRY_WIDTH]));
    expect(source.accent).toBe('pink'); // G104: 18 PINK
    // every admitted file (the islet and the bridge modules) from its committed bytes
    const admitted = new Map(source.files.map((file) => [file.hash, Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${file.hash}`))]));
    expect(source.files.map((file) => file.hash).sort()).toEqual([BRIDGE_MODULE.hash, LIFT_MODULE.hash].sort());
    expect(() => validateShardfileAssets(source, admitted, contentHash)).not.toThrow();
    const lifts = socketLiftEntries(source.entryways);
    expect(lifts.map((row) => [row.lift.mover, row.lift.gate, row.lift.approach?.colliders])).toEqual(RISING_ISLETS.map((e) => [`far.islet.${e.edge}`, `far.islet.${e.edge}.gate`, [`landing.${e.edge}`]]));
    expect(socketLiftRules(lifts, source.movers, source)).toEqual([]);
    // the compiled movers are exactly the islets and their gates, on the one admitted module
    expect(source.movers.map((m) => m.id).sort()).toEqual(RISING_ISLETS.flatMap((e) => [`far.islet.${e.edge}`, `far.islet.${e.edge}.gate`]).sort());
    expect(new Set(source.movers.map((m) => m.module))).toEqual(new Set(source.sim.scripts));
    // no lip, one shifted 9.5 m along the edge, or one 1 cm proud of the road: refused
    const props = source.props; if (props === null) throw new Error('Sky Reach declares its landings');
    const shifted = (dy: number, dt: number) => props.colliders.map((row) => {
      if (row.id !== 'landing.north') return row;
      return { ...row, shapes: row.shapes.map((shape) => (shape.kind === 'box' ? { ...shape, x: shape.x + dt, y: shape.y + dy } : shape)) };
    });
    expect(socketLiftRules(lifts, source.movers, { ...source, props: null })).toHaveLength(4);
    expect(socketLiftRules(lifts, source.movers, { ...source, props: { ...props, colliders: shifted(0, 9.5) } })).toHaveLength(1);
    expect(socketLiftRules(lifts, source.movers, { ...source, props: { ...props, colliders: shifted(0.01, 0) } })).toHaveLength(1);
  });

  it('keeps the lips and the resting islets inside the cell and out of the 8 × 15 m socket above road height', () => {
    const shapes: { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; rot?: { x: number; y: number; z: number; w: number }; surface: 'stone' }[] = [];
    for (const entry of RISING_ISLETS) {
      const c = lipCollider(entry); if (c.kind !== 'box') throw new Error('lips are boxes');
      shapes.push({ kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, surface: 'stone' });
      for (const b of isletBoxes()) shapes.push({ kind: 'box', x: entry.rest.x + b.x, y: entry.rest.y + b.y, z: entry.rest.z + b.z, hx: b.hx, hy: b.hy, hz: b.hz, rot: b.rot, surface: 'stone' });
    }
    for (const s of shapes) expect(Math.max(Math.abs(s.x), Math.abs(s.z)) + Math.hypot(s.hx, s.hy, s.hz)).toBeLessThan(CHUNK_HALF);
    const props = source.props; if (props === null) throw new Error('Sky Reach declares its landings');
    const all = { ...props, colliders: [{ id: 'entries', panel: null, initialActive: true, shapes }] };
    expect(() => validateEntrywayClearance({ entryways: source.entryways, props: all, water: [] }, new Map())).not.toThrow();
  });

  it('rides: the islet rests against the lip at road height and docks against its gate isle ~50 m in, 25 m up', () => {
    const isletR = apothem(ISLET_ISLE);
    for (const entry of RISING_ISLETS) {
      const inward = Math.max(Math.abs(entry.rest.x), Math.abs(entry.rest.z));
      expect(entry.rest.y).toBe(0);
      // the islet's deck edge meets the lip's inner edge (a walk gap under 10 cm), on the midpoint's axis
      expect(CHUNK_HALF - inward - isletR - (ENTRY_ASPHALT + ISLET.lip.depth)).toBeCloseTo(ISLET.gap, 9);
      expect(Math.min(Math.abs(entry.rest.x), Math.abs(entry.rest.z))).toBe(0);
      // docked: level with the gate isle, its deck edge the same gap from the gate isle's rim
      expect(entry.dock.y).toBe(entry.gate.y); expect(entry.gate.y).toBe(25);
      expect(Math.hypot(entry.dock.x - entry.gate.x, entry.dock.z - entry.gate.z) - apothem(entry.gate) - isletR).toBeCloseTo(ISLET.gap, 9);
      expect(CHUNK_HALF - Math.max(Math.abs(entry.gate.x), Math.abs(entry.gate.z))).toBe(52);
      // a ride of a few seconds per ten metres, and the eased peak a gentle 1.11× the average
      expect(entry.travel).toBeGreaterThan(10); expect(entry.travel).toBeLessThan(30);
    }
    // one mover row per islet and one stationary gate row, on the islet module: rest, dock, travel, part, dwell
    const rows = MOVERS.filter((m) => m.id.startsWith('far.islet.'));
    expect(() => parseMovers(MOVERS)).not.toThrow();
    expect(rows.map((m) => [m.id, m.kind, m.input])).toEqual([...RISING_ISLETS.map((e) => [`far.islet.${e.edge}`, 'platform',
      [e.rest.x, e.rest.y, e.rest.z, e.dock.x, e.dock.y, e.dock.z, e.travel, 0, ISLET.dwell]]), ...RISING_ISLETS.map((e) => [`far.islet.${e.edge}.gate`, 'static',
      [e.gateBar.x, e.gateBar.y, e.gateBar.z, e.gateBar.x, e.gateBar.y, e.gateBar.z, e.travel, 1, ISLET.dwell]])]);
  });

  it('lands on playable island ground past no quest, clear of every island and the crown overhead', () => {
    expect(RISING_ISLETS.map((e) => [e.edge, e.isle.id])).toEqual([['north', 'sunrest'], ['east', 'roost'], ['south', 'ruin'], ['west', 'grove']]);
    for (const entry of RISING_ISLETS) {
      // never the storm crown, the high step or the winch's isle (G183: no entry lands past a quest)
      expect([CROWN.id, STEP.id, KEEPER.id]).not.toContain(entry.isle.id);
      // the gate isle and the islet's whole climb stay clear of every island (and its keel below)
      for (const isle of ISLES) {
        expect(Math.hypot(entry.gate.x - isle.x, entry.gate.z - isle.z)).toBeGreaterThan(isle.r + entry.gate.r + 4);
        for (let f = 0; f <= 1; f += 0.05) {
          const x = entry.rest.x + (entry.dock.x - entry.rest.x) * f, z = entry.rest.z + (entry.dock.z - entry.rest.z) * f;
          expect(Math.hypot(x - isle.x, z - isle.z)).toBeGreaterThan(isle.r + ISLET_ISLE.r + 4);
        }
      }
      // the rope bridge: off the gate isle's rim onto the island's, gently sloped
      const b = entry.bridge, run = Math.hypot(b.x1 - b.x0, b.z1 - b.z0);
      expect(inside(entry.gate, b.x0, b.z0)).toBe(true); expect(inside(entry.isle, b.x1, b.z1)).toBe(true);
      expect(deg(b.y1 - b.y, run)).toBeLessThan(8);
      // the walk ends on the island's top
      const last = entry.climb[entry.climb.length - 1]; if (last === undefined) throw new Error('climb');
      expect(inside(entry.isle, last.x, last.z)).toBe(true); expect(last.y).toBe(entry.isle.y);
      // the bridge's last 3 m and the walk on to the island's top clear the roost's spires and nest by the bridge's half
      // width (2026-10-07: straight in from the east midpoint the bridge landed on the 0.05 rad spire and the walk stalled)
      const ux = (b.x1 - b.x0) / run, uz = (b.z1 - b.z0) / run, ax = b.x1 - ux * 3, az = b.z1 - uz * 3, lx = last.x - ax, lz = last.z - az, ll = Math.hypot(lx, lz);
      const clear = (x: number, z: number): number => { const t = Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / (ll * ll))); return Math.hypot(x - ax - lx * t, z - az - lz * t); };
      for (const spire of SPIRES) { const at = spireAt(spire); expect(clear(at.x, at.z)).toBeGreaterThan(spire.r * 0.75 * Math.SQRT2 + b.width / 2); }
      expect(clear(NEST.x, NEST.z)).toBeGreaterThan(NEST.r + 0.4 + b.width / 2);
    }
  });
});
