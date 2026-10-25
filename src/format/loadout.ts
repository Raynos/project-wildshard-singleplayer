import { isJsonData } from './json';
import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(1024));
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const names = v.pipe(v.array(text), v.minLength(1), v.maxLength(64), v.check(rows => new Set(rows).size === rows.length));
const slot = v.picklist(['crossbow', 'sword', 'rifle', 'sword-iron', 'bow', 'sabre', 'spear', 'empty']);
const action = v.custom<`${string}.${string}`>(value => typeof value === 'string' && /^[^.]+\..+$/.test(value));
const cue = v.custom<`cue.${string}`>(value => typeof value === 'string' && value.startsWith('cue.') && value.length > 4);
/** A held loadout's ammunition, ownership, save ABI, input and cues. Native weapon clocks remain in combat/items. */
export const LoadoutSchema: v.GenericSchema<LoadoutRowsInput, LoadoutRows> = v.strictObject({
  pouch: v.pipe(v.strictObject({ kinds: names, fallback: text, capacity: natural }),
    v.check(row => row.kinds.includes(row.fallback) && !row.kinds.includes('selected'), 'fallback and stack identities')),
  persistence: v.strictObject({ key: text, version: v.literal(1), state: text, firearm: text, bow: text, interval: finite }),
  launcher: v.strictObject({ item: text, slot }),
  firearm: v.strictObject({ slot, owned: text, ammo: text }),
  bow: v.strictObject({ slot, owned: text, legacyItem: text, ammo: text, grantToast: text }),
  tints: v.record(text, v.strictObject({ color: natural, roughness: finite })),
  parked: v.strictObject({ name: text, y: finite, materialPrefix: text }),
  audio: v.strictObject({ echoVoice: text, impactVoice: text, impact: text, prewarm: names, cycleCue: cue, roundCue: cue,
    owner: text, surfaces: names, probe: finite }),
  input: v.strictObject({ id: text, action, key: text, label: text, icon: text }),
  text: v.strictObject({ selected: text, spent: text, recovered: text, broken: text }),
  debug: v.strictObject({ loadout: text, firearm: text, bow: text }),
  development: v.strictObject({ firearm: names, bow: names, launcher: names, ammunition: names, grant: natural }),
});
/** Admitted data used by the shared held loadout host. */


const weapon = v.custom<`weapon.${string}`>(value => typeof value === 'string' && /^weapon\.[a-z0-9.-]+$/u.test(value));
/** Mounted native weapon families and their replacement identities are authored rows. */
export const MountedLoadoutSchema: v.GenericSchema<MountedLoadoutRowsInput, MountedLoadoutRows> = v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  blade: v.strictObject({ file:text,item:weapon }),
  polearm: v.strictObject({ file:text,item:weapon }),
  bow: v.strictObject({ file:text,item:weapon }),
  initial:v.picklist(['blade','polearm','bow']),
  page:v.exactOptional(v.strictObject({ firearm:v.strictObject({file:text,item:weapon,muzzleLight:v.boolean()}),order:v.pipe(v.array(slot),v.maxLength(16)) })),
  variants:v.strictObject({ bow:v.strictObject({id:weapon,name:text}),blade:v.strictObject({id:weapon,name:text}) }),
}));


/** Admitted data contracts, independent of validator implementation metadata. */
export type LoadoutRowsInput = LoadoutRows;
interface LoadoutRowsFields {
    pouch: {
        kinds: (string)[];
        fallback: string;
        capacity: number;
    };
    persistence: {
        key: string;
        version: 1;
        state: string;
        firearm: string;
        bow: string;
        interval: number;
    };
    launcher: {
        item: string;
        slot: 'crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty';
    };
    firearm: {
        slot: 'crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty';
        owned: string;
        ammo: string;
    };
    bow: {
        slot: 'crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty';
        owned: string;
        legacyItem: string;
        ammo: string;
        grantToast: string;
    };
    tints: Record<string, {
        color: number;
        roughness: number;
    }>;
    parked: {
        name: string;
        y: number;
        materialPrefix: string;
    };
    audio: {
        echoVoice: string;
        impactVoice: string;
        impact: string;
        prewarm: (string)[];
        cycleCue: `cue.${string}`;
        roundCue: `cue.${string}`;
        owner: string;
        surfaces: (string)[];
        probe: number;
    };
    input: {
        id: string;
        action: `${string}.${string}`;
        key: string;
        label: string;
        icon: string;
    };
    text: {
        selected: string;
        spent: string;
        recovered: string;
        broken: string;
    };
    debug: {
        loadout: string;
        firearm: string;
        bow: string;
    };
    development: {
        firearm: (string)[];
        bow: (string)[];
        launcher: (string)[];
        ammunition: (string)[];
        grant: number;
    };
}
export type LoadoutRows = { [Key in keyof LoadoutRowsFields]: LoadoutRowsFields[Key] };
export type MountedLoadoutRowsInput = unknown;
interface MountedLoadoutRowsFields {
    blade: {
        file: string;
        item: `weapon.${string}`;
    };
    polearm: {
        file: string;
        item: `weapon.${string}`;
    };
    bow: {
        file: string;
        item: `weapon.${string}`;
    };
    initial: 'blade' | 'polearm' | 'bow';
    page?: {
        firearm: {
            file: string;
            item: `weapon.${string}`;
            muzzleLight: boolean;
        };
        order: ('crossbow' | 'sword' | 'rifle' | 'sword-iron' | 'bow' | 'sabre' | 'spear' | 'empty')[];
    };
    variants: {
        bow: {
            id: `weapon.${string}`;
            name: string;
        };
        blade: {
            id: `weapon.${string}`;
            name: string;
        };
    };
}
export type MountedLoadoutRows = { [Key in keyof MountedLoadoutRowsFields]: MountedLoadoutRowsFields[Key] };
