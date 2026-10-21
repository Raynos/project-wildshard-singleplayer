import { installChannelPrograms,numericCreaturePose } from '@wildshard/game/plugin/channelPrograms';
import { lookAngles } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
import { SpeciesLookBook } from '@wildshard/game/looks/speciesBook';
import type * as THREE from 'three';
import type { SpeciesPresentationRows } from '@wildshard/format/speciesBookRows';

let crackGeometry: THREE.BufferGeometry | null = null;
let book:SpeciesLookBook|null=null;
let speciesData: { packedBodies: unknown; program: unknown; strike: unknown } | null = null;
/** Product JSON is admitted before the first creature build or frame. */
export async function prepareNalatiSpecies(data: SpeciesPresentationRows, programs: readonly { readonly id: string }[], bytes: Uint8Array): Promise<void> {
  const poses = Object.entries(data.poses).map(([key, { prefix, ...row }]) => [key, { ...row, programs: programs.filter(program => program.id.startsWith(prefix)) }] as const);
  const row=data.cracks;
  const { readBakedGeometry } = await import('@wildshard/game/plugin/geometry');
  const geometry = readBakedGeometry(bytes, 0, row);
  if (crackGeometry === null) crackGeometry = geometry; else geometry.dispose();
  speciesData = data;
  book ??= new SpeciesLookBook({...data.lookBook,body:data.packedBodies,poses:Object.fromEntries(poses)});
}
/** Borrow a species' admitted channels over its existing quadruped or custom joints. */
export function poseNalatiCreature(kind: string, c: AnimalRigContext): void {
  speciesLookBook().pose(kind, c);
}
/** The page and specimens share the same data-owned packed body cache. */
export function speciesLookBook():SpeciesLookBook{if(book===null)throw new Error('Species look book is not prepared');return book;}
export async function preloadNalatiBodies():Promise<void>{await speciesLookBook().preloadBodies();}

/** The crack mesh is generated once against the original skeleton at build time. */
export function balbalCrackGeometry(): THREE.BufferGeometry { if (crackGeometry === null) throw new Error('Missing balbal crack geometry'); return crackGeometry; }
export function speciesGuestRows(): { program: unknown; strike: unknown } { if (speciesData === null) throw new Error('Missing species guest program'); return { program: speciesData.program,strike: speciesData.strike }; }

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
