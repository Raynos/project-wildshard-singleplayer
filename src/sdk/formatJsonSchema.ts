import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema';
import type { GenericSchema } from 'valibot';
import { EdgeProfileSchema, EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { PlumbingSchema } from '@wildshard/format/plumbing';
import { StateSchema } from '@wildshard/format/state';
import { CommonsCostsSchema } from '@wildshard/format/commonsCosts';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/format/admissionLimits';

import { SkirmisherSchema, ScriptBrainSchema, GuardianSchema, PerchHunterSchema } from '@wildshard/format/brains';
import { OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema } from '@wildshard/format/flyers';
import { RamGrazerSchema, ChallengeGrazerSchema } from '@wildshard/format/grazers';
import { GroupBrainSchema } from '@wildshard/format/groupBrains';
import { CreaturesSchema } from '@wildshard/format/creatures';
import { FlockSchema } from '@wildshard/format/crowds';
import { EncountersSchema } from '@wildshard/format/encounters';
import { AudioMusicSchema, AudioSamplesSchema, AudioZonesSchema } from '@wildshard/format/audioProfiles';
import { AudioRoutingSchema } from '@wildshard/format/audioRouting';
import { AudioDataSchema } from '@wildshard/format/audio';
import { LedgerFactSchema, LedgerRulesSchema } from '@wildshard/format/ledger';
import { DirectorSchema } from '@wildshard/format/director';
import { LogicalStateSchema, MigrationsSchema } from '@wildshard/format/migrations';
import { TraversalSchema } from '@wildshard/format/traversal';
import { RuntimeBindsSchema } from '@wildshard/format/runtimeBinds';
import { RuntimeSpawnsSchema } from '@wildshard/format/runtimeSpawns';
import { SkinPoseLayerSchema } from '@wildshard/format/skinLayers';
import { PhasedFlyerSchema } from '@wildshard/format/phasedFlyers';
import { PresentationSchema } from '@wildshard/format/presentation';
import { MeshCollisionSchema } from '@wildshard/format/meshCollision';
import { ScriptBindingsSchema } from '@wildshard/format/scripts';
import { HooksSchema } from '@wildshard/format/hooks';
import { TerrainSchema } from '@wildshard/format/terrain';
import { WaterSchema } from '@wildshard/format/water';
import { AccentSchema, ACCENT_IDS } from '@wildshard/format/accent';

/** JSON Schema plus explicit admission checks that JSON Schema cannot express. */
export interface FormatJsonSchema extends JsonSchema {
  'x-wildshard-checks'?: string[];
  'x-wildshard-string-length'?: 'utf16-code-units';
}

const plumbing = PlumbingSchema.pipe[0];
const input = plumbing.entries.input.pipe[0].item;
const debug = plumbing.entries.debug.pipe[0].item;
// These identities are the defining schemas, not message-based permissions for arbitrary author code.
const customSchemas = new Map<object, JsonSchema>([
  [input.entries.id, { type: 'string', maxLength: 128, pattern: '^[a-z][a-z0-9-]*(?:\\.[a-z][a-zA-Z0-9-]*)+$' }],
  [debug.entries.ask, { type: 'string', pattern: '^E[1-9][0-9]*$' }],
]);
// Exact fixed-palette validator; a caller's new custom schema receives no bridge.
customSchemas.set(AccentSchema.pipe[2], { type: 'string', enum: [...ACCENT_IDS] });
const unicodeRegexes = new Set<object>([
  plumbing.entries.namespace.pipe[1],
  input.entries.actions.pipe[0].item.entries.keys.pipe[0].item.pipe[1],
  debug.entries.reviewBy.pipe[1],
]);
const stateField = StateSchema.pipe[0].entries.shared.pipe[0].item;
unicodeRegexes.add(stateField.entries.name.pipe[1]);
unicodeRegexes.add(CommonsCostsSchema.pipe[0].key.pipe[1]);
const edge = EdgeProfileSchema.pipe[0];
const finiteNumbers = new Set<object>([
  edge.entries.heights.item.pipe[1],
  stateField.entries.default.options[1].pipe[1],
  ...edge.entries.colours.item.items.map(channel => channel.pipe[1]),
]);

// Only the exact retained defining roots grant action bridges. A caller's new check or transform never joins.
const wireRoots = {
  'brains.Skirmisher': SkirmisherSchema,
  'brains.ScriptBrain': ScriptBrainSchema,
  'brains.Guardian': GuardianSchema,
  'brains.PerchHunter': PerchHunterSchema,
  'flyers.OrbitDiver': OrbitDiverSchema,
  'flyers.PatrolDiver': PatrolDiverSchema,
  'flyers.BurstFlyer': BurstFlyerSchema,
  'grazers.RamGrazer': RamGrazerSchema,
  'grazers.ChallengeGrazer': ChallengeGrazerSchema,
  'groupBrains.GroupBrain': GroupBrainSchema,
  'creatures.Creatures': CreaturesSchema,
  'crowds.Flock': FlockSchema,
  'encounters.Encounters': EncountersSchema,
  'audioProfiles.AudioMusic': AudioMusicSchema,
  'audioProfiles.AudioSamples': AudioSamplesSchema,
  'audioProfiles.AudioZones': AudioZonesSchema,
  'audioRouting.AudioRouting': AudioRoutingSchema,
  'audio.AudioData': AudioDataSchema,
  'ledger.LedgerFact': LedgerFactSchema,
  'ledger.LedgerRules': LedgerRulesSchema,
  'director.Director': DirectorSchema,
  'migrations.LogicalState': LogicalStateSchema,
  'migrations.Migrations': MigrationsSchema,
  'traversal.Traversal': TraversalSchema,
  'runtimeBinds.RuntimeBinds': RuntimeBindsSchema,
  'runtimeSpawns.RuntimeSpawns': RuntimeSpawnsSchema,
  'skinLayers.SkinPoseLayer': SkinPoseLayerSchema,
  'phasedFlyers.PhasedFlyer': PhasedFlyerSchema,
  'presentation.Presentation': PresentationSchema,
  'meshCollision.MeshCollision': MeshCollisionSchema,
  'scripts.ScriptBindings': ScriptBindingsSchema,
  'hooks.Hooks': HooksSchema,
  'terrain.Terrain': TerrainSchema,
  'water.Water': WaterSchema,
  'accent.Accent': AccentSchema,
 } satisfies Readonly<Record<string, GenericSchema>>;
const wireChecks = new Map<object, string>();
const wireFinite = new Set<object>();
const wireRegexes = new Set<object>();
function rememberActions(value: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  const kind: unknown = Reflect.get(value, 'kind'), type: unknown = Reflect.get(value, 'type');
  if (kind === 'validation') {
    if (type === 'check' && !wireChecks.has(value)) wireChecks.set(value, path);
    else if (type === 'finite') wireFinite.add(value);
    else if (type === 'regex') {
      const regex: unknown = Reflect.get(value, 'requirement');
      if (regex instanceof RegExp && regex.flags === 'u') wireRegexes.add(value);
    }
  }
  for (const [key, child] of Object.entries(value)) rememberActions(child, `${path}.${key}`, seen);
}
for (const [key, schema] of Object.entries(wireRoots)) {
  const module = key.slice(0, key.indexOf('.')), binding = key.slice(key.indexOf('.') + 1);
  rememberActions(schema, `@wildshard/format/${module}#${binding}Schema`, new WeakSet());
}

/**
 * Convert an author schema with the official converter, refusing every unrecognised custom check or transform.
 * The extracted format checks have explicit bridges. Plumbing's cross-field checks remain named mandatory
 * admission checks; Valibot string bounds use UTF-16 code units, unlike JSON Schema's Unicode code points.
 * This structural document never replaces the defining format parser's admission verdict.
 */
export function formatJsonSchema(schema: GenericSchema): FormatJsonSchema {
  return toJsonSchema(schema, {
    target: 'draft-2020-12', errorMode: 'throw', typeMode: 'output',
    overrideSchema: ({ valibotSchema }) => customSchemas.get(valibotSchema),
    overrideAction: ({ valibotAction, jsonSchema, errors }) => {
      if (valibotAction === EdgeProfileSchema.pipe[1]) {
        // Both arrays must have the same native sample count; bound each branch exactly.
        return { ...jsonSchema, anyOf: [256, 257].map(count => ({ properties: {
          heights: { minItems: count, maxItems: count }, colours: { minItems: count, maxItems: count },
        } })) };
      }
      if (valibotAction === PlumbingSchema.pipe[1]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/plumbing#plumbingRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === StateSchema.pipe[1]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/state#stateRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === CommonsCostsSchema.pipe[1]) {
        return { ...jsonSchema, maxProperties: SHARDFILE_ADMISSION_LIMITS.commons };
      }
      const check = wireChecks.get(valibotAction);
      if (check !== undefined) {
        const before = (jsonSchema as FormatJsonSchema)['x-wildshard-checks'] ?? [];
        return { ...jsonSchema, 'x-wildshard-checks': [...before, check] } satisfies FormatJsonSchema;
      }
      // JSON numbers cannot contain NaN or infinity. The existing ASCII regexes only use the Unicode flag.
      if (finiteNumbers.has(valibotAction) || unicodeRegexes.has(valibotAction) || wireFinite.has(valibotAction) || wireRegexes.has(valibotAction)) return jsonSchema;
      if (errors === undefined && jsonSchema.type === 'string' &&
          (valibotAction.type === 'min_length' || valibotAction.type === 'max_length')) {
        return { ...jsonSchema, 'x-wildshard-string-length': 'utf16-code-units' } satisfies FormatJsonSchema;
      }
      return undefined;
    },
  });
}

/** The migrated wire roots, generated from their defining Valibot schemas; whole-shard extraction remains open. */
export function formatJsonSchemas(): Readonly<Record<string, FormatJsonSchema>> {
  const document = (name: string, schema: GenericSchema): FormatJsonSchema => ({
    ...formatJsonSchema(schema), title: name,
    $comment: 'DO-NOT-EDIT: generated from @wildshard/format by scripts/gen-format-schema.mjs. Structural schema; named checks and UTF-16 bounds still require the defining Valibot parser.',
  });
  return { 'edge-profiles': document('edge-profiles', EdgeProfilesSchema), plumbing: document('plumbing', PlumbingSchema),
    state: document('state', StateSchema), 'commons-costs': document('commons-costs', CommonsCostsSchema),
    ...Object.fromEntries(Object.entries(wireRoots).map(([name, schema]) => [name, document(name, schema)])) };
}
