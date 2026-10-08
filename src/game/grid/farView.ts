/**
 * Drawing a far proxy (SHARD-PLATFORM SF23): one mesh, one draw, its 16 regions hidden by a vertex-shader mask when the
 * render rings refine them (`RingView.mask`, regions x + 4z), and a distance haze of its own toward the shard's haze
 * colour. The material follows the shard's family: `toon` faceted Lambert (flat normals), `painterly` smooth Lambert,
 * `pbr` rough standard. The region rides in TEXCOORD_0.x (the baked GLB's only spare channel; `farProxy.ts`) and the
 * boundary-face flag in TEXCOORD_0.y (G222: 1 lip, 2 foot), where the material lays rock strata over the shard's cliff
 * palette.
 */
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { patchShader } from '@wildshard/engine/render/shaderPatches';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { FarLookRuntime, FarProxyMesh } from './farProxy';

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

/** A drawn proxy: the rings' RingView shape plus its mesh. */
export interface FarProxyView {
  readonly mesh: Mesh; mask: (excluded: ReadonlySet<number>) => void; shadow: (enabled: boolean) => void; dispose: () => void;
  /** the colour its haze fades toward (linear RGB; SF19a's one frame sets the frame owner's air, G158) */
  hazeColour: (linear: Color) => void;
}

/** The family material with the region mask and haze patched in; `uniforms.farMask` holds 16 flags. */
export function farProxyMaterial(look: FarLookRuntime): { material: MeshLambertMaterial | MeshStandardMaterial; setMask: (excluded: ReadonlySet<number>) => void; frame: { haze: Color } } {
  const material = look.family === 'pbr' ? new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) : new MeshLambertMaterial({ vertexColors: true, flatShading: look.family === 'toon' });
  material.fog = false; // its own haze below; a home shard's near fog would hide its neighbours
  const mask = new Float32Array(16), hazeColour = new Color(...look.haze.colour).convertLinearToSRGB(); // the haze mixes after the output colour-space conversion
  const uniforms = { farMask: { value: mask }, farHazeColour: { value: hazeColour }, farHaze: { value: new Vector3(look.haze.near, look.haze.far, look.haze.max) } };
  const f = (n: number): string => n.toFixed(2);
  patchShader(material, 'sf23-far', 0, (shader): void => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float farMask[16];\nvarying float vFarDepth;\nvarying float vFarCliff;\nvarying vec2 vFarStrata;')
      // the boundary face's foot (uv.y 2) steps inward from the cell edge; its strata ride the face (along it, up it)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvFarCliff = uv.y;\nvFarStrata = vec2(position.x + position.z, position.y);\nif (uv.y > 1.5) transformed.xz -= sign(transformed.xz) * step(vec2(${f(CHUNK_HALF - 0.01)}), abs(transformed.xz)) * ${FAR_SKIRT_INSET.toFixed(1)};`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFarDepth = -mvPosition.z;\nif (farMask[int(uv.x + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 farHazeColour;\nuniform vec3 farHaze;\nvarying float vFarDepth;\nvarying float vFarCliff;\nvarying vec2 vFarStrata;\nfloat farHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }')
      // G222: rock beds over the cliff palette, waved along the face, each bed broken into blocks, a lit top and a shadowed
      // underside per bed; mean ≈ 1 so the declared palette keeps its value
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFarCliff > 0.5) {
  float y = vFarStrata.y + 1.4 * sin(vFarStrata.x * 0.029) + 0.7 * sin(vFarStrata.x * 0.083 + 1.3), bed = y / ${f(FAR_STRATA.bed)}, layer = farHash(floor(bed));
  float block = farHash(floor(vFarStrata.x / ${f(FAR_STRATA.block)} + layer * 5.0) + floor(bed) * 17.0), u = fract(bed);
  float k = (1.0 + ${f(FAR_STRATA.contrast)} * (2.0 * layer - 1.0)) * (0.94 + 0.12 * block) * (1.0 + 0.1 * smoothstep(0.75, 1.0, u) - 0.12 * smoothstep(0.3, 0.0, u));
  diffuseColor.rgb *= mix(k, 1.0, smoothstep(${f(FAR_STRATA.fade[0])}, ${f(FAR_STRATA.fade[1])}, vFarDepth));
}`)
      .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, farHazeColour, smoothstep(farHaze.x, farHaze.y, vFarDepth) * farHaze.z);\ngl_FragColor.a = 1.0;');
  }, { key: `sf23-far-${look.family}` });
  return { material, setMask: (excluded) => { for (let r = 0; r < 16; r++) mask[r] = excluded.has(r) ? 1 : 0; }, frame: { haze: hazeColour } };
}

/** Geometry from a baked mesh (tests, the board) or reuse a GLTF-parsed one: either way the region is uv.x, the cliff uv.y. */
export function farProxyGeometry(mesh: FarProxyMesh): BufferGeometry {
  const uv = new Float32Array(mesh.region.length * 2); mesh.region.forEach((r, i) => { uv[i * 2] = r; uv[i * 2 + 1] = mesh.cliff[i] ?? 0; });
  return new BufferGeometry().setAttribute('position', new BufferAttribute(mesh.positions, 3)).setAttribute('normal', new BufferAttribute(mesh.normals, 3))
    .setAttribute('color', new BufferAttribute(mesh.colours, 3)).setAttribute('uv', new BufferAttribute(uv, 2)).setIndex(new BufferAttribute(mesh.index, 1));
}

/** Install a proxy under a cell root (the rings' upload port). It never casts or receives shadows (§3.2: only near L0). */
export function installFarProxy(root: Object3D, geometry: BufferGeometry, look: FarLookRuntime): FarProxyView {
  const { material, setMask, frame } = farProxyMaterial(look), mesh = new Mesh(geometry, material);
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
export interface FarPrepared { readonly geometry: BufferGeometry; readonly look: FarLookRuntime }
/**
 * The rings' ports for level `far` (compose with the tile ports through SF18b's `levelPorts`): `load` fetches and parses
 * an instance's far.glb off the frame (GLTF parse, region in uv.x) with its far.json look; `upload` only attaches it.
 */
export function farRingPorts(options: { root: (instance: string) => Object3D; load: (instance: string) => Promise<FarPrepared> }): {
  fetch: (tile: { instance: string }, done: (result: FarPrepared | Error) => void) => void;
  upload: (tile: { instance: string }, data: FarPrepared) => FarProxyView;
  discard: (tile: { instance: string }, data: FarPrepared) => void;
} {
  return {
    fetch: (tile, done) => {
      const run = async (): Promise<void> => {
        let result: FarPrepared | Error;
        try { result = await options.load(tile.instance); } catch (error) { result = error instanceof Error ? error : new Error(String(error)); }
        done(result);
      };
      void run();
    },
    upload: (tile, data) => installFarProxy(options.root(tile.instance), data.geometry, data.look),
    discard: (_tile, data) => { data.geometry.dispose(); },
  };
}
