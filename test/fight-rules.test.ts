// E297 (DRIFTWOOD-TOP10 row 1): one set of fight rules for every enemy on Driftwood — at most 2 attack at once (attack
// tokens), engaged boars circle back and charge again instead of fleeing (reengage). Each shard may declare its own cap.
import { BOAR } from '../src/game/systems/species/boar';
import { BEAR } from '../src/game/systems/species/bear';
import { describe, expect, it } from 'vitest';
import { reengage, backoffPoint, aroundPoint, BREAK_OFF_HP, BACKOFF_PAST, type ReengageIn } from '../src/engine/entities/fightRules';
import { AttackTokens, AggressionDirector } from '../src/engine/ai/director';
import { SHARDS } from '../src/shards.generated';
import { DRIFTWOOD_ISLE } from '../src/shards/driftwood-isle/manifest';
import * as THREE from 'three';
import { clearBody } from '../src/engine/entities/AnimalManager';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { groups } from '../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

describe('AttackTokens (E297: at most 2 attackers)', () => {
  it('hands out at most `max` tokens; a third attacker waits', () => {
    const t = new AttackTokens<string>(2);
    expect(t.take('boar')).toBe(true);
    expect(t.take('crab')).toBe(true);
    expect(t.count).toBe(2);
    expect(t.free('monkey')).toBe(false);
    expect(t.take('monkey')).toBe(false);
    expect(t.count).toBe(2);
    // a holder asking again keeps its own token and takes no second one
    expect(t.take('boar')).toBe(true);
    expect(t.free('boar')).toBe(true);
    expect(t.count).toBe(2);
  });

  it('a released token goes to the next attacker', () => {
    const t = new AttackTokens<string>(2);
    t.take('a'); t.take('b');
    t.release('a');
    expect(t.holds('a')).toBe(false);
    expect(t.free('c')).toBe(true);
    expect(t.take('c')).toBe(true);
    expect(t.take('a')).toBe(false);
    t.release('nobody'); // a no-op
    expect(t.count).toBe(2);
  });

  it('sweep takes back the tokens of attacks that are over', () => {
    const t = new AttackTokens<string>(2);
    t.take('a'); t.take('b');
    const attacking = new Set(['b']);
    t.sweep((who) => attacking.has(who));
    expect(t.count).toBe(1);
    expect(t.holds('a')).toBe(false);
    expect(t.holds('b')).toBe(true);
  });

  it('five enemies trading attacks never have more than 2 going at once', () => {
    const t = new AttackTokens<number>(2);
    const left = [0, 0, 0, 0, 0]; // s of attack left per enemy (0 = not attacking)
    const cd = [0, 0.3, 0.6, 0.9, 1.2];
    let most = 0, attacks = 0;
    for (let tick = 0; tick < 300; tick++) { // 30 s at the manager's 10 Hz
      t.sweep((i) => (left[i] ?? 0) > 0);
      for (let i = 0; i < 5; i++) {
        cd[i] = Math.max(0, (cd[i] ?? 0) - 0.1);
        if ((left[i] ?? 0) > 0) { left[i] = Math.max(0, (left[i] ?? 0) - 0.1); continue; }
        if ((cd[i] ?? 0) <= 0 && t.take(i)) { left[i] = 0.8; cd[i] = 1.4; attacks++; }
      }
      let now = 0;
      for (const l of left) if (l > 0) now++;
      most = Math.max(most, now);
      expect(t.count).toBeLessThanOrEqual(2);
    }
    expect(most).toBe(2);
    expect(attacks).toBeGreaterThan(40); // every one of them still gets its turns
  });

  it('a zero-token pool (no rules) never grants — the manager does not ask it then', () => {
    const t = new AttackTokens<string>(0);
    expect(t.take('a')).toBe(false);
  });
});

const base: ReengageIn = { hpFrac: 1, relentless: false, roll: 0.9, ready: true, token: true, dist: 6, chargeDist: 10, hit: false };

describe('reengage (E297: boars circle back instead of fleeing)', () => {
  it('a healthy boar never breaks off — not on a hit, not on any roll', () => {
    for (const roll of [0, 0.1, 0.5, 0.99]) {
      expect(reengage({ ...base, hit: true, roll })).not.toBe('flee');
      expect(reengage({ ...base, hit: true, roll, hpFrac: 0.4 })).not.toBe('flee');
    }
  });

  it('charges again when its cooldown is over, a token is free and you are in range', () => {
    expect(reengage(base)).toBe('charge');
  });

  it('circles on the ring while it waits: cooldown, no token, or out of range', () => {
    expect(reengage({ ...base, ready: false })).toBe('circle');
    expect(reengage({ ...base, token: false })).toBe('circle');
    expect(reengage({ ...base, dist: 12 })).toBe('circle');
  });

  it('only a nearly dead one may break off, only on a hit, and only on the roll', () => {
    const low = { ...base, hpFrac: BREAK_OFF_HP - 0.05, hit: true };
    expect(reengage({ ...low, roll: 0.2 })).toBe('flee');
    expect(reengage({ ...low, roll: 0.8 })).toBe('charge');
    expect(reengage({ ...low, hit: false, roll: 0.2 })).toBe('charge');  // circling, not hit: it keeps fighting
    expect(reengage({ ...low, relentless: true, roll: 0 })).toBe('charge'); // Old Ironhide never runs
  });
});

describe('the back-off and the ring (E297)', () => {
  it('backs off to just past the ring, arcing to one side, and the other side next time', () => {
    const o = { x: 0, z: 0 };
    const ring = BOAR.ringRadius ?? 6.5;
    backoffPoint(0, 0, 0, 1.2, ring, 1, o);   // a boar 1.2 m north of you after the charge
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(ring + BACKOFF_PAST, 5);
    expect(o.z).toBeGreaterThan(0);          // away from you, on its own side
    const left = o.x;
    backoffPoint(0, 0, 0, 1.2, ring, -1, o);
    expect(Math.sign(o.x)).toBe(-Math.sign(left)); // the other way round
  });

  it('the ring sits inside the charge distance (a boar on it can charge from there)', () => {
    expect((BOAR.ringRadius ?? 6.5)).toBeLessThan(10); // BOAR_TUNING.panicDist
    expect((BEAR.ringRadius ?? 6.5)).toBeLessThan(14); // BEAR_TUNING.panicDist
  });

  it('aroundPoint on top of the player picks a direction instead of NaN', () => {
    const o = aroundPoint(3, 4, 3, 4, 5, 0.4, { x: 0, z: 0 });
    expect(Number.isFinite(o.x) && Number.isFinite(o.z)).toBe(true);
    expect(Math.hypot(o.x - 3, o.z - 4)).toBeCloseTo(5, 5);
  });
});

describe('ShardManifest.fightRules (E297)', () => {
  it('Driftwood retains its 2-attacker cap; every shard gets its declared cap or the unlimited default', () => {
    expect(DRIFTWOOD_ISLE.fight?.attackers).toBe(2);
    // Include hidden and experimental shards: opting into capped fights is a public manifest feature.
    for (const c of SHARDS) {
      const cap = c.fight?.attackers;
      const director = new AggressionDirector<number>(cap);
      expect(director.max, c.slug).toBe(cap ?? Infinity);
      expect(director.enabled, c.slug).toBe(cap !== undefined && Number.isFinite(cap));
      if (cap === undefined || cap === Infinity) {
        for (let i = 0; i < 20; i++) expect(director.take(i), c.slug).toBe(true);
      } else {
        expect(Number.isInteger(cap) && cap >= 0, c.slug).toBe(true);
        for (let i = 0; i < cap; i++) expect(director.take(i), c.slug).toBe(true);
        expect(director.take(cap), c.slug).toBe(false);
        expect(director.count, c.slug).toBe(cap);
      }
    }
  });
});

// E323 (audit of E297): the body clearance moves an animal only through its physics motor (src/engine/physics/ owns
// collision): a wall behind it stops the push, and one with no motor (a ridden horse, no physics) is not moved at all.
describe('clearBody (E297 / E323: no body swallows the camera, pushed only through physics)', () => {
  const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());
  const BODY_R = 0.5;
  /** a bear-sized stand-in facing +z: the body 1.2 m long, the head ahead of it */
  const animal = (motor: CharacterMotor | null) => {
    const position = new THREE.Vector3(0, 0.02, 0);
    return {
      position, yaw: 0, scale: 1, motor,
      dims: { bodyRadius: BODY_R, headRadius: 0.3 },
      mesh: { position: position.clone() },
      bodyCapsule: (a: THREE.Vector3, b: THREE.Vector3) => { a.set(position.x, 0.8, position.z - 0.6); b.set(position.x, 0.8, position.z + 0.6); },
      headWorld: (out: THREE.Vector3) => out.set(position.x, 1, position.z + 1),
    };
  };
  const player = new THREE.Vector3(0.3, 0, 0); // 0.3 m off the body's axis: inside it
  const world = async (wallFace: number | null) => {
    const ph = new Physics(await rapier());
    ph.world.createCollider(ph.R.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
    if (wallFace !== null) ph.world.createCollider(ph.R.ColliderDesc.cuboid(0.25, 2, 5).setTranslation(wallFace - 0.25, 2, 0).setCollisionGroups(groups('WORLD')));
    const motor = new CharacterMotor(ph, { radius: BODY_R, height: 1.3, step: 0.3, maxClimbDeg: 45, snap: 0.3, group: 'CREATURE', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'] });
    ph.step();
    return motor;
  };
  const clear = BODY_R + 0.38 + 0.3; // its radius + CLEAR_PLAYER

  it('in the open, the body is moved straight out to its clearance, the drawn mesh with it', async () => {
    const a = animal(await world(null));
    expect(clearBody(a, player)).toBe(true);
    expect(a.position.x).toBeCloseTo(player.x - clear, 1);
    expect(a.position.z).toBeCloseTo(0, 3);
    expect(a.position.y).toBe(0.02);
    expect(a.mesh.position.x).toBeCloseTo(a.position.x, 6);
    // cleared: a second call has at most the motor's skin gap left to close
    const x1 = a.position.x;
    clearBody(a, player);
    expect(Math.abs(a.position.x - x1)).toBeLessThan(0.05);
  });

  it('a wall behind it stops the push (the player\'s own knock-back does the rest)', async () => {
    const a = animal(await world(-0.8));
    clearBody(a, player);
    expect(a.position.x).toBeLessThan(0);                       // it moved out some…
    expect(a.position.x - BODY_R).toBeGreaterThanOrEqual(-0.8 - 0.02); // …but its capsule never entered the wall
  });

  it('no motor, no move: nothing is pushed blind', () => {
    const a = animal(null);
    expect(clearBody(a, player)).toBe(false);
    expect(a.position.x).toBe(0);
    expect(a.mesh.position.x).toBe(0);
  });
});
