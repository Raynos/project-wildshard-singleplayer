import * as v from 'valibot';
import {parseClientPlan} from '../../src/format/clientPlan';
import {SceneDressingSchema} from '../../src/format/sceneDressing';
import {parseBossProfile} from '../../src/format/bossProfiles';
import {BossEncounterDefinitionSchema} from '../../src/format/bossEncounter';
import {CreatureStrikeSchema} from '../../src/format/creatures';
import {ReturnProgramSchema} from '../../src/format/namedJsonContracts';
import {SpeciesActorsFileSchema,type ArenaRoomSpeciesControlRows} from '../../src/format/speciesBookRows';
import {parseRuntimeSpawns,type RuntimeBossRow} from '../../src/format/runtimeSpawns';
import type {CombatTag} from '../../src/engine/combat/pipeline';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';
import {readNalatiArenaIntake} from './nalati-arena-intake';
import {readNalatiArenaPoses} from './nalati-arena-poses';

const finite=v.pipe(v.number(),v.finite()),positive=v.pipe(finite,v.minValue(Number.MIN_VALUE));
const id=v.pipe(v.string(),v.minLength(1),v.maxLength(512)),xz=v.object({x:finite,z:finite});
const triple=v.tuple([finite,finite,finite]);
// The product admits the complete original room schema. This read surface
// names every field used by its real numeric ground, seal and portal owners.
const Room=v.object({origin:v.object({x:finite,y:finite,z:finite}),halfWidth:positive,corridorHalfWidth:positive,corridorEnd:positive,
  sealId:id,doorHalfWidth:positive,doorHeight:positive,sandCells:v.pipe(positive,v.integer(),v.maxValue(256)),
  cover:v.object({x:finite,z:finite,wid:positive,len:positive,plinthH:finite,h:finite}),pedestal:xz,
  beams:v.pipe(v.array(v.object({a:xz,b:xz,r:positive})),v.maxLength(256))});
const Portal=v.object({signal:id,spawn:v.object({x:finite,z:finite,yaw:finite}),end:finite,exitOffset:finite,
  slow:v.pipe(finite,v.minValue(0),v.maxValue(1)),fade:v.object({out:finite,hold:finite,in:finite}),
  floor:v.object({tolerance:finite,depth:finite})});
const Page=v.object({profile:v.unknown(),body:id,identity:v.picklist(['runtime','declared']),
  add:v.object({kind:id,variant:id,memory:v.record(id,finite)}),maxZ:finite,reward:triple,respawn:triple,yaw:finite,
  damageTag:v.custom<CombatTag>(value=>typeof value==='string'&&/^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value)),
  cuts:v.pipe(v.array(CreatureStrikeSchema),v.minLength(1),v.maxLength(16)),hazards:v.record(id,CreatureStrikeSchema)});
const Encounter=v.object({definition:BossEncounterDefinitionSchema,page:Page,portal:Portal,program:ReturnProgramSchema});
export interface NalatiKingData {
  readonly room:v.InferOutput<typeof Room>;
  readonly entrance:{readonly x:number;readonly y:number;readonly z:number;readonly facing:number};
  readonly encounter:v.InferOutput<typeof Encounter>;
  readonly profile:Extract<ReturnType<typeof parseBossProfile>,{pattern:'arena'}>;
  readonly declared:RuntimeBossRow;
  readonly control:ArenaRoomSpeciesControlRows;
  readonly intake:Awaited<ReturnType<typeof readNalatiArenaIntake>>;
  readonly poses:Awaited<ReturnType<typeof readNalatiArenaPoses>>;
}

/** Preflight the entered King's actual rows without allocating a body, taking
 * entropy, starting an encounter or creating an outcome. Its later owner
 * borrows these same admitted recipes and renderer-free fight kernels. */
export async function readNalatiKingData(product:Pick<ShardProduct,'json'|'shardfile'|'section'>):Promise<NalatiKingData>{
  const plan=parseClientPlan(product.section('client/plan'));
  const stages=plan.features.flatMap(row=>row.kind==='world.assembly'?row.rows.stages:[]);
  const rooms=stages.filter(row=>row.kind==='arena-room'&&'mode' in row),stage=rooms[0];
  if(rooms.length!==1||stage?.kind!=='arena-room'||!('mode' in stage))throw new Error('King requires its unique original room construction');
  const scenes=v.parse(v.object({dressing:v.object({phone:id})}),product.section('world/scenes'));
  const [entry,actors,dressing]=await Promise.all([
    product.json(stage.file).then(input=>v.parse(v.object({room:Room,encounter:Encounter}),input)),
    product.json('actors/sheep.json').then(input=>v.parse(SpeciesActorsFileSchema,input)),
    product.json(scenes.dressing.phone).then(input=>v.parse(SceneDressingSchema,input)),
  ]);
  const pieces=dressing.statics.filter(row=>row.name===stage.entrance.part),entrance=pieces[0]?.anchors[stage.entrance.anchor]?.[0];
  if(pieces.length!==1||entrance===undefined)throw new Error('King requires its actual original dressing entrance');
  const {room,encounter}=entry,profile=parseBossProfile(encounter.page.profile),runtime=product.shardfile.runtime;
  if(profile.pattern!=='arena'||runtime===null||runtime===undefined)throw new Error('King requires its original fixed arena and runtime declaration');
  const declared=parseRuntimeSpawns(runtime.spawns).bosses.find(row=>row.id===encounter.page.body);
  if(declared===undefined||encounter.page.identity!=='runtime')throw new Error('King requires its original runtime allocation identity');
  const species=actors.species.lookBook.rows.find(row=>row.metadata.kind===declared.kind),control=species?.control;
  if(species===undefined||species.metadata.tick!=='always'||control===undefined||!Object.hasOwn(species.variants,declared.look))
    throw new Error('King requires its admitted always species, control and variant');
  const initial=control.initialize;
  if(new Set(initial.defaults.map(row=>row.field)).size!==initial.defaults.length||initial.defaults.some(row=>row.field===initial.flag))
    throw new Error('King initialization duplicates its original memory fields');
  if(profile.fight.reset.mem[initial.flag]!==1)throw new Error('King reset must own its original species initialization');
  for(const axis of ['x','y','z'] as const)if(!Object.is(room.origin[axis],profile.fight.origin[axis]))
    throw new Error('King room and original fight frames differ');
  const [intake,poses]=await Promise.all([readNalatiArenaIntake(product,[declared.kind]),readNalatiArenaPoses(product,[declared.kind])]);
  return {room,entrance,encounter,profile,declared,control,intake,poses};
}
