import * as THREE from 'three';
import { CourseKit as DevKit, courseLabel as devLabel, courseMaterial as devMaterial, courseChecker as checkerLine, captureCourse } from '@wildshard/sdk/bake/practiceCourse';
import type { RidingPracticeLayout, PracticeScene } from '@wildshard/format/practiceCourse';
import { FIELD, HORSE_START, JUMPS, JUMP_WIDTH, LINE_X, OVAL, POST_GAP, POST_OFF, RIDER_START, ovalLine } from './horseCourse';

type ColliderDesc = PracticeScene['colliders'][number];
type RoomMap = PracticeScene['map'];
type RoomShape = RoomMap['shapes'][number];
function build(o: THREE.Vector3): { root: THREE.Group; colliders: ColliderDesc[] } {
    const kit = new DevKit();
    const colliders: ColliderDesc[] = [];
    const solid = (tone: Parameters<DevKit['box']>[0], x: number, y: number, z: number, sx: number, sy: number, sz: number, surface?: 'wood' | 'metal'): void => {
      kit.box(tone, o.x + x, o.y + y, o.z + z, sx, sy, sz);
      colliders.push({ kind: 'box', x: o.x + x, y: o.y + y, z: o.z + z, hx: sx / 2, hy: sy / 2, hz: sz / 2, ...(surface ? { surface } : {}) });
    };
    const F = FIELD, W = F.x1 - F.x0, D = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
    // ── the field: a grass-green dev floor on a 4 m slab, grey walls round it (drawn both sides: the field is open) ──
    kit.plane('field', o.x + cx, o.y, o.z + cz, W, D);
    colliders.push({ kind: 'box', x: o.x + cx, y: o.y - 2, z: o.z + cz, hx: W / 2, hy: 2, hz: D / 2, surface: 'ground' });
    const t = 0.6;
    solid('grey', F.x0 - t / 2, F.wall / 2, cz, t, F.wall, D + 2 * t);
    solid('grey', F.x1 + t / 2, F.wall / 2, cz, t, F.wall, D + 2 * t);
    solid('grey', cx, F.wall / 2, F.z0 - t / 2, W, F.wall, t);
    solid('grey', cx, F.wall / 2, F.z1 + t / 2, W, F.wall, t);
    // ── the posts either side of the track, every POST_GAP m along it ──
    const line = ovalLine(1);
    let run = POST_GAP / 2;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (a === undefined || b === undefined) continue;
      run += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (run < POST_GAP) continue;
      run = 0;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      for (const side of [-1, 1]) solid('light', b[0] + nx * POST_OFF * side, 0.65, b[1] + nz * POST_OFF * side, 0.25, 1.3, 0.25);
    }
    // ── the jump lane: four orange rails across the infield, a grey post at each end ──
    for (const j of JUMPS) {
      solid('orange', j.x, j.h - 0.15, 0, 0.2, 0.3, JUMP_WIDTH, 'wood');
      solid('orange', j.x, (j.h - 0.3) / 2, 0, 0.12, j.h - 0.3, JUMP_WIDTH - 1, 'wood');
      for (const s of [-1, 1]) solid('grey', j.x, (j.h + 0.3) / 2, s * (JUMP_WIDTH / 2 + 0.2), 0.3, j.h + 0.3, 0.3);
    }
    // ── the start / finish gate over the front straight, the half-way gate over the back ──
    for (const [z, tall] of [[OVAL.radius, 6], [-OVAL.radius, 4]] as const) {
      for (const s of [-1, 1]) solid('orange', LINE_X, tall / 2, z + s * (OVAL.width / 2 + 1.5), 0.4, tall, 0.4);
    }
    const root = kit.build('playground-horse');
    // the track: a sand band, 12 m wide, just over the floor (drawn only: the horse runs on the field's slab)
    root.add(trackBand(o));
    // the lines across the track: checkered at the start / finish, orange at half way
    root.add(checkerLine(o.x + LINE_X, o.y + 0.03, o.z + OVAL.radius, OVAL.width + 2));
    const half = new THREE.Mesh(new THREE.PlaneGeometry(0.8, OVAL.width).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe2843a, fog: false }));
    half.position.set(o.x + LINE_X, o.y + 0.03, o.z - OVAL.radius);
    root.add(half);
    // the banners on the gates: one each way, back to back, so neither side reads mirrored
    for (const [z, y, text] of [[OVAL.radius, 5.4, 'START · FINISH'], [-OVAL.radius, 3.5, 'HALF WAY']] as const) {
      for (const face of [Math.PI / 2, -Math.PI / 2]) {
        const banner = devLabel(text, OVAL.width + 3, { standing: true, back: '#0d1b26', color: '#8fe3ff' });
        banner.rotation.y = face;
        banner.position.set(o.x + LINE_X + Math.sign(face) * 0.02, o.y + y, o.z + z);
        root.add(banner);
      }
    }
    // floor paint: the jumps' heights, the running direction on the front straight
    for (const j of JUMPS) {
      const l = devLabel(`${j.h.toFixed(1)} M`, 3.2, { color: '#e8f4fa' });
      l.position.set(o.x + j.x - 2.6, o.y + 0.03, o.z + 5.2);
      root.add(l);
    }
    // the running direction in dark floor paint, like the grid's own lines: unlit near-white glyphs (MeshBasic, no tone
    // map) glowed, and from the saddle at a gallop the middle ▶ peeked over the horse's poll as a floating white
    // triangle — the rest of the row hidden by the head (E320 follow-up)
    const arrow = devLabel('▶ ▶ ▶', 7, { color: '#7a5530' });
    arrow.position.set(o.x + LINE_X + 16, o.y + 0.035, o.z + OVAL.radius);
    root.add(arrow);
    return { root, colliders };
  }

/** the field as map shapes, world x / z (src/engine/ui/roomMap.ts): what the minimap and the full map draw while the field is up */
function fieldMap(o: THREE.Vector3): Omit<RoomMap, 'markers'> {
  const F = FIELD, w = (x: number, z: number): [number, number] => [o.x + x, o.z + z];
  const shapes: RoomShape[] = [
    { kind: 'rect', x0: o.x + F.x0, z0: o.z + F.z0, x1: o.x + F.x1, z1: o.z + F.z1, fill: '#123326', stroke: '#9aa6ae' },
    { kind: 'path', pts: ovalLine(2).map(([x, z]) => w(x, z)), width: OVAL.width, color: '#c9a468', closed: true },
  ];
  // the posts either side of the band (as the field builds them: every POST_GAP m along the line)
  const line = ovalLine(1);
  let run = POST_GAP / 2;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (a === undefined || b === undefined) continue;
    run += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (run < POST_GAP) continue;
    run = 0;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const side of [-1, 1]) shapes.push({ kind: 'dot', x: o.x + b[0] + nx * POST_OFF * side, z: o.z + b[1] + nz * POST_OFF * side, r: 0.7, color: '#e8f4fa' });
  }
  const half = OVAL.width / 2 + 1;
  shapes.push(
    { kind: 'path', pts: [w(LINE_X, OVAL.radius - half), w(LINE_X, OVAL.radius + half)], width: 2.4, color: '#f2f4f6' },     // START · FINISH
    { kind: 'path', pts: [w(LINE_X, -OVAL.radius - half), w(LINE_X, -OVAL.radius + half)], width: 2.4, color: '#e2843a' },   // HALF WAY
    ...JUMPS.map((j): RoomShape => ({ kind: 'path', pts: [w(j.x, -JUMP_WIDTH / 2), w(j.x, JUMP_WIDTH / 2)], width: 1.6, color: '#e2843a' })),
    { kind: 'label', x: o.x + LINE_X, z: o.z + OVAL.radius + half + 5, text: 'START · FINISH', color: '#f2f4f6' },
    { kind: 'label', x: o.x + LINE_X, z: o.z - OVAL.radius - half - 5, text: 'HALF WAY', color: '#e2843a' },
    { kind: 'label', x: o.x, z: o.z + 9, text: 'JUMPS', color: '#e8f4fa' },
  );
  return { bounds: { x0: o.x + F.x0, z0: o.z + F.z0, x1: o.x + F.x1, z1: o.z + F.z1 }, shapes };
}

/** the track: a 12 m sand band along the oval's centre line, world-aligned metre UVs, one draw */
function trackBand(o: THREE.Vector3): THREE.Mesh {
  const line = ovalLine(2), half = OVAL.width / 2;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], c = line[i];
    if (a === undefined || b === undefined || c === undefined) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const s of [-1, 1]) {
      const x = o.x + c[0] + nx * half * s, z = o.z + c[1] + nz * half * s;
      pos.push(x, o.y + 0.02, z); uv.push(x / 4, -z / 4); col.push(1, 1, 1);
    }
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = devMaterial('sand').clone();
  mat.side = THREE.DoubleSide; mat.polygonOffset = true; mat.polygonOffsetFactor = -1;
  const m = new THREE.Mesh(g, mat);
  m.name = 'playground-horse:track';
  return m;
}


export function horseCourseRows(): RidingPracticeLayout { const origin = new THREE.Vector3(); const {root,colliders}=build(origin); return { presentation: captureCourse(root,colliders,fieldMap(origin)), road: ovalLine(4), fieldAt: { x: 40, z: 60 }, horseStart: HORSE_START, riderStart: RIDER_START, oval: OVAL, lineX: LINE_X }; }
