import * as THREE from 'three';
import { pageScope } from '../app/resources';

/**
 * PF3: three's shadow map draws every caster without its own depth material through ONE shared `MeshDepthMaterial`
 * (and one cached clone per alpha-tested source material). Its program follows the caster's kind (batched with or
 * without copy colours, instanced, instance-coloured, skinned, morphed: `setProgram`'s needsProgramChange), so a shadow pass that alternates kinds
 * re-resolved the program on almost every draw: getParameters and the program key, ~100–300 µs a draw at phone 4x
 * (Pine's spawn: the forest batches' 5 depth draws 0.92 ms a frame, its 3 plain casters 0.22 ms).
 *
 * `depthForKind` hands each caster kind its own copy of that stock material, with the fields three's
 * `getDepthMaterial` set on the stock for this draw copied over, so every copy keeps one program and draws exactly what
 * the stock would (the same parameters, so the same program key: precompiled programs serve it). The point lights'
 * `MeshDistanceMaterial` carries per-light state and is left alone.
 */
const kinds = new WeakMap<THREE.MeshDepthMaterial, (THREE.MeshDepthMaterial | undefined)[]>();

/** a caster's kind: the object facts the program follows (bit flags) */
function kindOf(object: THREE.Object3D): number {
  let kind = 0;
  // a batch with copy colours is its own program (setProgram's batchingColor: Pine's tinted needle batch beside its bark)
  if (object instanceof THREE.BatchedMesh) { kind |= 1; if (Reflect.get(object, '_colorsTexture') !== null) kind |= 32; }
  if (object instanceof THREE.InstancedMesh) { kind |= 2; if (object.instanceColor !== null) kind |= 4; if (object.morphTexture !== null) kind |= 8; }
  if (object instanceof THREE.SkinnedMesh) kind |= 16;
  if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry && object.geometry.morphAttributes.position !== undefined) kind |= 64;
  return kind;
}

/** the stock depth material `stock` (as three set it for this draw) as `object`'s kind's own copy */
export function depthForKind(stock: THREE.MeshDepthMaterial, object: THREE.Object3D): THREE.MeshDepthMaterial {
  // the side three set for this caster is in the program too (doubleSided / flipSided)
  const kind = kindOf(object) | (stock.side << 7);
  // the plain kind on the stock's usual side (FrontSide casters cast BackSide) keeps the stock itself
  if (kind === THREE.BackSide << 7) return stock;
  let row = kinds.get(stock);
  if (row === undefined) {
    const made: (THREE.MeshDepthMaterial | undefined)[] = []; row = made; kinds.set(stock, made);
    // a disposed source's cached stock (three's onMaterialDispose) takes its copies' programs with it
    pageScope.listenOnceEmitter(stock, 'dispose', () => { for (const copy of made) copy?.dispose(); kinds.delete(stock); });
  }
  let copy = row[kind];
  if (copy === undefined) { copy = stock.clone(); row[kind] = copy; }
  // what getDepthMaterial writes on its result for each draw (three r186 WebGLShadowMap)
  copy.visible = stock.visible; copy.wireframe = stock.wireframe; copy.side = stock.side;
  copy.alphaMap = stock.alphaMap; copy.alphaTest = stock.alphaTest; copy.map = stock.map;
  copy.clipShadows = stock.clipShadows; copy.clippingPlanes = stock.clippingPlanes; copy.clipIntersection = stock.clipIntersection;
  copy.displacementMap = stock.displacementMap; copy.displacementScale = stock.displacementScale; copy.displacementBias = stock.displacementBias;
  copy.wireframeLinewidth = stock.wireframeLinewidth;
  return copy;
}
