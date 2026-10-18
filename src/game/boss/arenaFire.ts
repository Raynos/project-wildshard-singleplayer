/** Client-only instanced arena flames and smoke. No fight decisions or hazard ownership. */
import * as THREE from 'three';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import { TIER } from '@wildshard/engine/core/tier';
import { lentLook, setLentParam } from '../shardfile/lentLooks';

const finite = v.pipe(v.number(), v.finite());
const pair = v.tuple([finite,finite]);
const count = v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(65536));
/** Strict bounds protect allocation and pool modulo before drawing. */
export const ArenaFireSchema = v.strictObject({
 flameLook: v.string(), smokeLook: v.string(), flameCount: count,
 smokeCount: v.tuple([count,count]), smokeDetail: v.tuple([v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3)),v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3))]),
 front: pair, heat: pair, flameWidth: finite, life: pair, rise: pair, radius: pair, expansion: pair,
});
/** Native mesh capacity, graph ids and presentation tuning, supplied as data. */
export type ArenaFireRows = v.InferOutput<typeof ArenaFireSchema>;
interface SmokeP { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; r0: number; r1: number; glow: number; seed: number; on: boolean }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

/** the phase-3 fire's flames and smoke; the fight feeds it the burning cells each frame */
export class ArenaFireView {
  readonly flames: THREE.InstancedMesh;
  readonly smoke: THREE.InstancedMesh;
  private readonly flameData: THREE.InstancedBufferAttribute;
  private readonly smokeData: THREE.InstancedBufferAttribute;
  private readonly wind = new THREE.Vector2();
  private readonly pool: SmokeP[] = [];
  private n = 0;
  private next = 0;

  readonly rows: ArenaFireRows;
  constructor(scene: THREE.Scene, input: unknown, flames: unknown) {
    const rows = v.parse(ArenaFireSchema, input);
    if (rows.life[0] <= 0 || rows.life[1] < 0) throw new Error('Invalid smoke lifetime');
    this.rows = rows;
    // per instance (aInst): the flames' heat 0..1, front (1 = the downwind edge) and seed; the smoke's age, fire glow and seed
    const flameGeo = new THREE.BufferGeometryLoader().parse(flames);
    this.flameData = new THREE.InstancedBufferAttribute(new Float32Array(rows.flameCount * 3), 3);
    flameGeo.setAttribute('aInst', this.flameData);
    this.flames = new THREE.InstancedMesh(flameGeo, lentLook(rows.flameLook), rows.flameCount);
    this.flames.frustumCulled = false; this.flames.count = 0; this.flames.renderOrder = 14; this.flames.name = rows.flameLook;
    scene.add(this.flames);
    const nSmoke = TIER === 'phone' ? rows.smokeCount[0] : rows.smokeCount[1];
    const smokeGeo = new THREE.IcosahedronGeometry(1, TIER === 'phone' ? rows.smokeDetail[0] : rows.smokeDetail[1]);
    this.smokeData = new THREE.InstancedBufferAttribute(new Float32Array(nSmoke * 3), 3);
    smokeGeo.setAttribute('aInst', this.smokeData);
    this.smoke = new THREE.InstancedMesh(smokeGeo, lentLook(rows.smokeLook), nSmoke);
    this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.name = rows.smokeLook;
    scene.add(this.smoke);
    for (let i = 0; i < nSmoke; i++) this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, r0: 1, r1: 1, glow: 0, seed: 0, on: false });
  }

  /** start a frame's flames */
  begin(): void { this.n = 0; }

  /** one burning cell's flame cluster: `heat` 0..1 (it rises, roars, dies to embers), `front` 1 on the downwind edge */
  flame(x: number, y: number, z: number, cell: number, heat: number, front: number, size: number): void {
    if (this.n >= this.flames.instanceMatrix.count) return;
    const k = size * (this.rows.front[0] + this.rows.front[1] * front) * (this.rows.heat[0] + this.rows.heat[1] * heat);
    _q.setFromAxisAngle(_y, cell * 0.7);
    _m.compose(_p.set(x, y, z), _q, _s.set(k * this.rows.flameWidth, k, k * this.rows.flameWidth));
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
    p.vx = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vz = (app.rng.stream('cosmetic').next() - 0.5) * 0.6; p.vy = this.rows.rise[0] + app.rng.stream('cosmetic').next() * this.rows.rise[1];
    p.age = 0; p.life = this.rows.life[0] + app.rng.stream('cosmetic').next() * this.rows.life[1]; p.r0 = this.rows.radius[0] + app.rng.stream('cosmetic').next() * this.rows.radius[1]; p.r1 = (this.rows.expansion[0] + app.rng.stream('cosmetic').next() * this.rows.expansion[1]) * (0.7 + 0.4 * strength);
    p.glow = strength; p.seed = app.rng.stream('cosmetic').next();
  }

  update(dt: number, t: number, windX: number, windZ: number, windSpeed: number, fog: THREE.Color, flash: number): void {
    this.wind.set(windX, windZ).multiplyScalar(Math.min(0.5, 0.12 + 0.025 * windSpeed));
    const c = fog;
    setLentParam(this.rows.flameLook, 't', t); setLentParam(this.rows.flameLook, 'wind', [this.wind.x, this.wind.y]);
    setLentParam(this.rows.smokeLook, 't', t); setLentParam(this.rows.smokeLook, 'fogC', [c.r, c.g, c.b]); setLentParam(this.rows.smokeLook, 'flash', flash);
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
