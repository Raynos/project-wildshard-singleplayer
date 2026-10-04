import { NALATI_STRIKES, sampleArena } from '../../src/shards/nalati-grasslands/combat/strikes';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { PlayerHealth } from '../../src/engine/combat/health';
import { encounterHit } from '../../src/shards/nalati-grasslands/combat/damage';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Animal } from '../../src/engine/entities/Animal';
import { AnimalManager } from '../../src/engine/entities/AnimalManager';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { activePhysics, setActivePhysics } from '../../src/engine/physics/active';
import { groups, type GroupName } from '../../src/engine/physics/groups';
import { tagCollider, untagCollider, type Material } from '../../src/engine/physics/surface';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';

let R: Awaited<ReturnType<typeof loadRapier>>;
const previous = activePhysics();
const worlds: Physics[] = [];
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
afterEach(() => { setActivePhysics(previous); for (const ph of worlds.splice(0)) { ph.world.forEachCollider(untagCollider); ph.dispose(); } });
function arena(z: number | null, material: Material = 'wood', group: GroupName = 'WORLD'): Physics {
  const ph = new Physics(R); worlds.push(ph);
  if (z !== null) {
    const c = ph.world.createCollider(ph.R.ColliderDesc.cuboid(3, 2, 0.1).setTranslation(0, 1, z).setCollisionGroups(groups(group)));
    tagCollider(c, material);
  }
  ph.step(); setActivePhysics(ph); return ph;
}
function reach(z = 4): boolean {
  const a = legacyActor(Animal.prototype, { position: new THREE.Vector3(0, 0, z), scale: 1,
    dims: { bodyY: 1.2, bodyRadius: 0.3 }, headWorld: (out: THREE.Vector3) => out.set(0, 1.8, z) });
  return invokeLegacy(AnimalManager.prototype, 'canReach', a, new THREE.Vector3()) === true;
}
describe('legacy melee chest-to-attacker occlusion using the real physics query', () => {
  it.each(['wood', 'stone', 'felt', 'metal'] as const)('%s cover vetoes a hit at its contact frame', (material) => {
    arena(2, material); expect(reach()).toBe(false);
  });
  it('no world and a clear world both permit contact', () => {
    setActivePhysics(null); expect(reach()).toBe(true); arena(null); expect(reach()).toBe(true);
  });
  it('creature colliders do not become cover', () => { arena(2, 'flesh', 'CREATURE'); expect(reach()).toBe(true); });
  it('a wall opened after windup immediately permits contact', () => {
    const ph = arena(2); expect(reach()).toBe(false);
    ph.world.forEachCollider((c) => { ph.world.removeCollider(c, false); }); ph.step(); expect(reach()).toBe(true);
  });
  it('endpoint slack permits an attacker touching a wall; a wall nearer the player blocks', () => {
    arena(3.9); expect(reach()).toBe(true); arena(3.4); expect(reach()).toBe(false);
  });
});


describe('Nalati encounter contact routes through the same cover query and player rules', () => {
  it.each(['elite.aqbars', 'boss.golden-king', 'creature.ghost-rider'] as const)('%s cannot hit through a yurt or dungeon pillar', (tag) => {
    const previousScope = app.levelScope, scope = new Scope('nalati-contact');
    app.levelScope = scope;
    const health = new PlayerHealth(app.events, { now: () => 1000, dodging: () => false, dodgeGuard: () => false, position: () => new THREE.Vector3() });
    app.registerPlayer(health, scope); app.combat.playerRules(scope, { target: health });
    const a = legacyActor(Animal.prototype, { kind: 'leopard', label: 'Aqbars', position: new THREE.Vector3(0, 0, 4), scale: 1,
      dims: { bodyY: 1.2, bodyRadius: 0.3 }, headWorld: (out: THREE.Vector3) => out.set(0, 1.8, 4) });
    try {
      arena(2, 'felt');
      expect(encounterHit(a, 14, tag, new THREE.Vector3())).toBe(false); expect(health.attributes.health).toBe(100);
      arena(null);
      expect(encounterHit(a, 14, tag, new THREE.Vector3())).toBe(true); expect(health.attributes.health).toBe(86);
      arena(2, 'stone');
      expect(encounterHit(a, 4, tag, new THREE.Vector3(), true)).toBe(true); expect(health.attributes.health).toBe(82);
    } finally { scope.dispose(); app.levelScope = previousScope; }
  });
});

describe('Titan arena contact cover policy', () => {
  it.each([NALATI_STRIKES.spear, NALATI_STRIKES.whirl, NALATI_STRIKES.wind])('$id uses the real wall at the contact frame', spec => {
    const origin = new THREE.Vector3(0, 0, 2.5), player = new THREE.Vector3(); let hits = 0;
    const hit = (): void => { hits++; };
    arena(1.2, 'felt'); expect(sampleArena(spec, origin, player, hit)).toBe(false); expect(hits).toBe(0);
    arena(null); expect(sampleArena(spec, origin, player, hit)).toBe(true); expect(hits).toBe(1);
  });
  it.each([NALATI_STRIKES.chain, NALATI_STRIKES.fire, NALATI_STRIKES.wall])('$id retains its authored arena exemption', spec => {
    arena(1.2, 'stone'); let hits = 0;
    expect(sampleArena(spec, new THREE.Vector3(0, 0, 2.5), new THREE.Vector3(), () => { hits++; })).toBe(true);
    expect(hits).toBe(1);
  });
});
