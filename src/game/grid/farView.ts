/**
 * Drawing a far proxy (SHARD-PLATFORM SF23): one mesh, one draw, its 16 regions hidden by a vertex-shader mask when the
 * render rings refine them (`RingView.mask`, regions x + 4z), and a distance haze of its own toward the shard's haze
 * colour. The material follows the shard's family: `toon` faceted Lambert (flat normals), `painterly` smooth Lambert,
 * `pbr` rough standard. The region rides in TEXCOORD_0.x (the baked GLB's only spare channel; `farProxy.ts`).
 */
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { patchShader } from '@wildshard/engine/render/shaderPatches';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { FAR_EDGE_FLOOR, type FarLookRuntime, type FarProxyMesh } from './farProxy';

/**
 * SF23 / G90: how far (m) the foot of a proxy's border skirt steps in from the cell edge. The skirt keeps its top on the
 * edge and its −20 m floor (G121), but leans inward, so a seam's retaining wall (a face in the cell-edge plane, 6 m to H)
 * draws in front of it instead of sharing its plane. Applied in the vertex shader: the baked GLBs stay as they are.
 */
export const FAR_SKIRT_INSET = 3;

/** A drawn proxy: the rings' RingView shape plus its mesh. */
export interface FarProxyView {
  readonly mesh: Mesh; mask: (excluded: ReadonlySet<number>) => void; shadow: (enabled: boolean) => void; dispose: () => void;
  /** the colour its haze fades toward (linear RGB; SF19a's one frame sets the frame owner's air, G158) */
  hazeColour: (linear: Color) => void;
  /** G167 B: a refused shard's far view frozen grey (a uniform: the same program, no rebuild) */
  grey: (on: boolean) => void;
}

/** The family material with the region mask and haze patched in; `uniforms.farMask` holds 16 flags. */
export function farProxyMaterial(look: FarLookRuntime): { material: MeshLambertMaterial | MeshStandardMaterial; setMask: (excluded: ReadonlySet<number>) => void; frame: { haze: Color }; grey: { value: number } } {
  const material = look.family === 'pbr' ? new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) : new MeshLambertMaterial({ vertexColors: true, flatShading: look.family === 'toon' });
  material.fog = false; // its own haze below; a home shard's near fog would hide its neighbours
  const mask = new Float32Array(16), hazeColour = new Color(...look.haze.colour).convertLinearToSRGB(); // the haze mixes after the output colour-space conversion
  const grey = { value: 0 };
  const uniforms = { farMask: { value: mask }, farHazeColour: { value: hazeColour }, farHaze: { value: new Vector3(look.haze.near, look.haze.far, look.haze.max) }, farGrey: grey };
  patchShader(material, 'sf23-far', 0, (shader): void => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float farMask[16];\nvarying float vFarDepth;')
      // a border skirt's foot: a horizontal normal, at or under the edge floor, on the cell edge; it steps inward
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nif (abs(normal.y) < 0.01 && transformed.y < ${(FAR_EDGE_FLOOR + 0.01).toFixed(2)}) transformed.xz -= sign(transformed.xz) * step(vec2(${(CHUNK_HALF - 0.01).toFixed(2)}), abs(transformed.xz)) * ${FAR_SKIRT_INSET.toFixed(1)};`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFarDepth = -mvPosition.z;\nif (farMask[int(uv.x + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 farHazeColour;\nuniform vec3 farHaze;\nuniform float farGrey;\nvarying float vFarDepth;')
      // G167 B: a refused shard's far view frozen grey (luminance, lifted toward a pale stone grey)
      .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, farHazeColour, smoothstep(farHaze.x, farHaze.y, vFarDepth) * farHaze.z);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)) * 0.75 + 0.14), farGrey);\ngl_FragColor.a = 1.0;');
  }, { key: `sf23-far-${look.family}` });
  return { material, setMask: (excluded) => { for (let r = 0; r < 16; r++) mask[r] = excluded.has(r) ? 1 : 0; }, frame: { haze: hazeColour }, grey };
}

/** Geometry from a baked mesh (tests, the board) or reuse a GLTF-parsed one: either way the region is uv.x. */
export function farProxyGeometry(mesh: FarProxyMesh): BufferGeometry {
  const uv = new Float32Array(mesh.region.length * 2); mesh.region.forEach((r, i) => { uv[i * 2] = r; });
  return new BufferGeometry().setAttribute('position', new BufferAttribute(mesh.positions, 3)).setAttribute('normal', new BufferAttribute(mesh.normals, 3))
    .setAttribute('color', new BufferAttribute(mesh.colours, 3)).setAttribute('uv', new BufferAttribute(uv, 2)).setIndex(new BufferAttribute(mesh.index, 1));
}

/** Install a proxy under a cell root (the rings' upload port). It never casts or receives shadows (§3.2: only near L0). */
export function installFarProxy(root: Object3D, geometry: BufferGeometry, look: FarLookRuntime): FarProxyView {
  const { material, setMask, frame, grey } = farProxyMaterial(look), mesh = new Mesh(geometry, material);
  mesh.name = 'far-proxy'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  geometry.computeBoundingSphere(); root.add(mesh);
  let disposed = false;
  return {
    mesh,
    mask: (excluded) => { setMask(excluded); mesh.visible = excluded.size < 16; },
    shadow: () => undefined,
    hazeColour: (linear) => { frame.haze.copy(linear).convertLinearToSRGB(); },
    grey: (on) => { grey.value = on ? 1 : 0; },
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
