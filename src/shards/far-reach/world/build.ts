import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  OctahedronGeometry, Quaternion, Euler, Vector3, type Object3D } from 'three';
import { ISLAND_LIST, ISLANDS, SPANS, spanEnds, type Span, type Island } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from './resources';

const FILE = 'src/shards/far-reach/world/build.ts';
const DECK_W = 2.4, HOVER_W = 3, RAIL_H = 1.05;
const WOOD = new Color(0x7a5434), ROPE = new Color(0xc9a46a), STONE = new Color(0xe3d6c2);

/** A deck between two points: its centre, length and the rotation that takes local +z along it. */
export interface Deck { readonly a: Vector3; readonly b: Vector3; readonly mid: Vector3; readonly length: number; readonly yaw: number; readonly pitch: number; readonly q: Quaternion }
export function deckBetween(a: Vector3, b: Vector3): Deck {
  const d = b.clone().sub(a), flat = Math.hypot(d.x, d.z), yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, flat);
  return { a, b, mid: a.clone().add(b).multiplyScalar(0.5), length: d.length(), yaw, pitch, q: new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ')) };
}
/** A box collider laid along a deck (its top on the deck line), offset sideways `side` m and up `up` m. */
export function deckBox(deck: Deck, hx: number, hy: number, side = 0, up = 0): ColliderDesc {
  const offset = new Vector3(side, up - hy, 0).applyQuaternion(deck.q), c = deck.mid.clone().add(offset);
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx, hy, hz: deck.length / 2, rot: { x: deck.q.x, y: deck.q.y, z: deck.q.z, w: deck.q.w } };
}
function spanDeck(span: Span, heightAt: (x: number, z: number) => number): Deck {
  const { a, b } = spanEnds(span);
  return deckBetween(new Vector3(a.x, heightAt(a.x, a.z) + 0.02, a.z), new Vector3(b.x, heightAt(b.x, b.z) + 0.02, b.z));
}
const std = (color: number | Color, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial => new MeshStandardMaterial({ color, flatShading: true, ...extra });

/** Planks, rope rails and hangers of a rope bridge, in deck-local space (z along the deck, y up). */
function ropeBridgeMesh(length: number): Group {
  const g = new Group(), count = Math.max(2, Math.floor(length / 0.55));
  const planks = new InstancedMesh(new BoxGeometry(DECK_W, 0.08, 0.42), std(WOOD), count), m = new Matrix4();
  for (let i = 0; i < count; i++) { m.makeTranslation(0, -0.04, -length / 2 + (i + 0.5) * length / count); planks.setMatrixAt(i, m); planks.setColorAt(i, WOOD.clone().multiplyScalar(0.85 + ((i * 37) % 7) * 0.04)); }
  g.add(planks);
  const ropeMat = std(ROPE);
  for (const side of [-1, 1]) {
    const rail = new Mesh(new CylinderGeometry(0.035, 0.035, length, 5), ropeMat); rail.rotation.x = Math.PI / 2; rail.position.set(side * DECK_W / 2, RAIL_H, 0); g.add(rail);
    const hangers = Math.floor(length / 2.2), hanger = new InstancedMesh(new BoxGeometry(0.03, RAIL_H, 0.03), ropeMat, hangers);
    for (let i = 0; i < hangers; i++) { m.makeTranslation(side * DECK_W / 2, RAIL_H / 2, -length / 2 + (i + 0.5) * length / hangers); hanger.setMatrixAt(i, m); }
    g.add(hanger);
    for (const end of [-1, 1]) { const post = new Mesh(new BoxGeometry(0.18, 1.5, 0.18), std(0x5a3b22)); post.position.set(side * (DECK_W / 2 + 0.1), 0.6, end * length / 2); g.add(post); }
  }
  return g;
}
function place(object: Object3D, deck: Deck): void { object.position.copy(deck.mid); object.quaternion.copy(deck.q); }

/** The hover-bridge look: glowing glass tiles with gaps, gold edge bars and a floating crystal at each end. No ropes. */
export const hoverGlass = (): MeshStandardMaterial => std(0x8fe8ff, { emissive: 0x39c6ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
function hoverBridgeMesh(length: number, glass: MeshStandardMaterial, edge: MeshStandardMaterial): Group {
  const g = new Group(), count = Math.max(2, Math.floor(length / 1.25)), m = new Matrix4();
  const tiles = new InstancedMesh(new BoxGeometry(HOVER_W - 0.2, 0.06, 0.9), glass, count);
  for (let i = 0; i < count; i++) { m.makeTranslation(0, -0.03, -length / 2 + (i + 0.5) * length / count); tiles.setMatrixAt(i, m); }
  g.add(tiles);
  for (const side of [-1, 1]) { const bar = new Mesh(new BoxGeometry(0.08, 0.05, length), edge); bar.position.set(side * HOVER_W / 2, 0, 0); g.add(bar); }
  return g;
}

export interface HoverBridge { readonly span: Span; readonly deck: Deck; readonly crystals: Object3D[] }
export interface FallenBridge { readonly deck: Deck; readonly pivot: Group; readonly winchAt: Vector3; raise: number; raised: boolean }
export interface SkyWorld {
  readonly hover: HoverBridge[]; readonly fallen: FallenBridge; readonly sails: Group; readonly glass: MeshStandardMaterial; readonly winch: Interactable;
  readonly rope: Deck[];
}
/** The hanging angle of the fallen bridge (rad, nose down) and the raise length (s). */
export const FALLEN = { hang: 1.25, seconds: 4 } as const;

/** Every built piece of Sky Reach. `isHovering` gates the hover bridges' colliders; `raised` the quest bridge's. */
export function buildSkyWorld(ctx: ShardContext, isHovering: () => boolean, onRaise: () => void): SkyWorld {
  const heightAt = (x: number, z: number): number => ctx.manifest.ground.terrain?.heightAt(x, z) ?? 0;
  // island undersides: a faceted rock cone under each island, its crown hidden in the island's rim
  const under = new Group();
  for (const island of ISLAND_LIST) under.add(undersideMesh(island));
  ctx.root.add(under); ctx.piece({ id: 'farReach.undersides', name: STRINGS.underside, category: 'props', file: FILE, object: under });
  // rope bridges: walkable by anyone, rope rails that stop a fall
  const rope: Deck[] = [];
  for (const span of SPANS.filter((s) => s.kind === 'rope')) {
    const deck = spanDeck(span, heightAt), mesh = ropeBridgeMesh(deck.length); place(mesh, deck); rope.push(deck);
    ctx.root.add(mesh);
    ctx.piece({ id: `farReach.rope.${span.id}`, name: STRINGS.rope, category: 'buildings', file: FILE, object: mesh, surface: 'planks',
      colliders: [deckBox(deck, DECK_W / 2, 0.1), deckBox(deck, 0.05, RAIL_H / 2, -DECK_W / 2 - 0.05, RAIL_H), deckBox(deck, 0.05, RAIL_H / 2, DECK_W / 2 + 0.05, RAIL_H)] });
  }
  // hover bridges: a deck that exists for the hoverboard only; on foot you fall through it
  const glass = hoverGlass(), edge = std(0xffc860, { emissive: 0xffa040, emissiveIntensity: 0.6 }), crystalMat = std(0x9ff3ff, { emissive: 0x4fd8ff, emissiveIntensity: 1.2 });
  const hover: HoverBridge[] = [];
  for (const span of SPANS.filter((s) => s.kind === 'hover')) {
    const deck = spanDeck(span, heightAt), mesh = hoverBridgeMesh(deck.length, glass, edge); place(mesh, deck);
    const crystals: Object3D[] = [], posts = new Group();
    for (const end of [deck.a, deck.b]) {
      for (const side of [-1, 1]) {
        const offset = new Vector3(side * (HOVER_W / 2 + 0.5), 0, 0).applyAxisAngle(new Vector3(0, 1, 0), deck.yaw);
        const post = new Mesh(new CylinderGeometry(0.22, 0.32, 1.3, 6), std(STONE)); post.position.set(end.x + offset.x, end.y + 0.65, end.z + offset.z); posts.add(post);
        const crystal = new Mesh(new OctahedronGeometry(0.32), crystalMat); crystal.position.set(post.position.x, end.y + 1.75, post.position.z); posts.add(crystal); crystals.push(crystal);
      }
    }
    ctx.root.add(mesh, posts);
    ctx.piece({ id: `farReach.hover.${span.id}`, name: STRINGS.hover, category: 'buildings', file: FILE, object: mesh, surface: 'stone',
      colliders: [deckBox(deck, HOVER_W / 2, 0.1)], active: isHovering });
    ctx.piece({ id: `farReach.hover.${span.id}.posts`, name: STRINGS.hover, category: 'props', file: FILE, object: posts, surface: 'stone',
      colliders: posts.children.filter((c) => c instanceof Mesh && c.geometry instanceof CylinderGeometry).map((c) => boxDesc({ x: c.position.x, z: c.position.z, hw: 0.28, hd: 0.28, rot: 0, yBottom: c.position.y - 0.65, yTop: c.position.y + 0.65 }, 'stone')) });
    hover.push({ span, deck, crystals });
  }
  // the fallen bridge (the quest): it hangs off the landing isle's north rim until the winch raises it
  const fallenSpan = SPANS.find((s) => s.kind === 'fallen');
  if (fallenSpan === undefined) throw new Error('Sky Reach has no fallen bridge');
  const deck = spanDeck(fallenSpan, heightAt), pivot = new Group(), body = ropeBridgeMesh(deck.length);
  body.position.z = deck.length / 2; pivot.add(body); pivot.position.copy(deck.a); pivot.rotation.order = 'YXZ'; pivot.rotation.y = deck.yaw; pivot.rotation.x = FALLEN.hang;
  const side = new Vector3(Math.cos(deck.yaw), 0, -Math.sin(deck.yaw)), winchAt = deck.a.clone().addScaledVector(side, 3).setY(heightAt(deck.a.x + side.x * 3, deck.a.z + side.z * 3));
  const winchMesh = winchModel(); winchMesh.position.copy(winchAt); winchMesh.rotation.y = deck.yaw;
  const fallen: FallenBridge = { deck, pivot, winchAt, raise: 0, raised: false };
  ctx.root.add(pivot, winchMesh);
  ctx.piece({ id: 'farReach.fallen', name: STRINGS.fallen, category: 'buildings', file: FILE, object: pivot, surface: 'planks', active: () => fallen.raised,
    colliders: [deckBox(deck, DECK_W / 2, 0.1), deckBox(deck, 0.05, RAIL_H / 2, -DECK_W / 2 - 0.05, RAIL_H), deckBox(deck, 0.05, RAIL_H / 2, DECK_W / 2 + 0.05, RAIL_H)] });
  ctx.piece({ id: 'farReach.winch', name: STRINGS.winch, category: 'props', file: FILE, object: winchMesh, surface: 'wood',
    colliders: [boxDesc({ x: winchAt.x, z: winchAt.z, hw: 0.6, hd: 0.6, rot: deck.yaw, yBottom: winchAt.y, yTop: winchAt.y + 1.1 }, 'wood')] });
  const winch: Interactable = { label: STRINGS.raise, position: winchAt.clone().setY(winchAt.y + 1), radius: 3.2,
    onInteract: () => { if (fallen.raised || fallen.raise > 0) return; fallen.raise = 1e-3; winch.label = STRINGS.raising; onRaise(); } };
  // the ruined windmill on its isle
  const mill = ISLANDS.mill, millY = heightAt(mill.x, mill.z), tower = new Group();
  const stone = new Mesh(new CylinderGeometry(1.7, 2.5, 9, 8), std(STONE)); stone.position.y = 4.5; tower.add(stone);
  const cap = new Mesh(new ConeGeometry(2.3, 2.6, 8), std(0x6b4a33)); cap.position.y = 10.2; tower.add(cap);
  const door = new Mesh(new BoxGeometry(1.1, 2, 0.2), std(0x3c2a1e)); door.position.set(0, 1, 2.35); tower.add(door);
  const sails = new Group(); sails.position.set(0, 8.4, 2.2);
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = i * Math.PI / 2;
    const spar = new Mesh(new BoxGeometry(0.22, 6.2, 0.12), std(0x5a3b22)); spar.position.y = 3.1; arm.add(spar);
    const cloth = new Mesh(new BoxGeometry(1.3, 4.6, 0.04), std(i === 3 ? 0x9d8e7a : 0xeee2c8)); cloth.position.set(0.75, 3.6, 0); cloth.visible = i !== 2; arm.add(cloth);
    sails.add(arm);
  }
  tower.add(sails); tower.position.set(mill.x, millY - 0.2, mill.z);
  ctx.root.add(tower);
  ctx.piece({ id: 'farReach.windmill', name: STRINGS.windmill, category: 'buildings', file: FILE, object: tower, surface: 'stone',
    colliders: [boxDesc({ x: mill.x, z: mill.z, hw: 2.1, hd: 2.1, rot: 0, yBottom: millY - 0.2, yTop: millY + 10 }, 'stone')] });
  ownPrimitives(ctx.root, ctx.scope);
  return { hover, fallen, sails, glass, winch, rope };
}

function winchModel(): Group {
  const g = new Group(), wood = std(0x6a4528);
  const drum = new Mesh(new CylinderGeometry(0.35, 0.35, 1, 8), wood); drum.rotation.z = Math.PI / 2; drum.position.y = 0.7; g.add(drum);
  for (const x of [-0.6, 0.6]) { const post = new Mesh(new BoxGeometry(0.14, 1.1, 0.4), wood); post.position.set(x, 0.55, 0); g.add(post); }
  for (let i = 0; i < 4; i++) { const spoke = new Mesh(new BoxGeometry(0.06, 0.9, 0.06), std(0x3c2a1e)); spoke.position.set(0.68, 0.7, 0); spoke.rotation.x = i * Math.PI / 4; g.add(spoke); }
  const coil = new Mesh(new CylinderGeometry(0.4, 0.4, 0.7, 8), std(ROPE)); coil.rotation.z = Math.PI / 2; coil.position.y = 0.7; g.add(coil);
  return g;
}

/** A faceted rock cone hanging under an island: flat-shaded, vertex-coloured, darker toward its tip. */
function undersideMesh(island: Island): Mesh {
  const depth = island.r * 1.6, cone = new ConeGeometry(island.r * 1.05, depth, 11, 4, true).toNonIndexed();
  const pos = cone.getAttribute('position'), colors: number[] = [], top = new Color(0x8a7058), tip = new Color(0x3e3440), c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = (y + depth / 2) / depth, k = Math.sin(pos.getX(i) * 1.7 + pos.getZ(i) * 2.3) * 0.5 + Math.cos(y * 1.3) * 0.5;
    if (t > 0.05 && t < 0.98) { pos.setX(i, pos.getX(i) * (1 + k * 0.08)); pos.setZ(i, pos.getZ(i) * (1 + k * 0.08)); }
    c.copy(top).lerp(tip, t); colors.push(c.r, c.g, c.b);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', pos); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  cone.dispose();
  const mesh = new Mesh(geometry, std(0xffffff, { vertexColors: true })); mesh.rotation.x = Math.PI; mesh.position.set(island.x, island.top - 0.9 - depth / 2, island.z);
  return mesh;
}
