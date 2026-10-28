import { parseWorldScene, parseWorldSceneBindings, parsePrivateScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { CaveInteriorSchema, type CaveInteriorRows } from '@wildshard/format/caveInterior';
import { parseSceneBuffers } from '@wildshard/format/sceneBuffers';
import { WorldSceneWeldSchema, parseWorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { parseWorldScenes, type WorldScenesSection } from '@wildshard/format/worldScenes';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { WorldSceneSurfaceSchema, type WorldSceneSurface } from '@wildshard/format/worldSceneSurface';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import { parse } from 'valibot';
import { ForestPageSchema, type ForestPageRows } from '@wildshard/format/forestPage';
import { AdmissionLateSchema, type LateFile } from '@wildshard/format/admissionLate';
import { BakedBuildingLookSchema, parseBuildingLifeRows as nativeBuildingLifeRows, emptyBuildingLifeRows as nativeEmptyBuildingLifeRows,
  type BuildingAssemblyRows, type BakedBuildingLookRows } from '@wildshard/format/buildings';
import type { OutputFile } from '@wildshard/format/outputIndex';

/** Source-owned effect declarations retain the platform field contract. */
export interface SceneEffectField {
  readonly name: string;
  readonly shape: 'point' | 'streak' | 'flake';
  readonly count: number;
  readonly palette?: readonly number[];
  readonly life?: number;
}

/** Admit a bounded private world recipe before source publication; no runtime is installed. */
export function worldSceneRecipe(input: unknown): WorldSceneRecipe { return parseWorldScene(input); }

/** Admit complete private scene nodes and material ports before publication, without a scene host. */
export function privateSceneRows(input: unknown): ReturnType<typeof parsePrivateScene> { return parsePrivateScene(input); }

/** Admit finite typed transform/material/anchor ports using the defining platform grammar. */
export function worldSceneBindings(input: unknown): ReturnType<typeof parseWorldSceneBindings> { return parseWorldSceneBindings(input); }

/** Admit the complete data-only scene section with its original identity and reference checks. */
export function worldSceneRows(input: unknown): ReturnType<typeof parseWorldScenes> { return parseWorldScenes(input); }

/** Authored scene sections before admission fills lent resources and uniform defaults. */
export type AuthorWorldScenes = WorldScenesSection;

/** Admit a static model catalogue with the original identity, choice, LOD and plain-data checks. */
export function worldSceneModels(input: unknown): ReturnType<typeof parseWorldSceneModels> { return parseWorldSceneModels(input); }

/** Admit an original PBR/graph surface, including its explicit resident/placement intake hint. */
export function worldSceneSurface(input: unknown): WorldSceneSurface { return parse(WorldSceneSurfaceSchema, input); }

/** Admit an authored placement through the same finite layout and collider grammar as the client. */
export function worldScenePlacement(input: unknown): ReturnType<typeof parseWorldScenePlacement> { return parseWorldScenePlacement(input); }

/** Admit a forest page through its existing finite plant, building and landmark grammar. */
export function forestPageRows(input: unknown): ForestPageRows { return parse(ForestPageSchema, input); }

/** Schedule explicitly off-view material variants without changing inventory,
 * costs or tier choice. Any critical or otherwise selected alias stays early. */
export function lateSceneMaterialFiles(files: readonly Pick<OutputFile, 'hash' | 'variantOf' | 'critical'>[],
  hints: readonly { readonly variantOf: string; readonly at: readonly [number, number] }[]): readonly LateFile[] {
  const sites = new Map(hints.map(row => [row.variantOf, row.at]));
  if (sites.size !== hints.length || hints.some(row => row.variantOf.length === 0 || !files.some(file => file.variantOf === row.variantOf)))
    throw new Error('Late material variants require unique declared groups');
  const early = new Set(files.filter(file => file.critical || file.variantOf === undefined || !sites.has(file.variantOf)).map(file => file.hash));
  const selected = new Map<string, LateFile>();
  for (const file of files) {
    const at = file.variantOf === undefined ? undefined : sites.get(file.variantOf);
    if (at === undefined || early.has(file.hash)) continue;
    const prior = selected.get(file.hash);
    if (prior !== undefined && (prior.at?.[0] !== at[0] || prior.at[1] !== at[1])) throw new Error('Late material aliases require one position');
    selected.set(file.hash, { hash: file.hash, at: [at[0], at[1]] });
  }
  return parse(AdmissionLateSchema, [...selected.values()]);
}

/** Admit named typed channels, shared attributes and ordered buffered draws before publication. */
export function worldSceneBuffers(input: unknown): ReturnType<typeof parseSceneBuffers> { return parseSceneBuffers(input); }

/** Admit frozen scene topology, exact transform words and ordered hosted cull lanes. */
export function worldSceneWeldRows(input: unknown): ReturnType<typeof parseWorldSceneWeld> { return parseWorldSceneWeld(input); }

/** Admit an owned author draft with the same grammar, before runtime admission freezes it. */
export function worldSceneWeldData(input: unknown): ReturnType<typeof parseWorldSceneWeld> { return parse(WorldSceneWeldSchema, input); }

/** Admit the defining finite surface properties without inventing a material or resource owner. */
export function worldSceneSurfaceProperties(input: unknown): WorldSceneSurface['properties'] { return parse(WorldSceneSurfaceSchema.entries.properties, input); }

/** Admit bounded cave ownership, frame, packed roof and material ports before publication. */
export function caveInteriorRows(input: unknown): CaveInteriorRows { return parse(CaveInteriorSchema, input); }

/** Complete authored building assembly grammar; no building instance or resource service is lent. */
export type AuthorBuildingAssembly<K extends string = string, P extends string = string> = BuildingAssemblyRows<K, P>;

/** Admit original building material, particle, door and lantern policy before baking. */
export function buildingLookRows(input: unknown): BakedBuildingLookRows { return parse(BakedBuildingLookSchema, input); }

/** Admit bounded moving doors, wheels, lights and site bindings through their defining checks. */
export function buildingLifeRows(input: unknown): ReturnType<typeof nativeBuildingLifeRows> { return nativeBuildingLifeRows(input); }

/** A fresh native empty life batch; authored assembly owns every returned list. */
export function emptyBuildingLifeRows(): ReturnType<typeof nativeEmptyBuildingLifeRows> { return nativeEmptyBuildingLifeRows(); }
