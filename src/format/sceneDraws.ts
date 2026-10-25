import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite());
const xyz = v.tuple([finite, finite, finite]);
const reference = v.strictObject({ library: id, model: id });
/** Shared presentation primitives retain authored draw order and GPU seeds. */
export const SceneDrawSchema: v.GenericSchema<SceneDrawInput, SceneDraw> = v.variant('kind', [
  v.strictObject({ kind: v.literal('buffered'), file: id, material: id, scale: v.optional(finite, 1), y: v.optional(finite, 0),
    order: v.exactOptional(finite), tier: v.exactOptional(v.picklist(['phone', 'desktop'])) }),
  v.strictObject({ kind: v.literal('card'), material: id, geometry: reference, scale: v.union([finite, xyz]), at: v.optional(xyz, [0, 0, 0]), order: finite, name: id }),
  v.strictObject({ kind: v.literal('pool'), geometry: reference, material: id }),
]);
export const SceneDrawsSchema: v.GenericSchema<SceneDrawsRowsInput, SceneDrawsRows> = v.pipe(v.array(SceneDrawSchema), v.maxLength(32));


/** Admitted data contracts, independent of validator implementation metadata. */
export type SceneDrawInput = ({
    kind: 'buffered';
    file: string;
    material: string;
    scale?: number | undefined;
    y?: number | undefined;
    order?: number;
    tier?: 'phone' | 'desktop';
}) | ({
    kind: 'card';
    material: string;
    geometry: {
        library: string;
        model: string;
    };
    scale: (number) | ([
        number,
        number,
        number
    ]);
    at?: [
        number,
        number,
        number
    ] | undefined;
    order: number;
    name: string;
}) | ({
    kind: 'pool';
    geometry: {
        library: string;
        model: string;
    };
    material: string;
});
export type SceneDraw = ({
    kind: 'buffered';
    file: string;
    material: string;
    scale: number;
    y: number;
    order?: number;
    tier?: 'phone' | 'desktop';
}) | ({
    kind: 'card';
    material: string;
    geometry: {
        library: string;
        model: string;
    };
    scale: (number) | ([
        number,
        number,
        number
    ]);
    at: [
        number,
        number,
        number
    ];
    order: number;
    name: string;
}) | ({
    kind: 'pool';
    geometry: {
        library: string;
        model: string;
    };
    material: string;
});
export type SceneDrawsRowsInput = (SceneDrawInput)[];
export type SceneDrawsRows = (SceneDraw)[];
