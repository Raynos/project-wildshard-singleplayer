// @vitest-environment happy-dom
import { Vector3 } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- WHIP_PARITY_RECORD=1 re-pins the trace from a base tree.
import { writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hashes the lash's laid geometry each frame against the pinned one.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- the record switch is a test-runner environment value, not game configuration.
import process from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { Scope } from '../../../src/engine/app/scope';
import type { Actor, CombatTarget } from '../../../src/engine/combat/pipeline';
import type { TargetAnimal, TargetHit } from '../../../src/engine/combat/types';
import type { EquipmentHost } from '../../../src/engine/combat/view/EquipmentHost';
import type { AimCommand } from '../../../src/engine/input/commands';
import type { Player } from '../../../src/engine/player/Player';
import { Bullwhip } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { FakeGame, legacyDouble } from '../../fake/FakeGame';
import expected from './whip-parity.json' with { type: 'json' };

/** One creature in the probe: a ball the shared raycast meets (or not), its feet, its health and its reactions. */
interface Body { id: string; at: Vector3; radius: number; hp: number; ray: boolean }
/** One world thing the lash can crack: where, how wide, what it answers. */
interface World { id: string; at: Vector3; radius: number; answer: (heavy: boolean, second: boolean) => boolean }
/** One probe case: who stands where, and what the player does frame by frame. */
interface Case { name: string; bodies: Body[]; world?: World[]; frames: { dt: number; act?: 'attack' | 'heavy' | 'hold' | 'release' | 'holster' | 'draw' | 'disable' | 'enable' | { yaw: number } }[] }

// The pinned JSON wire trace canonically records both signed zeroes as 0.
const round = (n: number): number => Math.round(n * 1e6) / 1e6 || 0;
const vec = (v: Vector3): number[] => [round(v.x), round(v.y), round(v.z)];
/** The laid lash's positions as one hash (its view each frame: where the cord lies). */
const laid = (a: { readonly array: ArrayLike<number> }): string => createHash('sha256').update(new Uint8Array(Float32Array.from(a.array).buffer)).digest('hex').slice(0, 16);
const frames = (n: number, dt = 1 / 60): Case['frames'] => Array.from({ length: n }, () => ({ dt }));

/**
 * Drives the browser Bullwhip through one case on a fake equipment host and records everything it does: swings, hits
 * (actor, amount, move, point), yanks, staggers, world cracks, fire / hit callbacks and, every frame, the lash's view
 * (visible, grip offset) and whether a wrap coil shows. The trace is pinned from the pre-refactor Bullwhip (SF72 part 2):
 * moving the crack onto the shared lash runtime must leave the browser whip byte-identical.
 */
function run(c: Case): unknown[] {
  const trace: unknown[] = [], app = new App(), scope = new Scope(`whip-parity-${c.name}`), fake = new FakeGame();
  app.levelScope = scope; app.setState('play');
  const aim = { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
  const game = fake.asGame();
  const host: EquipmentHost = { game, physics: legacyDouble({}), viewmodel: fake.viewmodel, player: legacyDouble<Player>({ sampleAimCommand: (): AimCommand => ({ origin: { ...aim.origin }, direction: { ...aim.direction } }) }),
    arms: null, lock: legacyDouble({}), toast: () => undefined, enabled: () => true };
  app.registerEquipmentHost(host, scope);
  const ports: CombatTarget[] = c.bodies.map(body => {
    let alive = true;
    const actor: Actor = { id: body.id, tags: ['actor.creature'], state: [], attributes: { health: body.hp, maxHealth: body.hp }, get alive() { return alive; },
      applyDamage: req => { trace.push(['damage', body.id, req.amount, req.moveId ?? null, vec(req.point), vec(req.dir), req.weaponId ?? null, req.source === 'env' ? 'env' : req.source.id, [...req.sourceTags], req.surface ?? null]); actor.attributes.health -= req.amount; if (actor.attributes.health <= 0) { alive = false; return true; } return false; } };
    const animal: TargetAnimal = { kind: 'probe', position: body.at, get alive() { return actor.alive; }, applyDamage: () => false, damageFor: () => 0,
      stagger: (dir, strength) => { trace.push(['stagger', body.id, vec(dir), strength]); } };
    return app.combat.targetPort(actor, animal, velocity => { trace.push(['impulse', body.id, vec(velocity)]); });
  });
  app.combat.registerTargets(scope, () => ports);
  const raycast = (origin: Vector3, dir: Vector3, maxDist: number): TargetHit | null => {
    let best: TargetHit | null = null;
    c.bodies.forEach((body, i) => {
      const port = ports[i]; if (!body.ray || port === undefined || !port.actor.alive) return;
      const oc = origin.clone().sub(body.at), b = oc.dot(dir), h = b * b - (oc.lengthSq() - body.radius ** 2);
      if (h < 0) return; const t = -b - Math.sqrt(h);
      if (t < 0 || t > maxDist || (best !== null && t >= best.distance)) return;
      best = { animal: port.target, point: origin.clone().addScaledVector(dir, t), distance: t, headshot: false };
    });
    return best;
  };
  const whip = new Bullwhip(app, { raycast });
  whip.onSwing = heavy => { trace.push(['swing', heavy]); };
  whip.onFire = () => { trace.push(['fire']); };
  whip.onHit = (id, headshot, killed) => { trace.push(['hit', id, headshot, killed]); };
  whip.aimAt((c.world ?? []).map(w => ({ at: w.at, radius: w.radius, crack: (heavy: boolean, second: boolean) => { const r = w.answer(heavy, second); trace.push(['crack', w.id, heavy, second, r]); return r; } })));
  whip.install({ scope });
  try {
    c.frames.forEach((frame, i) => {
      const act = frame.act;
      if (act === 'attack' || act === 'heavy') app.input.press(act);
      else if (act === 'hold') whip.adsHeld = true;
      else if (act === 'release') whip.adsHeld = false;
      else if (act === 'holster') whip.holster = 1;
      else if (act === 'draw') whip.holster = 0;
      else if (act === 'disable') whip.enabled = false;
      else if (act === 'enable') whip.enabled = true;
      else if (act !== undefined) { aim.direction = { x: -Math.sin(act.yaw), y: 0, z: -Math.cos(act.yaw) }; }
      whip.update(frame.dt);
      const { lash, grip } = whip.parts, coil = game.scene.children.find(child => child.type === 'Mesh');
      trace.push(['frame', i, lash.mesh.visible, vec(grip.position), coil?.visible ?? null, round(whip.charge)]);
      // the item view: the model's hold and spring, the laid cord, the wrap coil's place
      trace.push(['view', vec(whip.model.position), round(whip.model.rotation.y), whip.model.visible, lash.mesh.visible ? laid(lash.mesh.geometry.getAttribute('position')) : null, coil === undefined ? null : vec(coil.position)]);
    });
  } finally { scope.dispose(); app.engineScope.dispose(); }
  return trace;
}

const small = (z: number, ray = true, hp = 30): Body => ({ id: 'small', at: new Vector3(0, 1.2, z), radius: 0.5, hp, ray });
const big = (z: number): Body => ({ id: 'big', at: new Vector3(0, 1.2, z), radius: 1.2, hp: 120, ray: true });
const CASES: Case[] = [
  { name: 'light-raycast', bodies: [small(-5)], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(40)] },
  { name: 'light-lane', bodies: [{ id: 'lane', at: new Vector3(0.6, 0.8, -6), radius: 0.3, hp: 50, ray: false }], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(40)] },
  { name: 'light-out-of-reach', bodies: [small(-9)], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(40)] },
  { name: 'cooldown', bodies: [small(-4, true, 200)], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(10), { dt: 1 / 60, act: 'attack' }, ...frames(30), { dt: 1 / 60, act: 'attack' }, ...frames(40)] },
  { name: 'variable-dt', bodies: [small(-5, true, 200)], frames: [{ dt: 1 / 30, act: 'heavy' }, ...frames(8, 1 / 30), { dt: 0.05 }, ...frames(12, 1 / 24)] },
  { name: 'charge-release', bodies: [small(-5, true, 200)], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(5), { dt: 1 / 60, act: 'hold' }, ...frames(20), { dt: 1 / 60, act: 'release' }, ...frames(50)] },
  { name: 'holster-drops-charge', bodies: [small(-5)], frames: [{ dt: 1 / 60, act: 'hold' }, ...frames(40), { dt: 1 / 60, act: 'holster' }, { dt: 1 / 60, act: 'draw' }, { dt: 1 / 60, act: 'release' }, ...frames(30)] },
  { name: 'world-brazier', bodies: [], world: [{ id: 'brazier', at: new Vector3(0.5, 2.3, -6), radius: 1.2, answer: () => true }], frames: [{ dt: 1 / 60, act: 'attack' }, ...frames(40)] },
  { name: 'disabled-in-flight', bodies: [small(-5, true, 200)], frames: [{ dt: 1 / 60, act: 'attack' }, { dt: 1 / 60, act: 'disable' }, ...frames(30), { dt: 1 / 60, act: 'attack' }, ...frames(10), { dt: 1 / 60, act: 'enable' }, { dt: 1 / 60, act: 'attack' }, ...frames(30)] },
  // the second lash and the pull (the coordinator's added cases)
  { name: 'heavy-pull-small', bodies: [small(-6, true, 35)], frames: [{ dt: 1 / 60, act: 'heavy' }, ...frames(60)] },
  { name: 'heavy-second-staggers-big', bodies: [big(-6)], frames: [{ dt: 1 / 60, act: 'heavy' }, ...frames(60)] },
  { name: 'heavy-kills-no-pull', bodies: [small(-6, true, 10)], frames: [{ dt: 1 / 60, act: 'heavy' }, ...frames(60)] },
  { name: 'heavy-crank-wrap', bodies: [], world: [{ id: 'crank', at: new Vector3(0, 1.4, -5), radius: 0.8, answer: (heavy, second) => heavy && (second || true) }], frames: [{ dt: 1 / 60, act: 'heavy' }, ...frames(30), { dt: 1 / 60, act: { yaw: 0.6 } }, ...frames(60)] },
];

const recorded: Record<string, unknown> = {};

describe('the browser Bullwhip is byte-identical on the shared lash runtime', () => {
  it.each(CASES.map(c => [c.name, c] as const))('%s', (name, c) => {
    const trace = run(c);
    if (process.env['WHIP_PARITY_RECORD'] === '1') { recorded[name] = trace; return; }
    expect(structuredClone(trace)).toEqual(Object.entries(expected).find(([key]) => key === name)?.[1]);
  });
  afterAll(() => { if (process.env['WHIP_PARITY_RECORD'] === '1') writeFileSync('test/shards/sunscar-dunes/whip-parity.json', `${JSON.stringify(recorded)}\n`); });
});
