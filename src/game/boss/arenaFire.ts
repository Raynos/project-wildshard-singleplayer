/** Client-only instanced arena flames, smoke and whirlwinds. No fight decisions or hazard ownership. */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import { ProjectedState, type ReturnProgram } from '../population/returnProgram';
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

/** Whirlwinds: one admitted wander law each (`laws`, sharing the first's cooldown `cd`), a funnel that eases in at `ease`/s
 *  and shows above .02. The fight's whirl view module draws the funnels' turn, breathe and sink and their debris spiral
 *  (Nalati zero R6: behaviour/titanWhirlsView) from what `drawn` holds after each update. */
/** The whirlwinds' funnels (the caller's meshes, one per law) and debris (its instanced mesh), moved by their laws. */
export class ArenaWhirlsView {
  private readonly rows: ArenaWhirlsRows;
  private readonly whirls: { readonly law: ProjectedState; readonly funnel: THREE.Object3D }[];
  private readonly gate:ProjectedState;
  private viewFrame:ReturnType<typeof lendViewFrame>|null=null;
  private readonly hits: THREE.Vector3[] = [];
  /** per whirlwind after the last update: its ease, whether it shows, and where it stands (x, the ground, z) */
  readonly drawn: { k: number; shown: number; x: number; y: number; z: number }[];
  /** the funnels and the debris, for the view module the fight lends them to */
  readonly funnels: readonly THREE.Object3D[];
  constructor(input: ArenaWhirlsRows, program: ReturnProgram, funnels: readonly THREE.Object3D[], readonly debris: THREE.InstancedMesh, gateProgram: ReturnProgram,private readonly nativeScope:Scope) {
    this.live();ArenaWhirlsView.preflight(input);const gate=input.gate;
    this.gate=new ProjectedState({...gate.law,signals:{step:gate.law.signal,arm:gate.arm},signal:'step',outputs:Object.keys(gate.law.retain)},gateProgram);
    this.rows = input; this.funnels = funnels; this.drawn = funnels.map(() => ({ k: 0, shown: 0, x: 0, y: 0, z: 0 }));
    if (funnels.length !== this.rows.laws.length || debris.instanceMatrix.count < this.rows.laws.length * this.rows.debris.count) throw new Error('Whirlwinds need a funnel each and room for their debris');
    this.whirls = this.rows.laws.map((row, i) => {
      const funnel = funnels[i]; if (funnel === undefined) throw new Error('Missing whirlwind funnel');
      return { law: new ProjectedState(row, program), funnel };
    });
  }
  private live():void{if(this.nativeScope.disposed||this.nativeScope.disposing)throw new Error('Whirlwind native owner has ended');}
  /** Admit all gate references before the caller allocates native resources. */
  static preflight(rows:ArenaWhirlsRows,program?:ReturnType<typeof ReturnProgram.projectionBindings>):void{
    const view=rows.view,fields=view.slots.flatMap(slot=>Object.values(slot.fields)),objects=view.slots.map(slot=>slot.object);
    if(view.slots.length!==rows.laws.length||new Set(fields).size!==fields.length||new Set(objects).size!==objects.length)throw new Error('Conflicting whirlwind view binding');
    const gate=rows.gate,targets=Object.values(gate.law.retain),slots=gate.slots.flatMap(slot=>[slot.weight,slot.armed,slot.shown]),inputs=Object.values(gate.inputs);
    if(gate.slots.length!==rows.laws.length||gate.law.parameters[gate.inputs.count]!==gate.slots.length||new Set(targets).size!==targets.length||new Set(slots).size!==slots.length||slots.some(slot=>!targets.includes(slot))||new Set(inputs).size!==inputs.length)throw new Error('Conflicting whirlwind gate binding');
    if(program!==undefined&&[...inputs,...Object.keys(gate.law.initial),...Object.keys(gate.law.parameters)].some(name=>!Object.values(program.script.fields).includes(name)))throw new Error('Missing whirlwind gate input');
    ProjectedState.preflight({...gate.law,signals:{step:gate.law.signal,arm:gate.arm},signal:'step',outputs:Object.keys(gate.law.retain)},program);
  }
  /** Lend only this owner's concrete resources on the entered view scope.
   * Names/field aliases and the inline frame slot are admitted rows. */
  bindView(scope:Scope):void{
    this.live();if(!scope.belongsTo(this.nativeScope))throw new Error('Whirlwind view requires its construction ancestor');
    const rows=this.rows.view;
    preflightViewLends(scope,{values:[rows.source],draws:[rows.draw],frames:[rows.slot]});
    if(this.viewFrame!==null||rows.slots.some(slot=>presentEntryOwner(scope,'object',slot.object)!==null))throw new Error('Whirlwind view already bound');
    const fields=new Map<string,{row:ArenaWhirlsView['drawn'][number];key:keyof ArenaWhirlsView['drawn'][number]}>();
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
  arm(mask: number): void { this.live();this.gate.event('arm',{[this.rows.gate.inputs.mask]:mask|0}); }
  reset(): void { this.arm(0);for (const [i, w] of this.whirls.entries()) { w.funnel.visible = false; const d = this.drawn[i]; if (d !== undefined) d.shown = 0; } this.debris.count = 0; }
  /** Ease and gate them and step the shown ones' laws on a decision tick (`thinkDt` > 0) with `frame` (wx, wz, px, pz); the
   *  view module then draws them from `drawn`. The whirlwinds that touch the player this tick, where they stand. */
  update(dt: number, t: number, live: boolean, thinkDt: number, frame: { readonly wx: number; readonly wz: number; readonly px: number; readonly pz: number }): readonly THREE.Vector3[] {
    this.live();const rows = this.rows, shared = this.whirls[0]?.law;
    let hit = 0;
    for (let i = 0; i < this.whirls.length; i++) {
      const w = this.whirls[i], drawn = this.drawn[i],slot=rows.gate.slots[i]; if (w === undefined || drawn === undefined||slot===undefined) continue;
      const inputs=rows.gate.inputs;this.gate.project({[inputs.delta]:dt,[inputs.live]:Number(live),[inputs.ease]:rows.ease,[inputs.index]:i});
      w.funnel.visible=this.gate.value(slot.shown)===1;drawn.k=this.gate.value(slot.weight);drawn.shown=Number(w.funnel.visible);
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
    this.hits.length = hit;this.live();this.viewFrame?.frame(dt,t);
    return this.hits;
  }
}
