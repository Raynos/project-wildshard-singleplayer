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
  v.pipe(v.strictObject({ op: v.literal('sample'), a: index, interpolation: v.picklist(['linear', 'smoothstep']),
    keys: v.pipe(v.array(v.tuple([v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12)),
      v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12))])), v.minLength(2), v.maxLength(32)),
  }), v.check(row => row.keys.every((key, at) => at === 0 || key[0] > (row.keys[at - 1]?.[0] ?? Infinity)), 'strictly ordered keyframe samples')),
  v.strictObject({ op: v.literal('select'), test: index, yes: index, no: index }),
]);
const initial = v.variant('op', [
  v.strictObject({ op: v.literal('constant'), value: v.pipe(v.number(), v.finite(), v.minValue(-1e12), v.maxValue(1e12)) }),
  v.strictObject({ op: v.literal('read'), index: v.pipe(index, v.maxValue(31)) }),
]);
const coefficient = v.pipe(v.number(), v.finite(), v.minValue(-1000), v.maxValue(1000));
/** A bounded, private tube deformation kernel; scalar inputs name already computed DAG nodes. */
const geometry = v.pipe(v.strictObject({ kind: v.literal('tubeCurve'), target: name,
  segments: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1024)),
  radial: v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(64)),
  from: v.tuple([index, index, index]), to: v.tuple([index, index, index]), extent: index, wave: index,
  bend: v.tuple([coefficient, coefficient]), ripple: v.tuple([coefficient, coefficient, coefficient]),
  drop: v.tuple([coefficient, coefficient]),
  radius: v.tuple([v.pipe(coefficient, v.minValue(0)), v.pipe(coefficient, v.minValue(0), v.maxValue(8)),
    v.pipe(coefficient, v.minValue(0)), v.pipe(coefficient, v.minValue(0), v.maxValue(1)), v.pipe(coefficient, v.minValue(0))]),
}), v.check(row => (row.segments + 1) * row.radial <= 4096, 'bounded tube vertices'));
const program = v.strictObject({
  id: name,
  geometry: v.exactOptional(geometry),
  prompt: v.exactOptional(prompt),
  bindings: v.exactOptional(v.pipe(v.array(binding), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.channels))),
  mover: v.exactOptional(name),
  reads: v.pipe(v.array(name), v.maxLength(CLIENT_CHANNEL_LIMITS.reads)),
  locals: v.exactOptional(v.pipe(v.array(v.strictObject({ initial, next: index })), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.locals))),
  nodes: v.pipe(v.array(node), v.minLength(1), v.maxLength(CLIENT_CHANNEL_LIMITS.nodes)),
  channels: v.pipe(v.array(v.strictObject({ property: ClientChannelPropertySchema, value: index })), v.minLength(0), v.maxLength(CLIENT_CHANNEL_LIMITS.channels)),
});
/** Data-only client programme, with selected copied observations and visual outputs. */
export type ClientChannelProgram = v.InferOutput<typeof program>;
/** A straight-line DAG: every reference names an earlier node, never a loop, call or recursive expression. */
export const ClientChannelProgramSchema: v.GenericSchema<v.InferInput<typeof program>, ClientChannelProgram> = v.pipe(program, v.check(row => (row.channels.length > 0 || row.geometry !== undefined)
  && (row.geometry === undefined || [...row.geometry.from, ...row.geometry.to, row.geometry.extent, row.geometry.wave].every(value => value < row.nodes.length))
  && new Set(row.reads).size === row.reads.length
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
export const ClientChannelsSchema: v.GenericSchema<ClientChannelProgram[], ClientChannelProgram[]> = v.pipe(v.array(ClientChannelProgramSchema), v.maxLength(CLIENT_CHANNEL_LIMITS.programs),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length
    && new Set(rows.flatMap(row => row.prompt === undefined ? [] : [row.prompt.id])).size === rows.filter(row => row.prompt !== undefined).length
    && rows.filter(row => row.prompt !== undefined).length <= CLIENT_CHANNEL_LIMITS.prompts
    && rows.reduce((sum, row) => sum + row.nodes.length, 0) <= CLIENT_CHANNEL_LIMITS.totalNodes
    && rows.reduce((sum, row) => sum + (row.locals?.length ?? 0), 0) <= CLIENT_CHANNEL_LIMITS.totalLocals
    && rows.reduce((sum, row) => sum + row.channels.length, 0) <= CLIENT_CHANNEL_LIMITS.totalChannels, 'unique bounded client channel programs'));
/** Visual property identity, never an authoritative player or shared field. */
export type ClientChannelProperty = v.InferOutput<typeof ClientChannelPropertySchema>;
/** Strictly parse detached author data before the trusted view owner binds it. */
export function parseClientChannels(input: unknown): ClientChannelProgram[] { return v.parse(ClientChannelsSchema, input); }

/** Data-only private scene construction: geometry, textures and graph materials stay in trusted owned ports. */
const sceneCoordinate = v.pipe(v.number(), v.finite(), v.minValue(-1e5), v.maxValue(1e5));
const sceneVector = v.tuple([sceneCoordinate, sceneCoordinate, sceneCoordinate]);
const sceneChildren = v.pipe(v.array(name), v.maxLength(128));
const scenePose = {
  children: v.optional(sceneChildren, []), position: v.exactOptional(sceneVector), rotation: v.exactOptional(sceneVector), scale: v.exactOptional(sceneVector),
  order: v.exactOptional(v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'])),
  visible: v.exactOptional(v.boolean()), castShadow: v.exactOptional(v.boolean()), receiveShadow: v.exactOptional(v.boolean()),
  frustumCulled: v.exactOptional(v.boolean()), renderOrder: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(-1000), v.maxValue(1000))),
  when: v.exactOptional(v.strictObject({ object: name, present: v.boolean() })),
  whenTexture: v.exactOptional(v.strictObject({ texture: name, present: v.boolean() })),
  visibleWhen: v.exactOptional(v.strictObject({ object: name, present: v.boolean() })),
};
const sceneNode = v.variant('kind', [
  v.strictObject({ kind: v.literal('group'), id: name, ...scenePose }),
  v.strictObject({ kind: v.literal('mesh'), id: name, geometry: name, material: name, missing: v.picklist(['empty', 'group', 'omit']), ...scenePose }),
  v.strictObject({ kind: v.literal('object'), id: name, source: name, missing: v.picklist(['omit', 'refuse']), ...scenePose }),
  v.strictObject({ kind: v.literal('anchor'), id: name, source: name, path: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(127))), v.minLength(1), v.maxLength(8)), missing: v.picklist(['omit', 'refuse']), children: v.optional(sceneChildren, []) }),
]);
const sceneRgb = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff));
const unitScalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1));
const sceneMaterial = v.variant('kind', [
  v.strictObject({ kind: v.literal('port'), id: name, source: name }),
  v.strictObject({ kind: v.literal('standard'), id: name,
    properties: v.strictObject({ color: v.exactOptional(sceneRgb), emissive: v.exactOptional(sceneRgb), roughness: v.exactOptional(unitScalar), metalness: v.exactOptional(unitScalar),
      vertexColors: v.exactOptional(v.boolean()), flatShading: v.exactOptional(v.boolean()), fog: v.exactOptional(v.boolean()), transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(unitScalar),
      depthWrite: v.exactOptional(v.boolean()), side: v.exactOptional(v.picklist([0, 1, 2])), normalScale: v.exactOptional(v.tuple([sceneCoordinate, sceneCoordinate])) }),
    maps: v.exactOptional(v.strictObject({ map: v.exactOptional(name), normalMap: v.exactOptional(name), roughnessMap: v.exactOptional(name) })),
    decorate: v.exactOptional(name),
    userData: v.exactOptional(v.pipe(v.record(name, v.boolean()), v.check(value => Object.keys(value).length <= 16))),
  }),
]);
const privateTexture = v.variant('kind', [
  v.strictObject({kind:v.literal('port'),id:name,source:name}),
  v.strictObject({kind:v.literal('rgba'),id:name,source:name,
    width:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(2048)), height:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(2048)),
    offset:v.pipe(v.number(),v.integer(),v.minValue(0),v.maxValue(67108864)), bytes:v.pipe(v.number(),v.integer(),v.minValue(4),v.maxValue(67108864)),
    colorSpace:v.picklist(['','srgb']), repeat:v.union([v.tuple([sceneCoordinate,sceneCoordinate]),v.strictObject({port:name})]),
    wrapS:v.picklist([1000,1001,1002]),wrapT:v.picklist([1000,1001,1002]),magFilter:v.picklist([1003,1006]),minFilter:v.picklist([1003,1004,1005,1006,1007,1008]),
    mipmaps:v.boolean(),anisotropy:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(16)),
  }),
]);
const privateScene = v.strictObject({ version: v.literal(1), root: name,
  nodes: v.pipe(v.array(sceneNode), v.minLength(1), v.maxLength(128)), materials: v.pipe(v.array(sceneMaterial), v.maxLength(32)), textures:v.optional(v.pipe(v.array(privateTexture),v.maxLength(16)),[]) });
/** Exact ordered private visual hierarchy, independent of state, collision and the world registry. */
export type PrivateScene = v.InferOutput<typeof privateScene>;
/** Refuse duplicate identities, crossed references, cycles and unreachable parts before allocating a scene. */
export const PrivateSceneSchema = v.pipe(privateScene, v.check(row => {
  const nodes = new Map(row.nodes.map(entry => [entry.id, entry])), materials = new Set(row.materials.map(material => material.id));
  if (nodes.size !== row.nodes.length || materials.size !== row.materials.length || !nodes.has(row.root) || !['group','mesh'].includes(nodes.get(row.root)?.kind ?? '')) return false;
  const textures = new Set(row.textures.map(texture => texture.id));
  if (textures.size !== row.textures.length || row.textures.some(texture => texture.kind === 'rgba' && texture.offset + texture.width * texture.height * 4 > texture.bytes)) return false;
  const parents = new Map<string, string>();
  for (const entry of row.nodes) {
    if (entry.kind === 'mesh' && !materials.has(entry.material)) return false;
    if ('whenTexture' in entry && !textures.has(entry.whenTexture.texture)) return false;
    if (entry.kind === 'anchor') {
      if (nodes.get(entry.source)?.kind !== 'object' || parents.has(entry.id)) return false;
      parents.set(entry.id, entry.source);
    }
    for (const child of entry.children) {
      if (!nodes.has(child) || child === row.root || child === entry.id || parents.has(child) || nodes.get(child)?.kind === 'anchor') return false;
      parents.set(child, entry.id);
    }
  }
  for (const entry of row.nodes) {
    let current = entry.id;
    const visited = new Set<string>();
    while (current !== row.root) {
      if (visited.has(current)) return false;
      visited.add(current);
      const parent = parents.get(current); if (parent === undefined) return false; current = parent;
    }
  }
  return true;
}, 'unique bounded connected private scene; ordered children and owned material references'));
/** Admit authored private scene rows; functions and unknown properties cannot cross this boundary. */
export function parsePrivateScene(input: unknown): PrivateScene { return v.parse(PrivateSceneSchema, input); }
