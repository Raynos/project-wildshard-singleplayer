import type { ColliderDesc, Interactable } from '#engine';
import type { ShardContext } from '#game';
import { DoubleSide, Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import { FALLEN, FAR_ISLES, HOVER, ISLES, ROPE, WINCH, WINDMILL, type Isle } from '../layout';
import { STRINGS } from '../strings';
import { box, Facets, seeded, type V3 } from './facets';
import { boulder, island, tuft, type IslandShape } from './islands';
import { frameBox, hoverEdges, hoverRungs, pylons, ropeBridge, ropeColliders, spanFrame } from './bridges';
import { ownPrimitives } from './resources';

const FILE = 'src/shards/far-reach/world/build.ts';
const lowPoly = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
const mesh = (g: BufferGeometry, m: MeshStandardMaterial): Mesh => { const out = new Mesh(g, m); out.castShadow = true; out.receiveShadow = true; return out; };

export interface SkyWorld {
  /** the fallen bridge: 0 = hanging, 1 = up (it collides only when up) */
  bridge: { hinge: Group; raised: number; target: number };
  sails: Group;
  winch: Interactable; winchAt: Vector3; drum: Group;
  hover: { glass: MeshStandardMaterial; edge: MeshStandardMaterial; crystal: MeshStandardMaterial };
  shapes: ReadonlyMap<string, IslandShape>;
}

/** The hull collider of an island's walkable top: its rim polygon as a 3 m slab under the top. */
function topHull(shape: IslandShape): ColliderDesc {
  const points: number[] = [];
  for (const [x, z] of shape.rim) points.push(x - shape.cx, 0, z - shape.cz, x - shape.cx, -3, z - shape.cz);
  return { kind: 'hull', x: shape.cx, y: shape.top, z: shape.cz, points: new Float32Array(points), surface: 'grass' };
}

function dress(f: Facets, isle: Isle, seed: number, clear: (x: number, z: number) => boolean): void {
  const random = seeded(seed);
  for (let i = 0; i < Math.round(isle.r * 0.5); i++) {
    const a = random() * Math.PI * 2, d = isle.r * (0.35 + random() * 0.5), x = isle.x + Math.sin(a) * d, z = isle.z + Math.cos(a) * d;
    if (clear(x, z)) boulder(f, x, isle.top, z, 0.35 + random() * 0.7, seed + i);
  }
  for (let i = 0; i < isle.r * 4; i++) {
    const a = random() * Math.PI * 2, d = isle.r * Math.sqrt(random()) * 0.9;
    tuft(f, isle.x + Math.sin(a) * d, isle.top + 0.05, isle.z + Math.cos(a) * d, 0.35 + random() * 0.4, random() * 3);
  }
}

function windmill(ctx: ShardContext, top: number): Group {
  const f = new Facets(0.05), at = { applyTo: (p: [number, number, number]): V3 => p }, sides = 6, x = WINDMILL.x, z = WINDMILL.z;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, r0 = 2.4, r1 = 1.6, h = 8;
    const c = i % 2 ? [0.86, 0.82, 0.74] as const : [0.8, 0.75, 0.68] as const;
    f.quad([x + Math.sin(a0) * r0, top, z + Math.cos(a0) * r0], [x + Math.sin(a1) * r0, top, z + Math.cos(a1) * r0],
      [x + Math.sin(a1) * r1, top + h, z + Math.cos(a1) * r1], [x + Math.sin(a0) * r1, top + h, z + Math.cos(a0) * r1], c);
    f.tri([x + Math.sin(a0) * 1.9, top + h, z + Math.cos(a0) * 1.9], [x + Math.sin(a1) * 1.9, top + h, z + Math.cos(a1) * 1.9], [x, top + h + 2.6, z], [0.36, 0.22, 0.17]);
  }
  box(f, at, [x, top + 1.1, z + 2.15], 0.55, 1.1, 0.12, [0.25, 0.17, 0.12]);
  box(f, at, [x, top + 5.2, z + 1.85], 0.4, 0.45, 0.1, [0.2, 0.18, 0.2]);
  const tower = mesh(f.geometry(), lowPoly());
  ctx.root.add(tower);
  ctx.piece({ id: 'far.windmill', name: STRINGS.windmill, category: 'buildings', file: FILE, object: tower, surface: 'stone',
    colliders: [{ kind: 'capsule', x, y: top + 4, z, halfHeight: 3, radius: 2.3, surface: 'stone' }] });
  // the sails turn on a hub facing south (+z)
  const sails = new Group(), s = new Facets(0.04); sails.position.set(x, top + 7.4, z + 2.2);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4, m = { applyTo: ([px, py, pz]: [number, number, number]): V3 => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a), pz] };
    box(s, m, [0, 3.4, 0], 0.09, 3.4, 0.08, [0.3, 0.2, 0.14]);
    box(s, m, [0.55, 3.9, -0.02], 0.45, 2.6, 0.02, [0.92, 0.86, 0.74], [0.75, 0.68, 0.58]);
  }
  box(s, { applyTo: (p) => p }, [0, 0, 0], 0.3, 0.3, 0.3, [0.25, 0.17, 0.12]);
  const blades = mesh(s.geometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, roughness: 0.9 }));
  sails.add(blades); ctx.root.add(sails);
  ctx.piece({ id: 'far.windmill.sails', name: STRINGS.sails, category: 'buildings', file: FILE, object: sails });
  return sails;
}

export function buildWorld(ctx: ShardContext, farCount: number): SkyWorld {
  const shapes = new Map<string, IslandShape>(), isles = new Facets(0.07, seeded(77));
  ISLES.forEach((isle, i) => { shapes.set(isle.id, island(isles, isle.x, isle.z, isle.top, isle.r, isle.depth, 101 + i * 31)); });
  const nearWindmill = (x: number, z: number): boolean => Math.hypot(x - WINDMILL.x, z - WINDMILL.z) > 4.5 && Math.hypot(x - WINCH.x, z - WINCH.z) > 2.5;
  ISLES.forEach((isle, i) => { dress(isles, isle, 500 + i * 17, nearWindmill); });
  const land = mesh(isles.geometry(), lowPoly()); ctx.root.add(land);
  for (const isle of ISLES) {
    const shape = shapes.get(isle.id); if (!shape) continue;
    ctx.piece({ id: `far.isle.${isle.id}`, name: STRINGS[isle.id], category: 'ground', file: FILE, ...(isle.id === 'sunrest' ? { object: land } : {}),
      anchor: new Vector3(isle.x, isle.top, isle.z), colliders: [topHull(shape)], surface: 'grass' });
  }
  // far scenery: the same islands, smaller detail, no collision; the phone draws fewer
  const far = new Facets(0.07, seeded(9));
  FAR_ISLES.slice(0, farCount).forEach(([x, z, top, r], i) => { island(far, x, z, top, r, r * 1.7, 900 + i * 13, 9); });
  const farMesh = new Mesh(far.geometry(), lowPoly()); ctx.root.add(farMesh);
  ctx.piece({ id: 'far.far-isles', name: STRINGS.far, category: 'nature', file: FILE, object: farMesh });

  // rope bridges, walked
  const wood = lowPoly();
  for (const span of ROPE) {
    const frame = spanFrame(span, shapes, 'rope'), g = new Group(); g.position.copy(frame.origin); g.quaternion.copy(frame.quat);
    g.add(mesh(ropeBridge(span.width, frame.length).geometry(), wood)); ctx.root.add(g);
    ctx.piece({ id: `far.${span.id}`, name: STRINGS.rope, category: 'buildings', file: FILE, object: g, colliders: ropeColliders(frame, span.width), surface: 'planks' });
  }
  // hover bridges: glass that carries only a board rider (Jake's rule, E364); on foot you drop straight through
  const glass = new MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x5fb8e8, emissiveIntensity: 0.25, transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1, depthWrite: false, side: DoubleSide });
  const edge = new MeshStandardMaterial({ vertexColors: true, emissive: 0xffc070, emissiveIntensity: 0.6, flatShading: true });
  const crystal = new MeshStandardMaterial({ vertexColors: true, emissive: 0x8fe3ff, emissiveIntensity: 0.8, flatShading: true });
  const onBoard = (): boolean => ctx.app.player?.mode === 'board';
  for (const span of HOVER) {
    const frame = spanFrame(span, shapes, 'hover'), g = new Group(); g.position.copy(frame.origin); g.quaternion.copy(frame.quat);
    const pane = new Facets(0); box(pane, { applyTo: (p) => p }, [0, -0.06, frame.length / 2], span.width / 2, 0.06, frame.length / 2, [1, 1, 1]);
    const deck = new Mesh(pane.geometry(), glass); deck.renderOrder = 2; g.add(deck);
    g.add(mesh(hoverRungs(span.width, frame.length).geometry(), edge), mesh(hoverEdges(span.width, frame.length).geometry(), edge));
    const { posts, crystals } = pylons(frame, span.width, span.from, span.to);
    const ends = new Group(); ends.add(mesh(posts.geometry(), lowPoly()), new Mesh(crystals.geometry(), crystal));
    ctx.root.add(g, ends);
    ctx.piece({ id: `far.${span.id}`, name: STRINGS.hover, category: 'buildings', file: FILE, object: g, surface: 'stone',
      colliders: [frameBox(frame, [0, -0.08, frame.length / 2], span.width / 2, 0.08, frame.length / 2, 'stone')], active: onBoard });
    ctx.piece({ id: `far.${span.id}.pylons`, name: STRINGS.hover, category: 'props', file: FILE, object: ends });
  }
  // the fallen bridge hangs from Sunrest's north rim until the winch raises it
  const frame = spanFrame(FALLEN, shapes, 'rope'), mount = new Group(), hinge = new Group();
  mount.position.copy(frame.origin); mount.quaternion.copy(frame.quat); mount.add(hinge);
  hinge.add(mesh(ropeBridge(FALLEN.width, frame.length).geometry(), wood)); hinge.rotation.x = 1.35; ctx.root.add(mount);
  const bridge = { hinge, raised: 0, target: 0 };
  ctx.piece({ id: `far.${FALLEN.id}`, name: STRINGS.fallen, category: 'buildings', file: FILE, object: mount, colliders: ropeColliders(frame, FALLEN.width), surface: 'planks',
    active: () => bridge.raised >= 1 });
  // the winch: two posts and a drum on Sunrest, by the hinge
  const top = ISLES[0]?.top ?? 20, w = new Facets(0.05), at = { applyTo: (p: [number, number, number]): V3 => p };
  for (const s of [-1, 1]) box(w, at, [WINCH.x + s * 0.7, top + 0.6, WINCH.z], 0.12, 0.6, 0.12, [0.3, 0.2, 0.14]);
  const winchBase = mesh(w.geometry(), lowPoly()), drum = new Group(), d = new Facets(0.05);
  box(d, at, [0, 0, 0], 0.6, 0.28, 0.28, [0.55, 0.38, 0.22]); box(d, at, [0.75, 0.3, 0], 0.05, 0.35, 0.05, [0.25, 0.25, 0.27]);
  drum.add(mesh(d.geometry(), lowPoly())); drum.position.set(WINCH.x, top + 1.05, WINCH.z);
  ctx.root.add(winchBase, drum);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: winchBase,
    colliders: [{ kind: 'box', x: WINCH.x, y: top + 0.6, z: WINCH.z, hx: 0.85, hy: 0.6, hz: 0.2, surface: 'planks' }] });
  ctx.piece({ id: 'far.winch.drum', name: STRINGS.winch, category: 'props', file: FILE, object: drum });
  const winchAt = new Vector3(WINCH.x, top + 1.1, WINCH.z);
  const winch: Interactable = { label: STRINGS.raise, position: winchAt, radius: 3,
    onInteract: () => { if (bridge.target === 0) { bridge.target = 1; winch.label = STRINGS.raising; } } };
  const sails = windmill(ctx, ISLES[1]?.top ?? 23);
  ownPrimitives(ctx.root, ctx.scope);
  return { bridge, sails, winch, winchAt, drum, hover: { glass, edge, crystal }, shapes };
}
