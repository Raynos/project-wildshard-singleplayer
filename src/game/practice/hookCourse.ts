import type { HookPracticeLayout, HookPracticeRow } from '@wildshard/format/practiceCourse';
import { buildPracticeScene } from './scene';
import { GrappleTool } from '../grapple/tool';

import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { PlaygroundId } from '@wildshard/engine/practice/playground/catalog';
import type { RoomMap } from '@wildshard/engine/ui/roomMap';

type HookCourseRow = HookPracticeRow;
type HookCoursePad = HookCourseRow['pads'][number];

/** A pad of the course, in the room's own frame (x east, y up from the pit floor, z south). */


/** What a course hands the tool: its name and the rings' centres, world space. */
export interface HookCourseCourse {
  readonly name: string;
  readonly hooks: readonly THREE.Vector3[];
}

/** a pad of the row by id (throws on an unknown one) */
export function hookCoursePad(row: HookCourseRow, id: string): HookCoursePad {
  const p = row.pads.find((q) => q.id === id);
  if (p === undefined) throw new Error(`hook course: no pad ${id}`);
  return p;
}

const fill = (text: string, words: Readonly<Record<string, string | number>>): string => text.replaceAll(/\{(\w+)\}/gu, (all, key: string) => String(words[key] ?? all));

/** the way the player faces to look from (x, z) toward (tx, tz): Player.forward is (−sin yaw, −cos yaw) */
const yawToward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(-(tx - x), -(tz - z));

/** Client-only timed practice runner driven entirely by admitted room/pad rows. */
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

  constructor(host: PlaygroundHost, layout: HookPracticeLayout) {
    this.host = host;
    const row = layout.course;
    this.row = row;
    this.id = 'grapple';
    this.title = row.title;
    this.lowest = Math.min(...row.pads.map((p) => p.top));
    this.center = { x: host.spawn.x, z: host.spawn.z };
    this.origin = new THREE.Vector3(this.center.x, PLAYGROUND_Y, this.center.z);
    const o = this.origin;
    this.checkpoint = hookCoursePad(row, row.run.from);
    const { root, colliders, map } = buildPracticeScene(layout.presentation, o, row.piece.id);
    this.root = root;
    root.visible = false;
    host.registry.add({ id: row.piece.id, name: row.piece.name, category: 'ground', file: row.piece.file, object: root, colliders, surface: 'metal', solidFloor: true });
    this.hooks = layout.hooks.map((h) => new THREE.Vector3(o.x + h.x, o.y + h.y, o.z + h.z));
    this.course = { name: this.title, hooks: this.hooks };
    this.map = map;
    this.chip = new PlaygroundChip(row.chip, () => { this.restart(); });
    host.game.onUpdate(() => { if (this.active) this.update(); }, row.piece.id);
  }

  private tool(): GrappleTool {
    const tool = this.host.game.app.equipment?.tools.find(item => item instanceof GrappleTool);
    if (!(tool instanceof GrappleTool)) throw new Error('Hook practice needs the equipped grapple tool');
    return tool;
  }

  get entered(): boolean { return this.active; }

  enter(): void {
    const { player } = this.host;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    this.tool().setGrappleCourse(this.course);  // the tool bites these hooks now (before the practice flag, which it reads)
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
    if (this.run === 'ready' && p.z - o.z < s.z - s.d / 2 && p.x - o.x > s.x - s.w / 2 - 1) { this.run = 'running'; this.t0 = performance.now(); }
    if (this.run === 'running') {
      this.elapsed = (performance.now() - this.t0) / 1000;
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

