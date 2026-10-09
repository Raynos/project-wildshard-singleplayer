import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import { DevKit, devLabel } from '@wildshard/engine/practice/playground/devGrid';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomShape } from '@wildshard/engine/ui/roomMap';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
/**
 * Nine Dragon ▸ Grapple playground (E307, Jake: "a really simple developer level … an acrobatic course for the grappling
 * hook, a custom parkour level to get a feel for the grappling hook and how it works"). A closed dev-grid room high over
 * the fragment (PLAYGROUND_Y) with the course of grappleCourse.ts: a start pad, pads over a pit, a long drop, a tower
 * climbed by three chained hooks to a FINISH cap, and a range line off the start (6 · 14 · 24 · 34 m).
 *
 * The REAL Fei Zhua: the room hands the grapple its own course (grapple/course.ts `setGrappleCourse`) — the same LOCK →
 * GRAPPLE / JUMP → ZIP relabel, markers, rope and FX, on these hooks only. Every slab, pillar and wall is a box registered
 * through the world registry (one piece, `playground-grapple`); the rings are drawn only (the fragment's are collision-free
 * too: the zip flies past a ring onto its pad).
 *
 * The run: the timer starts when you leave START and stops on the FINISH cap (the best is kept for the page). A fall
 * into the pit puts you back on the last pad you stood on, facing its next hook; ↺ on the chip starts over.
 */
import * as THREE from 'three';
import type { GrappleCourse } from '../grapple/course';
import { FeiZhua } from '../grapple/FeiZhua';
import { COLUMN, FALL_Y, HOOKS, PADS, RING_UP, ROOM, RUN, coursePad, padLabelAt, type CoursePad } from './grappleCourse';

const FILE = 'src/shards/nine-dragon-stack/playground/GrapplePlayground.ts';
const SLAB = 1;                  // a pad's slab thickness (m): thick, so the capsule never sinks through (E285)
const GOLD = 0xffc24a;

/** the lowest pad floor: a fall FALL_Y under it is a fall */
const LOWEST = Math.min(...PADS.map((p) => p.top));
/** the way the player faces to look from (x, z) toward (tx, tz): Player.forward is (−sin yaw, −cos yaw) */
const yawToward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(-(tx - x), -(tz - z));

export class GrapplePlayground implements Playground {
  readonly id = 'grapple' as const;
  readonly title = 'Grapple playground';
  readonly center: { x: number; z: number };
  readonly root: THREE.Group;
  /** the room's own map (E321): the walls, the pads, the tower's column, the hooks — the minimap draws this while you run
   *  the course, not the fragment under the room */
  readonly map: RoomMap;
  /** the course's hooks in world space (what the grapple bites) */
  readonly hooks: THREE.Vector3[];
  private readonly course: GrappleCourse;
  private readonly chip: PlaygroundChip;
  private active = false;
  private run: 'ready' | 'running' | 'done' = 'ready';
  private t0 = 0;
  private elapsed = 0;
  private best: number | null = null;
  /** the last pad stood on (a fall comes back here) */
  private checkpoint: CoursePad;
  /** pads reached this run, for the status line */
  private reached = new Set<string>();

  constructor(private readonly host: PlaygroundHost) {
    this.center = { x: host.spawn.x, z: host.spawn.z };
    this.origin = new THREE.Vector3(this.center.x, PLAYGROUND_Y, this.center.z);
    const o = this.origin;
    this.checkpoint = coursePad(RUN.from);
    const { root, colliders } = this.build(o);
    this.root = root;
    root.visible = false;
    host.registry.add({ id: 'playground-grapple', name: 'Grapple playground', category: 'ground', file: FILE, object: root, colliders, surface: 'metal', solidFloor: true });
    this.hooks = HOOKS.map((h) => new THREE.Vector3(o.x + h.x, o.y + h.y, o.z + h.z));
    this.course = { name: this.title, hooks: this.hooks };
    this.map = courseMap(o);
    this.chip = new PlaygroundChip('Grapple', () => { this.restart(); });
    host.game.onUpdate(() => { if (this.active) this.update(); }, 'playground-grapple');
  }

  private tool(): FeiZhua {
    const tool = this.host.game.app.equipment?.tools.find((item) => item instanceof FeiZhua);
    if (!(tool instanceof FeiZhua)) throw new Error('Grapple playground needs the Fei Zhua');
    return tool;
  }

  get entered(): boolean { return this.active; }

  /** the room's pit floor centre, world space (one vector: update() reads it every frame) */
  private readonly origin: THREE.Vector3;

  private build(o: THREE.Vector3): { root: THREE.Group; colliders: ColliderDesc[] } {
    const kit = new DevKit();
    const colliders: ColliderDesc[] = [];
    const solid = (tone: Parameters<DevKit['box']>[0], x: number, y: number, z: number, sx: number, sy: number, sz: number, tint = 1): void => {
      kit.box(tone, o.x + x, o.y + y, o.z + z, sx, sy, sz, tint);
      colliders.push({ kind: 'box', x: o.x + x, y: o.y + y, z: o.z + z, hx: sx / 2, hy: sy / 2, hz: sz / 2 });
    };
    // ── the room: a 4 m pit slab, four walls, a ceiling (drawn from inside) ──
    const R = ROOM, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, W = R.x1 - R.x0, D = R.z1 - R.z0, H = R.height;
    kit.plane('dark', o.x + cx, o.y, o.z + cz, W, D);
    colliders.push({ kind: 'box', x: o.x + cx, y: o.y - 2, z: o.z + cz, hx: W / 2, hy: 2, hz: D / 2 });
    kit.wall('dark', o.x + R.x0, o.y + H / 2, o.z + cz, D, H, 'px');
    kit.wall('dark', o.x + R.x1, o.y + H / 2, o.z + cz, D, H, 'nx');
    kit.wall('dark', o.x + cx, o.y + H / 2, o.z + R.z0, W, H, 'pz');
    kit.wall('dark', o.x + cx, o.y + H / 2, o.z + R.z1, W, H, 'nz');
    for (const [x, z, hx, hz] of [[R.x0, cz, 0.3, D / 2], [R.x1, cz, 0.3, D / 2], [cx, R.z0, W / 2, 0.3], [cx, R.z1, W / 2, 0.3]] as const) {
      colliders.push({ kind: 'box', x: o.x + x, y: o.y + H / 2, z: o.z + z, hx, hy: H / 2, hz });
    }
    const ceiling = new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2).translate(o.x + cx, o.y + H, o.z + cz);
    // ── the pads: a grey slab on an orange pillar; START and FINISH light; the tower's column orange ──
    for (const p of PADS) {
      const tone = p.kind === 'start' || p.kind === 'finish' ? 'light' : 'grey';
      solid(tone, p.x, p.top - SLAB / 2, p.z, p.w, SLAB, p.d);
      if (p.kind !== 'finish') {
        const s = Math.min(2, Math.min(p.w, p.d) * 0.4);
        solid('orange', p.x, (p.top - SLAB) / 2, p.z, s, p.top - SLAB, s, 0.8);
      }
    }
    solid('orange', COLUMN.x, (coursePad('top').top - SLAB) / 2, COLUMN.z, COLUMN.w, coursePad('top').top - SLAB, COLUMN.d);
    const root = kit.build('playground-grapple');
    const ceil = new THREE.Mesh(ceiling, new THREE.MeshBasicMaterial({ color: 0x23272c, fog: false }));
    ceil.name = 'playground-grapple:ceiling';
    root.add(ceil);
    // ── the hooks: a gold ring on a thin dark mast at each pad's lip (drawn only, like the fragment's) ──
    const rings: THREE.BufferGeometry[] = [], masts: THREE.BufferGeometry[] = [];
    for (const h of HOOKS) {
      const p = coursePad(h.pad);
      const faceX = Math.abs(h.x - p.x) > p.w / 2 - 0.01; // an east / west lip: the ring faces along x
      const ringGeo = new THREE.TorusGeometry(0.42, 0.075, 8, 24); // bigger than the fragment's 0.16: a ring must read at 30 m
      if (faceX) ringGeo.rotateY(Math.PI / 2);
      rings.push(ringGeo.translate(o.x + h.x, o.y + h.y, o.z + h.z));
      masts.push(new THREE.BoxGeometry(0.1, RING_UP - 0.42, 0.1).translate(o.x + h.x, o.y + p.top + (RING_UP - 0.42) / 2, o.z + h.z));
    }
    const ringMesh = new THREE.Mesh(mergeAll(rings), new THREE.MeshBasicMaterial({ color: GOLD, fog: false, toneMapped: false }));
    ringMesh.name = 'playground-grapple:hooks';
    const mastMesh = new THREE.Mesh(mergeAll(masts), new THREE.MeshBasicMaterial({ color: 0x2b2f35, fog: false }));
    mastMesh.name = 'playground-grapple:masts';
    root.add(ringMesh, mastMesh);
    // ── the floor paint: each pad's name, the target rings on BASE and FINISH ──
    for (const p of PADS) {
      const label = devLabel(p.label, Math.min(p.w * 0.7, p.label.length * 1.1 + 1), { color: p.kind === 'finish' ? '#b0591b' : p.kind === 'start' ? '#2a2f35' : '#e8f4fa' });
      label.position.set(o.x + p.x, o.y + p.top + 0.02, o.z + p.z + (p.kind === 'target' || p.kind === 'finish' ? p.d * 0.32 : 0));
      root.add(label);
      if (p.kind === 'target' || p.kind === 'finish') root.add(target(o.x + p.x, o.y + p.top + 0.015, o.z + p.z - p.d * 0.05, Math.min(p.w, p.d) * 0.36));
    }
    // a start line across START's north edge (the run starts past it)
    const s = coursePad('start');
    const line = new THREE.Mesh(new THREE.PlaneGeometry(s.w, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe2843a, fog: false }));
    line.position.set(o.x + s.x, o.y + s.top + 0.012, o.z + s.z - s.d / 2 + 0.6);
    root.add(line);
    return { root, colliders };
  }

  enter(): void {
    const { player } = this.host;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    this.tool().setGrappleCourse(this.course);               // the claw bites these hooks now (before the practice flag, which it reads)
    practiceFps.on = true;                        // a tiny scene: mobile runs it at 60 (tier.ts, as the Practice arena)
    playgroundActive(true);                       // ws:practice-active, then #hud.playground-active
    app.events.emit('practice.active', true);
    player.setHover(false);
    this.chip.show(true);
    this.restart();
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    app.setState('play');
    this.root.visible = false;
    this.chip.show(false);
    playgroundActive(false);
    app.events.emit('practice.active', false);
    practiceFps.on = false;
    this.tool().setGrappleCourse(null);
  }

  /** ↺: back on START facing P1, the run reset */
  restart(): void {
    this.run = 'ready'; this.elapsed = 0; this.reached.clear();
    this.checkpoint = coursePad(RUN.from);
    this.place(this.checkpoint, true);
    this.chip.status('READY · ZIP TO P1');
    this.chip.time(0, this.best);
  }

  /** on a pad's floor facing its next pad's hook (the start: at its south end, P1 dead ahead) */
  private place(p: CoursePad, atStart: boolean): void {
    const o = this.origin, player = this.host.player;
    const x = p.x, z = atStart ? p.z + p.d / 2 - 3 : p.z;
    const next = p.next === undefined ? null : coursePad(p.next);
    const yaw = next === null ? 0 : yawToward(x, z, next.x, next.z);
    player.spawn(o.x + x, o.z + z, yaw, o.y + p.top);
    player.velocity.set(0, 0, 0);
    player.pitch = next === null ? -0.1 : Math.atan2(next.top - p.top, Math.hypot(next.x - x, next.z - z)) * 0.8;
  }

  /** the pad under the feet (on its floor), or null — the run's clock reads it, and so do the tests */
  padUnder(): CoursePad | null {
    const o = this.origin, p = this.host.player.position;
    const lx = p.x - o.x, ly = p.y - o.y, lz = p.z - o.z;
    for (const pad of PADS) {
      if (Math.abs(lx - pad.x) <= pad.w / 2 && Math.abs(lz - pad.z) <= pad.d / 2 && Math.abs(ly - pad.top) < 0.35) return pad;
    }
    return null;
  }

  private update(): void {
    const { player } = this.host;
    if (player.hover) player.setHover(false); // no board in the dev room (as in the Practice arena)
    const o = this.origin, p = player.position;
    const pad = player.onGround ? this.padUnder() : null;
    if (pad !== null) {
      this.checkpoint = pad;
      if (pad.kind !== 'start' && pad.kind !== 'range') this.reached.add(pad.id);
    }
    // the run starts across START's line (its north edge, toward P1; the range line off its west side does not count)
    // and stops on the FINISH cap
    const s = coursePad(RUN.from);
    if (this.run === 'ready' && p.z - o.z < s.z - s.d / 2 && p.x - o.x > s.x - s.w / 2 - 1) { this.run = 'running'; this.t0 = performance.now(); }
    if (this.run === 'running') {
      this.elapsed = (performance.now() - this.t0) / 1000;
      if (pad?.id === RUN.to) {
        this.run = 'done';
        this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
        this.chip.status(`FINISH · ${clock(this.elapsed)}`, 'done');
        this.host.toast(`GRAPPLE COURSE · ${clock(this.elapsed)}${this.best === this.elapsed ? ' · BEST' : ''} · ↺ TO RUN AGAIN`);
      } else this.chip.status(pad !== null ? `RUNNING · ${pad.label}` : `RUNNING · ${this.reached.size} / 5`, 'go');
    }
    this.chip.time(this.elapsed, this.best);
    // a fall into the pit: back on the last pad, facing its next hook
    if (p.y < o.y + LOWEST - FALL_Y) {
      this.place(this.checkpoint, this.checkpoint.id === RUN.from);
      this.host.toast(`FELL · BACK ON ${this.checkpoint.label}`);
    }
  }
}

/** the room as map shapes, world x / z (src/engine/ui/roomMap.ts): the walls, the column, the pads (START / FINISH light), the gold
 *  hooks, the pads' names on the full map */
function courseMap(o: THREE.Vector3): RoomMap {
  const R = ROOM, box = { x0: o.x + R.x0, z0: o.z + R.z0, x1: o.x + R.x1, z1: o.z + R.z1 };
  const rect = (x: number, z: number, w: number, d: number, fill: string, stroke?: string): RoomShape => ({ kind: 'rect', x0: o.x + x - w / 2, z0: o.z + z - d / 2, x1: o.x + x + w / 2, z1: o.z + z + d / 2, fill, ...(stroke !== undefined ? { stroke } : {}) });
  const shapes: RoomShape[] = [
    { kind: 'rect', ...box, fill: '#15191e' },
    { kind: 'grid', ...box, step: 10, color: 'rgba(117, 217, 255, 0.12)' },
    { kind: 'rect', ...box, stroke: '#75d9ff' },
    rect(COLUMN.x, COLUMN.z, COLUMN.w, COLUMN.d, '#b0591b'),
  ];
  for (const p of PADS) {
    const lit = p.kind === 'start' || p.kind === 'finish';
    shapes.push(rect(p.x, p.z, p.w, p.d, lit ? '#d7dde2' : '#6c737b', p.kind === 'finish' ? '#e2843a' : undefined));
  }
  for (const h of HOOKS) shapes.push({ kind: 'dot', x: o.x + h.x, z: o.z + h.z, r: 1.4, color: '#ffc24a' });
  for (const p of PADS) if (p.kind !== 'range') { const at = padLabelAt(p); shapes.push({ kind: 'label', x: o.x + at.x, z: o.z + at.z, text: p.label, color: p.kind === 'finish' ? '#e2843a' : '#e8f4fa' }); }
  return { bounds: box, shapes };
}

function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // rings / masts are all non-indexed-alike three primitives (indexed): merge by hand-free concat through a group
  const g = new THREE.BufferGeometry();
  const pos: number[] = [], idx: number[] = [];
  let base = 0;
  for (const part of list) {
    const p = part.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const index = part.getIndex();
    if (index !== null) for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
    base += p.count;
    part.dispose();
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** a landing target painted on a floor: three orange rings round an orange dot, one draw */
function target(x: number, y: number, z: number, r: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [new THREE.CircleGeometry(r * 0.16, 24)];
  for (const k of [0.42, 0.7, 0.98]) parts.push(new THREE.RingGeometry(r * (k - 0.1), r * k, 40));
  const g = mergeAll(parts).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe2843a, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.position.set(x, y, z);
  m.name = 'playground-grapple:target';
  return m;
}
