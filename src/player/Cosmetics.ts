/**
 * Worn cosmetics (E314, docs/plans/DRIFTWOOD-LOOT.md: the Drowned Captain's hat and the sailcloth cape, GEAR cosmetics
 * worn or taken off from the Bag). The game is first person and the player has no body mesh, so a worn thing shows
 * where a body would: in the player's SHADOW on the sand (board 4 C). `Wardrobe` hangs each worn model on its socket
 * on a root that follows the player's feet and yaw; in the default `shadow` mode its meshes draw nothing to the screen
 * (colour and depth writes off: one empty draw each) and cast their shadow as themselves — a swaying model keeps its
 * sway depth material, so the cape's shadow moves with the wind. `visible` mode draws them as they are (a mirror, a
 * third-person camera, the Bag's paper doll).
 *
 * First person: the hat's brim sits just above the eye and the cape behind the shoulders, so neither is ever in the
 * view in `shadow` mode, and nothing clips the camera. Shard-agnostic: the models come in as built objects (a shard's
 * `buildCaptainHat` / `buildSailclothCape`), each in its own space as the model contract has it.
 *
 *   const wardrobe = new Wardrobe();            scene.add(wardrobe.root);
 *   wardrobe.wear('hat', buildCaptainHat(ctx));  wardrobe.wear('cape', null);   // take the cape off
 *   // each frame, after the player moves:
 *   wardrobe.follow(player.position.x, player.position.y, player.position.z, player.yaw);
 *
 * Not wired yet (stage 2 / 3): who calls wear(), the save, the Bag's toggle.
 */
import * as THREE from 'three';

/** where a worn model's own-space origin sits, from the player's feet (m): y up, z toward the way the player faces */
export const WEAR_SOCKET = {
  /** the hat's origin is its head band: just over the eye (Player EYE 1.68, the capsule's crown 1.8) */
  hat: { y: 1.74, z: -0.01 },
  /** the cape's origin is its hem line and its neck is 1 m over it: the neck at the shoulders' top (~1.46) */
  cape: { y: 0.46, z: 0 },
} as const;
export type WearSlot = keyof typeof WEAR_SOCKET;
export const WEAR_SLOTS: readonly WearSlot[] = ['hat', 'cape'];

/** `shadow`: seen only in the player's shadow (first person); `visible`: drawn as they are */
export type WearMode = 'shadow' | 'visible';

/** draws nothing to the screen; the shadow pass uses its own depth material, so the mesh still casts */
let shadowOnly: THREE.MeshBasicMaterial | null = null;
function shadowOnlyMaterial(): THREE.MeshBasicMaterial {
  shadowOnly ??= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  return shadowOnly;
}

export class Wardrobe {
  readonly root = new THREE.Group();
  private readonly mode: WearMode;
  private readonly worn: Record<WearSlot, THREE.Object3D | null> = { hat: null, cape: null };

  constructor(mode: WearMode = 'shadow') {
    this.mode = mode;
    this.root.name = 'wardrobe';
  }

  /** wear `object` in `slot` (replacing what was there), or take it off with null; returns what came off */
  wear(slot: WearSlot, object: THREE.Object3D | null): THREE.Object3D | null {
    const prev = this.worn[slot];
    if (prev === object) return null;
    if (prev) this.root.remove(prev);
    this.worn[slot] = object;
    if (object) {
      const s = WEAR_SOCKET[slot];
      object.position.set(0, s.y, s.z);
      if (this.mode === 'shadow') {
        object.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.material = shadowOnlyMaterial();
          o.castShadow = true;
          o.receiveShadow = false;
        });
      }
      this.root.add(object);
    }
    return prev;
  }

  /** what is worn in `slot` (null: nothing) */
  wearing(slot: WearSlot): THREE.Object3D | null { return this.worn[slot]; }

  /** pose the worn things on the player: feet at (x, feetY, z), facing `yaw` (Player.yaw: 0 looks toward −z). No allocation. */
  follow(x: number, feetY: number, z: number, yaw: number): void {
    this.root.position.set(x, feetY, z);
    this.root.rotation.set(0, yaw + Math.PI, 0); // a model's front is +Z; the player's forward at yaw 0 is −Z
  }
}
