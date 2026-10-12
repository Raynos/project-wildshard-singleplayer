/**
 * The coarse prop proxy's quadrant mask (SHARD-PLATFORM SF15a): while fine (L0) tiles cover part of a coarse (L1) tile,
 * the coarse tile's props skip those quadrants in the fragment shader, so the proxy keeps its one draw per mesh (instanced
 * meshes stay instanced) and never doubles up with the fine props under it. The patch is shared source with per-tile
 * uniforms, so every coarse tile compiles to one program. The proxy never casts shadows (only near L0 tiles do).
 * Equal surfaces share one material across tiles (`installDeclaredProps`), so each coarse tile draws with its own variant
 * (`familyVariant`: the family's patches and key kept) carrying its own mask uniforms; the shared material is never patched.
 */
import { GLSL3, Mesh, Uniform, Vector2, Vector4, type Material, type Object3D } from 'three';
import { patchShader, PATCH_ORDER } from '../render/shaderPatches';
import { familyVariant } from '../render/families/registry';
import { applyNodeCoarseMask } from '../render/nodeCoarseMask';
import { CHUNK_HALF } from '../core/config';
import type { Scope } from '../app/scope';

/** a coarse tile is 125 m (four per cell side), so a quadrant is 62.5 m */
const COARSE_SIZE = 125;

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }

/**
 * Mask a coarse tile's props by quadrant in one draw per mesh; returns the updater for the hidden quadrants.
 * `root` holds the props of coarse tile `x`, `z` (0..3, cell-local). The updater hides the quadrants in its set
 * (0 = −x −z, 1 = +x −z, 2 = −x +z, 3 = +x +z); all four hide the root. The patches go with `scope`.
 */
export function coarseTileMask(root: Object3D, x: number, z: number, scope: Scope): (excluded: ReadonlySet<number>) => void {
  if (![x, z].every((n) => Number.isInteger(n) && n >= 0 && n < (CHUNK_HALF * 2) / COARSE_SIZE)) throw new Error('coarse tile mask: tile coordinates are 0..3');
  const origin = new Uniform(new Vector2(-CHUNK_HALF + x * COARSE_SIZE, -CHUNK_HALF + z * COARSE_SIZE)), mask = new Uniform(new Vector4());
  const half = (COARSE_SIZE / 2).toFixed(2);
  const own = new Map<Material, Material>();
  const variant = (shared: Material): Material => {
    const known = own.get(shared); if (known !== undefined) return known;
    const material = familyVariant(shared, scope);
    own.set(shared, material);
    scope.onDispose(() => { material.dispose(); });
    return material;
  };
  root.traverse((object) => {
    if (!isMesh(object)) return;
    object.castShadow = false;
    const before = object.material;
    object.material = Array.isArray(before) ? before.map(variant) : variant(before);
    scope.onDispose(() => { object.material = before; });
  });
  for (const material of own.values()) {
    // Node shaders have no classic chunk anchors; the loaded backend owns their mask.
    if (applyNodeCoarseMask(material, origin, mask, COARSE_SIZE / 2)) continue;
    patchShader(material, 'engine.coarse-tile-mask', PATCH_ORDER.decorate, (shader) => {
      Object.assign(shader.uniforms, { wsCoarseOrigin: origin, wsCoarseMask: mask });
      // Raw GLSL3 gets no classic renderer compatibility aliases or precision prefix.
      const raw3 = shader.isRawShaderMaterial && shader.glslVersion === GLSL3;
      const vertexVarying = raw3 ? 'out highp' : 'varying';
      const fragmentVarying = raw3 ? 'in highp' : 'varying';
      const precision = raw3 ? 'highp ' : '';
      shader.vertexShader = `${vertexVarying} vec2 wsCoarseXZ;\n${shader.vertexShader}`.replace('#include <project_vertex>', `
        vec4 wsCoarsePosition = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          wsCoarsePosition = batchingMatrix * wsCoarsePosition;
        #endif
        #ifdef USE_INSTANCING
          wsCoarsePosition = instanceMatrix * wsCoarsePosition;
        #endif
        wsCoarseXZ = (modelMatrix * wsCoarsePosition).xz;
        #include <project_vertex>
      `);
      shader.fragmentShader = `${fragmentVarying} vec2 wsCoarseXZ; uniform ${precision}vec2 wsCoarseOrigin; uniform ${precision}vec4 wsCoarseMask;\n${shader.fragmentShader}`.replace('#include <clipping_planes_fragment>', `
        vec2 wsCoarseHalf = step(vec2(${half}), wsCoarseXZ - wsCoarseOrigin);
        float wsCoarseHidden = mix(mix(wsCoarseMask.x, wsCoarseMask.y, wsCoarseHalf.x), mix(wsCoarseMask.z, wsCoarseMask.w, wsCoarseHalf.x), wsCoarseHalf.y);
        if (wsCoarseHidden > 0.5) discard;
        #include <clipping_planes_fragment>
      `);
    }, { scope });
  }
  return (excluded) => {
    for (const quadrant of excluded) if (!Number.isInteger(quadrant) || quadrant < 0 || quadrant > 3) throw new Error('coarse tile mask: a quadrant is 0..3');
    mask.value.set(Number(excluded.has(0)), Number(excluded.has(1)), Number(excluded.has(2)), Number(excluded.has(3)));
    root.visible = excluded.size !== 4;
  };
}
