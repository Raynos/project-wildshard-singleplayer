import { boxDesc, type ColliderDesc, type Interactable } from '#engine';
import type { ShardContext } from '#game';
import { Group, Vector3, type MeshStandardMaterial, type Object3D } from 'three';
import { CROWN, DAIS, FALLEN_BRIDGE, ISLES, WINDMILL, MILL, NOTES, PINES, SPANS, UPDRAFT, VANES, WINCH, apothem, type Isle, type Span } from '../layout';
import { STRINGS } from '../strings';
import { dressIslands } from './dressing';
import { islandMesh } from './isle';
import { CROWN_RING, crownArena, crownStones } from './crown';
import { skyline } from './distant';
import { PALETTE, flat, lectern, pines, plankBridge, vane, windmill, winch } from './shapes';
import { ownPrimitives } from './resources';
import { STORM, crownStorm, type CrownStorm } from './storm';
import { updraftFx, type UpdraftFx } from './windFx';
import { SUN_DIR } from '../look/sun';
import { bakeSeaTexture } from '../look/cloudSea';

const FILE = 'src/shards/far-reach/world/build.ts';
/** How far the fallen bridge hangs below level (radians about its pivot). */
export const FALLEN_ANGLE = -1.25;
/** The updraft ramp's climb (radians); under the 40° walk limit. */
export const UPDRAFT_ANGLE = Math.atan2(UPDRAFT.y1 - UPDRAFT.y0, UPDRAFT.z0 - UPDRAFT.z1);
export const UPDRAFT_LENGTH = Math.hypot(UPDRAFT.y1 - UPDRAFT.y0, UPDRAFT.z0 - UPDRAFT.z1);

/** Six strips 30° apart cover an island's 12-gon top exactly; each strip's corners stay inside the rim circle. */
export function islandColliders(isle: Isle): ColliderDesc[] {
  const half = apothem(isle), width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => boxDesc({ x: isle.x, z: isle.z, hw: half, hd: width, rot: (i * Math.PI) / 6, yBottom: isle.y - 2, yTop: isle.y }, 'grass'));
}
/** An axis-aligned deck box under a span, top at the span's deck height. */
export function deckCollider(span: Span): ColliderDesc {
  return boxDesc({ x: (span.x0 + span.x1) / 2, z: (span.z0 + span.z1) / 2, hw: Math.max(span.width / 2, Math.abs(span.x1 - span.x0) / 2),
    hd: span.x0 === span.x1 ? Math.abs(span.z1 - span.z0) / 2 : span.width / 2, rot: 0, yBottom: span.y - 0.3, yTop: span.y }, 'wood');
}
/** Rope rails along both long sides of a span. */
function railColliders(span: Span): ColliderDesc[] {
  const alongX = span.z0 === span.z1, half = (alongX ? Math.abs(span.x1 - span.x0) : Math.abs(span.z1 - span.z0)) / 2;
  const cx = (span.x0 + span.x1) / 2, cz = (span.z0 + span.z1) / 2;
  return [-1, 1].map((side) => boxDesc({ x: alongX ? cx : cx + side * span.width / 2, z: alongX ? cz + side * span.width / 2 : cz,
    hw: alongX ? half : 0.06, hd: alongX ? 0.06 : half, rot: 0, yBottom: span.y, yTop: span.y + 1.1 }, 'wood'));
}
/** The updraft's sloped deck: one box tilted about X so its top runs from (z0, y0) up to (z1, y1). */
export function updraftCollider(): ColliderDesc {
  const half = UPDRAFT_ANGLE / 2, hy = 0.15, midY = (UPDRAFT.y0 + UPDRAFT.y1) / 2, midZ = (UPDRAFT.z0 + UPDRAFT.z1) / 2;
  return { kind: 'box', x: UPDRAFT.x, y: midY - hy * Math.cos(UPDRAFT_ANGLE), z: midZ - hy * Math.sin(UPDRAFT_ANGLE), hx: UPDRAFT.width / 2, hy, hz: UPDRAFT_LENGTH / 2,
    rot: { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) }, surface: 'wood' };
}
/**
 * A vane's colliders, measured off the generated shrine (C6, fitted 3.6 m tall on its footing): the stone plinth
 * (0.9 × 0.85 m up to 0.8 m), the shrine box above it (1.25 × 0.6 m to 1.5 m), then the 0.3 m post to the rotor.
 */
export function vaneColliders(x: number, z: number, y: number): ColliderDesc[] {
  return [
    boxDesc({ x, z: z - 0.02, hw: 0.45, hd: 0.43, rot: 0, yBottom: y, yTop: y + 0.8 }, 'stone'),
    boxDesc({ x: x + 0.04, z: z - 0.03, hw: 0.62, hd: 0.3, rot: 0, yBottom: y + 0.8, yTop: y + 1.5 }, 'stone'),
    boxDesc({ x, z, hw: 0.15, hd: 0.15, rot: 0, yBottom: y + 1.5, yTop: y + 3.2 }, 'wood'),
  ];
}
const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.z1 - span.z0);
const spanYaw = (span: Span): number => Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0));

export interface BuiltWorld {
  /** The hover decks' shared material: the plugin brightens it while the player rides the board. */
  readonly hoverDeck: MeshStandardMaterial;
  /** The updraft's wind spiral; the plugin turns it. */
  readonly wind: UpdraftFx;
  /** The fallen bridge's pivot on the step's rim; rotation.x runs from FALLEN_ANGLE (hanging) to 0 (raised). */
  readonly fallen: Object3D;
  readonly millHub: Object3D;
  /** The crown's storm vortex (the plugin turns it and fires its lightning). */
  readonly storm: CrownStorm;
  readonly vanes: readonly { readonly id: string; readonly at: Vector3; readonly rotor: Object3D }[];
  readonly winch: Interactable;
  readonly winchAt: Vector3;
  readonly notes: Interactable;
  readonly notesAt: Vector3;
  /** Gameplay state the pieces' `active()` read. */
  readonly state: { raised: boolean; raising: boolean };
}

export function buildWorld(ctx: ShardContext, isBoard: () => boolean): BuiltWorld {
  const random = ctx.app.rng.stream('cosmetic'), rnd = (): number => random.next(), root = new Group();
  const names: Record<string, string> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost, grove: STRINGS.grove,
    keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  for (const isle of ISLES) {
    const mesh = islandMesh(isle, rnd); mesh.position.set(isle.x, isle.y, isle.z); root.add(mesh);
    ctx.piece({ id: `far.isle.${isle.id}`, name: names[isle.id] ?? isle.id, category: 'ground', file: FILE, object: mesh, colliders: islandColliders(isle), surface: 'grass' });
  }
  const pineAt: [number, number, number, number][] = [];
  for (const isle of ISLES) for (const [dx, dz, s] of PINES[isle.id] ?? []) pineAt.push([isle.x + dx, isle.y, isle.z + dz, s]);
  const forest = pines(pineAt); root.add(forest);
  ctx.piece({ id: 'far.pines', name: STRINGS.pines, category: 'props', file: FILE, object: forest });
  // the meadow and the roots (loop 2): grass clumps, flowers, stones, hanging roots; no colliders
  const dress = dressIslands(); root.add(dress.group);
  ctx.piece({ id: 'far.dressing', name: STRINGS.meadow, category: 'props', file: FILE, object: dress.group });
  // the skyline: decorative 3-D islands and waterfalls out past the archipelago, and the windmill isle's fall
  const sky = skyline(WINDMILL); root.add(sky);

  const plank = flat(PALETTE.plank), rope = flat(PALETTE.rope);
  const hoverDeck = flat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 0.45, transparent: true, opacity: 0.45, depthWrite: false });
  for (const span of SPANS) {
    const hover = span.kind === 'hover', length = spanLength(span), bridge = plankBridge(length, span.width, hover ? hoverDeck : plank, hover ? null : rope);
    if (hover) for (const z of [0, -length]) for (const side of [-1, 1]) {
      const post = plankBridge(1.4, 0.18, hoverDeck, null); post.rotation.x = Math.PI / 2; post.position.set(side * span.width / 2, 0, z); bridge.add(post);
    }
    bridge.position.set(span.x0, span.y, span.z0); bridge.rotation.y = spanYaw(span); root.add(bridge);
    ctx.piece({ id: span.id, name: hover ? STRINGS.hover : STRINGS.rope, category: 'buildings', file: FILE, object: bridge,
      colliders: hover ? [deckCollider(span)] : [deckCollider(span), ...railColliders(span)], surface: 'wood', ...(hover ? { active: isBoard } : {}) });
  }

  // The updraft: a board-only rising wind ramp (a hover deck tilted up the wind column) from the windmill isle to the step.
  const ramp = plankBridge(UPDRAFT_LENGTH, UPDRAFT.width, hoverDeck, null);
  ramp.position.set(UPDRAFT.x, UPDRAFT.y0, UPDRAFT.z0); ramp.rotation.x = UPDRAFT_ANGLE; root.add(ramp);
  // the wind column: a spiral of streaks and leaves up the ramp (loop 3; the plugin turns it)
  const wind = updraftFx(new Vector3(UPDRAFT.x, UPDRAFT.y0 + 2.2, UPDRAFT.z0), new Vector3(UPDRAFT.x, UPDRAFT.y1 + 2.2, UPDRAFT.z1));
  for (const o of wind.objects) root.add(o); wind.update(0);
  ctx.piece({ id: 'far.updraft', name: STRINGS.updraft, category: 'buildings', file: FILE, object: ramp, colliders: [updraftCollider()], surface: 'wood', active: isBoard });

  // The fallen bridge hangs from its pivot until the winch raises it; it collides only once it is fully up.
  const state = { raised: false, raising: false };
  const fallen = new Group(), deck = plankBridge(spanLength(FALLEN_BRIDGE), FALLEN_BRIDGE.width, plank, rope);
  fallen.add(deck); fallen.position.set(FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0); fallen.rotation.x = FALLEN_ANGLE; root.add(fallen);
  ctx.piece({ id: FALLEN_BRIDGE.id, name: STRINGS.fallen, category: 'buildings', file: FILE, object: fallen,
    colliders: [deckCollider(FALLEN_BRIDGE), ...railColliders(FALLEN_BRIDGE)], surface: 'wood', active: () => state.raised });

  const mill = windmill(); mill.group.position.set(MILL.x, 30, MILL.z); mill.group.rotation.y = 0.35; root.add(mill.group);
  ctx.piece({ id: 'far.windmill', name: STRINGS.mill, category: 'buildings', file: FILE, object: mill.group,
    colliders: [boxDesc({ x: MILL.x, z: MILL.z, hw: 2, hd: 2, rot: 0.35, yBottom: 30, yTop: 40 }, 'wood')], surface: 'wood' });

  const drum = winch(); drum.position.set(WINCH.x, WINCH.y, WINCH.z); root.add(drum);
  ctx.piece({ id: 'far.winch', name: STRINGS.winch, category: 'props', file: FILE, object: drum,
    colliders: [boxDesc({ x: WINCH.x, z: WINCH.z, hw: 0.8, hd: 0.2, rot: 0, yBottom: WINCH.y, yTop: WINCH.y + 1.2 }, 'wood')], surface: 'wood' });
  const winchAt = new Vector3(WINCH.x, WINCH.y + 1.2, WINCH.z);
  const handle: Interactable = { label: STRINGS.turnWinch, position: winchAt, radius: 3, onInteract: () => { if (!state.raised) state.raising = true; } };

  const page = lectern(); page.position.set(NOTES.x, NOTES.y, NOTES.z); page.rotation.y = 0.6; root.add(page);
  ctx.piece({ id: 'far.notes', name: STRINGS.notesName, category: 'props', file: FILE, object: page,
    colliders: [boxDesc({ x: NOTES.x, z: NOTES.z, hw: 0.3, hd: 0.3, rot: 0.6, yBottom: NOTES.y, yTop: NOTES.y + 1.1 }, 'wood')], surface: 'wood' });
  const notesAt = new Vector3(NOTES.x, NOTES.y + 1.3, NOTES.z);
  const notes: Interactable = { label: STRINGS.readNotes, position: notesAt, radius: 2.6, onInteract: () => undefined };

  const vanes = VANES.map((v) => {
    const built = vane(); built.group.position.set(v.x, v.y, v.z); root.add(built.group);
    ctx.piece({ id: `far.vane.${v.id}`, name: STRINGS.vane, category: 'props', file: FILE, object: built.group,
      colliders: vaneColliders(v.x, v.z, v.y), surface: 'wood' });
    return { id: v.id, at: new Vector3(v.x, v.y + 3.3, v.z), rotor: built.rotor };
  });

  // the arena (loop 4, mockup D): standing stones with wind glyphs, pennant ropes, the compass-rose dais
  const arena = crownArena(); root.add(arena);
  const stones: ColliderDesc[] = crownStones().map((st) => boxDesc({ x: st.x, z: st.z, hw: CROWN_RING.width / 2, hd: CROWN_RING.depth / 2, rot: -st.yaw, yBottom: CROWN.y, yTop: CROWN.y + st.h }, 'stone'));
  ctx.piece({ id: 'far.crown.ruin', name: STRINGS.crown, category: 'buildings', file: FILE, object: arena, surface: 'stone',
    colliders: [boxDesc({ x: DAIS.x, z: DAIS.z, hw: DAIS.r * 0.9, hd: DAIS.r * 0.9, rot: 0, yBottom: CROWN.y, yTop: CROWN.y + DAIS.h }, 'stone'), ...stones] });
  // the storm: a lit vortex high over the crown only (loop 3); it melts into the haze from the spawn
  const stormTex = bakeSeaTexture(SUN_DIR); ctx.scope.own(stormTex);
  const storm = crownStorm(SUN_DIR, stormTex, rnd); storm.group.position.set(CROWN.x, CROWN.y + STORM.lift, CROWN.z); root.add(storm.group);

  ctx.root.add(root); ownPrimitives(root, ctx.scope);
  return { hoverDeck, wind, fallen, millHub: mill.hub, storm, vanes, winch: handle, winchAt, notes, notesAt, state };
}
