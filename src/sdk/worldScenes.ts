import { parseWorldScene, parseWorldSceneBindings, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { WorldSceneSurfaceSchema, type WorldSceneSurface } from '@wildshard/format/worldSceneSurface';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import { parse } from 'valibot';
import { ForestPageSchema, type ForestPageRows } from '@wildshard/format/forestPage';

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

/** Admit finite typed transform/material/anchor ports using the defining platform grammar. */
export function worldSceneBindings(input: unknown): ReturnType<typeof parseWorldSceneBindings> { return parseWorldSceneBindings(input); }

/** Admit the complete data-only scene section with its original identity and reference checks. */
export function worldSceneRows(input: unknown): ReturnType<typeof parseWorldScenes> { return parseWorldScenes(input); }

/** Admit an original PBR/graph surface, including its explicit resident/placement intake hint. */
export function worldSceneSurface(input: unknown): WorldSceneSurface { return parse(WorldSceneSurfaceSchema, input); }

/** Admit an authored placement through the same finite layout and collider grammar as the client. */
export function worldScenePlacement(input: unknown): ReturnType<typeof parseWorldScenePlacement> { return parseWorldScenePlacement(input); }

/** Admit a forest page through its existing finite plant, building and landmark grammar. */
export function forestPageRows(input: unknown): ForestPageRows { return parse(ForestPageSchema, input); }
