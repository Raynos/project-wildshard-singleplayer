import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { bakeRockScenes, type RockSceneBake, type SmallPlacement } from './rockScenes';
import { compactChannels } from './compactChannels';
import { shoreBoulderFacts } from './shoreBoulders';

type Copy = RockSceneBake['world']['shore'][number];
type Collider = RockSceneBake['shoreColliders'][number];
interface Sphere { center: number[]; radius: number }
/** a collider as JSON writes it: a hull's typed point array as a plain array */
type JsonCollider = Exclude<Collider, { kind: 'hull' }> | (Omit<Extract<Collider, { kind: 'hull' }>, 'points'> & { points: number[] });
type JsonCopy = Omit<Copy, 'colliders'> & { colliders: JsonCollider[] };
const hull = (shape: Collider): JsonCollider => shape.kind === 'hull' ? { ...shape, points: [...shape.points] } : { ...shape };
interface RockChoice { id: string; params: object; size: readonly number[]; colliders: JsonCollider[];
  draws: { id: string; library: string; model: string; material: string; sphere: number[]; castShadow: boolean; receiveShadow: boolean; renderOrder: number }[] }
interface RockCatalogueRow { key: string; id: string; name: string; file: string; category: 'nature'; pipeline: 'code'; surface: 'rock'; assembly: 'parts';
  defaults: object; variants: RockSceneBake['catalogue'][number]['variants']; choices: RockChoice[] }
interface RockSection {
  library: { id: string; kind: 'owned'; models: { id: string; file: { phone: string; desktop: string }; attributes: Record<string, never> }[] };
  step: { id: string; scene: string; geometry: Record<string, { library: string; model: string }>; materials: Record<string, string>; registry: never[];
    publish: Record<string, { kind: 'object'; part: string }>; bounds: { part: string; sphere: Sphere }[]; instanceAttributes: never[] };
}

/** The rocks' world scene (`scenes/rocks.json`) in its admitted form: the shore and small batches, one rock material port. */
const ROCK_SCENE = { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['shore', 'small'] },
  { kind: 'mesh', id: 'shore', geometry: 'shore', material: 'rock', missing: 'empty', children: [], castShadow: true, receiveShadow: true },
  { kind: 'mesh', id: 'small', geometry: 'small', material: 'rock', missing: 'empty', children: [], castShadow: true, receiveShadow: true }],
materials: [{ kind: 'port', id: 'rock', source: 'rock' }], textures: [] }, imports: [] } as const;

/** The finished world draws and Explorer cards of the shore boulders and the cove's small rocks: the world-scene library and
 *  step, the scene, the catalogue rows, the placed copies and the desktop GLBs by product name (GR7: the
 *  `driftwood-rock-scenes` job's rows and `assets/rock-scenes/` GLBs). The phone's simplified rocks are built from these
 *  GLBs (rockPhoneProgram.ts). */
export interface DriftwoodRockBank {
  readonly section: RockSection; readonly scene: typeof ROCK_SCENE; readonly catalogue: RockCatalogueRow[];
  readonly world: { readonly shore: JsonCopy[]; readonly small: JsonCopy[] }; readonly glbs: ReadonlyMap<string, Uint8Array>;
}

/** Bake the rocks from the shore scatter and the island plan's small rocks; no prior geometry table is read. */
export function driftwoodRockBank(smallRocks: readonly SmallPlacement[]): DriftwoodRockBank {
  const bake = bakeRockScenes(shoreBoulderFacts().placements, smallRocks);
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.82 });
  try {
    const models: RockSection['library']['models'] = [], glbs = new Map<string, Uint8Array>();
    for (const [id, geometry] of bake.geometry) {
      const file = `models/rocks/${id}.glb`;
      // L18.3b: exact positions, compact normals and colours (compactChannels.ts); the intake restores the typed channels
      glbs.set(file, staticGlb([{ geometry: compactChannels(geometry.clone()), material, compactIndex: true, quantizedChannels: true }]));
      // L18.3e (G769): the phone draws its own simplified rock, emitted at product build (rockPhoneProgram.ts)
      models.push({ id, file: { phone: `models/rocks/${id}-phone.glb`, desktop: file }, attributes: {} });
    }
    const sphere = (id: string): Sphere => {
      const geometry = bake.geometry.get(id); if (geometry === undefined) throw new Error(`Missing rock bounds: ${id}`);
      geometry.computeBoundingSphere();
      const bound = geometry.boundingSphere; if (bound === null) throw new Error(`Missing rock sphere: ${id}`);
      return { center: [...bound.center], radius: bound.radius };
    };
    const catalogue = bake.catalogue.map(row => ({ key: row.key, id: row.id, name: row.name, file: 'src/shards/driftwood-isle/data/rockScenes.generated.json',
      category: 'nature' as const, pipeline: 'code' as const, surface: 'rock' as const, assembly: 'parts' as const, defaults: row.defaults, variants: row.variants,
      choices: row.choices.map(choice => ({ id: choice.id, params: choice.params, size: choice.size, colliders: choice.colliders.map(hull),
        draws: [{ id: 'rock', library: 'rocks', model: choice.geometry, material: 'rock', sphere: [...sphere(choice.geometry).center, sphere(choice.geometry).radius],
          castShadow: true, receiveShadow: true, renderOrder: 0 }] })) }));
    const section: RockSection = { library: { id: 'rocks', kind: 'owned', models },
      step: { id: 'rocks', scene: 'scenes/rocks.json', geometry: { shore: { library: 'rocks', model: 'shore' }, small: { library: 'rocks', model: 'small' } }, materials: { rock: 'rock' },
        registry: [], publish: { shore: { kind: 'object', part: 'shore' }, small: { kind: 'object', part: 'small' } },
        bounds: ['shore', 'small'].map(part => ({ part, sphere: sphere(part) })), instanceAttributes: [] } };
    const copies = (rows: readonly Copy[]): JsonCopy[] => {
      const out: JsonCopy[] = [];
      for (const row of rows) out.push({ ...row, colliders: row.colliders.map(hull) });
      return out;
    };
    return { section, scene: ROCK_SCENE, catalogue, world: { shore: copies(bake.world.shore), small: copies(bake.world.small) }, glbs };
  } finally { material.dispose(); for (const geometry of bake.geometry.values()) geometry.dispose(); }
}
