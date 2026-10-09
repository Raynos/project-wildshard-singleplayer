/**
 * The Blender spawn cove's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts). The cove
 * (DRIFTWOOD-REMASTER X2, E52) is built by scripts/blender/driftwood-isle/build_island.py into one file,
 * public/assets/models/driftwood-blender/island.glb: its terrain tiles (world: the cove's ground) and ~60 prototypes —
 * palms, crag plates, driftwood, shells, grass, ferns, flowers, bushes — each vertex-coloured, its colour's alpha the
 * Cycles-baked AO. Those prototypes are these models, one per family, one variant per prototype (`proto`: its name in
 * the file). Where they come from (the card's badge): the Blender script builds most of them in code; the palms are
 * Quaternius CC0 palms and TRELLIS.2 hero palms, the driftwood and the coconut cluster TRELLIS.2 generations
 * (scripts/img2mesh/props/driftwood-hero.json), all cleaned up and baked in Blender.
 *
 * Their ~16,700 placements are the cove's layout (placements.bin), and the cove draws them itself: src/world/
 * BlenderIsland.ts welds them into its 2×2 m-cell tiles (casters with a far copy, ground cover fading plant by plant),
 * then places each family with `drawnInto` (its copies, their world boxes, the catalog card; nothing drawn twice). The
 * builds below are the Model Explorer's specimens: one prototype on its own, in its own space (origin at its foot), from
 * the loaded file (the island hands its prototypes to the shard's model context, `coveProtos`).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import type { Pipeline } from '@wildshard/engine/world/registry';

/** a prototype as the island reads it: positions (own space), rgba colours (a = AO), triangle indices */
export interface CoveProto { readonly pos: Float32Array; readonly col: Uint8Array; readonly index: Uint32Array }

/** the island's loaded prototypes by name, and the material its casters draw with (the specimens use it) */
export interface CoveProtos { readonly protos: ReadonlyMap<string, CoveProto>; readonly material: THREE.Material }

const KEY = 'driftwood-isle/cove:protos';

/** the island's prototypes on this shard's context (BlenderIsland sets them once the file is in; null before) */
export function coveProtos(ctx: ModelContext, loaded?: CoveProtos): CoveProtos | null {
  const slot = ctx.once<{ v: CoveProtos | null }>(KEY, () => ({ v: null }));
  slot.v ??= loaded ?? null;
  return slot.v;
}

export interface CoveParams {
  /** the prototype's name in island.glb (the variant) */
  readonly proto: string;
}

interface Family {
  readonly name: string;
  readonly protos: readonly string[];
  readonly pipeline: Pipeline | readonly Pipeline[];
  /** a caster (palms, crags, driftwood): it casts a shadow; the ground cover does not */
  readonly cast: boolean;
}

/** the families, by the prototype names' stem (build_island.py: PALM_SRC, the broad palms, CLIFF_V, KIND) */
const FAMILIES = {
  palm: { name: 'Cove palm', protos: ['palm0', 'palm1', 'palm2', 'palm3', 'palm4'], pipeline: ['cc0', 'trellis', 'blender'], cast: true },
  bpalm: { name: 'Broad-frond palm', protos: ['bpalm0', 'bpalm1', 'bpalm2', 'bpalm3'], pipeline: 'blender', cast: true },
  cliff: { name: 'Crag plate', protos: ['cliff0', 'cliff1', 'cliff2', 'cliff3', 'cliff4', 'cliff5'], pipeline: 'blender', cast: true },
  drift: { name: 'Driftwood', protos: ['drift0', 'drift1', 'drift2', 'drift3'], pipeline: ['trellis', 'blender'], cast: true },
  coconuts: { name: 'Coconut cluster', protos: ['coconuts0'], pipeline: ['trellis', 'blender'], cast: true },
  shell: { name: 'Shell', protos: ['shell0', 'shell1', 'shell2', 'shell3'], pipeline: 'blender', cast: false },
  star: { name: 'Starfish', protos: ['star0', 'star1', 'star2'], pipeline: 'blender', cast: false },
  pebble: { name: 'Pebbles', protos: ['pebble0', 'pebble1', 'pebble2', 'pebble3'], pipeline: 'blender', cast: false },
  beachgrass: { name: 'Beach grass', protos: ['beachgrass0', 'beachgrass1', 'beachgrass2'], pipeline: 'blender', cast: false },
  tuft: { name: 'Grass tuft', protos: ['tuft0', 'tuft1', 'tuft2', 'tuft3'], pipeline: 'blender', cast: false },
  fern: { name: 'Cove fern', protos: ['fern0', 'fern1', 'fern2'], pipeline: 'blender', cast: false },
  hibiscus: { name: 'Hibiscus clump', protos: ['hibiscus0', 'hibiscus1', 'hibiscus2'], pipeline: 'blender', cast: false },
  yellow: { name: 'Yellow flowers', protos: ['yellow0', 'yellow1'], pipeline: 'blender', cast: false },
  white: { name: 'White flowers', protos: ['white0', 'white1'], pipeline: 'blender', cast: false },
  bush: { name: 'Cove bush', protos: ['bush0', 'bush1', 'bush2'], pipeline: 'blender', cast: false },
  flowerbush: { name: 'Flowering bush', protos: ['flowerbush0', 'flowerbush1'], pipeline: 'blender', cast: false },
} as const satisfies Record<string, Family>;

export type CoveFamily = keyof typeof FAMILIES;

/** a prototype on its own: its geometry as the tiles weld it (flat normals for the shadow bias), in own space */
function specimen(ctx: ModelContext, p: CoveParams, cast: boolean): { geometry: THREE.BufferGeometry; material: THREE.Material; castShadow: boolean; receiveShadow: boolean }[] {
  const island = coveProtos(ctx), proto = island?.protos.get(p.proto);
  if (!island || !proto) return [];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(proto.pos.slice(), 3));
  g.setAttribute('color', new THREE.BufferAttribute(proto.col.slice(), 4, true));
  g.setIndex(new THREE.BufferAttribute(proto.index.slice(), 1));
  g.computeVertexNormals();
  return [{ geometry: g, material: island.material, castShadow: cast, receiveShadow: true }];
}

function coveModel(key: CoveFamily): ModelDef<CoveParams> {
  const f: Family = FAMILIES[key];
  const first = f.protos[0] ?? '';
  return defineModel<CoveParams>({
    id: `driftwood-isle/cove-${key}`, name: f.name, category: 'nature', pipeline: f.pipeline,
    file: 'src/shards/driftwood-isle/models/cove.ts',
    defaults: { proto: first },
    variants: f.protos.map((proto, i) => ({ id: proto, label: `${f.name} ${i + 1}`, params: { proto } })),
    build: (ctx, p) => specimen(ctx, p, f.cast),
  });
}

/** every family's model, and the family a prototype belongs to */
export const COVE_MODELS: Readonly<Record<CoveFamily, ModelDef<CoveParams>>> = {
  palm: coveModel('palm'), bpalm: coveModel('bpalm'), cliff: coveModel('cliff'), drift: coveModel('drift'), coconuts: coveModel('coconuts'),
  shell: coveModel('shell'), star: coveModel('star'), pebble: coveModel('pebble'), beachgrass: coveModel('beachgrass'), tuft: coveModel('tuft'),
  fern: coveModel('fern'), hibiscus: coveModel('hibiscus'), yellow: coveModel('yellow'), white: coveModel('white'), bush: coveModel('bush'),
  flowerbush: coveModel('flowerbush'),
};

/** the family of a prototype name (undefined: not a cove model — the terrain, the rocks the shore boulders replace, the far cuts) */
export function coveFamilyOf(proto: string): CoveFamily | undefined {
  const stem = proto.replace(/\d+$/, '');
  return stem in FAMILIES ? stem as CoveFamily : undefined;
}
