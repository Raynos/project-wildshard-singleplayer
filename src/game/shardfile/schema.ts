import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF, CONTENT_CAPS } from '@wildshard/engine/core/config';
import { isJsonData } from './json';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';
import { preflightShardfile } from './preflight';
import { preflightAssetGraph } from './assetGraph';
import { SHARDFILE_VERSION } from './version';
import { UiSchema, uiRules } from './ui';
import { ScriptBindingsSchema, scriptBindingRules } from './scripts';
import { RowsSchema } from './rows';
import { TerrainSchema } from './terrain';
import { MeshCollisionSchema, meshCollisionRules } from './meshCollision';
import { NativeGroundSchema, nativeGroundRules } from './nativeGround';
import { WaterSchema } from './water';
import { CreaturesSchema } from './creatures';
import { FlockSchema } from './crowds';
import { groupBrainRules } from './groupBrains';
import { EncountersSchema, encounterRules } from './encounters';
import { QuestDataSchema } from './quests';
import { AudioDataSchema } from './audio';
import { LedgerRulesSchema } from './ledger';
import { HooksSchema, hookRules } from './hooks';
import { PlumbingSchema } from './plumbing';
import { PropsSchema, validatePropsReferences } from './props';
import { TargetsSchema, targetRules } from './targets';
import { ItemsSchema, itemRules } from './items';
import { TraversalSchema } from './traversal';
import { RuntimeSchema } from './runtime';
import { ClientScriptsSchema, clientScriptRules } from './clientScripts';
import { EdgeProfilesSchema } from './edgeProfiles';
import { EntrywaysSchema, entrywayRules } from './entryways';
import { MoversSchema, parseMovers } from './movers';
import { socketLiftEntries, socketLiftRules } from './socketLift';
import { portalLinkEntries, portalLinkRules } from './portalLink';
import { StateSchema, stateRules } from './state';
import { CommonsCostsSchema, assertCommonsCosts } from './commonsCosts';
import { AccentSchema } from './accent';
import { MigrationsSchema, migrationRules } from './migrations';
import { skinLookRules } from './skins';
import { MaterialsSchema, FamilyLooksSchema, materialExists, materialTextureRefs, materialGraphRules } from './materials';

const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(natural, v.minValue(1));
const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(limits.idCharacters));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const ref = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
const references = v.pipe(v.array(ref), v.maxLength(limits.files + limits.commons));
const names = v.pipe(v.array(name), v.maxLength(limits.files));
const vec3 = v.tuple([finite, finite, finite]);
const channel = v.pipe(finite, v.minValue(0), v.maxValue(1));
const colour = v.tuple([channel, channel, channel]);
const bounds = v.pipe(v.strictObject({ min: vec3, max: vec3 }), v.check((b) => b.min.every((n, i) => n <= (b.max[i] ?? -Infinity)), 'ordered bounds'), v.check((b) => b.min[0] >= -CHUNK_HALF && b.max[0] <= CHUNK_HALF && b.min[2] >= -CHUNK_HALF && b.max[2] <= CHUNK_HALF && b.min[1] >= -CELL_BELOW && b.max[1] <= CELL_ABOVE, 'cell bounds'));
const costs = { compressed: natural, decoded: natural, gpu: natural, triangles: natural, draws: natural };
const unsigned = v.pipe(finite, v.minValue(0));
const key = v.strictObject({ time: channel, sky: v.strictObject({ zenith: colour, horizon: colour }), fog: v.strictObject({ colour, density: unsigned, near: v.optional(unsigned), far: v.optional(unsigned) }), sun: v.strictObject({ colour, intensity: unsigned }), ambient: v.strictObject({ sky: colour, ground: colour, intensity: unsigned }) });
const day = v.strictObject({ minutes: v.pipe(finite, v.minValue(1), v.maxValue(1440)), start: channel, maxElevation: v.pipe(finite, v.minValue(0), v.maxValue(90)), azimuth: v.pipe(finite, v.minValue(-180), v.maxValue(180)) });
/** A colour LUT file's exact wire size: 33³ RGBA8 (the engine's render/lut format). */
export const LOOK_LUT_BYTES = 33 ** 3 * 4;
const tile = v.strictObject({ lod: v.picklist([0, 1]), x: natural, z: natural, bounds, geometricError: v.pipe(finite, v.minValue(0)), files: references, ...costs });
const file = v.strictObject({ hash, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'binary']), ...costs, dependencies: references, critical: v.boolean() });
const tileCount = (2 * CHUNK_HALF / CONTENT_CAPS.l0.size) ** 2 + (2 * CHUNK_HALF / CONTENT_CAPS.l1.size) ** 2;
const rawSchema = v.strictObject({
  version: v.literal(SHARDFILE_VERSION),
  accent: AccentSchema,
  identity: v.strictObject({ slug: name, name: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), author: v.pipe(v.string(), v.minLength(1), v.maxLength(limits.idCharacters)), revision: positive, seed: natural }),
  requires: v.strictObject({ sdk: v.literal(SHARDFILE_VERSION), capabilities: names, commons: v.pipe(v.array(hash), v.maxLength(limits.commons)), commonsWire: v.optional(v.record(hash, natural), {}), commonsCosts: v.optional(CommonsCostsSchema, {}) }),
  budgets: v.strictObject({ library: v.strictObject({ resident: natural, compressed: v.pipe(natural, v.maxValue(CONTENT_CAPS.library.compressed)) }), sim: v.strictObject({ resident: natural, compressed: v.pipe(natural, v.maxValue(CONTENT_CAPS.sim.compressed)) }), overlap: natural }),
  look: v.strictObject({ families: names, materials: v.optional(MaterialsSchema, {}), familyLooks: v.optional(FamilyLooksSchema, {}), grade: v.strictObject({ exposure: finite, saturation: v.pipe(finite, v.minValue(0)), contrast: v.pipe(finite, v.minValue(0)), lut: v.nullable(ref) }), clock: v.literal('engine'), day: v.optional(day), dayOverride: v.nullable(channel), keys: v.pipe(v.array(key), v.maxLength(64)) }),
  sim: v.strictObject({ fixedHz: v.literal(60), scriptTickDivisor: v.pipe(positive, v.check((n) => 60 % n === 0, 'script divisor divides 60')), commandVersion: v.literal(0), snapshotVersion: v.literal(0), scripts: references, bindings: v.optional(ScriptBindingsSchema, []) }),
  state: StateSchema,
  migrations: v.optional(MigrationsSchema, []),
  authorCaps: v.strictObject({ players: v.pipe(positive, v.maxValue(32)), speed: v.pipe(finite, v.minValue(0), v.maxValue(15)) }),
  serverBudget: v.strictObject({ tickMicros: v.pipe(positive, v.maxValue(16_666)), memory: positive, entities: v.pipe(natural, v.maxValue(10_000)), commandsPerTick: v.pipe(natural, v.maxValue(1024)) }),
  edge: EdgeProfilesSchema,
  entryways: EntrywaysSchema,
  movers: v.optional(MoversSchema, []),
  files: v.pipe(v.array(file), v.maxLength(limits.files)), tiles: v.pipe(v.array(tile), v.maxLength(tileCount)), library: references, critical: references,
  far: v.nullable(v.strictObject({ files: references, bounds, ...costs })),
  ui: v.optional(UiSchema, []),
  rows: v.optional(RowsSchema, { strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [] }),
  terrain: v.optional(v.nullable(TerrainSchema), null),
  meshCollision: v.optional(v.nullable(MeshCollisionSchema), null),
  nativeGround: v.optional(v.nullable(NativeGroundSchema), null),
  water: v.optional(v.pipe(WaterSchema, v.maxLength(limits.waterBodies)), []),
  creatures: v.optional(CreaturesSchema, { brains: [], groups: [], spawns: [] }),
  crowds: v.optional(v.pipe(v.array(FlockSchema), v.maxLength(64)), []),
  encounters: v.optional(EncountersSchema, []),
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
  runtime: v.optional(v.nullable(RuntimeSchema), null),
  spawn: v.optional(v.strictObject({ x: finite, y: finite, z: finite, yaw: finite }), { x: 0, y: 2, z: 0, yaw: 0 }),
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
  const refs = [...s.files.flatMap((f) => f.dependencies), ...s.tiles.flatMap((t) => t.files), ...s.library, ...s.critical, ...s.sim.scripts, ...(s.far?.files ?? []), ...(s.look.grade.lut === null ? [] : [s.look.grade.lut])];
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
  errors.push(...materialGraphRules(s));
  const materialRefs = materialTextureRefs(s.look.materials), libraryClosure = new Set<string>();
  const libraryPending = [...s.library];
  while (libraryPending.length > 0) {
    const id = libraryPending.pop(); if (id === undefined || libraryClosure.has(id)) continue;
    libraryClosure.add(id); libraryPending.push(...files.get(id)?.dependencies ?? []);
  }
  if (materialRefs.some((id) => !/^(?:commons:)?[a-f0-9]{64}$/u.test(id) || !libraryClosure.has(id) || (id.startsWith('commons:') ? !s.requires.commons.includes(id.slice(8)) : files.get(id)?.kind !== 'ktx2'))) errors.push('admitted material texture library references');
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
    if (t.compressed > cap.compressed || t.triangles > cap.triangles || t.draws > cap.draws) errors.push('tile caps');
    if (t.lod === 1 && t.files.some((r) => s.library.includes(r))) errors.push('self-contained coarse tile');
  }
  if (s.far !== null && (s.far.compressed > CONTENT_CAPS.far.compressed || s.far.triangles > CONTENT_CAPS.far.triangles || s.far.draws > CONTENT_CAPS.far.draws)) errors.push('far caps');
  for (const f of s.files) if (f.critical !== s.critical.includes(f.hash)) errors.push('critical flags match roots');
  errors.push(...uiRules(s.ui, s.state));
  errors.push(...hookRules(s.hooks, s.state));
  errors.push(...meshCollisionRules(s));
  errors.push(...nativeGroundRules(s));
  errors.push(...targetRules(s.targets, s, { panels: s.props?.panels ?? [], colliders: [...s.props?.colliders ?? [], ...s.meshCollision?.panels ?? []] }));
  errors.push(...itemRules(s.items, s.sim.scripts));
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
  if (s.look.families.some((family) => !materialExists({}, family)) || (s.terrain !== null && !materialExists(s.look.materials, s.terrain.family)) || s.rows.looks.some((row) => row.material !== null && !materialExists(s.look.materials, row.material))) errors.push('declared platform material family');
  const species = new Map(s.rows.species.map((row) => [row.id, row])), strikes = new Map(s.rows.strikes.map((row) => [row.id, row]));
  for (const brain of s.creatures.brains) if (brain.kind === 'script' && (!s.sim.scripts.includes(brain.module) || brain.strikes.some((request) => !strikes.has(request.strike)))) errors.push('declared custom brain module and strikes');
  for (const brain of s.creatures.brains) {
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
