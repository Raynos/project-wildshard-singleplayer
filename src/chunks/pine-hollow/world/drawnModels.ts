/**
 * Pine Hollow's models that the world's own machinery draws (E315 M2): the forest's trees (src/world/Forest.ts: its
 * banded LODs, dissolves, shadow-keep culling and wind over 4 BatchedMeshes) and the forest floor's plants and litter
 * (src/world/Undergrowth.ts: ~22 000 copies culled per cell and faded in the shader). Their drawing stays exactly as it
 * is; `place(…, { drawnInto })` registers each model with its copies — its catalog card (× count, how it is drawn,
 * its pipeline, its variants), a tap on the drawn mesh picks the copy under the finger, VIEW IN WORLD lands on a real
 * copy. The trees' trunks collide as the forest's capsules (the core `forest` piece); the floor is walked through.
 *
 *   placeDrawnModels({ sky, renderer, forest, under, registry });   // main.ts, once the carpet step has built
 */
import type * as THREE from 'three';
import { place } from '../../../models/place';
import type { Placement } from '../../../models/model';
import type { Forest } from '../../../world/Forest';
import type { Undergrowth } from '../../../world/Undergrowth';
import type { WorldRegistry } from '../../../world/registry';
import type { Sky } from '../../../world/Sky';
import { TREE_SPECS_V2 } from '../../../world/treeSpecies';
import type { Placement as UnderPlacement } from '../../../world/placement';
import { pineModels } from './context';
import { useUndergrowth, type UnderKind } from './undergrowthKit';
import { forestTree, useTreeFactory, type ForestTreeParams } from '../models/forestTree';
import { fern } from '../models/fern';
import { shrub } from '../models/shrub';
import { needleLitter } from '../models/needleLitter';
import { pebbles } from '../models/pebbles';
import { moss } from '../models/moss';
import { reeds } from '../models/reeds';

/** a box per copy (min xyz, max xyz): `r` out from its foot, `h` up */
function boxes(n: number, at: (i: number) => { x: number; y: number; z: number; r: number; h: number }): Float32Array {
  const out = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const c = at(i); out.set([c.x - c.r, c.y - 0.2, c.z - c.r, c.x + c.r, c.y + c.h, c.z + c.r], i * 6); }
  return out;
}

export function placeDrawnModels(h: { sky: Sky; renderer: THREE.WebGLRenderer | null; forest: Forest | null; under: Undergrowth | null; registry: WorldRegistry }): void {
  const ctx = pineModels(h.sky, h.renderer);
  const { forest, under, registry } = h;
  if (forest && forest.trees.length > 0 && forest.factory.variants.length === TREE_SPECS_V2.length) {
    useTreeFactory(ctx, forest.factory);
    const trees = forest.trees;
    const pls = trees.map((t): Placement<ForestTreeParams> => ({ x: t.x, y: t.y, z: t.z, yaw: t.rot, scale: t.scale, variant: TREE_SPECS_V2[t.variant]?.name ?? 'pine-a' }));
    place(forestTree, pls, { ctx, draw: forest.path, registry, piece: { id: 'pine-hollow/forest-tree' },
      drawnInto: { object: forest.group, boxes: boxes(trees.length, (i) => { const t = trees[i]; return t ? { x: t.x, y: t.y, z: t.z, r: Math.max(2, t.height * 0.16), h: t.height } : { x: 0, y: 0, z: 0, r: 0, h: 0 }; }) } });
  }
  if (under) {
    const meshes: Record<UnderKind, THREE.InstancedMesh> = { ferns: under.ferns, shrubs: under.shrubs, litter: under.litter, stones: under.stones, moss: under.moss, reeds: under.reeds };
    useUndergrowth(ctx, { meshes, placements: under.layout });
    const kinds = [[fern, 'ferns', 0.6, 0.8], [shrub, 'shrubs', 0.7, 0.7], [needleLitter, 'litter', 0.7, 0.1], [pebbles, 'stones', 0.45, 0.1], [moss, 'moss', 0.5, 0.1], [reeds, 'reeds', 0.4, 1.2]] as const;
    for (const [model, kind, r, hgt] of kinds) {
      const items: readonly UnderPlacement[] = under.layout[kind];
      if (items.length === 0) continue;
      place(model, items.map((it) => ({ x: it.x, y: it.y, z: it.z })), { ctx, draw: 'instanced', registry, piece: { id: model.id },
        drawnInto: { object: meshes[kind], boxes: boxes(items.length, (i) => { const it = items[i]; return it ? { x: it.x, y: it.y, z: it.z, r: r * it.scale, h: hgt * it.scale } : { x: 0, y: 0, z: 0, r: 0, h: 0 }; }) } });
    }
  }
}
