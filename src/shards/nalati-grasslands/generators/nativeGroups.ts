import { parseNativeGroupRows, parsePopulationField, parsePageGroupRows, parseWildlifePopulation, parsePopulationKnockdownSource, parsePopulationForagerSource } from '@wildshard/sdk/nativePopulationRows';
import packBinding from '../data/packGuest.json' with {type:'json'};
import herdBinding from '../data/herdGuest.json' with {type:'json'};
import type { NalatiTitanProgram } from './stormTitanRows.mjs';
import { nalatiPhysics } from './physics';
import { nalatiRidingPopulation } from './ridingRows.mjs';
import * as poi from './poiLayout';
import { nalatiPopulationFieldSource } from './geographySource';
import { nalatiDayClockRow } from './dayClock';
import assembly from '../data/headlessAssembly.json' with { type: 'json' };
import boot from '../data/headlessBoot.json' with { type: 'json' };
import { NALATI_ECOLOGY as ecology } from './ecology.mjs';
import brains from '../data/brains.json' with { type: 'json' };
import { nalatiStrikeRows } from './kurganRows';
import admissionInput from '../behaviour/admission.generated.json' with { type: 'json' };

const contacts = nalatiStrikeRows();

const physics = nalatiPhysics();
const {compiled:_admissionCompiled,...admission}=admissionInput;
const herd = (index: number): string[] => {
  const row = boot.roster.herds[index]; if (row === undefined) throw new Error('Missing authored herd');
  return row.members.map(body => body.id);
};
const den = ecology.wildlife.packs[0], lair = herd(3), adopt = lair.pop();
if (den === undefined || adopt === undefined) throw new Error('Missing authored native group');
const denX = den.x, denZ = den.z;
const nativeField = parsePopulationField(nalatiPopulationFieldSource());
// GR6: the population rows, not the compiled riding program, are what the native groups read
const riding = { population: nalatiRidingPopulation(ecology) };
const nativeKnockdown=parsePopulationKnockdownSource(riding);
const forager = parsePopulationForagerSource(riding);
/** The headless assembly: the native and page groups and the wildlife rows around the shared pasture programme. */
export type NalatiHeadlessAssembly = Omit<typeof assembly, 'constants'> & { constants: Omit<typeof assembly.constants, 'nativeKnockdown' | 'groupRows' | 'groupAdmission' | 'nativeField' | 'pageGroups' | 'nativeDayClock' | 'pageWildlife'> & { nativeKnockdown: ReturnType<typeof parsePopulationKnockdownSource>; groupRows: ReturnType<typeof parseNativeGroupRows>; groupAdmission: Omit<typeof admissionInput, 'compiled'>; nativeField: ReturnType<typeof parsePopulationField>; pageGroups: ReturnType<typeof parsePageGroupRows>; nativeDayClock: ReturnType<typeof nalatiDayClockRow>; pageWildlife: ReturnType<typeof parseWildlifePopulation> } };
/** GR6: the assembly around the build's compiled pasture programme (stormTitanProgram.ts). */
export function nalatiHeadlessAssembly(pasture: NalatiTitanProgram): NalatiHeadlessAssembly {
  /** Preserve setup order, including the two guest-owned draws before adoption. */
  const nalatiNativeGroupRows = parseNativeGroupRows( {
    id: 'nalati.groups', herds: 'nalati.herds', tokens: 'nalati.tokens', bounds: [-250,250,-250,250],
    owned: boot.roster.bodies.filter(body => body.kind === 'horse' && body.herd === -1).map(body => body.id),
    contacts: { pack: contacts.wolf, herd: contacts.stallion },
    steps: [
      { kind: 'group', row: { ...brains.pack, members: herd(0), home: [denX,denZ] }, adopt: null,guest:{program:pasture,binding:packBinding} },
      { kind: 'group', row: { ...brains.herd, members: herd(1) }, adopt: null,guest:{program:pasture,binding:herdBinding} },
      { kind: 'delay', program: admission, signal: 'firstRaid', channel: 'time' },
      { kind: 'group', row: { ...brains.herd, members: lair }, adopt,guest:{program:pasture,binding:herdBinding} },
    ],
  });
  const groupAssembly = { ...assembly,constants: { ...assembly.constants,nativeKnockdown,groupRows: nalatiNativeGroupRows,groupAdmission: admission,nativeField,pageGroups: parsePageGroupRows({ packGuest:{program:pasture,binding:{...packBinding,parameters:{boundsHalf:nativeField.world.size/2}}},guest:{program:pasture,binding:herdBinding},pack: { ...brains.pack,members: ['group.member'],home: [0,0] },herd: { ...brains.herd,members: ['group.member'] },contacts: { pack: contacts.wolf,herd: contacts.stallion },effects:{notices:[{signal:'howl',text:'A wolf howls — the pack has your scent',every:60},{signal:'stampede',text:'Stampede!',every:20},{signal:'pack-driven-off',text:'The stallion drives the wolves off',every:30},{signal:'stallion-beaten',text:'The stallion gives ground',every:30}],knockdown:{...nativeKnockdown,text:'Knocked down!',every:4}},world: nativeField.world,wind: { x: -.8,z: .6,strength: .5 },prey: 'sheep',damage: admission }),nativeDayClock: nalatiDayClockRow() } };
  const pageWildlife = parseWildlifePopulation({ combat:{kind:'sheep',damage:100},pastureActor: { kind: 'horse',variant: 'camp-bay',label: "Shepherd's horse",raiders: ['grey','tawny','scout'],cues: { start: { text: 'Wolves are raiding the flock — the shepherd rides out',sound: null },taken: { text: 'The wolves took a sheep',sound: null },drivenOff: { text: 'The shepherd drove the wolves off',sound: null },crack: { text: '',sound: 'wolf_yelp' } } },seed: nativeField.seed,random: nativeField.seed ^ 0x3a17,groups: groupAssembly.constants.pageGroups,admission,pasture,
    kinds: { predator: 'wolf',mount: 'horse',guardian: 'sheepdog',guardianVariant: 'collie' },coats: ecology.mareVariants,young: ['foal-bay','foal-chestnut'],leader: 'stallion',
    packs: ecology.wildlife.packs,herds: ecology.wildlife.herds,flocks: ecology.wildlife.flocks,
    mountables: ecology.wildlife.campHorses === true ? poi.HITCH_HORSE_SPOTS.map((row,index) => ({ x: row.x,z: row.z,yaw: Math.atan2(row.face.x,row.face.z),variant: index === 0 ? 'camp-bay' : 'camp-black' })) : [],
    foragers: ecology.wildlife.marmots === undefined ? null : { row: forager,seed: nativeField.seed ^ 0x6a2b,initial: physics.marmots,cue: 'marmot_whistle',runSpeed: 5,view:{name:'marmots',books:{phone:'models/cover-phone.json',desktop:'models/cover-desktop.json'},model:'marmot',rim:.8,bands:.85,tilt:-1.25,sink:-.45} },
    relations: { alert: 'whistle',range: 'scare',packRadius: 20,disturbRadius: 25,disturbSeconds: 4,scareSeconds: 6 },
    trample: { kinds: { wolf: .5,horse: .8,sheepdog: .4 },minSpeed: .6,range: 80,fullSpeed: 6 },soundHeight: .6 });
  return { ...groupAssembly,constants: { ...groupAssembly.constants,pageWildlife } };
}
