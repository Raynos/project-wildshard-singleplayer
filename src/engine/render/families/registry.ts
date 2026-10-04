/**
 * The material-family registry (SHARD-PLATFORM SF10a, G4 / G32): one entry per family id, turning a validated material
 * entry into a material for the v1 renderer (three.js WebGL), and the precompile jobs that build every live family
 * program before its first draw. A WebGPU renderer would register its own compilers against the same ids; nothing a
 * shard writes changes.
 *
 * Every material made here is tracked until its scope is disposed, so the loading screen's shader step compiles family
 * programs that are not in the scene yet (a creature that spawns later, a prop that streams in): `familyCompileJobs`.
 */
import * as THREE from 'three';
import type { Scope } from '../../app/scope';
import type { CompileJob } from '../precompile';
import { engineString } from '../../strings';
import { parseFamilyMaterial, type FamilyMaterialParams } from './params';
import { compilePbr, type TextureResolver } from './pbr';
import { compileToon, type ToonLook } from './toon';

/** What a compiler may read besides the material's own parameters. */
export interface FamilyContext {
  /** the toon look its toon materials share (one per shard) */
  readonly toon: ToonLook;
  /** texture references → textures */
  readonly textures: TextureResolver;
  /** owns the materials: they stop being tracked for the shader step when it is disposed */
  readonly scope: Scope;
}

const live = new Map<THREE.Material, FamilyMaterialParams>();

const compile = (params: FamilyMaterialParams, ctx: FamilyContext): THREE.Material =>
  params.family === 'toon' ? compileToon(params, ctx.toon) : compilePbr(params, ctx.textures);

/**
 * A family material from a material entry (validated here, defaults filled), tracked for the shader step until
 * `ctx.scope` is disposed. Several entries with equal parameters still get their own material; share the result to share uniforms.
 */
export function familyMaterial(entry: unknown, ctx: FamilyContext): THREE.Material {
  const params = parseFamilyMaterial(entry);
  const m = compile(params, ctx);
  live.set(m, params);
  ctx.scope.onDispose(() => { live.delete(m); });
  return m;
}

/** every live family material and the parameters it was made from */
export function liveFamilyMaterials(): ReadonlyMap<THREE.Material, FamilyMaterialParams> { return live; }

/** the stand-in geometry a family program is compiled on: position, normal, uv and a colour attribute */
let standInGeometry: THREE.BufferGeometry | null = null;
function standIn(): THREE.BufferGeometry {
  if (standInGeometry) return standInGeometry;
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  standInGeometry = g;
  return g;
}

/** the parts of a family material that change its program, beyond the family's shared key */
function variantKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  return `${m.customProgramCacheKey()}|${m.type}|${s.vertexColors ? 'v' : ''}${s.flatShading ? 'f' : ''}|${m.side}|${m.alphaTest > 0 ? 't' : ''}|${m.transparent ? 'a' : ''}`;
}

/**
 * Shader-step jobs for every live family program not yet compiled: one plain stand-in mesh per distinct program variant
 * (instanced and skinned variants already in the scene are the scene jobs' clones), drawn with `target`'s fog and lights into `rt`. Programs the scene
 * already holds are cache hits. Empty when no family material is live.
 */
export function familyCompileJobs(target: THREE.Scene | null, rt: THREE.WebGLRenderTarget | null, per = 6): CompileJob[] {
  const seen = new Set<string>();
  const meshes: THREE.Mesh[] = [];
  const geometry = standIn();
  for (const m of live.keys()) {
    const key = variantKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    meshes.push(new THREE.Mesh(geometry, m));
  }
  const jobs: CompileJob[] = [];
  for (let i = 0; i < meshes.length; i += per) {
    const root = new THREE.Group();
    for (const mesh of meshes.slice(i, i + per)) root.add(mesh);
    jobs.push({ label: engineString('s_4bdf150dd0ed', [i]), root, target, rt });
  }
  return jobs;
}
