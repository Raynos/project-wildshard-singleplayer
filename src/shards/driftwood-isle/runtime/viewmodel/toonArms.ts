/**
 * Toon first-person arms as a viewmodel system (SHARD-PLATFORM M3): a skinned arms rig (a GLB the shared arm player
 * `RigArms` plays) dressed in the shard's graph toon materials, lit like the world (the toon look, its shadows and fog),
 * held with two swords (wood and iron, each blade's edges lit by a glow level) and the same arms swimming with a water
 * line. Nothing here knows a shard: the shard passes its look row (the rig's file and skeleton, the framing, the blade's
 * base, the swim water line, the look.materials ids) and lends the compiled graphs (`lend`) before anything is dressed.
 *
 *   const arms = new ToonArms(look);
 *   scope.onDispose(arms.lend(await runtimeLookMaterials(ctx, source, true, ids), followToon(toon)));   // the kit hook
 *   sword: async () => arms.load()           // ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands
 *   arms.specimen(sky, 'iron')               // the Model Explorer's card: the arms at rest holding a sword
 *
 * The graphs' params this system moves:
 * - **held** (arms, wood, iron): `sunward`, the cast-shadow lookup shifted `look.sunward` m toward the light (the day /
 *   night clock's sun or moon) so the invisible body never shades the arms; a sword's `bladeDq` (its mesh's node scale and
 *   y: the GLB's positions are quantized) and `bladeBase` (the rig's meta), and `rim`, its held glow level. The iron
 *   sword reads the GLB's per-vertex metalness, bound as `aMetal`.
 * - **swim**: the view-space water plane `waterN` / `waterD` (the world's up turned a third into the camera, through the
 *   hands, tipped `tilt` toward the eye).
 */
import type { RigBake, RigContract } from '@wildshard/engine/anim/rig';
import type { SwimArms } from '@wildshard/engine/player/Hands';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { type BufferGeometry, type Material, type Mesh, type Object3D, type PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from '@wildshard/game/systems/viewmodel/armClips';
import { RigArms, swordArmsOf, vmScale } from '@wildshard/game/systems/viewmodel/rigArms';

type Vec3 = readonly [number, number, number];
type Sword = 'wood' | 'iron';

/** a shard's toon arms as data */
export interface ToonArmsLook {
  /** the rig's GLB and its skeleton name */
  readonly url: string;
  readonly skeleton: string;
  readonly sockets: readonly string[];
  /** the bake's joints: each side's arm chain, then each finger's phalanges, named `<side>_<joint>` */
  readonly joints: { readonly sides: readonly string[]; readonly arm: readonly string[]; readonly fingers: readonly string[]; readonly phalanges: number };
  /** the framing in canonical rig units, and on the screen (rigArms VmFrame) */
  readonly offset: Vec3;
  readonly frame: { readonly size: number; readonly pitch: number; readonly yaw: number; readonly roll: number };
  /** metres toward the light the arms look their shadow up */
  readonly sunward: number;
  /** a blade's base (weapon-local m) when the rig's meta has none */
  readonly bladeBase: number;
  /** the swim water line: the tip toward the eye, the hands' depth (m, view space), the line's height when the rig's meta
   *  has none, and its plane offset to start */
  readonly swim: { readonly tilt: number; readonly handsZ: number; readonly waterY: number; readonly startD: number };
  /** the look.materials ids the arms, each sword and the swimming arms wear */
  readonly materials: { readonly arms: string; readonly wood: string; readonly iron: string; readonly swim: string };
}

/** what a compiled look catalogue lends (`runtimeLookMaterials`) */
export interface ToonArmsLooks {
  readonly materials: ReadonlyMap<string, Material>;
  readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
}
/** a lent catalogue and its toon look's follow of the day clock */
interface Loan { readonly looks: ToonArmsLooks; readonly follow: () => void }

const CLIPS = { ...ARM_CLIPS, ...SWIM_CLIPS };

/** Toon first-person arms: a skinned rig with two swords and swimming hands, dressed from a shard's ToonArmsLook row. */
export class ToonArms {
  readonly contract: RigContract;
  readonly bake: RigBake;
  private readonly offset: Vector3;
  /** the live loans, newest last (each scope removes its own) */
  private readonly loans: Loan[] = [];

  constructor(private readonly look: ToonArmsLook) {
    const j = look.joints;
    this.contract = { skeleton: look.skeleton, clips: armClipNames(CLIPS), sockets: [...look.sockets] };
    this.bake = {
      skeleton: look.skeleton, clips: CLIPS,
      joints: [j.sides.flatMap((side) => [...j.arm].concat(
        j.fingers.flatMap((finger) => Array.from({ length: j.phalanges }, (_, i) => i + 1).map((i) => `${finger}${i}`)),
      ).map((name) => `${side}_${name}`))],
    };
    this.offset = new Vector3(look.offset[0], look.offset[1], look.offset[2]);
  }

  /** Lend the compiled graphs (the look row's ids) and their toon look's follow; the returned release ends the loan. */
  lend(looks: ToonArmsLooks, follow: () => void): () => void {
    const ids = this.look.materials;
    const missing = [ids.arms, ids.wood, ids.iron, ids.swim].filter((id) => !looks.materials.has(id));
    if (missing.length > 0) throw new Error(`Toon arms: look.materials lacks ${missing.join(', ')}`);
    const loan: Loan = { looks, follow };
    this.loans.push(loan);
    return () => { const at = this.loans.indexOf(loan); if (at !== -1) this.loans.splice(at, 1); };
  }

  private loan(): Loan {
    const loan = this.loans.at(-1);
    if (loan === undefined) throw new Error('Toon arms: no graph materials lent (the kit hook lends them before the arms are dressed)');
    return loan;
  }

  private material(loan: Loan, id: string): Material {
    const m = loan.looks.materials.get(id);
    if (m === undefined) throw new Error(`Toon arms: look.materials lacks ${id}`);
    return m;
  }

  /** the held materials on a rig: the swords' blade params, and once a frame (the arms' draw) the toon look's follow and
   *  the shadow lookup toward the light */
  private dressHeld(sky: Sky, rig: RigArms): void {
    const L = this.look, ids = L.materials, loan = this.loan(), set = loan.looks.setParam;
    for (const kind of ['wood', 'iron'] as const) {
      const node = rig.nodes.get(`sword_${kind}`);
      set(ids[kind], 'bladeDq', [node?.scale.x ?? 1, node?.position.y ?? 0]);
      set(ids[kind], 'bladeBase', rig.meta.swords[kind]?.bladeBase ?? L.bladeBase);
    }
    const lightDir = sky.csm.lightDirection; // the one vector the day / night clock copies the sun (or the moon) into
    const sunward = [0, 0, 0];
    const frame = (): void => {
      loan.follow();
      sunward[0] = -lightDir.x * L.sunward; sunward[1] = -lightDir.y * L.sunward; sunward[2] = -lightDir.z * L.sunward;
      set(ids.arms, 'sunward', sunward); set(ids.wood, 'sunward', sunward); set(ids.iron, 'sunward', sunward);
    };
    const meshes = armMeshes(rig);
    for (let i = 0; i < 3; i++) {
      const mesh = meshes[i];
      if (mesh === undefined) throw new Error('Missing toon arm mesh');
      bindMetal(mesh.geometry);
      mesh.material = this.material(loan, mesh.name === 'sword_iron' ? ids.iron : mesh.name === 'sword_wood' ? ids.wood : ids.arms);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData['treatAsOpaque'] = true; // out of the AO's transparency pre-pass (the viewmodel queue's depth clear keeps the world's depth behind it)
      if (mesh.name !== 'sword_iron' && mesh.name !== 'sword_wood') mesh.onBeforeRender = frame;
    }
  }

  /** the swimming hands on the rig (Hands.ts): the swim clips, the projection, the water line */
  private swimArms(rig: RigArms): SwimArms {
    const S = this.look.swim, id = this.look.materials.swim;
    const n = new Vector3(0, 1, 0), plane = [0, 1, 0];
    const waterY = rig.meta.water?.y ?? S.waterY;
    const q = new Quaternion(), up = new Vector3();
    let set: ToonArmsLooks['setParam'] | null = null;
    rig.weapon(null);
    return {
      root: rig.root,
      setup: () => {
        const loan = this.loan(), m = this.material(loan, id);
        set = loan.looks.setParam;
        set(id, 'waterD', S.startD);
        const meshes = armMeshes(rig);
        for (let i = 0; i < 3; i++) {
          const mesh = meshes[i];
          if (mesh === undefined) throw new Error('Missing toon arm mesh');
          mesh.material = m; mesh.castShadow = false; mesh.receiveShadow = true;
          if (mesh.name !== 'sword_iron' && mesh.name !== 'sword_wood') mesh.onBeforeRender = loan.follow;
        }
      },
      update: (dt, s: { stroke: number; phase: number; camera: PerspectiveCamera; eyeAbove: number }) => {
        const k = vmScale(s.camera.fov);
        rig.root.scale.set(k, k, 1);
        rig.root.position.set(0, 0, 0);
        rig.swim(dt, s.stroke, s.phase);
        if (set === null) return;
        // the water plane in view space: the world's up turned into the camera (a third of the pitch: the arms are held to
        // the surface, not to the head), through the hands at the height the clips were framed on (scaled by the
        // projection), and tipped up toward the eye so the forearms in the lower corners ride above it — every point under
        // it when the eye itself is under the surface
        up.set(0, 1, 0).applyQuaternion(s.camera.getWorldQuaternion(q).invert());
        n.set(up.x * 0.35, 1, up.z * 0.35 + S.tilt).normalize();
        plane[0] = n.x; plane[1] = n.y; plane[2] = n.z;
        set(id, 'waterN', plane);
        set(id, 'waterD', s.eyeAbove < 0.02 ? 50 : n.y * waterY * k + n.z * S.handsZ);
      },
    };
  }

  /** the rigs, loaded as ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands */
  async load(): Promise<ShardSword> {
    const L = this.look;
    const [wood, iron, swim] = await Promise.all([RigArms.load(L.url, this.contract, this.bake), RigArms.load(L.url, this.contract, this.bake), RigArms.load(L.url, this.contract, this.bake, true)]);
    wood.weapon('wood');
    iron.weapon('iron');
    const setup = (rig: RigArms) => (sky: Sky): void => { this.dressHeld(sky, rig); };
    /** the held blade's glow: its edges lit */
    const glow = (id: string) => (level: number): void => { this.loan().looks.setParam(id, 'rim', level); };
    return {
      arms: { ...swordArmsOf(wood, { offset: this.offset, frame: { ...L.frame }, setup: setup(wood) }), glow: glow(L.materials.wood) },
      ironArms: { ...swordArmsOf(iron, { offset: this.offset, frame: { ...L.frame }, setup: setup(iron) }), glow: glow(L.materials.iron) },
      swim: this.swimArms(swim),
    };
  }

  /** a Model Explorer card: the arms at rest holding `kind`, on their own skeleton clone, in camera space as held */
  async specimen(sky: Sky, kind: Sword): Promise<Object3D> {
    const L = this.look;
    const rig = await RigArms.load(L.url, this.contract, this.bake);
    rig.weapon(kind);
    this.dressHeld(sky, rig);
    rig.update(0.4, { speed: 0, lookVel: new Vector2() });
    return rig.root;
  }
}

/** the rig's three meshes: the arms and the two swords (one primitive each) */
function armMeshes(rig: RigArms): Mesh[] {
  const meshes = rig.meshes();
  if (meshes.length !== 3) throw new Error('Unexpected toon arm mesh count');
  return meshes;
}

/** the GLB's per-vertex metalness (`_METAL`, three's `_metal`) under the graph attribute name `aMetal`: the same buffer, on
 *  the parse's one geometry the skeleton clones share */
function bindMetal(geometry: BufferGeometry): void {
  if (!geometry.hasAttribute('_metal')) return;
  geometry.setAttribute('aMetal', geometry.getAttribute('_metal'));
  geometry.deleteAttribute('_metal');
}
