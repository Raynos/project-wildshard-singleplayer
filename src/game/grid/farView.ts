/**
 * Drawing a far proxy (SHARD-PLATFORM SF23): one mesh, one draw, its 16 regions hidden by a vertex-shader mask when the
 * render rings refine them (`RingView.mask`, regions x + 4z), and a distance haze of its own toward the shard's haze
 * colour. The material follows the shard's family: `toon` faceted Lambert (flat normals), `painterly` smooth Lambert,
 * `pbr` rough standard. The region rides in TEXCOORD_0.x (the baked GLB's only spare channel; `farProxy.ts`) and the
 * boundary-face flag in TEXCOORD_0.y (G222: 1 lip, 2 foot), where the material lays rock strata over the shard's cliff
 * palette.
 */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshLambertMaterial, MeshStandardMaterial, RedFormat, RepeatWrapping, Vector2, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { patchShader } from '@wildshard/engine/render/shaderPatches';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { FarLookRuntime } from './farProxy';

/**
 * SF23 / G90: how far (m) the foot of a proxy's border skirt steps in from the cell edge. The skirt keeps its top on the
 * edge and its −20 m floor (G121), but leans inward, so a seam's retaining wall (a face in the cell-edge plane, 6 m to H)
 * draws in front of it instead of sharing its plane. Applied in the vertex shader: the baked GLBs stay as they are.
 */
export const FAR_SKIRT_INSET = 3;
/**
 * G222: the strata the far material lays over a proxy's boundary face (the cliff-flagged vertices), measured from the
 * seam's rock grain (`seamLook.ts` `strata`, 256 px per 7 m): its soft bands repeat every 70 px (1.9 m) and its rows swing
 * 170–245 around a mean of 195, ±19 %. Seen from the road at 0.3–2.4 km the seam's 0.16 m rows are sub-pixel, so the far
 * face keeps the same contrast on beds twice the soft band (3.8 m), waved along the face and broken into blocks, fading
 * flat past `fade` metres where a bed is under two pixels.
 */
export const FAR_STRATA = { bed: 3.8, contrast: 0.19, block: 11, fade: [1200, 2200] } as const;
/**
 * Playtest round 2: the light floor of the boundary face, as a multiple of its rock colour added after lighting. A face that
 * turns away from the frame's sun got no light at all under a frame without an ambient term (any page where no admitted
 * shard brings its sky light), so every shaded cliff drew as a pitch-black 100 m slab beside the road; with the floor a
 * shaded face is the rock's own colour dimmed (×0.8) and a sunlit one only slightly brighter than before.
 */
export const FAR_CLIFF_FLOOR = 0.8;

/**
 * G342 near round 5 (sp-o67's open row 2: a surface finer than per-vertex colour): the near placeholder's grain. Its
 * baked vertex colour (the shard's own palette, ~2 m apart) keeps the hue; one small engine-owned noise texture (128²
 * R8, mipmapped, 21 KB) breaks it into ground detail: flat ground takes two rotated taps (`flat` metres a repeat, broad
 * patches then fine tufts), steep ground takes the texture stretched along the face (`steep`: long beds, so a flank reads
 * as layered rock), and both fade out between `fade` metres, where a tap is under a pixel. `amp` is the brightness swing
 * per material family: toon keeps its flat facets nearly clean, painterly gets soft brush patches, pbr the most. Two to
 * four texture taps a fragment on the near view only; the far proxy is unchanged.
 */
export const NEAR_GRAIN = { flat: [23, 5.3], steep: [17, 4.1, 3.7], fade: [260, 720], amp: { toon: 0.12, painterly: 0.3, pbr: 0.36 } } as const;
let grainTexture: DataTexture | null = null;
/** The shared grain: tileable value noise, three octaves, stretched to the full 0–255 range. Built once, never disposed. */
function nearGrainTexture(): DataTexture {
  if (grainTexture !== null) return grainTexture;
  const n = 128, field = new Float32Array(n * n), hash = (x: number, y: number, o: number): number => {
    let h = Math.imul(x ^ 0x27d4eb2f, 0x85ebca6b) ^ Math.imul(y ^ 0x165667b1, 0xc2b2ae35) ^ Math.imul(o + 1, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296;
  };
  for (const [cells, weight, octave] of [[8, 0.5, 0], [16, 0.3, 1], [32, 0.2, 2]] as const) {
    const size = n / cells;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / size, v = y / size, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      const at = (a: number, b: number): number => hash(a % cells, b % cells, octave);
      const top = at(i, j) + (at(i + 1, j) - at(i, j)) * su, bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * su;
      field[y * n + x] = (field[y * n + x] ?? 0) + weight * (top + (bottom - top) * sv);
    }
  }
  let lo = Infinity, hi = -Infinity; for (const f of field) { lo = Math.min(lo, f); hi = Math.max(hi, f); }
  const bytes = Uint8Array.from(field, f => Math.round(((f - lo) / Math.max(1e-6, hi - lo)) * 255));
  const texture = new DataTexture(bytes, n, n, RedFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true; texture.name = 'near-grain';
  grainTexture = texture;
  return texture;
}

/** A drawn proxy: the rings' RingView shape plus its mesh. */
export interface FarProxyView {
  readonly mesh: Mesh; mask: (excluded: ReadonlySet<number>) => void; shadow: (enabled: boolean) => void; dispose: () => void;
  /** the colour its haze fades toward (linear RGB; SF19a's one frame sets the frame owner's air, G158) */
  hazeColour: (linear: Color) => void;
}

/** The family material with the region mask and haze patched in; `uniforms.farMask` holds 16 flags. */
export function farProxyMaterial(look: FarLookRuntime, positionalMask = false, grain = false): { material: MeshLambertMaterial | MeshStandardMaterial; setMask: (excluded: ReadonlySet<number>) => void; frame: { haze: Color } } {
  const material = look.family === 'pbr' ? new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) : new MeshLambertMaterial({ vertexColors: true, flatShading: look.family === 'toon' });
  material.fog = false; // its own haze below; a home shard's near fog would hide its neighbours
  const mask = new Float32Array(16), hazeColour = new Color(...look.haze.colour).convertLinearToSRGB(); // the haze mixes after the output colour-space conversion
  const uniforms = { farMask: { value: mask }, farHazeColour: { value: hazeColour }, farHaze: { value: new Vector3(look.haze.near, look.haze.far, look.haze.max) },
    ...(grain ? { farGrain: { value: nearGrainTexture() }, farGrainFade: { value: new Vector2(...NEAR_GRAIN.fade) } } : {}) };
  const f = (n: number): string => n.toFixed(2);
  const [flatA, flatB] = NEAR_GRAIN.flat, [steepAlong, steepUp, steepFine] = NEAR_GRAIN.steep;
  // round 5: the near grain after the strata (`NEAR_GRAIN`); object space is the cell frame (the mesh only translates)
  const grainFragment = grain ? `
{
  vec3 gn = normalize(vFarGrainN);
  float level = smoothstep(0.55, 0.85, abs(gn.y));
  vec2 ga = vFarGrainP.xz / ${f(flatA)}, gb = mat2(0.866, 0.5, -0.5, 0.866) * vFarGrainP.xz / ${f(flatB)};
  float flatG = texture2D(farGrain, ga).r * 0.55 + texture2D(farGrain, gb).r * 0.45;
  float along = abs(gn.x) > abs(gn.z) ? vFarGrainP.z : vFarGrainP.x;
  float steepG = texture2D(farGrain, vec2(along / ${f(steepAlong)}, vFarGrainP.y / ${f(steepUp)})).r * 0.6 + texture2D(farGrain, vec2(along, vFarGrainP.y) / ${f(steepFine)}).r * 0.4;
  diffuseColor.rgb *= 1.0 + ${f(NEAR_GRAIN.amp[look.family])} * 2.0 * (mix(steepG, flatG, level) - 0.5) * (1.0 - smoothstep(farGrainFade.x, farGrainFade.y, vFarDepth));
}` : '';
  patchShader(material, 'sf23-far', 0, (shader): void => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float farMask[16];\nvarying float vFarDepth;\nvarying float vFarCliff;\nvarying vec2 vFarStrata;${grain ? '\nvarying vec3 vFarGrainP;\nvarying vec3 vFarGrainN;' : ''}`)
      // the boundary face's foot (uv.y 2) steps inward from the cell edge; its strata ride the face (along it, up it)
      .replace('#include <begin_vertex>', (positionalMask
        ? '#include <begin_vertex>\nvFarCliff = 0.0;\nvFarStrata = transformed.xz;'
        : `#include <begin_vertex>\nvFarCliff = uv.y;\nvFarStrata = vec2(position.x + position.z, position.y);\nif (uv.y > 1.5) transformed.xz -= sign(transformed.xz) * step(vec2(${f(CHUNK_HALF - 0.01)}), abs(transformed.xz)) * ${FAR_SKIRT_INSET.toFixed(1)};`)
        + (grain ? '\nvFarGrainP = position;\nvFarGrainN = normal;' : ''))
      .replace('#include <project_vertex>', `#include <project_vertex>\nvFarDepth = -mvPosition.z;${positionalMask ? '' : '\nif (farMask[int(uv.x + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);'}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 farHazeColour;\nuniform vec3 farHaze;\nvarying float vFarDepth;\nvarying float vFarCliff;\nvarying vec2 vFarStrata;\nfloat farHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }${positionalMask ? '\nuniform float farMask[16];' : ''}${grain ? '\nuniform sampler2D farGrain;\nuniform vec2 farGrainFade;\nvarying vec3 vFarGrainP;\nvarying vec3 vFarGrainN;' : ''}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${positionalMask
        ? `\nvec2 farCell = clamp(floor((vFarStrata + ${f(CHUNK_HALF)}) / ${f(CHUNK_HALF / 2)}), vec2(0.0), vec2(3.0));\nif (farMask[int(farCell.x + 4.0 * farCell.y)] > 0.5) discard;` : ''}`)
      // G222: rock beds over the cliff palette, waved along the face, each bed broken into blocks, a lit top and a shadowed
      // underside per bed; mean ≈ 1 so the declared palette keeps its value
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFarCliff > 0.5) {
  float y = vFarStrata.y + 1.4 * sin(vFarStrata.x * 0.029) + 0.7 * sin(vFarStrata.x * 0.083 + 1.3), bed = y / ${f(FAR_STRATA.bed)}, layer = farHash(floor(bed));
  float block = farHash(floor(vFarStrata.x / ${f(FAR_STRATA.block)} + layer * 5.0) + floor(bed) * 17.0), u = fract(bed);
  float k = (1.0 + ${f(FAR_STRATA.contrast)} * (2.0 * layer - 1.0)) * (0.94 + 0.12 * block) * (1.0 + 0.1 * smoothstep(0.75, 1.0, u) - 0.12 * smoothstep(0.3, 0.0, u));
  diffuseColor.rgb *= mix(k, 1.0, smoothstep(${f(FAR_STRATA.fade[0])}, ${f(FAR_STRATA.fade[1])}, vFarDepth));
}${grainFragment}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\nif (vFarCliff > 0.5) totalEmissiveRadiance += diffuseColor.rgb * ${f(FAR_CLIFF_FLOOR)};`)
      .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, farHazeColour, smoothstep(farHaze.x, farHaze.y, vFarDepth) * farHaze.z);\ngl_FragColor.a = 1.0;');
  }, { key: `sf23-far-${look.family}${positionalMask ? '-position' : ''}${grain ? '-grain' : ''}` });
  return { material, setMask: (excluded) => { for (let r = 0; r < 16; r++) mask[r] = excluded.has(r) ? 1 : 0; }, frame: { haze: hazeColour } };
}

/**
 * Install a proxy under a cell root (the rings' upload port). It never casts or receives shadows (§3.2: only near L0).
 * `decorate` patches its material before anything compiles it (G321 part 4: the horizon fade); `grain` adds the near
 * placeholder's ground detail (`NEAR_GRAIN`).
 */
export function installFarProxy(root: Object3D, geometry: BufferGeometry, look: FarLookRuntime, positionalMask = false, decorate?: (material: Material) => void, grain = false): FarProxyView {
  const { material, setMask, frame } = farProxyMaterial(look, positionalMask, grain), mesh = new Mesh(geometry, material);
  decorate?.(material);
  mesh.name = 'far-proxy'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  geometry.computeBoundingSphere(); root.add(mesh);
  let disposed = false;
  return {
    mesh,
    mask: (excluded) => { setMask(excluded); mesh.visible = excluded.size < 16; },
    shadow: () => undefined,
    hazeColour: (linear) => { frame.haze.copy(linear).convertLinearToSRGB(); },
    dispose: () => { if (disposed) return; disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}

/** A fetched, parsed proxy waiting for its budgeted upload. */
export interface FarPrepared { readonly geometry: BufferGeometry; readonly look: FarLookRuntime; readonly positionalMask?: boolean }
/**
 * The rings' ports for level `far` (compose with the tile ports through SF18b's `levelPorts`): `load` fetches and parses
 * an instance's far.glb off the frame (GLTF parse, region in uv.x) with its far.json look. Optional `prepare` borrows
 * the admitted view while hidden; `upload` exposes that same view after preparation, and `discard` retires it.
 */
export function farRingPorts(options: { root: (instance: string) => Object3D; load: (instance: string) => Promise<FarPrepared>; prepare?: (view: FarProxyView) => Promise<void>; decorate?: (material: Material) => void }): {
  fetch: (tile: { instance: string }, done: (result: FarPrepared | Error) => void) => void;
  upload: (tile: { instance: string }, data: FarPrepared) => FarProxyView;
  discard: (tile: { instance: string }, data: FarPrepared) => void;
} {
  const staged = new WeakMap<FarPrepared, FarProxyView>();
  return {
    fetch: (tile, done) => {
      const run = async (): Promise<void> => {
        let result: FarPrepared | Error;
        try {
          const data = await options.load(tile.instance);
          if (options.prepare !== undefined) {
            let view: FarProxyView | undefined;
            try {
              view = installFarProxy(options.root(tile.instance), data.geometry, data.look, data.positionalMask, options.decorate);
              view.mesh.visible = false;
              await options.prepare(view);
              staged.set(data, view);
            } catch (error) {
              if (view === undefined) data.geometry.dispose(); else view.dispose();
              throw error;
            }
          }
          result = data;
        } catch (error) { result = error instanceof Error ? error : new Error(String(error)); }
        done(result);
      };
      void run();
    },
    upload: (tile, data) => {
      const view = staged.get(data);
      if (view === undefined) return installFarProxy(options.root(tile.instance), data.geometry, data.look, data.positionalMask, options.decorate);
      staged.delete(data); view.mesh.visible = true;
      return view;
    },
    discard: (_tile, data) => {
      const view = staged.get(data); staged.delete(data);
      if (view === undefined) data.geometry.dispose(); else view.dispose();
    },
  };
}
