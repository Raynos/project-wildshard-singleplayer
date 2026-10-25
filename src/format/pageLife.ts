import * as v from 'valibot';
import { AmbientFlockSchema, AmbientPerchesSchema, ForagerPopulationSchema } from './ambientLife';
import { CrowdWeaponTargetSchema } from './crowds';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const number = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(number, v.minValue(0), v.maxValue(1000000));
const count = v.pipe(nonnegative, v.integer(), v.maxValue(256));
const range = v.pipe(v.tuple([number, number]), v.check(([lo, hi]) => lo <= hi));
const system = v.strictObject({ id, after: v.array(id), before: v.array(id) });
/** Client ambient ownership over actual flock, journal, tool and actor services.
 * Rules are stateless ABI-v1 projections; no executable shard ports cross rows. */
export const PageLifeSchema: v.GenericSchema<PageLifeRowsInput, PageLifeRows> = v.strictObject({
  version: v.literal(1), seed: number, system,
  draw: v.nullable(v.strictObject({ library: id, capacity: v.pipe(number, v.integer(), v.minValue(1), v.maxValue(512)), glow: range })),
  flocks: v.pipe(v.array(v.strictObject({ id, row: AmbientFlockSchema, perches: AmbientPerchesSchema,
    packed: v.boolean(), borrowed: v.boolean(), audio: v.picklist(['bank', 'cue']),
    /** its own posed library (a named product file) instead of the page draw's, ticked about a fixed `anchor` instead of
     *  the player, its instances tinted in order (`0xRRGGBB`): Driftwood's reef fish school */
    library: v.exactOptional(id), anchor: v.exactOptional(v.strictObject({ x: number, y: number, z: number })),
    tints: v.exactOptional(v.pipe(v.array(v.pipe(number, v.integer(), v.minValue(0), v.maxValue(0xffffff))), v.maxLength(256))) })), v.maxLength(16)),
  foragers: v.pipe(v.array(v.strictObject({ row: ForagerPopulationSchema, model: number, scale: number,
    alertRate: number, alertGain: number, sitPitch: number,
    combat: v.exactOptional(v.strictObject({ target: CrowdWeaponTargetSchema, preyY: number,
      hits: v.pipe(v.array(v.tuple([number, number, v.pipe(number, v.minValue(0.001), v.maxValue(20))])), v.minLength(1), v.maxLength(16)) })),
  })), v.maxLength(16)),
  program: v.exactOptional(v.strictObject({ script: v.unknown(), bytes: v.string() })),
  carcasses: v.exactOptional(v.strictObject({ group: id, arrival: range, visitors: v.record(id, count),
    bodyWidths: v.record(id, nonnegative), defaultWidth: nonnegative, defaultVisitors: count,
    giveUp: nonnegative, reach: nonnegative, tint: nonnegative, untrackedAge: nonnegative, harvestDelay: nonnegative })),
  guide: v.exactOptional(v.strictObject({ group: id, policy: v.strictObject({ distance: v.literal('centre'), min: nonnegative, max: nonnegative,
    schedule: v.strictObject({ kind: v.literal('periodic'), initial: nonnegative, period: v.pipe(range, v.check(([lo]) => lo >= 0.1)) }) }), cue: id, gain: nonnegative })),
  harvest: v.exactOptional(v.strictObject({ len: nonnegative, kneelIn: nonnegative, cuts: v.array(nonnegative), rise: nonnegative,
    camera: v.strictObject({ down: number, targetY: number, defaultPitch: number, maxPitch: nonnegative }),
    surface: v.picklist(['litter', 'sand', 'rock', 'grass', 'planks']), sounds: v.tuple([id, id]), gain: nonnegative,
    kick: v.tuple([number, number]), fallbackSurface: v.picklist(['wood', 'ground', 'flesh']), fallbackPan: number, fallbackGain: number })),
  debug: v.exactOptional(v.strictObject({ id, window: id, flocks: v.record(id, id), visitors: v.record(id, id), populations: v.record(id, id),
    commands: v.record(id, v.strictObject({ operation: v.picklist(['visit', 'scavenge']), group: id })) })),
});

export function parsePageLife(input: unknown): PageLifeRows {
  const rows = v.parse(PageLifeSchema, input), ids = new Set(rows.flocks.map(row => row.id));
  const packed = rows.flocks.reduce((sum, row) => sum + (row.packed ? row.row.count : 0), 0)
    + rows.foragers.reduce((sum, row) => sum + row.row.count, 0);
  if (ids.size !== rows.flocks.length || rows.flocks.some(row => row.packed && row.borrowed || row.library !== undefined && (row.packed || row.borrowed))
    || (rows.draw === null ? packed > 0 : packed > rows.draw.capacity)
    || (rows.carcasses !== undefined || rows.guide !== undefined) && rows.program === undefined
    || rows.carcasses !== undefined && !rows.flocks.some(row => row.id === rows.carcasses?.group && row.row.scavenge !== null)
    || rows.guide !== undefined && !rows.flocks.some(row => row.id === rows.guide?.group && row.row.guide !== null)) throw new Error('Invalid ambient ownership rows');
  if (rows.debug !== undefined && [...Object.values(rows.debug.flocks), ...Object.values(rows.debug.visitors),
    ...Object.values(rows.debug.commands).map(row => row.group)].some(name => !ids.has(name))) throw new Error('Unknown ambient debug group');
  return rows;
}

/** Admitted data contracts, independent of validator implementation metadata. */
interface PageLifeRowsInputFields {
    version: 1;
    seed: number;
    system: {
        id: string;
        after: (string)[];
        before: (string)[];
    };
    draw: ({
        library: string;
        capacity: number;
        glow: [
            number,
            number
        ];
    }) | null;
    flocks: ({
        id: string;
        row: v.InferInput<typeof AmbientFlockSchema>;
        perches: v.InferInput<typeof AmbientPerchesSchema>;
        packed: boolean;
        borrowed: boolean;
        audio: 'bank' | 'cue';
        library?: string;
        anchor?: {
            x: number;
            y: number;
            z: number;
        };
        tints?: (number)[];
    })[];
    foragers: ({
        row: v.InferInput<typeof ForagerPopulationSchema>;
        model: number;
        scale: number;
        alertRate: number;
        alertGain: number;
        sitPitch: number;
        combat?: {
            target: v.InferInput<typeof CrowdWeaponTargetSchema>;
            preyY: number;
            hits: ([
                number,
                number,
                number
            ])[];
        };
    })[];
    program?: {
        script: unknown;
        bytes: string;
    };
    carcasses?: {
        group: string;
        arrival: [
            number,
            number
        ];
        visitors: Record<string, number>;
        bodyWidths: Record<string, number>;
        defaultWidth: number;
        defaultVisitors: number;
        giveUp: number;
        reach: number;
        tint: number;
        untrackedAge: number;
        harvestDelay: number;
    };
    guide?: {
        group: string;
        policy: {
            distance: 'centre';
            min: number;
            max: number;
            schedule: {
                kind: 'periodic';
                initial: number;
                period: [
                    number,
                    number
                ];
            };
        };
        cue: string;
        gain: number;
    };
    harvest?: {
        len: number;
        kneelIn: number;
        cuts: (number)[];
        rise: number;
        camera: {
            down: number;
            targetY: number;
            defaultPitch: number;
            maxPitch: number;
        };
        surface: 'litter' | 'sand' | 'rock' | 'grass' | 'planks';
        sounds: [
            string,
            string
        ];
        gain: number;
        kick: [
            number,
            number
        ];
        fallbackSurface: 'wood' | 'ground' | 'flesh';
        fallbackPan: number;
        fallbackGain: number;
    };
    debug?: {
        id: string;
        window: string;
        flocks: Record<string, string>;
        visitors: Record<string, string>;
        populations: Record<string, string>;
        commands: Record<string, {
            operation: 'visit' | 'scavenge';
            group: string;
        }>;
    };
}
export type PageLifeRowsInput = { [Key in keyof PageLifeRowsInputFields]: PageLifeRowsInputFields[Key] };
interface PageLifeRowsFields {
    version: 1;
    seed: number;
    system: {
        id: string;
        after: (string)[];
        before: (string)[];
    };
    draw: ({
        library: string;
        capacity: number;
        glow: [
            number,
            number
        ];
    }) | null;
    flocks: ({
        id: string;
        row: v.InferOutput<typeof AmbientFlockSchema>;
        perches: v.InferOutput<typeof AmbientPerchesSchema>;
        packed: boolean;
        borrowed: boolean;
        audio: 'bank' | 'cue';
        library?: string;
        anchor?: {
            x: number;
            y: number;
            z: number;
        };
        tints?: (number)[];
    })[];
    foragers: ({
        row: v.InferOutput<typeof ForagerPopulationSchema>;
        model: number;
        scale: number;
        alertRate: number;
        alertGain: number;
        sitPitch: number;
        combat?: {
            target: v.InferOutput<typeof CrowdWeaponTargetSchema>;
            preyY: number;
            hits: ([
                number,
                number,
                number
            ])[];
        };
    })[];
    program?: {
        script: unknown;
        bytes: string;
    };
    carcasses?: {
        group: string;
        arrival: [
            number,
            number
        ];
        visitors: Record<string, number>;
        bodyWidths: Record<string, number>;
        defaultWidth: number;
        defaultVisitors: number;
        giveUp: number;
        reach: number;
        tint: number;
        untrackedAge: number;
        harvestDelay: number;
    };
    guide?: {
        group: string;
        policy: {
            distance: 'centre';
            min: number;
            max: number;
            schedule: {
                kind: 'periodic';
                initial: number;
                period: [
                    number,
                    number
                ];
            };
        };
        cue: string;
        gain: number;
    };
    harvest?: {
        len: number;
        kneelIn: number;
        cuts: (number)[];
        rise: number;
        camera: {
            down: number;
            targetY: number;
            defaultPitch: number;
            maxPitch: number;
        };
        surface: 'litter' | 'sand' | 'rock' | 'grass' | 'planks';
        sounds: [
            string,
            string
        ];
        gain: number;
        kick: [
            number,
            number
        ];
        fallbackSurface: 'wood' | 'ground' | 'flesh';
        fallbackPan: number;
        fallbackGain: number;
    };
    debug?: {
        id: string;
        window: string;
        flocks: Record<string, string>;
        visitors: Record<string, string>;
        populations: Record<string, string>;
        commands: Record<string, {
            operation: 'visit' | 'scavenge';
            group: string;
        }>;
    };
}
export type PageLifeRows = { [Key in keyof PageLifeRowsFields]: PageLifeRowsFields[Key] };
