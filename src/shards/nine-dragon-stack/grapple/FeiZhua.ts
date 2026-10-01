/**
 * Fei Zhua in the partial shard: LOCK a visible brass dragon ring, JUMP to fire, then zip through Rapier's player capsule.
 *
 * E286 (Jake: "I can't seem to use a grappling hook … no dedicated HUD button"; his pick: keep the baseline HUD, make LOCK
 * say so): every hook in reach (2.5–38 m, in sight, with a floor to land on) wears a small ◇ marker wherever it is on
 * screen; the one nearest the centre wears the "◇ DRAGON HOOK" chip and turns the touch LOCK disc into GRAPPLE (gold,
 * pulsing), a locked one makes it LOCKED and JUMP reads ZIP (the grapple input context). The reach test is a round robin, a
 * couple of hooks a frame, so the phone never raycasts the whole registry in one frame (E283).
 *
 * E307: the hooks and the Well's rules are a course (course.ts). The fragment's is `fragmentCourse` below; a playground
 * hands in its own while it is open (setGrappleCourse) and gets the same verbs, markers, rope and FX on its own hooks.
 */
import {
  AdditiveBlending, Color, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three';
import { Tool, inState, castRay, castSegment, floorBelow, lineOfSight, type EquipmentHost, type EquipContext, type TouchRelabel, type Scope } from '#engine';
import type { ShardContext } from '#game';
import { FEI_ZHUA_ROW } from './row';
import { GRAPPLE_CONTEXT } from './context';
import { WELL, Y0 } from '../layout';
import { ndRuntime } from '../runtime';
import { RIM } from '../world/well-plan';
import { Filament, Rope } from './line';
import { Flash, Sparks } from './fx';
import type { GrappleCourse } from './course';
import { grappleCue } from '../audio/cues';

const MIN_RANGE = 2.5;
const MAX_RANGE = 38;
const ZIP_SPEED = 22;
const FIRE_TIME = 0.27;
const BITE_TIME = 0.10;
const REEL_TIME = 0.48;
/** the centred window a hook must sit in to be the candidate (|ndc x|, |ndc y|) */
const WIN_X = 0.52, WIN_Y = 0.68;
/** hooks whose sight (and, when stale, landing) are re-tested per frame: a round robin over the registry */
const SCAN_PER_FRAME = 2;
/** a cached landing is re-found once the player has moved this far from where it was found */
const LANDING_STALE = 1.2;
/** the small in-reach markers on screen at once */
const MARKS = 8;
/** the player's capsule, feet to crown (Player.ts BODY_HEIGHT) plus a margin: the room a zip's approach point needs */
const BODY = 1.95;
/** the rim's solid stone parapet top (well.ts wellColliders), which a lifted Well crossing must clear */
const RIM_WALL = Y0 + 3.2;

const GOLD = '#ffcf70';
/** the claw on LOCK (a three-talon grapple on its line) and ZIP on JUMP (an arrow along a line) */
const CLAW_ICON = '<path d="M12 2.2v9.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11.5c-3.9 0-6.6 2.5-6.9 6.6l1.9-1.3M12 11.5c3.9 0 6.6 2.5 6.9 6.6l-1.9-1.3M12 11.5v10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';
const ZIP_ICON = '<path d="M3.5 20.5 18.5 5.5M11 5h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 14.5l4-4M9.5 21l4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>';
const HINT_REST: TouchRelabel = { label: 'Lock', tone: 'rest' };
const HINT_READY: TouchRelabel = { label: 'Grapple', icon: CLAW_ICON, tone: 'ready', accent: GOLD };
const HINT_LOCKED: TouchRelabel = { label: 'Locked', icon: CLAW_ICON, tone: 'active', accent: GOLD };
const HINT_ZIP: TouchRelabel = { label: 'Zip', icon: ZIP_ICON, tone: 'active', accent: GOLD };
const HINT_ARMED: TouchRelabel = { label: 'Armed', icon: CLAW_ICON, tone: 'ready', accent: GOLD };
const HINT_FIRE: TouchRelabel = { label: 'Fire', icon: ZIP_ICON, tone: 'ready', accent: GOLD };

interface Target { hook: Vector3; landing: Vector3; approach: Vector3; lifts: boolean }

const UP = { x: 0, y: 1, z: 0 };
const vDir = new Vector3(), vPast = new Vector3(), vToward = new Vector3(), vSide = new Vector3(), vProbe = new Vector3();

/** The claw sees a hook: a clear line of sight, or past what only the course knows (the fragment's Well rail). */
function hookVisible(ctx: EquipmentHost, course: GrappleCourse, eye: Vector3, hook: Vector3): boolean {
  if (lineOfSight(ctx.physics, eye, hook, 1.1, ctx.player.motor.collider)) return true;
  return course.seePast?.(ctx, eye, hook) === true;
}

/** A hook beyond the Well rail is visible to the claw if the rail is the only obstruction (the line of sight is blocked). */
function seePastWellRail(ctx: EquipmentHost, eye: Vector3, hook: Vector3): boolean {
  const body = ctx.player.motor.collider;
  const hit = castSegment(ctx.physics, eye, hook, ['WORLD'], body);
  if (hit === null || Math.abs(hit.point.z - RIM.z0) > 0.45 || hit.point.x < WELL.x0 || hit.point.x > WELL.x1) return false;
  const id: unknown = typeof hit.owner === 'object' && hit.owner !== null ? Reflect.get(hit.owner, 'id') : null;
  if (id !== 'nds-floors' && id !== 'nds-grapple-guard') return false;
  vDir.subVectors(hook, eye).normalize();
  vPast.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(vDir, 1.1);
  return lineOfSight(ctx.physics, vPast, hook, 1.1, body);
}

/**
 * The fragment's own course: its dragon hooks (read once, at install), the Well rail a hook may be seen past, and the
 * crossing north over the Well from the south rim — it lifts over the rim's stone parapet first, with the safety cap open.
 */
function fragmentCourse(): GrappleCourse {
  return {
    name: 'Nine Dragon Stack',
    hooks: ndRuntime().world.ctx.hooks,
    seePast: seePastWellRail,
    lifts: (p, landing) => p.z > RIM.z0 && landing.z < RIM.z0 && p.x >= WELL.x0 && p.x <= WELL.x1 && p.y >= Y0 - 1,
    // lift high enough that the straight pull to the approach point clears the rim's stone parapet (its top + a
    // margin, measured where the capsule has passed the stone), never less than the old 3.5 m, under the cap's top
    liftTo: (p, a) => {
      const past = RIM.z0 - 0.7;
      const t = Math.min(0.9, Math.max(0, (p.z - past) / Math.max(0.01, p.z - a.z)));
      return Math.min(Y0 + 11, Math.max(p.y + 3.5, (RIM_WALL + 0.35 - a.y * t) / (1 - t)));
    },
    guard: (open) => { ndRuntime().guardOpen = open; },
  };
}

/** the capsule's footprint (Player.ts RADIUS 0.38 and a hair): four probes round the landing */
const FOOT = [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]] as const;
/** a floor the capsule can stand on at (x, z): within a tread's rise across its whole width (a stair is; a rail's top, a
 *  balustrade's or the square's edge by the balustrade is not) */
function standable(ctx: EquipmentHost, x: number, y: number, z: number): boolean {
  const body = ctx.player.motor.collider;
  for (const [dx, dz] of FOOT) {
    const f = floorBelow(ctx.physics, x + dx, z + dz, y + 0.6, 1.2, body);
    if (f === undefined || Math.abs(f - y) > 0.4) return false;
  }
  return true;
}

// back steps from the ring toward the player first; then past it (a ring on a lip: the pull carries you over onto the
// floor behind it, E286's rim → square crossing)
const BACKS = [1.2, 2, 2.8, 4, 6, -1.6, -2.4, -3.2, -4.2] as const;
const SIDES = [0, -2, 2, -4, 4] as const;

/** where a landing was found: none (no safe zip target), between the player and the ring, or past the ring */
const NONE = 0, NEAR = 1, PAST = 2;
type Side = typeof NONE | typeof NEAR | typeof PAST;

/** The actual floor near a ring, approached from `from` (the player's feet), written to `out`. */
function landingFor(ctx: EquipmentHost, from: Vector3, hook: Vector3, out: Vector3): Side {
  vToward.subVectors(from, hook).setY(0);
  if (vToward.lengthSq() < 0.01) return NONE;
  vToward.normalize();
  vSide.set(-vToward.z, 0, vToward.x);
  const fromY = hook.y + 2;
  const body = ctx.player.motor.collider;
  for (const back of BACKS) {
    for (const sideStep of SIDES) {
      vProbe.copy(hook).addScaledVector(vToward, back).addScaledVector(vSide, sideStep);
      const floor = floorBelow(ctx.physics, vProbe.x, vProbe.z, fromY, 12, body);
      if (floor === undefined || floor < hook.y - 9 || floor > hook.y + 1.8) continue;
      if (!standable(ctx, vProbe.x, floor, vProbe.z)) continue;
      out.set(vProbe.x, floor + 0.12, vProbe.z);
      return back > 0 ? NEAR : PAST;
    }
  }
  return NONE;
}

/**
 * Where the zip flies to for a landing past the ring: over it at up to the ring's height (so it comes in over the lip the
 * ring hangs from, a rail or a balustrade, instead of through it) with room for the capsule under anything overhead,
 * then the player drops on. A landing on the player's side is flown to straight, as it always was.
 */
function approachFor(ctx: EquipmentHost, hook: Vector3, landing: Vector3, out: Vector3): void {
  let clear = Math.min(1.6, Math.max(0, hook.y - landing.y - 0.2));
  if (clear > 0) {
    const hit = castRay(ctx.physics, landing, UP, clear + BODY, ['WORLD'], ctx.player.motor.collider);
    if (hit !== null) clear = Math.max(0, Math.min(clear, hit.distance - BODY));
  }
  out.copy(landing);
  out.y += clear;
}

function targetFor(ctx: EquipmentHost, course: GrappleCourse, hook: Vector3, landing: Vector3, side: Side): Target {
  const approach = landing.clone();
  if (side === PAST) approachFor(ctx, hook, landing, approach);
  return { hook, landing: landing.clone(), approach, lifts: course.lifts?.(ctx.player.position, landing) === true };
}

/** the full test of every hook, for the LOCK press when the round robin has no candidate yet (a one-off, not per frame) */
function nearest(ctx: EquipmentHost, course: GrappleCourse): Target | null {
  const camera = ctx.game.camera;
  camera.updateMatrixWorld(true);
  const eye = camera.position;
  const landing = new Vector3(), p = new Vector3();
  let chosen: Target | null = null, score = Infinity;
  for (const hook of course.hooks) {
    const d = eye.distanceTo(hook);
    if (d < MIN_RANGE || d > MAX_RANGE) continue;
    p.copy(hook).project(camera);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) > WIN_X || Math.abs(p.y) > WIN_Y) continue;
    const s = p.x * p.x + p.y * p.y * 0.55 + d * 0.0008;
    if (s >= score || !hookVisible(ctx, course, eye, hook)) continue;
    const side = landingFor(ctx, ctx.player.position, hook, landing);
    if (side === NONE) continue;
    chosen = targetFor(ctx, course, hook, landing, side);
    score = s;
  }
  return chosen;
}

function makeTracer(ctx: EquipmentHost) {
  // Lab P9's fixed-step rope and screen-width ribbon replace the straight world-space cylinders.
  const rope = new Rope(24);
  const line = new Filament(rope.n);
  line.mesh.name = 'fei-zhua:filament';
  const claw = new Group();
  const brass = new MeshBasicMaterial({ color: 0xd7a546 });
  claw.add(new Mesh(new SphereGeometry(0.10, 8, 6), brass));
  for (let i = 0; i < 3; i++) {
    const phi = i * Math.PI * 2 / 3;
    const talon = new Mesh(new ConeGeometry(0.055, 0.30, 5), brass);
    talon.position.set(Math.cos(phi) * 0.075, Math.sin(phi) * 0.075, 0.15);
    talon.rotation.x = Math.PI / 2;
    claw.add(talon);
  }
  const eyelet = new Mesh(new TorusGeometry(0.06, 0.018, 4, 10), brass);
  eyelet.position.z = -0.12;
  claw.add(eyelet);
  claw.name = 'fei-zhua:flying-claw';
  line.mesh.visible = claw.visible = false;
  ctx.game.scene.add(line.mesh, claw);
  const res = new Vector2(), dir = new Vector3(0, 0, 1), forward = new Vector3(0, 0, 1), turn = new Quaternion();
  return {
    reset(start: Vector3): void { rope.reset(start, start); },
    step(dt: number, start: Vector3, end: Vector3, slack: number): void {
      rope.slack = slack;
      dir.subVectors(end, start);
      if (dir.lengthSq() > 1e-6) turn.setFromUnitVectors(forward, dir.normalize());
      // Two fixed substeps keep the line responsive without the lab's 240 Hz capture cost.
      for (let i = 0; i < 2; i++) rope.step(dt / 2, start, end);
    },
    draw(end: Vector3, flying: boolean, pulse: number, time: number): void {
      if (!rope.active) return;
      line.u.uRes.value.copy(ctx.game.renderer.getDrawingBufferSize(res));
      line.u.uPulse.value = pulse;
      line.u.uTime.value = time;
      line.u.uI.value = 1.1;
      line.update(rope);
      line.mesh.visible = true;
      claw.visible = flying; claw.position.copy(end); claw.quaternion.copy(turn);
      claw.rotateZ(time * 3);
    },
    hide(): void { rope.off(); line.mesh.visible = claw.visible = false; },
  };
}

/** Content owns visibility and labels; the engine owns screen projection. */
class Pin {
  readonly el = document.createElement('div');
  point: Vector3 | null = null;
  private shown = false; private text = ''; private tone = '';
  constructor(style: Partial<CSSStyleDeclaration>, className: string) {
    this.el.className = className; Object.assign(this.el.style, style);
  }
  show(on: boolean): void { this.shown = on; }
  at(point: Vector3): void { this.point = point; }
  position(): Vector3 | null { return this.shown ? this.point : null; }
  label(text: string, tone: string, color: string): void {
    if (text !== this.text) { this.text = text; this.el.textContent = text; }
    if (tone !== this.tone) { this.tone = tone; this.el.style.borderColor = color; this.el.style.color = color; }
  }
}

export class FeiZhua extends Tool {
  readonly id = 'tool.fei-zhua' as const;
  readonly slot = 'offhand' as const;
  readonly actions = ['lock', 'jump'] as const;
  holster = 0;
  enabled = true;
  private readonly shard: ShardContext;
  private readonly course: GrappleCourse | undefined;
  private courseSetter: ((course: GrappleCourse | null) => void) | undefined;
  constructor(shard: ShardContext, course?: GrappleCourse) { super(FEI_ZHUA_ROW); this.shard = shard; this.course = course; }
  override install(equip: EquipContext): void {
    super.install(equip);
    const host = this.shard.app.equipmentHost;
    if (host === null) throw new Error('Fei Zhua needs the equipment scene ports');
    this.courseSetter = installRuntime(host, this.shard, equip.scope, () => this.enabled, this.course);
  }
  setGrappleCourse(course: GrappleCourse | null): void { this.courseSetter?.(course); }
  override update(_dt: number, _t: number): void { /* Owned systems retain their original phases. */ }
}

function installRuntime(ctx: EquipmentHost, shard: ShardContext, scope: Scope, toolEnabled: () => boolean, baseCourse?: GrappleCourse): (course: GrappleCourse | null) => void {
  const fragment = baseCourse ?? fragmentCourse();
  let course = fragment;
  let hooks = course.hooks;
  const tracer = makeTracer(ctx);
  const touchUi = document.getElementById('hud')?.classList.contains('touch') === true;
  const chip = new Pin({
    zIndex: '25', padding: '6px 9px', border: '1px solid #8fe3ff', background: '#0d1b26dd', color: '#8fe3ff',
    font: '700 10px monospace', letterSpacing: '1.5px', whiteSpace: 'nowrap',
  }, 'ws-dragon-hook');
  const marks: Pin[] = [];
  for (let i = 0; i < MARKS; i++) {
    const m = new Pin({
      zIndex: '24', font: '700 15px monospace', lineHeight: '1', color: '#8fe3ff',
      textShadow: '0 0 3px #0d1b26, 0 0 3px #0d1b26, 0 0 9px rgba(143, 227, 255, 0.75)',
    }, 'ws-dragon-mark');
    m.label('◇', 'mark', '#8fe3ff'); marks.push(m);
    shard.hud.pin(() => m.position(), m.el);
  }
  shard.hud.pin(() => chip.position(), chip.el);
  const input = shard.app.input;
  const context = { ...GRAPPLE_CONTEXT, touch: { relabel: {} } };
  input.register(context, scope);
  let contextOn = false;
  let restLabel: (() => void) | undefined;
  const enabled = (): boolean => toolEnabled() && ctx.enabled() && inState('play', 'practice', 'playground')(shard.app);
  // ── the reach cache: per hook, its screen spot this frame (cheap), and its sight + landing from the round robin ──
  let n = hooks.length;
  let ndcX = new Float32Array(n), ndcY = new Float32Array(n), dist = new Float32Array(n);
  let inView = new Uint8Array(n), reach = new Uint8Array(n), hasLanding = new Uint8Array(n);
  let landings = hooks.map(() => new Vector3()), landedFrom = hooks.map(() => new Vector3(Infinity, 0, 0));
  let cursor = 0;
  let candidate = -1;
  const ndc = new Vector3();

  type Phase = 'idle' | 'fire' | 'bite' | 'lift' | 'zip' | 'vault' | 'settle' | 'miss' | 'reel' | 'dock';
  let target: Target | null = null;
  let armedMiss = false;
  let phase: Phase = 'idle';
  let clock = 0, blocked = 0, liftY = 0, time = 0;
  let muzzleAge = Infinity, biteAge = Infinity, dockAge = Infinity;
  let hintShown: TouchRelabel | null | undefined; // the LOCK hint last handed to the touch layer (undefined: none yet)
  const end = new Vector3(), want = new Vector3(), before = new Vector3();
  const muzzle = new Vector3(), tip = new Vector3(), missEnd = new Vector3();
  const screen = new Vector2();
  const muzzleFlash = new Flash(new Color(0xa8f5ff));
  const biteFlash = new Flash(new Color(0xffc76a));
  const dockFlash = new Flash(new Color(0xffd891));
  const sparks = new Sparks(24);
  muzzleFlash.mesh.name = 'fei-zhua:muzzle-flash';
  biteFlash.mesh.name = 'fei-zhua:bite-flash';
  dockFlash.mesh.name = 'fei-zhua:dock-flash';
  sparks.mesh.name = 'fei-zhua:bite-sparks';
  const lockHalo = new Mesh(new RingGeometry(0.18, 0.25, 24), new MeshBasicMaterial({
    color: 0xffcc62, transparent: true, opacity: 0.72, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
  }));
  lockHalo.name = 'fei-zhua:lock-halo';
  lockHalo.visible = false;
  ctx.game.scene.add(lockHalo);
  ctx.game.scene.add(muzzleFlash.mesh, biteFlash.mesh, dockFlash.mesh, sparks.mesh);
  const tipAt = (): void => {
    muzzle.set(-0.2, -0.23, -0.55).applyQuaternion(ctx.game.camera.quaternion).add(ctx.game.camera.position);
    const goal = target?.hook ?? missEnd;
    if (phase === 'fire') tip.copy(muzzle).lerp(goal, Math.min(1, clock / FIRE_TIME) ** 0.8);
    else if (phase === 'reel') {
      const u = Math.min(1, clock / REEL_TIME);
      const ease = u * u * (3 - 2 * u);
      tip.copy(missEnd).lerp(muzzle, ease);
      tip.y -= Math.sin(Math.PI * u) * 1.2;
    } else if (phase === 'dock') tip.copy(muzzle);
    else tip.copy(goal);
  };
  const hideCues = (): void => { chip.show(false); for (const m of marks) m.show(false); };
  const release = (): void => {
    if (phase !== 'idle' && phase !== 'dock') grappleCue('grapple.dock');
    phase = 'idle'; target = null; armedMiss = false; clock = blocked = 0;
    tracer.hide(); hideCues();
    lockHalo.visible = muzzleFlash.mesh.visible = biteFlash.mesh.visible = dockFlash.mesh.visible = sparks.mesh.visible = false;
    course.guard?.(false);
    ctx.arms?.playLeft?.('idle'); ctx.arms?.setClawVisible?.(true);
  };
  // E307: a playground opens / closes — let go of anything in flight on the old course, then its hooks and a fresh cache
  const setCourse = (value: GrappleCourse | null): void => {
    const next = value ?? fragment;
    if (next === course) return;
    if (phase !== 'idle' || target !== null || armedMiss) release();
    course = next; hooks = next.hooks; n = hooks.length;
    ndcX = new Float32Array(n); ndcY = new Float32Array(n); dist = new Float32Array(n);
    inView = new Uint8Array(n); reach = new Uint8Array(n); hasLanding = new Uint8Array(n);
    landings = hooks.map(() => new Vector3()); landedFrom = hooks.map(() => new Vector3(Infinity, 0, 0));
    cursor = 0; candidate = -1;
  };
  /** the touch discs follow the verb: LOCK / GRAPPLE / LOCKED (+ ZIP on JUMP) / ARMED (+ FIRE) */
  const hint = (lock: TouchRelabel | null): void => {
    if (lock === hintShown) return;
    hintShown = lock;
    if (typeof restLabel === 'function') restLabel();
    restLabel = undefined;
    const active = lock !== null && lock !== HINT_REST;
    if (active && !contextOn) { input.push('grapple', scope); contextOn = true; }
    if (!active && contextOn) { input.pop('grapple'); contextOn = false; }
    const jump = lock === HINT_LOCKED ? HINT_ZIP : lock === HINT_ARMED ? HINT_FIRE : null;
    context.touch.relabel = { ...(lock === null ? {} : { lock }), ...(jump === null ? {} : { jump }) };
    input.repaint();
    if (lock === HINT_REST) restLabel = shard.hud.relabel('lock', lock.label, '', lock);

  };

  /** the cached candidate, checked afresh (its sight and landing) at the moment LOCK is pressed */
  const pickCandidate = (): Target | null => {
    if (candidate < 0) return null;
    const hook = hooks[candidate];
    if (hook === undefined || !hookVisible(ctx, course, ctx.game.camera.position, hook)) return null;
    const landing = new Vector3();
    const side = landingFor(ctx, ctx.player.position, hook, landing);
    return side === NONE ? null : targetFor(ctx, course, hook, landing, side);
  };

  // E298: the practice room hangs 900 m over the city: no hook is in it, so LOCK there is the plain lock-on (the nearest
  // hook below would otherwise take the tap, and a zip would leave the room). A playground's room is a practice room too,
  // but it brings its own course (E307): the claw works there
  let inPractice = false;
  shard.app.events.on('practice.active', (on) => { inPractice = on; }, scope);
  const lockPress = (): boolean => {
    if (!enabled() || (inPractice && course === fragment)) return false;
    // Once a crossing starts the safety guard must stay open until a safe landing or bailout.
    if (phase !== 'idle' && phase !== 'miss' && phase !== 'reel' && phase !== 'dock') return true;
    if (target !== null || armedMiss) { release(); return true; }
    const pick = pickCandidate() ?? nearest(ctx, course);
    if (pick === null) {
      if (ctx.lock.hasTarget()) return false;
      armedMiss = true;
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast(touchUi ? 'FEI ZHUA READY · FIRE TO SHOOT' : 'FEI ZHUA READY · JUMP TO FIRE');
      return true;
    }
    ctx.lock.unlock();
    target = pick;
    ctx.arms?.playLeft?.('grapple_aim');
    ctx.toast(touchUi ? 'DRAGON HOOK LOCKED · ZIP TO FLY' : 'DRAGON HOOK LOCKED · JUMP TO ZIP');
    return true;
  };

  const jumpPress = (): boolean => {
    if (!enabled() || (target === null && !armedMiss)) return false;
    if (phase !== 'idle') return true;
    phase = 'fire'; clock = 0; muzzleAge = 0;
    grappleCue('grapple.fire');
    tipAt();
    if (target === null) {
      ctx.game.camera.getWorldDirection(want);
      missEnd.copy(ctx.game.camera.position).addScaledVector(want, 19);
      missEnd.y -= 1.2;
    } else if (target.lifts) {
      course.guard?.(true);
      liftY = course.liftTo?.(ctx.player.position, target.approach) ?? ctx.player.position.y + 3.5;
    }
    tracer.reset(muzzle);
    ctx.arms?.playLeft?.('grapple_fire');
    ctx.arms?.setClawVisible?.(false);
    return true;
  };

  shard.app.addSystem({ id: 'shard.nd.feizhua.input', phase: 'input', before: ['engine.lockon.input', 'engine.player.input'], after: ['engine.input.collect'], when: () => enabled(), run: () => {
    if (input.pressed('lock') && lockPress()) input.consume('lock');
    if (input.pressed('jump') && jumpPress()) input.consume('jump');
  } }, scope);
  shard.app.events.answer('player.traversal', (dt) => {
    if (typeof dt !== 'number') return dt;
    if (!enabled() || phase === 'idle') return false;
    clock += dt;
    const p = ctx.player;
    if (phase === 'fire') {
      p.velocity.set(0, 0, 0);
      if (clock >= FIRE_TIME) {
        clock = 0;
        if (target === null) { phase = 'miss'; ctx.toast('FEI ZHUA MISSED · REELING'); }
        else { phase = 'bite'; biteAge = 0; grappleCue('grapple.bite'); ctx.arms?.playLeft?.('grapple_hold'); }
      }
      return true;
    }
    if (phase === 'miss') { if (clock >= 0.16) { phase = 'reel'; clock = 0; grappleCue('grapple.reel'); } return false; }
    if (phase === 'reel') { if (clock >= REEL_TIME) { phase = 'dock'; clock = 0; dockAge = 0; grappleCue('grapple.dock'); } return false; }
    if (phase === 'dock') { if (clock >= 0.12) release(); return false; }
    if (target === null) { release(); return false; }
    if (phase === 'bite') {
      p.velocity.set(0, 0, 0);
      if (clock >= BITE_TIME) { phase = target.lifts ? 'lift' : 'zip'; clock = 0; p.onGround = false; grappleCue('grapple.zip'); }
      return true;
    }
    if (phase === 'lift') {
      const rise = Math.min(18 * dt, Math.max(0, liftY - p.position.y));
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, rise, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      p.onGround = false;
      if (p.position.y >= liftY - 0.2) { phase = 'zip'; clock = 0; }
      else if (clock > 0.6) { release(); }
      return true;
    }
    if (phase === 'vault') {
      // A short motor-driven pop clears the hook's lip; Rapier still owns collision.
      before.copy(p.position);
      p.motor.move(p.position, want.set(0, 0.7 * dt, 0), true);
      p.velocity.subVectors(p.position, before).divideScalar(dt);
      if (clock >= 0.14) { phase = 'settle'; clock = 0; }
      return true;
    }
    if (phase === 'settle') {
      p.velocity.set(0, -0.5, 0);
      if (clock >= 0.10) { release(); return false; }
      return true;
    }
    // the pull flies to the approach point over the landing; from there the player drops onto it
    end.copy(target.approach);
    want.subVectors(end, p.position);
    const remaining = want.length();
    if (remaining < 0.25) { phase = 'vault'; clock = 0; p.velocity.set(0, 0, 0); return true; }
    want.multiplyScalar(Math.min(ZIP_SPEED * dt, remaining) / remaining);
    before.copy(p.position);
    p.motor.move(p.position, want, true);
    const moved = p.position.distanceTo(before);
    p.velocity.subVectors(p.position, before).divideScalar(dt);
    p.onGround = false;
    blocked = moved < want.length() * 0.15 ? blocked + dt : 0;
    if (blocked > 0.22 || clock > 2.5) { p.velocity.set(0, -0.5, 0); release(); }
    return true;
  }, scope);

  shard.app.addSystem({ id: 'fei-zhua.rope', phase: 'fixed.post', run: (dt) => {
    if (phase === 'idle') return;
    time += dt;
    muzzleAge += dt; biteAge += dt; dockAge += dt;
    tipAt();
    const slack = phase === 'fire' ? 1.14 : phase === 'reel' ? 1.20 : 1.005;
    tracer.step(dt, muzzle, tip, slack);
  } }, scope);

  /**
   * The reach scan, once a frame while idle: every hook's range and screen spot (a projection each, no ray), then a
   * round robin of SCAN_PER_FRAME hooks in view whose sight is re-tested (1–3 rays) and whose landing is re-found (one a
   * frame at most) only once the player has moved LANDING_STALE from where it was found. Returns the candidate (the
   * reachable hook nearest the centre, inside the window) or -1.
   */
  const scan = (): number => {
    const camera = ctx.game.camera;
    camera.updateMatrixWorld(true);
    const eye = camera.position;
    for (let i = 0; i < n; i++) {
      const hook = hooks[i];
      if (hook === undefined) continue;
      const d = eye.distanceTo(hook);
      dist[i] = d;
      let on = 0;
      if (d >= MIN_RANGE && d <= MAX_RANGE) {
        ndc.copy(hook).project(camera);
        if (ndc.z >= -1 && ndc.z <= 1 && Math.abs(ndc.x) <= 1.05 && Math.abs(ndc.y) <= 1.05) { on = 1; ndcX[i] = ndc.x; ndcY[i] = ndc.y; }
      }
      inView[i] = on;
      if (on === 0) reach[i] = 0; // out of reach now; re-tested when it comes back
    }
    let landed = 0; // landings re-found this frame (≤ 1: the floor probes are the scan's costly part)
    for (let tried = 0, done = 0; tried < n && done < SCAN_PER_FRAME; tried++) {
      const i = cursor;
      cursor = (cursor + 1) % n;
      const hook = hooks[i];
      const landing = landings[i], from = landedFrom[i];
      if (hook === undefined || landing === undefined || from === undefined || inView[i] === 0) continue;
      done++;
      if (!hookVisible(ctx, course, eye, hook)) { reach[i] = 0; continue; }
      if (landed === 0 && from.distanceToSquared(ctx.player.position) > LANDING_STALE * LANDING_STALE) {
        landed++;
        hasLanding[i] = landingFor(ctx, ctx.player.position, hook, landing) === NONE ? 0 : 1;
        from.copy(ctx.player.position);
      }
      reach[i] = hasLanding[i] ?? 0;
    }
    let best = -1, score = Infinity;
    for (let i = 0; i < n; i++) {
      if (reach[i] === 0) continue;
      const x = ndcX[i] ?? 0, y = ndcY[i] ?? 0;
      if (Math.abs(x) > WIN_X || Math.abs(y) > WIN_Y) continue;
      const s = x * x + y * y * 0.55 + (dist[i] ?? 0) * 0.0008;
      if (s < score) { score = s; best = i; }
    }
    return best;
  };

  shard.app.addSystem({ id: 'fei-zhua', phase: 'update', after: ['training-arena'], before: ['hud.perf', 'engine.world.bounds', 'main.6', 'hud.combat', 'first hints', 'main.frame', 'engine.player.hud'], run: () => {
    if (!enabled()) {
      if (target !== null || armedMiss || phase !== 'idle') release();
      hideCues(); hint(null); candidate = -1;
      return;
    }
    if (target === null && !armedMiss && phase === 'idle') {
      candidate = scan();
      // the small markers: every reachable hook on screen but the candidate (it wears the chip)
      let used = 0;
      for (let i = 0; i < n && used < MARKS; i++) {
        if (reach[i] === 0 || i === candidate) continue;
        const x = ndcX[i] ?? 0, y = ndcY[i] ?? 0;
        if (Math.abs(x) > 0.96 || Math.abs(y) > 0.96) continue;
        const m = marks[used++];
        if (m === undefined) break;
        const markHook = hooks[i]; if (markHook !== undefined) m.at(markHook);
        m.show(true);
      }
      for (let k = used; k < MARKS; k++) marks[k]?.show(false);
      const hook = candidate >= 0 ? hooks[candidate] : undefined;
      if (hook === undefined) chip.show(false);
      else {
        chip.label('◇ DRAGON HOOK', 'cand', '#8fe3ff');
        chip.at(hook);
        chip.show(true);
      }
      hint(hook === undefined ? HINT_REST : HINT_READY);
    } else {
      candidate = -1;
      for (const m of marks) m.show(false);
      if (target === null) chip.show(false);
      else {
        ndc.copy(target.hook).project(ctx.game.camera);
        chip.show(ndc.z >= -1 && ndc.z <= 1);
        chip.label(touchUi ? '◆ LOCKED · ZIP' : '◆ LOCKED · JUMP', 'locked', '#d7a546');
        chip.at(target.hook);
      }
      hint(target !== null ? HINT_LOCKED : HINT_ARMED);
    }
    lockHalo.visible = target !== null;
    if (target !== null) {
      lockHalo.position.copy(target.hook);
      lockHalo.lookAt(ctx.game.camera.position);
      const flare = biteAge < 0.22 ? 0.5 * (1 - biteAge / 0.22) : 0;
      lockHalo.scale.setScalar(1 + Math.sin(time * 10) * 0.08 + flare);
    }
    if (phase === 'idle') return;
    tipAt();
    tracer.draw(tip, phase === 'fire' || phase === 'miss' || phase === 'reel', biteAge < 0.4 ? 1 - biteAge / 0.4 : -1, time);
    ctx.game.renderer.getDrawingBufferSize(screen);
    sparks.u.uRes.value.copy(screen);
    muzzleFlash.mesh.position.copy(muzzle);
    muzzleFlash.set(muzzleAge / 0.13, 0.34, 0);
    biteFlash.mesh.position.copy(target?.hook ?? missEnd);
    biteFlash.set(biteAge / 0.24, 0.75, time * 5);
    dockFlash.mesh.position.copy(muzzle);
    dockFlash.set(dockAge / 0.12, 0.2, 0);
    sparks.update(biteAge, target?.hook ?? missEnd, want.set(0, 1, 0), 0.55);
  } }, scope);
  scope.onDispose(() => { release(); input.pop('grapple'); });
  return setCourse;
}
