/**
 * MF13 (stream past spawn invisibly): parts of one merged mesh fade in on their own clocks, a screen-door dither (no
 * blending, no sort, no second program per part). A mesh's geometry carries `aFadeKey` (each vertex's part, 0–63), and the
 * mesh `userData.fadeTable` (a Float32Array of 64: 0 hidden … 1 whole) says how far each part has faded in; a marked
 * material (`markPartFade`) discards a fragment whose screen-door threshold is above its part's fade. Every other object
 * drawn with the same material reads a table of ones (a geometry without the channel reads part 0): it draws whole.
 *
 *   markPartFade(material)                     // once, before its first compile (the key keeps its programs apart)
 *   mesh.userData['fadeTable'] = table;        // the owner moves table[part] from 0 to 1
 */
import type * as THREE from 'three';
import { ConvertNode, NodeMaterial, type Node } from 'three/webgpu';
import { Discard, attribute, dot, float, fract, int, screenCoordinate, uniformArray, vec2 } from 'three/tsl';
import { patchShader, PATCH_ORDER } from '../shaderPatches';

/** the parts a merged mesh may fade separately */
export const FADE_PARTS = 64;
const ONES = new Float32Array(FADE_PARTS).fill(1);
const values = Array.from({ length: FADE_PARTS }, () => 1);
/** one table node for every marked material: each object's draw copies its own table in (ones when it has none) */
const table = uniformArray(values, 'float').onObjectUpdate(({ object }) => {
  const own: unknown = object?.userData['fadeTable'], source = own instanceof Float32Array ? own : ONES;
  for (let part = 0; part < FADE_PARTS; part++) values[part] = source[part] ?? 1;
  return values;
});

/** Whether `material` dithers its parts in (the node handler's epilogue asks). */
export function partFaded(material: THREE.Material): boolean { return material.userData['partFade'] === true; }

/** Mark `material` to dither its objects' parts in: a key of its own, so no unmarked material shares its programs. Only a
 *  node material runs the epilogue: false (and no mark) for any other. */
export function markPartFade(material: THREE.Material): boolean {
  if (partFaded(material)) return true;
  if (!(material instanceof NodeMaterial)) return false;
  material.userData['partFade'] = true;
  patchShader(material, 'part-fade', PATCH_ORDER.decorate, () => undefined, { key: (before) => `${before}|part-fade`, pureKey: true });
  material.needsUpdate = true;
  return true;
}

/** The epilogue stage: a fragment above its part's fade is discarded (interleaved gradient noise, stable per pixel). */
export function partFadeStage(out: Node<'vec4'>): Node<'vec4'> {
  const fade = new ConvertNode<'float'>(table.element(int(attribute('aFadeKey', 'float'))), 'float');
  const threshold = fract(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715))).mul(float(52.9829189)));
  Discard(threshold.greaterThan(fade));
  return out;
}
