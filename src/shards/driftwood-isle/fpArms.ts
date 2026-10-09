import type { RigContract, RigBake } from '@wildshard/engine/anim/rig';
import type { SwimArms } from '@wildshard/engine/player/Hands';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from '@wildshard/game/systems/viewmodel/armClips';
import { RigArms, swordArmsOf, vmScale } from '@wildshard/game/systems/viewmodel/rigArms';
// Driftwood Isle's first-person arms (E334, DRIFTWOOD-TOP10 row 12; Jake's picks 2026-09-30: board 2 A "castaway",
// board 3 A "breaststroke" — art/driftwood-fp/round-1-remaster/): sun-browned hands with fingers round a hemp-cord grip,
// patched linen sleeves rolled to mid-forearm, the off hand in frame, both swords on the same arms, and the same arms
// swimming.
//
// The rig is public/assets/models/driftwood-fp/fp-arms.glb, built by scripts/blender/driftwood-isle/fp-arms/ (a Blender
// script models the arms and swords round Nine Dragon's round-13 skeleton; bake.mjs keeps that skeleton and its 16 clips —
// the engine's SwordMoves timing — adds 15 finger bones a hand and the swim clips, and skins it). It is played by the
// shared arm player (src/game/systems/viewmodel/rigArms.ts): three skeleton clones of one parse — the wooden sword, the iron sword and the
// swimming hands — sharing the geometry. Driftwood's toon look: flat facets, vertex colour, no textures, lit like the
// island (sky.setupMaterial: the CSM shadows and the fog). ~9.5 k triangles of arms + ~0.8 k of sword, two draws + the
// engine's trail.
import { Color, MeshStandardMaterial, type Object3D, type PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';
import type { ShardSword } from '@wildshard/game/shard/manifest';

const CLIPS = { ...ARM_CLIPS, ...SWIM_CLIPS };
export const FP_ARMS_CONTRACT: RigContract = { skeleton: 'driftwood-fp', clips: armClipNames(CLIPS), sockets: ['R_weapon', 'L_hand'] };
export const FP_ARMS_BAKE: RigBake = {
  skeleton: 'driftwood-fp', clips: CLIPS,
  joints: [['R', 'L'].flatMap((side) => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].concat(
      ['thumb', 'index', 'middle', 'ring', 'pinky'].flatMap((finger) => [1, 2, 3].map((i) => `${finger}${i}`)),
    ).map((name) => `${side}_${name}`))],
};

export const FP_ARMS_URL = '/assets/models/driftwood-fp/fp-arms.glb';

/** the framing, in canonical rig units: Nine Dragon's rest holds the fist at the frame's right edge; the castaway board
 *  (2 A) has it a little in from it and low, the blade's tip below-right of the crosshair (E129's height) */
const OFFSET = new Vector3(-0.03, -0.012, 0);
/** …and on the screen (rigArms VmFrame): board 2 A holds the pair smaller than Nine Dragon's rest — the sword hand low
 *  right of centre, the off hand low left, the blade's tip below-right of the crosshair */
const FRAME = { size: 0.6, pitch: -0.2, yaw: 0, roll: 0 };

/** Jake's look review (2026-09-30): the body shadow (src/engine/player/BodyShadow.ts) must not shade the arms and the sword. The
 *  viewmodel sits at the eye, inside that invisible figure, so at a low sun behind you its head and shoulders stood between
 *  the sun and the hands. The arms look their shadow up VM_SUNWARD metres toward the light instead of where they are:
 *  anything nearer the arms than that on the light's side (the body: ≤ ~0.9 m from the hands at a grazing sun) is behind
 *  the lookup and casts nothing on them, while the world's shadows (a palm's crown, the hut's eave, a cliff) still fall
 *  on them as before. One vec3 add in the vertex shader: no pass, no draw. */
const VM_SUNWARD = 1.2;

/** the charm III glow on the held blade (E314 / Jake's review: "a soft glow + halo — the blade keeps its own colour with an
 *  aqua edge"): the sea-glass aqua added as light along the blade's two edges (the outer 30 % of its half-width); `level` 0 = off */
const GLOW_AQUA = new Color(0x5fe6d8);
/** `dq`: the sword mesh's own node transform (y offset, uniform scale) — the GLB's positions are quantized
 *  (KHR_mesh_quantization: normalised integers, the node scales them back), so the shader restores weapon-local metres */
interface BladeRim { rim: { value: number }; base: number; halfW: number; taper: number; dq: { y: number; s: number } }

/** the toon material: flat facets, the vertex colours, the arms' shadow lookup (VM_SUNWARD); `metal` reads a per-vertex
 *  metalness (the iron blade and guard; 0.6 at most, the code-built iron sword's); `blade` (a sword: weapon-local positions,
 *  +y along the blade from the guard, ±x its edges) lights its edges with charm III's glow: the blade's base (y), its
 *  half-width there and the taper (m per m) */
function toonMaterial(sky: Sky, name: string, metal: boolean, blade?: BladeRim): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: metal ? 0.6 : 0.85, metalness: metal ? 0.6 : 0, envMapIntensity: 0.6 });
  m.name = name;
  const lightDir = sky.csm.lightDirection; // the one vector the day / night clock copies the sun (or the moon) into (lowpolyKit.ts)
  const f = (x: number): string => x.toFixed(4);
  patchShader(m, 'driftwood.fp-arms', PATCH_ORDER.material, (sh) => {
    attachFogUniforms(sh); // an own hook replaces Material.prototype's, which binds the fog + toon uniforms (Atmosphere.ts): unbound, the ramp fog reads 0 → the whole mesh the fog's colour
    sh.uniforms['uVmLightDir'] = { value: lightDir };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uVmLightDir;')
      .replace('#include <shadowmap_vertex>', `vec4 vmWorldPos = worldPosition;\nworldPosition.xyz -= uVmLightDir * ${f(VM_SUNWARD)};\n#include <shadowmap_vertex>\nworldPosition = vmWorldPos;`);
    if (metal) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float _metal;\nvarying float vMetal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetal = _metal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vMetal;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vMetal;');
    }
    if (blade) {
      sh.uniforms['uRim'] = blade.rim;
      sh.uniforms['uRimAqua'] = { value: GLOW_AQUA };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBlade;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvBlade = vec2(abs(position.x * ${f(blade.dq.s)}), position.y * ${f(blade.dq.s)} + ${f(blade.dq.y)});`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimAqua;\nvarying vec2 vBlade;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uRim > 0.0) {
          float onBlade = smoothstep(${f(blade.base)}, ${f(blade.base + 0.03)}, vBlade.y);
          float halfW = max(0.003, ${f(blade.halfW)} - ${f(blade.taper)} * (vBlade.y - ${f(blade.base)}));
          float edge = smoothstep(0.7, 1.0, vBlade.x / halfW);
          totalEmissiveRadiance += uRimAqua * (uRim * onBlade * 1.3 * edge);
        }`);
    }
  }, { mode: 'replace', key: `driftwood-fp-${metal ? 'metal' : 'toon'}${blade ? '-blade' : ''}` });
  if (blade) m.userData['rim'] = blade.rim; // the cost capture (scripts/e334-look-review-capture.mjs --measure) turns it off and on
  sky.setupMaterial(m);
  return m;
}

/** the swimming arms' material: the toon one, and the water line — below it the arms take the sea's tint and darken with
 *  depth, a thin band of foam rides it (board 3 A) */
function swimMaterial(sky: Sky, water: { n: { value: Vector3 }; d: { value: number } }): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.6 });
  m.name = 'driftwood-fp-swim';
  patchShader(m, 'driftwood.fp-swim', PATCH_ORDER.material, (sh) => {
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
  }, { mode: 'replace', key: 'driftwood-fp-swim' });
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

/** the swim water line's tip toward the eye (m of rise per m nearer; Jake's review 2026-09-30: "the sleeves above the
 *  water while swimming"), about the hands' depth (m ahead of the eye, view space) — the stroke's wrists run −0.43 … −0.62 */
const SWIM_TILT = 1.1, SWIM_HANDS_Z = -0.5;

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
      // surface, not to the head), through the hands at the height the clips were framed on (scaled by the projection), and
      // tipped up toward the eye (SWIM_TILT) so the forearms and the rolled sleeves in the lower corners ride above it and
      // the water line crosses at the wrists (board 3 A) — every point under it when the eye itself is under the surface
      up.set(0, 1, 0).applyQuaternion(s.camera.getWorldQuaternion(q).invert());
      water.n.value.set(up.x * 0.35, 1, up.z * 0.35 + SWIM_TILT).normalize();
      water.d.value = s.eyeAbove < 0.02 ? 50 : water.n.value.y * waterY * k + water.n.value.z * SWIM_HANDS_Z;
    },
  };
}

/** the swords' blades as arms.py models them (weapon-local): the half-width at the guard end and its taper per metre */
const BLADES = { wood: { halfW: 0.040, taper: 0.009 / 0.52 }, iron: { halfW: 0.026, taper: 0.006 / 0.56 } } as const;

/** the three materials, each sword's with its own charm III edge level */
function materials(sky: Sky, rig: RigArms, rims: { wood: { value: number }; iron: { value: number } }): Dress {
  const blade = (kind: 'wood' | 'iron'): BladeRim => {
    const node = rig.nodes.get(`sword_${kind}`);
    const dq = { y: node?.position.y ?? 0, s: node?.scale.x ?? 1 };
    return { rim: rims[kind], base: rig.meta.swords[kind]?.bladeBase ?? 0.012, ...BLADES[kind], dq };
  };
  return { arms: toonMaterial(sky, 'driftwood-fp-arms', false), wood: toonMaterial(sky, 'driftwood-fp-wood', false, blade('wood')), iron: toonMaterial(sky, 'driftwood-fp-iron', true, blade('iron')) };
}

/** the rigs, loaded as ShardManifest.sword: the wooden sword's arms, the iron sword's, the swimming hands */
export async function castawayArms(): Promise<ShardSword> {
  const [wood, iron, swim] = await Promise.all([RigArms.load(FP_ARMS_URL, FP_ARMS_CONTRACT, FP_ARMS_BAKE), RigArms.load(FP_ARMS_URL, FP_ARMS_CONTRACT, FP_ARMS_BAKE), RigArms.load(FP_ARMS_URL, FP_ARMS_CONTRACT, FP_ARMS_BAKE, true)]);
  wood.weapon('wood');
  iron.weapon('iron');
  let mats: Dress | null = null;
  const rims = { wood: { value: 0 }, iron: { value: 0 } };
  const setup = (rig: RigArms) => (sky: Sky): void => {
    mats ??= materials(sky, rig, rims);
    dress(rig, mats);
  };
  /** charm III on the held blade: its edges lit (the Sword's halo, bladeGlow.ts, glows round it) */
  const glow = (rim: { value: number }) => (level: number): void => { rim.value = level; };
  return {
    arms: { ...swordArmsOf(wood, { offset: OFFSET, frame: FRAME, setup: setup(wood) }), glow: glow(rims.wood) },
    ironArms: { ...swordArmsOf(iron, { offset: OFFSET, frame: { ...FRAME }, setup: setup(iron) }), glow: glow(rims.iron) },
    swim: swimArms(swim),
  };
}

/** the Model Explorer's card (driftwood-isle/models/gear.ts): the castaway arms at rest holding `kind`, on their own
 *  skeleton clone of the one parse (the held rigs' geometry), in camera space as held — the eye at the origin, −Z forward */
export async function castawaySpecimen(sky: Sky, kind: 'wood' | 'iron'): Promise<Object3D> {
  const rig = await RigArms.load(FP_ARMS_URL, FP_ARMS_CONTRACT, FP_ARMS_BAKE);
  rig.weapon(kind);
  dress(rig, materials(sky, rig, { wood: { value: 0 }, iron: { value: 0 } }));
  rig.update(0.4, { speed: 0, lookVel: new Vector2() });
  return rig.root;
}
