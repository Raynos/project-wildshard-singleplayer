/** Client-only instanced arena flames, smoke and whirlwinds. No fight decisions or hazard ownership. */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import type { ReturnProgram } from '../population/returnProgram';
import { ArenaWhirls, type WhirlFrame } from './arenaWhirls';
import type {Scope} from '@wildshard/engine/app/scope';
import {presentEntryOwner,publishEntryOwner} from '../shardfile/entryOwners';
import {preflightViewLends,lendViewValues,lendViewDraw,lendViewFrame} from '../shardfile/clientViewProgram';
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

/** Whirlwinds: their laws and gate are ArenaWhirls (arenaWhirls.ts, renderer-free); this view holds the caller's funnel
 *  meshes (one per law) and debris (its instanced mesh), shows each funnel above .02 of its ease, and lends them to the
 *  fight's whirl view module, which draws their turn, breathe and sink and the debris spiral (Nalati zero R6:
 *  behaviour/titanWhirlsView) from what `drawn` holds after each update. */
export class ArenaWhirlsView {
  private readonly rows: ArenaWhirlsRows;
  private viewFrame:ReturnType<typeof lendViewFrame>|null=null;
  private readonly hits: THREE.Vector3[] = [];
  /** the laws and gate the funnels follow */
  readonly whirls: ArenaWhirls;
  /** per whirlwind after the last update: its ease, whether it shows, and where it stands (x, the ground, z) */
  get drawn(): ArenaWhirls['drawn'] { return this.whirls.drawn; }
  /** the funnels and the debris, for the view module the fight lends them to */
  readonly funnels: readonly THREE.Object3D[];
  constructor(input: ArenaWhirlsRows, program: ReturnProgram, funnels: readonly THREE.Object3D[], readonly debris: THREE.InstancedMesh, gateProgram: ReturnProgram,private readonly nativeScope:Scope) {
    this.live();ArenaWhirlsView.preflight(input);
    if (funnels.length !== input.laws.length || debris.instanceMatrix.count < input.laws.length * input.debris.count) throw new Error('Whirlwinds need a funnel each and room for their debris');
    this.rows = input; this.funnels = funnels;
    this.whirls = new ArenaWhirls(input, program, gateProgram, nativeScope);
  }
  private live():void{if(this.nativeScope.disposed||this.nativeScope.disposing)throw new Error('Whirlwind native owner has ended');}
  /** Admit all gate references before the caller allocates native resources. */
  static preflight(rows:ArenaWhirlsRows,program?:ReturnType<typeof ReturnProgram.projectionBindings>):void{ ArenaWhirls.preflight(rows,program); }
  /** Lend only this owner's concrete resources on the entered view scope.
   * Names/field aliases and the inline frame slot are admitted rows. */
  bindView(scope:Scope):void{
    this.live();if(!scope.belongsTo(this.nativeScope))throw new Error('Whirlwind view requires its construction ancestor');
    const rows=this.rows.view;
    preflightViewLends(scope,{values:[rows.source],draws:[rows.draw],frames:[rows.slot]});
    if(this.viewFrame!==null||rows.slots.some(slot=>presentEntryOwner(scope,'object',slot.object)!==null))throw new Error('Whirlwind view already bound');
    const fields=new Map<string,{row:ArenaWhirls['drawn'][number];key:keyof ArenaWhirls['drawn'][number]}>();
    const objects=rows.slots.map((slot,i)=>{
      const row=this.drawn[i],object=this.funnels[i];if(row===undefined||object===undefined)throw new Error('Missing whirlwind view resource');
      for(const key of ['k','shown','x','y','z'] as const)fields.set(slot.fields[key],{row,key});return {id:slot.object,object};
    });
    lendViewValues(scope,rows.source,name=>{const field=fields.get(name);return field===undefined?Number.NaN:field.row[field.key];});
    for(const {id,object}of objects)publishEntryOwner(scope,'object',id,object);
    lendViewDraw(scope,rows.draw,this.debris);
    const frame=this.viewFrame=lendViewFrame(scope,rows.slot);scope.onDispose(()=>{if(this.viewFrame===frame)this.viewFrame=null;});
  }
  /** Which whirlwinds blow (bit i: whirlwind i), at the original arm slot. */
  arm(mask: number): void { this.whirls.arm(mask); }
  reset(): void { this.whirls.reset(); for (const funnel of this.funnels) funnel.visible = false; this.debris.count = 0; }
  /** The laws' update (ArenaWhirls.update), each funnel shown as its whirlwind is, then the view module's frame. The
   *  whirlwinds that touch the player this tick, where they stand. */
  update(dt: number, t: number, live: boolean, thinkDt: number, frame: WhirlFrame): readonly THREE.Vector3[] {
    const hits = this.whirls.update(dt, t, live, thinkDt, frame);
    for (let i = 0; i < this.funnels.length; i++) { const funnel = this.funnels[i]; if (funnel !== undefined) funnel.visible = this.drawn[i]?.shown === 1; }
    for (let i = 0; i < hits.length; i++) { const hit = hits[i]; if (hit !== undefined) this.hits[i] = (this.hits[i] ?? new THREE.Vector3()).set(hit.x, hit.y, hit.z); }
    this.hits.length = hits.length;this.live();this.viewFrame?.frame(dt,t);
    return this.hits;
  }
}
