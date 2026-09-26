// Copied from the viewmodel lab (src/dev/nd-lab/viewmodel/assets.ts, round-9-lab-viewmodel) into the clean room.
// The viewmodel's GLBs (lab P8 "viewmodel", E169) → geometry the one viewmodel program draws. The asset contract is
// SPEC.md (Blender scripts in ./blender/): glTF Y-up metres, the material NAME is the shading class (geo.ts
// CLS_BY_NAME), maps either per vertex (COLOR_0 = AO, curvature, detail: the TRELLIS guard) or as a texture pair
// `<name>-maps.webp` + `<name>-nrm.webp` on TEXCOORD_0 (the Blender hands and gauntlet). Nodes whose name is in `split`
// come back as their own geometry (the claw the grapple hides, the left fist).
import { type BufferGeometry, Matrix3, type Matrix4, Mesh, type Material, NoColorSpace, type Texture, TextureLoader, Vector3, LinearMipmapLinearFilter, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CLS, CLS_BY_NAME, Geo } from './geo';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const texLoader = new TextureLoader();

export const ASSET_BASE = '/assets/nine-dragon/lab/viewmodel/';

export interface Asset {
  /** geometry per split node name; everything else under 'main' */
  parts: Map<string, BufferGeometry>;
  maps: Texture | null;
  nrm: Texture | null;
  tris: number;
}

async function tryTex(url: string): Promise<Texture | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || (head.headers.get('content-type') ?? '').includes('text/html')) return null;
    const t = await texLoader.loadAsync(url);
    t.colorSpace = NoColorSpace;
    t.flipY = false;
    t.minFilter = LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return t;
  } catch {
    return null;
  }
}

function matName(m: Material | Material[]): string {
  const one = Array.isArray(m) ? m[0] : m;
  return (one?.name ?? '').replace(/\.\d+$/u, '');
}

/** load `<name>.glb` (+ its maps if present); `xf` transforms every vertex (placement into the owner's frame) */
export async function loadAsset(name: string, split: readonly string[] = [], xf?: Matrix4): Promise<Asset> {
  const gltf = await loader.loadAsync(`${ASSET_BASE}${name}.glb`);
  gltf.scene.updateMatrixWorld(true);
  const builders = new Map<string, Geo>();
  let tris = 0;
  const owner = (o: Object3D): string => {
    let p: Object3D | null = o;
    while (p !== null) {
      if (split.includes(p.name)) return p.name;
      p = p.parent;
    }
    return 'main';
  };
  const v = new Vector3();
  const nm = new Matrix3();
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal') as ReturnType<BufferGeometry['getAttribute']> | undefined;
    const uv = g.getAttribute('uv') as ReturnType<BufferGeometry['getAttribute']> | undefined;
    const col = g.getAttribute('color') as ReturnType<BufferGeometry['getAttribute']> | undefined;
    // a vertex-mapped asset (COLOR_0 = the maps) carries its macro normal in TEXCOORD_0: octahedral, Blender axes,
    // v flipped by the glTF exporter
    const mac = col === undefined ? undefined : uv;
    const world = o.matrixWorld.clone();
    if (xf !== undefined) world.premultiply(xf);
    nm.getNormalMatrix(world);
    const n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = uv === undefined ? null : new Float32Array(n * 2);
    const M = col === undefined ? null : new Float32Array(n * 3);
    const C = new Float32Array(n);
    const S = mac === undefined ? null : new Float32Array(n * 3);
    const cls = CLS_BY_NAME[matName(o.material as Material | Material[])] ?? CLS.brass;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(world);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      if (nor === undefined) v.set(0, 1, 0); else v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
      if (U !== null && uv !== undefined) { U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); }
      if (M !== null && col !== undefined) { M[i * 3] = col.getX(i); M[i * 3 + 1] = col.getY(i); M[i * 3 + 2] = col.getZ(i); }
      if (S !== null && mac !== undefined) {
        const ox = mac.getX(i) * 2 - 1, oy = (1 - mac.getY(i)) * 2 - 1;
        const oz = 1 - Math.abs(ox) - Math.abs(oy);
        const bx = oz < 0 ? (1 - Math.abs(oy)) * Math.sign(ox) : ox, by = oz < 0 ? (1 - Math.abs(ox)) * Math.sign(oy) : oy;
        // Blender (x, y, z) → glTF (x, z, −y), then the node's normal matrix
        v.set(bx, oz, -by).applyMatrix3(nm).normalize();
        S[i * 3] = v.x; S[i * 3 + 1] = v.y; S[i * 3 + 2] = v.z;
      }
      C[i] = cls;
    }
    const index = g.getIndex();
    const I = index === null ? Uint32Array.from({ length: n }, (_, i) => i) : Uint32Array.from(index.array);
    // a mirrored transform (det < 0) flips the winding
    if (world.determinant() < 0) for (let t = 0; t + 2 < I.length; t += 3) { const a = I[t + 1] ?? 0; I[t + 1] = I[t + 2] ?? 0; I[t + 2] = a; }
    tris += I.length / 3;
    const key = owner(o);
    let b = builders.get(key);
    if (b === undefined) { b = new Geo(); builders.set(key, b); }
    b.mesh(P, N, U, M, C, I, S);
  });
  const parts = new Map<string, BufferGeometry>();
  for (const [k, b] of builders) parts.set(k, b.build());
  const [maps, nrm] = await Promise.all([tryTex(`${ASSET_BASE}${name}-maps.webp`), tryTex(`${ASSET_BASE}${name}-nrm.webp`)]);
  return { parts, maps, nrm, tris };
}
