import { ResourceMemo } from '@wildshard/engine/app/cachedAssets';
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
 *   const r = npcModels.rig(kind, sky);       // null until loaded → { mesh (SkinnedMesh), pose(dt, t, s), lanternAt }
 *
 * The hull, skin weights and bind frames are baked offline through SDK skinnedGlb. The page keeps npcRig.ts's
 * (E322 F-M3, Jake picked B; the upper-body-only rig A went with its Debug row) — legs, a clavicle and an upper-arm twist,
 * bound in the arms' natural hang. The clips are procedural bone poses:
 *   idle   breathing, a slow weight shift, the arms hanging, the head on the player
 *   talk   the right forearm gestures, the head nods
 *   point  the right arm raised to the horizontal toward `pointAt` (the ranger, now and then, toward the old-growth)
 *   walk   the legs step (NpcFigure.walkTo)
 */
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NpcKind } from '../runtime/models/people';
import type { StandInRig } from '../runtime/npc/standInPerson';
import skins from '../data/npcSkins.generated.json' with { type: 'json' };
import { legBones, legPose, LEG_BONE_NAMES, type LegBuilt } from '@wildshard/game/systems/npc/npcRig';

export const NPC_KINDS: readonly NpcKind[] = ['ranger', 'trader', 'miller'];

const isSkin = (node: THREE.Object3D): node is THREE.SkinnedMesh => node instanceof THREE.SkinnedMesh;
interface Source { rig: LegBuilt; map: THREE.Texture | null; normalMap: THREE.Texture | null }

/** The figure's existing rig contract, with its measured head height. */
export type NpcRig = StandInRig & { readonly height: number };

/**
 * The people's models: loaded once each, shared by every figure. The page has one (`npcModels`); a test builds its own with
 * its own file loader instead of reloading the module or spying on a loader (E422).
 */
export class NpcModels {
  private readonly sharedMats = new ResourceMemo<NpcKind, THREE.MeshStandardMaterial>();
  private readonly sources = new ResourceMemo<NpcKind, Source>(kind => { this.sharedMats.invalidate(kind); });
  private readonly loadFile: (url: string) => Promise<GLTF>;
  constructor(loadFile: (url: string) => Promise<GLTF> = loadRigFile) { this.loadFile = loadFile; }

  /** Required baked intake; missing or invalid skins refuse, with no runtime fitting. */
  load(kind: NpcKind): Promise<Source | null> {
    return this.sources.load(kind, async () => {
        const [gltf, appearance] = await Promise.all([this.loadFile(skins[kind][TIER].url), this.loadFile(skins[kind][TIER].material)]);
        const meshes: THREE.SkinnedMesh[] = [];
        gltf.scene.traverse(node => { if (isSkin(node)) meshes.push(node); });
        const mesh = meshes[0];
        if (mesh === undefined || meshes.length !== 1 || mesh.skeleton.bones.length !== LEG_BONE_NAMES.length ||
            mesh.skeleton.bones.some((bone, i) => bone.name !== LEG_BONE_NAMES[i])) throw new Error(`Invalid baked NPC skin ${kind}`);
        const surfaces: THREE.MeshStandardMaterial[] = [];
        appearance.scene.traverse(node => {
          if (!('isMesh' in node) || node.isMesh !== true || !('material' in node)) return;
          const material: unknown = Array.isArray(node.material) ? node.material[0] : node.material;
          if (material instanceof THREE.MeshStandardMaterial) surfaces.push(material);
        });
        const material = surfaces[0];
        if (!(material instanceof THREE.MeshStandardMaterial) || material.map === null || material.normalMap === null) throw new Error(`Baked NPC lacks PBR maps ${kind}`);
        const row = skins[kind][TIER], geometry = mesh.geometry;
        if (!geometry.hasAttribute('skinIndex') || !geometry.hasAttribute('skinWeight')) throw new Error(`Baked NPC lacks skin channels ${kind}`);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.5;
        const right = row.ball[0], left = row.ball[1];
        if (right === undefined || left === undefined || row.rest.length !== LEG_BONE_NAMES.length) throw new Error(`Invalid baked NPC rest frame ${kind}`);
        const rig: LegBuilt = { geometry, rest: row.rest.map(point => new THREE.Vector3().fromArray(point)),
          height: row.height, y0: row.y0, lantern: row.lantern === null ? null : new THREE.Vector3().fromArray(row.lantern),
          ball: [new THREE.Vector3().fromArray(right), new THREE.Vector3().fromArray(left)],
          walkSpeed: row.walkSpeed, walkCycle: row.walkCycle, webs: row.webs };
        const hit = { rig, map: material.map, normalMap: material.normalMap };
        appearance.scene.traverse(node => { if ('geometry' in node && node.geometry instanceof THREE.BufferGeometry) node.geometry.dispose(); });
        for (const surface of surfaces) surface.dispose();
        for (const surface of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) surface.dispose();
        mesh.skeleton.dispose();
        return hit;
    });
  }

  async preload(): Promise<void> { await Promise.all(NPC_KINDS.map((kind) => this.load(kind))); }

  /** a skinned instance of `kind`'s model, or null until it has loaded */
  rig(kind: NpcKind, sky: Sky): NpcRig | null {
    const src = this.sources.peek(kind);
    if (!src) return null;
    const mat = this.sharedMats.acquire(kind, () => {
      const material = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, normalScale: new THREE.Vector2(1, -1), roughness: 0.85, metalness: 0 });
      material.name = `ph-npc-${kind}`;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      sky.setupMaterial(material);
      return material;
    });
    // E322 F-M3: legs, a clavicle and a twist bone, the walk clip (npcRig.ts)
    const lb = src.rig, lbones = legBones(lb), pose = legPose(lbones, lb);
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
export function preloadNpcModels(): Promise<void> { return npcModels.preload(); }
