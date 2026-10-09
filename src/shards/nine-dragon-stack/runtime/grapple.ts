import * as v from 'valibot';
import { PerspectiveCamera, Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { fovForAspect } from '@wildshard/engine/combat/blocks/melee';
import type { GrappleBody, GrapplePorts } from '../grapple/course';
import { GrappleSim, type GrappleView, wellCourse } from '../grapple/sim';
import { traverseFeats, type NineFacts } from '../world/feats';

/** The Fei Zhua's fixed-step adapter id. */
export const GRAPPLE_STEP = 'nine-dragon-stack.fei-zhua';
/** The script command actors: the LOCK press (any value) and the aim's pitch (value: radians, held until the next). */
export const GRAPPLE_LOCK = 'nine-dragon-stack.fei-zhua.lock';
export const GRAPPLE_AIM = 'nine-dragon-stack.fei-zhua.aim';
/** The client Player's eye over the feet (Player.ts EYE) and the phone's portrait view: Nine's portrait FOV (manifest.ts
 *  `camera.portraitFov`, Hor+ on the iPhone 16 Pro's 402 × 874 CSS px). */
const EYE = 1.68, ASPECT = 402 / 874, PORTRAIT_FOV = 78;
/** The Well's south rim line (world/well-plan.ts `RIM.z0`; that module is renderer-bound, a test holds the two equal). */
export const RIM_Z = 11.2;

/** One tick's grapple input, filled by the caller: the LOCK press, the JUMP press, and the aim's pitch when the commands set it. */
export interface GrappleInput { lock: boolean; jump: boolean; pitch: number | undefined }
/** The Fei Zhua in the host: its law, and whether the Well's safety cap stands open. */
export interface NineGrapple { readonly sim: GrappleSim; readonly guardOpen: () => boolean }

const finite = v.pipe(v.number(), v.finite());
const Xyz = v.strictObject({ x: finite, y: finite, z: finite });
const Phase = v.picklist(['idle', 'fire', 'bite', 'lift', 'zip', 'vault', 'settle', 'miss', 'reel', 'dock']);
const Saved = v.strictObject({
  pitch: finite, last: Xyz, fall: v.strictObject({ vy: finite, grounded: v.boolean() }), velocity: Xyz, guard: v.array(finite),
  sim: v.strictObject({ phase: Phase, armedMiss: v.boolean(), clock: finite, blocked: finite, liftY: finite, missEnd: Xyz,
    target: v.nullable(v.strictObject({ hook: Xyz, landing: Xyz, approach: Xyz, lifts: v.boolean() })) }),
});

/**
 * Nine Dragon's Fei Zhua in the renderer-free host (SF72): the page's own law (grapple/sim.ts `GrappleSim` over
 * `wellCourse`: the reach / sight / landing test, the lift over the Well's parapet, the pull, vault and settle) on the
 * host's physics and player capsule. The input is the tick's: a LOCK script press, the player command's JUMP (the zip),
 * and the aim's pitch; the aim is the player's eye at the command's heading and that pitch, projected as the phone's
 * portrait camera, so the hook nearest the screen's centre is the one the claw takes, as on the page.
 *
 * The browser's traversal answer replaces the Player's walk for the tick; the host's fixed systems run after its walk, so
 * on a tick the grapple owns the body the walk is undone (the feet, fall speed and ground flag as the tick began; the
 * JUMP that fired the claw never lifts the player) before the law moves it. The safety cap (`guard`: the baked
 * `nds-grapple-guard` colliders) opens exactly while a lifting crossing is in flight, as the page's `NdRuntime.guardOpen`
 * makes its piece inactive. Nothing draws: rope, markers, cues and arms are the page's (FeiZhua.ts). The law's state,
 * the aim, the tick's start and the cap's handles are exact continuation. A lifting crossing that settles reports the
 * Well's fact (world/feats.ts) to `fact`.
 */
export function installNineGrapple(host: SimHost, hooks: readonly Vector3[], guardHandles: readonly number[], input: (into: GrappleInput) => void,
  fact: NineFacts = () => { /* no ledger */ }): NineGrapple {
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
  const camera = new PerspectiveCamera(fovForAspect(PORTRAIT_FOV, ASPECT), ASPECT, 0.08, 2600);
  const view: GrappleView = {
    eye: camera.position,
    update: () => {
      const p = host.player.position;
      camera.position.set(p.x, p.y + EYE, p.z);
      camera.rotation.set(state.pitch, host.player.yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
    },
    project: (point, out) => out.copy(point).project(camera),
    forward: (out) => camera.getWorldDirection(out),
  };
  const setGuard = (open: boolean): void => {
    state.guard.forEach(handle => { host.physics.world.getCollider(handle).setEnabled(!open); });
  };
  const sim = new GrappleSim(ports, wellCourse(hooks, RIM_Z, setGuard));
  const moved = new Vector3(), walked = { vy: 0, grounded: true }, tick: GrappleInput = { lock: false, jump: false, pitch: undefined };
  const none = (): null => null, unlocked = (): boolean => false;
  host.onStep(GRAPPLE_STEP, (dt) => {
    input(tick);
    if (tick.pitch !== undefined) state.pitch = tick.pitch;
    view.update?.();
    // no lock-on headless (SimHost has none), so an empty LOCK arms the miss shot as the page's does with no enemy locked
    if (tick.lock) sim.lock(view, none, unlocked);
    const fired = tick.jump && sim.fire(view);
    if (fired || sim.phase !== 'idle') {
      // the grapple answers before the walk: run it from where the tick began, and keep the walk only if it declines
      const p = host.player.position, fall = host.playerFall;
      moved.copy(p); walked.vy = fall.vy; walked.grounded = fall.grounded;
      p.copy(state.last); fall.vy = state.fall.vy; fall.grounded = state.fall.grounded;
      velocity.set(0, fall.vy, 0);
      if (traverseFeats(sim, dt, fact)) fall.vy = velocity.y;
      else { p.copy(moved); fall.vy = walked.vy; fall.grounded = walked.grounded; }
    }
    const p = host.player.position;
    state.last.set(p.x, p.y, p.z); state.fall.vy = host.playerFall.vy; state.fall.grounded = host.playerFall.grounded;
  }, { snapshot: () => JSON.stringify({ ...state, velocity: { x: velocity.x, y: velocity.y, z: velocity.z }, sim: sim.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error('Invalid Nine Fei Zhua continuation');
    const saved = v.parse(Saved, JSON.parse(value));
    state.pitch = saved.pitch; state.last.set(saved.last.x, saved.last.y, saved.last.z); state.fall = { ...saved.fall }; state.guard = saved.guard;
    velocity.set(saved.velocity.x, saved.velocity.y, saved.velocity.z);
    sim.restore(saved.sim);
  } });
  return { sim, guardOpen: () => sim.guardOpen() };
}
