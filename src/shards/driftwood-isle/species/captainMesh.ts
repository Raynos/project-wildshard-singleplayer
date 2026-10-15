import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { preloadCreatureBodies } from './bodies';

export const CAPTAIN_GLB_URL = '/assets/models/driftwood-hero/captain/captain.glb';
/** Captain texture intake; fitted geometry and skin weights come from the creature-body bake. */
export class CaptainMesh {
  private texture: THREE.Texture | null = null;
  private ready = false;
  private loading: Promise<void> | null = null;
  private readonly loadFile: (url: string) => Promise<GLTF>;
  constructor(loadFile: (url: string) => Promise<GLTF> = loadRigFile) { this.loadFile = loadFile; }
  private async load(): Promise<void> {
    const [gltf] = await Promise.all([this.loadFile(CAPTAIN_GLB_URL), preloadCreatureBodies()]);
    const hit: { found: boolean; map: THREE.Texture | null } = { found: false, map: null };
    gltf.scene.traverse(node => {
      if (hit.found || !(node instanceof THREE.Mesh)) return;
      hit.found = true;
      const raw: unknown = node.material;
      const material: unknown = Array.isArray(raw) ? raw[0] : raw;
      hit.map = material instanceof THREE.MeshStandardMaterial ? material.map : null;
    });
    if (!hit.found) throw new Error('Captain GLB has no mesh');
    this.texture = hit.map;
    this.ready = true;
    const texture = this.texture;
    cacheUntilDisposed({ map: texture }, () => {
      if (this.texture !== texture) return;
      this.ready = false; this.texture = null; this.loading = null;
    });
  }
  /** Await both the original texture and the required baked body before saved-altar restore. */
  preload(): Promise<void> { this.loading ??= this.load(); return this.loading; }
  /** The original GLB material's map, with the same pre-build refusal. */
  textureFor(): THREE.Texture | null {
    if (!this.ready) throw new Error('Captain mesh is not loaded; await preloadCaptainMesh before building');
    return this.texture;
  }
}
export const captainMesh = new CaptainMesh();
export function preloadCaptainMesh(): Promise<void> { return captainMesh.preload(); }
