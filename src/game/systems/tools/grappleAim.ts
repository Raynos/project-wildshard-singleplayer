// grappleAim — a grapple tool's aim, line and zip view (SHARD-PLATFORM M3, ex Nine Dragon's grapple/FeiZhua.ts). Nothing
// here knows a shard: the law (where a hook may be seen, where a zip lands, how the capsule moves) is the caller's, handed
// in as `GrappleAimRules`; the words, icons, colours, styles, system ids and mesh names are a data row (`GrappleAimRow`).
//
// LOCK a visible hook, JUMP to fire, then zip: every hook in reach (the rules' range, in sight, with a floor to land on)
// wears a small marker wherever it is on screen; the one nearest the centre wears the chip and turns the touch LOCK disc
// into the row's READY hint, a locked one makes it LOCKED and JUMP reads ZIP (the grapple input context). The reach test is
// a round robin, a couple of hooks a frame, so the phone never raycasts the whole hook list in one frame (E283). The line
// is a fixed-step verlet rope drawn as a screen-width filament with a three-talon claw on its end; the muzzle, bite and
// dock flash, the bite sparks and the lock halo follow the law's phases. The tool registers the platform's grapple mode
// (SF34): its context, its LOCK disc and its zip as the fixed step's traversal.
//
//   const setCourse = installGrappleAim(host, shard, scope, ROW, { fragment, law, visible, landing, target, … });
//   setCourse(playgroundCourse);   // a playground opens: only its hooks
//   setCourse(null);               // the caller's own course again
import {
  AdditiveBlending, Color, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Quaternion, RingGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { inState } from '@wildshard/engine/app/systems';
import type { EquipmentHost } from '@wildshard/engine/combat/view/EquipmentHost';
import type { InputContextDef } from '@wildshard/engine/level/context';
import { playerModes } from '@wildshard/engine/player/modes';
import type { DiscSpot, TouchRelabel } from '@wildshard/engine/ui/hudSlots';
import type { ShardContext } from '../../shard/context';
import { Filament, Rope } from '../looks/ropeFilament';
import { Flash, Sparks } from '../looks/burstFx';

/** A grapple tool's presentation as data: its hints, chip, markers, toasts, line, FX, system ids and mesh names. */
export interface GrappleAimRow {
  /** hooks whose sight (and, when stale, landing) are re-tested per frame: a round robin over the course */
  readonly scanPerFrame: number;
  /** a cached landing is re-found once the player has moved this far (m) from where it was found */
  readonly landingStale: number;
  /** the small in-reach markers on screen at once */
  readonly marks: number;
  /** the touch LOCK disc's labels (rest, a hook ready, locked, armed with no hook) and JUMP's (zip, fire) */
  readonly hints: { readonly rest: TouchRelabel; readonly ready: TouchRelabel; readonly locked: TouchRelabel; readonly zip: TouchRelabel; readonly armed: TouchRelabel; readonly fire: TouchRelabel };
  /** the candidate's chip: its class, inline style, words and colours */
  readonly chip: {
    readonly className: string; readonly style: Readonly<Record<string, string>>; readonly candidate: string; readonly lockedTouch: string; readonly lockedDesk: string;
    readonly color: string; readonly lockedColor: string;
  };
  /** an in-reach marker: its class, inline style, glyph and colour */
  readonly mark: { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly glyph: string; readonly color: string };
  /** the toasts: a miss, armed with no hook and a hook locked (touch and desktop words) */
  readonly toasts: { readonly miss: string; readonly armedTouch: string; readonly armedDesk: string; readonly lockedTouch: string; readonly lockedDesk: string };
  /** where the line leaves the hand, in the camera's space (m) */
  readonly muzzle: readonly [number, number, number];
  /** the rope's slack while the claw flies, while it reels back, and on a held line */
  readonly slack: { readonly fire: number; readonly reel: number; readonly hold: number };
  /** the rope's points */
  readonly ropePoints: number;
  /** the claw's and the lock halo's colours (hex) */
  readonly claw: number;
  readonly halo: number;
  /** the flashes' colours (hex): the muzzle, the bite, the dock */
  readonly flashes: { readonly muzzle: number; readonly bite: number; readonly dock: number };
  /** the bite's sparks */
  readonly sparks: number;
  /** the prefix of every mesh name (`<prefix>:filament`, `<prefix>:flying-claw`, …) */
  readonly name: string;
  /** the tool's systems: the input, the rope's fixed step and the frame */
  readonly systems: { readonly input: string; readonly rope: string; readonly update: string };
  /** the debug name the hooks and the phase are exposed under */
  readonly debug: string;
}

/** The aim: an eye, a screen projection (normalized device coordinates) and the look direction. */
export interface GrappleAimView {
  readonly eye: Vector3;
  /** refresh the view's matrices before a full test of every hook */
  update?: () => void;
  project: (point: Vector3, out: Vector3) => Vector3;
  forward: (out: Vector3) => Vector3;
}
/** A course: the hooks the claw may bite (world space). */
export interface GrappleAimCourse { readonly hooks: readonly Vector3[] }
/** A locked target: at least the hook it bit. */
export interface GrappleAimTarget { readonly hook: Vector3 }
/** The law's phase changes the view follows (cues, arms, flashes, toasts). */
export interface GrappleAimEvents {
  fire: () => void;
  miss: () => void;
  bite: () => void;
  zip: () => void;
  reel: () => void;
  dock: () => void;
  release: (active: boolean) => void;
}
/** The caller's grapple law, as the view reads it. */
export interface GrappleAimLaw<C extends GrappleAimCourse, T extends GrappleAimTarget> {
  course: C;
  readonly phase: string;
  readonly clock: number;
  readonly target: T | null;
  readonly missEnd: Vector3;
  holding: () => boolean;
  release: () => void;
  lock: (view: GrappleAimView, candidate: () => T | null, lockedOn: () => boolean) => string;
  fire: (view: GrappleAimView) => boolean;
}
/** A sound the view plays at a law event. */
export type GrappleAimCue = 'fire' | 'bite' | 'zip' | 'reel' | 'dock';
/** What only the caller knows: its course, its law, its sight and landing tests, its traversal and sounds. */
export interface GrappleAimRules<C extends GrappleAimCourse, T extends GrappleAimTarget, S, L extends GrappleAimLaw<C, T> = GrappleAimLaw<C, T>> {
  /** the course used whenever no other is set */
  readonly fragment: C;
  /** the law, made once with the view's events */
  readonly law: (course: C, events: GrappleAimEvents) => L;
  /** whether the claw sees `hook` from `eye` on `course` */
  readonly visible: (course: C, eye: Vector3, hook: Vector3) => boolean;
  /** the landing for a zip from the feet at `from` to `hook` (into `out`), or `none` */
  readonly landing: (from: Vector3, hook: Vector3, out: Vector3) => S;
  /** the landing test's "no landing" */
  readonly none: S;
  /** the target for a hook with its landing */
  readonly target: (course: C, hook: Vector3, landing: Vector3, side: S) => T;
  /** the grapple mode's traversal while the claw flies, reels or docks */
  readonly traverse: (law: L, dt: number) => boolean;
  /** a sound at a law event */
  readonly cue: (cue: GrappleAimCue) => void;
  /** the grapple input context (its touch relabel is the view's) */
  readonly context: InputContextDef;
  /** the reach (m) and the candidate window (normalized device coordinates) */
  readonly reach: { readonly min: number; readonly max: number; readonly winX: number; readonly winY: number };
  /** how long the claw flies out and reels back (s) */
  readonly timing: { readonly fire: number; readonly reel: number };
  /** whether the tool itself is on */
  readonly enabled: () => boolean;
}

function makeTracer(ctx: EquipmentHost, row: GrappleAimRow) {
  // Lab P9's fixed-step rope and screen-width ribbon replace the straight world-space cylinders.
  const rope = new Rope(row.ropePoints);
  const line = new Filament(rope.n);
  line.mesh.name = `${row.name}:filament`;
  const claw = new Group();
  const brass = new MeshBasicMaterial({ color: row.claw });
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
  claw.name = `${row.name}:flying-claw`;
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
  constructor(style: Readonly<Record<string, string>>, className: string) {
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

/**
 * Install a grapple tool's aim, line and zip view on the page's equipment host (`ctx`) for as long as `scope` lives; returns
 * the course setter (null: the rules' own course again). The law, its sight / landing tests and its traversal are `rules`'.
 */
export function installGrappleAim<C extends GrappleAimCourse, T extends GrappleAimTarget, S, L extends GrappleAimLaw<C, T>>(ctx: EquipmentHost, shard: ShardContext, scope: Scope, row: GrappleAimRow, rules: GrappleAimRules<C, T, S, L>): (course: C | null) => void {
  const fragment = rules.fragment;
  const { min: MIN_RANGE, max: MAX_RANGE, winX: WIN_X, winY: WIN_Y } = rules.reach;
  const { fire: FIRE_TIME, reel: REEL_TIME } = rules.timing;
  const MARKS = row.marks, H = row.hints;
  let hooks = fragment.hooks;
  // the camera as the aim (read live, as the Tool always did)
  const view: GrappleAimView = {
    get eye() { return ctx.game.camera.position; },
    update: () => { ctx.game.camera.updateMatrixWorld(true); },
    project: (point, out) => out.copy(point).project(ctx.game.camera),
    forward: (out) => ctx.game.camera.getWorldDirection(out),
  };
  const tracer = makeTracer(ctx, row);
  const touchUi = document.getElementById('hud')?.classList.contains('touch') === true;
  const chip = new Pin(row.chip.style, row.chip.className);
  const marks: Pin[] = [];
  for (let i = 0; i < MARKS; i++) {
    const m = new Pin(row.mark.style, row.mark.className);
    m.label(row.mark.glyph, 'mark', row.mark.color); marks.push(m);
    shard.hud.pin(() => m.position(), m.el);
  }
  shard.hud.pin(() => chip.position(), chip.el);
  const input = shard.app.input;
  const context: InputContextDef & { touch: { relabel: Partial<Record<DiscSpot, TouchRelabel>> } } = { ...rules.context, touch: { relabel: {} } };
  // SF34: the tool is the platform's grapple mode: its context, its LOCK disc and its zip (the fixed step's traversal)
  const mode = playerModes(ctx.player).register({ id: 'grapple', hud: 'lock', context, traverse: zip }, scope, { events: shard.app.events, input });
  let restLabel: (() => void) | undefined;
  const enabled = (): boolean => rules.enabled() && ctx.enabled() && inState('play', 'practice', 'playground')(shard.app);
  // ── the reach cache: per hook, its screen spot this frame (cheap), and its sight + landing from the round robin ──
  let n = hooks.length;
  let ndcX = new Float32Array(n), ndcY = new Float32Array(n), dist = new Float32Array(n);
  let inView = new Uint8Array(n), reach = new Uint8Array(n), hasLanding = new Uint8Array(n);
  let landings = hooks.map(() => new Vector3()), landedFrom = hooks.map(() => new Vector3(Infinity, 0, 0));
  let cursor = 0;
  let candidate = -1;
  const ndc = new Vector3();

  let time = 0;
  let muzzleAge = Infinity, biteAge = Infinity, dockAge = Infinity;
  let hintShown: TouchRelabel | null | undefined; // the LOCK hint last handed to the touch layer (undefined: none yet)
  const up = new Vector3();
  const muzzle = new Vector3(), tip = new Vector3();
  const screen = new Vector2();
  const muzzleFlash = new Flash(new Color(row.flashes.muzzle));
  const biteFlash = new Flash(new Color(row.flashes.bite));
  const dockFlash = new Flash(new Color(row.flashes.dock));
  const sparks = new Sparks(row.sparks);
  muzzleFlash.mesh.name = `${row.name}:muzzle-flash`;
  biteFlash.mesh.name = `${row.name}:bite-flash`;
  dockFlash.mesh.name = `${row.name}:dock-flash`;
  sparks.mesh.name = `${row.name}:bite-sparks`;
  const lockHalo = new Mesh(new RingGeometry(0.18, 0.25, 24), new MeshBasicMaterial({
    color: row.halo, transparent: true, opacity: 0.72, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
  }));
  lockHalo.name = `${row.name}:lock-halo`;
  lockHalo.visible = false;
  ctx.game.scene.add(lockHalo);
  ctx.game.scene.add(muzzleFlash.mesh, biteFlash.mesh, dockFlash.mesh, sparks.mesh);
  const hideCues = (): void => { chip.show(false); for (const m of marks) m.show(false); };
  // the law (the caller's); the view draws, sounds and animates what it does
  const sim = rules.law(fragment, {
    fire: () => { muzzleAge = 0; rules.cue('fire'); ctx.arms?.playLeft?.('grapple_fire'); ctx.arms?.setClawVisible?.(false); },
    miss: () => { ctx.toast(row.toasts.miss); },
    bite: () => { biteAge = 0; rules.cue('bite'); ctx.arms?.playLeft?.('grapple_hold'); },
    zip: () => { rules.cue('zip'); },
    reel: () => { rules.cue('reel'); },
    dock: () => { dockAge = 0; rules.cue('dock'); },
    release: (active) => {
      if (active) rules.cue('dock');
      tracer.hide(); hideCues();
      lockHalo.visible = muzzleFlash.mesh.visible = biteFlash.mesh.visible = dockFlash.mesh.visible = sparks.mesh.visible = false;
      ctx.arms?.playLeft?.('idle'); ctx.arms?.setClawVisible?.(true);
    },
  });
  // the course's hooks and the grapple's phase, for captures and native bakes
  shard.debug.expose(row.debug, { hooks: () => sim.course.hooks.map(({ x, y, z }) => ({ x, y, z })), phase: () => sim.phase });
  const tipAt = (): void => {
    muzzle.set(row.muzzle[0], row.muzzle[1], row.muzzle[2]).applyQuaternion(ctx.game.camera.quaternion).add(ctx.game.camera.position);
    const goal = sim.target?.hook ?? sim.missEnd;
    if (sim.phase === 'fire') tip.copy(muzzle).lerp(goal, Math.min(1, sim.clock / FIRE_TIME) ** 0.8);
    else if (sim.phase === 'reel') {
      const u = Math.min(1, sim.clock / REEL_TIME);
      const ease = u * u * (3 - 2 * u);
      tip.copy(sim.missEnd).lerp(muzzle, ease);
      tip.y -= Math.sin(Math.PI * u) * 1.2;
    } else if (sim.phase === 'dock') tip.copy(muzzle);
    else tip.copy(goal);
  };
  // E307: a playground opens / closes — let go of anything in flight on the old course, then its hooks and a fresh cache
  const setCourse = (value: C | null): void => {
    const next = value ?? fragment;
    if (next === sim.course) return;
    if (sim.phase !== 'idle' || sim.holding()) sim.release();
    sim.course = next; hooks = next.hooks; n = hooks.length;
    ndcX = new Float32Array(n); ndcY = new Float32Array(n); dist = new Float32Array(n);
    inView = new Uint8Array(n); reach = new Uint8Array(n); hasLanding = new Uint8Array(n);
    landings = hooks.map(() => new Vector3()); landedFrom = hooks.map(() => new Vector3(Infinity, 0, 0));
    cursor = 0; candidate = -1;
  };
  /** the touch discs follow the verb: LOCK / READY / LOCKED (+ ZIP on JUMP) / ARMED (+ FIRE) */
  const hint = (lock: TouchRelabel | null): void => {
    if (lock === hintShown) return;
    hintShown = lock;
    if (typeof restLabel === 'function') restLabel();
    restLabel = undefined;
    const active = lock !== null && lock !== H.rest;
    mode.context(active);
    const jump = lock === H.locked ? H.zip : lock === H.armed ? H.fire : null;
    context.touch.relabel = { ...(lock === null ? {} : { lock }), ...(jump === null ? {} : { jump }) };
    input.repaint();
    if (lock === H.rest) restLabel = shard.hud.relabel('lock', lock.label, '', lock);

  };

  /** the cached candidate, checked afresh (its sight and landing) at the moment LOCK is pressed */
  const pickCandidate = (): T | null => {
    if (candidate < 0) return null;
    const hook = hooks[candidate];
    if (hook === undefined || !rules.visible(sim.course, ctx.game.camera.position, hook)) return null;
    const landing = new Vector3();
    const side = rules.landing(ctx.player.position, hook, landing);
    return side === rules.none ? null : rules.target(sim.course, hook, landing, side);
  };

  // E298: the practice room hangs over the world with no hook in it, so LOCK there is the plain lock-on (the nearest hook
  // below would otherwise take the tap, and a zip would leave the room). A playground's room is a practice room too, but
  // it brings its own course (E307): the claw works there
  let inPractice = false;
  shard.app.events.on('practice.active', (on) => { inPractice = on; }, scope);
  const lockPress = (): boolean => {
    if (!enabled() || (inPractice && sim.course === fragment)) return false;
    // Once a crossing starts the law keeps it until a safe landing or bailout (lock: 'busy').
    const result = sim.lock(view, pickCandidate, () => ctx.lock.hasTarget());
    if (result === 'pass') return false;
    if (result === 'armed') {
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast(touchUi ? row.toasts.armedTouch : row.toasts.armedDesk);
    } else if (result === 'locked') {
      ctx.lock.unlock();
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast(touchUi ? row.toasts.lockedTouch : row.toasts.lockedDesk);
    }
    return true;
  };

  const jumpPress = (): boolean => {
    if (!enabled()) return false;
    const idle = sim.phase === 'idle';
    if (!sim.fire(view)) return false;
    // the claw leaves the muzzle: the line is laid out from there
    if (idle) { tipAt(); tracer.reset(muzzle); }
    return true;
  };

  shard.app.addSystem({ id: row.systems.input, phase: 'input', before: ['engine.lockon.input', 'engine.player.input'], after: ['engine.input.collect'], when: () => enabled(), run: () => {
    if (input.pressed('lock') && lockPress()) input.consume('lock');
    if (input.pressed('jump') && jumpPress()) input.consume('jump');
  } }, scope);
  /** The grapple mode's traversal: while the claw flies, reels or docks, it moves the capsule on the fixed step. */
  function zip(dt: number): boolean {
    if (!enabled() || sim.phase === 'idle') return false;
    return rules.traverse(sim, dt);
  }

  shard.app.addSystem({ id: row.systems.rope, phase: 'fixed.post', run: (dt) => {
    if (sim.phase === 'idle') return;
    time += dt;
    muzzleAge += dt; biteAge += dt; dockAge += dt;
    tipAt();
    const slack = sim.phase === 'fire' ? row.slack.fire : sim.phase === 'reel' ? row.slack.reel : row.slack.hold;
    tracer.step(dt, muzzle, tip, slack);
  } }, scope);

  /**
   * The reach scan, once a frame while idle: every hook's range and screen spot (a projection each, no ray), then a
   * round robin of `scanPerFrame` hooks in view whose sight is re-tested and whose landing is re-found (one a frame at
   * most) only once the player has moved `landingStale` from where it was found. Returns the candidate (the reachable
   * hook nearest the centre, inside the window) or -1.
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
    for (let tried = 0, done = 0; tried < n && done < row.scanPerFrame; tried++) {
      const i = cursor;
      cursor = (cursor + 1) % n;
      const hook = hooks[i];
      const landing = landings[i], from = landedFrom[i];
      if (hook === undefined || landing === undefined || from === undefined || inView[i] === 0) continue;
      done++;
      if (!rules.visible(sim.course, eye, hook)) { reach[i] = 0; continue; }
      if (landed === 0 && from.distanceToSquared(ctx.player.position) > row.landingStale * row.landingStale) {
        landed++;
        hasLanding[i] = rules.landing(ctx.player.position, hook, landing) === rules.none ? 0 : 1;
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

  shard.app.addSystem({ id: row.systems.update, phase: 'update', after: ['training-arena'], before: ['hud.perf', 'engine.world.bounds', 'main.6', 'hud.combat', 'first hints', 'main.frame', 'engine.player.hud'], run: () => {
    if (!enabled()) {
      if (sim.holding() || sim.phase !== 'idle') sim.release();
      hideCues(); hint(null); candidate = -1;
      return;
    }
    const target = sim.target;
    if (!sim.holding() && sim.phase === 'idle') {
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
        chip.label(row.chip.candidate, 'cand', row.chip.color);
        chip.at(hook);
        chip.show(true);
      }
      hint(hook === undefined ? H.rest : H.ready);
    } else {
      candidate = -1;
      for (const m of marks) m.show(false);
      if (target === null) chip.show(false);
      else {
        ndc.copy(target.hook).project(ctx.game.camera);
        chip.show(ndc.z >= -1 && ndc.z <= 1);
        chip.label(touchUi ? row.chip.lockedTouch : row.chip.lockedDesk, 'locked', row.chip.lockedColor);
        chip.at(target.hook);
      }
      hint(target !== null ? H.locked : H.armed);
    }
    lockHalo.visible = target !== null;
    if (target !== null) {
      lockHalo.position.copy(target.hook);
      lockHalo.lookAt(ctx.game.camera.position);
      const flare = biteAge < 0.22 ? 0.5 * (1 - biteAge / 0.22) : 0;
      lockHalo.scale.setScalar(1 + Math.sin(time * 10) * 0.08 + flare);
    }
    if (sim.phase === 'idle') return;
    tipAt();
    tracer.draw(tip, sim.phase === 'fire' || sim.phase === 'miss' || sim.phase === 'reel', biteAge < 0.4 ? 1 - biteAge / 0.4 : -1, time);
    ctx.game.renderer.getDrawingBufferSize(screen);
    sparks.u.uRes.value.copy(screen);
    muzzleFlash.mesh.position.copy(muzzle);
    muzzleFlash.set(muzzleAge / 0.13, 0.34, 0);
    biteFlash.mesh.position.copy(target?.hook ?? sim.missEnd);
    biteFlash.set(biteAge / 0.24, 0.75, time * 5);
    dockFlash.mesh.position.copy(muzzle);
    dockFlash.set(dockAge / 0.12, 0.2, 0);
    sparks.update(biteAge, target?.hook ?? sim.missEnd, up.set(0, 1, 0), 0.55);
  } }, scope);
  scope.onDispose(() => { sim.release(); input.pop('grapple'); });
  return setCourse;
}
