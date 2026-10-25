import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const order = { system: id, before: v.pipe(v.array(id), v.maxLength(16)), after: v.exactOptional(v.pipe(v.array(id), v.maxLength(16))) };
const audioInput=v.strictObject({name:id,source:v.variant('kind',[
  v.strictObject({kind:v.literal('wind'),field:v.picklist(['speed','gust'])}),
  v.strictObject({kind:v.literal('weather'),owner:id,field:v.picklist(['sun','dark','storm'])}),
  v.strictObject({kind:v.literal('arena'),owner:id,field:v.picklist(['inside','engaged'])}),
])});
/** Native owner/registration glue only. Rows never contain a clock, math law or callback. */
export const WorldUpdatesSchema: v.GenericSchema<WorldUpdatesRowsInput, WorldUpdatesRows> = v.pipe(v.unknown(), v.check(isJsonData, 'World updates require plain JSON data'), v.array(v.variant('kind', [
  v.strictObject({ kind: v.literal('entered-owner'), ...order, owner: id, phase: v.picklist(['update', 'late']) }),
  v.strictObject({ kind: v.literal('arena-room'), ...order, owner: id, riders: v.exactOptional(id), indoors: v.exactOptional(v.literal(true)) }),
  v.strictObject({ kind: v.literal('timed-encounters'), ...order, owner: id, pauseInPractice: v.boolean() }),
  v.strictObject({ kind: v.literal('elite-entry'), ...order, owner: id, arena: id, night: id, riding: id, hideHeadBars: v.boolean() }),
  v.strictObject({ kind: v.literal('wind'), ...order }),
  v.strictObject({ kind: v.literal('painted-world'), ...order, world: id, weather: id }),
  v.strictObject({ kind: v.literal('rope-deck'), ...order, deck: id, chain: id }),
  v.strictObject({ kind: v.literal('toon-look'), ...order, look: id }),
  v.strictObject({ kind: v.literal('buildings'), ...order, owner: id }),
  v.strictObject({kind:v.literal('audio-scene'),...order,inputs:v.pipe(v.array(audioInput),v.minLength(1),v.maxLength(32),v.check(rows=>new Set(rows.map(row=>row.name)).size===rows.length))}),
  v.strictObject({kind:v.literal('cosmetic-finishes'),...order,elite:id,every:v.pipe(v.number(),v.finite(),v.minValue(.001),v.maxValue(60))}),
])), v.minLength(1), v.maxLength(32));


/** Admitted data contracts, independent of validator implementation metadata. */
export type WorldUpdatesRowsInput = unknown;
export type WorldUpdatesRows = ((Omit<Omit<{
    kind: 'entered-owner';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    owner: string;
    phase: 'update' | 'late';
})> & {
    owner: string;
    phase: 'update' | 'late';
}) | (Omit<Omit<{
    kind: 'arena-room';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    owner: string;
    riders?: string;
    indoors?: true;
})> & {
    owner: string;
    riders?: string;
    indoors?: true;
}) | (Omit<Omit<{
    kind: 'timed-encounters';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    owner: string;
    pauseInPractice: boolean;
})> & {
    owner: string;
    pauseInPractice: boolean;
}) | (Omit<Omit<{
    kind: 'elite-entry';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    owner: string;
    arena: string;
    night: string;
    riding: string;
    hideHeadBars: boolean;
})> & {
    owner: string;
    arena: string;
    night: string;
    riding: string;
    hideHeadBars: boolean;
}) | (Omit<{
    kind: 'wind';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}) | (Omit<Omit<{
    kind: 'painted-world';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    world: string;
    weather: string;
})> & {
    world: string;
    weather: string;
}) | (Omit<Omit<{
    kind: 'rope-deck';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    deck: string;
    chain: string;
})> & {
    deck: string;
    chain: string;
}) | (Omit<Omit<{
    kind: 'toon-look';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    look: string;
})> & {
    look: string;
}) | (Omit<Omit<{
    kind: 'buildings';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    owner: string;
})> & {
    owner: string;
}) | (Omit<Omit<{
    kind: 'audio-scene';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    inputs: ({
        name: string;
        source: ({
            kind: 'wind';
            field: 'speed' | 'gust';
        }) | ({
            kind: 'weather';
            owner: string;
            field: 'sun' | 'dark' | 'storm';
        }) | ({
            kind: 'arena';
            owner: string;
            field: 'inside' | 'engaged';
        });
    })[];
})> & {
    inputs: ({
        name: string;
        source: ({
            kind: 'wind';
            field: 'speed' | 'gust';
        }) | ({
            kind: 'weather';
            owner: string;
            field: 'sun' | 'dark' | 'storm';
        }) | ({
            kind: 'arena';
            owner: string;
            field: 'inside' | 'engaged';
        });
    })[];
}) | (Omit<Omit<{
    kind: 'cosmetic-finishes';
}, keyof ({
    system: string;
    before: (string)[];
    after?: (string)[];
})> & {
    system: string;
    before: (string)[];
    after?: (string)[];
}, keyof ({
    elite: string;
    every: number;
})> & {
    elite: string;
    every: number;
}))[];
