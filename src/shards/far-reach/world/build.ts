import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { Group, Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { DECK, FALLEN_BRIDGE, GROVE, HOVER_BRIDGE, ISLES, MILL, PINES, ROOST, ROPE_BRIDGE, SUNREST, WINCH, WINDMILL, apothem, type Isle, type Span } from '../layout';
import { STRINGS } from '../strings';
import { PALETTE, flat, islandMesh, pines, plankBridge, windmill, winch } from './shapes';
import { ownPrimitives } from './resources';

const FILE = 'src/shards/far-reach/world/build.ts';
/** How far the fallen bridge hangs below level (radians about its pivot). */
export const FALLEN_ANGLE = -1.25;

/** Six strips 30° apart cover an island's 12-gon top exactly; each strip's corners stay inside the rim circle. */
export function islandColliders(isle: Isle): ColliderDesc[] {
  const half = apothem(isle), width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => boxDesc({ x: isle.x, z: isle.z, hw: half, hd: width, rot: (i * Math.PI) / 6, yBottom: DECK - 2, yTop: DECK }, 'grass'));
}
/** An axis-aligned deck box under a span, top at the deck height. */
export function deckCollider(span: Span, yBottom = DECK - 0.3): ColliderDesc {
  return boxDesc({ x: (span.x0 + span.x1) / 2, z: (span.z0 + span.z1) / 2, hw: Math.max(span.width / 2, Math.abs(span.x1 - span.x0) / 2),
    hd: span.x0 === span.x1 ? Math.abs(span.z1 - span.z0) / 2 : span.width / 2, rot: 0, yBottom, yTop: DECK }, 'wood');
}
/** Rope rails along both long sides of a span. */
function railColliders(span: Span): ColliderDesc[] {
  const alongX = span.z0 === span.z1, half = (alongX ? Math.abs(span.x1 - span.x0) : Math.abs(span.z1 - span.z0)) / 2;
  const cx = (span.x0 + span.x1) / 2, cz = (span.z0 + span.z1) / 2;
  return [-1, 1].map((side) => boxDesc({ x: alongX ? cx : cx + side * span.width / 2, z: alongX ? cz + side * span.width / 2 : cz,
    hw: alongX ? half : 0.06, hd: alongX ? 0.06 : half, rot: 0, yBottom: DECK, yTop: DECK + 1.1 }, 'wood'));
}
const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.z1 - span.z0);
const spanYaw = (span: Span): number => Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0));

export interface BuiltWorld {
  /** The hover deck's material: the plugin brightens it while the player rides the board. */
  readonly hoverDeck: MeshStandardMaterial;
  /** The fallen bridge's pivot on Sunrest's rim; rotation.x runs from FALLEN_ANGLE (hanging) to 0 (raised). */
  readonly fallen: Object3D;
  readonly millHub: Object3D;
  readonly winch: Interactable;
  readonly winchAt: Vector3;
  /** Gameplay state the pieces' `active()` read. */
  readonly state: { raised: boolean; raising: boolean };
}

export function buildWorld(ctx: ShardContext, isBoard: () => boolean): BuiltWorld {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove };
  for (const isle of ISLES) {
    const mesh = islandMesh(isle, rnd); mesh.position.set(isle.x, DECK, isle.z); root.add(mesh);
    ctx.piece({ id: `far.isle.${isle.id}`, name: names[isle.id] ?? isle.id, category: 'ground', file: FILE, object: mesh, colliders: islandColliders(isle), surface: 'grass' });
  }
  const pineAt: [number, number, number, number][] = [];
  for (const isle of ISLES) for (const [dx, dz, s] of PINES[isle.id] ?? []) pineAt.push([isle.x + dx, DECK, isle.z + dz, s]);
  const forest = pines(pineAt); root.add(forest);
  ctx.piece({ id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE, object: forest });

  const plank = flat(PALETTE.plank), rope = flat(PALETTE.rope);
  const ropeBridge = plankBridge(spanLength(ROPE_BRIDGE), ROPE_BRIDGE.width, plank, rope);
  ropeBridge.position.set(ROPE_BRIDGE.x0, DECK, ROPE_BRIDGE.z0); ropeBridge.rotation.y = spanYaw(ROPE_BRIDGE); root.add(ropeBridge);
  ctx.piece({ id: ROPE_BRIDGE.id, name: STRINGS.rope, category: 'buildings', file: FILE, object: ropeBridge,
    colliders: [deckCollider(ROPE_BRIDGE), ...railColliders(ROPE_BRIDGE)], surface: 'wood' });

  // The hover bridge: glass-like planks and two glowing posts per end; its deck collides only for a board rider.
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.55, depthWrite: false });
  const hoverBridge = plankBridge(spanLength(HOVER_BRIDGE), HOVER_BRIDGE.width, hoverDeck, null);
  for (const z of [0, -spanLength(HOVER_BRIDGE)]) for (const side of [-1, 1]) {
    const post = plankBridge(1.4, 0.18, hoverDeck, null); post.rotation.x = Math.PI / 2; post.position.set(side * HOVER_BRIDGE.width / 2, 0, z); hoverBridge.add(post);
  }
  hoverBridge.position.set(HOVER_BRIDGE.x0, DECK, HOVER_BRIDGE.z0); hoverBridge.rotation.y = spanYaw(HOVER_BRIDGE); root.add(hoverBridge);
  ctx.piece({ id: HOVER_BRIDGE.id, name: STRINGS.hover, category: 'buildings', file: FILE, object: hoverBridge,
    colliders: [deckCollider(HOVER_BRIDGE)], surface: 'wood', active: isBoard });

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = plankBridge(spanLength(FALLEN_BRIDGE), FALLEN_BRIDGE.width, plank, rope);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, DECK, FALLEN_BRIDGE.z0); fallen.rotation.x = FALLEN_ANGLE; root.add(fallen);
  ctx.piece({ id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, object: fallen,
    colliders: [deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], surface: 'wood', active: () => state.raised });

  const mill = windmill(); mill.group.position.set(MILL.x, DECK, MILL.z); mill.group.rotation.y = 0.35; root.add(mill.group);
  ctx.piece({ id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, object: mill.group,
    colliders: [boxDesc({ x: MILL.x, z: MILL.z, hw: 2, hd: 2, rot: 0.35, yBottom: DECK, yTop: DECK + 10 }, 'wood')], surface: 'wood' });

  const drum = winch(); drum.position.set(WINCH.x, DECK, WINCH.z); root.add(drum);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: drum,
    colliders: [boxDesc({ x: WINCH.x, z: WINCH.z, hw: 0.8, hd: 0.2, rot: 0, yBottom: DECK, yTop: DECK + 1.2 }, 'wood')], surface: 'wood' });
  const winchAt = new Vector3(WINCH.x, DECK + 1.2, WINCH.z);
  const handle: Interactable = { label: STRINGS.turnWinch, position: winchAt, radius: 3,
    onInteract: () => { if (!state.raised) state.raising = true; } };

  ctx.root.add(root); ownPrimitives(root, ctx.scope);
  return { hoverDeck, fallen, millHub: mill.hub, winch: handle, winchAt, state };
}
/** The islands a point stands over (XZ inside the rim), for tests and the GUST edge read. */
export const overIsland = (x: number, z: number): boolean => [SUNREST, WINDMILL, ROOST, GROVE].some((isle) => Math.hypot(x - isle.x, z - isle.z) < apothem(isle));
