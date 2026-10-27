import { MeshStandardMaterial } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { MODEL_URLS } from './fileInventory';
import { facetedGeometry } from './modelIntake';
import { bakeVaneParts } from './vane';

/** The authored wind-vane model owns both original component geometries. */
export const VANE_INPUTS: readonly string[] = [MODEL_URLS['wind-vane']];
export const VANE_FILES: readonly string[] = ['vane-post.glb', 'vane-rotor.glb'];

/** Construct one original part directly from its explicit native bank. */
export async function skyVanePartSource(inputs: ReadonlyMap<string, Uint8Array>, part: 0 | 1): Promise<Uint8Array> {
  const bytes = inputs.get(MODEL_URLS['wind-vane']);
  if (inputs.size !== VANE_INPUTS.length || bytes === undefined || bytes.byteLength === 0) throw new Error('Sky vane input inventory differs');
  const source = facetedGeometry((await readSourceModel(bytes)).gltf.scene, 0.6);
  if (source === null) throw new Error('Missing vane source');
  return staticGlb([{ name: 'vane', geometry: bakeVaneParts(source)[part], compactIndex: true, nativeAttributes: true, material: new MeshStandardMaterial() }], 'vane');
}

/** Both returned files retain their original geometry, index and facet channels. */
export async function skyVaneSource(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  return new Map([['vane-post.glb', await skyVanePartSource(inputs, 0)], ['vane-rotor.glb', await skyVanePartSource(inputs, 1)]]);
}

/** Native source and complete program identity key the existing owned-byte cache. */
export async function skyVaneProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'wind-vane', native: true, inputs: VANE_INPUTS }, skyVaneSource);
  if (files.size !== VANE_FILES.length || VANE_FILES.some(name => (files.get(name)?.byteLength ?? 0) === 0)) throw new Error('Sky vane cache inventory differs');
  return files;
}
