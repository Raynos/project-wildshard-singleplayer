import { parseWorldScene, parseWorldSceneBindings, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';

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
