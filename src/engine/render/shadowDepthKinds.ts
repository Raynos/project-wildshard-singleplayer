import * as THREE from 'three';
import { pageScope } from '../app/resources';

/**
 * PF3: three's shadow map draws every caster without its own depth material through ONE shared `MeshDepthMaterial`
 * (and one cached clone per alpha-tested source material), and writes the caster's fields on it for each draw: its
 * `map` and `alphaMap` too, alpha-tested or not. The depth shader reads them only to alpha-test, yet every caster's own
 * textures were bound into the shadow pass, and the program follows the caster's kind (batched with or without copy
 * colours, instanced, instance-coloured, skinned, morphed: `setProgram`'s needsProgramChange). Pine's spawn at phone 4x:
 * the forest batches' 5 depth draws 0.9–1.1 ms a frame, its 3 plain casters 0.21 ms; with a depth material of their own
 * per kind and no textures, 0.6 and 0.07.
 *
 * `depthForKind` hands each caster kind its own copy of that stock material with the fields three set for this draw,
 * except that a copy that does not alpha-test keeps no `map` / `alphaMap` (they change no depth: without alpha testing
 * the depth shader only colours a fragment it never writes). The point lights' `MeshDistanceMaterial` carries per-light
 * state and is left alone.
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
  // without alpha testing (alphaToCoverage already set alphaTest) the copy reads no texture
  const tested = stock.alphaTest > 0;
  // the side three set for this caster is in the program too (doubleSided / flipSided)
  const kind = kindOf(object) | (stock.side << 7) | (tested ? 1 << 9 : 0);
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
  copy.alphaMap = tested ? stock.alphaMap : null; copy.alphaTest = stock.alphaTest; copy.map = tested ? stock.map : null;
  copy.clipShadows = stock.clipShadows; copy.clippingPlanes = stock.clippingPlanes; copy.clipIntersection = stock.clipIntersection;
  copy.displacementMap = stock.displacementMap; copy.displacementScale = stock.displacementScale; copy.displacementBias = stock.displacementBias;
  copy.wireframeLinewidth = stock.wireframeLinewidth;
  return copy;
}
