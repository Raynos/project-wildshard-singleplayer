import * as v from 'valibot';
import { CrowdWeaponTargetSchema } from './crowds';
import { PageGroupRowsSchema } from './creatures';
import { ReturnProgramSchema } from './namedJsonContracts';
import { ForagerPopulationSchema, ForagerContinuation, ForagerDrawSchema } from './ambientLife';

const n = v.pipe(v.number(),v.finite()),id = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const count = v.pipe(n,v.integer(),v.minValue(0),v.maxValue(256)),point = { x: n,z: n };
/** Page pasture binds real actor identities and publishes plain cue rows. */
export const PastureActorSchema: v.GenericSchema<PastureActorRowsInput, PastureActorRows> = v.strictObject({
  kind: id,variant: id,label: id,raiders: v.pipe(v.array(id),v.minLength(1),v.maxLength(16)),
  cues: v.record(id,v.strictObject({ text: v.string(),sound: v.nullable(id) })),
});
/** Ordered page population placement and native relationships. Presentation
 * receives explicit crowd/forager build commands instead of factory callbacks. */
export const WildlifePopulationSchema: v.GenericSchema<WildlifePopulationRowsInput, WildlifePopulationRows> = v.strictObject({
  seed: n,random: n,groups: PageGroupRowsSchema,admission: ReturnProgramSchema,pasture: ReturnProgramSchema,pastureActor: PastureActorSchema,combat: CrowdWeaponTargetSchema,
  kinds: v.strictObject({ predator: id,mount: id,guardian: id,guardianVariant: id }),
  coats: v.array(id),young: v.array(id),leader: id,
  packs: v.pipe(v.array(v.strictObject({ ...point,variants: v.array(id) })),v.maxLength(8)),
  herds: v.pipe(v.array(v.strictObject({ ...point,mares: count,foals: count,stallion: v.boolean() })),v.maxLength(8)),
  flocks: v.pipe(v.array(v.strictObject({ ...point,count,dog: v.boolean(),range: v.optional(n,45) })),v.maxLength(4)),
  mountables: v.array(v.strictObject({ ...point,yaw: n,variant: id })),
  foragers: v.nullable(v.strictObject({ row: ForagerPopulationSchema,seed: n,initial: ForagerContinuation,cue: id,runSpeed: n,view:v.exactOptional(ForagerDrawSchema) })),
  relations: v.strictObject({ alert: id,range: id,packRadius: n,disturbRadius: n,disturbSeconds: n,scareSeconds: n }),
  trample: v.strictObject({ kinds: v.record(id,n),minSpeed: n,range: n,fullSpeed: n }),
  soundHeight: n,
});

/** Admitted data contracts, independent of validator implementation metadata. */
export type PastureActorRowsInput = PastureActorRows;
interface PastureActorRowsFields {
    kind: string;
    variant: string;
    label: string;
    raiders: (string)[];
    cues: Record<string, {
        text: string;
        sound: (string) | null;
    }>;
}
export type PastureActorRows = { [Key in keyof PastureActorRowsFields]: PastureActorRowsFields[Key] };
interface WildlifePopulationRowsInputFields {
    seed: number;
    random: number;
    groups: v.InferInput<typeof PageGroupRowsSchema>;
    admission: v.InferInput<typeof ReturnProgramSchema>;
    pasture: v.InferInput<typeof ReturnProgramSchema>;
    pastureActor: PastureActorRowsInput;
    combat: v.InferInput<typeof CrowdWeaponTargetSchema>;
    kinds: {
        predator: string;
        mount: string;
        guardian: string;
        guardianVariant: string;
    };
    coats: (string)[];
    young: (string)[];
    leader: string;
    packs: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        variants: (string)[];
    })> & {
        variants: (string)[];
    })[];
    herds: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        mares: number;
        foals: number;
        stallion: boolean;
    })> & {
        mares: number;
        foals: number;
        stallion: boolean;
    })[];
    flocks: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        count: number;
        dog: boolean;
        range?: number | undefined;
    })> & {
        count: number;
        dog: boolean;
        range?: number | undefined;
    })[];
    mountables: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        yaw: number;
        variant: string;
    })> & {
        yaw: number;
        variant: string;
    })[];
    foragers: ({
        row: v.InferInput<typeof ForagerPopulationSchema>;
        seed: number;
        initial: v.InferInput<typeof ForagerContinuation>;
        cue: string;
        runSpeed: number;
        view?: v.InferInput<typeof ForagerDrawSchema>;
    }) | null;
    relations: {
        alert: string;
        range: string;
        packRadius: number;
        disturbRadius: number;
        disturbSeconds: number;
        scareSeconds: number;
    };
    trample: {
        kinds: Record<string, number>;
        minSpeed: number;
        range: number;
        fullSpeed: number;
    };
    soundHeight: number;
}
export type WildlifePopulationRowsInput = { [Key in keyof WildlifePopulationRowsInputFields]: WildlifePopulationRowsInputFields[Key] };
interface WildlifePopulationRowsFields {
    seed: number;
    random: number;
    groups: v.InferOutput<typeof PageGroupRowsSchema>;
    admission: v.InferOutput<typeof ReturnProgramSchema>;
    pasture: v.InferOutput<typeof ReturnProgramSchema>;
    pastureActor: PastureActorRows;
    combat: v.InferOutput<typeof CrowdWeaponTargetSchema>;
    kinds: {
        predator: string;
        mount: string;
        guardian: string;
        guardianVariant: string;
    };
    coats: (string)[];
    young: (string)[];
    leader: string;
    packs: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        variants: (string)[];
    })> & {
        variants: (string)[];
    })[];
    herds: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        mares: number;
        foals: number;
        stallion: boolean;
    })> & {
        mares: number;
        foals: number;
        stallion: boolean;
    })[];
    flocks: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        count: number;
        dog: boolean;
        range: number;
    })> & {
        count: number;
        dog: boolean;
        range: number;
    })[];
    mountables: (Omit<{
        x: number;
        z: number;
    }, keyof ({
        yaw: number;
        variant: string;
    })> & {
        yaw: number;
        variant: string;
    })[];
    foragers: ({
        row: v.InferOutput<typeof ForagerPopulationSchema>;
        seed: number;
        initial: v.InferOutput<typeof ForagerContinuation>;
        cue: string;
        runSpeed: number;
        view?: v.InferOutput<typeof ForagerDrawSchema>;
    }) | null;
    relations: {
        alert: string;
        range: string;
        packRadius: number;
        disturbRadius: number;
        disturbSeconds: number;
        scareSeconds: number;
    };
    trample: {
        kinds: Record<string, number>;
        minSpeed: number;
        range: number;
        fullSpeed: number;
    };
    soundHeight: number;
}
export type WildlifePopulationRows = { [Key in keyof WildlifePopulationRowsFields]: WildlifePopulationRowsFields[Key] };
