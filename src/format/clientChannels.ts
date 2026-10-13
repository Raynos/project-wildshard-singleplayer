import * as v from 'valibot';

const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(127));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
/** Fixed admission limits for independent, read-only presentation expressions. */
export const CLIENT_CHANNEL_LIMITS = { programs: 512, nodes: 128, reads: 32, channels: 12, locals: 8, totalLocals: 1024, prompts: 64, totalNodes: 16384, totalChannels: 4096 } as const;
/** Only visual transforms and private visual scalars can be published; there is no state-write channel. */
export const ClientChannelPropertySchema = v.picklist(['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'scaleX', 'scaleY', 'scaleZ', 'value', 'turn', 'visible']);
/** Bound outputs name only private scene transforms or visibility, never player/shared scalar fields. */
export const ClientChannelTransformSchema = v.picklist(['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'scaleX', 'scaleY', 'scaleZ', 'visible']);
const binding = v.strictObject({ property: ClientChannelTransformSchema, target: name,
  order: v.exactOptional(v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'])) });
const prompt = v.strictObject({
  id: name, label: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  radius: v.pipe(v.number(), v.finite(), v.minValue(0.1), v.maxValue(8)),
  at: v.tuple([v.pipe(v.number(), v.finite(), v.minValue(-1e5), v.maxValue(1e5)), v.pipe(v.number(), v.finite(), v.minValue(-1e5), v.maxValue(1e5)), v.pipe(v.number(), v.finite(), v.minValue(-1e5), v.maxValue(1e5))]),
  action: v.variant('kind', [
    v.strictObject({ kind: v.literal('named'), name }),
    v.strictObject({ kind: v.literal('socketLift'), edge: v.picklist(['north', 'east', 'south', 'west']), action: v.picklist([1, 2, 3]) }),
  ]),
});
const node = v.variant('op', [
  v.strictObject({ op: v.literal('constant'), value: v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12)) }),
  v.strictObject({ op: v.literal('clock'), value: v.picklist(['time', 'delta']) }),
  v.strictObject({ op: v.literal('read'), index: v.pipe(index, v.maxValue(31)) }),
  v.strictObject({ op: v.literal('local'), index: v.pipe(index, v.maxValue(CLIENT_CHANNEL_LIMITS.locals - 1)) }),
  v.strictObject({ op: v.picklist(['neg', 'sin', 'cos', 'sqrt', 'abs']), a: index }),
  v.strictObject({ op: v.picklist(['add', 'sub', 'mul', 'div', 'mod', 'min', 'max', 'atan2', 'hypot', 'gt']), a: index, b: index }),
  v.strictObject({ op: v.literal('hypot3'), a: index, b: index, c: index }),
  v.strictObject({ op: v.literal('select'), test: index, yes: index, no: index }),
]);
const initial = v.variant('op', [
  v.strictObject({ op: v.literal('constant'), value: v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12)) }),
  v.strictObject({ op: v.literal('read'), index: v.pipe(index, v.maxValue(31)) }),
]);
/** A straight-line DAG: every reference names an earlier node, never a loop, call or recursive expression. */
export const ClientChannelProgramSchema = v.pipe(v.strictObject({
  id: name,
  prompt: v.exactOptional(prompt),
  bindings: v.exactOptional(v.pipe(v.array(binding), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.channels))),
  mover: v.exactOptional(name),
  reads: v.pipe(v.array(name), v.maxLength(CLIENT_CHANNEL_LIMITS.reads)),
  locals: v.exactOptional(v.pipe(v.array(v.strictObject({ initial, next: index })), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.locals))),
  nodes: v.pipe(v.array(node), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.nodes)),
  channels: v.pipe(v.array(v.strictObject({ property: ClientChannelPropertySchema, value: index })), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.channels)),
}), v.check(row => new Set(row.reads).size === row.reads.length
  && new Set(row.channels.map(channel => channel.property)).size === row.channels.length
  && new Set((row.bindings ?? []).map(item => `${item.target}:${item.property}`)).size === (row.bindings?.length ?? 0)
  && (row.bindings ?? []).every(item => row.channels.some(channel => channel.property === item.property) && (item.order === undefined || ['yaw', 'pitch', 'roll'].includes(item.property)))
  && (row.mover === undefined || row.locals === undefined && row.nodes.every(value => value.op !== 'clock') && row.reads.every(read => /^(?:position\.[xyz]|euler\.[xyz]|enabled|field\.[1-6])$/u.test(read)))
  && (row.prompt === undefined || ['x', 'y', 'z'].every(property => row.channels.some(channel => channel.property === property)))
  && row.channels.every(channel => channel.value < row.nodes.length)
  && (row.locals ?? []).every(slot => slot.next < row.nodes.length && (slot.initial.op !== 'read' || slot.initial.index < row.reads.length))
  && row.nodes.every((value, at) => {
    if (value.op === 'local') return value.index < (row.locals?.length ?? 0);
    if (value.op === 'read') return value.index < row.reads.length;
    if (value.op === 'select') return value.test < at && value.yes < at && value.no < at;
    return (!('c' in value) || value.c < at) && (!('a' in value) || value.a < at) && (!('b' in value) || value.b < at);
  }), 'unique visual channels and reads; backward-only nodes and bounded private slots'));
/** Admitted visual programs; aggregate caps apply before any expression storage is allocated. */
export const ClientChannelsSchema = v.pipe(v.array(ClientChannelProgramSchema), v.maxLength(CLIENT_CHANNEL_LIMITS.programs),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length
    && new Set(rows.flatMap(row => row.prompt === undefined ? [] : [row.prompt.id])).size === rows.filter(row => row.prompt !== undefined).length
    && rows.filter(row => row.prompt !== undefined).length <= CLIENT_CHANNEL_LIMITS.prompts
    && rows.reduce((sum, row) => sum + row.nodes.length, 0) <= CLIENT_CHANNEL_LIMITS.totalNodes
    && rows.reduce((sum, row) => sum + (row.locals?.length ?? 0), 0) <= CLIENT_CHANNEL_LIMITS.totalLocals
    && rows.reduce((sum, row) => sum + row.channels.length, 0) <= CLIENT_CHANNEL_LIMITS.totalChannels, 'unique bounded client channel programs'));
/** Data-only client programme, with selected copied observations and visual outputs. */
export type ClientChannelProgram = v.InferOutput<typeof ClientChannelProgramSchema>;
/** Visual property identity, never an authoritative player or shared field. */
export type ClientChannelProperty = v.InferOutput<typeof ClientChannelPropertySchema>;
/** Strictly parse detached author data before the trusted view owner binds it. */
export function parseClientChannels(input: unknown): ClientChannelProgram[] { return v.parse(ClientChannelsSchema, input); }
