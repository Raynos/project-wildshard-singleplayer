import type { SynthBedGraph, AudioMixExpr, AudioMixRecipe } from '@wildshard/format/audioProfiles';
import type { ScoreSelection } from './scoreSelection';

/** Same-byte platform sample catalogue; gains apply to admitted named loops. */
export interface AudioSampleProfile { set: string; bed: string; loopGains: Readonly<Record<string, number>>; omitLoops?: readonly string[] | undefined; omitShots?: readonly string[] | undefined; omitSlots?: readonly string[] | undefined }
/** Existing music catalogue and bounded scene selection; stem decoding and bar-grid playback remain engine-owned. */
export interface AudioMusicProfile {
  id: string; base: string; slots: readonly string[]; bootSlots: readonly string[]; synthLead: 'pluck' | 'marimba'; minFade: number;
  source: { dir: string; manifestKey: string } | null; sets: Readonly<Record<string, string>>;
  selection: readonly ScoreSelection[]; selectMode: 'first' | 'all';
  /** Declared cache/decode policy, preserving slot fallback or an entire boot bank. */
  catalogue?: { mode:'slots'|'bank'; extraStings:readonly ('pickup'|'death'|'chunk'|'dawn')[]; stingSets:Readonly<Partial<Record<'pickup'|'death'|'chunk'|'dawn',string>>> } | undefined;
}
/** Named circular ambience zones; a source id resolves a trusted moving-emitter or geometry port. */
export interface AudioZone { id: string; x: number; z: number; inner: number; outer: number; gain: number; /** Exact authored width; avoids subtracting rounded outer/inner radii. */ fade?: number | undefined; open?: boolean | undefined; source?: string | undefined }
/** Mixer timing, bed levels, room sends and named zones consumed by a trusted catalogue recipe. */
export interface AudioZoneProfile {
  mix?: AudioMixRecipe | undefined;
  graph?: SynthBedGraph | undefined;
  id: string; smoothSeconds: number; tickHz: number; silentSeconds: number; holdSeconds: number;
  levels: Readonly<Record<string, number>>;
  /** Rectangle-distance blend regions and admitted bed/sample names, for enclosed scenes. */
  blendMetres?: number | undefined; rectangles?: readonly { id: string; zone: string; x0: number; x1: number; z0: number; z1: number }[] | undefined;
  beds?: readonly { id: string; zone: string }[] | undefined; positional?: { sample: string; max: number; reach: number } | undefined;
  wet: Readonly<Record<string, number>>; zones: readonly AudioZone[];
}

/** Refuse a missing required recipe before its runtime graph can start. */
export function requireAudioProfile<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Missing declared audio profile: ${name}`);
  return value;
}
/** Resolve an admitted named zone, refusing a stale or incomplete trusted recipe binding. */
export function requireAudioZone(profile: AudioZoneProfile, id: string): AudioZone {
  return requireAudioProfile(profile.zones.find((zone) => zone.id === id), id);
}
/** Resolve a declared mixer level or room send without silently changing the previous recipe. */
export function requireAudioLevel(levels: Readonly<Record<string, number>>, id: string): number {
  return requireAudioProfile(levels[id], id);
}


/** Evaluate the admitted algebra without clocks, random draws or audio allocation. */
export function audioMixValue(expr:AudioMixExpr,read:(id:string)=>number):number {
  if(typeof expr==='number')return expr;if(typeof expr==='string')return read(expr);
  const arg=(index:number):number=>{const value=expr[index];if(value===undefined)throw new Error('Missing audio mix argument');return audioMixValue(value,read);};
  const truthy=(value:number):boolean=>value!==0&&!Number.isNaN(value);
  switch(expr[0]){
    case '+':{let value=arg(1);for(let i=2;i<expr.length;i++)value+=arg(i);return value;}
    case '*':{let value=arg(1);for(let i=2;i<expr.length;i++)value*=arg(i);return value;}
    case '-':return arg(1)-arg(2);case '/':return arg(1)/arg(2);
    case 'min':return Math.min(arg(1),arg(2));case 'max':return Math.max(arg(1),arg(2));
    case 'clamp':return Math.max(arg(2),Math.min(arg(3),arg(1)));
    case 'abs':return Math.abs(arg(1));case 'sin':return Math.sin(arg(1));case 'hypot':return Math.hypot(arg(1),arg(2));
    case 'ss':{const a=arg(1),b=arg(2),x=arg(3),t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
    case 'in':{const value=arg(1);return value>arg(2)&&value<arg(3)?1:0;}
    case 'lt':return arg(1)<arg(2)?1:0;case 'gt':return arg(1)>arg(2)?1:0;
    case 'if':return truthy(arg(1))?arg(2):arg(3);
    case 'and':{for(let i=1;i<expr.length;i++)if(!truthy(arg(i)))return 0;return 1;}
    case 'or':{for(let i=1;i<expr.length;i++)if(truthy(arg(i)))return 1;return 0;}
    case 'not':return truthy(arg(1))?0:1;
    case 'dist':case 'zone':{
      const name=expr[1];if(typeof name!=='string')throw new Error('Audio mix point requires a name');
      const distance=Math.hypot(read('x')-read(`${name}.x`),read('z')-read(`${name}.z`));
      if(expr[0]==='dist')return distance;
      const outer=read(`${name}.outer`),inner=read(`${name}.inner`),t=Math.max(0,Math.min(1,(distance-outer)/(inner-outer)));return t*t*(3-2*t);
    }
    default:throw new Error('Unknown audio mix operator');
  }
}
/** Apply declared mix rows in original order; a borrowed after-level phase retains live emitter steering. */
export function evaluateAudioMix(rows:AudioMixRecipe,ports:{read:(id:string)=>number;write:(id:string,value:number)=>void;
  level:(id:string,value:number)=>void;afterLevels?:()=>void;cutoff:(id:string,value:number)=>void;
  room:(id:string,weight:number,level:number)=>void;diag:(id:string,value:number)=>void;shade?:(gain:number,cutoff:number)=>void}):string {
  const value=(expr:AudioMixExpr):number=>audioMixValue(expr,ports.read);
  for(const [id,expr] of rows.values)ports.write(id,value(expr));
  for(const [id,expr] of rows.levels)ports.level(id,value(expr));
  ports.afterLevels?.();
  for(const [id,expr] of rows.cutoffs)ports.cutoff(id,value(expr));
  if(rows.shade!==undefined)ports.shade?.(value(rows.shade[0]),value(rows.shade[1]));
  for(const room of rows.rooms)ports.room(room.id,value(room.weight),value(room.level));
  for(const [id,expr] of rows.diag)ports.diag(id,value(expr));
  let selected=rows.defaultZone,best=rows.zoneFloor;
  for(const [id,expr] of rows.zones){const weight=value(expr);if(rows.zoneMode==='first'){if(weight!==0&&!Number.isNaN(weight)){selected=id;break;}}else if(weight>best){selected=id;best=weight;}}
  return selected;
}
