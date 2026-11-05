import * as v from 'valibot';
import { isJsonData } from './json.ts';
import { ReturnProgramWireDocumentSchema, type ReturnProgramDocumentInput } from './returnProgramDocument.ts';
import { QuestStepRowsSchema, QuestSpawnPageSchema, QuestLeadPageSchema } from './questSteps.ts';
import { NpcDialogueRowSchema } from './npcs.ts';
import { ContractOfferSchema, type ContractCatalogue } from './contracts.ts';
import { QuestPresentationChapterSchema, type QuestData } from './quests.ts';

const finite=v.pipe(v.number(),v.finite()),text=v.pipe(v.string(),v.maxLength(2048));
/** The complete quest runtime has one admitted named-file address. */
export const QuestRuntimeFileSchema: v.LiteralSchema<'quests/runtime.json', undefined> = v.literal('quests/runtime.json');
const names=v.pipe(v.array(text),v.maxLength(64));
const condition=v.strictObject({all:v.exactOptional(names),any:v.exactOptional(names),none:v.exactOptional(names)});
const point={x:finite,z:finite};
const base={id:text,at:v.strictObject({poi:v.literal('world'),...point,y:finite,yaw:finite}),requires:v.exactOptional(condition),
  lockedLabel:v.exactOptional(text),showWhen:v.exactOptional(condition),sets:v.exactOptional(names),toast:v.exactOptional(text)};
interface Condition {all?:string[];any?:string[];none?:string[]}
interface TableBase {id:string;at:{poi:'world';x:number;y:number;z:number;yaw:number};requires?:Condition;lockedLabel?:string;showWhen?:Condition;sets?:string[];toast?:string}
export interface QuestRuntimeTableRows {external:string[];rows:(TableBase & (
  {kind:'lever';label:string;latch:boolean}|{kind:'door';look:'sluice';w:number;h:number;latch:boolean;opensWhen:Condition}|
  {kind:'pickup';look:string;label:string;color?:string;item?:string;touch?:boolean}|{kind:'bench';label:string}
))[]}
/** Complete authored placement table. Native interactions still own identities,
 * endpoint matching, inventory, flags and every registered object. */
export const QuestRuntimeTableSchema:v.GenericSchema<unknown,QuestRuntimeTableRows>=v.strictObject({external:names,rows:v.pipe(v.array(v.variant('kind',[
  v.strictObject({...base,kind:v.literal('lever'),label:text,latch:v.boolean()}),
  v.strictObject({...base,kind:v.literal('door'),look:v.literal('sluice'),w:finite,h:finite,latch:v.boolean(),opensWhen:condition}),
  v.strictObject({...base,kind:v.literal('pickup'),look:text,label:text,color:v.exactOptional(text),item:v.exactOptional(text),touch:v.exactOptional(v.boolean())}),
  v.strictObject({...base,kind:v.literal('bench'),label:text}),
])),v.maxLength(256))});

export interface QuestLeadRows {path:[number,number][];near:number;first:number;trot:number;gone:number;past:number;nightAbove:number}
/** Authored lead path and phase gates, measured by the original AS guest. */
export const QuestLeadRowsSchema:v.GenericSchema<QuestLeadRows,QuestLeadRows>=v.strictObject({
  path:v.pipe(v.array(v.tuple([finite,finite])),v.minLength(1),v.maxLength(128)),
  near:v.pipe(finite,v.minValue(0)),first:v.pipe(finite,v.minValue(0)),trot:v.pipe(finite,v.minValue(0)),
  gone:v.pipe(finite,v.minValue(0)),past:v.pipe(finite,v.minValue(0)),nightAbove:v.pipe(finite,v.minValue(0),v.maxValue(1)),
});

type InteractEvent='open'|'locked'|'take'|'lever'|'door'|'press'|'release'|'light'|'sit'|'use'|'found'|'barrel-reset';
type InteractKind='chest'|'key'|'door'|'lever'|'plate'|'barrel'|'pickup'|'beacon'|'bench'|'altar';
type InteractSound='chest'|'locked'|'lever'|'plate'|'door'|'grate'|'chime'|'glyph'|'ignite';
type EventEffect={kind:'call';name:string}|{kind:'toast';fallback?:string;empty?:boolean}|{kind:'item';toast?:boolean;fallback?:boolean}|
  {kind:'sound';sound:InteractSound;gain?:number;delay?:number;release?:boolean};
export interface QuestKitEventRow {types:InteractEvent[];kind?:InteractKind;look?:string;flagPrefix?:string;effects:EventEffect[]}
const eventName=v.pipe(v.string(),v.regex(/^[a-z][a-z0-9.-]{0,127}$/u)),eventValue=v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const nonnegative=v.pipe(finite,v.minValue(0));
/** Exact ordered presentation rows admitted by the existing InteractSfx host. */
export const QuestKitEventsSchema:v.GenericSchema<unknown,QuestKitEventRow[]>=v.pipe(v.array(v.strictObject({
  types:v.pipe(v.array(v.picklist(['open','locked','take','lever','door','press','release','light','sit','use','found','barrel-reset'])),v.minLength(1),v.maxLength(12)),
  kind:v.exactOptional(v.picklist(['chest','key','door','lever','plate','barrel','pickup','beacon','bench','altar'])),
  look:v.exactOptional(eventValue),flagPrefix:v.exactOptional(eventValue),
  effects:v.pipe(v.array(v.variant('kind',[
    v.strictObject({kind:v.literal('call'),name:eventName}),
    v.strictObject({kind:v.literal('toast'),fallback:v.exactOptional(text),empty:v.exactOptional(v.boolean())}),
    v.strictObject({kind:v.literal('item'),toast:v.exactOptional(v.boolean()),fallback:v.exactOptional(v.boolean())}),
    v.strictObject({kind:v.literal('sound'),sound:v.picklist(['chest','locked','lever','plate','door','grate','chime','glyph','ignite']),
      gain:v.exactOptional(v.pipe(nonnegative,v.maxValue(8))),delay:v.exactOptional(v.pipe(nonnegative,v.maxValue(60))),release:v.exactOptional(v.boolean())}),
  ])),v.maxLength(32)),
})),v.maxLength(64));

export interface QuestDeathRow {
  when?:{kind?:string;variant?:string;label?:string}[];
  effects:({kind:'flag';flag:string}|{kind:'kill'}|{kind:'event';event:string}|{kind:'call';name:string}|{kind:'toast';text:string})[];
}
const deathName=v.pipe(v.string(),v.regex(/^[a-z][a-z0-9.:-]{0,127}$/u)),deathValue=v.pipe(v.string(),v.minLength(1),v.maxLength(256));
const deathMatch=v.pipe(v.strictObject({kind:v.exactOptional(deathValue),variant:v.exactOptional(deathValue),label:v.exactOptional(deathValue)}),
  v.check(row=>row.kind!==undefined||row.variant!==undefined||row.label!==undefined));
/** Exact ordered consequences; native owner callbacks and listener phases stay
 * with bindQuestDeathEffects rather than entering this data contract. */
export const QuestDeathEffectsSchema:v.GenericSchema<unknown,QuestDeathRow[]>=v.pipe(v.array(v.strictObject({
  when:v.exactOptional(v.pipe(v.array(deathMatch),v.minLength(1),v.maxLength(16))),
  effects:v.pipe(v.array(v.variant('kind',[
    v.strictObject({kind:v.literal('flag'),flag:deathName}),v.strictObject({kind:v.literal('kill')}),
    v.strictObject({kind:v.literal('event'),event:deathName}),v.strictObject({kind:v.literal('call'),name:deathName}),
    v.strictObject({kind:v.literal('toast'),text:v.pipe(v.string(),v.minLength(1),v.maxLength(2048))}),
  ])),v.minLength(1),v.maxLength(32)),
})),v.maxLength(128));

export interface QuestTradeRow {
  id:string;label:string;short:string;blurb:string;give:{item:string;n:number}[];
  get:{bolts:number}|{ammo:'pitch'|'broadhead'|'cartridge'|'arrow';n:number}|{skin:string};once?:boolean;
}
const item=v.pipe(v.string(),v.minLength(1),v.maxLength(128)),quantity=v.pipe(finite,v.integer(),v.minValue(1));
const trade:v.GenericSchema<unknown,QuestTradeRow>=v.strictObject({id:item,label:text,short:text,blurb:text,
  give:v.pipe(v.array(v.strictObject({item,n:quantity})),v.maxLength(64)),
  get:v.union([v.strictObject({bolts:quantity}),v.strictObject({ammo:v.picklist(['pitch','broadhead','cartridge','arrow']),n:quantity}),v.strictObject({skin:item})]),
  once:v.exactOptional(v.boolean()),
});
export interface QuestContentDocumentRows {
  id:string;chapters:Omit<QuestData['quests'][number],'onComplete'>[];
  board:{id:string;rows:ContractCatalogue['rows']};trader:{id:string;rows:QuestTradeRow[]};
  npcs:v.InferOutput<typeof NpcDialogueRowSchema>[];
}
/** Complete quest content envelope, not only the board or dialogue children. */
export const QuestContentDocumentSchema:v.GenericSchema<unknown,QuestContentDocumentRows>=v.strictObject({
  id:item,chapters:v.pipe(v.array(QuestPresentationChapterSchema),v.maxLength(32)),
  board:v.strictObject({id:item,rows:v.pipe(v.array(ContractOfferSchema),v.minLength(1),v.maxLength(256))}),
  trader:v.strictObject({id:item,rows:v.pipe(v.array(trade),v.maxLength(64))}),
  npcs:v.pipe(v.array(NpcDialogueRowSchema),v.maxLength(64)),
});
export interface QuestRuntimeDocumentRows {
  lead:QuestLeadRows & {program:ReturnProgramDocumentInput};leadPage:v.InferOutput<typeof QuestLeadPageSchema>;
  steps:v.InferOutput<typeof QuestStepRowsSchema>;spawns:v.InferOutput<typeof QuestSpawnPageSchema>;
  table:QuestRuntimeTableRows;
  readings:{speakers:Record<string,v.InferOutput<typeof NpcDialogueRowSchema>>;continuation:{bare:string;wrapped:string[]}};
  policy:{readingDelay:number};events:QuestKitEventRow[];deaths:QuestDeathRow[];pageDeaths:QuestDeathRow[];content:QuestContentDocumentRows;
}
/** G1004: the full runtime document retains all effects, deaths, content and
 * lead guest metadata. The original quest/save/phase owners still admit it. */
export const QuestRuntimeDocumentSchema:v.GenericSchema<unknown,QuestRuntimeDocumentRows>=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  lead:v.strictObject({path:v.pipe(v.array(v.tuple([finite,finite])),v.minLength(1),v.maxLength(128)),
    near:nonnegative,first:nonnegative,trot:nonnegative,gone:nonnegative,past:nonnegative,nightAbove:v.pipe(finite,v.minValue(0),v.maxValue(1)),program:ReturnProgramWireDocumentSchema}),
  leadPage:QuestLeadPageSchema,steps:QuestStepRowsSchema,spawns:QuestSpawnPageSchema,table:QuestRuntimeTableSchema,
  readings:v.strictObject({speakers:v.record(text,NpcDialogueRowSchema),continuation:v.strictObject({bare:text,wrapped:names})}),
  policy:v.strictObject({readingDelay:nonnegative}),events:QuestKitEventsSchema,deaths:QuestDeathEffectsSchema,pageDeaths:QuestDeathEffectsSchema,
  content:QuestContentDocumentSchema,
}));
