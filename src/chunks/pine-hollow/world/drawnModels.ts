/**
 * Pine Hollow's forest models (E315 M2): the forest's trees and the forest floor's plants and litter.
 *  - The trees: src/world/Forest.ts places them (placement.ts), and — the shard's `trees.drawnBy: 'model'` — `place` draws
 *    them into its group (E315 second pass): 4 BatchedMeshes where multi-draw exists, the forest tree model's LODs as the
 *    forest's bands (near cards + twigs, lo cards, the impostor dissolving in), culled from the forest's view with its
 *    visibility test (`Forest.keeps`: padded frustum, near, or a shadow falling into view). Their trunks collide as the
 *    forest's capsules (the core `forest` piece).
 *  - The floor: src/world/Undergrowth.ts is the field (where the ~22 000 copies stand, each kind's geometry and shader
 *    material); `place` draws each kind instanced into the field's group and culls it per 32 m cell round the forest's
 *    view (`cull.cells`, E315 second pass). Walked through: no colliders.
 *
 *   placeDrawnModels({ sky, renderer, forest, under, registry });   // main.ts, once the carpet step has built
 */
import * as THREE from 'three';
import { place } from '../../../models/place';
import type { Placement } from '../../../models/model';
import type { Forest } from '../../../world/Forest';
import { matrixOf, UNDER_CELLS, type Undergrowth } from '../../../world/Undergrowth';
import type { WorldRegistry } from '../../../world/registry';
import type { Sky } from '../../../world/Sky';
import { TREE_SPECS_V2 } from '../../../world/treeSpecies';
import type { Placement as UnderPlacement } from '../../../world/placement';
import { pineModels } from './context';
import { useUndergrowth } from './undergrowthKit';
import { forestTree, useTreeFactory, type ForestTreeParams } from '../models/forestTree';
import { fern } from '../models/fern';
import { shrub } from '../models/shrub';
import { needleLitter } from '../models/needleLitter';
import { pebbles } from '../models/pebbles';
import { moss } from '../models/moss';
import { reeds } from '../models/reeds';

export function placeDrawnModels(h: { sky: Sky; renderer: THREE.WebGLRenderer | null; forest: Forest | null; under: Undergrowth | null; registry: WorldRegistry }): void {
  const ctx = pineModels(h.sky, h.renderer);
  const { forest, under, registry } = h;
  if (forest && forest.trees.length > 0) {
    // a build without the species set's files plants the runtime pines: the forest draws those itself (no model)
    if (forest.drawer !== 'model' || forest.factory.variants.length !== TREE_SPECS_V2.length) forest.drawItself();
    else {
      useTreeFactory(ctx, forest.factory);
      // each tree's matrix composed as the forest's own drawing composed it (position, a turn about +Y, its scale)
      const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), sc = new THREE.Vector3();
      const pls = forest.trees.map((t): Placement<ForestTreeParams> => ({ x: t.x, y: t.y, z: t.z, variant: TREE_SPECS_V2[t.variant]?.name ?? 'pine-a', color: t.tint,
        matrix: new THREE.Matrix4().compose(at.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), sc.set(t.scale, t.scale, t.scale)) }));
      place(forestTree, pls, { ctx, draw: forest.path, registry, piece: { id: 'pine-hollow/forest-tree' }, sortObjects: false,
        cull: { view: forest, test: forest.keeps, from: 'origin', flat: true }, parent: forest.group });
    }
  }
  if (under) {
    useUndergrowth(ctx, { kinds: under.kinds, placements: under.layout });
    const kinds = [[fern, 'ferns'], [shrub, 'shrubs'], [needleLitter, 'litter'], [pebbles, 'stones'], [moss, 'moss'], [reeds, 'reeds']] as const;
    const cull = { view: under.view, cells: { size: UNDER_CELLS.size, pad: UNDER_CELLS.pad }, far: UNDER_CELLS.far };
    for (const [model, kind] of kinds) {
      const items: readonly UnderPlacement[] = under.layout[kind];
      if (items.length === 0) continue;
      place(model, items.map((it) => ({ x: it.x, y: it.y, z: it.z, matrix: matrixOf(it), color: new THREE.Color(it.r, it.g, it.b) })),
        { ctx, draw: 'instanced', registry, piece: { id: model.id }, cull, parent: under.group });
    }
  }
}
