import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
/** `color`: the copy's own colour (an instanced copy's instance colour), as linear RGB components */
const at = { x: finite, y: finite, z: finite, variant: v.exactOptional(id), color: v.exactOptional(v.tuple([finite, finite, finite])),
  params: v.exactOptional(v.pipe(v.record(id, v.unknown()), v.check(value => isJsonData(value), 'Placement params require plain JSON'))) };
const pose = v.union([v.strictObject({ ...at, matrix: v.pipe(v.array(finite), v.length(16)) }),
  v.strictObject({ ...at, yxz: v.strictObject({ yaw: finite, yawAtan2: v.exactOptional(v.tuple([finite, finite])), scale: finite, pitch: v.exactOptional(finite), roll: v.exactOptional(finite) }) })]);
const distance = v.pipe(finite, v.minValue(0));
const tierNumber = v.union([distance, v.strictObject({ phone: distance, desktop: distance })]);
const cull = v.strictObject({ far: v.exactOptional(tierNumber), keepNear: v.exactOptional(finite),
  minAngular: v.exactOptional(tierNumber), view: v.exactOptional(v.literal('forest')),
  flat: v.exactOptional(v.boolean()), from: v.exactOptional(v.picklist(['origin', 'bounds'])),
  lodBy: v.exactOptional(v.picklist(['copy', 'set'])), bounds: v.exactOptional(v.picklist(['sphere', 'box'])), frustum: v.exactOptional(v.boolean()),
  radiusBias: v.exactOptional(finite), step: v.exactOptional(v.pipe(finite, v.minValue(0))) });
/** Deferred named placements use the same model/LOD/cull owner as ordinary placed models. */
export const WorldScenePlacementSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<WorldScenePlacementRowInput['id'], WorldScenePlacementRow['id']>; readonly tier: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['tier'], undefined>, Exclude<WorldScenePlacementRow['tier'], undefined>>, undefined>; readonly model: v.GenericSchema<WorldScenePlacementRowInput['model'], WorldScenePlacementRow['model']>; readonly batch: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['batch'], undefined>, Exclude<WorldScenePlacementRow['batch'], undefined>>, undefined>; readonly draw: v.GenericSchema<WorldScenePlacementRowInput['draw'], WorldScenePlacementRow['draw']>; readonly name: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['name'], undefined>, Exclude<WorldScenePlacementRow['name'], undefined>>, undefined>; readonly drawnInto: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['drawnInto'], undefined>, Exclude<WorldScenePlacementRow['drawnInto'], undefined>>, undefined>; readonly poses: v.GenericSchema<WorldScenePlacementRowInput['poses'], WorldScenePlacementRow['poses']>; readonly cull: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['cull'], undefined>, Exclude<WorldScenePlacementRow['cull'], undefined>>, undefined>; readonly sortObjects: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['sortObjects'], undefined>, Exclude<WorldScenePlacementRow['sortObjects'], undefined>>, undefined>; readonly colliders: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['colliders'], undefined>, Exclude<WorldScenePlacementRow['colliders'], undefined>>, undefined>; readonly piece: v.ExactOptionalSchema<v.GenericSchema<Exclude<WorldScenePlacementRowInput['piece'], undefined>, Exclude<WorldScenePlacementRow['piece'], undefined>>, undefined>; }, undefined> = v.strictObject({ id, tier: v.exactOptional(v.picklist(['phone', 'desktop'])), model: id, batch: v.exactOptional(id), draw: v.picklist(['single', 'instanced', 'batched', 'merged']),
  // the drawn name (the budget ruler's lanes, the GPU ruler's groups, the instance culler's LOD names): the placed object's
  // and its level-0 instanced mesh's
  name: v.exactOptional(id),
  drawnInto: v.exactOptional(v.strictObject({ part: id, boxes: v.pipe(v.array(finite), v.maxLength(49152), v.check(rows => rows.length % 6 === 0)) })),
  poses: v.pipe(v.array(pose), v.maxLength(8192)), cull: v.exactOptional(cull), sortObjects: v.exactOptional(v.boolean()),
  colliders: v.exactOptional(v.pipe(v.array(v.pipe(v.unknown(), v.check(isJsonData, 'Placement colliders require plain JSON'))), v.maxLength(32768))),
  piece: v.exactOptional(v.strictObject({ id, follows: v.exactOptional(v.literal('copy')), solidFloor: v.exactOptional(v.boolean()), floorPolicy: v.exactOptional(v.picklist(['first', 'highest'])), floors: v.exactOptional(v.pipe(v.array(v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), y: finite, rot: v.exactOptional(finite), slope: v.exactOptional(finite), tilt: v.exactOptional(finite), profile: v.exactOptional(v.pipe(v.array(v.tuple([finite, v.pipe(finite, v.minValue(0)), finite])), v.minLength(2), v.maxLength(8), v.check(knots => knots.every((k, i) => i === 0 || k[0] > (knots[i - 1]?.[0] ?? Infinity))))) })), v.maxLength(4096))), name: v.exactOptional(id), split: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2048))) })) });

/** JSON blobs are decoded independently so one world's contact tables never become a monolithic section. */
export function parseWorldScenePlacement(input: unknown): WorldScenePlacementRow { return v.parse(WorldScenePlacementSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type WorldScenePlacementRowInput = WorldScenePlacementRow;
interface WorldScenePlacementRowFields {
    id: string;
    tier?: 'phone' | 'desktop';
    model: string;
    batch?: string;
    draw: 'single' | 'instanced' | 'batched' | 'merged';
    name?: string;
    drawnInto?: {
        part: string;
        boxes: (number)[];
    };
    poses: ((Omit<{
        x: number;
        y: number;
        z: number;
        variant?: string;
        color?: [
            number,
            number,
            number
        ];
        params?: Record<string, unknown>;
    }, keyof ({
        matrix: (number)[];
    })> & {
        matrix: (number)[];
    }) | (Omit<{
        x: number;
        y: number;
        z: number;
        variant?: string;
        color?: [
            number,
            number,
            number
        ];
        params?: Record<string, unknown>;
    }, keyof ({
        yxz: {
            yaw: number;
            yawAtan2?: [
                number,
                number
            ];
            scale: number;
            pitch?: number;
            roll?: number;
        };
    })> & {
        yxz: {
            yaw: number;
            yawAtan2?: [
                number,
                number
            ];
            scale: number;
            pitch?: number;
            roll?: number;
        };
    }))[];
    cull?: {
        far?: (number) | ({
            phone: number;
            desktop: number;
        });
        keepNear?: number;
        minAngular?: (number) | ({
            phone: number;
            desktop: number;
        });
        view?: 'forest';
        flat?: boolean;
        from?: 'origin' | 'bounds';
        lodBy?: 'copy' | 'set';
        bounds?: 'sphere' | 'box';
        frustum?: boolean;
        radiusBias?: number;
        step?: number;
    };
    sortObjects?: boolean;
    colliders?: (unknown)[];
    piece?: {
        id: string;
        follows?: 'copy';
        solidFloor?: boolean;
        floorPolicy?: 'first' | 'highest';
        floors?: ({
            x: number;
            z: number;
            hw: number;
            hd: number;
            y: number;
            rot?: number;
            slope?: number;
            tilt?: number;
            profile?: ([
                number,
                number,
                number
            ])[];
        })[];
        name?: string;
        split?: number;
    };
}
export type WorldScenePlacementRow = { [Key in keyof WorldScenePlacementRowFields]: WorldScenePlacementRowFields[Key] };
