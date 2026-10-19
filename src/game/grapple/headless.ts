import type { GrappleMode } from '@wildshard/format/modes';
import type { GrappleProfile } from '@wildshard/format/grapple';
import type { SimHost } from '@wildshard/engine/sim';
import { type GrappleBody, type GrapplePorts, GrappleSim, type GrappleView } from './sim';
import * as v from 'valibot';
import { PerspectiveCamera, Vector3 } from 'three';
import { fovForAspect } from '@wildshard/engine/combat/blocks/melee';
import { grappleCourse } from './course';

/** Standard tick services; content supplies profile rows, never authored handlers. */
export interface GrappleTickContext {
  commands: () => readonly ({ readonly kind: 'script'; readonly actorId: string; readonly value: number } | { readonly kind: string; readonly jump?: boolean })[];
  emit: (effect: { readonly kind: 'fact'; readonly name: string; readonly actorId: string }) => void;
}
const finite = v.pipe(v.number(), v.finite());
const Xyz = v.strictObject({ x: finite, y: finite, z: finite });
const Phase = v.picklist(['idle', 'fire', 'bite', 'lift', 'zip', 'vault', 'settle', 'miss', 'reel', 'dock']);
const Saved = v.strictObject({
  pitch: finite, last: Xyz, fall: v.strictObject({ vy: finite, grounded: v.boolean() }), velocity: Xyz, guard: v.array(finite),
  sim: v.strictObject({ phase: Phase, armedMiss: v.boolean(), clock: finite, blocked: finite, liftY: finite, missEnd: Xyz,
    target: v.nullable(v.strictObject({ hook: Xyz, landing: Xyz, approach: Xyz, lifts: v.boolean() })) }),
});

/** Install traversal on the server's actual player motor and tick boundary. */
export function installGrapple(host: SimHost, context: GrappleTickContext, profile: GrappleProfile, mode: GrappleMode, hooks: readonly { readonly x: number; readonly y: number; readonly z: number }[], guardHandles: readonly number[]): { readonly sim: GrappleSim; readonly guardOpen: () => boolean } {
  const state = { pitch: 0, last: host.player.position.clone(), fall: { vy: host.playerFall.vy, grounded: host.playerFall.grounded }, guard: [...guardHandles] };
  const velocity = new Vector3();
  const body: GrappleBody = {
    get position() { return host.player.position; },
    velocity,
    get onGround() { return host.playerFall.grounded; },
    set onGround(on) { host.playerFall.grounded = on; },
    // the motor is read each time: a restore rebuilds the player's motor on the restored physics after install
    get motor() { return host.player.motor; },
  };
  const ports: GrapplePorts = { get physics() { return host.physics; }, body };
  const camera = new PerspectiveCamera(fovForAspect(profile.headless.portraitFov, profile.headless.aspect), profile.headless.aspect, 0.08, 2600);
  const view: GrappleView = {
    eye: camera.position,
    update: () => {
      const p = host.player.position;
      camera.position.set(p.x, p.y + profile.headless.eye, p.z);
      camera.rotation.set(state.pitch, host.player.yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
    },
    project: (point, out) => out.copy(point).project(camera),
    forward: (out) => camera.getWorldDirection(out),
  };
  const setGuard = (open: boolean): void => {
    state.guard.forEach(handle => { host.physics.world.getCollider(handle).setEnabled(!open); });
  };
  const sim = new GrappleSim(ports, grappleCourse({ ...profile.course, mode, hooks }));
  const moved = new Vector3(), walked = { vy: 0, grounded: true }, tick: { lock: boolean; jump: boolean; pitch: number | undefined } = { lock: false, jump: false, pitch: undefined };
  host.onStep(profile.headless.step, (dt) => {
    tick.lock = false; tick.jump = false; tick.pitch = undefined;
    for (const command of context.commands()) {
      if ('jump' in command && command.kind === 'player' && command.jump) tick.jump = true;
      if ('actorId' in command) {
        if (command.actorId === profile.headless.lock) tick.lock = true;
        if (command.actorId === profile.headless.aim) tick.pitch = command.value;
      }
    }
    if (tick.pitch !== undefined) state.pitch = tick.pitch;
    view.update?.();
    // no lock-on headless (SimHost has none), so an empty LOCK arms the miss shot as the page's does with no enemy locked
    if (tick.lock) sim.lock(view, null, false);
    const fired = tick.jump && sim.fire(view);
    setGuard(sim.guardOpen());
    if (fired || sim.phase !== 'idle') {
      // the grapple answers before the walk: run it from where the tick began, and keep the walk only if it declines
      const p = host.player.position, fall = host.playerFall;
      moved.copy(p); walked.vy = fall.vy; walked.grounded = fall.grounded;
      p.copy(state.last); fall.vy = state.fall.vy; fall.grounded = state.fall.grounded;
      velocity.set(0, fall.vy, 0);
      const settling = sim.phase === 'settle' && sim.target?.lifts === true;
      if (sim.traverse(dt)) fall.vy = velocity.y;
      else { p.copy(moved); fall.vy = walked.vy; fall.grounded = walked.grounded; }
      if (settling && sim.phase === 'idle' && profile.fact !== undefined) context.emit({ kind: 'fact', name: profile.fact.name, actorId: profile.fact.entity });
    }
    setGuard(sim.guardOpen()); sim.drainEvents();
    const p = host.player.position;
    state.last.set(p.x, p.y, p.z); state.fall.vy = host.playerFall.vy; state.fall.grounded = host.playerFall.grounded;
  }, { snapshot: () => JSON.stringify({ ...state, velocity: { x: velocity.x, y: velocity.y, z: velocity.z }, sim: sim.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error('Invalid grapple continuation');
    const saved = v.parse(Saved, JSON.parse(value));
    state.pitch = saved.pitch; state.last.set(saved.last.x, saved.last.y, saved.last.z); state.fall = { ...saved.fall }; state.guard = saved.guard;
    velocity.set(saved.velocity.x, saved.velocity.y, saved.velocity.z);
    sim.restore(saved.sim);
  } });
  return { sim, guardOpen: () => sim.guardOpen() };
}
