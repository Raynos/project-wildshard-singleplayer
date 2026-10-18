import * as THREE from 'three';
import { CourseKit as DevKit, courseLabel as devLabel, captureCourse } from '@wildshard/sdk/bake/practiceCourse';
import type { HookPracticeLayout, PracticeScene } from '@wildshard/format/practiceCourse';
import type course from '../data/grappleCourse.json';

type ColliderDesc = PracticeScene['colliders'][number];
type RoomMap = PracticeScene['map'];
type RoomShape = RoomMap['shapes'][number];
type HookCourseRow = typeof course;
type HookCoursePad = HookCourseRow['pads'][number];

/** A pad of the course, in the room's own frame (x east, y up from the pit floor, z south). */


/** A hook as data: a ring on `pad`'s lip, on its edge 'n' | 's' | 'e' | 'w', `along` metres off that edge's middle. */


/** A hook placed: the pad it hangs on and its ring's centre in the room's frame. */
export interface HookCourseHook {
  /** the pad the ring hangs on */
  readonly pad: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A course as data: the room, the pads, the hooks, the run, the piece it registers, its words and colours. */


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

function build(row: HookCourseRow, o: THREE.Vector3): { root: THREE.Group; colliders: ColliderDesc[] } {
    const look = row.look, SLAB = row.slab;
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

export function grappleCourseScene(row: HookCourseRow): HookPracticeLayout { const origin = new THREE.Vector3(); const {root,colliders}=build(row,origin); return { presentation: captureCourse(root,colliders,courseMap(row,origin)), hooks: hookCourseHooks(row), course: row }; }
