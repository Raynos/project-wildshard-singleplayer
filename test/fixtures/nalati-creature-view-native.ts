import * as v from 'valibot';
import type {Scope} from '../../src/engine/app/scope';
import type {AnimalSim} from '../../src/engine/entities/AnimalSim';
import {ViewLane} from '../../src/engine/script/viewLane';
import {admitScriptV2} from '../../src/format/scriptAdmissionV2';
import {ViewProgramSchema} from '../../src/format/viewProgram';
import {hashImmutableBytes} from '../../src/sdk/immutable';

const natural=v.pipe(v.number(),v.integer(),v.minValue(0));
const Saved=v.strictObject({version:v.literal(1),source:v.string(),recipe:v.string(),frames:v.pipe(natural,v.maxValue(60_000)),
  dt:v.pipe(v.number(),v.finite(),v.minValue(0)),memory:v.pipe(v.array(v.pipe(natural,v.maxValue(255))),v.length(65536)),
  slots:v.array(v.array(v.nullable(v.string())))});

/** The admitted creature-view guest, including its height channels. No scene,
 * replacement body or alternative rise/death arithmetic is supplied. Native
 * views run every fixed frame, like the existing native arena view.
 *
 * The guest's one mutable WASM global is its additive frame clock. A fresh
 * lane replays only absent presentation samples to recover that clock, then
 * adopts the original fixed memory. This touches no body, RNG, world, command
 * or outcome. Live slot identities are restored from the actual roster.
 */
export class NalatiCreatureView {
  private readonly rows;
  private readonly source;
  private readonly recipe;
  private readonly pools;
  private lane:ViewLane;
  private laneScope:Scope;
  private frames=0;
  private dt=0;
  private quiet=false;
  private readonly columns:number;
  constructor(private readonly bytes:Uint8Array,input:unknown,private readonly owner:Scope,
    private readonly animals:()=>readonly AnimalSim[],private readonly ground:(x:number,z:number)=>number) {
    const rows=this.rows=v.parse(ViewProgramSchema,input);
    if(rows.budget.pages!==1||rows.transforms.length>0||rows.arrays!==undefined||rows.batches!==undefined
      ||rows.pools.length>2||rows.pools.some(pool=>!pool.group.startsWith('species:'))
      ||rows.samples.some(row=>row.kind!=='constant'&&row.kind!=='pool')
      ||rows.channels.some(row=>row.kind!=='color'&&!(row.kind==='field'&&row.field==='yOffset')))
      throw new Error('Native creature view requires its original scalar pools');
    admitScriptV2(bytes,{lane:'view',ioBytes:rows.budget.ioBytes});
    this.source=hashImmutableBytes(bytes);this.recipe=JSON.stringify(rows);
    this.pools=rows.pools.map(row=>({row,ids:Array.from<string|null>({length:row.count}).fill(null)}));
    this.columns=rows.samples.reduce((sum,row)=>{
      if(row.kind==='constant')return sum+1;
      if(row.kind!=='pool')throw new Error('Unsupported creature view sample');
      const pool=rows.pools.find(candidate=>candidate.id===row.pool);
      if(pool===undefined)throw new Error('Missing creature view sample pool');
      return sum+pool.count*(7+pool.fields.length);
    },0);
    this.laneScope=owner.child('native-creature-view');this.lane=this.create(this.laneScope);
  }
  private live():void {if(this.owner.disposed||this.owner.disposing)throw new Error('Native creature view owner retired');}
  private create(scope:Scope):ViewLane {
    const rows=this.rows;
    return new ViewLane(this.bytes,rows.budget.pages,{bindings:[{handle:1,columns:this.columns}],transforms:[],channels:rows.channels.length,
      bounds:rows.bounds,targetMs:rows.budget.targetMs,fuel:rows.budget.fuel},{write:()=>{throw new Error('Creature view has no transforms');},upload:()=>undefined,
      channels:values=>{
        if(this.quiet)return;
        for(const [index,row]of rows.channels.entries())if(row.kind==='field'){
          const pool=this.pools.find(candidate=>candidate.row.id===row.pool),id=pool?.ids[row.slot];
          if(id===undefined)throw new Error('Missing declared native view slot');
          if(id===null)continue;
          const actor=this.animals().find(body=>body.entityId===id),value=values[index];
          if(actor===undefined||value===undefined||!Number.isFinite(value))throw new Error('Creature view lost its original body');
          actor.yOffset=value;
        }
      }},[0,0],undefined,scope);
  }
  frame(dt:number):void {
    this.live();
    if(!Number.isFinite(dt)||dt<=0||this.frames>=60_000||this.frames>0&&!Object.is(dt,this.dt))
      throw new Error('Native creature view requires its original finite fixed clock');
    const animals=this.animals();
    if(new Set(animals.map(body=>body.entityId)).size!==animals.length)throw new Error('Duplicate creature view identity');
    for(const pool of this.pools){
      const live=animals.filter(body=>body.kind===pool.row.group.slice('species:'.length));
      for(const [index,id]of pool.ids.entries())if(id!==null&&!live.some(body=>body.entityId===id))pool.ids[index]=null;
      for(const body of live){if(pool.ids.includes(body.entityId))continue;const free=pool.ids.indexOf(null);if(free===-1)break;pool.ids[free]=body.entityId;}
    }
    const values:number[]=[];
    for(const row of this.rows.samples){
      if(row.kind==='constant'){values.push(row.value);continue;}
      if(row.kind!=='pool')throw new Error('Unsupported native creature view sample');
      const pool=this.pools.find(candidate=>candidate.row.id===row.pool);if(pool===undefined)throw new Error('Missing creature view pool');
      for(const id of pool.ids){
        const body=id===null?undefined:animals.find(actor=>actor.entityId===id);
        if(id!==null&&body===undefined)throw new Error('Missing native creature view body');
        values.push(Number(body!==undefined),body?.position.x??0,body?.position.y??0,body?.position.z??0,body?.yaw??0,Number(body?.alive===true),
          body===undefined?0:this.ground(body.position.x,body.position.z));
        for(const field of pool.row.fields){
          const memory=body?.mem[field];
          const value=body===undefined?0:field.startsWith('has:')?Number(Number.isFinite(body.mem[field.slice(4)])):
            Number.isFinite(memory)?memory:field==='attackPhase'?body.attackPhase:field==='seed'?body.seed:
              field==='scale'?body.scale:field==='yOffset'?body.yOffset:0;
          if(value===undefined||!Number.isFinite(value))throw new Error('Non-finite native creature view field');values.push(value);
        }
      }
    }
    if(values.length!==this.columns)throw new Error('Native creature view sample inventory differs');
    this.dt=dt;this.frames++;
    this.lane.frame(dt,1,this.frames,[{previousTick:this.frames-1,currentTick:this.frames,values:[...values,...values]}],15,()=>0);
    if(this.lane.isFrozen||this.lane.frozenBindings().size>0)throw new Error('Native creature view refused its frame');
  }
  snapshot():v.InferOutput<typeof Saved> {
    this.live();return {version:1,source:this.source,recipe:this.recipe,frames:this.frames,dt:this.dt,
      memory:Array.from(new Uint8Array(this.lane.memory.buffer)),slots:this.pools.map(pool=>[...pool.ids])};
  }
  restore(input:unknown):void {
    this.live();const saved=v.parse(Saved,input),animals=this.animals();
    if(saved.source!==this.source||saved.recipe!==this.recipe||saved.slots.length!==this.pools.length
      ||saved.frames>0&&saved.dt<=0||saved.frames===0&&saved.dt!==0
      ||saved.slots.some((ids,index)=>{const pool=this.pools[index];return pool===undefined||ids.length!==pool.ids.length
        ||new Set(ids.filter(id=>id!==null)).size!==ids.filter(id=>id!==null).length
        ||ids.some(id=>id!==null&&!animals.some(body=>body.entityId===id&&body.kind===pool.row.group.slice(8)));}))
      throw new Error('Foreign native creature-view continuation');
    const scope=this.owner.child('native-creature-view'),lane=this.create(scope);
    this.quiet=true;
    try{
      const absent=Array.from<number>({length:this.columns*2}).fill(0);
      for(let tick=1;tick<=saved.frames;tick++)lane.frame(saved.dt,1,tick,[{previousTick:tick-1,currentTick:tick,values:absent}],15,()=>0);
      if(lane.isFrozen||lane.frozenBindings().size>0)throw new Error('Creature view clock restoration refused');
      new Uint8Array(lane.memory.buffer).set(saved.memory);
    }catch(error){scope.dispose();throw error;}finally{this.quiet=false;}
    this.laneScope.dispose();this.laneScope=scope;this.lane=lane;this.frames=saved.frames;this.dt=saved.dt;
    saved.slots.forEach((ids,index)=>{const pool=this.pools[index];if(pool!==undefined)pool.ids.splice(0,pool.ids.length,...ids);});
  }
}
