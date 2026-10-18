/** Client-only toon held arms. Rows identify the rig, sockets, materials and shared day-light state.
 * Preparation resolves graphs under the platform context; the host owns its day uniforms and native rig loader.
 * The day backdrop and held meshes resolve the same lighting identity.
 */
import type { RigBake, RigContract } from '@wildshard/engine/anim/rig';
import type { SwimArms } from '@wildshard/engine/player/Hands';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { toonLighting } from '../../looks/toonLighting';
import type { ToonLookUniforms } from '@wildshard/engine/render/families/toon';
import { runtimeLookMaterials } from '../../shardfile/runtimeProduct';
import type { ShardContext } from '../../plugin/context';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { ShardProduct } from '../../shardfile/shardProduct';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import { parseToonArmsLook, type ToonArmsLook } from '@wildshard/format/heldArms';
import { type BufferGeometry, type Material, type Mesh, type Object3D, type PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { ShardSword } from '../../shard/manifest';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from './armClips';
import { RigArms, swordArmsOf, vmScale } from './rigArms';

type Sword = 'wood' | 'iron';

type ToonArmsRig = Pick<RigArms, 'root' | 'nodes' | 'meta' | 'weapon' | 'meshes' | 'update' | 'swim' | 'play' | 'blade'>;
type Looks = Awaited<ReturnType<typeof runtimeLookMaterials>>;
const catalogues = new Map<string, ToonArms>();
interface Loan { readonly looks: Looks; readonly light: { readonly source: ReturnType<typeof toonLighting>;
  readonly target: Pick<ToonLookUniforms, 'famToonLift' | 'famToonRim' | 'famToonCloud' | 'famToonWater' | 'famToonTime'> } }
function followLight(loan: Loan): void {
  const u = loan.light.source, t = loan.light.target;
  t.famToonLift.value.copy(u.uToonLift.value); t.famToonRim.value.copy(u.uToonRim.value);
  t.famToonCloud.value.x = u.uCloudShadow.value; t.famToonWater.value.x = u.uSeaLevel.value; t.famToonTime.value = u.uCloudTime.value;
}

const CLIPS = { ...ARM_CLIPS, ...SWIM_CLIPS };

/** Toon first-person arms: a skinned rig with two swords and swimming hands, dressed from a shard's ToonArmsLook row. */
export class ToonArms {
  readonly contract: RigContract;
  readonly bake: RigBake;
  private readonly offset: Vector3;
  /** the live loans, newest last (each scope removes its own) */
  private readonly loans: Loan[] = [];

  private readonly look: ToonArmsLook;

  constructor(input: unknown) {
    const look = parseToonArmsLook(input);
    this.look = look;
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

  /** Explicit row admission also serves a manifest's lazy sword provider before the kit stage. */
  static admit(input: unknown): ToonArms {
    const row = parseToonArmsLook(input), ready = catalogues.get(row.id);
    if (ready !== undefined) return ready;
    const host = new ToonArms(row); catalogues.set(row.id, host); return host;
  }

  /** A material by declared identity, resolved only after the host's scoped preparation. */
  materialById(id: string): Material { return this.material(this.loan(), id); }

  /** The day clock and held meshes resolve the same lighting identity, initialized only from rows. */
  static lighting(input: unknown): ReturnType<typeof toonLighting> {
    return toonLighting(parseToonArmsLook(input).lighting);
  }

  /** Client-only preparation: resolve material ids and day lighting inside the host's platform scope. */
  async prepare(context: ShardContext): Promise<ReadonlyMap<string, Material>> {
    const looks = await runtimeLookMaterials(context, context.product.shardfile, true, Object.values(this.look.materials));
    return this.keepLooks(context.scope, looks);
  }

  /** A standalone arena lends only its renderer, lifetime and admitted product. */
  async prepareProduct(context: Parameters<typeof runtimeLookMaterials>[0], product: ShardProduct): Promise<ReadonlyMap<string, Material>> {
    const looks = await runtimeLookMaterials(context, product.shardfile, true, Object.values(this.look.materials));
    return this.keepLooks(context.scope, looks);
  }

  /** Cold Explorer preparation uses its standard platform context and the same admitted look ids. */
  async prepareExplorer(context: ModelContext, product: ShardProduct): Promise<void> {
    if (this.loans.length > 0) return;
    if (context.renderer === null) throw new Error('Held arms Explorer needs its renderer');
    const scope = resourceScope().child('held-arm-explorer');
    const looks = await runtimeLookMaterials({ scope, renderer: context.renderer }, product.shardfile, true, Object.values(this.look.materials));
    this.keepLooks(scope, looks);
  }

  private keepLooks(scope: Scope, looks: Looks): ReadonlyMap<string, Material> {
    if (scope.disposed) throw new Error('Toon arm scope unloaded during preparation');
    const ids = this.look.materials;
    const missing = [ids.arms, ids.wood, ids.iron, ids.swim].filter((id) => !looks.materials.has(id));
    if (missing.length > 0) throw new Error(`Toon arms: look.materials lacks ${missing.join(', ')}`);
    const loan: Loan = { looks, light: { source: ToonArms.lighting(this.look), target: looks.toon.uniforms } };
    this.loans.push(loan);
    scope.onDispose(() => { const at = this.loans.indexOf(loan); if (at !== -1) this.loans.splice(at, 1); });
    return looks.materials;
  }

  private loan(): Loan {
    const loan = this.loans.at(-1);
    if (loan === undefined) throw new Error('Toon arms: no graph materials prepared (prepare the context before dressing arms)');
    return loan;
  }

  private material(loan: Loan, id: string): Material {
    const m = loan.looks.materials.get(id);
    if (m === undefined) throw new Error(`Toon arms: look.materials lacks ${id}`);
    return m;
  }

  /** the held materials on a rig: the swords' blade params, and once a frame (the arms' draw) the toon look's follow and
   *  the shadow lookup toward the light */
  private dressHeld(sky: Sky, rig: ToonArmsRig): void {
    const L = this.look, ids = L.materials, loan = this.loan(), set = loan.looks.setParam;
    for (const kind of ['wood', 'iron'] as const) {
      const node = rig.nodes.get(`sword_${kind}`);
      set(ids[kind], 'bladeDq', [node?.scale.x ?? 1, node?.position.y ?? 0]);
      set(ids[kind], 'bladeBase', rig.meta.swords[kind]?.bladeBase ?? L.bladeBase);
    }
    const lightDir = sky.csm.lightDirection; // the one vector the day / night clock copies the sun (or the moon) into
    const sunward = [0, 0, 0];
    const frame = (): void => {
      followLight(loan);
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
  private swimArms(rig: ToonArmsRig): SwimArms {
    const S = this.look.swim, id = this.look.materials.swim;
    const n = new Vector3(0, 1, 0), plane = [0, 1, 0];
    const waterY = rig.meta.water?.y ?? S.waterY;
    const q = new Quaternion(), up = new Vector3();
    let set: Looks['setParam'] | null = null;
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
          if (mesh.name !== 'sword_iron' && mesh.name !== 'sword_wood') mesh.onBeforeRender = () => { followLight(loan); };
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
    const setup = (rig: ToonArmsRig) => (sky: Sky): void => { this.dressHeld(sky, rig); };
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
function armMeshes(rig: ToonArmsRig): Mesh[] {
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
