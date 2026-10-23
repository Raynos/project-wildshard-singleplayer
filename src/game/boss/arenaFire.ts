/** Client-only instanced arena flames, smoke and whirlwinds. No fight decisions or hazard ownership. */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import { ProjectedState, type ReturnProgram } from '../population/returnProgram';
import type { ArenaWhirlsRows,ArenaFireRows } from '@wildshard/format/encounterRows';

/** The phase-3 fire's instanced flames and smoke (each copy's aInst: the flames' heat, front and seed, the smoke's age,
 *  glow and seed) and their looks. The fight's fire view module draws them (Nalati zero R6: behaviour/titanFireView). */
export class ArenaFireView {
  readonly flames: THREE.InstancedMesh;
  readonly smoke: THREE.InstancedMesh;
  private readonly wind = new THREE.Vector2();

  readonly rows: ArenaFireRows;
  constructor(scene: THREE.Scene, input: ArenaFireRows, flames: unknown) {
    const rows = input;
    if (rows.life[0] <= 0 || rows.life[1] < 0) throw new Error('Invalid smoke lifetime');
    this.rows = rows;
    const flameGeo = new THREE.BufferGeometryLoader().parse(flames);
    flameGeo.setAttribute('aInst', new THREE.InstancedBufferAttribute(new Float32Array(rows.flameCount * 3), 3));
    this.flames = new THREE.InstancedMesh(flameGeo, lentLook(rows.flameLook), rows.flameCount);
    this.flames.frustumCulled = false; this.flames.count = 0; this.flames.renderOrder = 14; this.flames.name = rows.flameLook;
    scene.add(this.flames);
    const nSmoke = TIER === 'phone' ? rows.smokeCount[0] : rows.smokeCount[1];
    const smokeGeo = new THREE.IcosahedronGeometry(1, TIER === 'phone' ? rows.smokeDetail[0] : rows.smokeDetail[1]);
    smokeGeo.setAttribute('aInst', new THREE.InstancedBufferAttribute(new Float32Array(nSmoke * 3), 3));
    this.smoke = new THREE.InstancedMesh(smokeGeo, lentLook(rows.smokeLook), nSmoke);
    this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.name = rows.smokeLook;
    scene.add(this.smoke);
  }

  /** the looks' clock, wind, fog colour and flash, once a frame */
  update(t: number, windX: number, windZ: number, windSpeed: number, fog: THREE.Color, flash: number): void {
    this.wind.set(windX, windZ).multiplyScalar(Math.min(0.5, 0.12 + 0.025 * windSpeed));
    setLentParam(this.rows.flameLook, 't', t); setLentParam(this.rows.flameLook, 'wind', [this.wind.x, this.wind.y]);
    setLentParam(this.rows.smokeLook, 't', t); setLentParam(this.rows.smokeLook, 'fogC', [fog.r, fog.g, fog.b]); setLentParam(this.rows.smokeLook, 'flash', flash);
  }
}

/** Whirlwinds: one admitted wander law each (`laws`, sharing the first's cooldown `cd`), a funnel that eases in at `ease`/s
 *  and shows above .02. The fight's whirl view module draws the funnels' turn, breathe and sink and their debris spiral
 *  (Nalati zero R6: behaviour/titanWhirlsView) from what `drawn` holds after each update. */
/** The whirlwinds' funnels (the caller's meshes, one per law) and debris (its instanced mesh), moved by their laws. */
export class ArenaWhirlsView {
  private readonly rows: ArenaWhirlsRows;
  private readonly whirls: { readonly law: ProjectedState; readonly funnel: THREE.Object3D; on: boolean; k: number }[];
  private readonly hits: THREE.Vector3[] = [];
  /** per whirlwind after the last update: its ease, whether it shows, and where it stands (x, the ground, z) */
  readonly drawn: { k: number; shown: number; x: number; y: number; z: number }[];
  /** the funnels and the debris, for the view module the fight lends them to */
  readonly funnels: readonly THREE.Object3D[];
  constructor(input: ArenaWhirlsRows, program: ReturnProgram, funnels: readonly THREE.Object3D[], readonly debris: THREE.InstancedMesh) {
    this.rows = input; this.funnels = funnels; this.drawn = funnels.map(() => ({ k: 0, shown: 0, x: 0, y: 0, z: 0 }));
    if (funnels.length !== this.rows.laws.length || debris.instanceMatrix.count < this.rows.laws.length * this.rows.debris.count) throw new Error('Whirlwinds need a funnel each and room for their debris');
    this.whirls = this.rows.laws.map((row, i) => {
      const funnel = funnels[i]; if (funnel === undefined) throw new Error('Missing whirlwind funnel');
      return { law: new ProjectedState(row, program), funnel, on: false, k: 0 };
    });
  }
  /** Which whirlwinds blow (bit i: whirlwind i). */
  arm(mask: number): void { this.whirls.forEach((w, i) => { w.on = (mask & (1 << i)) !== 0; }); }
  reset(): void { for (const [i, w] of this.whirls.entries()) { w.on = false; w.funnel.visible = false; const d = this.drawn[i]; if (d !== undefined) d.shown = 0; } this.debris.count = 0; }
  /** Ease and gate them and step the shown ones' laws on a decision tick (`thinkDt` > 0) with `frame` (wx, wz, px, pz); the
   *  view module then draws them from `drawn`. The whirlwinds that touch the player this tick, where they stand. */
  update(dt: number, t: number, live: boolean, thinkDt: number, frame: { readonly wx: number; readonly wz: number; readonly px: number; readonly pz: number }): readonly THREE.Vector3[] {
    const rows = this.rows, shared = this.whirls[0]?.law;
    let hit = 0;
    for (let i = 0; i < this.whirls.length; i++) {
      const w = this.whirls[i], drawn = this.drawn[i]; if (w === undefined || drawn === undefined) continue;
      w.k += ((live && w.on ? 1 : 0) - w.k) * Math.min(1, dt * rows.ease);
      w.funnel.visible = w.k > 0.02;
      drawn.k = w.k; drawn.shown = Number(w.funnel.visible);
      if (!w.funnel.visible) continue;
      let hurt = false;
      if (thinkDt > 0) {
        const result = w.law.project({ dt: thinkDt, t, index: i, wx: frame.wx, wz: frame.wz, cd: shared?.value('cd') ?? 0, hit: Number(i === 0), px: frame.px, pz: frame.pz, open: Number(live) });
        if (result['broke'] === 1) shared?.set({ cd: result['cd'] ?? 0 });
        hurt = result['hurt'] === 1;
      }
      const x = w.law.value('x'), z = w.law.value('z'), y = heightAt(x, z);
      drawn.x = x; drawn.y = y; drawn.z = z;
      if (hurt) { const at = this.hits[hit] ?? new THREE.Vector3(); this.hits[hit++] = at.set(x, y, z); }
    }
    this.hits.length = hit;
    return this.hits;
  }
}
