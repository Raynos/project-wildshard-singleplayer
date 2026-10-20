import * as v from 'valibot';
import { NativeGroupRowsSchema,PageGroupRowsSchema } from '@wildshard/format/creatures';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';
import pasture from '../behaviour/pasture.generated.json' with { type: 'json' };
import physics from '../data/physics.generated.json' with { type: 'json' };
import riding from '../behaviour/riding.generated.json' with { type: 'json' };
import { ForagerPopulationSchema } from '@wildshard/format/ambientLife';
import poi from '../data/poiLayout.generated.json' with { type: 'json' };
import { PopulationFieldSchema } from '@wildshard/format/populationEnvironment';
import fieldRows from '../data/populationField.generated.json' with { type: 'json' };
import { nalatiDayClockRow } from './dayClock';
import assembly from '../data/headlessAssembly.json' with { type: 'json' };
import boot from '../data/headlessBoot.json' with { type: 'json' };
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import brains from '../data/brains.json' with { type: 'json' };
import contacts from '../data/strikeProfiles.generated.json' with { type: 'json' };
import admission from '../behaviour/admission.generated.json' with { type: 'json' };

const herd = (index: number): string[] => {
  const row = boot.roster.herds[index]; if (row === undefined) throw new Error('Missing authored herd');
  return row.members.map(body => body.id);
};
const den = ecology.wildlife.packs[0], lair = herd(3), adopt = lair.pop();
if (den === undefined || adopt === undefined) throw new Error('Missing authored native group');
/** Preserve setup order, including the two guest-owned draws before adoption. */
export const nalatiNativeGroupRows = v.parse(NativeGroupRowsSchema, {
  id: 'nalati.groups', herds: 'nalati.herds', tokens: 'nalati.tokens', bounds: [-250,250,-250,250],
  owned: boot.roster.bodies.filter(body => body.kind === 'horse' && body.herd === -1).map(body => body.id),
  contacts: { pack: contacts.wolf, herd: contacts.stallion },
  steps: [
    { kind: 'group', row: { ...brains.pack, members: herd(0), home: [den.x,den.z] }, adopt: null },
    { kind: 'group', row: { ...brains.herd, members: herd(1) }, adopt: null },
    { kind: 'delay', program: admission, signal: 'firstRaid', channel: 'time' },
    { kind: 'group', row: { ...brains.herd, members: lair }, adopt },
  ],
});
const nativeField = v.parse(PopulationFieldSchema,fieldRows);
const groupAssembly = { ...assembly,constants: { ...assembly.constants,groupRows: nalatiNativeGroupRows,groupAdmission: admission,nativeField,pageGroups: v.parse(PageGroupRowsSchema,{ pack: { ...brains.pack,members: ['group.member'],home: [0,0] },herd: { ...brains.herd,members: ['group.member'] },contacts: { pack: contacts.wolf,herd: contacts.stallion },world: nativeField.world,wind: { x: -.8,z: .6,strength: .5 },prey: 'sheep',damage: admission }),nativeDayClock: nalatiDayClockRow() } };

const forager = v.parse(v.object({ population: v.object({ forager: v.object({ row: ForagerPopulationSchema }) }) }),riding).population.forager.row;
const pageWildlife = v.parse(WildlifePopulationSchema,{ seed: nativeField.seed,random: nativeField.seed ^ 0x3a17,groups: groupAssembly.constants.pageGroups,admission,pasture,
  kinds: { predator: 'wolf',mount: 'horse',guardian: 'sheepdog',guardianVariant: 'collie' },coats: ecology.mareVariants,young: ['foal-bay','foal-chestnut'],leader: 'stallion',
  packs: ecology.wildlife.packs,herds: ecology.wildlife.herds,flocks: ecology.wildlife.flocks,
  mountables: ecology.wildlife.campHorses === true ? poi.HITCH_HORSE_SPOTS.map((row,index) => ({ x: row.x,z: row.z,yaw: Math.atan2(row.face.x,row.face.z),variant: index === 0 ? 'camp-bay' : 'camp-black' })) : [],
  foragers: ecology.wildlife.marmots === undefined ? null : { row: forager,seed: nativeField.seed ^ 0x6a2b,initial: physics.marmots,cue: 'marmot_whistle',runSpeed: 5 },
  relations: { alert: 'whistle',range: 'scare',packRadius: 20,disturbRadius: 25,disturbSeconds: 4,scareSeconds: 6 },
  trample: { kinds: { wolf: .5,horse: .8,sheepdog: .4 },minSpeed: .6,range: 80,fullSpeed: 6 },soundHeight: .6 });
export const headlessAssembly = { ...groupAssembly,constants: { ...groupAssembly.constants,pageWildlife } };
