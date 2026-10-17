import { app } from '@wildshard/engine/app/runtime';
import { TIER } from '@wildshard/engine/core/tier';

/**
 * The Storm Titan's look (NALATI.md B14 "look is a first pass"; mockups art/nalati-grasslands/round-3/2-storm-titan/):
 * a towering giant of DARK cumulus with lightning veins crawling over him and a glowing spiral heart, and the phase-3
 * grass fire as rolling flame fronts under columns of smoke. Visuals only — stormTitan.ts keeps every rule of the fight.
 *
 * Both draw on look.materials graphs (data/lookGraphs.json `nalati-titan-cloud`, `-flame`, `-smoke`, authored as data;
 * the noise is the old tH3 value noise and its 3-octave fbm, node for node):
 *
 *   titanCloudMaterial()      the body's cloud (on its instanced puffs, each puff's albedo in `aAlbedo`): the unit
 *                             puff is displaced into cauliflower lumps by 3D noise, its normal bumped by world noise, lit
 *                             as a storm cloud (near-black crevices, slate body, silver crowns), the heart's spiral glow
 *                             in the cloud round it, and lightning veins — ridged world noise, flickering in patches,
 *                             blazing on his flashes
 *   GrassFireFx               the fire: per burning cell a cluster of three 3D flame tongues (lathed shells, additive,
 *                             soft at the silhouette like a volume, licking and leaning downwind; the downwind front
 *                             stands tallest), and a pool of rising smoke puffs (real meshes, soft transparent volumes,
 *                             lit orange from below while young, drifting and swelling downwind)
 *
 * No billboards: the tongues and the smoke are 3D meshes seen from any side (the user's look rule 1).
 */
import * as THREE from 'three';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

/** the look.materials graphs (data/lookGraphs.json, lent by runtime/index.ts): the body's cloud, the flames, the smoke */
const CLOUD = 'nalati-titan-cloud', FLAME = 'nalati-titan-flame', SMOKE = 'nalati-titan-smoke';

const PHONE = TIER === 'phone';

/** the cloud's live inputs (the fight writes them; `syncTitanCloud` hands them to the graph once a frame) */
export interface TitanCloudUniforms {
  uT: { value: number }; uHeart: { value: THREE.Vector3 }; uGlow: { value: number }; uFlash: { value: number };
  uAlpha: { value: number }; uFogC: { value: THREE.Color }; uFog: { value: number };
}

/** the body's cloud look; each puff's albedo (how exposed it is: the core of him is dark) rides the `aAlbedo` instance attribute */
export function titanCloudMaterial(): THREE.Material { return lentLook(CLOUD); }

/** the puffs' albedo attribute (per instance, linear) on `geo` */
export function setTitanAlbedo(geo: THREE.BufferGeometry, colours: readonly (readonly [number, number, number])[]): void {
  geo.setAttribute('aAlbedo', new THREE.InstancedBufferAttribute(new Float32Array(colours.flat()), 3));
}

/** the cloud's params from the fight's live values */
export function syncTitanCloud(u: TitanCloudUniforms): void {
  const h = u.uHeart.value, c = u.uFogC.value;
  setLentParam(CLOUD, 't', u.uT.value); setLentParam(CLOUD, 'heart', [h.x, h.y, h.z]); setLentParam(CLOUD, 'glow', u.uGlow.value);
  setLentParam(CLOUD, 'flash', u.uFlash.value); setLentParam(CLOUD, 'alpha', u.uAlpha.value);
  setLentParam(CLOUD, 'fogC', [c.r, c.g, c.b]); setLentParam(CLOUD, 'fog', u.uFog.value);
}

// ── the grass fire ──────────────────────────────────────────────────────────────────────────────────────────────────

interface SmokeP { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; r0: number; r1: number; glow: number; seed: number; on: boolean }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** the phase-3 fire's flames and smoke; the fight feeds it the burning cells each frame */
export class GrassFireFx {
  readonly flames: THREE.InstancedMesh;
  readonly smoke: THREE.InstancedMesh;
  private readonly flameData: THREE.InstancedBufferAttribute;
  private readonly smokeData: THREE.InstancedBufferAttribute;
  private readonly wind = new THREE.Vector2();
  private readonly pool: SmokeP[] = [];
  private n = 0;
  private next = 0;

  constructor(scene: THREE.Scene, maxFlames: number, private readonly fogC: { value: THREE.Color }, private readonly flash: { value: number }, flames: unknown) {
    // per instance (aInst): the flames' heat 0..1, front (1 = the downwind edge) and seed; the smoke's age, fire glow and seed
    const flameGeo = new THREE.BufferGeometryLoader().parse(flames);
    this.flameData = new THREE.InstancedBufferAttribute(new Float32Array(maxFlames * 3), 3);
    flameGeo.setAttribute('aInst', this.flameData);
    this.flames = new THREE.InstancedMesh(flameGeo, lentLook(FLAME), maxFlames);
    this.flames.frustumCulled = false; this.flames.count = 0; this.flames.renderOrder = 14; this.flames.name = 'titan-flames';
    scene.add(this.flames);
    const nSmoke = PHONE ? 90 : 200;
    const smokeGeo = new THREE.IcosahedronGeometry(1, PHONE ? 1 : 2);
    this.smokeData = new THREE.InstancedBufferAttribute(new Float32Array(nSmoke * 3), 3);
    smokeGeo.setAttribute('aInst', this.smokeData);
    this.smoke = new THREE.InstancedMesh(smokeGeo, lentLook(SMOKE), nSmoke);
    this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.name = 'titan-smoke';
    scene.add(this.smoke);
    for (let i = 0; i < nSmoke; i++) this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, r0: 1, r1: 1, glow: 0, seed: 0, on: false });
  }

  /** start a frame's flames */
  begin(): void { this.n = 0; }

  /** one burning cell's flame cluster: `heat` 0..1 (it rises, roars, dies to embers), `front` 1 on the downwind edge */
  flame(x: number, y: number, z: number, cell: number, heat: number, front: number, size: number): void {
    if (this.n >= this.flames.instanceMatrix.count) return;
    const k = size * (0.75 + 0.55 * front) * (0.55 + 0.45 * heat);
    _q.setFromAxisAngle(_y, cell * 0.7);
    _m.compose(_p.set(x, y, z), _q, _s.set(k * 1.25, k, k * 1.25));
    this.flames.setMatrixAt(this.n, _m);
    this.flameData.setXYZ(this.n, heat, front, (cell * 0.618) % 1);
    this.n++;
  }

  end(): void {
    this.flames.count = this.n;
    this.flames.instanceMatrix.needsUpdate = true;
    this.flameData.needsUpdate = true;
  }

  /** a smoke puff leaves a burning cell */
  puff(x: number, y: number, z: number, strength: number): void {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    if (!p) return;
    p.on = true; p.x = x + (app.rng.stream('cosmetic').next() - 0.5) * 2; p.y = y + 1.2; p.z = z + (app.rng.stream('cosmetic').next() - 0.5) * 2;
    p.vx = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vz = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vy = 3.2 + app.rng.stream('cosmetic').next() * 2;
    p.age = 0; p.life = 5 + app.rng.stream('cosmetic').next() * 3.5; p.r0 = 1.1 + app.rng.stream('cosmetic').next() * 0.8; p.r1 = (5 + app.rng.stream('cosmetic').next() * 4) * (0.7 + 0.4 * strength);
    p.glow = strength; p.seed = app.rng.stream('cosmetic').next();
  }

  update(dt: number, t: number, windX: number, windZ: number, windSpeed: number): void {
    this.wind.set(windX, windZ).multiplyScalar(Math.min(0.5, 0.12 + 0.025 * windSpeed));
    const c = this.fogC.value;
    setLentParam(FLAME, 't', t); setLentParam(FLAME, 'wind', [this.wind.x, this.wind.y]);
    setLentParam(SMOKE, 't', t); setLentParam(SMOKE, 'fogC', [c.r, c.g, c.b]); setLentParam(SMOKE, 'flash', this.flash.value);
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.age += dt / p.life;
      if (p.age >= 1) { p.on = false; continue; }
      // it rises, slows, and the wind takes it (rolling downwind as a column)
      p.vy *= 1 - dt * 0.25;
      p.x += (p.vx + windX * windSpeed * 0.55 * p.age) * dt; p.z += (p.vz + windZ * windSpeed * 0.55 * p.age) * dt; p.y += p.vy * dt;
      const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(p.age);
      _q.setFromAxisAngle(_y, p.seed * 6.28 + t * 0.2);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(r, r * 0.85, r));
      this.smoke.setMatrixAt(n, _m);
      this.smokeData.setXYZ(n, p.age, p.glow, p.seed);
      n++;
    }
    this.smoke.count = n;
    this.smoke.instanceMatrix.needsUpdate = true;
    this.smokeData.needsUpdate = true;
  }

  /** the fire is out (the smoke already aloft keeps rising and thins) */
  out(): void { this.n = 0; this.flames.count = 0; }
  /** a reset: nothing burning, no smoke */
  clear(): void { this.out(); for (const p of this.pool) p.on = false; this.smoke.count = 0; }
}
