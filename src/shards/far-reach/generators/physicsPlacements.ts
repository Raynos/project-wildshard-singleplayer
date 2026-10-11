import type { BoxColliderData } from '@wildshard/sdk/physics';
import { APOTHEM, ISLES, type Isle } from '../data/layout';
import { STRINGS } from '../data/strings';
import { risingIsletRows } from './risingIslets';

/** The original native island/landing rest transport; movable bodies remain runtime-owned. */
export interface SkyPhysicsPlacement {
  id: string; name: string; category: 'ground' | 'buildings'; file: string;
  colliders: BoxColliderData[]; active: true; surface: 'grass' | 'stone';
}

/** Cover the twelve-sided top with the shipping six strips, retaining yaw and numeric operation order. */
function islandStrips(isle: Isle): BoxColliderData[] {
  const half = isle.r * APOTHEM, width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map(index => ({ kind: 'box', x: isle.x, y: ((isle.y - 2) + isle.y) / 2, z: isle.z,
    hx: half, hy: (isle.y - (isle.y - 2)) / 2, hz: width, yaw: 0 - (index * Math.PI) / 6, surface: 'grass' }));
}

/** Compile the twelve fixed island tops and four road lips from retained author rows.
 * This complete component contains no model constructors, renderers or recorded physics inputs.
 * Mesh-derived hulls, creature rigs and the live mover poses remain outside its qualification.
 */
export function skyPhysicsPlacements(): SkyPhysicsPlacement[] {
  const entries = risingIsletRows().entries;
  const names: Readonly<Record<string, string>> = { sunrest: STRINGS.sunrest, windmill: STRINGS.windmill, roost: STRINGS.roost,
    grove: STRINGS.grove, keeper: STRINGS.keeper, ruin: STRINGS.ruin, step: STRINGS.step, crown: STRINGS.crown };
  const islands = [...ISLES, ...entries.map(entry => entry.gate)].map(isle => ({
    id: `far.isle.${isle.id}`, name: names[isle.id] ?? STRINGS.gateIsle, category: 'ground' as const,
    file: 'src/shards/far-reach/world/build.ts', colliders: islandStrips(isle), active: true as const, surface: 'grass' as const,
  }));
  const lips = entries.map(({ edge, landing: l }) => ({ id: `far.islet.lip.${edge}`, name: STRINGS.isletLip, category: 'buildings' as const,
    file: 'src/shards/far-reach/world/risingIslet.ts',
    colliders: [{ kind: 'box' as const, x: l.x, y: l.y, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface }],
    active: true as const, surface: 'stone' as const,
  }));
  return [...islands, ...lips];
}
