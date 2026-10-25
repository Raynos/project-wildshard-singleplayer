import * as v from 'valibot';
import { isJsonData } from './json';

/** Exact Z2 publication names, never paths into a shard-owned object. */
export const HandleIdSchema: v.GenericSchema<HandleIdInput, HandleId> = v.pipe(v.string(), v.minLength(1), v.maxLength(256), v.regex(/^[a-z0-9][a-zA-Z0-9.-]*$/));

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite());
/** A named scene origin, published point with world offset, or prompt identity. */
export const ScenePointRefSchema: v.GenericSchema<ScenePointRefInput, ScenePointRef> = v.pipe(v.unknown(), v.check(isJsonData, 'Scene point reference requires plain JSON'), v.union([
  v.strictObject({ part: HandleIdSchema }),
  v.strictObject({ point: HandleIdSchema, offset: v.exactOptional(v.tuple([finite, finite, finite])) }),
]));

export const SceneRefSchema: v.GenericSchema<SceneRefInput, SceneRef> = v.union([ScenePointRefSchema, v.pipe(v.unknown(), v.check(isJsonData, 'Scene reference requires plain JSON'), v.strictObject({ prompt: id }))]);

/** Read-only game state identities; no reflected property or function access. */
export const ObservationRefSchema: v.GenericSchema<ObservationRefInput, ObservationRef> = v.pipe(v.unknown(), v.check(isJsonData, 'Observation reference requires plain JSON'), v.union([
  v.strictObject({ flag: id }), v.strictObject({ mark: id }),
  v.strictObject({ mover: id, state: v.picklist(['at-end', 'moving']) }),
  v.strictObject({ quest: id, step: v.exactOptional(id), state: v.exactOptional(v.picklist(['active', 'complete'])) }),
  v.strictObject({ saved: v.strictObject({ record: v.picklist(['bosses', 'elites']), id,
    field: v.picklist(['defeated', 'rewardTaken', 'kills']) }) }),
]));

/** Check all publications before a consumer allocates prompts or effects. */
export function admitSceneRefs(refs: readonly SceneRef[], published: ReadonlySet<HandleId>, prompts: ReadonlySet<string> = new Set()): void {
  for (const input of refs) {
    const ref = v.parse(SceneRefSchema, input);
    const target = 'part' in ref ? ref.part : 'point' in ref ? ref.point : ref.prompt;
    if (!('prompt' in ref ? prompts : published).has(target)) throw new Error(`Missing scene reference: ${target}`);
  }
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type HandleIdInput = HandleId;
export type HandleId = string;
export type ScenePointRefInput = unknown;
export type ScenePointRef = ({
    part: HandleId;
}) | ({
    point: HandleId;
    offset?: [
        number,
        number,
        number
    ];
});
export type SceneRefInput = unknown;
export type SceneRef = (ScenePointRef) | ({
    prompt: string;
});
export type ObservationRefInput = unknown;
export type ObservationRef = ({
    flag: string;
}) | ({
    mark: string;
}) | ({
    mover: string;
    state: 'at-end' | 'moving';
}) | ({
    quest: string;
    step?: string;
    state?: 'active' | 'complete';
}) | ({
    saved: {
        record: 'bosses' | 'elites';
        id: string;
        field: 'defeated' | 'rewardTaken' | 'kills';
    };
});
