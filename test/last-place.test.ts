import { describe, expect, it } from 'vitest';
import { LastPlace, placeAt, placeName, yawToward, type PlaceArea } from '../src/game/LastPlace';
import { deathCause, deathLine, respawnWhere } from '../src/engine/ui/HurtArc';
import { DRIFTWOOD_PLACES } from '../src/shards/driftwood-isle/quest/Places';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import { STRINGS as PINE } from '../src/shards/pine-hollow/strings';

// the level registers how its creatures kill (ctx.strings 'death.verb.<kind>'; E405)
app.levelRegistrations.strings(PINE, new Scope('test.death-verbs'));

const PLACES: PlaceArea[] = [
  { id: 'pier', label: 'THE PIER', x: 0, z: -215, r: 40 },
  { id: 'hut', label: "WENDELL'S HUT", x: 0, z: 0, r: 26 },
  { id: 'wreck', label: 'WRECK COVE', x: 120, z: 40, r: 30 },
  { id: 'lookout', label: 'THE LOOKOUT', x: -60, z: -40, r: 24 },
  { id: 'zipline', label: 'ZIPLINE', x: -50, z: -40, r: 12 },
];
const at = (x: number, z: number, grounded = true, y = 2) => ({ x, y, z, grounded });

describe('LastPlace — where a death puts you back (E295)', () => {
  it('no place reached yet → null (the caller falls back to the spawn)', () => {
    const last = new LastPlace(() => PLACES);
    expect(last.stand).toBeNull();
    last.observe(at(300, 300)); // between places
    expect(last.stand).toBeNull();
  });

  it('the last place reached wins, at the footing where you stood, facing into it', () => {
    const last = new LastPlace(() => PLACES);
    last.observe(at(0, -200));             // on the pier
    expect(last.stand?.id).toBe('pier');
    last.observe(at(0, -100));             // the path, between places: the pier stays the checkpoint
    expect(last.stand?.id).toBe('pier');
    last.observe(at(0, 20, true, 3.5));    // into the hut's radius, 20 m south of its centre
    expect(last.stand).toMatchObject({ id: 'hut', label: "WENDELL'S HUT", x: 0, y: 3.5, z: 20 });
    // facing the centre: forward (−sin yaw, −cos yaw) points from (0, 20) toward (0, 0), i.e. −Z → yaw 0
    expect(last.stand?.yaw).toBeCloseTo(0);
    last.observe(at(100, 40));
    expect(last.stand?.id).toBe('wreck');
  });

  it('keeps the entry point: walking deeper into the place (where the fight is) does not move it', () => {
    const last = new LastPlace(() => PLACES);
    last.observe(at(95, 40));
    last.observe(at(115, 40));
    last.observe(at(120, 41));
    expect(last.stand).toMatchObject({ id: 'wreck', x: 95, z: 40 });
  });

  it('only walkable footing counts: swimming / mid-air in a place waits for the first grounded step', () => {
    const last = new LastPlace(() => PLACES);
    last.observe(at(0, -200));
    last.observe(at(92, 40, false));        // swimming into Wreck Cove
    expect(last.stand?.id).toBe('pier');
    last.observe(at(96, 40, false));
    last.observe(at(99, 41, true, 1.4));    // the first step on the sand
    expect(last.stand).toMatchObject({ id: 'wreck', x: 99, y: 1.4, z: 41 });
  });

  it('coming back to an older place makes it the checkpoint again', () => {
    const last = new LastPlace(() => PLACES);
    last.observe(at(0, 10));
    last.observe(at(110, 40));
    expect(last.stand?.id).toBe('wreck');
    last.observe(at(0, 12));
    expect(last.stand).toMatchObject({ id: 'hut', z: 12 });
  });

  it('respawning inside the checkpoint does not re-capture it; reset() forgets it', () => {
    const last = new LastPlace(() => PLACES);
    last.observe(at(100, 40));
    last.observe(at(118, 40)); // where you died
    last.observe(at(100, 40)); // put back at the stand
    expect(last.stand).toMatchObject({ id: 'wreck', x: 100 });
    last.reset();
    expect(last.stand).toBeNull();
  });

  it('overlapping places: the one you are deepest inside (the zipline deck inside the lookout)', () => {
    expect(placeAt(PLACES, -50, -41)?.id).toBe('zipline');
    expect(placeAt(PLACES, -70, -40)?.id).toBe('lookout');
    expect(placeAt(PLACES, 500, 500)).toBeNull();
  });

  it('every Driftwood place has an id, a label and a radius', () => {
    for (const p of DRIFTWOOD_PLACES) { expect(p.label).not.toBe(''); expect(p.r).toBeGreaterThan(0); }
  });

  it('yawToward follows the Player convention (forward = (−sin yaw, −cos yaw))', () => {
    for (const [tx, tz] of [[10, 0], [0, 10], [-7, -3]] as const) {
      const y = yawToward(0, 0, tx, tz), d = Math.hypot(tx, tz);
      expect(-Math.sin(y)).toBeCloseTo(tx / d);
      expect(-Math.cos(y)).toBeCloseTo(tz / d);
    }
  });
});

describe('the death card words (E295)', () => {
  it('place labels read as names', () => {
    expect(placeName('WRECK COVE')).toBe('Wreck Cove');
    expect(placeName('THE LOOKOUT')).toBe('the Lookout');
    expect(placeName("WENDELL'S HUT")).toBe("Wendell's Hut");
  });

  it('the card says where you come back: the place, else the shard spawn', () => {
    const island = { slug: 'driftwood-isle', ocean: { level: 0 } };
    expect(respawnWhere(island, 'Wreck Cove')).toBe('respawning at Wreck Cove');
    expect(respawnWhere(island, null, 'washed back to the pier')).toBe('washed back to the pier');
    expect(respawnWhere(island, null, 'washed back to the pier')).toBe('washed back to the pier');
    expect(respawnWhere({ slug: 'pine-hollow' }, null)).toBe('respawning at the south gate');
  });

  it('the headline is the killer, the same words as the old toast', () => {
    expect(deathCause({ kind: 'bear', label: 'Brown bear' })).toBe('Mauled by a brown bear');
    expect(deathCause(null)).toBe('Fell too far');
    expect(deathLine({ kind: 'bear', label: 'Brown bear' }, 'respawning at Wreck Cove')).toBe('Mauled by a brown bear — respawning at Wreck Cove');
  });
});
