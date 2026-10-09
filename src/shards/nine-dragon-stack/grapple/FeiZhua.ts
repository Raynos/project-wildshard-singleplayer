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
import type { Scope } from '@wildshard/engine/app/scope';
import { inState } from '@wildshard/engine/app/systems';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Tool } from '@wildshard/engine/combat/Tool';
import type { EquipmentHost } from '@wildshard/engine/combat/view/EquipmentHost';
import type { TouchRelabel } from '@wildshard/engine/ui/hudSlots';
import type { ShardContext } from '@wildshard/game/shard/context';
import { FEI_ZHUA_ROW } from './row';
import { GRAPPLE_CONTEXT } from './context';
import { ndRuntime } from '../runtime/state';
import { RIM } from '../world/well-plan';
import { Filament, Rope } from './line';
import { Flash, Sparks } from './fx';
import type { GrappleCourse, GrapplePorts } from './course';
import { FIRE_TIME, GrappleSim, type GrappleTarget, type GrappleView, hookVisible, landingFor, MAX_RANGE, MIN_RANGE, NONE, REEL_TIME, targetFor, WIN_X, WIN_Y, wellCourse } from './sim';
import { grappleCue } from '../runtime/audio/cues';

/** hooks whose sight (and, when stale, landing) are re-tested per frame: a round robin over the registry */
const SCAN_PER_FRAME = 2;
/** a cached landing is re-found once the player has moved this far from where it was found */
const LANDING_STALE = 1.2;
/** the small in-reach markers on screen at once */
const MARKS = 8;

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
  // the fragment's own course (grapple/sim.ts wellCourse): its dragon hooks, read once at install, and the Well's safety cap
  const fragment = baseCourse ?? wellCourse(ndRuntime().world.ctx.hooks, RIM.z0, (open) => { ndRuntime().guardOpen = open; });
  let hooks = fragment.hooks;
  // the law's ports: the page's physics and Player, and the camera as the aim (read live, as the Tool always did)
  const ports: GrapplePorts = { get physics() { return ctx.physics; }, get body() { return ctx.player; } };
  const view: GrappleView = {
    get eye() { return ctx.game.camera.position; },
    update: () => { ctx.game.camera.updateMatrixWorld(true); },
    project: (point, out) => out.copy(point).project(ctx.game.camera),
    forward: (out) => ctx.game.camera.getWorldDirection(out),
  };
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

  let time = 0;
  let muzzleAge = Infinity, biteAge = Infinity, dockAge = Infinity;
  let hintShown: TouchRelabel | null | undefined; // the LOCK hint last handed to the touch layer (undefined: none yet)
  const up = new Vector3();
  const muzzle = new Vector3(), tip = new Vector3();
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
  const hideCues = (): void => { chip.show(false); for (const m of marks) m.show(false); };
  // the law (grapple/sim.ts); the Tool draws, sounds and animates what it does
  const sim = new GrappleSim(ports, fragment, {
    fire: () => { muzzleAge = 0; grappleCue('grapple.fire'); ctx.arms?.playLeft?.('grapple_fire'); ctx.arms?.setClawVisible?.(false); },
    miss: () => { ctx.toast('FEI ZHUA MISSED · REELING'); },
    bite: () => { biteAge = 0; grappleCue('grapple.bite'); ctx.arms?.playLeft?.('grapple_hold'); },
    zip: () => { grappleCue('grapple.zip'); },
    reel: () => { grappleCue('grapple.reel'); },
    dock: () => { dockAge = 0; grappleCue('grapple.dock'); },
    release: (active) => {
      if (active) grappleCue('grapple.dock');
      tracer.hide(); hideCues();
      lockHalo.visible = muzzleFlash.mesh.visible = biteFlash.mesh.visible = dockFlash.mesh.visible = sparks.mesh.visible = false;
      ctx.arms?.playLeft?.('idle'); ctx.arms?.setClawVisible?.(true);
    },
  });
  // the course's hooks and the grapple's phase, for captures and the native bake (scripts/bake-nine-physics.mjs)
  shard.debug.expose('nd.grapple', { hooks: () => sim.course.hooks.map(({ x, y, z }) => ({ x, y, z })), phase: () => sim.phase });
  const tipAt = (): void => {
    muzzle.set(-0.2, -0.23, -0.55).applyQuaternion(ctx.game.camera.quaternion).add(ctx.game.camera.position);
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
  const setCourse = (value: GrappleCourse | null): void => {
    const next = value ?? fragment;
    if (next === sim.course) return;
    if (sim.phase !== 'idle' || sim.holding()) sim.release();
    sim.course = next; hooks = next.hooks; n = hooks.length;
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
  const pickCandidate = (): GrappleTarget | null => {
    if (candidate < 0) return null;
    const hook = hooks[candidate];
    if (hook === undefined || !hookVisible(ports, sim.course, ctx.game.camera.position, hook)) return null;
    const landing = new Vector3();
    const side = landingFor(ports, ctx.player.position, hook, landing);
    return side === NONE ? null : targetFor(ports, sim.course, hook, landing, side);
  };

  // E298: the practice room hangs 900 m over the city: no hook is in it, so LOCK there is the plain lock-on (the nearest
  // hook below would otherwise take the tap, and a zip would leave the room). A playground's room is a practice room too,
  // but it brings its own course (E307): the claw works there
  let inPractice = false;
  shard.app.events.on('practice.active', (on) => { inPractice = on; }, scope);
  const lockPress = (): boolean => {
    if (!enabled() || (inPractice && sim.course === fragment)) return false;
    // Once a crossing starts the safety guard must stay open until a safe landing or bailout (sim.lock: 'busy').
    const result = sim.lock(view, pickCandidate, () => ctx.lock.hasTarget());
    if (result === 'pass') return false;
    if (result === 'armed') {
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast(touchUi ? 'FEI ZHUA READY · FIRE TO SHOOT' : 'FEI ZHUA READY · JUMP TO FIRE');
    } else if (result === 'locked') {
      ctx.lock.unlock();
      ctx.arms?.playLeft?.('grapple_aim');
      ctx.toast(touchUi ? 'DRAGON HOOK LOCKED · ZIP TO FLY' : 'DRAGON HOOK LOCKED · JUMP TO ZIP');
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

  shard.app.addSystem({ id: 'shard.nd.feizhua.input', phase: 'input', before: ['engine.lockon.input', 'engine.player.input'], after: ['engine.input.collect'], when: () => enabled(), run: () => {
    if (input.pressed('lock') && lockPress()) input.consume('lock');
    if (input.pressed('jump') && jumpPress()) input.consume('jump');
  } }, scope);
  shard.app.events.answer('player.traversal', (dt) => {
    if (typeof dt !== 'number') return dt;
    if (!enabled() || sim.phase === 'idle') return false;
    return sim.traverse(dt);
  }, scope);

  shard.app.addSystem({ id: 'fei-zhua.rope', phase: 'fixed.post', run: (dt) => {
    if (sim.phase === 'idle') return;
    time += dt;
    muzzleAge += dt; biteAge += dt; dockAge += dt;
    tipAt();
    const slack = sim.phase === 'fire' ? 1.14 : sim.phase === 'reel' ? 1.20 : 1.005;
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
      if (!hookVisible(ports, sim.course, eye, hook)) { reach[i] = 0; continue; }
      if (landed === 0 && from.distanceToSquared(ctx.player.position) > LANDING_STALE * LANDING_STALE) {
        landed++;
        hasLanding[i] = landingFor(ports, ctx.player.position, hook, landing) === NONE ? 0 : 1;
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
