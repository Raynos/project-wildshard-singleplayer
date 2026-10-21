import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite()), natural = v.pipe(finite, v.minValue(0));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const key = v.pipe(v.string(), v.minLength(1)), recordRow = v.strictObject({ key, flagPrefix: v.exactOptional(key) });
const number = finite;
const posedLaneSchema = v.union([number, text, v.strictObject({ any: v.pipe(v.array(v.strictObject({ field: text, op: v.picklist(['gt', 'lt']), value: number })), v.minLength(1), v.maxLength(8)), yes: number, no: number })]);
const posedChannelSchema = v.tuple([posedLaneSchema, posedLaneSchema, posedLaneSchema, posedLaneSchema]);
const tierFiles = v.strictObject({ geometry: text, atlas: text });

export const PosedLibrarySchema = v.strictObject({ name: text, glow: v.optional(text), atlas: text, attributes: v.tuple([text, text]), channels: v.tuple([posedChannelSchema, posedChannelSchema]),
      assets: v.strictObject({ name: text, channels: v.pipe(v.array(v.strictObject({ name: text, source: text, width: v.picklist([1, 2, 3, 4]) })), v.minLength(1), v.maxLength(16)),
        ranges: v.pipe(v.array(v.strictObject({ kind: number, start: number, count: number, box: v.tuple([number, number, number, number, number, number]) })), v.minLength(1), v.maxLength(32)) }),
      tiers: v.strictObject({ phone: tierFiles, desktop: tierFiles }),
      models: v.pipe(v.array(v.strictObject({ id: text, name: text, pipeline: v.picklist(['code', 'hunyuan']), file: text, kind: number, copies: number,
        box: v.tuple([number, number, number]), pose: v.record(text, number) })), v.minLength(1), v.maxLength(32)),
    });


const borrowedPath = { owner: v.pipe(v.string(), v.minLength(1), v.maxLength(96)), path: v.pipe(v.array(v.union([v.string(), v.number()])), v.minLength(1), v.maxLength(16)) };
const argument = v.union([v.string(), v.number(), v.boolean(), v.null()]);
export const DirectorBindingsSchema = v.strictObject({
  observations: v.pipe(v.record(v.string(), v.union([v.number(), v.strictObject({ ...borrowedPath,
    args: v.exactOptional(v.pipe(v.array(argument), v.maxLength(16))), present: v.exactOptional(v.boolean()), fallback: v.exactOptional(v.number()),
  })])), v.maxEntries(32)),
  actions: v.pipe(v.record(v.string(), v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('call'), ...borrowedPath, args: v.optional(v.pipe(v.array(argument), v.maxLength(16)), []) }),
    v.strictObject({ kind: v.literal('set'), ...borrowedPath, value: argument }),
  ])), v.maxLength(16))), v.maxEntries(64)),
  changes: v.optional(v.pipe(v.array(v.strictObject({ ...borrowedPath, keys: v.pipe(v.array(v.string()), v.maxLength(32)) })), v.maxLength(16)), []),
  source: v.picklist(['matching', 'optional']), initialDt: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 0),
});

export const AdventurePersistenceSchema = v.strictObject({
  bosses: recordRow, elites: recordRow, nonnegative: v.boolean(),
  legacyNamespace: v.picklist(['content', 'instance']), refuseWrites: v.boolean(),
  names: v.exactOptional(key), cosmetics: v.exactOptional(recordRow),
  legacy:v.exactOptional(v.strictObject({names:v.exactOptional(key),cosmetics:v.exactOptional(key),bond:v.exactOptional(key)})),
  bond: v.exactOptional(v.strictObject({ key, flags: v.pipe(v.array(v.strictObject({ flag: key, equals: v.exactOptional(v.string()) })), v.maxLength(16)) })),
  counters: v.exactOptional(v.strictObject({ key, prefix: v.string(), separator: v.string(), maximum: v.pipe(natural, v.integer(), v.maxValue(4096)),
    feats: v.pipe(v.array(v.strictObject({ id: key, count: v.pipe(natural, v.integer(), v.maxValue(4096)),
      event: v.exactOptional(key), kind: v.exactOptional(key), variant: v.exactOptional(key), fact: v.nullable(key) })), v.maxLength(256)) })),
});

const placement = v.strictObject({ feet: v.strictObject({ poi: text, x: finite, z: finite, yaw: finite }),
  npc: text, counter: text, counterAhead: finite, tradeAhead: finite, tradeHeight: finite, system: text });
const shopEffect = v.variant('kind', [
  v.strictObject({ kind: v.literal('wear'), finish: text }),
  v.strictObject({ kind: v.literal('bark'), audio: text, group: text, figure: text }),
  v.strictObject({ kind: v.literal('chime'), at: v.picklist(['counter', 'none']), gain: v.pipe(natural, v.maxValue(8)) }),
  v.strictObject({ kind: v.literal('offer') }), v.strictObject({ kind: v.literal('toast'), text }),
]);
/** Shop cards, payment owners and ordered purchase feedback are inert content. */
export const QuestShopSchema = v.strictObject({ place: text, barter: v.boolean(),
  ammunition: v.exactOptional(v.strictObject({ loadout: text, bolts: text })),
  modal: v.exactOptional(v.strictObject({ restartOnClose: v.boolean(), stow: v.boolean(), resumeSwimming: v.boolean() })),
  after: v.pipe(v.record(text, v.pipe(v.array(shopEffect), v.maxLength(16))), v.maxEntries(64)),
});
export const QuestTraderSchema = v.strictObject({ name: text, reopen: v.boolean(), placement: v.exactOptional(placement),
  view: v.exactOptional(v.strictObject({ pitch: finite, closeDistance: v.pipe(finite, v.minValue(0)) })), shop: v.exactOptional(QuestShopSchema) });
export const PageReturnRowsSchema = v.strictObject({ step: v.string(), water: finite, fixed: v.array(v.string()), program: v.unknown(),
  outOfSight: v.pipe(finite, v.minValue(0)), rules: v.record(v.string(), v.strictObject({
    delay: v.strictObject({ min: v.pipe(finite, v.minValue(0)), max: v.pipe(finite, v.minValue(0)) }), night: v.exactOptional(v.boolean()) })) });

export const ReturnProgramSchema = v.strictObject({ script: v.unknown(), bytes: v.string() });
const operations = ['$ref', '$call', '$new', '$fn', '$set', '$if', '$or', '$coalesce', '$eq', '$not', '$sequence'];
/** Draft-07 wire contract for the trusted assembly language. Constants and
 * operands are bounded JSON values; tag names and row/module shapes are closed.
 * checkedHeadlessAssembly additionally checks depth, references and real exports. */
export const HEADLESS_ASSEMBLY_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', additionalProperties: false,
  required: ['version', 'modules', 'constants', 'prepare', 'install', 'level', 'ports', 'entries'],
  definitions: {
    key: { type: 'string', minLength: 1, maxLength: 256, not: { enum: ['__proto__', 'prototype', 'constructor', 'caller', 'callee', 'arguments'] } },
    value: { anyOf: [{ type: ['null', 'boolean', 'number', 'string'] },
      { type: 'array', maxItems: 4096, items: { $ref: '#/definitions/value' } },
      { type: 'object', maxProperties: 256, propertyNames: { allOf: [{ $ref: '#/definitions/key' }, { pattern: '^[^$]' }] },
        additionalProperties: { $ref: '#/definitions/value' } },
      { type: 'object', minProperties: 1, maxProperties: 1, propertyNames: { enum: [...operations] },
        additionalProperties: { $ref: '#/definitions/value' } }] },
    rows: { type: 'array', maxItems: 256, items: { type: 'object', additionalProperties: false,
      required: ['name', 'value'], properties: { name: { $ref: '#/definitions/key' }, value: { $ref: '#/definitions/value' } } } },
  },
  properties: { version: { const: 1 }, modules: { type: 'object', propertyNames: {
    type: 'string', pattern: '^(?:@wildshard/[a-z]+/|src/(?:shards|game|engine|sdk)/)[A-Za-z0-9_./-]+$',
  }, additionalProperties: { type: 'array', maxItems: 256, uniqueItems: true, items: { $ref: '#/definitions/key' } } },
  constants: { $ref: '#/definitions/value' }, prepare: { $ref: '#/definitions/rows' }, install: { $ref: '#/definitions/rows' },
  level: { $ref: '#/definitions/value' }, ports: { $ref: '#/definitions/value' }, entries: { $ref: '#/definitions/value' } },
};
