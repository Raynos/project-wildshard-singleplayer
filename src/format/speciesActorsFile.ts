import * as v from 'valibot';
import {isJsonData} from './json.ts';
import {FixedDrawRowsSchema} from './fixedDraws.ts';
import {NumericPoseSchema,type NumericPoseRows} from './clientChannels.ts';
import {CreatureGuestSchema,SpeciesPresentationSchema,type CreatureGuestRows,type SpeciesPresentationRows} from './speciesBookRows.ts';
import {CompactSpeciesBodiesSchema,type CompactSpeciesBodiesRows} from './speciesLooks.ts';
import {type CrowdPresentationSchema,CrowdGuardSchema} from './crowdPresentation.ts';
import {FlockSchema} from './crowds.ts';
import {ReturnProgramWireDocumentSchema,type ReturnProgramDocumentInput} from './returnProgramDocument.ts';
import {ReturnProgramSchema} from './namedJsonContracts.ts';

const completeReturn:v.GenericSchema<v.InferInput<typeof ReturnProgramSchema>,v.InferOutput<typeof ReturnProgramSchema>&ReturnProgramDocumentInput>=v.intersect([ReturnProgramSchema,ReturnProgramWireDocumentSchema]);

const n=v.pipe(v.number(),v.finite()),text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096));
const triple=v.tuple([n,n,n]);
function keysOnly(input:unknown,keys:readonly string[]):boolean {return typeof input==='object'&&input!==null&&!Array.isArray(input)&&Object.keys(input).every(key=>keys.includes(key));}
// Preserve every caller-owned field before the older non-strict child parsers
// can project it away. This is local admission, never an authored callback API.
function retainsKeys(input:unknown,output:unknown):boolean {
 if(typeof input!=='object'||input===null)return true;
 if(typeof output!=='object'||output===null||Array.isArray(input)!==Array.isArray(output))return false;
 const before=Object.keys(input),after=Object.keys(output);
 return before.length===after.length&&before.every(key=>Object.hasOwn(output,key)&&retainsKeys(Reflect.get(input,key),Reflect.get(output,key)));
}
function retainedBy(schema:v.GenericSchema,input:unknown):boolean {
 const result=v.safeParse(schema,input);return result.success&&retainsKeys(input,result.output);
}

export interface SpeciesSkeletonRows {
 bones:{name:string;parent:string|null;pos:[number,number,number]}[];
 dims:{bodyY:number;bodyHalfLen:number;bodyRadius:number;headRadius:number;legLen:number;feet:[number,number][];halfWidth:number;
  capsuleAxis?:'z'|'y';headAt?:[number,number,number];bodyAt?:[number,number,number];bodyPitch?:number;
  fore?:{bone:string;at:[number,number,number];halfLen:number;radius:number}};
}
type BodyRows=Omit<CompactSpeciesBodiesRows,'skeletons'>&{skeletons:SpeciesSkeletonRows[]};
const skeleton:v.GenericSchema<unknown,SpeciesSkeletonRows>=v.strictObject({
 bones:v.pipe(v.array(v.strictObject({name:text,parent:v.nullable(text),pos:triple})),v.minLength(1),v.maxLength(32)),
 dims:v.strictObject({bodyY:n,bodyHalfLen:n,bodyRadius:n,headRadius:n,legLen:n,feet:v.pipe(v.array(v.tuple([n,n])),v.maxLength(32)),halfWidth:n,
  capsuleAxis:v.exactOptional(v.picklist(['z','y'])),headAt:v.exactOptional(triple),bodyAt:v.exactOptional(triple),bodyPitch:v.exactOptional(n),
  fore:v.exactOptional(v.strictObject({bone:text,at:triple,halfLen:n,radius:n}))}),
});
const bodies:v.GenericSchema<unknown,BodyRows>=v.pipe(v.unknown(),v.check(input=>keysOnly(input,['file','bytes','attrs','skeletons','rows'])&&retainedBy(CompactSpeciesBodiesSchema,input)),v.intersect([CompactSpeciesBodiesSchema,
 v.looseObject({skeletons:v.pipe(v.array(skeleton),v.maxLength(4096))})]));
export interface SpeciesPoseRows {
 prefix:string;group:string;scalars:NumericPoseRows['scalars'];states:NumericPoseRows['states'];
 look?:NonNullable<NumericPoseRows['look']>;alive?:boolean;
}
const pose:v.GenericSchema<unknown,SpeciesPoseRows>=v.strictObject({prefix:v.string(),group:NumericPoseSchema.entries.group,
 scalars:NumericPoseSchema.entries.scalars,states:NumericPoseSchema.entries.states,look:NumericPoseSchema.entries.look,alive:NumericPoseSchema.entries.alive});
type GuestRows=Omit<CreatureGuestRows,'program'>&{program:v.InferOutput<typeof completeReturn>};
const guest:v.GenericSchema<unknown,GuestRows>=v.pipe(v.unknown(),v.check(input=>keysOnly(input,['program','clock','playerKeys','memory','writes','states','sounds','attack','strike','strikeSound','length','piercing'])&&retainedBy(CreatureGuestSchema,input)),v.intersect([CreatureGuestSchema,v.looseObject({program:completeReturn})]));
type LookBookRows=Omit<SpeciesPresentationRows['lookBook'],'program'>&{program:v.InferOutput<typeof completeReturn>};
const lookBook:v.GenericSchema<unknown,LookBookRows>=v.pipe(v.unknown(),v.check(input=>keysOnly(input,['slug','rows','program'])&&retainedBy(SpeciesPresentationSchema.entries.lookBook,input)),v.intersect([SpeciesPresentationSchema.entries.lookBook,
 v.looseObject({program:completeReturn})]));
export interface CrowdFileViewRows extends v.InferOutput<typeof CrowdPresentationSchema> {channels?:[[string,string,string,string]]}
const view:v.GenericSchema<unknown,CrowdFileViewRows>=v.strictObject({name:v.pipe(v.string(),v.minLength(1),v.maxLength(96)),
 attributes:v.tuple([v.pipe(v.string(),v.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/u))]),
 channels:v.exactOptional(v.tuple([v.tuple([text,text,text,text])])),
 wool:v.pipe(v.array(triple),v.minLength(1),v.maxLength(32)),hits:v.pipe(v.array(triple),v.minLength(1),v.maxLength(16)),
 preyY:n,feetY:n,cullRadius:v.pipe(n,v.minValue(0)),
 motion:v.strictObject({walk:v.tuple([n,v.pipe(n,v.minValue(0))]),
  joints:v.pipe(v.array(v.tuple([n,n,n,n,n,n,n])),v.minLength(1),v.maxLength(64)),
  movingBob:v.tuple([n,v.pipe(n,v.minValue(0)),n]),idleBob:v.tuple([n,n]),movingAt:v.pipe(n,v.minValue(0)),
  deathPivot:triple,deathAngle:n,tint:v.tuple([n,n])}),
});
export interface CrowdFilePageRows {
 slug:string;hull:string|null;guard?:v.InferOutput<typeof CrowdGuardSchema>;bounds:[number,number,number,number];
 rows:v.InferOutput<typeof FlockSchema>[];view:CrowdFileViewRows;material:{rim:number;bands:number};
}
const page:v.GenericSchema<unknown,CrowdFilePageRows>=v.strictObject({slug:v.string(),hull:v.nullable(v.string()),guard:v.exactOptional(CrowdGuardSchema),
 bounds:v.tuple([n,n,n,n]),rows:v.pipe(v.array(FlockSchema),v.maxLength(4096)),view,material:v.strictObject({rim:n,bands:n})});
export interface SpeciesActorsFileRows {
 species:{poses:Record<string,SpeciesPoseRows>;packedBodies:BodyRows;guest:GuestRows;lookBook:LookBookRows};
 page:{world:CrowdFilePageRows;specimen:CrowdFilePageRows};draws:v.InferOutput<typeof FixedDrawRowsSchema>;
 pivots:[number,number,number][];parts:string[];radius:number;
}
/** G1004: complete crowd pages, pose metadata, typed native guest and shared
 * body skeletons, not an opaque page or a shared NumericPose child. Original
 * species/module/fixed-draw/native body owners retain their independent checks. */
const fileShape=v.strictObject({
 species:v.strictObject({poses:v.pipe(v.record(text,pose),v.maxEntries(256)),packedBodies:bodies,guest,lookBook}),
 page:v.strictObject({world:page,specimen:page}),draws:v.pipe(FixedDrawRowsSchema,v.length(1)),
 pivots:v.pipe(v.array(triple),v.maxLength(32)),parts:v.pipe(v.array(v.string()),v.maxLength(32)),radius:n,
});
export const SpeciesActorsFileSchema:v.GenericSchema<unknown,SpeciesActorsFileRows>=v.pipe(v.unknown(),v.check(isJsonData),
 v.check(input=>isJsonData(input)&&retainedBy(fileShape,input),'Complete file field retention'),fileShape);
