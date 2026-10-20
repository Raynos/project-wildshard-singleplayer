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
export const LoadoutSchema = v.strictObject({
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
export type LoadoutRows = v.InferOutput<typeof LoadoutSchema>;

const weapon = v.custom<`weapon.${string}`>(value => typeof value === 'string' && /^weapon\.[a-z0-9.-]+$/u.test(value));
/** Mounted native weapon families and their replacement identities are authored rows. */
export const MountedLoadoutSchema = v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  blade: v.strictObject({ file:text,item:weapon }),
  polearm: v.strictObject({ file:text,item:weapon }),
  bow: v.strictObject({ file:text,item:weapon }),
  initial:v.picklist(['blade','polearm','bow']),
  variants:v.strictObject({ bow:v.strictObject({id:weapon,name:text}),blade:v.strictObject({id:weapon,name:text}) }),
}));
export type MountedLoadoutRows = v.InferOutput<typeof MountedLoadoutSchema>;
