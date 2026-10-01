import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Object3D, Quaternion, Vector3 } from 'three';
import { BRIDGES, ISLANDS, MILL, SPAWN, TOP, WINCH, bridgeEnds, type Bridge } from '../layout';
import { STRINGS } from '../strings';
import { islandCollider, islandMesh } from './islands';
import { ownPrimitives } from './resources';

const FILE = 'src/shards/far-reach/world/build.ts';
const flat = (color: number, extra: Partial<{ emissive: number; transparent: boolean; opacity: number }> = {}): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });

/** What the plugin drives after the world is built. */
export interface SkyWorld {
  /** 0 = hanging under Sunrest's rim, 1 = raised; the fallen bridge collides only at 1 */
  bridge: { lift: number; pivot: Object3D };
  /** the glowing hover decks (brighter while the player rides the board) */
  hoverGlow: MeshStandardMaterial;
  blades: Object3D;
  winch: Interactable;
  winchAt: Vector3;
}

function deckCollider(b: Bridge, top: number): ColliderDesc[] {
  const e = bridgeEnds(b), cx = (e.ax + e.bx) / 2, cz = (e.az + e.bz) / 2, side = new Vector3(Math.cos(e.yaw), 0, -Math.sin(e.yaw));
  const deck: ColliderDesc = { kind: 'box', x: cx, y: top - 0.15, z: cz, hx: b.width / 2, hy: 0.15, hz: e.length / 2, yaw: e.yaw, surface: b.kind === 'hover' ? 'metal' : 'planks' };
  if (b.kind === 'hover') return [deck];
  const rails = [-1, 1].map((s): ColliderDesc => ({ kind: 'box', x: cx + side.x * s * (b.width / 2 + 0.05), y: top + 0.55, z: cz + side.z * s * (b.width / 2 + 0.05),
    hx: 0.05, hy: 0.55, hz: e.length / 2, yaw: e.yaw, surface: 'wood' }));
  return [deck, ...rails];
}

/** A plank deck with rope rails along local +Z from (0, 0, 0). */
function ropeDeck(length: number, width: number): Group {
  const deck = new Group(), count = Math.max(2, Math.floor(length / 0.55));
  const planks = new InstancedMesh(new BoxGeometry(width, 0.14, 0.46), flat(0x8a6446), count), m = new Matrix4();
  for (let i = 0; i < count; i++) planks.setMatrixAt(i, m.makeTranslation(0, -0.07, (i + 0.5) * (length / count)));
  planks.castShadow = true; planks.receiveShadow = true; deck.add(planks);
  for (const s of [-1, 1]) {
    const rope = new Mesh(new CylinderGeometry(0.035, 0.035, length, 4), flat(0xc9b08a));
    rope.rotation.x = Math.PI / 2; rope.position.set(s * width / 2, 1.0, length / 2); deck.add(rope);
    for (const z of [0, length]) { const post = new Mesh(new BoxGeometry(0.18, 1.3, 0.18), flat(0x5a3f33)); post.position.set(s * width / 2, 0.55, z); deck.add(post); }
  }
  return deck;
}

/** Floating glass panels with gaps: they read as a deck only a board can ride. */
function hoverDeck(length: number, width: number, glow: MeshStandardMaterial): Group {
  const deck = new Group(), count = Math.max(2, Math.floor(length / 1.8));
  const panels = new InstancedMesh(new BoxGeometry(width, 0.08, 1.5), glow, count), m = new Matrix4();
  for (let i = 0; i < count; i++) panels.setMatrixAt(i, m.makeTranslation(0, -0.04, (i + 0.5) * (length / count)));
  deck.add(panels);
  for (const z of [0, length]) for (const s of [-1, 1]) {
    const rune = new Mesh(new CylinderGeometry(0.12, 0.22, 1.6, 5), flat(0x40506a, { emissive: 0x2c8fb0 }));
    rune.position.set(s * (width / 2 + 0.2), 0.6, z); deck.add(rune);
  }
  return deck;
}

function scatter(ctx: ShardContext): void {
  const random = ctx.app.rng.stream('cosmetic'), m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3();
  const keepClear: [number, number, number][] = [[SPAWN.x, SPAWN.z, 5], [WINCH.x, WINCH.z, 4], [MILL.x, MILL.z, 6], [0, 2, 4], [0, -6, 4], [0, -12, 4], [-4, 4, 4]];
  for (const b of BRIDGES) { const e = bridgeEnds(b); keepClear.push([e.ax, e.az, 4], [e.bx, e.bz, 4]); }
  const spots: [number, number, number][] = [];
  for (const island of ISLANDS) {
    const want = Math.round(island.r * 0.45);
    for (let tries = 0; spots.filter(([x, z]) => Math.hypot(x - island.x, z - island.z) < island.r).length < want && tries < 200; tries++) {
      const a = random.range(0, Math.PI * 2), r = Math.sqrt(random.next()) * island.r * 0.82, x = island.x + Math.sin(a) * r, z = island.z + Math.cos(a) * r;
      if (keepClear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr) || spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 2.6)) continue;
      spots.push([x, z, random.range(0.75, 1.35)]);
    }
  }
  const crowns = new InstancedMesh(new ConeGeometry(1.1, 2.8, 5), flat(0x45602f), spots.length);
  const trunks = new InstancedMesh(new CylinderGeometry(0.16, 0.24, 1.2, 5), flat(0x4a342c), spots.length);
  const colliders: ColliderDesc[] = [];
  const tint = new Color();
  spots.forEach(([x, z, k], i) => {
    q.setFromAxisAngle(new Vector3(0, 1, 0), random.range(0, Math.PI));
    crowns.setMatrixAt(i, m.compose(p.set(x, TOP + 1.2 * k + 1.4 * k, z), q, s.set(k, k, k)));
    crowns.setColorAt(i, tint.setHSL(0.24 + random.range(-0.03, 0.03), 0.32, 0.33 + random.range(-0.04, 0.04)));
    trunks.setMatrixAt(i, m.compose(p.set(x, TOP + 0.6 * k, z), q, s.set(k, k, k)));
    colliders.push({ kind: 'capsule', x, y: TOP + 1.2, z, halfHeight: 0.8, radius: 0.3, surface: 'wood' });
  });
  for (const mesh of [crowns, trunks]) { mesh.castShadow = true; mesh.receiveShadow = true; }
  const trees = new Group(); trees.add(crowns, trunks); ctx.root.add(trees);
  ctx.piece({ id: 'far.trees', name: STRINGS.trees, category: 'nature', file: FILE, object: trees, colliders, surface: 'wood' });
  const rocks = new InstancedMesh(new DodecahedronGeometry(0.9, 0), flat(0x7a6470), 14);
  for (let i = 0; i < 14; i++) {
    const island = ISLANDS[i % ISLANDS.length]; if (!island) continue;
    const a = random.range(0, Math.PI * 2), r = island.r * random.range(0.55, 0.85), k = random.range(0.5, 1.3);
    q.setFromAxisAngle(new Vector3(0, 1, 0), random.range(0, 3));
    rocks.setMatrixAt(i, m.compose(p.set(island.x + Math.sin(a) * r, TOP + 0.2 * k, island.z + Math.cos(a) * r), q, s.set(k * 1.4, k * 0.7, k)));
  }
  rocks.castShadow = true; ctx.root.add(rocks);
  ctx.piece({ id: 'far.rocks', name: STRINGS.island, category: 'nature', file: FILE, object: rocks });
}

function windmill(ctx: ShardContext): Object3D {
  const mill = new Group(); mill.position.set(MILL.x, TOP, MILL.z);
  const tower = new Mesh(new CylinderGeometry(1.9, 3, 11, 8), flat(0x5e4b50)); tower.position.y = 5.5;
  const cap = new Mesh(new ConeGeometry(3, 3.2, 8), flat(0x3a2b31)); cap.position.y = 12.6;
  const door = new Mesh(new BoxGeometry(1.3, 2.2, 0.3), flat(0x2b1f24)); door.position.set(0, 1.1, 2.75);
  const blades = new Group(); blades.position.set(0, 10, 2.6);
  for (let i = 0; i < 4; i++) {
    const arm = new Group(); arm.rotation.z = (i * Math.PI) / 2;
    const spar = new Mesh(new BoxGeometry(0.22, 8, 0.14), flat(0x3b2a2a)); spar.position.y = 4;
    const sail = new Mesh(new BoxGeometry(1.5, 5.8, 0.05), flat(0xd9c7b8)); sail.position.set(0.85, 4.8, -0.05);
    arm.add(spar, sail); blades.add(arm);
  }
  const hub = new Mesh(new CylinderGeometry(0.45, 0.45, 0.8, 6), flat(0x3b2a2a)); hub.rotation.x = Math.PI / 2; blades.add(hub);
  mill.add(tower, cap, door, blades); ctx.root.add(mill);
  ctx.piece({ id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, object: mill,
    colliders: [{ kind: 'box', x: MILL.x, y: TOP + 5.5, z: MILL.z, hx: 2.5, hy: 5.5, hz: 2.5, surface: 'stone' }], surface: 'stone' });
  return blades;
}

function winchPost(ctx: ShardContext): Vector3 {
  const winch = new Group(); winch.position.set(WINCH.x, TOP, WINCH.z);
  for (const s of [-1, 1]) { const post = new Mesh(new BoxGeometry(0.25, 1.3, 0.25), flat(0x5a3f33)); post.position.set(s * 0.7, 0.65, 0); winch.add(post); }
  const drum = new Mesh(new CylinderGeometry(0.35, 0.35, 1.2, 8), flat(0x8a6446)); drum.rotation.z = Math.PI / 2; drum.position.y = 1.05;
  const crank = new Mesh(new BoxGeometry(0.1, 0.6, 0.1), flat(0x2f2f36)); crank.position.set(0.9, 1.25, 0);
  winch.add(drum, crank); ctx.root.add(winch);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: winch,
    colliders: [boxDesc({ x: WINCH.x, z: WINCH.z, hw: 0.85, hd: 0.3, rot: 0, yBottom: TOP, yTop: TOP + 1.3 }, 'wood')], surface: 'wood' });
  return new Vector3(WINCH.x, TOP + 1.4, WINCH.z);
}

/**
 * Builds Sky Reach: four islands (hull tops), the rope bridge, two hover bridges, the fallen bridge, trees, rocks, the
 * windmill and the winch. Every thing is a registry piece; a hover deck's collider is `active` only while the player
 * rides the board, and the fallen bridge's only once it is raised.
 */
export function buildWorld(ctx: ShardContext, onWinch: () => void): SkyWorld {
  const random = ctx.app.rng.stream('cosmetic'), rock = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  for (const island of ISLANDS) {
    const mesh = islandMesh(island, random, rock); ctx.root.add(mesh);
    ctx.piece({ id: `far.island.${island.id}`, name: STRINGS.island, category: 'ground', file: FILE, object: mesh, colliders: [islandCollider(island)], surface: 'grass' });
  }
  const hoverGlow = flat(0x9fe8ff, { emissive: 0x3fb8e0, transparent: true, opacity: 0.6 });
  const bridge = { lift: 0, pivot: new Object3D() };
  for (const b of BRIDGES) {
    const e = bridgeEnds(b), root = new Group(); root.position.set(e.ax, TOP, e.az); root.rotation.y = e.yaw;
    const isHover = b.kind === 'hover', isFallen = b.kind === 'fallen';
    const deck = isHover ? hoverDeck(e.length, b.width, hoverGlow) : ropeDeck(e.length, b.width);
    if (isFallen) { bridge.pivot = deck; deck.rotation.x = 1.35; }
    root.add(deck); ctx.root.add(root);
    ctx.piece({ id: b.id, name: isHover ? STRINGS.hoverBridge : isFallen ? STRINGS.fallenBridge : STRINGS.ropeBridge, category: 'buildings', file: FILE, object: root,
      colliders: deckCollider(b, TOP), surface: isHover ? 'metal' : 'planks',
      ...(isHover ? { active: () => ctx.app.player?.mode === 'board' } : isFallen ? { active: () => bridge.lift >= 1 } : {}) });
  }
  scatter(ctx);
  const blades = windmill(ctx), winchAt = winchPost(ctx);
  const winch: Interactable = { label: STRINGS.winchUse, position: winchAt, radius: 3.5, onInteract: onWinch };
  ownPrimitives(ctx.root, ctx.scope);
  return { bridge, hoverGlow, blades, winch, winchAt };
}
