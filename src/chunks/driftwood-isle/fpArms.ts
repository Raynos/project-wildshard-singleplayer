// Driftwood Isle's first-person arms (E334, DRIFTWOOD-TOP10 row 12; Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke" — art/driftwood-fp/round-1-remaster/): sun-browned hands with fingers round a hemp-cord grip,
// patched linen sleeves rolled to mid-forearm, the off hand in frame, both swords on the same arms, and the same arms
// swimming.
//
// The rig is public/assets/models/driftwood-fp/fp-arms.glb, built by scripts/blender/driftwood-isle/fp-arms/ (a Blender
// script models the arms and swords round Nine Dragon's round-13 skeleton; bake.mjs keeps that skeleton and its 16 clips —
// the engine's SwordMoves timing — adds 15 finger bones a hand and the swim clips, and skins it). It is played by the
// shared arm player (src/player/rigArms.ts): three skeleton clones of one parse — the wooden sword, the iron sword and the
// swimming hands — sharing the geometry. Driftwood's toon look: flat facets, vertex colour, no textures, lit like the
// island (sky.setupMaterial: the CSM shadows and the fog). ~9.5 k triangles of arms + ~0.8 k of sword, two draws + the
// engine's trail.
import { MeshStandardMaterial, type Object3D, type PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { ShardSword } from '../ChunkDef';
import type { Sky } from '../../world/Sky';
import { RigArms, swordArmsOf, vmScale } from '../../player/rigArms';
import { attachFogUniforms } from '../../world/Atmosphere';
import type { SwimArms } from '../../player/Hands';

export const FP_ARMS_URL = '/assets/models/driftwood-fp/fp-arms.glb';

/** the framing, in canonical rig units: Nine Dragon's rest holds the fist at the frame's right edge; the castaway board
 *  (2 A) has it a little in from it and low, the blade's tip below-right of the crosshair (E129's height) */
const OFFSET = new Vector3(-0.03, -0.012, 0);
/** …and on the screen (rigArms VmFrame): board 2 A holds the pair smaller than Nine Dragon's rest — the sword hand low
 *  right of centre, the off hand low left, the blade's tip below-right of the crosshair */
const FRAME = { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 };

/** the toon material: flat facets, the vertex colours; `metal` reads a per-vertex metalness (the iron blade and guard; 0.6 at most, the code-built iron sword's) */
function toonMaterial(sky: Sky, name: string, metal: boolean): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: metal ? 0.6 : 0.85, metalness: metal ? 0.6 : 0, envMapIntensity: 0.6 });
  m.name = name;
  if (metal) {
    m.onBeforeCompile = (sh) => {
    attachFogUniforms(sh); // an own hook replaces Material.prototype's, which binds the fog + toon uniforms (Atmosphere.ts): unbound, the ramp fog reads 0 → the whole mesh the fog's colour
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float _metal;\nvarying float vMetal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetal = _metal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vMetal;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vMetal;');
    };
    m.customProgramCacheKey = () => 'driftwood-fp-metal';
  }
  sky.setupMaterial(m);
  return m;
}

/** the swimming arms' material: the toon one, and the water line — below it the arms take the sea's tint and darken with
 *  depth, a thin band of foam rides it (board 3 A) */
function swimMaterial(sky: Sky, water: { n: { value: Vector3 }; d: { value: number } }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.6 });
  m.name = 'driftwood-fp-swim';
  m.onBeforeCompile = (sh) => {
    attachFogUniforms(sh); // an own hook replaces Material.prototype's, which binds the fog + toon uniforms (Atmosphere.ts): unbound, the ramp fog reads 0 → the whole mesh the fog's colour
    sh.uniforms['uWaterN'] = water.n;
    sh.uniforms['uWaterD'] = water.d;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVmPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvVmPos = mvPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uWaterN;\nuniform float uWaterD;\nvarying vec3 vVmPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float hWater = dot(uWaterN, vVmPos) - uWaterD;
        float under = 1.0 - smoothstep(-0.003, 0.003, hWater);
        vec3 sea = diffuseColor.rgb * vec3(0.38, 0.78, 0.86) * (1.0 - clamp(-hWater * 1.6, 0.0, 0.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, sea, under * 0.9);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.62, 0.74, 0.78) * (1.0 - smoothstep(0.002, 0.011, abs(hWater)));`);
  };
  m.customProgramCacheKey = () => 'driftwood-fp-swim';
  sky.setupMaterial(m);
  return m;
}

/** the arms' and the two swords' materials: made once (both swords' rigs share them) */
interface Dress { arms: MeshStandardMaterial; wood: MeshStandardMaterial; iron: MeshStandardMaterial }
function dress(rig: RigArms, m: Dress): void {
  for (const mesh of rig.meshes()) {
    mesh.material = mesh.name === 'sword_iron' ? m.iron : mesh.name === 'sword_wood' ? m.wood : m.arms;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData['treatAsOpaque'] = true; // out of the AO's transparency pre-pass (the viewmodel queue's depth clear keeps the world's depth behind it)
  }
}

/** the swimming hands on the rig (Hands.ts): the swim clips, the projection, the water line */
function swimArms(rig: RigArms): SwimArms {
  const water = { n: { value: new Vector3(0, 1, 0) }, d: { value: -0.16 } };
  const waterY = rig.meta.water?.y ?? -0.16;
  const q = new Quaternion(), up = new Vector3();
  rig.weapon(null);
  return {
    root: rig.root,
    setup: (sky) => {
      const m = swimMaterial(sky, water);
      for (const mesh of rig.meshes()) { mesh.material = m; mesh.castShadow = false; mesh.receiveShadow = true; }
    },
    update: (dt, s: { stroke: number; phase: number; camera: PerspectiveCamera; eyeAbove: number }) => {
      const k = vmScale(s.camera.fov);
      rig.root.scale.set(k, k, 1);
      rig.root.position.set(0, 0, 0);
      rig.swim(dt, s.stroke, s.phase);
      // the water plane in view space: the world's up turned into the camera (a third of the pitch: the arms are held to the
      // surface, not to the head), at the height the clips were framed on (scaled by the projection) — every point under
      // it when the eye itself is under the surface
      up.set(0, 1, 0).applyQuaternion(s.camera.getWorldQuaternion(q).invert());
      water.n.value.set(up.x * 0.35, 1, up.z * 0.35).normalize();
      water.d.value = s.eyeAbove < 0.02 ? 50 : waterY * k;
    },
  };
}

/** the rigs, loaded as ChunkDef.sword: the wooden sword's arms, the iron sword's, the swimming hands */
export async function castawayArms(): Promise<ShardSword> {
  const [wood, iron, swim] = await Promise.all([RigArms.load(FP_ARMS_URL), RigArms.load(FP_ARMS_URL), RigArms.load(FP_ARMS_URL, true)]);
  wood.weapon('wood');
  iron.weapon('iron');
  let mats: Dress | null = null;
  const setup = (rig: RigArms) => (sky: Sky): void => {
    mats ??= { arms: toonMaterial(sky, 'driftwood-fp-arms', false), wood: toonMaterial(sky, 'driftwood-fp-wood', false), iron: toonMaterial(sky, 'driftwood-fp-iron', true) };
    dress(rig, mats);
  };
  return {
    arms: swordArmsOf(wood, { offset: OFFSET, frame: FRAME, setup: setup(wood) }),
    ironArms: swordArmsOf(iron, { offset: OFFSET, frame: { ...FRAME }, setup: setup(iron) }),
    swim: swimArms(swim),
  };
}

/** the Model Explorer's card (driftwood-isle/models/gear.ts): the castaway arms at rest holding `kind`, on their own
 *  skeleton clone of the one parse (the held rigs' geometry), in camera space as held — the eye at the origin, −Z forward */
export async function castawaySpecimen(sky: Sky, kind: 'wood' | 'iron'): Promise<Object3D> {
  const rig = await RigArms.load(FP_ARMS_URL);
  rig.weapon(kind);
  dress(rig, { arms: toonMaterial(sky, 'driftwood-fp-arms', false), wood: toonMaterial(sky, 'driftwood-fp-wood', false), iron: toonMaterial(sky, 'driftwood-fp-iron', true) });
  rig.update(0.4, { speed: 0, lookVel: new Vector2() });
  return rig.root;
}
