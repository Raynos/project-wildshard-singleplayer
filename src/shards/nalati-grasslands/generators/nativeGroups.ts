import * as v from 'valibot';
import { NativeGroupRowsSchema } from '@wildshard/format/creatures';
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
export const headlessAssembly = { ...assembly, constants: { ...assembly.constants, groupRows: nalatiNativeGroupRows, groupAdmission: admission } };
