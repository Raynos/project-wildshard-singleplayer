import type { BoxColliderData, ColliderData } from '@wildshard/sdk/physics';
import { APOTHEM, DECK, ISLES, MILL, MILL_DRUM, NOTES, VANES, WINCH, type Isle } from '../data/layout';
import { STRINGS } from '../data/strings';
import { risingIsletRows } from './risingIslets';

/** The original native island/landing/prop rest transport; movable bodies remain runtime-owned. */
export interface SkyPhysicsPlacement {
  id: string; name: string; category: 'ground' | 'buildings' | 'props'; file: string;
  colliders: ColliderData[]; active: true; surface: 'grass' | 'stone' | 'wood';
}

const BUILD = 'src/shards/far-reach/world/build.ts';
/** A box standing from `yBottom` to `yTop`, turned `rot` (the registry's footprint box, in its numeric operation order). */
function standing(x: number, z: number, hw: number, hd: number, rot: number, yBottom: number, yTop: number, surface: 'stone' | 'wood'): BoxColliderData {
  return { kind: 'box', x, y: (yTop + yBottom) / 2, z, hx: hw, hy: Math.max(0.005, (yTop - yBottom) / 2), hz: hd, yaw: 0 - rot, surface };
}
/** The rock drum under the mill: a convex ring of stone, MILL_DRUM.h proud of the deck (float32 points, as a hull holds them). */
function millDrum(): ColliderData {
  const points: number[] = [];
  for (let i = 0; i < MILL_DRUM.sides; i++) {
    const a = (i / MILL_DRUM.sides) * Math.PI * 2, x = Math.fround(Math.cos(a) * MILL_DRUM.r), z = Math.fround(Math.sin(a) * MILL_DRUM.r);
    points.push(x, Math.fround(-0.2), z, x, Math.fround(MILL_DRUM.h), z);
  }
  return { kind: 'hull', x: MILL.x, y: DECK, z: MILL.z, points, surface: 'stone' };
}
/** The windmill (its tower box and the drum), the winch, the keeper's notes and the three vanes (measured off the generated
 *  shrine, C6, fitted 3.6 m tall on its footing: the stone plinth, the shrine box, then the post to the rotor). */
function props(): SkyPhysicsPlacement[] {
  const prop = (id: string, name: string, category: 'buildings' | 'props', surface: 'stone' | 'wood', colliders: ColliderData[]): SkyPhysicsPlacement =>
    ({ id, name, category, file: BUILD, colliders, active: true, surface });
  return [
    prop('far.windmill', STRINGS.mill, 'buildings', 'stone', [standing(MILL.x, MILL.z, 2.3, 2.3, -MILL.yaw, 30, 39, 'stone'), millDrum()]),
    prop('far.winch', STRINGS.winch, 'props', 'wood', [standing(WINCH.x, WINCH.z, 0.8, 0.2, 0, WINCH.y, WINCH.y + 1.2, 'wood')]),
    prop('far.notes', STRINGS.notesName, 'props', 'wood', [standing(NOTES.x, NOTES.z, 0.3, 0.3, 0.6, NOTES.y, NOTES.y + 1.1, 'wood')]),
    ...VANES.map(({ id, x, z, y }) => prop(`far.vane.${id}`, STRINGS.vane, 'props', 'wood', [
      standing(x, z - 0.02, 0.45, 0.43, 0, y, y + 0.8, 'stone'),
      standing(x + 0.04, z - 0.03, 0.62, 0.3, 0, y + 0.8, y + 1.5, 'stone'),
      standing(x, z, 0.15, 0.15, 0, y + 1.5, y + 3.2, 'wood'),
    ])),
  ];
}

/** Cover the twelve-sided top with the shipping six strips, retaining yaw and numeric operation order. */
function islandStrips(isle: Isle): BoxColliderData[] {
  const half = isle.r * APOTHEM, width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map(index => ({ kind: 'box', x: isle.x, y: ((isle.y - 2) + isle.y) / 2, z: isle.z,
    hx: half, hy: (isle.y - (isle.y - 2)) / 2, hz: width, yaw: 0 - (index * Math.PI) / 6, surface: 'grass' }));
}

/** Compile the twelve fixed island tops, four road lips and the fixed props from retained author rows.
 * This complete component contains no model constructors, renderers or recorded physics inputs.
 * Mesh-derived hulls, creature rigs and the live mover poses remain outside its qualification.
 */
export function skyPhysicsPlacements(): SkyPhysicsPlacement[] {
  const entries = risingIsletRows().entries;
  const names: Readonly<Record<string, string>> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost,
    grove: STRINGS.grove, keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  const islands = [...ISLES, ...entries.map(entry => entry.gate)].map(isle => ({
    id: `far.isle.${isle.id}`, name: names[isle.id] ?? STRINGS.gateIsle, category: 'ground' as const,
    file: BUILD, colliders: islandStrips(isle), active: true as const, surface: 'grass' as const,
  }));
  const lips = entries.map(({ edge, landing: l }) => ({ id: `far.islet.lip.${edge}`, name: STRINGS.isletLip, category: 'buildings' as const,
    file: 'src/shards/far-reach/world/risingIslet.ts',
    colliders: [{ kind: 'box' as const, x: l.x, y: l.y, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface }],
    active: true as const, surface: 'stone' as const,
  }));
  return [...islands, ...lips, ...props()];
}
