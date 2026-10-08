import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { TIER } from '@wildshard/engine/core/tier';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
/**
 * The hamlet's people, generated (PINE-HOLLOW-REMASTER PH-M4): Hale the ranger (board B3 pick A, "the old warden"), Mott
 * the trader, Brandt the miller — photoreal codex references (A-pose, art/pine-hollow/round-11-npcs/) → Hunyuan3D-2 full +
 * paint → the PBR finish (scripts/img2mesh/driftwood_post.py --keep-texture: the generated texture + a normal map, 1.8 m,
 * feet at y = 0, facing +z) → `public/assets/pine-hollow/npcs/<kind>[.phone].glb`. The heads are E304's remaster, Jake's
 * pick D (E343): a Hunyuan3D-2 bust from a codex front portrait (art/pine-hollow/round-18-faces/) with its own all-round
 * paint, grafted at its own neck (scripts/img2mesh/e304_faces.sh paint, face_remaster.py --graft-v2), normal map re-baked. npcFigure.ts's `makeNpcFigure` shows
 * its stand-in until the model has loaded, then swaps this in (Debug ▸ Pine Hollow people = Stand-ins keeps them).
 *
 *   await preloadNpcModels();                 // the quest's install: every person behind the loading screen
 *   const r = npcRig(kind);                   // null until loaded → { mesh (SkinnedMesh), pose(dt, t, s), lanternAt }
 *
 * The rig is built at load, from the hull itself (no offline bake — three people, ~5–9 k verts each): npcRig.ts's
 * (E322 F-M3, Jake picked B; the upper-body-only rig A went with its Debug row) — legs, a clavicle and an upper-arm twist,
 * bound in the arms' natural hang. The clips are procedural bone poses:
 *   idle   breathing, a slow weight shift, the arms hanging, the head on the player
 *   talk   the right forearm gestures, the head nods
 *   point  the right arm raised to the horizontal toward `pointAt` (the ranger, now and then, toward the old-growth)
 *   walk   the legs step (NpcFigure.walkTo)
 */
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NpcKind } from '../models/people';
import { legRigOf } from './npcRig';
import { legBones, legPose } from '@wildshard/kit/npc/npcRig';

export const NPC_KINDS: readonly NpcKind[] = ['ranger', 'trader', 'miller'];

/** the file each tier loads (Node-safe: the boot manifest may declare them) */
export function npcModelUrl(kind: NpcKind, tier: 'phone' | 'desktop' = TIER): string {
  return `/assets/pine-hollow/npcs/${kind}${tier === 'phone' ? '.phone' : ''}.glb`;
}

interface Source { geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null }

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true;

function asFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const key of ['position', 'normal', 'uv'] as const) {
    if (!src.hasAttribute(key)) continue;
    const a = src.getAttribute(key), n = a.count, k = a.itemSize, out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = a.getComponent(i, j);
    g.setAttribute(key, new THREE.BufferAttribute(out, k));
  }
  const idx = src.getIndex();
  if (idx) g.setIndex(Array.from(idx.array));
  return g;
}

export interface NpcRig {
  mesh: THREE.SkinnedMesh;
  /** the head's world point after posing (the talk prompt / bark) */
  readonly height: number;
  /** the ranger's lantern (mesh-local, rides the right hand), or null */
  readonly lanternAt: THREE.Vector3 | null;
  /** the right hand bone (a glow for the lantern hangs off it) */
  readonly handR: THREE.Bone;
  /**
   * pose the rig: `talk` 0 … 1 (eased by the caller), `point` 0 … 1 toward `pointYaw` (radians, mesh-local; 0 = ahead),
   * `look` the head's yaw toward the player (mesh-local); `walk` 0 … 1 blends the walk clip in (npcRig.ts's legs) at
   * `phase` (0 … 1 of its cycle: advance it by distance / `walkCycle`)
   */
  pose: (t: number, talk: number, point: number, pointYaw: number, look: number, walk?: number, phase?: number) => void;
  /** m/s at which the walk's feet stay planted */
  readonly walkSpeed: number;
  /** metres travelled per walk cycle */
  readonly walkCycle: number;
}

/**
 * The people's models: loaded once each, shared by every figure. The page has one (`npcModels`); a test builds its own with
 * its own file loader instead of reloading the module or spying on a loader (E422).
 */
export class NpcModels {
  private readonly sources = new Map<NpcKind, Source>();
  private readonly loading = new Map<NpcKind, Promise<Source | null>>();
  private readonly sharedMats = new Map<NpcKind, THREE.MeshStandardMaterial>();
  private readonly loadFile: (url: string) => Promise<GLTF>;
  constructor(loadFile: (url: string) => Promise<GLTF> = loadRigFile) { this.loadFile = loadFile; }

  /** load one person's model (cached; null when it fails — the stand-in stays) */
  load(kind: NpcKind): Promise<Source | null> {
    let p = this.loading.get(kind);
    if (!p) {
      p = this.loadFile(npcModelUrl(kind)).then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const found: Source[] = [];
        gltf.scene.traverse((o) => {
          if (found.length > 0 || !isMesh(o)) return;
          const g = asFloat(o.geometry).applyMatrix4(o.matrixWorld);
          const mat = Array.isArray(o.material) ? o.material[0] : o.material;
          const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
          found.push({ geometry: g, map: std?.map ?? null, normalMap: std?.normalMap ?? null });
        });
        const hit = found[0] ?? null;
        if (hit !== null) {
          this.sources.set(kind, hit);
          const rig = legRigOf(kind, hit.geometry);
          cacheUntilDisposed({ ...hit, rigGeometry: rig.geometry }, () => {
            if (this.sources.get(kind) !== hit) return;
            this.sources.delete(kind); this.loading.delete(kind); this.sharedMats.delete(kind);
          });
        }
        return hit;
      }).catch((e: unknown) => { console.warn(`[pine-hollow] npc model ${kind} failed`, e); return null; });
      this.loading.set(kind, p);
    }
    return p;
  }

  async preload(): Promise<void> { await Promise.all(NPC_KINDS.map((kind) => this.load(kind))); }

  /** a skinned instance of `kind`'s model, or null until it has loaded */
  rig(kind: NpcKind, sky: Sky): NpcRig | null {
    const src = this.sources.get(kind);
    if (!src) return null;
    let mat = this.sharedMats.get(kind);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, normalScale: new THREE.Vector2(1, -1), roughness: 0.85, metalness: 0 });
      mat.name = `ph-npc-${kind}`;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      sky.setupMaterial(mat);
      this.sharedMats.set(kind, mat);
      const cached = mat; cacheUntilDisposed(cached, () => { if (this.sharedMats.get(kind) === cached) this.sharedMats.delete(kind); });
    }
    // E322 F-M3: legs, a clavicle and a twist bone, the walk clip (npcRig.ts)
    const lb = legRigOf(kind, src.geometry), lbones = legBones(lb), pose = legPose(lbones, lb);
    const mesh = new THREE.SkinnedMesh(lb.geometry, mat);
    const root = lbones[0];
    if (root) mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(lbones));
    mesh.castShadow = true; mesh.receiveShadow = true;
    return {
      mesh, height: lb.height, lanternAt: lb.lantern, handR: lbones.find((x) => x.name === 'handR') ?? new THREE.Bone(), walkSpeed: lb.walkSpeed, walkCycle: lb.walkCycle,
      pose: (t, talk, point, pointYaw, look, walk = 0, phase = 0) => { pose({ t, talk, point, pointYaw, look, walk, phase }); },
    };
  }
}

/** the page's people */
export const npcModels = new NpcModels();
/** load one person's model (cached; null when it fails — the stand-in stays) */
export function loadNpcModel(kind: NpcKind): Promise<Source | null> { return npcModels.load(kind); }
export function preloadNpcModels(): Promise<void> { return npcModels.preload(); }
/** a skinned instance of `kind`'s model, or null until it has loaded */
export function npcRig(kind: NpcKind, sky: Sky): NpcRig | null { return npcModels.rig(kind, sky); }
