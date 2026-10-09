import { afterAll, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { GridAssembly } from '../src/game/grid/assembly';
import { TEMPLATE_WEST_GRID } from './fixtures/grid/templateWest';
import { gridHoverSpeed, gridZone, gridCanAct, GridCombatRules, reframeGridUnit, installGridHoverSpeed, type GridPresence, type GridTravelUnit } from '../src/game/grid/rules';
import { parseTraversal } from '../src/game/shardfile/traversal';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { Player } from '../src/engine/player/Player';
import { hoverCoastDecel, hoverSpeed } from '../src/engine/player/hoverSpeed';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { installGridBorders, gridCreatureConstraint, installGridMountPassage } from '../src/engine/physics/gridBorders';
import { legacyDouble } from './fake/FakeGame';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const restore = overrideTerrain({ heightAt: () => 0 });
afterAll(restore);
const point = (x = 0, z = 0, y = 0) => ({ x, y, z });
const presence = (instance = 'template-1', x = 0, readOnly = false): GridPresence => ({ instance, local: point(x), readOnly });
function fixtureSpec() { const spec = SIM_LEVEL.entities[0]?.spec; if (spec === undefined) throw new Error('Missing actual fixture species'); return spec; }
const spec = fixtureSpec();
function animal(id: string, flying = false): AnimalSim {
  return new AnimalSim({ ...spec, ...(flying ? { flight: { altitude: 25, above: 'world' as const, climbRate: 4, diveRate: 8 } } : {}) }, 357, 1, id, { heightAt: () => 0, random: () => 0.5 });
}
async function physics() {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), ph = new Physics(R);
  ph.world.createCollider(R.ColliderDesc.cuboid(1000, 0.5, 1000).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  return ph;
}
const MOTOR = { radius: 0.3, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'CREATURE', blockedBy: ['WORLD'] } as const;

describe('grid traversal rules', () => {
  it('eases all four strips continuously from a lowered author cap to the 30 m/s deck', () => {
    expect(parseTraversal({})).toEqual({ hoverCap: 14 });
    for (const cap of [0.1, 10, 14]) for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const speeds = Array.from({ length: 41 }, (_, i) => gridHoverSpeed(point(x * (250 + i / 2), z * (250 + i / 2)), cap));
      expect(speeds[0]).toBe(cap); expect(speeds.at(-1)).toBe(30);
      expect(speeds.every((speed, i) => i === 0 || speed >= (speeds[i - 1] ?? 0))).toBe(true);
      expect(gridHoverSpeed(point(x * 260, z * 260), cap)).toBeCloseTo((cap + 30) / 2, 10);
    }
    expect(gridHoverSpeed(point())).toBe(14); expect(gridZone(point(270))).toBe('highway');
    for (const cap of [0, 15, Infinity, Number.NaN]) expect(() => parseTraversal({ hoverCap: cap })).toThrow();
    expect(() => gridHoverSpeed(point(Infinity))).toThrow();
  });
  it('drives the actual board at 30 m/s on the deck and at most 14 inside, including standalone', async () => {
    for (const top of [undefined, 14, 30]) {
      const ph = await physics(), scope = new Scope('board');
      const player = new Player(new PerspectiveCamera(), ph, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
      try {
        let local = point(top === 30 ? 275 : 0);
        if (top !== undefined) installGridHoverSpeed(player, scope, () => ({ local, shardCap: 14, onHighwayDeck: true }));
        player.setHover(true); player.locked = true; player.keys.add('KeyW');
        for (let tick = 0; tick < 600; tick++) { player.input(1 / 60); ph.step(); player.step(1 / 60); }
        expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(top ?? 14, 4);
        if (top === 30) { local = point(); player.input(1 / 60); ph.step(); player.step(1 / 60); expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThanOrEqual(14); }
        scope.dispose(); expect(player.hoverSpeedLimit).toBeNull();
      } finally { scope.dispose(); player.motor.dispose(); ph.dispose(); }
    }
    expect(hoverSpeed()).toBe(14); expect(() => hoverSpeed(Number.NaN)).toThrow();
  });
  it('coasts a released board to a believable stop: ~70 m from the 30 m/s deck, the old 33 m glide from 14 (SF20d)', async () => {
    expect(hoverCoastDecel(0)).toBe(3); expect(hoverCoastDecel(14)).toBe(3); expect(hoverCoastDecel(30)).toBe(19);
    expect(() => hoverCoastDecel(-1)).toThrow(); expect(() => hoverCoastDecel(Number.NaN)).toThrow();
    for (const top of [undefined, 30]) {
      const ph = await physics(), scope = new Scope('coast');
      const player = new Player(new PerspectiveCamera(), ph, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
      try {
        if (top !== undefined) installGridHoverSpeed(player, scope, () => ({ local: point(275), shardCap: 14, onHighwayDeck: true }));
        player.setHover(true); player.locked = true; player.keys.add('KeyW');
        for (let tick = 0; tick < 600; tick++) { player.input(1 / 60); ph.step(); player.step(1 / 60); }
        expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeCloseTo(top ?? 14, 4);
        player.keys.delete('KeyW');
        const x0 = player.position.x, z0 = player.position.z;
        let ticks = 0;
        while (Math.hypot(player.velocity.x, player.velocity.z) > 0.05 && ticks < 1200) { player.input(1 / 60); ph.step(); player.step(1 / 60); ticks++; }
        const glide = Math.hypot(player.position.x - x0, player.position.z - z0);
        if (top === 30) { expect(glide).toBeGreaterThan(55); expect(glide).toBeLessThan(80); } else { expect(glide).toBeGreaterThan(28); expect(glide).toBeLessThan(36); }
      } finally { scope.dispose(); player.motor.dispose(); ph.dispose(); }
    }
  });
  it('keeps non-deck neighbouring water at the shard cap and restores scoped speed ownership', () => {
    const scope = new Scope('water'), player = { hoverSpeedLimit: null as (() => number) | null };
    installGridHoverSpeed(player, scope, () => ({ local: point(275), shardCap: 10, onHighwayDeck: false }));
    expect(player.hoverSpeedLimit?.()).toBe(10); scope.dispose(); expect(player.hoverSpeedLimit).toBeNull();
  });
  it('keeps creatures home through real Rapier on every edge, but lets the player cross', async () => {
    const ph = await physics(), scope = new Scope('home'); installGridBorders(ph, scope); ph.step();
    try {
      for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const motor = new CharacterMotor(ph, MOTOR), feet = point(x * 248, z * 248, 0.02);
        for (let i = 0; i < 120; i++) { motor.move(feet, point(x * 0.5, z * 0.5, -0.01)); ph.step(); }
        expect(Math.max(Math.abs(feet.x), Math.abs(feet.z))).toBeLessThan(250); motor.dispose();
      }
      const player = new CharacterMotor(ph, { ...MOTOR, group: 'PLAYER' }), feet = point(248, 0, 0.02);
      for (let i = 0; i < 120; i++) { player.move(feet, point(0.5, 0, -0.01)); ph.step(); }
      expect(feet.x).toBeGreaterThan(290); player.dispose();
      scope.dispose(); expect(ph.world.colliders.len()).toBe(1);
    } finally { scope.dispose(); ph.dispose(); }
  });
  it('keeps far analytic creatures and fliers home without a motor, including a charging impulse', async () => {
    const ph = await physics(), scope = new Scope('fliers'); installGridBorders(ph, scope); ph.step();
    try {
      for (const flying of [false, true]) {
        const body = animal('home', flying); body.place(248, 0, flying ? 25 : 0); body.setMotion(Math.PI / 2, 30, 100);
        body.motionConstraint = gridCreatureConstraint(() => ph, 0.35); body.impulse(new Vector3(40, 0, 0));
        for (let i = 0; i < 600; i++) body.step(1 / 60);
        expect(body.position.x).toBeGreaterThan(249); expect(body.position.x).toBeLessThan(250);
        expect(body.position.y).toBe(flying ? 25 : 0);
      }
    } finally { scope.dispose(); ph.dispose(); }
  });
  it('carries a mounted creature across its home wall while retaining WORLD collisions', async () => {
    const ph = await physics(), scope = new Scope('mount'); installGridBorders(ph, scope);
    ph.world.createCollider(ph.R.ColliderDesc.cuboid(0.5, 4, 8).setTranslation(280, 4, 0).setCollisionGroups(groups('WORLD')));
    const mount = new CharacterMotor(ph, { ...MOTOR, length: 2 }), feet = point(248, 0, 0.02); ph.step();
    try {
      const constraint = gridCreatureConstraint(() => ph, 0.3), body = { motor: mount, motionConstraint: constraint as typeof constraint | null }, ride = new Scope('ride');
      installGridMountPassage(body, ride); expect(body.motionConstraint).toBeNull(); expect(mount.passThroughKinds()).toEqual(['BORDER']);
      for (let i = 0; i < 120; i++) { mount.move(feet, point(0.5, 0, -0.01)); ph.step(); }
      expect(feet.x).toBeGreaterThan(270); expect(feet.x).toBeLessThan(280);
      ride.dispose(); expect(body.motionConstraint).toBe(constraint); expect(mount.passThroughKinds()).toEqual([]);
      feet.x = 248;
      for (let i = 0; i < 120; i++) { mount.move(feet, point(0.5, 0, -0.01)); ph.step(); }
      expect(feet.x).toBeLessThan(250);
    } finally { mount.dispose(); scope.dispose(); ph.dispose(); }
  });
  it('prepares mount and rider as one atomic unit, preserving separation, velocity, yaw and stable IDs', () => {
    const grid = new GridAssembly({ developer: false, devserver: false }, TEMPLATE_WEST_GRID), from = grid.cell('template-3'), to = grid.cell('driftwood-isle');
    const unit: GridTravelUnit = { instance: from.instance, members: [
      { id: 'actor.player', role: 'rider', position: point(278, 0, 2), velocity: point(12), yaw: 0.7 },
      { id: 'horse.1', role: 'mount', position: point(277, 0, 0.02), velocity: point(12), yaw: 0.7 },
    ] };
    const before = JSON.stringify(unit), framed = reframeGridUnit(unit, from, to);
    expect(framed.instance).toBe(to.instance); expect(framed.members.map((m) => m.position.x)).toEqual([-277, -278]);
    expect(framed.members.map((m) => m.velocity)).toEqual(unit.members.map((m) => m.velocity));
    expect(framed.members.map((m) => [m.position.y, m.yaw, m.id])).toEqual(unit.members.map((m) => [m.position.y, m.yaw, m.id]));
    expect(reframeGridUnit(framed, to, from)).toEqual(unit); expect(JSON.stringify(unit)).toBe(before);
    expect(() => reframeGridUnit({ ...unit, members: [...unit.members, unit.members[0]].filter((m) => m !== undefined) }, from, to)).toThrow();
    expect(() => reframeGridUnit({ ...unit, members: unit.members.map((m) => m.role === 'mount' ? { ...m, yaw: Number.NaN } : m) }, from, to)).toThrow();
    expect(() => reframeGridUnit(unit, from, to, true)).toThrow(); expect(JSON.stringify(unit)).toBe(before);
    expect(Object.isFrozen(framed.members)).toBe(true);
  });
  it('rejects cross-border combat before callbacks and leaves same-cell damage unchanged', () => {
    const events = new Events(), scope = new Scope('combat'), combat = new CombatPipeline(events, scope), rules = new GridCombatRules(events, scope);
    const a = animal('same.entity'), b = animal('same.entity'), reaction = vi.fn<() => void>(); b.combatActor().onDamageRequest = reaction;
    let source = presence(), target = presence('template-2');
    rules.bind(a.combatActor(), () => source, scope); rules.bind(b.combatActor(), () => target, scope);
    const hit = () => combat.hit({ source: a.combatActor(), sourceTags: ['weapon.sword'], target: b.combatActor(), amount: 7, point: new Vector3(), dir: new Vector3() });
    const hp = b.hp; expect(hit()).toBeNull(); expect(b.hp).toBe(hp); expect(reaction).not.toHaveBeenCalled();
    target = presence(); expect(hit()?.dealt).toBe(7); expect(b.hp).toBe(hp - 7); expect(reaction).toHaveBeenCalledOnce();
    source = presence('template-2'); expect(hit()).toBeNull(); scope.dispose(); expect(events.census()).toEqual({ listeners: 0, answerers: 0 });
  });
  it('makes the highway and strip safe from incoming, outgoing and environmental combat', () => {
    const events = new Events(), scope = new Scope('safe'), combat = new CombatPipeline(events, scope), rules = new GridCombatRules(events, scope);
    const a = animal('a'), b = animal('b'); let source = presence(), target = presence();
    rules.bind(a.combatActor(), () => source, scope); rules.bind(b.combatActor(), () => target, scope);
    const hit = (env = false) => combat.hit({ source: env ? 'env' : a.combatActor(), sourceTags: ['env.fire'], target: b.combatActor(), amount: 7, point: new Vector3(), dir: new Vector3() });
    for (const x of [250.01, 260, 270, 277.5]) {
      target = presence('template-1', x); expect(hit()).toBeNull(); expect(hit(true)).toBeNull();
      source = target; target = presence(); expect(hit()).toBeNull(); source = presence();
    }
    expect(hit(true)?.dealt).toBe(7); scope.dispose();
  });
  it('keeps visible read-only neighbours out of actions and damage, and refuses unbound actor provenance', () => {
    const events = new Events(), scope = new Scope('neighbours'), combat = new CombatPipeline(events, scope), rules = new GridCombatRules(events, scope);
    const a = animal('a'), b = animal('b'); let target = presence('template-1', 0, true);
    rules.bind(a.combatActor(), () => presence(), scope); rules.bind(b.combatActor(), () => target, scope);
    expect(gridCanAct(target)).toBe(false);
    const hit = () => combat.hit({ source: a.combatActor(), sourceTags: ['weapon.sword'], target: b.combatActor(), amount: 7, point: new Vector3(), dir: new Vector3() });
    expect(hit()).toBeNull(); target = presence(); expect(hit()?.dealt).toBe(7);
    const child = scope.child('rebind'); rules.bind(b.combatActor(), () => target, child); child.dispose(); expect(hit()).toBeNull(); scope.dispose();
  });
});
