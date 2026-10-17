import { wetFlight, type AmmoRow } from '@wildshard/engine/combat/ammo';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { parseItems } from '@wildshard/format/items';
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { RangedAction } from '@wildshard/engine/combat/Firearm';
import { BowDraw } from '@wildshard/engine/combat/bowDraw';
import { ProjectileSlots, projectileFlightStep, type FlightSlot } from '@wildshard/engine/combat/projectileFlight';
import { ProjectileContact, StoppedProjectileSlots, stoppedProjectileSaved } from '@wildshard/engine/combat/projectileContact';
import { drawnSpreadDegrees, instantSpreadDegrees, shotSpread } from '@wildshard/engine/combat/shotSpread';
import { smoothstep } from '@wildshard/engine/core/noise';
import { combatSpeedFactor } from '@wildshard/engine/player/combatMotion';
import { worldHit, floorBelow } from '@wildshard/engine/physics/query';
import { fieldGustAt, type WindFieldSpec } from '@wildshard/engine/world/windField';
import { BowWeaponProfileSchema, parseNativeFirearmProfile } from '@wildshard/format/weaponProfiles';
import { NativeRangedRowSchema } from '@wildshard/format/nativeItems';
import { createNativeTargetQueries, installNativeMelee, type NativeTargetPose, type NativeSweptMeleeInput, type NativeSweptMeleeOwner } from './simulation';

/** Mutable tick data owned by the native input boundary. It contains no clocks or executable shard hooks. */
export interface NativeCombatFrame {
  attacks: string[]; heavy: { readonly targetId?: string | undefined } | null;
  melee: { attack: string | null; heavy: boolean; heavyTarget: string | null };
  scripts: Map<string, number>; moveX: number; moveZ: number; yaw: number;
  live: Set<number>; aim: number; adsBlend: number; aimed: number; speedFactor: number | null;
  extraSpread: number; mountSpread: number; ammo: string; rain: number;
  wind: { clock: Readonly<{ time: number; gust: number }>; field: WindFieldSpec; base: number; scale: number } | null;
}
/** A fresh released input frame; a resident fills its same arrays at lend(), never retains a previous tick. */
export function createNativeCombatFrame(): NativeCombatFrame {
  return { attacks: [], heavy: null, melee: { attack: null, heavy: false, heavyTarget: null }, scripts: new Map(),
    moveX: 0, moveZ: 0, yaw: 0, live: new Set(), aim: 0.5, adsBlend: 0, aimed: 0,
    speedFactor: 0, extraSpread: 0, mountSpread: 0, ammo: '', rain: 0, wind: null };
}
/** Authoritative pre-motor sampling; unavailable delegated motion refuses firing rather than guessing standing input. */
export function observeNativeCombatMotion(host: SimHost, frame: NativeCombatFrame, speed: number): void {
  host.observePlayerMotion(sample => { frame.speedFactor = sample === null ? null : combatSpeedFactor(
    Math.sqrt(sample.velocityX * sample.velocityX + sample.velocityZ * sample.velocityZ), sample.grounded, sample.swimming, sample.hover, speed); });
}
function motion(frame: NativeCombatFrame): number {
  if (frame.speedFactor === null) throw new Error('Native ranged motion requires an authoritative player sample');
  return frame.speedFactor;
}
/** Published numeric contact points. A live joint query cannot overwrite this separate frame. */
export interface NativeRangedVolumes { readonly head: Vector3; readonly rear: Vector3; readonly front: Vector3; readonly left: Vector3; readonly right: Vector3 }
const publications = new WeakMap<AnimalSim, NativeRangedVolumes>();
/** Bind borrowed numeric points, updated by the existing pose publication owner. No callback or pose clock is installed. */
export function bindNativeRangedVolumes(host: SimHost, id: string, points: NativeRangedVolumes): void {
  const body = host.entities.get(id); if (body === undefined) throw new Error('Missing published native item target');
  publications.set(body, points);
}
function published(body: AnimalSim): NativeTargetPose {
  const points = publications.get(body); if (points === undefined) return body;
  return { headWorld: out => out.copy(points.head),
    bodyCapsule: (rear, front) => { rear.copy(points.rear); front.copy(points.front); },
    foreCapsule: (left, right) => { left.copy(points.left); right.copy(points.right); return true; } };
}
const targetQueries = createNativeTargetQueries<AnimalSim>({ pose: published });
/** Same bounded ray/nearest-volume law, reading published contacts in roster order. */
export const nativeRangedHit = targetQueries.ray;
type BodyHit = NonNullable<ReturnType<typeof nativeRangedHit>>;
const capRear = new Vector3(), capFront = new Vector3();
function hasRibs(body: AnimalSim): body is AnimalSim & { ribsWorld: (out: Vector3) => Vector3 } {
  return 'ribsWorld' in body && typeof body.ribsWorld === 'function';
}
/** Aim at a capsule share or its declared chest. The default keeps the original half-sum arithmetic. */
export function nativeRangedAim(host: SimHost, target: AnimalSim, eye: Vector3, forward: Vector3, along = 0.5, height = 1.68): void {
  const p = host.player.position; eye.set(p.x, p.y + height, p.z); target.bodyCapsule(capRear, capFront);
  if (along === 2 && hasRibs(target)) target.ribsWorld(forward);
  else if (along === 0.5) forward.addVectors(capRear, capFront).multiplyScalar(0.5);
  else forward.copy(capRear).lerp(capFront, along);
  forward.sub(eye).normalize();
}
type Policy = v.InferOutput<typeof NativeRangedRowSchema>;
const finite = v.pipe(v.number(), v.finite()), count = v.pipe(finite, v.integer(), v.minValue(0)), vec = v.tuple([finite, finite, finite]);
const queryBodies = new WeakMap<SimHost, AnimalSim[]>();
function bodies(host: SimHost): AnimalSim[] {
  let buffer = queryBodies.get(host); if (buffer === undefined) { buffer = []; queryBodies.set(host, buffer); }
  buffer.length = 0; for (const body of host.entities.values()) buffer.push(body); return buffer;
}
function windAt(frame: NativeCombatFrame, x: number, z: number, out: Vector3): Vector3 | null {
  const wind = frame.wind; if (wind === null) return null;
  const speed = wind.base + wind.scale * fieldGustAt(x, z, wind.clock.time, wind.clock.gust, wind.field);
  out.x = wind.field.x * speed; out.z = wind.field.z * speed; return out;
}

function boltItem(host: SimHost, frame: NativeCombatFrame, row: Policy, input: unknown) {
  const raw = parseNativeFirearmProfile(input, 'bolt'), projectile = raw.projectile;
  if (frame.ammo === '') frame.ammo = row.defaultAmmo;
  if (projectile.muzzle === undefined || raw.spreadAxisScale === undefined) throw new Error('Missing bolt launch');
  const p = { ...raw, quiver: raw.magazine + raw.reserve, cooldown: raw.interval, speed: projectile.speed, radius: projectile.radius, muzzle: projectile.muzzle, substeps: projectile.substeps, lifetime: projectile.lifetime, maxFlying: projectile.pool, gravity: projectile.flight.gravity, drag: projectile.flight.drag, spreadAxisScale: raw.spreadAxisScale }, random = (): number => host.rng.stream('gameplay').next(), player = host.player;
  const Saved = v.strictObject({ loaded: v.boolean(), quiver: finite, reloading: v.boolean(), reloadT: finite, cooldown: finite, sinceFire: finite,
  bolts: v.pipe(v.array(v.strictObject({ active: v.boolean(), pos: v.tuple([finite, finite, finite]), vel: v.tuple([finite, finite, finite]), age: finite, glanced: v.boolean(), ammo: v.optional(v.picklist(row.ammunition.map(ammo => ammo.id)), row.defaultAmmo) })),
    v.length(p.maxFlying)) });
  const cone = { radius: p.spreadRadius, axisScale: p.spreadAxisScale };
  const state = { loaded: true, quiver: p.quiver, reloading: false, reloadProgress: 0, ammo: undefined, reserve: 0,
    get bolts() { return this.quiver; }, set bolts(value: number) { this.quiver = value; } };
  const action = new RangedAction({ state }, { mode: 'quiver', maximum: p.quiver, interval: p.cooldown, reload: p.reload, autoReload: p.autoReload, autoFrom: 'shot' });

  const eye = new Vector3(), fwd = new Vector3(), side = new Vector3(), dir = new Vector3(), seg = new Vector3();
  // one request, refilled per hit (the pipeline copies the contact frame and the tags)
  const req: DamageRequest = { source: player.health, sourceTags: row.tags, target: player.health, amount: 0, point: new Vector3(), dir: seg, headshot: false };
  const contacts = new ProjectileContact<Bolt, BodyHit>({
    glance: { lift: row.glance.lift, keep: row.glance.keep, bounce: row.glance.bounce, maxSpeed: row.glance.maxSpeed },
    spentRest: 'upward', impactAfterLift: false, impactOnRepeatedGlance: false,
  }, {
    world: (from, to, radius) => worldHit(host.physics, from, to, radius),
    target: (from, direction, distance) => { const hit = nativeRangedHit(bodies(host), from, direction, distance); return hit?.body === null ? null : hit; },
    hit: (bolt, hit, direction) => {
      const body = hit.body; if (body === null) return;
      req.target = body.combatActor(); req.amount = body.damageFor(hit.head, hit.point.distanceTo(player.position)) * ammoDamage(row, bolt.ammo, body.kind) * p.damageScale;
      req.point.copy(hit.point); req.dir.copy(direction); req.headshot = hit.head;
      host.combat.hit(req);
    },
    stop: () => { /* native bolts have no stopped display */ }, rest: () => { /* the spent flight ends here */ },
    impact: () => { /* page-only dust and sound */ }, expire: bolt => { bolt.active = false; },
  });
  const pool = new ProjectileSlots<{ ammo: string }>(p.maxFlying, () => ({ ammo: row.defaultAmmo }), {
    substeps: p.substeps, extent: row.extent, floor: row.floor, lifetime: p.lifetime,
    integrate: (slot, h) => { const mod = ammoFlight(row, slot.ammo, frame.rain);
      slot.vel.y -= p.gravity * mod.gravity * h;
      slot.vel.multiplyScalar(1 - p.drag * mod.drag * h * slot.vel.length() * 0.1);
      slot.pos.addScaledVector(slot.vel, h); },
    contact: (bolt, previous) => contacts.step(bolt, previous, p.radius, 0),
  });
  const bolts = pool.slots;
  const fire = (target: AnimalSim): void => {
    action.shot();
    nativeRangedAim(host, target, eye, fwd, frame.aim, row.eye);
    // the page's hip spread: a random axis across the line, a random fraction of 0.75°
    const spread = (p.spreadAds + (1 - smoothstep(0, 1, frame.adsBlend)) * (p.spreadHip - p.spreadAds)) * (Math.PI / 180);
    dir.copy(fwd);
    shotSpread(dir, spread, random, cone, side);
    const b = pool.take(); b.ammo = frame.ammo;
    b.pos.copy(eye).addScaledVector(fwd, p.muzzle); b.vel.copy(dir).multiplyScalar(p.speed);
  };
  host.onStep(row.step, dt => {
    const shots = frame.live.has(row.slot) ? frame.attacks : [];
    for (let i = 0; i < 1024; i++) {
      const id = shots[i];
      if (id === undefined) break;
      const target = host.entities.get(id);
      if (target !== undefined && action.trigger()) fire(target);
    }
    action.advance(dt);
    pool.step(dt);
  }, {
    snapshot: () => ({ loaded: state.loaded, quiver: state.quiver, reloading: state.reloading, ...action.snapshot(), bolts: bolts.map(b => ({ active: b.active, pos: [b.pos.x, b.pos.y, b.pos.z], vel: [b.vel.x, b.vel.y, b.vel.z], age: b.age, glanced: b.glanced, ...(b.ammo === row.defaultAmmo ? {} : { ammo: b.ammo }) })) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      Object.assign(state, { loaded: saved.loaded, quiver: saved.quiver, reloading: saved.reloading }); action.restore(saved);
      saved.bolts.forEach((s, i) => { const b = bolts[i]; if (b !== undefined) { b.active = s.active; b.pos.set(...s.pos); b.vel.set(...s.vel); b.age = s.age; b.glanced = s.glanced; b.ammo = s.ammo; } });
    },
  }, 'afterBodies');
  return { state, flying: () => bolts.filter(b => b.active).length, addBolts: (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid native bolt grant');
    state.quiver = Math.min(p.quiver, state.quiver + amount);
  } };
}

function cycleItem(host: SimHost, frame: NativeCombatFrame, row: Policy, input: unknown): NativeCycleItem {
  const profile = parseNativeFirearmProfile(input, 'lever');
  if (profile.lever === undefined) throw new Error('Missing cycle profile');
  const Saved = v.strictObject({ tube: v.pipe(count, v.maxValue(profile.magazine - 1)), chambered: v.boolean(), caseInChamber: v.boolean(), hammerCocked: v.boolean(),
  phase: v.picklist(['idle', 'beat', 'cycle', 'reload']), phaseT: finite, fed: count, planned: count, stopAfter: v.boolean(), dryAtStart: v.boolean(),
  reloadProgress: finite, reserve: count, sinceEmpty: finite });
  const random = (): number => host.rng.stream('gameplay').next(), player = host.player;
  const store = { reserve: profile.reserve }, act = new RangedAction.Cycle(store, { magazine: profile.magazine, reload: profile.reload, ...profile.lever });
  const cone = { radius: profile.spreadRadius, axisScale: 1 } as const;
  let sinceEmpty = 99;
  const eye = new Vector3(), dir = new Vector3(), across = new Vector3(), end = new Vector3();
  const req: DamageRequest = { source: player.health, sourceTags: row.tags, target: player.health, amount: 0, point: new Vector3(), dir, headshot: false };
  const hitscan = (target: AnimalSim): void => {
    nativeRangedAim(host, target, eye, dir, frame.aim, row.eye);
    const a = smoothstep(0, 1, frame.adsBlend);
    const spread = instantSpreadDegrees(profile.spreadAds, profile.spreadHip, a, 0,
      motion(frame), profile.movingSpread, profile.movingAimReduction) * (Math.PI / 180);
    shotSpread(dir, spread, random, cone, across);
    const wall = worldHit(host.physics, eye, end.copy(eye).addScaledVector(dir, profile.range), 0);
    const hit = nativeRangedHit(bodies(host), eye, dir, wall ? wall.distance : profile.range), body = hit?.body ?? null;
    if (hit === null || body === null) return;
    req.target = body.combatActor(); req.amount = body.damageFor(hit.head, hit.distance) * profile.damageScale;
    req.point.copy(hit.point); req.headshot = hit.head;
    host.combat.hit(req);
  };
  const pull = (target: AnimalSim): void => {
    if (act.phase === 'reload') { act.triggerWhileReloading(); return; }
    if (act.phase !== 'idle') return;
    if (!act.chambered) { sinceEmpty = 0; if (act.tube > 0) act.throwLever(); else act.beginReload(); return; }
    act.dropHammer();
    hitscan(target);
  };
  host.onStep(row.step, dt => {
    const live = frame.live.has(row.slot), shots = live ? frame.attacks : [];
    for (let i = 0; i < 1024; i++) {
      const id = shots[i];
      if (id === undefined) break;
      const target = host.entities.get(id);
      if (target !== undefined) pull(target);
    }
    sinceEmpty += dt;
    for (const _event of act.events(dt, act.wantsAutoReload && sinceEmpty > profile.autoReload && sinceEmpty < (profile.lever?.autoReloadClose ?? 0) && frame.live.has(row.slot))) { /* Native effects have no presentation. */ }
  }, {
    snapshot: () => ({ tube: act.tube, chambered: act.chambered, caseInChamber: act.caseInChamber, hammerCocked: act.hammerCocked, phase: act.phase, phaseT: act.phaseT,
      fed: act.fed, planned: act.planned, stopAfter: act.stopAfter, dryAtStart: act.dryAtStart, reloadProgress: act.reloadProgress, reserve: store.reserve, sinceEmpty }),
    restore: value => {
      const s = v.parse(Saved, value);
      Object.assign(act, { tube: s.tube, chambered: s.chambered, caseInChamber: s.caseInChamber, hammerCocked: s.hammerCocked, phase: s.phase, phaseT: s.phaseT,
        fed: s.fed, planned: s.planned, stopAfter: s.stopAfter, dryAtStart: s.dryAtStart, reloadProgress: s.reloadProgress });
      store.reserve = s.reserve; sinceEmpty = s.sinceEmpty;
    },
  }, 'afterBodies');
  return { act, store };
}

const bowSaved = (profile: v.InferOutput<typeof BowWeaponProfileSchema>, capacity: number) => v.strictObject({
  draw: v.strictObject({ drawT: finite, holdT: finite, renockT: finite, tiredT: finite, wasHeld: v.boolean(), needLift: v.boolean(), reachedFull: v.boolean() }),
  arrows: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(profile.quiver)), aim: v.nullable(v.string()),
  flying: v.pipe(v.array(v.strictObject({ active: v.boolean(), pos: vec, vel: vec, origin: vec, age: finite, glanced: v.boolean() })), v.length(profile.pool)),
  stuck: stoppedProjectileSaved(capacity),
});

function bowItem(host: SimHost, frame: NativeCombatFrame, row: Policy, input: unknown) {
  const profile = v.parse(BowWeaponProfileSchema, input);
  if (row.shaft === undefined) throw new Error('Missing stopped projectile policy');
  const shaft = row.shaft;
  const random = (): number => host.rng.stream('gameplay').next(), player = host.player;
  const draw = new BowDraw(profile.draw), state: { arrows: number; aim: string | null } = { arrows: profile.quiver, aim: null };

  const eye = new Vector3(), dir = new Vector3(), across = new Vector3(), seg = new Vector3(), wind = new Vector3();
  const stuck = new StoppedProjectileSlots<null, string>({ ...shaft, radius: row.radius }, { feet: player.position,
    floorAt: (x, y, z) => floorBelow(host.physics, x, z, y + 0.3, 60) ?? host.groundHeightAt(x, z),
    body: id => host.entities.get(id), canRecover: () => state.arrows < profile.quiver,
    recover: survived => { if (survived) state.arrows = Math.min(profile.quiver, state.arrows + 1); }, random }, () => null);
  const req: DamageRequest = { source: player.health, sourceTags: row.tags, target: player.health, amount: 0, point: new Vector3(), dir: seg, headshot: false };
  const contacts = new ProjectileContact<Arrow, BodyHit>({
    glance: row.glance, spentRest: 'any', impactAfterLift: false, impactOnRepeatedGlance: false,
  }, {
    world: (from, to, radius) => worldHit(host.physics, from, to, radius),
    target: (from, direction, distance) => { const hit = nativeRangedHit(bodies(host), from, direction, distance); return hit?.body === null ? null : hit; },
    hit: (arrow, hit, direction) => {
      const body = hit.body; if (body === null) return;
      req.target = body.combatActor(); req.amount = Math.max(1, Math.round(body.damageFor(hit.head, hit.point.distanceTo(arrow.origin)) * profile.damageScale));
      req.point.copy(hit.point); req.dir.copy(direction); req.headshot = hit.head;
      host.combat.hit(req);
      stuck.stop(hit.point, direction, true, body.alive ? body.entityId : null);
      if (!body.alive) stuck.dropLast();
    },
    stop: (_arrow, at, direction) => { stuck.stop(at, direction, false, null); },
    rest: (_arrow, at, direction) => { stuck.settle(at, direction); },
    impact: () => { /* native contacts have no dust or sound */ }, expire: arrow => { arrow.active = false; },
  });
  const pool = new ProjectileSlots<{ origin: Vector3 }>(profile.pool, () => ({ origin: new Vector3() }), {
    substeps: profile.substeps, extent: row.extent, floor: row.floor, lifetime: profile.lifetime,
    integrate: (slot, h) => { projectileFlightStep(slot.pos, slot.vel, h, profile.flight,
      windAt(frame, slot.pos.x, slot.pos.z, wind)); }, contact: (arrow, previous) => contacts.step(arrow, previous, row.radius, shaft.length),
  });
  const arrows = pool.slots;
  const loose = (): void => {
    const target = state.aim === null ? undefined : host.entities.get(state.aim);
    if (target?.alive === true) nativeRangedAim(host, target, eye, dir, frame.aim, row.eye);
    else { const p = player.position; eye.set(p.x, p.y + row.eye, p.z); dir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }
    const spread = drawnSpreadDegrees(profile.spread.degrees, profile.spread.aimMultiplier, frame.aimed, profile.spread.motion,
      motion(frame), frame.extraSpread, frame.mountSpread);
    shotSpread(dir, spread * (Math.PI / 180), random, profile.spread, across);
    const a = pool.take();
    a.pos.copy(eye).addScaledVector(dir, profile.muzzle); a.origin.copy(a.pos); a.vel.copy(dir).multiplyScalar(profile.speedBase + profile.speedDraw);
    state.arrows--;
  };
  host.onStep(row.step, dt => {
    const live = frame.live.has(row.slot), heavy = live ? frame.heavy : null;
    // the hold's named body is the aim the release looses at (a release tick has no hold to name it)
    if (heavy !== null) state.aim = heavy.targetId ?? null;
    if (draw.step(dt, heavy !== null, !live || state.arrows <= 0) === 'loose') loose();
    pool.step(dt);
    stuck.update();
  }, {
    snapshot: () => ({ draw: { ...draw.save() }, arrows: state.arrows, aim: state.aim,
      flying: arrows.map(a => ({ active: a.active, pos: [a.pos.x, a.pos.y, a.pos.z], vel: [a.vel.x, a.vel.y, a.vel.z], origin: [a.origin.x, a.origin.y, a.origin.z], age: a.age, glanced: a.glanced })), stuck: stuck.snapshot(id => id) }),
    restore: value => {
      const saved = v.parse(bowSaved(profile, shaft.capacity), value);
      draw.load(saved.draw); state.arrows = saved.arrows; state.aim = saved.aim;
      stuck.restore(saved.stuck, id => id);
      saved.flying.forEach((s, i) => { const a = arrows[i]; if (a !== undefined) { a.active = s.active; a.pos.set(...s.pos); a.vel.set(...s.vel); a.origin.set(...s.origin); a.age = s.age; a.glanced = s.glanced; } });
    },
  }, 'afterBodies');
  return { draw, state, flying: () => arrows.filter(a => a.active).length, stuck };
}


type Bolt = FlightSlot<{ ammo: string }>;
type Arrow = FlightSlot<{ origin: Vector3 }>;
function ammoRow(row: Policy, id: string): Policy['ammunition'][number] {
  const ammo = row.ammunition.find(candidate => candidate.id === id);
  if (ammo === undefined) throw new Error('Undeclared native ammunition');
  return ammo;
}
function ammoFlight(row: Policy, id: string, rain: number): { gravity: number; drag: number } {
  const ammo = ammoRow(row,id);return wetFlight(ammo.flight,ammo.wet,rain);
}
function ammoDamage(row: Policy, id: string, kind: string): number {
  const ammo = ammoRow(row, id); return ammo.targets.includes(kind) ? ammo.damage : 1;
}
/** Existing detached native item handles; their legacy save owners remain independent. */
export type NativeBoltItem = ReturnType<typeof boltItem>;
export interface NativeCycleItem { readonly act: InstanceType<typeof RangedAction.Cycle>; readonly store: { reserve: number } }
export type NativeBowItem = ReturnType<typeof bowItem>;
/** Data-only installation onto the existing native host. Ranged policies retain the legacy independent save owners;
 * swept policies consume the same frame and synchronously ask the world's existing reaction owner. */
export function installNativeItems(host: SimHost, frame: NativeCombatFrame, row: { readonly kind: 'bolt'; readonly policy: unknown; readonly profile: unknown }): NativeBoltItem;
export function installNativeItems(host: SimHost, frame: NativeCombatFrame, row: { readonly kind: 'cycle'; readonly policy: unknown; readonly profile: unknown }): NativeCycleItem;
export function installNativeItems(host: SimHost, frame: NativeCombatFrame, row: { readonly kind: 'bow'; readonly policy: unknown; readonly profile: unknown }): NativeBowItem;
export function installNativeItems(host: SimHost, frame: NativeCombatFrame, row: { readonly kind: 'swept'; readonly policy: unknown; readonly items: readonly unknown[] }): NativeSweptMeleeOwner;
export function installNativeItems(host: SimHost, frame: NativeCombatFrame, input:
  { readonly kind: 'bolt' | 'cycle' | 'bow'; readonly policy: unknown; readonly profile: unknown } |
  { readonly kind: 'swept'; readonly policy: unknown; readonly items: readonly unknown[] }): NativeBoltItem | NativeCycleItem | NativeBowItem | NativeSweptMeleeOwner {
  if (input.kind === 'swept') return installNativeMelee(host, input.items, input.policy, {
    input: (): NativeSweptMeleeInput => frame.melee,
    alarm: () => { host.events.ask('item.reaction', { kind: 'alarm' }); },
    staggered: (actor, strength, running) => { host.events.ask('item.reaction', { kind: 'stagger', actor, strength, running }); },
  });
  const row = v.parse(NativeRangedRowSchema, input.policy);
  if (input.kind === 'bow') return bowItem(host, frame, row, input.profile);
  if (input.kind === 'cycle') return cycleItem(host, frame, row, input.profile);
  return boltItem(host, frame, row, input.profile);
}

/** Resolve admitted equipment metadata without factories, callbacks or a second state owner.
 * Native constructors keep their profile and pickup service; this supplies only portable presentation. */
export function readItemEquipment(input: unknown, id: string): EquipmentRow {
  const item = parseItems(input).rows.find(row => row.id === id);
  if (item?.kind !== 'weapon' || item.equipment === undefined) throw new Error(`Missing declared equipment presentation: ${id}`);
  const { id: equipmentId, cues, ...presentation } = item.equipment;
  const cueId = (value: string): `cue.${string}` => `cue.${value.slice(4)}`;
  return { ...presentation, id: `weapon.${equipmentId.slice(7)}`,
    ...(cues === undefined ? {} : { cues: { fire: cueId(cues.fire), reload: cueId(cues.reload), impact: cueId(cues.impact),
      ...(cues.dry === undefined ? {} : { dry: cueId(cues.dry) }), ...(cues.hit === undefined ? {} : { hit: cueId(cues.hit) }),
      ...(cues.heavy === undefined ? {} : { heavy: cueId(cues.heavy) }),
      ...(cues.charge === undefined ? {} : { charge: Object.fromEntries(Object.entries(cues.charge).map(([phase, value]) => [phase, cueId(value)])) }) } }) };
}

/** Page ammunition borrows the same admitted flight/target coefficients as native projectiles.
 * The returned rows retain the weather convention (absolute wet multipliers) and carry no effects or clocks. */
export function readItemAmmunition(input: unknown, id: string): ReadonlyMap<string, { row: AmmoRow; damage: { readonly default: number; readonly kinds: Readonly<Record<string, number>> } }> {
  const item = parseItems(input).rows.find(row => row.id === id);
  if (item?.kind !== 'weapon' || item.ranged === undefined) throw new Error('Missing declared ammunition');
  return new Map(item.ranged.ammunition.map(ammo => {
    if (ammo.presentation === undefined) throw new Error('Missing declared ammunition presentation');
    const ammoId = `ammo.${ammo.id}` as const;
    return [ammo.id, { row: { id: ammoId, ...ammo.presentation, flight: { ...ammo.flight }, tags: [ammoId],
      ...(ammo.wet === undefined ? {} : { wet: { gravity: 1 + ammo.wet.gravity, drag: 1 + ammo.wet.drag } }) },
    damage: { default: 1, kinds: Object.fromEntries(ammo.targets.map(kind => [kind, ammo.damage])) } }];
  }));
}

/** Read the admitted saved-pack policy; NativeInventory remains the only stacking/trade state owner. */
export function readItemInventory(input: unknown): NonNullable<ReturnType<typeof parseItems>['loadout']['inventory']> {
  const profile = parseItems(input).loadout.inventory;
  if (profile === undefined) throw new Error('Missing declared inventory policy');
  return profile;
}
