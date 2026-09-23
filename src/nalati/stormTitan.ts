import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Player } from '../player/Player';
import type { Animal } from '../entities/Animal';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Wildlife } from '../entities/Wildlife';
import type { Interactable } from '../world/Cabin';
import type { TargetAnimal, TargetHit } from '../player/Crossbow';
import type { Sabre } from '../player/Sabre';
import type { NalatiWeather } from './weather';
import type { GhostRiders } from './ghostRiders';
import type { Ride } from './ride';
import { Boss, type BossDef, type BossScript } from '../game/Boss';
import { BossBar } from '../ui/BossBar';
import { GroundTell } from '../game/Elite';
import { fxMaterial, FX, type FxMaterial } from '../world/nalati/KurganDungeon';
import { heightAt, normalAt } from '../world/Heightfield';
import { wind } from '../world/Wind';
import { wildEnv } from '../entities/wildEnv';
import { setEliteDamage } from '../entities/eliteBrain';
import { CAIRN } from '../chunks/nalati-grasslands';
import { LightningStrip, Naizagai, naizagaiModel } from '../player/Naizagai';

/**
 * JEL ATA, the Storm Titan — the second Nalati boss (plan row B14; design docs/design/nalati/elites-and-bosses.md "The Storm
 * Titan fight, step by step"; handoff docs/design/nalati/handoff/storm-titan.md; mockups
 * art/nalati-grasslands/round-3/2-storm-titan/titan-1..5). The mounted exam under the open sky.
 *
 * The coordinator's decisions (they win over the design doc):
 *   · ONLY IN A NATURAL STORM: the Wind Cairn's TIE A CLOTH STRIP works while `weather.stormActive`; outside one the prompt
 *     says so. While the fight is on, the weather holds the storm open (`weather.bind({ stormHold })`, src/nalati/weather.ts)
 *     and its own lightning leaves you alone — his strikes take its place.
 *   · ON HORSEBACK: tying needs the saddle ("The wind wants a rider" on foot); a death respawns you MOUNTED at the cairn.
 *   · PHASE CHECKPOINTS: the generic `Boss` (src/game/Boss.ts) — this file is its `BossScript` + the glue, as kurganBoss.ts.
 *
 * The arena: a 68 m circle on the Sky Grassland against the south rim (centre 44 m north of the cairn); the STORM WALL (two
 * counter-rotating cloud cylinders) seals it; the horse refuses it (`mount.refuse`) and it stings on foot (10). The Titan
 * stands BEYOND the rim, ~60 m south of the cairn in the cloud sea, never on the terrain: a far-field set piece of real
 * geometry — ~340 churning cloud puffs on a seven-bone body (one InstancedMesh, one program: MeshBasic + a chained patch for
 * the fresnel rim, the heart's inner glow, the lightning flicker, a dithered fade for his pale kneel / his dissolve), a
 * lightning heart, white lightning eyes, a lightning spear (`LightningStrip`).
 *
 * The heart is the only target (a `TargetAnimal` chained into main's Targets ray, like the sheep / the ghost riders): shut,
 * an arrow reads IMMUNE; open, it takes the arrow's damage and a full draw (≥ 43) counts ×2.5.
 *
 *   I   THE SKY SPEAR (100 → 60 %) — he raises the spear, a gold forked ring paints where it lands and TRACKS you until
 *       0.5 s before the strike (1.5 s): 40 and thrown from the saddle. The spear then stays stuck 3 s, he is bent over the
 *       rim, the HEART OPENS. Three whirlwinds wander the circle (15, thrown).
 *   II  THE THREE WINDS (60 → 30 %) — he kneels, pale; a gold dome shields the heart. Three storm riders (B11's ghost-rider
 *       rig, the storm look, ×1.6, 250 hp) circle you; one at a time paints a WIND CHARGE lane (1.2 s) and charges down it
 *       (30, thrown); after the pass its flank is open 2 s — the sabre does ×3, arrows ×0.5. Each rider that falls takes 8 %;
 *       the last one breaks the dome and stuns him 4 s, heart open (it stays open until the phase ends).
 *   III THE GRASS FIRE (30 → 0 %) — he stands whole and strides along the rim, the heart always open. His strikes set the
 *       grass on fire: a 4 m burn grid spreads DOWNWIND, burning cells do 8 / s, the horse refuses a fire line and its STEED
 *       drains near one; burnt ground is black and safe. CHAIN LIGHTNING: rings trail your path, each landing 0.6 s after it
 *       paints. The Sky Spear continues between chains.
 *   VICTORY — he comes apart into rain, the fire goes out, the storm wall drops, the storm clears; NAIZAGAI in the gold orb
 *       at the cairn (the sabre upgrade, src/player/Naizagai.ts), the SKY-MARKED SADDLE skin owned, the achievement
 *       *Weather Report* (Progress kind 'storm-titan').
 *
 *   const titan = wireStormTitan({ game, weather, player, tieSpot: pois.cairnTieSpot })  // src/nalati/index.ts, at boot
 *   titan.bind(play)                           // main.ts, once the animals, the kit, the ride and the HUD exist
 *   titan.update(dt, t)                        // every frame (index.ts)
 *   titan.target(o, d, max, hit)               // in main's Targets chain (index.ts wraps nalati.sheepTarget)
 *   titan.onPlayerDeath()                      // main's death check: true = back at the cairn, mounted
 *   titan.engaged                              // the weather's hold, the elites stand down, …
 * Dev: `?boss=storm-titan` (a storm forced, mounted at the cairn, the strip tied), `&bossPhase=2|3`, `&bossGod=1`.
 */

// ─────────────────────────────── the place ───────────────────────────────

const CENTER = { x: CAIRN.x, z: CAIRN.z + 44 };
const ARENA_R = 68;
/** his waist, beyond the rim in the cloud sea. Measured: a full-draw arrow in the storm's gale drops ~14 m and drifts ~26 m
 *  by 110 m out (and Projectiles ends a flight past CHUNK_HALF + 80 m), so the heart is kept ~50–90 m from the arena: the
 *  standing heart ~20 m in front of this, the bent one (the spear stuck) 18 m nearer */
const TITAN = { x: CAIRN.x, z: CAIRN.z - 62 };
const HEART_HP = 2600;
/** the body is built at a 60 m design size and drawn ×1.9 — a ~110 m giant, so he fills the storm sky like the mockups */
const BODY_SCALE = 1.9;
export const TITAN_PHASES = [
  { at: 1, caption: '', name: 'The Sky Spear' },
  { at: 0.6, caption: 'PHASE II · THE THREE WINDS', name: 'The Three Winds' },
  { at: 0.3, caption: 'PHASE III · THE GRASS FIRE', name: 'The Grass Fire' },
];
const SPEAR_DMG = 40, SPEAR_R = 4.5, SPEAR_AIM = 1.5, SPEAR_LOCK = 0.5, SPEAR_STUCK = 3;
const WHIRL_DMG = 15, WHIRL_R = 3.2;
const RIDER_HP = 250, RIDER_CHIP = 0.08, CHARGE_DMG = 30, LANE_T = 1.2, FLANK_T = 2, STUN_T = 4;
const CELL = 4, GRID = Math.ceil((ARENA_R * 2) / CELL), BURN_T = 7, FIRE_DPS = 8, MAX_FLAMES = 420;
const CHAIN_DMG = 18, CHAIN_R = 3, CHAIN_LAND = 0.6;
const FULL_DRAW = 43, FULL_DRAW_MUL = 2.5;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
const _ray = new THREE.Ray(), _sph = new THREE.Sphere(), _hitP = new THREE.Vector3();
const smooth = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function rng(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ─────────────────────────────── the body ───────────────────────────────

interface Puff { bone: THREE.Object3D; p: THREE.Vector3; r: number; ph: number }

/** the Titan's body: seven bones, ~340 cloud puffs on them (one InstancedMesh), the heart, the eyes, the spear */
class TitanBody {
  readonly root = new THREE.Object3D();
  readonly chest = new THREE.Object3D();
  readonly head = new THREE.Object3D();
  readonly armR: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  readonly armL: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  readonly puffs: THREE.InstancedMesh;
  readonly heart: THREE.Mesh;
  readonly heartGlow: THREE.Mesh;
  readonly heartRing: THREE.Mesh;
  readonly dome: THREE.Mesh;
  readonly eyes: THREE.Mesh;
  readonly spear: LightningStrip;
  readonly uni = {
    uT: { value: 0 }, uHeart: { value: new THREE.Vector3() }, uGlow: { value: 0.4 }, uFlash: { value: 0 }, uAlpha: { value: 1 },
    uFogC: { value: new THREE.Color(0.3, 0.32, 0.4) }, uFog: { value: 0.1 },
  };
  readonly heartMat: THREE.MeshBasicMaterial;
  readonly glowMat: FxMaterial;
  readonly ringMat: THREE.MeshBasicMaterial;
  readonly domeMat: FxMaterial;
  private readonly list: Puff[] = [];
  private readonly ground: number;
  // pose (0..1 each), set by the fight
  rise = 0; bend = 0; raise = 0.2; kneel = 0; castL = 0; stride = 0;
  heartOpen = 0;
  visible = false;

  constructor(scene: THREE.Scene) {
    this.ground = heightAt(CAIRN.x, CAIRN.z);
    const mk = (parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
    this.root.add(this.chest); this.chest.position.set(0, 3, 0);
    this.chest.add(this.head); this.head.position.set(0, 27, 1.5);
    const uR = mk(this.chest, -11.5, 21, 0), fR = mk(uR, 0, -14, 0), hR = mk(fR, 0, -13, 0);
    const uL = mk(this.chest, 11.5, 21, 0), fL = mk(uL, 0, -14, 0), hL = mk(fL, 0, -13, 0);
    this.armR = [uR, fR, hR]; this.armL = [uL, fL, hL];
    this.root.scale.setScalar(BODY_SCALE);
    scene.add(this.root);

    // ── the puffs ──
    const r = rng(0x7174a);
    const add = (bone: THREE.Object3D, x: number, y: number, z: number, rad: number): void => { this.list.push({ bone, p: new THREE.Vector3(x, y, z), r: rad, ph: r() * 6.28 }); };
    const dir = (): THREE.Vector3 => { const u = r() * 2 - 1, a = r() * 6.283; const s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)); };
    // torso: an ellipsoid shell, broad at the shoulders
    for (let i = 0; i < 130; i++) { const d = dir(), k = 0.6 + 0.4 * r(), y = 11 + d.y * 12 * k; add(this.chest, d.x * 10 * k * (0.75 + 0.45 * (y / 24)), y, d.z * 6.5 * k, 3.2 + r() * 3); }
    // the skirt: the cloud sea he rises from — wide, heavy, down past the rim
    for (let i = 0; i < 70; i++) { const a = r() * 6.283, rr = 7 + r() * 10, y = -16 + r() * 18; add(this.root, Math.cos(a) * rr * (1 + (-y) * 0.03), y, Math.sin(a) * rr * 0.8, 4.5 + r() * 4 + Math.max(0, -y) * 0.12); }
    // head, the pointed helmet, the beard
    for (let i = 0; i < 26; i++) { const d = dir(), k = 0.5 + 0.5 * r(); add(this.head, d.x * 4.2 * k, d.y * 4.6 * k, d.z * 4 * k, 1.8 + r() * 1.4); }
    for (let i = 0; i < 18; i++) { const u = i / 17, a = i * 2.4; add(this.head, Math.cos(a) * 4.6 * (1 - u), 3 + u * 11, Math.sin(a) * 4.4 * (1 - u), 0.6 + 3.2 * (1 - u)); }
    for (let i = 0; i < 16; i++) { const u = r(); add(this.head, (r() - 0.5) * 5 * (1 - u * 0.6), -2 - u * 7, 3.4 + r() * 1.5, 1.6 + r() * 1.2); }
    // arms: upper + fore along −y, a fist
    for (const arm of [this.armR, this.armL]) {
      for (let s = 0; s < 2; s++) for (let i = 0; i < 12; i++) { const u = i / 11; add(arm[s] ?? this.chest, (r() - 0.5) * 2.2, -u * 13.5, (r() - 0.5) * 2.2, (s === 0 ? 4.2 : 3.4) - u * 0.8 + r() * 0.6); }
      add(arm[2], 0, 0, 0, 3.4);
    }
    // the cloak: off the shoulders, streaming back and down
    for (let i = 0; i < 44; i++) { const u = r(), v = r() - 0.5; add(this.chest, v * 26 * (0.7 + 0.5 * u), 22 - u * 32, -5 - u * 7 - Math.abs(v) * 3, 3.5 + r() * 2.5); }

    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    mat.name = 'nalati-titan-cloud';
    const uni = this.uni;
    const base = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (sh, renderer) => {
      base(sh, renderer);   // the prototype hook (Atmosphere's uniforms) — never replace it (see ghostRiders.ts)
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT;\nvarying vec3 vGW;\nvarying vec3 vGN;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float gph = dot(instanceMatrix[3].xyz, vec3(0.13, 0.071, 0.113));
          #else
            float gph = 0.0;
          #endif
          // billows: two octaves of slow churn on the unit puff
          transformed += normal * (0.17 * sin(uT * 1.1 + gph + position.y * 2.7 + position.x * 1.9) + 0.09 * sin(uT * 1.7 - gph * 1.3 + position.z * 5.3 + position.y * 4.1));`)
        .replace('#include <project_vertex>', `#include <project_vertex>
          #ifdef USE_INSTANCING
            vGW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            vGN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          #else
            vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vGN = normalize(mat3(modelMatrix) * normal);
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uT; uniform vec3 uHeart; uniform float uGlow; uniform float uFlash; uniform float uAlpha; uniform vec3 uFogC; uniform float uFog;\nvarying vec3 vGW;\nvarying vec3 vGN;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          // a dithered fade (his pale kneel, his dissolve into rain): opaque and depth-correct, no sorting
          if (uAlpha < 0.995 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > uAlpha) discard;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          vec3 gN = normalize(vGN);
          vec3 gV = normalize(cameraPosition - vGW);
          float up = 0.5 + 0.5 * dot(gN, normalize(vec3(-0.35, 0.85, 0.4)));
          float rim = pow(1.0 - max(dot(gN, gV), 0.0), 2.6);
          float hd = length(vGW - uHeart);
          float inner = exp(-hd / 11.0) * uGlow;
          float flick = uFlash * (0.55 + 0.45 * sin(vGW.y * 0.6 + vGW.x * 0.3 + uT * 31.0));
          // storm cloud: slate-violet in the shade, lit tops, a bright silver rim (the lightning behind him)
          vec3 cloud = gl_FragColor.rgb * mix(vec3(0.14, 0.14, 0.21), vec3(0.78, 0.8, 0.88), up * up);
          cloud += vec3(0.7, 0.78, 1.05) * rim * 0.5;
          cloud += vec3(0.42, 0.55, 1.6) * (inner * 1.3 + flick * 0.45);
          gl_FragColor.rgb = mix(cloud, uFogC, uFog);`);
    };
    mat.customProgramCacheKey = () => 'nalati-titan-cloud';
    this.puffs = new THREE.InstancedMesh(geo, mat, this.list.length);
    this.puffs.frustumCulled = false; this.puffs.castShadow = false; this.puffs.receiveShadow = false;
    this.puffs.name = 'titan-cloud';
    // colour: pale storm-white up top, blue-slate below and in the cloak
    const c = new THREE.Color();
    this.list.forEach((pf, i) => {
      const low = pf.bone === this.root ? 0.5 : pf.p.z < -4.5 ? 0.58 : 0.8 + 0.15 * Math.sin(i * 1.7);
      c.setRGB(0.66 * low + 0.08, 0.7 * low + 0.08, 0.8 * low + 0.12);
      this.puffs.setColorAt(i, c);
    });
    scene.add(this.puffs);

    // ── the heart: a white-blue core, a fresnel glow shell, the gold target ring when it is open ──
    this.heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 3.8), toneMapped: false, fog: false });
    this.heart = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 2), this.heartMat);
    this.heart.position.set(0, 17, 5.2);
    this.chest.add(this.heart);
    this.glowMat = fxMaterial(FX.beam, new THREE.Color(0.9, 1.2, 3.0), 0.9);
    this.heartGlow = new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), this.glowMat);
    this.heart.add(this.heartGlow);
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 0.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.heartRing = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.5, 6, 56), this.ringMat);
    this.heartRing.visible = false;
    scene.add(this.heartRing);
    this.domeMat = fxMaterial(FX.dome, new THREE.Color(2.0, 1.6, 0.7), 0.85);
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 32, 16), this.domeMat);
    this.dome.visible = false;
    this.heart.add(this.dome);
    // the eyes: two white-hot sparks
    const eg = new THREE.SphereGeometry(0.9, 10, 8), eg2 = eg.clone();
    eg.translate(-1.8, 0.8, 4.1); eg2.translate(1.8, 0.8, 4.1);
    const eyes = mergeTwo(eg, eg2);
    this.eyes = new THREE.Mesh(eyes, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 4.2), toneMapped: false, fog: false }));
    this.head.add(this.eyes);
    this.spear = new LightningStrip(scene, 18, new THREE.Color(2.2, 2.4, 3.8));
    this.setVisible(false);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.puffs.visible = on; this.heart.visible = on; this.eyes.visible = on;
    if (!on) { this.spear.alpha = 0; this.heartRing.visible = false; this.dome.visible = false; }
  }

  /** the heart's world position (after pose()) */
  heartWorld(out: THREE.Vector3): THREE.Vector3 { return this.heart.getWorldPosition(out); }
  handR(out: THREE.Vector3): THREE.Vector3 { return this.armR[2].getWorldPosition(out); }
  handL(out: THREE.Vector3): THREE.Vector3 { return this.armL[2].getWorldPosition(out); }

  pose(t: number, camera: THREE.Camera): void {
    const g = this.ground;
    const root = this.root;
    // standing waist at the rim's height, beyond it; rising from 45 m below; bending over the rim; kneeling; striding
    root.position.set(TITAN.x + Math.sin(t * 0.11) * 42 * this.stride, g + 4 - 80 * (1 - this.rise) - 20 * this.kneel - 8 * this.bend, TITAN.z + 18 * this.bend + 10 * this.kneel);
    root.rotation.set(0, Math.sin(t * 0.21) * 0.06 + (this.stride > 0 ? Math.cos(t * 0.11) * 0.18 * this.stride : 0), 0);
    this.chest.rotation.set(0.62 * this.bend + 0.22 * this.kneel + Math.sin(t * 0.7) * 0.02, 0, Math.sin(t * 0.33) * 0.03);
    this.head.rotation.set(-0.35 * this.bend + 0.12, 0, 0);
    // right arm: the spear arm — rest low and out, raised overhead, flung forward
    const [uR, fR] = this.armR, [uL, fL] = this.armL;
    uR.rotation.set(-(0.35 + 2.35 * this.raise), 0, -0.35 + 0.2 * this.raise);
    fR.rotation.set(-(0.4 + 0.5 * (1 - this.raise)), 0, 0);
    uL.rotation.set(-(0.5 + 1.4 * this.castL), 0, 0.4 - 0.2 * this.castL);
    fL.rotation.set(-(0.8 - 0.5 * this.castL), 0, 0);
    root.updateMatrixWorld(true);
    // the puffs follow their bones, churning
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const pf = L[i];
      if (pf === undefined) continue;
      _v.copy(pf.p).applyMatrix4(pf.bone.matrixWorld);
      const k = pf.r * (1 + 0.08 * Math.sin(t * 0.9 + pf.ph));
      _v.x += Math.sin(t * 0.37 + pf.ph) * 0.5; _v.y += Math.sin(t * 0.29 + pf.ph * 1.7) * 0.5;
      _q.setFromAxisAngle(_w.set(0, 1, 0), t * 0.05 + pf.ph);
      _m.compose(_v, _q, _s.set(k, k * 0.9, k));
      this.puffs.setMatrixAt(i, _m);
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.heartWorld(this.uni.uHeart.value);
    this.uni.uT.value = t;
    // the heart: pulse, and blaze when open
    const open = this.heartOpen;
    const beat = 1 + 0.08 * Math.sin(t * 7) + 0.25 * open;
    this.heart.scale.setScalar(beat);
    this.heartMat.color.setRGB(1.6 + 1.6 * open, 1.9 + 1.2 * open, 3.8 + 0.4 * open);
    this.glowMat.uniforms.uAlpha.value = 0.55 + 0.45 * open;
    this.glowMat.uniforms.uTime.value = t;
    this.uni.uGlow.value = 0.3 + 0.6 * open;
    // the gold target ring faces you while the heart is open
    this.heartRing.visible = this.visible && open > 0.02;
    if (this.heartRing.visible) {
      this.heartRing.position.copy(this.uni.uHeart.value);
      this.heartRing.lookAt(camera.position);
      this.heartRing.rotateZ(t * 0.8);
      this.ringMat.opacity = open * (0.7 + 0.3 * Math.sin(t * 9));
    }
    this.domeMat.uniforms.uTime.value = t;
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pa = a.getAttribute('position'), pb = b.getAttribute('position');
  const pos = new Float32Array((pa.count + pb.count) * 3);
  for (let i = 0; i < pa.count; i++) { pos[i * 3] = pa.getX(i); pos[i * 3 + 1] = pa.getY(i); pos[i * 3 + 2] = pa.getZ(i); }
  for (let i = 0; i < pb.count; i++) { const k = (pa.count + i) * 3; pos[k] = pb.getX(i); pos[k + 1] = pb.getY(i); pos[k + 2] = pb.getZ(i); }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ia = a.getIndex(), ib = b.getIndex(), idx: number[] = [];
  if (ia) for (let i = 0; i < ia.count; i++) idx.push(ia.getX(i)); else for (let i = 0; i < pa.count; i++) idx.push(i);
  if (ib) for (let i = 0; i < ib.count; i++) idx.push(ib.getX(i) + pa.count); else for (let i = 0; i < pb.count; i++) idx.push(i + pa.count);
  out.setIndex(idx);
  return out;
}

// ─────────────────────────────── the arena: wall, whirlwinds, fire ───────────────────────────────

function flameTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(32, 104, 4, 32, 90, 60);
    grd.addColorStop(0, 'rgba(255,240,200,1)'); grd.addColorStop(0.25, 'rgba(255,170,60,0.95)'); grd.addColorStop(0.6, 'rgba(220,70,10,0.5)'); grd.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(58, 50, 62, 118, 32, 126); g.bezierCurveTo(2, 118, 6, 50, 32, 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function scorchTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

interface Whirl { x: number; z: number; vx: number; vz: number; funnel: THREE.Mesh; on: boolean; k: number }
interface Chain { tell: GroundTell; x: number; z: number; t: number; on: boolean }
interface StormRider { a: Animal; mode: 'circle' | 'aim' | 'charge' | 'open'; t: number; th: number; lane: GroundTell; x0: number; z0: number; x1: number; z1: number; hit: boolean }

export interface TitanCtx { game: Game; player: Player; weather: NalatiWeather; tieSpot: THREE.Vector3 | null }
export interface TitanFightHost {
  player: Player;
  hurt: (dmg: number, why: string) => void;
  throwRider: () => void;
  mounted: () => boolean;
  horseSteed: (d: number) => void;
  feed: (text: string) => void;
  toast: (text: string) => void;
  riders: () => GhostRiders | null;
  animals: () => AnimalManager | null;
}

/** the BossScript: the Titan, his moves, the arena's hazards */
export class StormTitanFight implements BossScript {
  readonly body: TitanBody;
  phase = 0;
  hp = HEART_HP;
  private invuln = false;
  private fighting = false;
  private victoryT = -1;
  // the spear
  private spear: 'idle' | 'aim' | 'strike' | 'stuck' = 'idle';
  private spearT = 0; private spearCd = 2.5;
  private readonly spearAt = new THREE.Vector3();
  private readonly spearRing: GroundTell; private readonly spearFork: GroundTell;
  private jagT = 0;
  // phase II
  private stormRiders: StormRider[] = [];
  private readonly lanes: GroundTell[];
  private chargeCd = 2.5;
  private stunT = 0; private domeBroken = false;
  // phase III
  private readonly burn = new Uint8Array(GRID * GRID);      // 0 grass · 1 burning · 2 burnt
  private readonly burnT = new Float32Array(GRID * GRID);
  private spreadT = 0; private fireOn = false; private fireDmgT = 0;
  private readonly flames: THREE.InstancedMesh; private readonly scorch: THREE.InstancedMesh;
  private scorchN = 0;
  private readonly chains: Chain[];
  private chainCd = 4; private chainLeft = 0; private chainStep = 0;
  private readonly trail: { x: number; z: number }[] = []; private trailT = 0;
  // whirlwinds
  private readonly whirls: Whirl[];
  private readonly debris: THREE.InstancedMesh;
  private whirlCd = 0;
  // the seal
  private readonly wall: THREE.Mesh[]; private readonly wallMat: FxMaterial[];
  private wallK = 0; private sealed = false;
  private immuneT = 0; private introBolt = false;

  constructor(private readonly ctx: TitanCtx, private readonly host: TitanFightHost) {
    const scene = ctx.game.scene;
    this.body = new TitanBody(scene);
    this.spearRing = new GroundTell(scene, 'ring', new THREE.Color(2.6, 2.0, 0.8));
    this.spearFork = new GroundTell(scene, 'ring', new THREE.Color(2.8, 2.6, 1.6));
    this.lanes = [0, 1, 2].map(() => new GroundTell(scene, 'lane', new THREE.Color(1.2, 2.2, 2.8)));
    this.chains = Array.from({ length: 8 }, () => ({ tell: new GroundTell(scene, 'ring', new THREE.Color(2.4, 2.2, 1.4)), x: 0, z: 0, t: 0, on: false }));
    // the storm wall: two counter-rotating cloud cylinders
    this.wallMat = [fxMaterial(FX.stream, new THREE.Color(0.5, 0.53, 0.62), 0.85, false), fxMaterial(FX.stream, new THREE.Color(0.66, 0.7, 0.8), 0.55, false)];
    this.wall = this.wallMat.map((m, i) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + i * 3, ARENA_R + i * 3, 46, 72, 1, true), m);
      w.position.set(CENTER.x, heightAt(CENTER.x, CENTER.z) - 6, CENTER.z);
      w.visible = false; w.renderOrder = 12; w.name = 'titan-storm-wall';
      scene.add(w);
      return w;
    });
    // whirlwinds: a lathe funnel on the stream program + a spiral of debris (one InstancedMesh for all three)
    const prof = [new THREE.Vector2(0.9, 0), new THREE.Vector2(1.5, 3), new THREE.Vector2(2.6, 7), new THREE.Vector2(4.4, 11), new THREE.Vector2(6.4, 14.5)];
    const funnelGeo = new THREE.LatheGeometry(prof, 28);
    const funnelMat = fxMaterial(FX.stream, new THREE.Color(0.66, 0.62, 0.55), 0.75, false);
    this.whirls = [0, 1, 2].map((i) => {
      const f = new THREE.Mesh(funnelGeo, funnelMat); f.visible = false; f.renderOrder = 11; f.name = 'titan-whirlwind'; scene.add(f);
      const a = i * 2.1;
      return { x: CENTER.x + Math.cos(a) * 30, z: CENTER.z + Math.sin(a) * 30, vx: 0, vz: 0, funnel: f, on: false, k: 0 };
    });
    this.debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.28), new THREE.MeshLambertMaterial({ color: 0x6a5a44 }), 3 * 40);
    this.debris.frustumCulled = false; this.debris.count = 0; this.debris.name = 'titan-debris';
    scene.add(this.debris);
    // fire: crossed flame cards (instanced) and scorch decals
    const fg = new THREE.PlaneGeometry(1.7, 2.3); fg.translate(0, 1.05, 0);
    const fg2 = fg.clone(); fg2.rotateY(Math.PI / 3); const fg3 = fg.clone(); fg3.rotateY(-Math.PI / 3);
    const flameGeo = mergeTwo(mergeTwo(fg, fg2), fg3);
    const uv = new Float32Array(flameGeo.getAttribute('position').count * 2);
    const uv1 = fg.getAttribute('uv');
    for (let k = 0; k < 3; k++) for (let i = 0; i < uv1.count; i++) { uv[(k * uv1.count + i) * 2] = uv1.getX(i); uv[(k * uv1.count + i) * 2 + 1] = uv1.getY(i); }
    flameGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTexture(), color: new THREE.Color(1.5, 0.95, 0.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
    flameMat.name = 'titan-flame';
    this.flames = new THREE.InstancedMesh(flameGeo, flameMat, MAX_FLAMES);
    this.flames.frustumCulled = false; this.flames.count = 0; this.flames.renderOrder = 14; this.flames.name = 'titan-flames';
    scene.add(this.flames);
    const sg = new THREE.PlaneGeometry(CELL * 1.25, CELL * 1.25); sg.rotateX(-Math.PI / 2);
    const scMat = new THREE.MeshBasicMaterial({ color: 0x0d0a08, alphaMap: scorchTexture(), transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    scMat.name = 'titan-scorch';
    this.scorch = new THREE.InstancedMesh(sg, scMat, GRID * GRID);
    this.scorch.frustumCulled = false; this.scorch.count = 0; this.scorch.renderOrder = 2; this.scorch.name = 'titan-scorch';
    scene.add(this.scorch);
  }

  // ── BossScript ──
  get hpFrac(): number { return Math.max(0, this.hp / HEART_HP); }
  get shielded(): boolean { return this.phase === 1 && !this.domeBroken; }
  get dead(): boolean { return this.hp <= 0; }
  get heartOpen(): boolean {
    if (!this.fighting || this.invuln) return false;
    if (this.phase === 0) return this.spear === 'stuck';
    if (this.phase === 1) return this.domeBroken;
    return true;
  }
  inArena(p: THREE.Vector3): boolean { return this.tied && this.host.mounted() && Math.hypot(p.x - CENTER.x, p.z - CENTER.z) < ARENA_R - 2; }
  /** the strip is tied (the cairn's prompt) — the threshold */
  tied = false;
  seal(on: boolean): void { this.sealed = on; }
  clampHp(frac: number): void { this.hp = Math.max(1, Math.round(HEART_HP * frac)); }
  setInvulnerable(on: boolean): void { this.invuln = on; }
  rewardPoint(): THREE.Vector3 {
    const s = this.cairnSpot();
    const dx = CENTER.x - s.x, dz = CENTER.z - s.z, l = Math.hypot(dx, dz) || 1;
    const x = s.x + (dx / l) * 3.5, z = s.z + (dz / l) * 3.5;
    return new THREE.Vector3(x, heightAt(x, z) + 1.3, z);
  }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } {
    const s = this.cairnSpot();
    const dx = CENTER.x - s.x, dz = CENTER.z - s.z, l = Math.hypot(dx, dz) || 1;
    const x = s.x + (dx / l) * 16, z = s.z + (dz / l) * 16;
    return { pos: new THREE.Vector3(x, heightAt(x, z), z), yaw: Math.atan2(-(TITAN.x - x), -(TITAN.z - z)) };
  }
  cairnSpot(): THREE.Vector3 { return this.ctx.tieSpot ?? new THREE.Vector3(CAIRN.x, heightAt(CAIRN.x, CAIRN.z + 3), CAIRN.z + 3); }

  reset(phase: number): void {
    this.phase = phase;
    this.hp = Math.round(HEART_HP * (TITAN_PHASES[phase]?.at ?? 1));
    this.fighting = false; this.invuln = false; this.victoryT = -1; this.introBolt = false;
    const b = this.body;
    b.rise = 0; b.bend = 0; b.raise = 0.2; b.kneel = 0; b.castL = 0; b.stride = 0; b.heartOpen = 0;
    b.uni.uAlpha.value = 1; b.dome.visible = false;
    b.setVisible(false);
    this.spear = 'idle'; this.spearCd = 2.5; this.spearRing.hide(); this.spearFork.hide(); b.spear.alpha = 0;
    this.clearRiders();
    this.stunT = 0; this.domeBroken = false; this.chargeCd = 2.5;
    this.clearFire();
    for (const c of this.chains) { c.on = false; c.tell.hide(); }
    this.chainLeft = 0; this.chainCd = 4;
    for (const w of this.whirls) { w.on = false; w.funnel.visible = false; }
    this.debris.count = 0;
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const b = this.body;
    if (!b.visible) b.setVisible(true);
    const len = short ? 1.2 : 3.2;
    b.rise = smooth(t / len);
    b.kneel = this.phase === 1 ? smooth(t / len) : 0;
    b.uni.uAlpha.value = this.phase === 1 ? 1 - 0.45 * smooth(t / len) : 1;
    b.uni.uFlash.value = t > len * 0.7 ? Math.max(0, 1 - (t - len * 0.7) * 2) : 0;
    // his eyes ignite, and the first bolt hits the meadow
    if (!short && t > 2.5 && !this.introBolt) { this.introBolt = true; this.bolt(CENTER.x + 18, CENTER.z - 10); }
    return b.heartWorld(_hitP);
  }

  begin(phase: number): void {
    this.fighting = true;
    this.body.rise = 1;
    this.enterPhase(phase);
  }

  enterPhase(phase: number): void {
    this.phase = phase;
    const b = this.body;
    this.spear = 'idle'; this.spearCd = phase === 2 ? 3 : 2; this.spearRing.hide(); this.spearFork.hide(); b.spear.alpha = 0; b.bend = 0; b.raise = 0.2;
    for (const w of this.whirls) w.on = phase === 0 || (phase === 1 && w !== this.whirls[2]);
    if (phase === 1) {
      this.domeBroken = false; this.stunT = 0;
      this.spawnRiders();
      this.host.feed('JEL ATA kneels — his heart shuts behind the wind · break the three riders');
    } else this.clearRiders();
    if (phase === 2) {
      this.fireOn = true;
      // the lightning has already lit the plateau in three places (upwind of you)
      const p = this.host.player.position;
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; this.ignite(p.x + Math.cos(a) * 26, p.z + Math.sin(a) * 26); }
      this.host.feed('THE GRASS FIRE — ride upwind onto the black');
    }
  }

  update(dt: number, t: number, fighting: boolean): void {
    const b = this.body, p = this.host.player.position;
    // the wall rises / falls with the seal
    this.wallK += ((this.sealed ? 1 : 0) - this.wallK) * Math.min(1, dt * 1.2);
    for (let i = 0; i < this.wall.length; i++) {
      const w = this.wall[i], m = this.wallMat[i];
      if (w === undefined || m === undefined) continue;
      w.visible = this.wallK > 0.02;
      w.scale.y = Math.max(0.02, this.wallK);
      w.rotation.y += dt * (i === 0 ? 0.35 : -0.22);
      m.uniforms.uTime.value = t;
    }
    if (!b.visible && this.victoryT < 0) { this.updateFire(dt, t, false); return; }
    // the pose per phase
    if (this.victoryT >= 0) {
      this.victoryT += dt;
      b.uni.uAlpha.value = Math.max(0, 1 - this.victoryT / 3.5);
      b.rise = Math.max(0, 1 - this.victoryT / 6);
      if (this.victoryT > 3.6) { b.setVisible(false); }
    } else if (fighting) {
      const want = this.phase === 1 ? 1 : 0;
      b.kneel += (want - b.kneel) * Math.min(1, dt * 1.5);
      const alpha = this.phase === 1 ? (this.domeBroken ? 0.8 : 0.55) : 1;
      b.uni.uAlpha.value += (alpha - b.uni.uAlpha.value) * Math.min(1, dt * 2);
      b.stride += ((this.phase === 2 ? 1 : 0) - b.stride) * Math.min(1, dt * 0.5);
    }
    b.heartOpen += ((this.heartOpen ? 1 : 0) - b.heartOpen) * Math.min(1, dt * 6);
    b.uni.uFlash.value = Math.max(0, b.uni.uFlash.value - dt * 3, this.ctx.weather.weather.flash);
    const fog = this.ctx.game.scene.fog;
    if (fog) b.uni.uFogC.value.copy(fog.color);
    // the dome
    b.dome.visible = b.visible && this.phase === 1 && !this.domeBroken && this.victoryT < 0;
    this.immuneT -= dt;
    if (fighting && this.victoryT < 0) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.1; this.trail.push({ x: p.x, z: p.z }); if (this.trail.length > 12) this.trail.shift(); }
      if (this.phase !== 1) this.updateSpear(dt, t);
      if (this.phase === 1) this.updateRiders(dt, t);
      if (this.phase === 2) this.updateChains(dt, t);
    }
    this.spearRing.setTime(t); this.spearFork.setTime(t);
    for (const l of this.lanes) l.setTime(t);
    for (const c of this.chains) c.tell.setTime(t);
    this.updateWhirls(dt, t, fighting && this.victoryT < 0);
    this.updateFire(dt, t, fighting && this.victoryT < 0);
    b.pose(t, this.ctx.game.camera);
    // the spear in his hand (raised) or stuck in the meadow
    this.jagT -= dt;
    if (this.jagT <= 0) {
      this.jagT = 0.07;
      const s = b.spear;
      if (this.spear === 'stuck' || this.spear === 'strike') { b.handR(_v); s.set(_v, this.spearAt, 1.4, 0.55); }
      else if (this.victoryT < 0 && b.visible && this.phase !== 1) { b.handR(_v); b.armR[1].getWorldPosition(_w); _w.sub(_v).multiplyScalar(-1).normalize(); _w.multiplyScalar(34).add(_v); s.set(_v, _w, 0.9, 0.5); }
    }
    b.spear.alpha = b.visible && this.victoryT < 0 && this.phase !== 1 ? (this.spear === 'stuck' ? 1 : 0.85) : 0;
  }

  victory(): void {
    this.victoryT = 0; this.fighting = false;
    this.spear = 'idle'; this.spearRing.hide(); this.spearFork.hide();
    for (const c of this.chains) { c.on = false; c.tell.hide(); }
    for (const l of this.lanes) l.hide();
    this.clearRiders();
    // the rain puts the fire out: every burning cell goes to black
    for (let i = 0; i < this.burn.length; i++) if (this.burn[i] === 1) { this.burn[i] = 2; this.addScorch(i); }
    this.fireOn = false;
    this.flames.count = 0;
    for (const w of this.whirls) w.on = false;
  }

  // ── the heart as a target (main's Targets chain) ──

  private readonly heartTarget: TargetAnimal = {
    kind: 'storm-titan', position: new THREE.Vector3(), alive: true,
    damageFor: () => 40,
    applyDamage: (amount) => this.hitHeart(amount),
  };
  private readonly heartHit: TargetHit = { animal: this.heartTarget, point: new THREE.Vector3(), distance: 0, headshot: false };

  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return hit;
    const best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist;
    this.body.heartWorld(_hitP);
    _sph.set(_hitP, this.heartOpen ? 7 : 4);   // open: the gold ring (a 110 m giant, 50–140 m out, in a gale)
    _ray.set(origin, dir);
    if (_ray.intersectSphere(_sph, _v) === null) return hit;
    const d = _v.distanceTo(origin);
    if (d > best) return hit;
    this.heartTarget.position.copy(_hitP); this.heartTarget.alive = !this.dead;
    this.heartHit.point.copy(_v); this.heartHit.distance = d; this.heartHit.headshot = this.heartOpen;
    return this.heartHit;
  }

  private hitHeart(amount: number): boolean {
    if (this.dead) return false;
    if (!this.heartOpen) {
      if (this.immuneT <= 0) { this.immuneT = 2.5; this.host.toast(this.phase === 1 ? 'IMMUNE — the dome holds while a rider stands' : 'IMMUNE — his heart opens when the spear is stuck'); }
      return false;
    }
    const mul = amount >= FULL_DRAW ? FULL_DRAW_MUL : 1;
    this.hp = Math.max(0, this.hp - amount * mul);
    this.body.uni.uFlash.value = 1;
    return this.hp <= 0;
  }

  // ── I · the Sky Spear ──

  private updateSpear(dt: number, t: number): void {
    const b = this.body, p = this.host.player.position;
    this.spearT += dt;
    switch (this.spear) {
      case 'idle':
        b.bend += (0 - b.bend) * Math.min(1, dt * 2);
        b.raise += (0.2 - b.raise) * Math.min(1, dt * 2);
        this.spearCd -= dt;
        if (this.spearCd <= 0 && this.chainLeft === 0) { this.spear = 'aim'; this.spearT = 0; this.spearAt.set(p.x, 0, p.z); }
        break;
      case 'aim': {
        b.raise += (1 - b.raise) * Math.min(1, dt * 4);
        // the ring tracks you until 0.5 s before the strike
        if (this.spearT < SPEAR_AIM - SPEAR_LOCK) { const k = Math.min(1, dt * 5); this.spearAt.x += (p.x - this.spearAt.x) * k; this.spearAt.z += (p.z - this.spearAt.z) * k; }
        const pulse = 0.6 + 0.4 * Math.sin(t * (this.spearT > SPEAR_AIM - SPEAR_LOCK ? 30 : 12));
        this.spearRing.ring(this.spearAt.x, this.spearAt.z, SPEAR_R, 0.95 * pulse);
        this.spearFork.ring(this.spearAt.x, this.spearAt.z, SPEAR_R * (0.3 + 0.7 * (1 - this.spearT / SPEAR_AIM)), 0.8 * pulse);
        if (this.spearT >= SPEAR_AIM) {
          this.spear = 'strike'; this.spearT = 0;
          this.spearAt.y = heightAt(this.spearAt.x, this.spearAt.z);
          this.spearRing.hide(); this.spearFork.hide();
          this.bolt(this.spearAt.x, this.spearAt.z);
          if (Math.hypot(p.x - this.spearAt.x, p.z - this.spearAt.z) < SPEAR_R) { this.host.hurt(SPEAR_DMG, 'The Sky Spear — keep turning at a canter'); this.host.throwRider(); }
          if (this.phase === 2) this.ignite(this.spearAt.x, this.spearAt.z);
        }
        break;
      }
      case 'strike':
        b.raise += (0 - b.raise) * Math.min(1, dt * 8);
        b.bend += (1 - b.bend) * Math.min(1, dt * 5);
        if (this.spearT > 0.45) { this.spear = 'stuck'; this.spearT = 0; if (this.phase === 0) this.host.feed('The spear is stuck — HIS HEART IS OPEN'); }
        break;
      case 'stuck':
        b.bend += (1 - b.bend) * Math.min(1, dt * 5);
        if (this.spearT >= SPEAR_STUCK) { this.spear = 'idle'; this.spearT = 0; this.spearCd = this.phase === 2 ? 6 + Math.random() * 2 : 2 + Math.random() * 1.5; }
        break;
      default: break;
    }
  }

  // ── II · the Three Winds ──

  private spawnRiders(): void {
    this.clearRiders();
    const gr = this.host.riders();
    if (gr === null) { this.domeBroken = true; return; }
    for (let i = 0; i < 3; i++) {
      const x = TITAN.x + (i - 1) * 18, z = CENTER.z - ARENA_R + 10;
      const a = gr.spawnRider({ x, z, yaw: 0, variant: 'rider', storm: true });
      if (a === null) continue;
      a.maxHp = RIDER_HP; a.hp = RIDER_HP;
      const lane = this.lanes[i] ?? this.lanes[0];
      if (lane === undefined) continue;
      const r: StormRider = { a, mode: 'circle', t: 0, th: i * 2.09, lane, x0: 0, z0: 0, x1: 0, z1: 0, hit: false };
      // the flank is open 2 s after a pass: the sabre ×3; arrows ×0.5 always
      setEliteDamage(a, (_a, hitPoint) => {
        const pl = this.host.player.position;
        const melee = Math.hypot(hitPoint.x - pl.x, hitPoint.z - pl.z) < 5 * a.scale;
        return melee ? (r.mode === 'open' ? 3 : 1) : 0.5;
      });
      this.stormRiders.push(r);
    }
  }

  private clearRiders(): void {
    const gr = this.host.riders();
    for (const r of this.stormRiders) { r.lane.hide(); if (r.a.alive && gr !== null) { r.a.alive = false; gr.dissolve(r.a); } }
    this.stormRiders = [];
    for (const l of this.lanes) l.hide();
  }

  private updateRiders(dt: number, _t: number): void {
    const p = this.host.player.position;
    this.chargeCd -= dt;
    let aiming = false;
    for (let i = this.stormRiders.length - 1; i >= 0; i--) {
      const r = this.stormRiders[i];
      if (r === undefined) continue;
      const a = r.a, m = a.mem;
      if (!a.alive) {
        r.lane.hide();
        this.stormRiders.splice(i, 1);
        if (!this.invuln) this.hp = Math.max(1, this.hp - RIDER_CHIP * HEART_HP);
        this.host.feed(this.stormRiders.length > 0 ? `A storm rider breaks — JEL ATA −8 % · ${this.stormRiders.length} left` : 'The last rider streams back into him — the dome breaks!');
        if (this.stormRiders.length === 0) { this.domeBroken = true; this.stunT = STUN_T; this.body.uni.uFlash.value = 1; }
        continue;
      }
      r.t += dt;
      if (r.mode === 'aim' || r.mode === 'charge') aiming = true;
      switch (r.mode) {
        case 'circle': {
          r.th += dt * 12 / 26;
          m['tx'] = p.x + Math.sin(r.th) * 26; m['tz'] = p.z + Math.cos(r.th) * 26; m['v'] = 12; m['turn'] = 2.8;
          r.lane.hide();
          break;
        }
        case 'aim': {
          m['tx'] = r.x0; m['tz'] = r.z0; m['v'] = 0.5; m['turn'] = 5;
          r.lane.lane(r.x0, r.z0, r.x1, r.z1, 4.2, 0.9 * (0.65 + 0.35 * Math.sin(r.t * 18)));
          if (r.t >= LANE_T) { r.mode = 'charge'; r.t = 0; r.hit = false; }
          break;
        }
        case 'charge': {
          m['tx'] = r.x1; m['tz'] = r.z1; m['v'] = 21; m['turn'] = 6;
          r.lane.lane(r.x0, r.z0, r.x1, r.z1, 4.2, Math.max(0, 0.5 - r.t * 0.3));
          if (!r.hit && Math.hypot(p.x - a.position.x, p.z - a.position.z) < 3.4) { r.hit = true; this.host.hurt(CHARGE_DMG, 'Wind Charge — swerve out of the lane'); this.host.throwRider(); }
          if (Math.hypot(r.x1 - a.position.x, r.z1 - a.position.z) < 4 || r.t > 3.2) { r.mode = 'open'; r.t = 0; r.lane.hide(); }
          break;
        }
        case 'open': {
          // past you: its flank is open (the sabre ×3) while it wheels
          const dx = r.x1 - r.x0, dz = r.z1 - r.z0, l = Math.hypot(dx, dz) || 1;
          m['tx'] = r.x1 + (dx / l) * 14; m['tz'] = r.z1 + (dz / l) * 14; m['v'] = 7; m['turn'] = 2;
          if (r.t >= FLANK_T) { r.mode = 'circle'; r.t = 0; r.th = Math.atan2(a.position.x - p.x, a.position.z - p.z); }
          break;
        }
        default: break;
      }
    }
    // one charge at a time
    if (!aiming && this.chargeCd <= 0) {
      const r = this.stormRiders.find((x) => x.mode === 'circle');
      if (r !== undefined) {
        const a = r.a, dx = p.x - a.position.x, dz = p.z - a.position.z, l = Math.hypot(dx, dz) || 1;
        r.mode = 'aim'; r.t = 0; r.x0 = a.position.x; r.z0 = a.position.z; r.x1 = p.x + (dx / l) * 22; r.z1 = p.z + (dz / l) * 22;
        this.chargeCd = 3 + Math.random() * 1.5;
      }
    }
    if (this.stunT > 0) this.stunT -= dt;
  }

  // ── III · the grass fire + chain lightning ──

  private cellOf(x: number, z: number): number {
    const i = Math.floor((x - (CENTER.x - ARENA_R)) / CELL), j = Math.floor((z - (CENTER.z - ARENA_R)) / CELL);
    return i < 0 || j < 0 || i >= GRID || j >= GRID ? -1 : j * GRID + i;
  }
  private cellX(c: number): number { return CENTER.x - ARENA_R + ((c % GRID) + 0.5) * CELL; }
  private cellZ(c: number): number { return CENTER.z - ARENA_R + (Math.floor(c / GRID) + 0.5) * CELL; }
  private inside(c: number): boolean { return Math.hypot(this.cellX(c) - CENTER.x, this.cellZ(c) - CENTER.z) < ARENA_R - 2; }
  /** a burning cell (for the horse's refusal, the HUD) */
  burningAt(x: number, z: number): boolean { const c = this.cellOf(x, z); return c >= 0 && this.burn[c] === 1; }

  private ignite(x: number, z: number): void {
    const c = this.cellOf(x, z);
    if (c < 0 || this.burn[c] !== 0 || !this.inside(c)) return;
    this.burn[c] = 1; this.burnT[c] = BURN_T * (0.8 + Math.random() * 0.4);
  }
  private addScorch(c: number): void {
    if (this.scorchN >= this.scorch.instanceMatrix.count) return;
    const x = this.cellX(c) + (Math.random() - 0.5) * 2.4, z = this.cellZ(c) + (Math.random() - 0.5) * 2.4;
    // lying on the slope (a flat decal floats off the rim's fall), turned at random
    const n = normalAt(x, z);
    _q.setFromUnitVectors(_w.set(0, 1, 0), _v.set(n[0], n[1], n[2]).normalize());
    _q.multiply(_q2.setFromAxisAngle(_w.set(0, 1, 0), Math.random() * 6.28));
    _m.compose(_v.set(x, heightAt(x, z) + 0.08, z), _q, _s.set(0.8 + Math.random() * 0.5, 1, 0.8 + Math.random() * 0.5));
    this.scorch.setMatrixAt(this.scorchN++, _m);
    this.scorch.count = this.scorchN; this.scorch.instanceMatrix.needsUpdate = true;
    wildEnv.trample(x, z, CELL * 0.6, 1, 0, 0);   // the grass burnt flat
  }
  private clearFire(): void {
    this.burn.fill(0); this.burnT.fill(0);
    this.scorchN = 0; this.scorch.count = 0; this.flames.count = 0; this.fireOn = false;
  }

  private updateFire(dt: number, t: number, live: boolean): void {
    if (!this.fireOn) return;
    // spread downwind, 4 times a second
    this.spreadT -= dt;
    if (this.spreadT <= 0 && live) {
      this.spreadT = 0.25;
      const wx = wind.dirX, wz = wind.dirZ;
      const next: number[] = [];
      for (let c = 0; c < this.burn.length; c++) {
        if (this.burn[c] !== 1) continue;
        const i = c % GRID, j = Math.floor(c / GRID);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) continue;
          const n = nj * GRID + ni;
          if (this.burn[n] !== 0) continue;
          const l = Math.hypot(di, dj), along = (di * wx + dj * wz) / l;
          const pr = along > 0.5 ? 0.16 : along > -0.2 ? 0.035 : 0.004;
          if (Math.random() < pr) next.push(n);
        }
      }
      for (const n of next) if (this.inside(n)) { this.burn[n] = 1; this.burnT[n] = BURN_T * (0.8 + Math.random() * 0.4); }
    }
    // burn down; draw the flames
    let f = 0;
    for (let c = 0; c < this.burn.length; c++) {
      if (this.burn[c] !== 1) continue;
      const bt = (this.burnT[c] ?? 0) - dt;
      this.burnT[c] = bt;
      if (bt <= 0) { this.burn[c] = 2; this.addScorch(c); continue; }
      if (f >= MAX_FLAMES) continue;
      const x = this.cellX(c), z = this.cellZ(c);
      const k = Math.min(1, bt / 1.5) * (0.85 + 0.25 * Math.sin(t * 11 + c * 1.7));
      _m.compose(_v.set(x + Math.sin(c * 3.1) * 0.8, heightAt(x, z) - 0.1, z + Math.cos(c * 2.3) * 0.8), _q.setFromAxisAngle(_w.set(0, 1, 0), c * 0.7 + t * 0.4), _s.set(k, (0.9 + 0.35 * Math.sin(t * 7 + c)) * k, k));
      this.flames.setMatrixAt(f++, _m);
    }
    this.flames.count = f; this.flames.instanceMatrix.needsUpdate = true;
    if (!live) return;
    // the player in fire: 8 / s; the horse panics near it
    const p = this.host.player.position;
    this.fireDmgT -= dt;
    if (this.burningAt(p.x, p.z) && this.fireDmgT <= 0) { this.fireDmgT = 0.5; this.host.hurt(FIRE_DPS * 0.5, 'The grass is burning — ride upwind onto the black'); }
    if (this.host.mounted()) {
      let near = false;
      for (let a = 0; a < 6 && !near; a++) near = this.burningAt(p.x + Math.cos(a) * 5, p.z + Math.sin(a) * 5);
      if (near) this.host.horseSteed(-10 * dt);
    }
  }

  private updateChains(dt: number, t: number): void {
    const b = this.body;
    this.chainCd -= dt;
    if (this.chainLeft === 0 && this.chainCd <= 0 && this.spear === 'idle') { this.chainLeft = 7; this.chainStep = 0; }
    b.castL += ((this.chainLeft > 0 ? 1 : 0) - b.castL) * Math.min(1, dt * 4);
    if (this.chainLeft > 0) {
      this.chainStep -= dt;
      if (this.chainStep <= 0) {
        this.chainStep = 0.42;
        this.chainLeft--;
        if (this.chainLeft === 0) this.chainCd = 5 + Math.random() * 2;
        // a ring where you were ~0.4 s ago: stopping means being hit
        const tr = this.trail[Math.max(0, this.trail.length - 5)] ?? { x: this.host.player.position.x, z: this.host.player.position.z };
        const c = this.chains.find((x) => !x.on);
        if (c) { c.on = true; c.t = 0; c.x = tr.x; c.z = tr.z; }
      }
    }
    const p = this.host.player.position;
    for (const c of this.chains) {
      if (!c.on) continue;
      c.t += dt;
      c.tell.ring(c.x, c.z, CHAIN_R, 0.85 * (0.6 + 0.4 * Math.sin(t * 24)));
      if (c.t >= CHAIN_LAND) {
        c.on = false; c.tell.hide();
        this.bolt(c.x, c.z);
        this.ignite(c.x, c.z);
        if (Math.hypot(p.x - c.x, p.z - c.z) < CHAIN_R) this.host.hurt(CHAIN_DMG, 'Chain lightning — keep moving');
      }
    }
  }

  // ── whirlwinds ──

  private updateWhirls(dt: number, t: number, live: boolean): void {
    const p = this.host.player.position;
    this.whirlCd -= dt;
    let n = 0;
    for (let wi = 0; wi < this.whirls.length; wi++) {
      const w = this.whirls[wi];
      if (w === undefined) continue;
      const want = live && w.on ? 1 : 0;
      w.k += (want - w.k) * Math.min(1, dt * 1.2);
      w.funnel.visible = w.k > 0.02;
      if (!w.funnel.visible) continue;
      // wander: a slow turn, kept inside the circle, drifting downwind
      const a = Math.sin(t * 0.3 + wi * 2) * 1.2 + Math.atan2(CENTER.z - w.z, CENTER.x - w.x) * 0.35;
      w.vx += (Math.cos(a) * 4.2 + wind.dirX * 1.5 - w.vx) * Math.min(1, dt * 0.6);
      w.vz += (Math.sin(a) * 4.2 + wind.dirZ * 1.5 - w.vz) * Math.min(1, dt * 0.6);
      w.x += w.vx * dt; w.z += w.vz * dt;
      const d = Math.hypot(w.x - CENTER.x, w.z - CENTER.z);
      if (d > ARENA_R - 8) { w.x = CENTER.x + (w.x - CENTER.x) * (ARENA_R - 8) / d; w.z = CENTER.z + (w.z - CENTER.z) * (ARENA_R - 8) / d; }
      const gy = heightAt(w.x, w.z);
      w.funnel.position.set(w.x, gy - 0.5, w.z);
      w.funnel.rotation.y += dt * 5;
      w.funnel.scale.set(w.k, w.k * (1 + 0.06 * Math.sin(t * 3 + wi)), w.k);
      // its debris: a rising spiral
      for (let i = 0; i < 40; i++) {
        const u = ((i / 40) + t * 0.35 + wi * 0.13) % 1, ang = t * 4 + i * 2.4, rr = 1 + u * 5.5;
        _m.compose(_v.set(w.x + Math.cos(ang) * rr, gy + u * 13, w.z + Math.sin(ang) * rr), _q.setFromAxisAngle(_w.set(0.3, 1, 0.2).normalize(), t * 6 + i), _s.setScalar(w.k * (0.6 + (i % 5) * 0.2)));
        this.debris.setMatrixAt(n++, _m);
      }
      // touching it lifts you out of the saddle
      if (live && this.whirlCd <= 0 && Math.hypot(p.x - w.x, p.z - w.z) < WHIRL_R) {
        this.whirlCd = 2;
        this.host.hurt(WHIRL_DMG, 'A whirlwind — ride around them');
        this.host.throwRider();
      }
    }
    this.debris.count = n; this.debris.instanceMatrix.needsUpdate = true;
  }

  // ── a strike from the sky ──
  private bolt(x: number, z: number): void {
    const y = heightAt(x, z);
    this.ctx.weather.fx.bolt({ x, y, z, kind: 'ground' });
    this.ctx.weather.weather.flash = 1;
    this.body.uni.uFlash.value = 1;
    wildEnv.onEvent?.('lightning', x, z);
  }

  /** the storm wall and the fire line the horse will not ride into */
  refuses(x: number, z: number): boolean {
    if (this.sealed && Math.hypot(x - CENTER.x, z - CENTER.z) > ARENA_R - 3) return true;
    return this.fighting && this.phase === 2 && this.burningAt(x, z);
  }
  get sealedNow(): boolean { return this.sealed; }
}

// ─────────────────────────────── the wiring ───────────────────────────────

export interface TitanPlay {
  animals: AnimalManager;
  wildlife: Wildlife | null;
  ride: Ride | null;
  riders?: GhostRiders | null;
  sabre: Sabre | null;
  setWeaponsEnabled: (on: boolean) => void;
  refill: () => void;
  /** main's damage path (health, flash; a toast unless `why` is empty) */
  hurt: (dmg: number, why: string) => void;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  /** Progress.recordKill — the achievement *Weather Report* */
  record?: (kind: string, variant: string) => void;
  /** a won skin (the Sky-Marked Saddle — B15 wears it) */
  ownSkin?: (id: string) => void;
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  pickupHum?: (inside: boolean) => void;
  params: URLSearchParams;
}

export class StormTitan {
  readonly fight: StormTitanFight;
  readonly spareLight = new THREE.PointLight(0xc8dcff, 0, 1, 2);
  ui: BossBar | null = null;
  boss: Boss | null = null;
  naizagai: Naizagai | null = null;
  /** B11's ghost riders (the storm riders ride their rig) — handed in by src/nalati/index.ts */
  riders: GhostRiders | null = null;
  private play: TitanPlay | null = null;
  private readonly prompt: Interactable;
  private wallT = 0;
  private skipTouch = false;
  private hurtWhy = ''; private hurtT = 0;

  constructor(private readonly ctx: TitanCtx) {
    const host: TitanFightHost = {
      player: ctx.player,
      hurt: (d, why) => {
        // the same reason toasts at most every 4 s (the fire ticks twice a second)
        const say = why !== this.hurtWhy || this.hurtT <= 0;
        if (say) { this.hurtWhy = why; this.hurtT = 4; }
        this.play?.hurt(d, say ? why : '');
      },
      throwRider: () => { const m = this.play?.ride?.mount; if (m?.mounted === true) m.dismount(true); },
      mounted: () => this.play?.ride?.mount.mounted === true,
      horseSteed: (d) => { const m = this.play?.ride?.mount; if (m) m.steed = Math.max(0, m.steed + d); },
      feed: (s) => { this.play?.feed(s); },
      toast: (s) => { this.play?.toast(s); },
      riders: () => this.play?.riders ?? this.riders,
      animals: () => this.play?.animals ?? null,
    };
    this.fight = new StormTitanFight(ctx, host);
    this.spareLight.position.set(TITAN.x, -60, TITAN.z);
    ctx.game.scene.add(this.spareLight);
    const spot = this.fight.cairnSpot();
    this.prompt = { position: new THREE.Vector3(spot.x, spot.y + 1.2, spot.z), radius: 0, label: 'Tie a cloth strip', onInteract: () => { this.tie(); } };
  }

  get engaged(): boolean { return this.boss?.engaged === true; }

  bind(play: TitanPlay): void {
    this.play = play;
    const { game, player } = this.ctx;
    const god = play.params.has('bossGod');
    if (god) { const hurt = play.hurt; play.hurt = (d, why) => { if (!this.engaged) hurt(d, why); }; }
    this.naizagai = new Naizagai({
      scene: game.scene, player, camera: game.camera, animals: play.animals,
      storm: () => this.ctx.weather.weather.stormActive,
      bolt: (x, y, z) => { this.ctx.weather.fx.bolt({ x, y, z, kind: 'ground' }); this.ctx.weather.weather.flash = 1; },
    });
    this.ui = new BossBar();
    const def: BossDef = {
      id: 'storm-titan', name: 'JEL ATA · THE STORM TITAN', title: 'FATHER OF THE WIND', retryTitle: 'THE STORM RETURNS',
      phases: TITAN_PHASES, intro: 3.6, introShort: 1.3,
      reward: {
        tier: 'LEGENDARY', name: 'NAIZAGAI', flavour: 'Storm Sabre of Jel Ata', prompt: 'TAKE NAIZAGAI',
        model: () => naizagaiModel(),
        grant: () => {
          if (play.sabre && this.naizagai) this.naizagai.apply(play.sabre);
          play.ownSkin?.('sky-marked-saddle');
          play.toast('Mount skin · SKY-MARKED SADDLE');
        },
      },
    };
    this.boss = new Boss(def, this.fight, {
      scene: game.scene, player, camera: game.camera, renderer: game.renderer, spareLight: this.spareLight,
      lockInput: (on) => { play.setWeaponsEnabled(!on); player.moveScale = on ? 0 : 1; },
      respawn: (pos, yaw) => { this.respawnMounted(pos, yaw); play.refill(); },
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      skipHeld: () => this.skipTouch || player.keys.has('Space') || player.keys.has('KeyE') || player.keys.has('Enter'),
      toast: play.toast, feed: play.feed,
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    }, this.ui, 'nalati-grasslands');
    play.interactables.push(this.prompt);
    if (this.boss.rewardTaken && play.sabre) this.naizagai.apply(play.sabre);
    // the horse refuses the storm wall and the fire line
    const mount = play.ride?.mount;
    if (mount) { const prev = mount.refuse; mount.refuse = (x, z) => this.fight.refuses(x, z) || (prev?.(x, z) ?? false); }
    window.addEventListener('pointerdown', () => { this.skipTouch = true; });
    window.addEventListener('pointerup', () => { this.skipTouch = false; });
    window.addEventListener('pointercancel', () => { this.skipTouch = false; });
    // dev: `?boss=storm-titan` — a storm, mounted at the cairn, the strip tied; `&bossPhase=2|3` at that checkpoint
    if (play.params.get('boss') === 'storm-titan') {
      this.ctx.weather.weather.force('storm', 0.1);
      const r = this.fight.respawnPoint();
      this.respawnMounted(r.pos, r.yaw);
      this.fight.tied = true;
      const ph = Number(play.params.get('bossPhase') ?? '1');
      if (ph > 1) this.boss.devStartAt(ph - 1); else this.boss.arm();
    }
    (window as unknown as { __titan: unknown }).__titan = this;
  }

  /** a death: in the fight → back at the cairn, mounted (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  /** the cairn's prompt: only mounted, only in a natural storm */
  private tie(): void {
    const play = this.play, boss = this.boss;
    if (!play || !boss || this.engaged || boss.state === 'victory' && boss.reward !== null) return;
    if (play.ride?.mount.mounted !== true) { play.toast('The wind wants a rider'); return; }
    if (!this.ctx.weather.weather.stormActive) { play.toast('The wind is quiet — come back in a storm'); return; }
    this.fight.tied = true;
    if (boss.state === 'victory') boss.disarm();
    boss.arm();
    play.toast('The strip snaps in the wind — JEL ATA wakes');
  }

  /** back at the cairn in the saddle: Tulpar / Argymaq if you have him, else a camp horse */
  private respawnMounted(pos: THREE.Vector3, yaw: number): void {
    const { player } = this.ctx;
    player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0;
    const ride = this.play?.ride, w = this.play?.wildlife;
    if (!ride) return;
    const m = ride.mount;
    if (m.mounted) m.dismount();
    const horses = [ride.taming.tulpar, ...(w?.campHorses ?? [])];
    for (const h of horses) {
      if (h === null || !m.canRide(h)) continue;
      h.place(pos.x, pos.z, yaw + Math.PI);
      if (m.mount(h)) { m.teleport(pos.x, pos.z, yaw + Math.PI); m.steed = 100; m.winded = false; return; }
    }
  }

  update(dt: number, t: number): void {
    const boss = this.boss, play = this.play;
    this.naizagai?.update(dt, t);
    this.hurtT -= dt;
    if (!boss || !play) return;
    // the cairn's prompt (label by the situation; hidden while the fight is on)
    const mounted = play.ride?.mount.mounted === true, storm = this.ctx.weather.weather.stormActive;
    this.prompt.radius = this.engaged || (boss.state === 'armed' && this.fight.tied) ? 0 : 4.6;
    this.prompt.label = !mounted ? 'Tie a cloth strip · the wind wants a rider' : !storm ? 'Tie a cloth strip · the wind is quiet' : 'Tie a cloth strip';
    // the storm ended before you rode in: the strip is just a strip
    if (boss.state === 'armed' && !storm) { this.fight.tied = false; boss.disarm(); }
    // left the arena while armed (not yet fighting): forget it
    const p = this.ctx.player.position;
    const away = Math.hypot(p.x - CENTER.x, p.z - CENTER.z);
    if (boss.state === 'armed' && away > ARENA_R + 30) { this.fight.tied = false; boss.disarm(); }
    // on foot at the wall: it stings and throws you back
    this.wallT -= dt;
    if (this.engaged && this.fight.sealedNow && away > ARENA_R - 2.5 && !mounted) {
      const k = (ARENA_R - 4) / away;
      p.x = CENTER.x + (p.x - CENTER.x) * k; p.z = CENTER.z + (p.z - CENTER.z) * k;
      if (this.wallT <= 0) { this.wallT = 1.2; play.hurt(10, 'The storm wall throws you back'); }
    }
    if (boss.state === 'victory' && this.fight.tied) {
      // the rain curtain: the storm lets go and clears
      this.fight.tied = false;
      this.ctx.weather.weather.force('clearing');
      play.record?.('storm-titan', 'jel-ata');
    }
    if (boss.state !== 'dormant' || this.fight.body.visible) boss.update(dt, t);
    else this.fight.update(dt, t, false);
  }

  /** the heart in main's Targets chain */
  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null { return this.fight.target(origin, dir, maxDist, hit); }
}

/** the wiring's one call (src/nalati/index.ts): the Titan's meshes built at boot (before the precompile), bound later */
export function wireStormTitan(ctx: TitanCtx): StormTitan { return new StormTitan(ctx); }
