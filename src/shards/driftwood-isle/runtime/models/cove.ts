/**
 * The Blender spawn cove's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts). The cove
 * (DRIFTWOOD-REMASTER X2, E52) is built by src/shards/driftwood-isle/blender/build_island.py into one file,
 * public/assets/models/driftwood-blender/island.glb: its terrain tiles (world: the cove's ground) and ~60 prototypes —
 * palms, crag plates, driftwood, shells, grass, ferns, flowers, bushes — each vertex-coloured, its colour's alpha the
 * Cycles-baked AO. Those prototypes are these models, one per family, one variant per prototype (`proto`: its name in
 * the file). Where they come from (the card's badge): the Blender script builds most of them in code; the palms are
 * Quaternius CC0 palms and TRELLIS.2 hero palms, the driftwood and the coconut cluster TRELLIS.2 generations
 * (scripts/img2mesh/props/driftwood-hero.json), all cleaned up and baked in Blender.
 *
 * Their ~16,700 placements are the cove's layout (placements.bin): src/shards/driftwood-isle/world/BlenderIsland.ts places
 * each family instanced (the palms with a far copy, the ground cover fading plant by plant) in its look's material. The
 * Explorer's specimen is one prototype on its own, in its own space (origin at its foot), in the casters' look, from the
 * loaded file (the island hands its prototypes to the shard's model context, `coveProtos`).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import type { Pipeline } from '@wildshard/engine/world/registry';
import { ISLAND_LOOK } from '../../data/islandRows';

/** a prototype as the island reads it: positions (own space), rgba colours (a = AO), triangle indices */
export interface CoveProto { readonly pos: Float32Array; readonly col: Uint8Array; readonly index: Uint32Array }

/** a family's look in the world: the casters', the small cover's or the big cover's (data/islandLook.ts) */
export type CoveLook = 'cast' | 'cover' | 'big';

/** the island's loaded prototypes by name (a palm's far copy is `<name>_lo`) and each look's material */
export interface CoveProtos { readonly protos: ReadonlyMap<string, CoveProto>; readonly materials: Readonly<Record<CoveLook, THREE.Material>> }

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
  /** a caster (palms, crags, driftwood) casts a shadow; the ground cover does not, the big cover keeps a longer reach */
  readonly look: CoveLook;
  /** a far copy (`<proto>_lo`, the near one simplified) from this many metres */
  readonly far?: number;
}

/** the families, by the prototype names' stem (build_island.py: PALM_SRC, the broad palms, CLIFF_V, KIND) */
const FAMILIES = {
  palm: { name: 'Cove palm', protos: ['palm0', 'palm1', 'palm2', 'palm3', 'palm4'], pipeline: ['cc0', 'trellis', 'blender'], look: 'cast', far: ISLAND_LOOK.lod },
  bpalm: { name: 'Broad-frond palm', protos: ['bpalm0', 'bpalm1', 'bpalm2', 'bpalm3'], pipeline: 'blender', look: 'cast', far: ISLAND_LOOK.lod },
  cliff: { name: 'Crag plate', protos: ['cliff0', 'cliff1', 'cliff2', 'cliff3', 'cliff4', 'cliff5'], pipeline: 'blender', look: 'cast' },
  drift: { name: 'Driftwood', protos: ['drift0', 'drift1', 'drift2', 'drift3'], pipeline: ['trellis', 'blender'], look: 'cast' },
  coconuts: { name: 'Coconut cluster', protos: ['coconuts0'], pipeline: ['trellis', 'blender'], look: 'cast' },
  shell: { name: 'Shell', protos: ['shell0', 'shell1', 'shell2', 'shell3'], pipeline: 'blender', look: 'cover' },
  star: { name: 'Starfish', protos: ['star0', 'star1', 'star2'], pipeline: 'blender', look: 'cover' },
  pebble: { name: 'Pebbles', protos: ['pebble0', 'pebble1', 'pebble2', 'pebble3'], pipeline: 'blender', look: 'cover' },
  beachgrass: { name: 'Beach grass', protos: ['beachgrass0', 'beachgrass1', 'beachgrass2'], pipeline: 'blender', look: 'cover' },
  tuft: { name: 'Grass tuft', protos: ['tuft0', 'tuft1', 'tuft2', 'tuft3'], pipeline: 'blender', look: 'cover' },
  fern: { name: 'Cove fern', protos: ['fern0', 'fern1', 'fern2'], pipeline: 'blender', look: 'big' },
  hibiscus: { name: 'Hibiscus clump', protos: ['hibiscus0', 'hibiscus1', 'hibiscus2'], pipeline: 'blender', look: 'big' },
  yellow: { name: 'Yellow flowers', protos: ['yellow0', 'yellow1'], pipeline: 'blender', look: 'cover' },
  white: { name: 'White flowers', protos: ['white0', 'white1'], pipeline: 'blender', look: 'cover' },
  bush: { name: 'Cove bush', protos: ['bush0', 'bush1', 'bush2'], pipeline: 'blender', look: 'big' },
  flowerbush: { name: 'Flowering bush', protos: ['flowerbush0', 'flowerbush1'], pipeline: 'blender', look: 'big' },
} as const satisfies Record<string, Family>;

export type CoveFamily = keyof typeof FAMILIES;

/** a prototype as the island draws it: its geometry (flat normals for the shadow bias) in own space, in `material` */
function protoPart(ctx: ModelContext, proto: string, look: CoveLook, material: CoveLook): { geometry: THREE.BufferGeometry; material: THREE.Material; castShadow: boolean; receiveShadow: boolean }[] {
  const island = coveProtos(ctx), p = island?.protos.get(proto);
  if (!island || !p) return [];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.pos.slice(), 3));
  g.setAttribute('color', new THREE.BufferAttribute(p.col.slice(), 4, true));
  g.setIndex(new THREE.BufferAttribute(p.index.slice(), 1));
  g.computeVertexNormals();
  return [{ geometry: g, material: island.materials[material], castShadow: look === 'cast', receiveShadow: true }];
}

function coveModel(key: CoveFamily): ModelDef<CoveParams> {
  const f: Family = FAMILIES[key];
  const first = f.protos[0] ?? '';
  return defineModel<CoveParams>({
    id: `driftwood-isle/cove-${key}`, name: f.name, category: 'nature', pipeline: f.pipeline,
    file: 'src/shards/driftwood-isle/models/cove.ts',
    defaults: { proto: first },
    variants: f.protos.map((proto, i) => ({ id: proto, label: `${f.name} ${i + 1}`, params: { proto } })),
    build: (ctx, p) => protoPart(ctx, p.proto, f.look, f.look),
    ...(f.far === undefined ? {} : { lods: [{ from: f.far, build: (ctx: ModelContext, p: CoveParams) => protoPart(ctx, `${p.proto}_lo`, f.look, f.look) }] }),
    // the Explorer's turntable: one copy in the casters' look (a cover look fades its copies by their distance)
    specimen: (ctx, p) => protoPart(ctx, p.proto, f.look, 'cast'),
  });
}

/** every family's model, and the family a prototype belongs to */
export const COVE_MODELS: Readonly<Record<CoveFamily, ModelDef<CoveParams>>> = {
  palm: coveModel('palm'), bpalm: coveModel('bpalm'), cliff: coveModel('cliff'), drift: coveModel('drift'), coconuts: coveModel('coconuts'),
  shell: coveModel('shell'), star: coveModel('star'), pebble: coveModel('pebble'), beachgrass: coveModel('beachgrass'), tuft: coveModel('tuft'),
  fern: coveModel('fern'), hibiscus: coveModel('hibiscus'), yellow: coveModel('yellow'), white: coveModel('white'), bush: coveModel('bush'),
  flowerbush: coveModel('flowerbush'),
};

/** a family's look in the world */
export const coveLook = (key: CoveFamily): CoveLook => FAMILIES[key].look;

/** the family of a prototype name (undefined: not a cove model — the terrain, the rocks the shore boulders replace, the far cuts) */
export function coveFamilyOf(proto: string): CoveFamily | undefined {
  const stem = proto.replace(/\d+$/, '');
  return stem in FAMILIES ? stem as CoveFamily : undefined;
}
