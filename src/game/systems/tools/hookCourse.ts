// hookCourse — a grapple tool's practice course as a playground (SHARD-PLATFORM M3, ex Nine Dragon's
// playground/GrapplePlayground.ts). Nothing here knows a shard: the course (the room, the pads, the hooks on their lips, the
// run, its words and colours) is a data row (`HookCourseRow`), and the tool that bites the hooks is the caller's.
//
// A closed dev-grid room high over the shard (PLAYGROUND_Y): pads over a pit, each a slab on a pillar (a finish cap on the
// row's column), a gold ring on a thin mast at a pad's lip for every hook (drawn only: the zip flies past a ring onto its
// pad), the pads' names and the target rings painted on their floors, a start line across the start's far edge. Every slab,
// pillar and wall is a box registered through the world registry as one piece. While the room is open the tool bites only
// its hooks (`setGrappleCourse`).
//
// The run: the timer starts when you cross the start's line and stops on the finish pad (the best is kept for the page). A
// fall into the pit puts you back on the last pad you stood on, facing its next pad; ↺ on the chip starts over.
//
//   class MyPlayground extends HookCoursePlayground { constructor(host) { super(host, COURSE_ROW, { tool: () => myTool(host), now }); } }
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Material } from '@wildshard/engine/physics/surface';
import { DevKit, devLabel } from '@wildshard/engine/practice/playground/devGrid';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { PlaygroundId } from '@wildshard/engine/practice/playground/catalog';
import type { RoomMap, RoomShape } from '@wildshard/engine/ui/roomMap';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

/** A pad of the course, in the room's own frame (x east, y up from the pit floor, z south). */
export interface HookCoursePad {
  readonly id: string;
  /** what the floor label says */
  readonly label: string;
  readonly x: number;
  readonly z: number;
  /** full size across (x) and along (z) */
  readonly w: number;
  readonly d: number;
  /** the floor's height over the pit */
  readonly top: number;
  /** start and finish are lit; target and finish wear target rings; a ledge's map label goes out past its edge; a range pad
   *  is off the run (not counted, no map label); the finish has no pillar (it caps the column) */
  readonly kind: 'start' | 'pad' | 'target' | 'ledge' | 'finish' | 'range';
  /** the pad whose hook comes next (the respawn faces it) */
  readonly next?: string;
}

/** A hook as data: a ring on `pad`'s lip, on its edge 'n' | 's' | 'e' | 'w', `along` metres off that edge's middle. */
export interface HookCourseRing {
  readonly pad: string;
  readonly edge: 'n' | 's' | 'e' | 'w';
  readonly along?: number;
}

/** A hook placed: the pad it hangs on and its ring's centre in the room's frame. */
export interface HookCourseHook {
  /** the pad the ring hangs on */
  readonly pad: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A course as data: the room, the pads, the hooks, the run, the piece it registers, its words and colours. */
export interface HookCourseRow {
  readonly id: PlaygroundId;
  readonly title: string;
  /** the chip's name */
  readonly chip: string;
  /** the registered piece (one for the whole room) and the update hook's id */
  readonly piece: { readonly id: string; readonly name: string; readonly file: string; readonly surface: Material };
  /** the room: the pit floor at 0, walls round it, the ceiling over the course */
  readonly room: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly height: number };
  /** a ring hangs this far over its pad's floor, this far out past its lip */
  readonly ringUp: number;
  readonly ringOut: number;
  /** a fall this far under the lowest pad puts you back on the last pad you stood on */
  readonly fallY: number;
  /** a pad's slab thickness (m): thick, so the capsule never sinks through */
  readonly slab: number;
  readonly pads: readonly HookCoursePad[];
  /** the column under the finish cap */
  readonly column: { readonly x: number; readonly z: number; readonly w: number; readonly d: number };
  readonly hooks: readonly HookCourseRing[];
  /** the run: from leaving `from` (across its far edge) to standing on `to`; `goals` the pads counted on the way */
  readonly run: { readonly from: string; readonly to: string; readonly goals: number };
  /** the chip's and the toasts' words: `{time}`, `{best}`, `{pad}`, `{reached}`, `{goals}` are filled in */
  readonly words: {
    readonly ready: string; readonly finish: string; readonly running: string; readonly between: string;
    readonly done: string; readonly best: string; readonly fell: string;
  };
  /** the room's colours (the dev kit's tones, hex colours, CSS colours for the labels and the map) */
  readonly look: {
    readonly ceiling: number; readonly ring: number; readonly mast: number; readonly paint: number;
    readonly label: string; readonly startLabel: string; readonly finishLabel: string;
    readonly map: {
      readonly floor: string; readonly grid: string; readonly wall: string; readonly column: string; readonly lit: string;
      readonly pad: string; readonly finish: string; readonly hook: string; readonly label: string;
    };
  };
}

/** What a course hands the tool: its name and the rings' centres, world space. */
export interface HookCourseCourse {
  readonly name: string;
  readonly hooks: readonly THREE.Vector3[];
}

/** The tool that bites the course's hooks while the room is open (null: its own course again). */
export interface HookCourseTool {
  setGrappleCourse: (course: HookCourseCourse | null) => void;
}

/** What only the caller has: the tool that bites the hooks (looked up on entry) and the run clock (ms). */
export interface HookCourseHooks {
  readonly tool: () => HookCourseTool;
  readonly now: () => number;
}

type Tone = Parameters<DevKit['box']>[0];

/** a pad of the row by id (throws on an unknown one) */
export function hookCoursePad(row: HookCourseRow, id: string): HookCoursePad {
  const p = row.pads.find((q) => q.id === id);
  if (p === undefined) throw new Error(`hook course: no pad ${id}`);
  return p;
}

/** the row's hooks placed: each ring on its pad's lip, `ringUp` over its floor, `ringOut` past its edge */
export function hookCourseHooks(row: HookCourseRow): HookCourseHook[] {
  return row.hooks.map(({ pad: id, edge, along = 0 }) => {
    const p = hookCoursePad(row, id), y = p.top + row.ringUp, out = row.ringOut;
    if (edge === 's') return { pad: id, x: p.x + along, y, z: p.z + p.d / 2 + out };
    if (edge === 'n') return { pad: id, x: p.x + along, y, z: p.z - p.d / 2 - out };
    if (edge === 'e') return { pad: id, x: p.x + p.w / 2 + out, y, z: p.z + along };
    return { pad: id, x: p.x - p.w / 2 - out, y, z: p.z + along };
  });
}

/** where a pad's name sits on the full map: on the pad, but a ledge's goes out past its edge away from the column, so a
 *  ledge's never lands on the finish's */
export function hookCoursePadLabelAt(row: HookCourseRow, p: HookCoursePad): { x: number; z: number } {
  if (p.kind !== 'ledge') return { x: p.x, z: p.z };
  const dx = p.x - row.column.x, dz = p.z - row.column.z;
  return Math.abs(dx) >= Math.abs(dz) ? { x: p.x + Math.sign(dx) * (p.w / 2 + 3), z: p.z } : { x: p.x, z: p.z + Math.sign(dz) * (p.d / 2 + 3) };
}

const fill = (text: string, words: Readonly<Record<string, string | number>>): string => text.replaceAll(/\{(\w+)\}/gu, (all, key: string) => String(words[key] ?? all));

/** the way the player faces to look from (x, z) toward (tx, tz): Player.forward is (−sin yaw, −cos yaw) */
const yawToward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(-(tx - x), -(tz - z));

/** A grapple tool's practice course: a dev-grid room of pads and hooks from a data row, timed, with fall-back to the last pad. */
export class HookCoursePlayground implements Playground {
  readonly id: PlaygroundId;
  readonly title: string;
  readonly center: { x: number; z: number };
  readonly root: THREE.Group;
  /** the room's own map (E321): the walls, the pads, the column, the hooks — the minimap draws this while you run the
   *  course, not the shard under the room */
  readonly map: RoomMap;
  /** the course's hooks in world space (what the grapple bites) */
  readonly hooks: THREE.Vector3[];
  private readonly host: PlaygroundHost;
  private readonly row: HookCourseRow;
  private readonly caller: HookCourseHooks;
  private readonly course: HookCourseCourse;
  private readonly chip: PlaygroundChip;
  /** the lowest pad floor: a fall `fallY` under it is a fall */
  private readonly lowest: number;
  private active = false;
  private run: 'ready' | 'running' | 'done' = 'ready';
  private t0 = 0;
  private elapsed = 0;
  private best: number | null = null;
  /** the last pad stood on (a fall comes back here) */
  private checkpoint: HookCoursePad;
  /** pads reached this run, for the status line */
  private reached = new Set<string>();
  /** the room's pit floor centre, world space (one vector: update() reads it every frame) */
  private readonly origin: THREE.Vector3;

  constructor(host: PlaygroundHost, row: HookCourseRow, caller: HookCourseHooks) {
    this.host = host;
    this.row = row;
    this.caller = caller;
    this.id = row.id;
    this.title = row.title;
    this.lowest = Math.min(...row.pads.map((p) => p.top));
    this.center = { x: host.spawn.x, z: host.spawn.z };
    this.origin = new THREE.Vector3(this.center.x, PLAYGROUND_Y, this.center.z);
    const o = this.origin;
    this.checkpoint = hookCoursePad(row, row.run.from);
    const { root, colliders } = this.build(o);
    this.root = root;
    root.visible = false;
    host.registry.add({ id: row.piece.id, name: row.piece.name, category: 'ground', file: row.piece.file, object: root, colliders, surface: row.piece.surface, solidFloor: true });
    this.hooks = hookCourseHooks(row).map((h) => new THREE.Vector3(o.x + h.x, o.y + h.y, o.z + h.z));
    this.course = { name: this.title, hooks: this.hooks };
    this.map = courseMap(row, o);
    this.chip = new PlaygroundChip(row.chip, () => { this.restart(); });
    host.game.onUpdate(() => { if (this.active) this.update(); }, row.piece.id);
  }

  get entered(): boolean { return this.active; }

  private build(o: THREE.Vector3): { root: THREE.Group; colliders: ColliderDesc[] } {
    const row = this.row, look = row.look, SLAB = row.slab;
    const kit = new DevKit();
    const colliders: ColliderDesc[] = [];
    const solid = (tone: Tone, x: number, y: number, z: number, sx: number, sy: number, sz: number, tint = 1): void => {
      kit.box(tone, o.x + x, o.y + y, o.z + z, sx, sy, sz, tint);
      colliders.push({ kind: 'box', x: o.x + x, y: o.y + y, z: o.z + z, hx: sx / 2, hy: sy / 2, hz: sz / 2 });
    };
    // ── the room: a 4 m pit slab, four walls, a ceiling (drawn from inside) ──
    const R = row.room, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, W = R.x1 - R.x0, D = R.z1 - R.z0, H = R.height;
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
    // ── the pads: a grey slab on an orange pillar; start and finish light; the column orange ──
    for (const p of row.pads) {
      const tone = p.kind === 'start' || p.kind === 'finish' ? 'light' : 'grey';
      solid(tone, p.x, p.top - SLAB / 2, p.z, p.w, SLAB, p.d);
      if (p.kind !== 'finish') {
        const s = Math.min(2, Math.min(p.w, p.d) * 0.4);
        solid('orange', p.x, (p.top - SLAB) / 2, p.z, s, p.top - SLAB, s, 0.8);
      }
    }
    const C = row.column, capTop = hookCoursePad(row, row.run.to).top;
    solid('orange', C.x, (capTop - SLAB) / 2, C.z, C.w, capTop - SLAB, C.d);
    const root = kit.build(row.piece.id);
    const ceil = new THREE.Mesh(ceiling, new THREE.MeshBasicMaterial({ color: look.ceiling, fog: false }));
    ceil.name = `${row.piece.id}:ceiling`;
    root.add(ceil);
    // ── the hooks: a gold ring on a thin dark mast at each pad's lip (drawn only) ──
    const rings: THREE.BufferGeometry[] = [], masts: THREE.BufferGeometry[] = [];
    for (const h of hookCourseHooks(row)) {
      const p = hookCoursePad(row, h.pad);
      const faceX = Math.abs(h.x - p.x) > p.w / 2 - 0.01; // an east / west lip: the ring faces along x
      const ringGeo = new THREE.TorusGeometry(0.42, 0.075, 8, 24); // a ring must read at 30 m
      if (faceX) ringGeo.rotateY(Math.PI / 2);
      rings.push(ringGeo.translate(o.x + h.x, o.y + h.y, o.z + h.z));
      masts.push(new THREE.BoxGeometry(0.1, row.ringUp - 0.42, 0.1).translate(o.x + h.x, o.y + p.top + (row.ringUp - 0.42) / 2, o.z + h.z));
    }
    const ringMesh = new THREE.Mesh(mergeAll(rings), new THREE.MeshBasicMaterial({ color: look.ring, fog: false, toneMapped: false }));
    ringMesh.name = `${row.piece.id}:hooks`;
    const mastMesh = new THREE.Mesh(mergeAll(masts), new THREE.MeshBasicMaterial({ color: look.mast, fog: false }));
    mastMesh.name = `${row.piece.id}:masts`;
    root.add(ringMesh, mastMesh);
    // ── the floor paint: each pad's name, the target rings on the target and finish pads ──
    for (const p of row.pads) {
      const label = devLabel(p.label, Math.min(p.w * 0.7, p.label.length * 1.1 + 1), { color: p.kind === 'finish' ? look.finishLabel : p.kind === 'start' ? look.startLabel : look.label });
      label.position.set(o.x + p.x, o.y + p.top + 0.02, o.z + p.z + (p.kind === 'target' || p.kind === 'finish' ? p.d * 0.32 : 0));
      root.add(label);
      if (p.kind === 'target' || p.kind === 'finish') root.add(target(row, o.x + p.x, o.y + p.top + 0.015, o.z + p.z - p.d * 0.05, Math.min(p.w, p.d) * 0.36));
    }
    // a start line across the start's far edge (the run starts past it)
    const s = hookCoursePad(row, row.run.from);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(s.w, 0.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: look.paint, fog: false }));
    line.position.set(o.x + s.x, o.y + s.top + 0.012, o.z + s.z - s.d / 2 + 0.6);
    root.add(line);
    return { root, colliders };
  }

  enter(): void {
    const { player } = this.host;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    this.caller.tool().setGrappleCourse(this.course);  // the tool bites these hooks now (before the practice flag, which it reads)
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
    this.caller.tool().setGrappleCourse(null);
  }

  /** ↺: back on the start facing its next pad, the run reset */
  restart(): void {
    this.run = 'ready'; this.elapsed = 0; this.reached.clear();
    this.checkpoint = hookCoursePad(this.row, this.row.run.from);
    this.place(this.checkpoint, true);
    this.chip.status(this.row.words.ready);
    this.chip.time(0, this.best);
  }

  /** on a pad's floor facing its next pad's hook (the start: 3 m in from its near end, the next pad dead ahead) */
  private place(p: HookCoursePad, atStart: boolean): void {
    const o = this.origin, player = this.host.player;
    const x = p.x, z = atStart ? p.z + p.d / 2 - 3 : p.z;
    const next = p.next === undefined ? null : hookCoursePad(this.row, p.next);
    const yaw = next === null ? 0 : yawToward(x, z, next.x, next.z);
    player.spawn(o.x + x, o.z + z, yaw, o.y + p.top);
    player.velocity.set(0, 0, 0);
    player.pitch = next === null ? -0.1 : Math.atan2(next.top - p.top, Math.hypot(next.x - x, next.z - z)) * 0.8;
  }

  /** the pad under the feet (on its floor), or null — the run's clock reads it, and so do the tests */
  padUnder(): HookCoursePad | null {
    const o = this.origin, p = this.host.player.position;
    const lx = p.x - o.x, ly = p.y - o.y, lz = p.z - o.z;
    for (const pad of this.row.pads) {
      if (Math.abs(lx - pad.x) <= pad.w / 2 && Math.abs(lz - pad.z) <= pad.d / 2 && Math.abs(ly - pad.top) < 0.35) return pad;
    }
    return null;
  }

  private update(): void {
    const { player } = this.host;
    const row = this.row, words = row.words;
    if (player.hover) player.setHover(false); // no board in the dev room (as in the Practice arena)
    const o = this.origin, p = player.position;
    const pad = player.onGround ? this.padUnder() : null;
    if (pad !== null) {
      this.checkpoint = pad;
      if (pad.kind !== 'start' && pad.kind !== 'range') this.reached.add(pad.id);
    }
    // the run starts across the start's line (its far edge, toward the next pad; a range line off its west side does not
    // count) and stops on the finish pad
    const s = hookCoursePad(row, row.run.from);
    if (this.run === 'ready' && p.z - o.z < s.z - s.d / 2 && p.x - o.x > s.x - s.w / 2 - 1) { this.run = 'running'; this.t0 = this.caller.now(); }
    if (this.run === 'running') {
      this.elapsed = (this.caller.now() - this.t0) / 1000;
      if (pad?.id === row.run.to) {
        this.run = 'done';
        this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
        const time = clock(this.elapsed);
        this.chip.status(fill(words.finish, { time }), 'done');
        this.host.toast(fill(words.done, { time, best: this.best === this.elapsed ? words.best : '' }));
      } else this.chip.status(pad !== null ? fill(words.running, { pad: pad.label }) : fill(words.between, { reached: this.reached.size, goals: row.run.goals }), 'go');
    }
    this.chip.time(this.elapsed, this.best);
    // a fall into the pit: back on the last pad, facing its next hook
    if (p.y < o.y + this.lowest - row.fallY) {
      this.place(this.checkpoint, this.checkpoint.id === row.run.from);
      this.host.toast(fill(words.fell, { pad: this.checkpoint.label }));
    }
  }
}

/** the room as map shapes, world x / z (src/engine/ui/roomMap.ts): the walls, the column, the pads (start / finish light),
 *  the hooks, the pads' names on the full map */
function courseMap(row: HookCourseRow, o: THREE.Vector3): RoomMap {
  const R = row.room, M = row.look.map, C = row.column, box = { x0: o.x + R.x0, z0: o.z + R.z0, x1: o.x + R.x1, z1: o.z + R.z1 };
  const rect = (x: number, z: number, w: number, d: number, fillColor: string, stroke?: string): RoomShape => ({ kind: 'rect', x0: o.x + x - w / 2, z0: o.z + z - d / 2, x1: o.x + x + w / 2, z1: o.z + z + d / 2, fill: fillColor, ...(stroke !== undefined ? { stroke } : {}) });
  const shapes: RoomShape[] = [
    { kind: 'rect', ...box, fill: M.floor },
    { kind: 'grid', ...box, step: 10, color: M.grid },
    { kind: 'rect', ...box, stroke: M.wall },
    rect(C.x, C.z, C.w, C.d, M.column),
  ];
  for (const p of row.pads) {
    const lit = p.kind === 'start' || p.kind === 'finish';
    shapes.push(rect(p.x, p.z, p.w, p.d, lit ? M.lit : M.pad, p.kind === 'finish' ? M.finish : undefined));
  }
  for (const h of hookCourseHooks(row)) shapes.push({ kind: 'dot', x: o.x + h.x, z: o.z + h.z, r: 1.4, color: M.hook });
  for (const p of row.pads) if (p.kind !== 'range') { const at = hookCoursePadLabelAt(row, p); shapes.push({ kind: 'label', x: o.x + at.x, z: o.z + at.z, text: p.label, color: p.kind === 'finish' ? M.finish : M.label }); }
  return { bounds: box, shapes };
}

/** concatenate indexed three primitives into one position-only indexed geometry (each part disposed) */
function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

/** a landing target painted on a floor: three rings round a dot, one draw */
function target(row: HookCourseRow, x: number, y: number, z: number, r: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [new THREE.CircleGeometry(r * 0.16, 24)];
  for (const k of [0.42, 0.7, 0.98]) parts.push(new THREE.RingGeometry(r * (k - 0.1), r * k, 40));
  const g = mergeAll(parts).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: row.look.paint, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.position.set(x, y, z);
  m.name = `${row.piece.id}:target`;
  return m;
}
