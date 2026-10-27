
import codeParts from '../data/codeParts.json' with { type: 'json' };
/** Final timber draws, shadow proxies and native placement facts; no page-side weld. */
import { worldScenePlacement as parseWorldScenePlacement } from '@wildshard/sdk/worldScenes';
import { Matrix4, Object3D } from 'three';
import { nameBlob, nameMeshoptBlob, type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { pineQuestSites, pineTimberScenes } from './bake-timber-scenes.mjs';
import { perSources, type PineSources } from './pineSources';
import { timberWorld } from './timberWorldRows';
import plumbing from '../data/plumbing.json' with { type: 'json' };
import { TIMBER_MATERIALS } from './timberMaterials';
import type { TimberSceneCopy } from './timberScenes';

type WorldScenePlacementRowType = ReturnType<typeof parseWorldScenePlacement>;

/** The rows `timberScene` makes. */
export interface TimberScene {
  readonly TIMBER_MODEL_ROWS: unknown[];
  readonly TIMBER_PLACEMENTS: WorldScenePlacementRowType[];
  readonly TIMBER_RAW_MODELS: NamedBlobType[];
  readonly TIMBER_PACKED_MODELS: NamedBlobType[];
  readonly TIMBER_LIBRARY: { id: string; kind: "owned"; models: { file: string; id: string; attributes: NonNullable<unknown>; }[]; };
  readonly TIMBER_SURFACES: ({ id: string; kind: "surface"; load?: "resident" | "placement"; scan?: string; maxTexture?: { phone: number; desktop: number; }; cellTexture?: { atMost: number; max: number; }; properties: { color?: (number) | ([number, number, number]); normalScale?: [number, number]; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number; envMapIntensity?: number; emissive?: (number) | ([number, number, number]); emissiveIntensity?: number; side?: 0 | 1 | 2; depthWrite?: boolean; vertexColors?: boolean; }; map?: { appearance: string; texture: string; }; look?: string; lookTextures: Record<string, "map" | "normalMap" | "roughnessMap" | "aoMap">; } | { id: string; kind: string; variant: string; properties: NonNullable<unknown>; })[];
}
/** D65: the timber scene rows over the program's sources (the timber scenes and quest sites), made once per sources. */
export const timberScene: (sources: PineSources) => Promise<TimberScene> = perSources(async (sources: PineSources): Promise<TimberScene> => {
  // GR8 G31: the timber scenes and quest sites are the producer's (bake-timber-scenes.mjs), not a stored timberScenes.generated.json
  const { copies, geometry, glbs } = await pineTimberScenes(sources), baked = { copies, geometry, sites: pineQuestSites(sources) };
  const authored = timberWorld(sources);

  type Draw = Omit<TimberSceneCopy['draws'][number], 'sphere'> & { readonly sphere: readonly number[] };
  type Proxy = Omit<TimberSceneCopy['proxies'][number], 'sphere'> & { readonly sphere: readonly number[] };

  const distances = plumbing.knobs.find(row => row.id === 'pine.cabinDetailDist');
  const shadows = plumbing.knobs.find(row => row.id === 'pine.cabinDetailShadows');
  if (distances === undefined || typeof distances.phone !== 'number' || typeof distances.desktop !== 'number'
    || shadows === undefined || typeof shadows.phone !== 'boolean' || typeof shadows.desktop !== 'boolean') throw new Error('Missing timber band rows');
  const names = { 'fire-lookout': 'Fire lookout', 'zipline-landing': 'Zipline landing', 'creek-footbridge': 'Creek footbridge' };
  const TIMBER_MODEL_ROWS: unknown[] = Object.entries(names).map(([key, name]) => ({ key, id: `pine-hollow/${key}`, name,
    category: 'buildings', pipeline: 'code', surface: 'wood', file: 'data/timberScenes.generated.json', assembly: 'objects',
    defaults: { site: 'turntable' }, choices: (key === 'fire-lookout' ? ['turntable'] : ['world', 'turntable']).map(site => {
      const copy = baked.copies.find(row => row.identity === `${key}${key !== 'fire-lookout' && site === 'turntable' ? '-turntable' : ''}`);
      if (copy === undefined) throw new Error(`Missing timber copy: ${key}/${site}`);
      const band = (until: number | undefined) => until === undefined ? {} : { until: { knob: distances.id, multiply: until, add: copy.pad } };
      const draw = (row: Draw) => ({ id: row.geometry, library: 'timbers', model: row.geometry, material: `timber.${row.material}`,
        castShadow: row.until === 1 && row.castShadow ? { knob: shadows.id } : row.castShadow,
        receiveShadow: row.receiveShadow, renderOrder: row.renderOrder, sphere: row.sphere, ...band(row.until) });
      const proxy = (row: Proxy) => ({ id: row.geometry, library: 'timbers', model: row.geometry, material: 'timber.iron', depthOnly: true,
        sphere: row.sphere, ...(row.until === 2 ? band(row.until) : {}) });
      return { id: site, params: { site }, size: [1, 1, 1], colliders: copy.row.colliders, draws: [
        ...copy.draws.map(draw), ...copy.proxies.map(proxy),
      ] };
    }) }));
  for (const row of [{ key: 'zip-cable', name: 'Zip-line cable', shelf: false }, { key: 'token-shelf', name: 'Token shelf', shelf: true }]) {
    TIMBER_MODEL_ROWS.push({ key: row.key, id: `pine-hollow/${row.key}`, name: row.name, category: 'props', pipeline: 'code',
      ...(row.shelf ? { surface: 'wood' } : {}), file: 'data/timberScenes.generated.json', assembly: row.shelf ? 'objects' : 'parts', defaults: {},
      choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: row.key, library: 'timbers', model: row.key,
        material: row.shelf ? 'tokens' : 'timber.iron', receiveShadow: row.shelf, ...(row.shelf ? { until: 28 } : {}) }] }] });
  }

  const sites = [
    { key: 'fire-lookout', id: 'pine-lookout', frame: authored.placements.lookout.matrix, site: 'turntable' },
    { key: 'zipline-landing', id: 'pine-zip-landing', frame: authored.placements.landing.matrix, site: 'world' },
    { key: 'creek-footbridge', id: 'pine-footbridge', frame: authored.placements.bridge.matrix, site: 'world' },
  ] as const;
  const TIMBER_PLACEMENTS: WorldScenePlacementRowType[] = sites.map(row => parseWorldScenePlacement({ id: `timbers.${row.key}`, model: row.key, draw: 'single',
    poses: [{ x: row.frame[12], y: row.frame[13], z: row.frame[14], params: { site: row.site },
      ...(row.key === 'creek-footbridge' ? { yxz: { yaw: authored.placements.bridge.yaw, yawAtan2: authored.placements.bridge.turn, scale: 1 } } : { matrix: row.frame }) }],
    piece: { id: row.id, solidFloor: true, floors: authored.landmarks.timberFloors[row.id], floorPolicy: 'highest' } }));
  const [x, y, z] = authored.landmarks.zip.top;
  TIMBER_PLACEMENTS.push(parseWorldScenePlacement({ id: 'timbers.zip-cable', model: 'zip-cable', draw: 'single',
    poses: [{ x, y, z, yxz: { yaw: 0, scale: 1 } }], piece: { id: 'pine-zip-cable' } }));
  const ranger = authored.cabins.buildings.find(row => row.id === 'cabin-1');
  if (ranger === undefined) throw new Error('Missing ranger mantel frame');
  const room = new Object3D(); room.position.fromArray(ranger.at); room.rotation.y = ranger.rot; room.updateWorldMatrix(true, false);
  const shelf = room.matrixWorld.clone().multiply(new Matrix4().makeTranslation(-0.6, 1.78, -3.02));
  TIMBER_PLACEMENTS.push(parseWorldScenePlacement({ id: 'timbers.token-shelf', model: 'token-shelf', draw: 'single',
    poses: [{ x: shelf.elements[12], y: shelf.elements[13], z: shelf.elements[14], matrix: shelf.elements }], piece: { id: 'pine-hollow/token-shelf' } }));
  const canonical = new Map<string, string>(), files = new Map<string, string>(), unique: [string, Uint8Array][] = [];
  for (const [file, bytes] of glbs) {
    const hash = hashImmutableBytes(bytes);
    let name = canonical.get(hash);
    if (name === undefined) { name = file; canonical.set(hash, name); unique.push([file, bytes]); }
    files.set(file, name);
  }
  /** The timbers' distinct GLBs, raw for the map assembly. */
  const TIMBER_RAW_MODELS: NamedBlobType[] = unique.map(([name, bytes]) => nameBlob(name, 'glb', bytes));
  /** The timbers' distinct GLBs, meshopt-named as their `meshopt: true` sources were. */
  const TIMBER_PACKED_MODELS: NamedBlobType[] = await Promise.all(unique.map(([name, bytes]) => nameMeshoptBlob(name, bytes)));
  const model = (row: typeof baked.geometry[number]) => {
    const file = files.get(row.file); if (file === undefined) throw new Error(`Missing timber blob: ${row.file}`);
    return { ...row, file };
  };
  const TIMBER_LIBRARY: { id: string; kind: "owned"; models: { file: string; id: string; attributes: NonNullable<unknown>; }[]; } = { id: 'timbers', kind: 'owned' as const, models: baked.geometry.map(model) };
  const TIMBER_SURFACES: ({ id: string; kind: "surface"; load?: "resident" | "placement"; scan?: string; maxTexture?: { phone: number; desktop: number; }; cellTexture?: { atMost: number; max: number; }; properties: { color?: (number) | ([number, number, number]); normalScale?: [number, number]; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number; envMapIntensity?: number; emissive?: (number) | ([number, number, number]); emissiveIntensity?: number; side?: 0 | 1 | 2; depthWrite?: boolean; vertexColors?: boolean; }; map?: { appearance: string; texture: string; }; look?: string; lookTextures: Record<string, "map" | "normalMap" | "roughnessMap" | "aoMap">; } | { id: string; kind: string; variant: string; properties: NonNullable<unknown>; })[] = [...TIMBER_MATERIALS, { id: 'tokens', kind: 'lowpoly', variant: 'default', properties: {} }];

  const logDraws = [
    { id: 'outer', part: 'outer', material: 'bark', castShadow: true, receiveShadow: true },
    { id: 'inner', part: 'inner', material: 'log', castShadow: false, receiveShadow: true },
    { id: 'rim-0', part: 'rim-0', material: 'endGrain', castShadow: false, receiveShadow: false },
    { id: 'rim-1', part: 'rim-1', material: 'endGrain', castShadow: false, receiveShadow: false },
    { id: 'bed', part: 'bed', material: 'chink', castShadow: false, receiveShadow: true },
  ].map(({ part, material, ...draw }) => Object.assign(draw, { library: 'timbers', model: `hollow-log-${part}`, material: `timber.${material}` }));
  TIMBER_MODEL_ROWS.push({ key: 'hollow-log', id: 'pine-hollow/hollow-log', name: 'Hollow log', category: 'nature', pipeline: 'code', surface: 'wood',
    file: 'data/hollowLog.json', assembly: 'parts', defaults: {}, choices: [{ id: 'only', params: {}, size: [1, 1, 1],
      draws: logDraws, lods: [{ from: 60, draws: [{ ...logDraws[0], castShadow: false }] }], colliders: codeParts.colliders['hollow-log'] }] });
  const log = baked.sites.hollow;
  TIMBER_PLACEMENTS.push(parseWorldScenePlacement({ id: 'quests.hollow-log', model: 'hollow-log', draw: 'single',
    poses: [{ x: log.x, y: log.floorY, z: log.z, yxz: { yaw: log.yaw, scale: 1 } }],
    piece: { id: 'hollow-log', solidFloor: true, floors: [log.floor] } }));
  return { TIMBER_MODEL_ROWS, TIMBER_PLACEMENTS, TIMBER_RAW_MODELS, TIMBER_PACKED_MODELS, TIMBER_LIBRARY, TIMBER_SURFACES };
});
