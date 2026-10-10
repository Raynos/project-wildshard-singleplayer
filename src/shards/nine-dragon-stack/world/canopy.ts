// Copied from the organic lab (the dev labs (deleted in E357 F7), round-9-lab-organic) into the clean room by dome B
// (E169, round-10-dome-b): the banyan's painted leaf-card canopy. Dome B's banyan (banyan.ts) plans the lumps; the
// builder at the end of this file (`buildCanopy`) dresses them and is wired in main.ts after the spill bake.
// Lab P7 "organic" (E169): the banyan's leaf mass. The clean room's canopy is the hero lab's cloud-shelves: 7–9
// flattened ellipsoid lumps on every limb tip, which read as smooth blobs. The targets (round-6 style A, round-8
// look-loop targets) show a dense, layered, PAINTED leaf mass: clusters of outlined gongbi leaves in three flat greens,
// dark bellies, light breaking through between the clusters. Four ways to build it, all on the same lumps (`planLumps`):
//  - 'lumps'  the clean room's K.leaf ellipsoids (the baseline; drawn by the Jiehua program, not here);
//  - 'cards'  painted leaf-cluster cards (a codex gongbi atlas, 2×2 clusters) clustered over every lump's surface, lit
//             with the LUMP's normal (so a card is part of a volume, never a flat cut-out), alpha-to-coverage under the
//             MSAA ×4 target (no discard), then a depth-equal pass that writes the inverse depth into alpha so the post
//             silhouette inks the leafy edge (a2c alone would write the coverage there);
//  - 'leaves' real leaf geometry: every leaf a 7-vertex fan with its outline drawn from a rim distance attribute,
//             opaque (hidden-surface removal stays on); it needs ~10× the triangles for the same cover;
//  - 'shells' the lumps re-tessellated and displaced into scalloped cloud-shelves (a leafy bump per cluster), with the
//             Voronoi leaf pattern painted in the fragment program: the cheap opaque option.
// 'cards' and 'leaves' also draw the lumps shrunk (`inner` mode, darker) as the crown's core, so no view sees through
// the tree. Every foliage fragment reports its LUMP's front depth to the post silhouette (the plateau, see the VS), and
// the silk fog runs per vertex. The winner and its parameters: art/nine-dragon-stack/round-9-lab-organic/README.md.
// SHARD-PLATFORM M3: the foliage program's GLSL, its rows and the crown's uniforms are data (data/canopy.ts); the card
// canopy (@wildshard/sdk/looks/cardCanopy) draws them.
import type { Mesh } from 'three';
import type { Emitter } from '@wildshard/sdk/looks/vertexSpill';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { type CanopyGeometry as PlatformCanopyGeometry, buildCardCanopy } from '@wildshard/sdk/looks/cardCanopy';
import { DOME_B_CROWN, FOLIAGE_PROGRAMS, LEAF_ATLAS } from '../data/canopy';
import { LOOK_FRAGMENTS, type Shared } from '../look/style';

/** the canopy's baked geometry over a plan's lumps: the painted cards and the darker core under them */
export type CanopyGeometry = PlatformCanopyGeometry;

const FOLIAGE_FAMILY = new ShaderFamily(LOOK_FRAGMENTS, FOLIAGE_PROGRAMS);

/**
 * Dome B: dress the banyan's lumps with the painted cards (G285: their geometry is baked, ../generators/canopyGeometry.ts
 * `canopyGeometries` over the layout's plan; null when the plan has no lumps) (alpha to coverage, then the depth-equal pass that writes the
 * lumps' plateau depth into the colour target's alpha for the post's ink) over a darker core. Returns the meshes to add
 * (none when the atlas fails: the tree then stands bare, which shows at once). Spill is baked like the kits'.
 */
export function buildCanopy(shared: Shared, crown: CanopyGeometry | null, emitters: readonly Emitter[]): Promise<Mesh[]> {
  return buildCardCanopy(FOLIAGE_FAMILY, shared.u, { cards: 'cards', plateau: 'cards-depth', core: 'inner', uniforms: DOME_B_CROWN, atlas: LEAF_ATLAS, label: 'nine-dragon' }, crown, emitters);
}
