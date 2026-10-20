import { Color, Mesh, MeshStandardMaterial, type Object3D, type Side } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { hookGeometry } from './hookGeometry';
import rows from '../data/hookSpecimen.json' with { type: 'json' };

export interface HookProduct {
  readonly glb: string;
  readonly material: { readonly color: readonly [number, number, number]; readonly side: Side; readonly normalScale: readonly [number, number];
    readonly emissive: readonly [number, number, number]; readonly emissiveIntensity: number; readonly envMapIntensity: number;
    readonly metalness: number; readonly roughness: number };
}

/** Decode and warm the native specimen offline; product declarations consume only its prepared rows. */
export async function hookProduct(read: (url: string) => Uint8Array): Promise<HookProduct> {
  const geometry = await hookGeometry(read), { gltf } = await readSourceModel(read('/assets/nine-dragon/lab/grapple/dragon-hook.glb'));
  const meshes: Mesh[] = [], isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
  gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const sculpt = meshes[0];
  if (sculpt === undefined) throw new Error('Missing native hook material');
  const brass = sculpt.material instanceof MeshStandardMaterial ? sculpt.material.clone() : new MeshStandardMaterial({ color: rows.material.fallback });
  brass.color.multiply(new Color(rows.material.tint));
  const material = new MeshStandardMaterial();
  const bytes = staticGlb([{ name: 'dragon-hook', geometry, material, nativeAttributes: true, compactIndex: true }], 'nine-hook');
  const result: HookProduct = { glb: btoa(Array.from(bytes, value => String.fromCodePoint(value)).join('')), material: {
    color: [brass.color.r, brass.color.g, brass.color.b], side: brass.side, normalScale: [brass.normalScale.x, brass.normalScale.y],
    emissive: [brass.emissive.r, brass.emissive.g, brass.emissive.b], emissiveIntensity: brass.emissiveIntensity, envMapIntensity: brass.envMapIntensity,
    metalness: rows.material.metalness, roughness: rows.material.roughness } };
  geometry.dispose(); material.dispose(); brass.dispose();
  return result;
}
