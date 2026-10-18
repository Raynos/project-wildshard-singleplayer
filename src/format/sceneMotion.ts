import * as v from 'valibot';
import { isJsonData } from './json';
import { HandleIdSchema, ScenePointRefSchema } from './sceneRefs';
import { ClientChannelPropertySchema } from './clientChannels';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const ids = v.pipe(v.array(id), v.maxLength(128));
const owners = v.pipe(v.array(id), v.maxLength(32));
const vector = v.strictObject({ x: finite, y: finite, z: finite });
const unique = (rows: readonly { readonly id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
const transform = v.picklist(['x', 'y', 'z', 'yaw', 'pitch', 'roll']);
const inputSchema = v.union([v.strictObject({ flag: id }), v.strictObject({ mode: id }),
  v.strictObject({ part: HandleIdSchema, property: transform })]);
/** Existing native mover configuration and the views bound to its published poses.
 * Groups only partition declared channel programs; no new scheduler is authored. */
export const SceneMotionSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Scene motion requires plain JSON'), v.strictObject({
  version: v.literal(1), owner: id,
  installation: v.strictObject({ systemId: id, viewSystemId: v.exactOptional(id), frameSystemId: v.exactOptional(id), socketLiftPrompts: v.exactOptional(v.boolean()),
    permissions: v.optional(v.pipe(v.array(v.strictObject({ mover: id,
      flags: v.pipe(v.array(v.strictObject({ name: id, bit: v.pipe(finite, v.safeInteger(), v.minValue(0), v.maxValue(65536)) })), v.maxLength(16)) })), v.maxLength(32)), []) }),
  groups: v.pipe(v.array(v.strictObject({ id, programs: ids,
    targets: v.pipe(v.record(id, HandleIdSchema), v.check(rows => Object.keys(rows).length <= 128)),
    nativeOwners: v.optional(owners, []), copiedOwners: v.optional(owners, []), bindings: v.optional(ids, []),
    rest: v.optional(v.pipe(v.array(v.strictObject({ id, position: vector, euler: vector, enabled: v.boolean() })), v.maxLength(32)), []),
    initial: v.optional(v.pipe(v.array(v.strictObject({ program: id, at: ScenePointRefSchema })), v.maxLength(32)), []),
    prompts: v.optional(v.pipe(v.array(v.strictObject({ id, action: id })), v.maxLength(64)), []),
    observations: v.optional(v.pipe(v.array(v.strictObject({ program: id, channel: ClientChannelPropertySchema, value: HandleIdSchema })), v.maxLength(64)), []),
  })), v.minLength(1), v.maxLength(16)),
  frames: v.optional(v.pipe(v.array(v.strictObject({ id, program: id, cube: v.exactOptional(v.picklist(['standalone', 'cell'])),
    targets: v.pipe(v.record(id, HandleIdSchema), v.check(rows => Object.keys(rows).length <= 128)),
    inputs: v.pipe(v.record(id, inputSchema), v.check(rows => Object.keys(rows).length <= 128)),
    materials: v.optional(v.pipe(v.array(v.strictObject({ channel: ClientChannelPropertySchema,
      material: HandleIdSchema, property: v.picklist(['opacity', 'emissiveIntensity']) })), v.maxLength(32)), []),
  })), v.maxLength(128)), []),
}), v.check(rows => unique(rows.groups) && rows.groups.some(row => row.id === rows.owner)
  && new Set(rows.groups.flatMap(row => row.programs)).size === rows.groups.reduce((count, row) => count + row.programs.length, 0)
  && rows.groups.every((row, index) => new Set([...row.nativeOwners, ...row.copiedOwners]).size === row.nativeOwners.length + row.copiedOwners.length
    && new Set(row.programs).size === row.programs.length && new Set(row.bindings).size === row.bindings.length
    && unique(row.prompts) && row.bindings.every(targetId => rows.groups.slice(0, index).some(group => group.id === targetId)))
  && (rows.frames.length === 0 || rows.installation.frameSystemId !== undefined)
  && unique(rows.frames) && new Set(rows.groups.flatMap(row => row.programs).concat(rows.frames.map(row => row.program))).size
    === rows.groups.reduce((count, row) => count + row.programs.length, 0) + rows.frames.length,
'Unique motion groups and channel programs; child groups precede their parent'));
export type SceneMotion = v.InferOutput<typeof SceneMotionSchema>;
/** Admission creates no channel, physics body, prompt or system. */
export function parseSceneMotion(input: unknown): SceneMotion { return v.parse(SceneMotionSchema, input); }
