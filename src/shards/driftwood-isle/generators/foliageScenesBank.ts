import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compactPhoneGlb } from '@wildshard/sdk/bake/compactGlb';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { emitNamedBlobs, nameMeshoptBlob, type EmittedBlobs } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import inventory from '../data/fixedGeometry.json' with { type: 'json' };
import { decodePalmWorld, decodeHibiscusWorld, decodeReefWorld } from './foliageGeometry';
import { DRIFT_SPECIMENS } from './driftLogs';
import { palm, hibiscusBush, palmColliders, foliagePose, placeFoliageCollider, type FoliagePlacement } from './foliageModels';
import { compactChannels } from './compactChannels';
import { decimateFlatBatch } from './phoneDecimate';
import { driftwoodReefBank } from './reefBank';
import { islandFoliageBatches, islandFoliagePlacements } from './islandDressing';
import type { DriftwoodFixedLayouts } from './fixedLayouts';
import { n, numbers, plainJson } from './jsonRows';

/** L18.3e: how far (m) the phone's simplified batches may move a surface (board art/driftwood-isle/round-20-phone-decimation) */
export const PHONE_ERROR: { readonly palms: number; readonly hibiscus: number; readonly reef: number } = { palms: 0.08, hibiscus: 0.1, reef: 0.1 };
const FILE = 'src/shards/driftwood-isle/generators/foliageScenesBank.ts';
const TIERS = ['phone', 'desktop'] as const;
type Tier = typeof TIERS[number];
type Kind = 'palms' | 'hibiscus' | 'reef';

/** One copy's pose row; a record, so the upright pass (worldPlacements.ts uprightPoses) takes it. */
export interface FoliagePoseRow extends Record<string, unknown> { readonly x: number; readonly y: number; readonly z: number; readonly params: unknown; readonly matrix: number[] }
/** One merged placement row of the world scenes (`world/foliage/*.json`, the map bake's placements). */
export interface FoliagePlacementRow {
  readonly id: string; readonly model: string; readonly draw: 'merged'; readonly poses: FoliagePoseRow[];
  readonly drawnInto: { readonly part: string; readonly boxes: number[] }; readonly colliders: unknown[]; readonly piece: { readonly id: string; readonly solidFloor?: true };
}
export interface FoliageFact { readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly rot: number; readonly yTop: number; readonly yBottom: number }
/** The foliage library's model files by tier (the batches and the Explorer's per-variant GLBs). */
export interface FoliageLibraryModel { readonly id: string; readonly file: Record<string, string>; readonly attributes: Record<string, string> }
/** The island's foliage scene rows (GR7: the `driftwood-foliage-scenes` job's JSON): the Explorer models, the foliage
 *  library, each tier's palm and bush placements and the palms' contact facts. */
export interface DriftwoodFoliageScenes {
  readonly models: readonly Readonly<Record<string, unknown>>[];
  readonly libraries: readonly { readonly id: 'foliage'; readonly kind: 'owned'; readonly models: readonly FoliageLibraryModel[] }[];
  readonly placements: Readonly<Record<Tier, { readonly palms: FoliagePlacementRow; readonly hibiscus: FoliagePlacementRow }>>;
  readonly facts: Readonly<Record<Tier, { readonly palms: readonly FoliageFact[]; readonly hibiscus: readonly FoliageFact[] }>>;
}
interface FoliageBatch { readonly kind: Kind; readonly tier: Tier; readonly file: string; readonly specs: number; readonly source: Uint8Array }

/** Hull points out of their typed arrays, so a row writes as JSON. */
const plain = (rows: readonly object[]): unknown[] => rows.map(plainJson);
const matrix = (pose: FoliagePlacement): number[] => numbers(foliagePose(pose).matrix.elements);
const poseRows = (poses: readonly (FoliagePlacement & { readonly params?: unknown })[]): FoliagePoseRow[] => poses.map(pose => ({ x: n(pose.x), y: n(pose.y), z: n(pose.z), params: plainJson(pose.params), matrix: matrix(pose) }));

/** Each shipped batch: palms and hibiscus per tier, the reef once (the phone's, which desktop shares). */
function foliageBatches(): FoliageBatch[] {
  const reefBank = driftwoodReefBank(), foliage = islandFoliagePlacements();
  const source = (name: string): Uint8Array => {
    const banked = reefBank.blobs.get(name) ?? islandFoliageBatches().blobs.get(name);
    if (banked === undefined) throw new Error(`Missing native foliage: ${name}`);
    return banked.bytes;
  };
  return TIERS.flatMap(tier => [
    { kind: 'palms' as const, tier, file: `models/foliage/palms-${tier}.glb`, specs: foliage.tiers[tier].palms.specs.length, source: source(`world/palms/${tier}.bin`) },
    { kind: 'hibiscus' as const, tier, file: `models/foliage/hibiscus-${tier}.glb`, specs: foliage.tiers[tier].bushes.specs.length, source: source(`world/hibiscus/${tier}.bin`) },
    ...(tier === 'phone' ? [{ kind: 'reef' as const, tier, file: 'models/foliage/reef-phone.glb', specs: reefBank.layout.items.length, source: source('world/reef.bin') }] : []),
  ]);
}
const decodeBatch = (batch: FoliageBatch): ReturnType<typeof decodePalmWorld> =>
  (batch.kind === 'palms' ? decodePalmWorld : batch.kind === 'hibiscus' ? decodeHibiscusWorld : decodeReefWorld)(batch.source, batch.specs);

function buildFoliageScenes(): DriftwoodFoliageScenes {
  const foliage = islandFoliagePlacements(), batches = foliageBatches();
  const specModels = [
    { key: 'palm', author: palm, name: 'Coconut palm', material: 'palm', surface: 'wood', size: (p: typeof palm.defaults): number[] => [p.h, p.h, p.h], colliders: (p: typeof palm.defaults): unknown[] => plain(palmColliders(p)) },
    { key: 'hibiscus', author: hibiscusBush, name: 'Hibiscus bush', material: 'kit', size: (p: typeof hibiscusBush.defaults): number[] => [p.r * 2, p.r * 2, p.r * 2], colliders: (): unknown[] => [] },
  ] as const;
  const choicesOf = <P extends object>(key: string, author: { defaults: P; variants: readonly { id: string; params: Partial<P> }[] }, material: string, size: (p: P) => number[], colliders: (p: P) => unknown[]): unknown[] =>
    author.variants.map(variant => {
      const params: P = { ...author.defaults, ...variant.params };
      return { id: variant.id, params, size: size(params), colliders: colliders(params), draws: [{ id: 'plant', library: 'foliage', model: `${key}-${variant.id}`, material, castShadow: key === 'palm' ? true : { phone: false, desktop: true }, receiveShadow: true }] };
    });
  const [palmSpec, hibiscusSpec] = specModels;
  const models: Readonly<Record<string, unknown>>[] = [
    { key: palmSpec.key, id: palm.id, name: palmSpec.name, file: FILE, category: 'nature', pipeline: 'code', surface: palmSpec.surface, defaults: palm.defaults, variants: palm.variants, assembly: 'parts',
      choices: choicesOf(palmSpec.key, palm, palmSpec.material, palmSpec.size, palmSpec.colliders) },
    { key: hibiscusSpec.key, id: hibiscusBush.id, name: hibiscusSpec.name, file: FILE, category: 'nature', pipeline: 'code', defaults: hibiscusBush.defaults, variants: hibiscusBush.variants, assembly: 'parts',
      choices: choicesOf(hibiscusSpec.key, hibiscusBush, hibiscusSpec.material, hibiscusSpec.size, hibiscusSpec.colliders) },
  ];
  const modelRows = new Map<string, FoliageLibraryModel>();
  const placementRow = (tier: Tier, kind: 'palms' | 'hibiscus', boxes: number[]): FoliagePlacementRow => {
    const palmBatch = kind === 'palms', rows = palmBatch ? foliage.tiers[tier].palms : foliage.tiers[tier].bushes;
    const colliders = palmBatch ? foliage.tiers[tier].palms.placements.flatMap(pose => palmColliders({ ...palm.defaults, ...pose.params }).map(shape => placeFoliageCollider(shape, foliagePose(pose)))) : [];
    return { id: palmBatch ? 'foliage.palms' : 'foliage.bushes', model: palmBatch ? 'palm' : 'hibiscus', draw: 'merged', poses: poseRows(rows.placements),
      drawnInto: { part: `${kind}.mesh`, boxes }, colliders: plain(colliders), piece: palmBatch ? { id: 'palms', solidFloor: true } : { id: 'bushes' } };
  };
  const placements: Partial<Record<Tier, Partial<Record<'palms' | 'hibiscus', FoliagePlacementRow>>>> = {};
  const facts: Partial<Record<Tier, Partial<Record<'palms' | 'hibiscus', FoliageFact[]>>>> = {};
  for (const batch of batches) {
    const decoded = decodeBatch(batch), { kind, tier } = batch;
    decoded.geometry.dispose();
    const model = modelRows.get(kind) ?? { id: kind, file: {}, attributes: {} };
    model.file[tier] = batch.file; modelRows.set(kind, model);
    if (kind === 'reef') continue;
    (placements[tier] ??= {})[kind] = placementRow(tier, kind, numbers(decoded.boxes));
    const palms = foliage.tiers[tier].palms;
    (facts[tier] ??= {})[kind] = kind === 'palms' ? palms.placements.map((pose, i) => {
      const p = palms.specs[i];
      if (p === undefined) throw new Error('Palm placements outnumber their specs');
      return { x: n(p.x), z: n(p.z), hw: 0.3, hd: 0.3, rot: 0, yTop: n(pose.y + p.h), yBottom: n(pose.y - 1) };
    }) : [];
  }
  const reef = modelRows.get('reef');
  if (reef?.file['phone'] === undefined) throw new Error('Missing phone reef batch');
  reef.file['desktop'] = reef.file['phone'];
  for (const spec of specModels) for (const variant of spec.author.variants) {
    const family = spec.key === 'palm' ? 'palms' : 'hibiscus', file: Record<string, string> = {};
    for (const tier of TIERS) file[tier] = `models/${family}/${tier}/${variant.id}.glb`;
    modelRows.set(`${spec.key}-${variant.id}`, { id: `${spec.key}-${variant.id}`, file, attributes: { _sway: 'aSway' } });
  }
  const logDefaults = DRIFT_SPECIMENS.long, logVariants = [
    { id: 'long', label: 'Long', params: {} }, { id: 'short', label: 'Short', params: DRIFT_SPECIMENS.short }, { id: 'pale', label: 'Pale', params: { tone: DRIFT_SPECIMENS.pale.tone } },
  ] as const;
  models.push({ key: 'driftLog', id: 'driftwood-isle/drift-log', name: 'Drift log', category: 'nature', pipeline: 'code', surface: 'wood', file: FILE, defaults: logDefaults, variants: logVariants, assembly: 'parts',
    choices: logVariants.map(variant => ({ id: variant.id, params: { ...logDefaults, ...variant.params }, size: [4, 1, 1], colliders: [], draws: [{ id: 'log', library: 'cascade', model: inventory.groups.driftLogs[variant.id], material: 'still', castShadow: true, receiveShadow: true }] })) });
  const tierRows = <T>(rows: Partial<Record<Tier, Partial<Record<'palms' | 'hibiscus', T>>>>): Record<Tier, { palms: T; hibiscus: T }> => {
    const of = (tier: Tier): { palms: T; hibiscus: T } => {
      const palms = rows[tier]?.palms, hibiscus = rows[tier]?.hibiscus;
      if (palms === undefined || hibiscus === undefined) throw new Error(`Missing ${tier} foliage rows`);
      return { palms, hibiscus };
    };
    return { phone: of('phone'), desktop: of('desktop') };
  };
  return { models, libraries: [{ id: 'foliage', kind: 'owned', models: [...modelRows.values()] }], placements: tierRows(placements), facts: tierRows(facts) };
}

let scenes: DriftwoodFoliageScenes | undefined;
/** Built once per build process; collider quaternions and placement matrices enter the exact map-world key, so they are
 *  built under the portable math. Every reader treats it as read-only. */
export function driftwoodFoliageScenes(): DriftwoodFoliageScenes {
  // the placement and batch memos first, outside the portable math, as every other reader fills them
  islandFoliagePlacements(); islandFoliageBatches(); driftwoodReefBank();
  scenes ??= withPortableMath(buildFoliageScenes);
  return scenes;
}

/** The drift-log and wreck-log placements over the fixed program's layouts (`world/foliage/logs.json`, `wreck-logs.json`). */
export function foliageLogPlacements(layouts: Pick<DriftwoodFixedLayouts, 'logs' | 'wreck'>): { readonly logPlacement: FoliagePlacementRow; readonly wreckLogPlacement: FoliagePlacementRow } {
  return withPortableMath(() => {
    const logs = layouts.logs, wreckLogs = layouts.wreck.catalogue.logs;
    const logPlacement: FoliagePlacementRow = { id: 'foliage.logs', model: 'driftLog', draw: 'merged', poses: poseRows(logs.placements), drawnInto: { part: 'logs.mesh', boxes: numbers(logs.boxes) }, colliders: [], piece: { id: 'cover-drift-logs' } };
    return { logPlacement, wreckLogPlacement: { ...logPlacement, id: 'wreck.logs', poses: poseRows(wreckLogs.placements), drawnInto: { part: 'wreck.root', boxes: numbers(wreckLogs.boxes) }, piece: { id: 'wreck-drift-logs' } } };
  });
}

/** The shipped batches' product files, in the order the job wrote them. */
export const FOLIAGE_SCENE_FILES: readonly string[] = ['models/foliage/palms-phone.glb', 'models/foliage/hibiscus-phone.glb', 'models/foliage/reef-phone.glb',
  'models/foliage/palms-desktop.glb', 'models/foliage/hibiscus-desktop.glb'];
const isPhoneFile = (name: string): boolean => name.endsWith('-phone.glb');

/** The batch GLBs by product name, before the phone's grid positions: exact positions, compact normals and colours
 *  (compactChannels.ts, L18.3c); the phone's batch with fewer triangles (phoneDecimate.ts, within PHONE_ERROR metres,
 *  L18.3e); desktop exact. */
export function foliageSceneGlbs(): Map<string, Uint8Array> {
  islandFoliagePlacements(); islandFoliageBatches();
  const material = new MeshStandardMaterial();
  try {
    return withPortableMath(() => new Map(foliageBatches().map(batch => {
      const decoded = decodeBatch(batch);
      const drawn = batch.tier === 'phone' ? decimateFlatBatch(decoded.geometry, PHONE_ERROR[batch.kind]) : decoded.geometry.clone();
      try {
        return [batch.file, staticGlb([{ geometry: compactChannels(drawn), material, customAttributes: { _SWAY: 'aSway' }, compactIndex: true, nativeAttributes: true, quantizedChannels: true }])] as const;
      } finally { decoded.geometry.dispose(); drawn.dispose(); }
    })));
  } finally { material.dispose(); }
}
/** The finished batch GLBs: the phone's with 16-bit grid positions when smaller (compactPhoneGlb, iPhone downloads I3). */
export async function foliageSceneFiles(): Promise<Map<string, Uint8Array>> {
  const files = foliageSceneGlbs();
  for (const [name, glb] of files) if (isPhoneFile(name)) files.set(name, await compactPhoneGlb(glb));
  if (JSON.stringify([...files.keys()]) !== JSON.stringify(FOLIAGE_SCENE_FILES)) throw new Error('Foliage scene file inventory differs');
  return files;
}
/** The product's batch files, `meshopt: true` as the job's sources were; the phone compaction measures with brotli, so the
 *  files come through the owned-byte cache. */
export async function driftwoodFoliageSceneOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'driftwood-foliage-scenes', native: true }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected Driftwood foliage scene input');
    return foliageSceneFiles();
  });
  return emitNamedBlobs(await Promise.all(FOLIAGE_SCENE_FILES.map(name => {
    const bytes = files.get(name);
    if (bytes === undefined || files.size !== FOLIAGE_SCENE_FILES.length) throw new Error('Driftwood foliage scene cache inventory differs');
    return nameMeshoptBlob(name, bytes);
  })));
}
