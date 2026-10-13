import { diverPreset } from '@wildshard/format/flyers';
import { grazerPreset } from '@wildshard/format/grazers';
import { ShardFiniteSchema as finite, ShardReferenceSchema as ref, ShardNamesSchema as names, IdentitySchema, RequiresSchema, BudgetsSchema, SimSchema, AuthorCapsSchema, ServerBudgetSchema, FilesSchema, TilesSchema, LibrarySchema, CriticalSchema, FarSchema, SpawnSchema } from '@wildshard/format/shardSections';
import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF, CONTENT_CAPS } from '@wildshard/format/contentBounds';
import { isJsonData } from '@wildshard/format/json';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { preflightShardfile } from '@wildshard/format/preflight';
import { preflightAssetGraph } from '@wildshard/format/product';
import { SHARDFILE_VERSION } from '@wildshard/format/version';
import { UiSchema, uiRules } from '@wildshard/format/ui';
import { scriptBindingRules } from '@wildshard/format/scripts';
import { RowsSchema } from '@wildshard/format/rows';
import { DirectorsSchema } from '@wildshard/format/directorStages';
import { NavigationSchema, navigationRules } from '@wildshard/format/navigation';
import { TerrainSchema } from '@wildshard/format/terrain';
import { NearPlaceholderSchema, nearPlaceholderCost, nearPlaceholderRoots } from '@wildshard/format/nearPlaceholder';
import { MeshCollisionSchema, meshCollisionRules } from '@wildshard/format/meshCollision';
import { NativeGroundSchema, nativeGroundRules } from '@wildshard/format/nativeGround';
import { WaterSchema } from '@wildshard/format/water';
import { CreaturesSchema } from '@wildshard/format/creatures';
import { FlockSchema } from '@wildshard/format/crowds';
import { groupBrainRules } from '@wildshard/format/groupBrains';
import { EncountersSchema, encounterRules } from '@wildshard/format/encounters';
import { QuestDataSchema } from '@wildshard/format/quests';
import { AudioDataSchema } from '@wildshard/format/audio';
import { LedgerRulesSchema } from '@wildshard/format/ledger';
import { HooksSchema, hookRules } from '@wildshard/format/hooks';
import { PlumbingSchema } from '@wildshard/format/plumbing';
import { PropsSchema, validatePropsReferences } from '@wildshard/format/props';
import { TargetsSchema, targetRules } from '@wildshard/format/targets';
import { ItemsSchema, itemRules } from '@wildshard/format/items';
import { TraversalSchema } from '@wildshard/format/traversal';
import { RuntimeSchema } from '@wildshard/format/runtime';
import { ClientScriptsSchema, clientScriptRules } from '@wildshard/format/clientScripts';
import { ClientChannelsSchema } from '@wildshard/format/clientChannels';
import { EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { EntrywaysSchema, entrywayRules } from '@wildshard/format/entryways';
import { ModesSchema } from '@wildshard/format/modes';
import { MoversSchema, parseMovers } from '@wildshard/format/movers';
import { socketLiftEntries, socketLiftRules } from '@wildshard/format/socketLiftAssets';
import { portalLinkEntries, portalLinkRules } from '@wildshard/format/portalLinkAssets';
import { StateSchema, stateRules } from '@wildshard/format/state';
import { assertCommonsCosts } from '@wildshard/format/commonsCosts';
import { AccentSchema } from '@wildshard/format/accent';
import { MapSchema, PresentationSchema } from '@wildshard/format/presentation';
import { MigrationsSchema, migrationRules } from '@wildshard/format/migrations';
import { skinLookRules } from '@wildshard/format/skinAssets';
import { MaterialsSchema, FamilyLooksSchema, MaterialCurvesSchema, TextureSamplersSchema, materialExists, materialTextureRefs, materialGraphRules, materialCurveRules, textureSamplerRules } from '@wildshard/format/materials';
import { PostStackSchema, postStackRules } from '@wildshard/format/postStack';

const channel = v.pipe(finite, v.minValue(0), v.maxValue(1));
const colour = v.tuple([channel, channel, channel]);
const unsigned = v.pipe(finite, v.minValue(0));
const key = v.strictObject({ time: channel, sky: v.strictObject({ zenith: colour, horizon: colour }), fog: v.strictObject({ colour, density: unsigned, near: v.optional(unsigned), far: v.optional(unsigned) }), sun: v.strictObject({ colour, intensity: unsigned }), ambient: v.strictObject({ sky: colour, ground: colour, intensity: unsigned }) });
const day = v.strictObject({ minutes: v.pipe(finite, v.minValue(1), v.maxValue(1440)), start: channel, maxElevation: v.pipe(finite, v.minValue(0), v.maxValue(90)), azimuth: v.pipe(finite, v.minValue(-180), v.maxValue(180)) });
/** A colour LUT file's exact wire size: 33³ RGBA8 (the engine's render/lut format). */
export const LOOK_LUT_BYTES = 33 ** 3 * 4;
const rawSchema = v.strictObject({
  version: v.literal(SHARDFILE_VERSION),
  accent: AccentSchema,
  identity: IdentitySchema,
  presentation: v.exactOptional(PresentationSchema),
  map: v.exactOptional(MapSchema),
  requires: RequiresSchema,
  budgets: BudgetsSchema,
  look: v.strictObject({ families: names, materials: v.optional(MaterialsSchema, {}), familyLooks: v.optional(FamilyLooksSchema, {}), curves: v.exactOptional(MaterialCurvesSchema), samplers: v.exactOptional(TextureSamplersSchema), post: v.exactOptional(PostStackSchema), grade: v.strictObject({ exposure: finite, saturation: v.pipe(finite, v.minValue(0)), contrast: v.pipe(finite, v.minValue(0)), lut: v.nullable(ref) }), clock: v.literal('engine'), day: v.optional(day), dayOverride: v.nullable(channel), keys: v.pipe(v.array(key), v.maxLength(64)) }),
  sim: SimSchema,
  state: StateSchema,
  migrations: v.optional(MigrationsSchema, []),
  authorCaps: AuthorCapsSchema,
  serverBudget: ServerBudgetSchema,
  edge: EdgeProfilesSchema,
  entryways: EntrywaysSchema,
  movers: v.optional(MoversSchema, []),
  modes: v.exactOptional(ModesSchema),
  files: FilesSchema, tiles: TilesSchema, library: LibrarySchema, critical: CriticalSchema,
  far: FarSchema,
  near: v.exactOptional(NearPlaceholderSchema),
  ui: v.optional(UiSchema, []),
  rows: v.optional(RowsSchema, { strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [] }),
  terrain: v.optional(v.nullable(TerrainSchema), null),
  meshCollision: v.optional(v.nullable(MeshCollisionSchema), null),
  navigation: v.optional(v.nullable(NavigationSchema), null),
  nativeGround: v.optional(v.nullable(NativeGroundSchema), null),
  water: v.optional(v.pipe(WaterSchema, v.maxLength(limits.waterBodies)), []),
  creatures: v.optional(CreaturesSchema, { brains: [], groups: [], spawns: [] }),
  crowds: v.optional(v.pipe(v.array(FlockSchema), v.maxLength(64)), []),
  encounters: v.optional(EncountersSchema, []),
  directors: v.exactOptional(DirectorsSchema),
  quests: v.optional(QuestDataSchema, { flags: [], quests: [], triggers: [], dialogue: [] }),
  audio: v.optional(AudioDataSchema, { cues: [], ambience: null, score: 'silent' }),
  ledger: v.optional(LedgerRulesSchema, []),
  hooks: v.optional(HooksSchema, { conditions: [], scenes: [] }),
  plumbing: v.optional(v.nullable(PlumbingSchema), null),
  items: v.optional(ItemsSchema, { version: 1, rows: [], contexts: [], loadout: { primary: null, secondary: null, tools: [] } }),
  props: v.optional(v.nullable(PropsSchema), null),
  targets: v.optional(TargetsSchema, { panels: [], interactions: [] }),
  traversal: v.optional(TraversalSchema, { hoverCap: 14 }),
  clientScripts: v.optional(ClientScriptsSchema, { divisor: 2, bindings: [] }),
  clientChannels: v.exactOptional(ClientChannelsSchema),
  // RuntimeSchema owns strict binds/spawns and their exact pairing; bound state also passes ownership and ordinary field admission.
  runtime: v.optional(v.nullable(RuntimeSchema), null),
  spawn: v.optional(SpawnSchema, { x: 0, y: 2, z: 0, yaw: 0 }),
});
/** A serialisable shardfile v0, independent of renderer and placement. */
export type Shardfile = v.InferOutput<typeof rawSchema>;

/** Semantic format violations, including reference integrity and the acyclic dependency graph. */
export function shardfileRules(s: Shardfile): string[] {
  const errors: string[] = [];
  errors.push(...entrywayRules(s));
  errors.push(...socketLiftRules(socketLiftEntries(s.entryways), s.movers, s));
  errors.push(...portalLinkRules(portalLinkEntries(s.entryways), s));
  try { parseMovers(s.movers); } catch { errors.push('declared mover identities and primitives'); }
  if ((s.clientChannels ?? []).some(row => row.mover !== undefined && !s.movers.some(mover => mover.id === row.mover))) errors.push('client channel mover source must be declared');
  for (const row of s.clientChannels ?? []) {
    const action = row.prompt?.action;
    if (action?.kind === 'socketLift') {
      const entry = s.entryways.find(candidate => candidate.edge === action.edge);
      if (entry?.kind !== 'socketLift' || entry.lift?.mover !== row.mover) errors.push('client prompt requires its admitted socket lift');
    }
  }
  for (const row of s.movers) if (row.trigger?.kind === 'shared') {
    const trigger = row.trigger;
    const field = s.state.shared.find(candidate => candidate.id === trigger.field);
    if (field === undefined || field.type === 'string' || typeof field.default !== typeof row.trigger.equals) errors.push('mover trigger requires an admitted numeric or boolean shared field');
  }
  if (s.movers.some(row => row.kind === 'chain')) errors.push('compiled mover chains require native joint restore support');
  if (s.movers.some(row => !s.sim.scripts.includes(row.module) || !s.critical.includes(row.module) || s.files.find(asset => asset.hash === row.module)?.kind !== 'wasm')) errors.push('mover modules are admitted critical sim scripts');
  const liftIds = new Set(socketLiftEntries(s.entryways).flatMap(entry => [entry.lift.mover, entry.lift.gate]));
  const liftModules = new Set(s.movers.filter(row => liftIds.has(row.id)).map(row => row.module));
  if (s.movers.some(row => !liftIds.has(row.id) && liftModules.has(row.module)) || s.sim.bindings.some(row => liftModules.has(row.module))
    || s.creatures.brains.some(row => row.kind === 'script' && liftModules.has(row.module))) errors.push('lift modules are dedicated transient movers');
  errors.push(...migrationRules(s.migrations, s.state.version));
  const commons = new Set(s.requires.commons), commonsWire = Object.keys(s.requires.commonsWire);
  try { assertCommonsCosts(s.requires.commons, s.requires.commonsCosts); } catch { errors.push('commons cost declarations match the exact commons hash keyset'); }
  if (commons.size !== s.requires.commons.length) errors.push('unique commons hashes');
  if (commonsWire.length !== commons.size || commonsWire.some((id) => !commons.has(id))) errors.push('commons wire declarations match the exact commons hash keyset');
  const files = new Map(s.files.map((f) => [f.hash, f]));
  if (files.size !== s.files.length) errors.push('unique file hashes');
  const refs = [...s.files.flatMap((f) => f.dependencies), ...s.tiles.flatMap((t) => t.files), ...s.library, ...s.critical, ...s.sim.scripts, ...(s.far?.files ?? []), ...nearPlaceholderRoots(s.near), ...(s.look.grade.lut === null ? [] : [s.look.grade.lut])];
  for (const r of refs) if (r.startsWith('commons:') ? !s.requires.commons.includes(r.slice(8)) : !files.has(r)) errors.push(`undeclared reference ${r}`);
  const visited = new Set<string>(), active = new Set<string>();
  for (const root of files.keys()) {
    const pending = [{ id: root, leaving: false }];
    while (pending.length > 0) {
      const frame = pending.pop(); if (frame === undefined) continue;
      if (frame.leaving) { active.delete(frame.id); continue; }
      if (active.has(frame.id)) { errors.push('acyclic dependencies'); continue; }
      if (visited.has(frame.id)) continue;
      visited.add(frame.id); active.add(frame.id); pending.push({ id: frame.id, leaving: true });
      for (const id of files.get(frame.id)?.dependencies ?? []) if (!id.startsWith('commons:')) pending.push({ id, leaving: false });
    }
  }
  errors.push(...stateRules(s.state));
  if ((s.clientChannels?.length ?? 0) > 0 && s.runtime?.binds?.includes('clientChannels') !== true) errors.push('native visual channels require runtime.binds clientChannels');
  if (s.runtime?.binds?.includes('state') === true && (s.state.player.length > 0 || s.state.shared.some((field) => field.privacy !== 'host'))) errors.push('runtime-bound state supports only host-owned shared fields');
  errors.push(...materialGraphRules(s), ...materialCurveRules(s), ...textureSamplerRules(s.look), ...postStackRules(s));
  const materialRefs = materialTextureRefs(s.look.materials), libraryClosure = new Set<string>();
  const libraryPending = [...s.library];
  while (libraryPending.length > 0) {
    const id = libraryPending.pop(); if (id === undefined || libraryClosure.has(id)) continue;
    libraryClosure.add(id); libraryPending.push(...files.get(id)?.dependencies ?? []);
  }
  if (materialRefs.some((id) => !/^(?:commons:)?[a-f0-9]{64}$/u.test(id) || !libraryClosure.has(id) || (id.startsWith('commons:') ? !s.requires.commons.includes(id.slice(8)) : files.get(id)?.kind !== 'ktx2'))) errors.push('admitted material texture library references');
  if (s.items.rows.some(row => row.view.asset !== undefined && (!libraryClosure.has(row.view.asset) ||
    (row.view.asset.startsWith('commons:') ? !commons.has(row.view.asset.slice(8)) : files.get(row.view.asset)?.kind !== 'glb')))) errors.push('admitted item model library references');
  const lut = s.look.grade.lut === null || s.look.grade.lut.startsWith('commons:') ? null : files.get(s.look.grade.lut);
  if (lut !== undefined && lut !== null && (lut.kind !== 'binary' || lut.compressed !== LOOK_LUT_BYTES)) errors.push('look LUT is a 33³ RGBA8 binary file');
  if (s.look.keys.some((k, i) => i > 0 && k.time <= (s.look.keys[i - 1]?.time ?? Infinity))) errors.push('ordered day keys');
  const linearFog = s.look.keys[0]?.fog.near !== undefined;
  for (const { fog } of s.look.keys) if ((fog.near === undefined) !== (fog.far === undefined) || (fog.near !== undefined && fog.far !== undefined && (fog.near >= fog.far || fog.density !== 0)) || (fog.near !== undefined) !== linearFog) errors.push('consistent ordered linear fog bounds with zero density');
  for (const e of Object.values(s.edge)) if (e.heights.length !== e.colours.length) errors.push('edge sample lengths');
  const seen = new Set<string>();
  for (const t of s.tiles) {
    const id = `${t.lod}/${t.x}/${t.z}`, cap = t.lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
    if (seen.has(id)) errors.push('unique tile addresses'); seen.add(id);
    const n = 500 / cap.size;
    if (t.x >= n || t.z >= n || t.bounds.min[0] !== -250 + t.x * cap.size || t.bounds.max[0] !== -250 + (t.x + 1) * cap.size || t.bounds.min[2] !== -250 + t.z * cap.size || t.bounds.max[2] !== -250 + (t.z + 1) * cap.size) errors.push('tile grid bounds');
    if (t.drawBounds !== undefined) {
      const b = t.drawBounds, margin = s.props?.overhang;
      if (margin === undefined || b.min[0] < -250 - margin || b.max[0] > 250 + margin || b.min[2] < -250 - margin || b.max[2] > 250 + margin || b.min.some((coordinate, i) => coordinate > (t.bounds.min[i] ?? -Infinity)) || b.max.some((coordinate, i) => coordinate < (t.bounds.max[i] ?? Infinity))) errors.push('declared prop draw bounds');
    }
    if (t.lod === 1 && t.files.some((r) => s.library.includes(r))) errors.push('self-contained coarse tile');
  }
  for (const f of s.files) if (f.critical !== s.critical.includes(f.hash)) errors.push('critical flags match roots');
  if (s.near !== undefined) {
    try { nearPlaceholderCost(s.near, s); } catch { errors.push('admitted bounded visual near-placeholder closure'); }
  }
  errors.push(...uiRules(s.ui, s.state));
  errors.push(...hookRules(s.hooks, s.state));
  errors.push(...meshCollisionRules(s));
  errors.push(...nativeGroundRules(s), ...navigationRules(s));
  errors.push(...targetRules(s.targets, s, { panels: s.props?.panels ?? [], colliders: [...s.props?.colliders ?? [], ...s.meshCollision?.panels ?? []] }));
  errors.push(...itemRules(s.items, s.sim.scripts));
  if ((s.items.runtimeContexts?.length ?? 0) > 0 && s.runtime?.binds?.includes('items') !== true) errors.push('runtime input context references require runtime.binds items');
  if (s.items.rows.some((row) => row.kind === 'tool' && row.action === null) && s.runtime?.binds?.includes('items') !== true) errors.push('native tools require runtime.binds items');
  if (s.modes !== undefined && (s.modes.traverse.some(row => row.kind !== 'ladder') || (s.modes.ride?.length ?? 0) > 0 || (s.modes.grapple?.length ?? 0) > 0) && s.runtime?.binds?.includes('modes') !== true) errors.push('traverse modes require runtime.binds modes until the data client owns their player phase');
  if (s.runtime !== null && s.modes?.traverse.some(row => row.kind === 'ladder')) errors.push('ladder traversal requires the data-only player owner');
  errors.push(...skinLookRules(s));
  errors.push(...clientScriptRules(s));
  if (s.props !== null) {
    try { validatePropsReferences(s.props, s); } catch { errors.push('declared prop references'); }
    if (!materialExists(s.look.materials, s.props.family)) errors.push('declared prop material');
  }
  if (Math.abs(s.spawn.x) > CHUNK_HALF || Math.abs(s.spawn.z) > CHUNK_HALF || s.spawn.y < -CELL_BELOW || s.spawn.y > CELL_ABOVE) errors.push('player spawn in cell');
  const conditions = new Set(s.hooks.conditions.map((row) => row.id)), scenes = new Set(s.hooks.scenes.map((row) => row.id));
  if (s.quests.triggers.some((row) => row.kind === 'script' && !conditions.has(row.condition)) || s.quests.quests.some((row) => row.onComplete?.scene !== undefined && !scenes.has(row.onComplete.scene)) || s.quests.dialogue.some((row) => row.nodes.some((node) => node.choices.some((choice) => choice.scene !== undefined && !scenes.has(choice.scene))))) errors.push('declared quest script hooks');
  if (s.plumbing !== null && (s.plumbing.input.some((row) => row.actions.some((action) => !scenes.has(action.scene))) || s.plumbing.debug.some((row) => row.choices.some((choice) => choice.scene !== undefined && !scenes.has(choice.scene))))) errors.push('declared plumbing scene hooks');
  if (s.hooks.scenes.length + s.hooks.conditions.length > 0 && s.sim.bindings.length === 0) errors.push('named hooks require script bindings');
  errors.push(...scriptBindingRules(s.sim.bindings, s.sim.scripts));
  if (new Set(s.sim.scripts).size !== s.sim.scripts.length) errors.push('unique script modules');
  if (s.sim.scripts.some((module) => !module.startsWith('commons:') && files.get(module)?.kind !== 'wasm')) errors.push('script module is a Wasm file');
  if (s.terrain !== null && (!s.critical.includes(s.terrain.collider) || files.get(s.terrain.collider)?.kind !== 'binary' || s.terrain.tiles.some((payload) => files.get(payload.file)?.kind !== 'binary' || !s.tiles.some((row) => row.lod === payload.lod && row.x === payload.x && row.z === payload.z && row.files.includes(payload.file))))) errors.push('declared terrain payload references');
  if (s.terrain?.form === 'query' && s.runtime?.binds?.includes('terrain') !== true) errors.push('query terrain requires runtime.binds terrain');
  if (s.terrain?.sampling !== undefined && (!s.critical.includes(s.terrain.sampling.file) || files.get(s.terrain.sampling.file)?.kind !== 'binary')) errors.push('declared terrain sampling reference');
  if (s.terrain?.sampling !== undefined && s.meshCollision !== null) errors.push('terrain sampling and mesh ground are mutually exclusive');
  if (s.look.families.some((family) => !materialExists({}, family)) || (s.terrain !== null && s.terrain.form !== 'query' && !materialExists(s.look.materials, s.terrain.family)) || s.rows.looks.some((row) => row.material !== null && !materialExists(s.look.materials, row.material))) errors.push('declared platform material family');
  const species = new Map(s.rows.species.map((row) => [row.id, row])), strikes = new Map(s.rows.strikes.map((row) => [row.id, row]));
  for (const brain of s.creatures.brains) if (brain.kind === 'script' && (!s.sim.scripts.includes(brain.module) || brain.strikes.some((request) => !strikes.has(request.strike)))) errors.push('declared custom brain module and strikes');
  for (const declared of s.creatures.brains) {
    const brain = declared.kind === 'grazer' ? grazerPreset(declared) : declared.kind === 'diver' ? diverPreset(declared) : declared;
    if (brain.kind === 'ram-grazer') {
      const strike = strikes.get(brain.strike);
      if (strike?.shape.kind !== 'lane' || strike.windup <= 0 || strike.range <= 0) errors.push('declared ram grazer lane strike');
    } else if (brain.kind === 'challenge-grazer' && (strikes.get(brain.charge)?.shape.kind !== 'lane' || strikes.get(brain.close)?.shape.kind !== 'arc')) errors.push('declared challenge grazer charge/close strikes');
    else if (brain.kind === 'orbit-diver' || brain.kind === 'patrol-diver' || brain.kind === 'burst-flyer') {
      if (strikes.get(brain.strike)?.shape.kind !== 'sphere') errors.push('declared flyer sphere strike');
      if (Math.abs(brain.home.x) > CHUNK_HALF || Math.abs(brain.home.z) > CHUNK_HALF || ('y' in brain.home && (brain.home.y < -CELL_BELOW || brain.home.y > CELL_ABOVE))) errors.push('declared flyer home in cell');
      if (s.creatures.spawns.some(spawn => spawn.brain === brain.id && species.get(spawn.species)?.flight === undefined)) errors.push('declared flyer species flight');
    }
  }
  if (new Set(s.crowds.map(row => row.id)).size !== s.crowds.length) errors.push('unique crowd identities');
  const crowdMembers = s.crowds.reduce((sum, row) => sum + row.count, 0);
  if (crowdMembers > 4096) errors.push('declared crowd member capacity');
  if (s.crowds.some(row => Math.abs(row.x) > CHUNK_HALF || Math.abs(row.z) > CHUNK_HALF)) errors.push('declared crowd home in cell');
  if (s.creatures.spawns.length + crowdMembers > s.serverBudget.entities) errors.push('declared entity capacity');
  for (const spawn of s.creatures.spawns) if (!species.get(spawn.species)?.variants.some((row) => row.id === spawn.variant) || (spawn.strike !== null && !strikes.has(spawn.strike))) errors.push('declared spawn species/variant/strike');
  errors.push(...encounterRules(s.encounters, s.creatures.spawns.map((spawn) => spawn.id), s.ui.filter((row) => row.kind === 'bossPanel')));
  const controlled = new Set(s.encounters.map((row) => row.entity));
  errors.push(...groupBrainRules(s.creatures.groups, s.creatures.spawns, s.creatures.brains.map((row) => row.id), [...controlled]));
  if (s.creatures.spawns.some((row) => (row.brain === null) !== controlled.has(row.id))) errors.push('exactly one declared creature controller');
  return [...new Set(errors)];
}
/** Strict schema for the public SDK format; rejects unknown fields and invalid references. */
export const ShardfileSchema = v.pipe(v.unknown(), v.rawCheck(({ dataset, addIssue }) => { try { preflightShardfile(dataset.value); } catch (error) { const nonData = error instanceof Error && /(?:JSON data|accessors)/u.test(error.message); addIssue({ message: nonData ? 'shardfile carries JSON data only; executable behaviour must be admitted WASM' : 'shardfile manifest admission limits' }); } }), v.check(isJsonData, 'shardfile carries JSON data only; executable behaviour must be admitted WASM'), v.check((input) => !isJsonData(input) || (typeof input === 'object' && input !== null && 'entryways' in input && input.entryways !== undefined), 'illegal shard: four midpoint entryways are required'), rawSchema,
  v.rawCheck(({ dataset, addIssue }) => { if (dataset.typed) { try { preflightAssetGraph(dataset.value); } catch (error) { addIssue({ message: error instanceof Error ? error.message : 'shardfile asset graph admission' }); } } }),
  v.check((s) => entrywayRules(s).length === 0, 'illegal shard: entryway openings must meet road height y=0'), v.check((s) => shardfileRules(s).length === 0, 'shardfile semantic rules'));
/** Parse untrusted JSON as a validated shardfile, or throw a Valibot error. */
export function parseShardfile(input: unknown): Shardfile { return v.parse(ShardfileSchema, input); }
