import { installChannelPrograms,numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import { lookAngles } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { speciesBehaviour, type HullLookBook } from '@wildshard/game/looks/speciesBook';
import type { CreatureGuestRows, SpeciesPresentationRows } from '@wildshard/format/speciesBookRows';

let book:HullLookBook|null=null,looks:ReturnType<HullLookBook['packedLooks']>|null=null,behaviour:ReturnType<typeof speciesBehaviour>|null=null;
let speciesData: SpeciesPresentationRows | null = null;
/** Product JSON is admitted before the first creature build or frame: the looks are the hull book's packed looks. */
export function prepareNalatiSpecies(data: SpeciesPresentationRows, hull: HullLookBook, lookRows: unknown): void {
  speciesData = data;
  book ??= hull; looks ??= hull.packedLooks(lookRows); behaviour ??= speciesBehaviour(data.lookBook);
}
/** The page and specimens share the same data-owned packed body cache. */
export function nalatiPackedLooks():ReturnType<HullLookBook['packedLooks']>{if(looks===null)throw new Error('Species looks are not prepared');return looks;}
/** The species rows' behaviour hooks (outside the look book until L4 / L5). */
export function nalatiBehaviour():ReturnType<typeof speciesBehaviour>{if(behaviour===null)throw new Error('Species behaviour is not prepared');return behaviour;}
export async function preloadNalatiBodies():Promise<void>{if(book===null)throw new Error('Species looks are not prepared');await book.packed.preload();}

export function speciesGuestRows(): CreatureGuestRows { if (speciesData === null) throw new Error('Missing species guest program'); return speciesData.guest; }

type KingPrograms=ReturnType<typeof parseClientChannels>;
let king:{programs:KingPrograms;pose:ReturnType<typeof numericCreaturePose>;look:[number,number,number]}|null=null;
let kingRigs=new WeakMap<AnimalRigContext['bones'],{frame:AnimalRigContext;look:{yaw:number;pitch:number};surface:{ground:number;alive:number};visual:{yOffset:number};draw:ReturnType<typeof installChannelPrograms>;observe:ReturnType<typeof installChannelPrograms>}>();
/** Bind admitted numeric visual rows before any body pose. */
export function prepareGoldenKing(input:unknown):void{
  const programs=parseClientChannels(input),[eye,maxYaw,maxPitch]=speciesRows.kingFrame.look;
  if(eye===undefined||maxYaw===undefined||maxPitch===undefined)throw new Error('Missing King look rows');
  const observe=programs.filter(row=>row.numeric?.group===speciesRows.kingFrame.group);if(observe.length>32)throw new Error('Excess King observation programs');
  for(const row of programs){const numeric=row.numeric;if(numeric?.group!==speciesRows.kingFrame.group&&numeric?.group!=='king.surface')continue;
    if(numeric.outputs.some(out=>out.path.length!==1||(out.target!=='mem'&&!(numeric.group==='king.surface'&&out.target==='visual'&&out.path[0]==='yOffset'))))throw new Error('King programs must target private visual fields');}
  king={programs,look:[eye,maxYaw,maxPitch],pose:numericCreaturePose({group:'creature.pose',programs:programs.filter(row=>row.numeric?.group==='creature.pose')})};kingRigs=new WeakMap();
}
/** The native view lends detached facts and synchronizes only existing visual fields. */
export function animateGoldenKing(c:AnimalRigContext):void{
  if(king===null)throw new Error('Golden King pose rows are not prepared');
  const rows=speciesRows.kingFrame,floor=rows.floor;let rig=kingRigs.get(c.bones);
  if(rig===undefined){
    const frame:AnimalRigContext={...c,mem:{...speciesRows.kingPoseDefaults}},look={yaw:0,pitch:0},surface={ground:0,alive:1},visual={yOffset:0};
    for(const program of king.programs)for(const output of program.numeric?.outputs??[])if(output.target==='mem'){const key=output.path[0];if(typeof key!=='string')throw new Error('Missing King visual field');frame.mem[key]=0;}
    for(const field of rows.smooth)frame.mem[field.input]=0;frame.mem[floor.lift]=0;
    const owners=new Map<string,unknown>([['frame',frame],['mem',frame.mem],['look',look],['surface',surface],['visual',visual]]);
    rig={frame,look,surface,visual,draw:installChannelPrograms(king.programs,'king.surface',owners),observe:installChannelPrograms(king.programs,rows.group,owners)};kingRigs.set(c.bones,rig);
  }
  const {frame,look,surface,visual,draw,observe}=rig,memory=frame.mem;Object.assign(frame,c);frame.mem=memory;Object.assign(memory,c.mem);
  for(const field of rows.smooth){const value=c.mem[field.input]??0;memory[field.input]=value;memory[field.output]=c.mem[field.output]??field.initial??value;}
  memory[floor.death]=c.mem[floor.death]??0;memory[floor.lift]=c.mem[floor.lift]??0;
  surface.ground=terrainHeight(c.animal.position.x,c.animal.position.z);surface.alive=Number(c.alive);Object.assign(look,lookAngles(c,...king.look));
  draw.evaluate({time:c.t,delta:c.dt,values:{}});for(const field of rows.smooth)c.mem[field.output]=memory[field.output]??0;
  if(!c.alive)c.mem[floor.death]=memory[floor.death]??0;c.animal.yOffset=visual.yOffset;
  observe.evaluate({time:c.t,delta:c.dt,values:{}});king.pose(frame);
}
