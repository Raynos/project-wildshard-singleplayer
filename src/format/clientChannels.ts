import * as v from 'valibot';

const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(127));
const name = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
/** Fixed admission limits for independent, read-only presentation expressions. */
export const CLIENT_CHANNEL_LIMITS = { programs: 512, nodes: 128, reads: 32, channels: 12, totalNodes: 16384, totalChannels: 4096 } as const;
/** Only visual transforms and private visual scalars can be published; there is no state-write channel. */
export const ClientChannelPropertySchema = v.picklist(['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'scaleX', 'scaleY', 'scaleZ', 'value', 'turn', 'visible']);
const node = v.variant('op', [
  v.strictObject({ op: v.literal('constant'), value: v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12)) }),
  v.strictObject({ op: v.literal('clock'), value: v.picklist(['time', 'delta']) }),
  v.strictObject({ op: v.literal('read'), index: v.pipe(index, v.maxValue(31)) }),
  v.strictObject({ op: v.picklist(['neg', 'sin', 'cos', 'sqrt', 'abs']), a: index }),
  v.strictObject({ op: v.picklist(['add', 'sub', 'mul', 'div', 'mod', 'min', 'max', 'atan2', 'hypot', 'gt']), a: index, b: index }),
  v.strictObject({ op: v.literal('select'), test: index, yes: index, no: index }),
]);
/** A straight-line DAG: every reference names an earlier node, never a loop, call or recursive expression. */
export const ClientChannelProgramSchema = v.pipe(v.strictObject({
  id: name,
  reads: v.pipe(v.array(name), v.maxLength(CLIENT_CHANNEL_LIMITS.reads)),
  nodes: v.pipe(v.array(node), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.nodes)),
  channels: v.pipe(v.array(v.strictObject({ property: ClientChannelPropertySchema, value: index })), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.channels)),
}), v.check(row => new Set(row.reads).size === row.reads.length
  && new Set(row.channels.map(channel => channel.property)).size === row.channels.length
  && row.channels.every(channel => channel.value < row.nodes.length)
  && row.nodes.every((value, at) => {
    if (value.op === 'read') return value.index < row.reads.length;
    if (value.op === 'select') return value.test < at && value.yes < at && value.no < at;
    return (!('a' in value) || value.a < at) && (!('b' in value) || value.b < at);
  }), 'unique visual channels and reads; backward-only node references'));
/** Admitted visual programs; aggregate caps apply before any expression storage is allocated. */
export const ClientChannelsSchema = v.pipe(v.array(ClientChannelProgramSchema), v.maxLength(CLIENT_CHANNEL_LIMITS.programs),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length
    && rows.reduce((sum, row) => sum + row.nodes.length, 0) <= CLIENT_CHANNEL_LIMITS.totalNodes
    && rows.reduce((sum, row) => sum + row.channels.length, 0) <= CLIENT_CHANNEL_LIMITS.totalChannels, 'unique bounded client channel programs'));
/** Data-only client programme, with selected copied observations and visual outputs. */
export type ClientChannelProgram = v.InferOutput<typeof ClientChannelProgramSchema>;
/** Visual property identity, never an authoritative player or shared field. */
export type ClientChannelProperty = v.InferOutput<typeof ClientChannelPropertySchema>;
/** Strictly parse detached author data before the trusted view owner binds it. */
export function parseClientChannels(input: unknown): ClientChannelProgram[] { return v.parse(ClientChannelsSchema, input); }
