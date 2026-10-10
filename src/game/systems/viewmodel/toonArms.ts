/**
 * Toon first-person arms as a viewmodel system (SHARD-PLATFORM M3): a skinned arms rig (a GLB the shared arm player
 * `RigArms` plays) dressed in flat-faceted vertex-colour materials lit like the world (the sky rig's shadows and fog), held
 * with two swords (wood and iron, each blade's edges lit by a glow level) and the same arms swimming with a water line.
 * Nothing here knows a shard: the shard passes its look row (the rig's file and skeleton, the framing, the blades, the
 * swim water line, the material settings, the patch ids and names) and its GLSL rows (spliced with the shared
 * `ShaderFamily`: `@{SUNWARD}`, the blade's `@{DQ_S}` / `@{DQ_Y}` / `@{BASE}` / `@{BASE_END}` / `@{HALF_W}` / `@{TAPER}`,
 * which this system passes).
 *
 *   const arms = new ToonArms(look, glsl);
 *   sword: async () => arms.load()           // ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands
 *   arms.specimen(sky, 'iron')               // the Model Explorer's card: the arms at rest holding a sword
 *
 * - **toon material**: flat facets, vertex colours; the arms look their shadow up `sunward` metres toward the light (so the
 *   invisible body never shades them); a sword's material may read a per-vertex metalness (`_metal`) and light its blade's
 *   edges with the glow colour.
 * - **swim material**: below a view-space water plane (the world's up turned a third into the camera, through the hands,
 *   tipped `tilt` toward the eye) the arms take the shard's sea tint; a thin foam band rides the line.
 */
import type { RigBake, RigContract } from '@wildshard/engine/anim/rig';
import type { SwimArms } from '@wildshard/engine/player/Hands';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { Color, MeshStandardMaterial, type Object3D, type PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { ShardSword } from '../../shard/manifest';
import { ShaderFamily } from '../looks/shaderFamily';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from './armClips';
import { RigArms, swordArmsOf, vmScale } from './rigArms';

type Vec3 = readonly [number, number, number];
type Sword = 'wood' | 'iron';

/** the arms' GLSL rows: each the text one of three's chunks is replaced with */
export interface ToonArmsGlsl {
  readonly shadowCommon: string; readonly shadowLookup: string;
  readonly metalVertexCommon: string; readonly metalVertexBegin: string; readonly metalFragmentCommon: string; readonly metalFragmentMetalness: string;
  readonly bladeVertexCommon: string; readonly bladeVertexBegin: string; readonly bladeFragmentCommon: string; readonly bladeEmissive: string;
  readonly swimVertexCommon: string; readonly swimProject: string; readonly swimFragmentCommon: string; readonly swimColor: string; readonly swimEmissive: string;
}

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
  /** the blade glow's colour (sRGB hex) */
  readonly glow: number;
  /** each blade's half-width at the guard end and its taper (m per m); the blade's base when the rig's meta has none */
  readonly blades: { readonly wood: { readonly halfW: number; readonly taper: number }; readonly iron: { readonly halfW: number; readonly taper: number } };
  readonly bladeBase: number;
  /** the swim water line: the tip toward the eye, the hands' depth (m, view space), the line's height when the rig's meta
   *  has none, and its plane offset to start */
  readonly swim: { readonly tilt: number; readonly handsZ: number; readonly waterY: number; readonly startD: number };
  /** the materials' roughness (toon, metal), metalness and env-map intensity */
  readonly material: { readonly rough: number; readonly metalRough: number; readonly metal: number; readonly env: number };
  /** the patch ids (arms, swim), the cache keys' and the material names' prefix */
  readonly patch: { readonly arms: string; readonly swim: string };
  readonly prefix: string;
}

/** a blade's glow: `dq` is the sword mesh's own node transform (the GLB's positions are quantized; the shader restores
 *  weapon-local metres) */
interface BladeRim { rim: { value: number }; base: number; halfW: number; taper: number; dq: { y: number; s: number } }
interface Dress { arms: MeshStandardMaterial; wood: MeshStandardMaterial; iron: MeshStandardMaterial }

const CLIPS = { ...ARM_CLIPS, ...SWIM_CLIPS };

export class ToonArms {
  readonly contract: RigContract;
  readonly bake: RigBake;
  private readonly family: ShaderFamily;
  private readonly offset: Vector3;
  private readonly glowColour: Color;

  constructor(private readonly look: ToonArmsLook, private readonly glsl: ToonArmsGlsl) {
    const j = look.joints;
    this.contract = { skeleton: look.skeleton, clips: armClipNames(CLIPS), sockets: [...look.sockets] };
    this.bake = {
      skeleton: look.skeleton, clips: CLIPS,
      joints: [j.sides.flatMap((side) => [...j.arm].concat(
        j.fingers.flatMap((finger) => Array.from({ length: j.phalanges }, (_, i) => i + 1).map((i) => `${finger}${i}`)),
      ).map((name) => `${side}_${name}`))],
    };
    this.family = new ShaderFamily({ ...glsl }, {});
    this.offset = new Vector3(look.offset[0], look.offset[1], look.offset[2]);
    this.glowColour = new Color(look.glow);
  }

  /** the toon material; `metal` reads a per-vertex metalness, `blade` lights a sword's edges */
  private toonMaterial(sky: Sky, name: string, metal: boolean, blade?: BladeRim): MeshStandardMaterial {
    const L = this.look, mat = L.material, g = this.glsl, family = this.family;
    const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: metal ? mat.metalRough : mat.rough, metalness: metal ? mat.metal : 0, envMapIntensity: mat.env });
    m.name = name;
    const lightDir = sky.csm.lightDirection; // the one vector the day / night clock copies the sun (or the moon) into
    const f = (x: number): string => x.toFixed(4);
    patchShader(m, L.patch.arms, PATCH_ORDER.material, (sh) => {
      attachFogUniforms(sh); // an own hook replaces Material.prototype's, which binds the fog uniforms: unbound, the fog reads 0
      sh.uniforms['uVmLightDir'] = { value: lightDir };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', family.glsl(g.shadowCommon))
        .replace('#include <shadowmap_vertex>', family.glsl(g.shadowLookup, { SUNWARD: f(L.sunward) }));
      if (metal) {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', family.glsl(g.metalVertexCommon))
          .replace('#include <begin_vertex>', family.glsl(g.metalVertexBegin));
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', family.glsl(g.metalFragmentCommon))
          .replace('#include <metalnessmap_fragment>', family.glsl(g.metalFragmentMetalness));
      }
      if (blade) {
        sh.uniforms['uRim'] = blade.rim;
        sh.uniforms['uRimAqua'] = { value: this.glowColour };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', family.glsl(g.bladeVertexCommon))
          .replace('#include <begin_vertex>', family.glsl(g.bladeVertexBegin, { DQ_S: f(blade.dq.s), DQ_Y: f(blade.dq.y) }));
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', family.glsl(g.bladeFragmentCommon))
          .replace('#include <emissivemap_fragment>', family.glsl(g.bladeEmissive, { BASE: f(blade.base), BASE_END: f(blade.base + 0.03), HALF_W: f(blade.halfW), TAPER: f(blade.taper) }));
      }
    }, { mode: 'replace', key: `${L.prefix}-${metal ? 'metal' : 'toon'}${blade ? '-blade' : ''}` });
    if (blade) m.userData['rim'] = blade.rim; // a cost capture turns it off and on
    sky.setupMaterial(m);
    return m;
  }

  /** the swimming arms' material: the toon one, and the water line */
  private swimMaterial(sky: Sky, water: { n: { value: Vector3 }; d: { value: number } }): MeshStandardMaterial {
    const L = this.look, g = this.glsl, family = this.family;
    const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: L.material.rough, metalness: 0, envMapIntensity: L.material.env });
    m.name = `${L.prefix}-swim`;
    patchShader(m, L.patch.swim, PATCH_ORDER.material, (sh) => {
      attachFogUniforms(sh); // an own hook replaces Material.prototype's, which binds the fog uniforms: unbound, the fog reads 0
      sh.uniforms['uWaterN'] = water.n;
      sh.uniforms['uWaterD'] = water.d;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', family.glsl(g.swimVertexCommon))
        .replace('#include <project_vertex>', family.glsl(g.swimProject));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', family.glsl(g.swimFragmentCommon))
        .replace('#include <color_fragment>', family.glsl(g.swimColor))
        .replace('#include <emissivemap_fragment>', family.glsl(g.swimEmissive));
    }, { mode: 'replace', key: `${L.prefix}-swim` });
    sky.setupMaterial(m);
    return m;
  }

  /** the swimming hands on the rig (Hands.ts): the swim clips, the projection, the water line */
  private swimArms(rig: RigArms): SwimArms {
    const S = this.look.swim;
    const water = { n: { value: new Vector3(0, 1, 0) }, d: { value: S.startD } };
    const waterY = rig.meta.water?.y ?? S.waterY;
    const q = new Quaternion(), up = new Vector3();
    rig.weapon(null);
    return {
      root: rig.root,
      setup: (sky) => {
        const m = this.swimMaterial(sky, water);
        for (const mesh of rig.meshes()) { mesh.material = m; mesh.castShadow = false; mesh.receiveShadow = true; }
      },
      update: (dt, s: { stroke: number; phase: number; camera: PerspectiveCamera; eyeAbove: number }) => {
        const k = vmScale(s.camera.fov);
        rig.root.scale.set(k, k, 1);
        rig.root.position.set(0, 0, 0);
        rig.swim(dt, s.stroke, s.phase);
        // the water plane in view space: the world's up turned into the camera (a third of the pitch: the arms are held to
        // the surface, not to the head), through the hands at the height the clips were framed on (scaled by the
        // projection), and tipped up toward the eye so the forearms in the lower corners ride above it — every point under
        // it when the eye itself is under the surface
        up.set(0, 1, 0).applyQuaternion(s.camera.getWorldQuaternion(q).invert());
        water.n.value.set(up.x * 0.35, 1, up.z * 0.35 + S.tilt).normalize();
        water.d.value = s.eyeAbove < 0.02 ? 50 : water.n.value.y * waterY * k + water.n.value.z * S.handsZ;
      },
    };
  }

  /** the three materials, each sword's with its own glow level */
  private materials(sky: Sky, rig: RigArms, rims: { wood: { value: number }; iron: { value: number } }): Dress {
    const L = this.look, p = L.prefix;
    const blade = (kind: Sword): BladeRim => {
      const node = rig.nodes.get(`sword_${kind}`);
      const dq = { y: node?.position.y ?? 0, s: node?.scale.x ?? 1 };
      return { rim: rims[kind], base: rig.meta.swords[kind]?.bladeBase ?? L.bladeBase, halfW: L.blades[kind].halfW, taper: L.blades[kind].taper, dq };
    };
    return { arms: this.toonMaterial(sky, `${p}-arms`, false), wood: this.toonMaterial(sky, `${p}-wood`, false, blade('wood')), iron: this.toonMaterial(sky, `${p}-iron`, true, blade('iron')) };
  }

  /** the rigs, loaded as ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands */
  async load(): Promise<ShardSword> {
    const L = this.look;
    const [wood, iron, swim] = await Promise.all([RigArms.load(L.url, this.contract, this.bake), RigArms.load(L.url, this.contract, this.bake), RigArms.load(L.url, this.contract, this.bake, true)]);
    wood.weapon('wood');
    iron.weapon('iron');
    let mats: Dress | null = null;
    const rims = { wood: { value: 0 }, iron: { value: 0 } };
    const setup = (rig: RigArms) => (sky: Sky): void => {
      mats ??= this.materials(sky, rig, rims);
      dress(rig, mats);
    };
    /** the held blade's glow: its edges lit */
    const glow = (rim: { value: number }) => (level: number): void => { rim.value = level; };
    return {
      arms: { ...swordArmsOf(wood, { offset: this.offset, frame: { ...L.frame }, setup: setup(wood) }), glow: glow(rims.wood) },
      ironArms: { ...swordArmsOf(iron, { offset: this.offset, frame: { ...L.frame }, setup: setup(iron) }), glow: glow(rims.iron) },
      swim: this.swimArms(swim),
    };
  }

  /** a Model Explorer card: the arms at rest holding `kind`, on their own skeleton clone, in camera space as held */
  async specimen(sky: Sky, kind: Sword): Promise<Object3D> {
    const L = this.look;
    const rig = await RigArms.load(L.url, this.contract, this.bake);
    rig.weapon(kind);
    dress(rig, this.materials(sky, rig, { wood: { value: 0 }, iron: { value: 0 } }));
    rig.update(0.4, { speed: 0, lookVel: new Vector2() });
    return rig.root;
  }
}

/** the arms' and the two swords' materials on a rig */
function dress(rig: RigArms, m: Dress): void {
  for (const mesh of rig.meshes()) {
    mesh.material = mesh.name === 'sword_iron' ? m.iron : mesh.name === 'sword_wood' ? m.wood : m.arms;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData['treatAsOpaque'] = true; // out of the AO's transparency pre-pass (the viewmodel queue's depth clear keeps the world's depth behind it)
  }
}
