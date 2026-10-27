import type { Shardfile } from './shardSchema';
import type { PlatformSectionName } from './sections';
import type { PlatformDataSections } from './platformDataSections';
import type { OutputIndex } from './outputIndex';

export interface SectionMapping { readonly name: PlatformSectionName; readonly fields: readonly (keyof Shardfile)[]; readonly row?: keyof Shardfile['rows']; readonly spawns?: true; }
/** Root-key envelopes preserve optional-field absence and every existing host's values. */
const ROW_SECTION_NAMES: { readonly species: 'actors/species'; readonly strikes: 'combat/strikes'; readonly loot: 'economy/loot'; readonly days: 'world/days'; readonly weather: 'world/weather'; readonly looks: 'look/materials'; readonly compendiums: 'ui/compendium'; } = {species:'actors/species',strikes:'combat/strikes',loot:'economy/loot',days:'world/days',weather:'world/weather',looks:'look/materials',compendiums:'ui/compendium'} as const;
const OUTPUT_SECTION_FIELDS: readonly [{ readonly name: "world/tiles"; readonly fields: readonly ["tiles", "far", "near"]; }, { readonly name: "world/terrain"; readonly fields: readonly ["terrain", "nativeGround"]; }, { readonly name: "world/edge"; readonly fields: readonly ["edge", "entryways"]; }, { readonly name: "world/collision"; readonly fields: readonly ["meshCollision"]; }, { readonly name: "world/navigation"; readonly fields: readonly ["navigation"]; }, { readonly name: "world/props"; readonly fields: readonly ["props"]; }, { readonly name: "world/water"; readonly fields: readonly ["water"]; }, { readonly name: "world/movers"; readonly fields: readonly ["movers"]; }, { readonly name: "world/traversal"; readonly fields: readonly ["traversal"]; }, { readonly name: "world/spawn"; readonly fields: readonly ["spawn"]; }, { readonly name: "look/look"; readonly fields: readonly ["look", "presentation"]; }, { readonly name: "look/map"; readonly fields: readonly ["map"]; }, { readonly name: "actors/creatures"; readonly fields: readonly ["creatures"]; }, { readonly name: "actors/crowds"; readonly fields: readonly ["crowds"]; }, { readonly name: "actors/npcs"; readonly fields: readonly ["questNpcs"]; }, { readonly name: "actors/spawns"; readonly fields: readonly []; readonly spawns: true; }, { readonly name: "combat/items"; readonly fields: readonly ["items"]; }, { readonly name: "combat/encounters"; readonly fields: readonly ["encounters"]; }, { readonly name: "quests/quests"; readonly fields: readonly ["quests"]; }, { readonly name: "quests/host"; readonly fields: readonly ["questHost"]; }, { readonly name: "quests/directors"; readonly fields: readonly ["directors"]; }, { readonly name: "economy/ledger"; readonly fields: readonly ["ledger"]; }, { readonly name: "state/state"; readonly fields: readonly ["state"]; }, { readonly name: "state/migrations"; readonly fields: readonly ["migrations"]; }, { readonly name: "state/modes"; readonly fields: readonly ["modes"]; }, { readonly name: "sim/sim"; readonly fields: readonly ["sim"]; }, { readonly name: "sim/hooks"; readonly fields: readonly ["hooks"]; }, { readonly name: "sim/client-scripts"; readonly fields: readonly ["clientScripts"]; }, { readonly name: "sim/client-channels"; readonly fields: readonly ["clientChannels"]; }, { readonly name: "sim/plumbing"; readonly fields: readonly ["plumbing"]; }, { readonly name: "audio/audio"; readonly fields: readonly ["audio"]; }, { readonly name: "ui/card"; readonly fields: readonly ["accent"]; }, { readonly name: "ui/level"; readonly fields: readonly ["manifest"]; }, { readonly name: "ui/ui"; readonly fields: readonly ["ui", "targets"]; }, ...{ name: "world/days" | "world/weather" | "look/materials" | "actors/species" | "combat/strikes" | "economy/loot" | "ui/compendium"; fields: never[]; row: "species" | "strikes" | "loot" | "days" | "weather" | "looks" | "compendiums"; }[]] = [
  {name:'world/tiles',fields:['tiles','far','near']},
  {name:'world/terrain',fields:['terrain','nativeGround']},
  {name:'world/edge',fields:['edge','entryways']},
  {name:'world/collision',fields:['meshCollision']},
  {name:'world/navigation',fields:['navigation']},
  {name:'world/props',fields:['props']},
  {name:'world/water',fields:['water']},
  {name:'world/movers',fields:['movers']},
  {name:'world/traversal',fields:['traversal']},
  {name:'world/spawn',fields:['spawn']},
  {name:'look/look',fields:['look','presentation']},
  {name:'look/map',fields:['map']},
  {name:'actors/creatures',fields:['creatures']},
  {name:'actors/crowds',fields:['crowds']},
  {name:'actors/npcs',fields:['questNpcs']},
  {name:'actors/spawns',fields:[],spawns:true},
  {name:'combat/items',fields:['items']},
  {name:'combat/encounters',fields:['encounters']},
  {name:'quests/quests',fields:['quests']},
  {name:'quests/host',fields:['questHost']},
  {name:'quests/directors',fields:['directors']},
  {name:'economy/ledger',fields:['ledger']},
  {name:'state/state',fields:['state']},
  {name:'state/migrations',fields:['migrations']},
  {name:'state/modes',fields:['modes']},
  {name:'sim/sim',fields:['sim']},
  {name:'sim/hooks',fields:['hooks']},
  {name:'sim/client-scripts',fields:['clientScripts']},
  {name:'sim/client-channels',fields:['clientChannels']},
  {name:'sim/plumbing',fields:['plumbing']},
  {name:'audio/audio',fields:['audio']},
  {name:'ui/card',fields:['accent']},
  {name:'ui/level',fields:['manifest']},
  {name:'ui/ui',fields:['ui','targets']},
  ...(['species','strikes','loot','days','weather','looks','compendiums'] as const).map(row => ({name:ROW_SECTION_NAMES[row],fields:[],row})),
] as const satisfies readonly SectionMapping[];
/** Existing host-field envelopes, plus independently authored platform schemas. */
export const OUTPUT_SECTIONS:readonly SectionMapping[]=OUTPUT_SECTION_FIELDS;
export type OutputHostSectionName = (typeof OUTPUT_SECTION_FIELDS)[number]['name'];

const DATA_SECTION_NAMES: Readonly<Record<keyof PlatformDataSections, true>> = {
  "player/stealth": true,
  "explore/catalogue": true,
  "look/rigged-hulls": true,
  "look/hull-book": true,
  "look/toon": true,
  "look/painted": true,
  "look/colour-functions": true,
  "look/keyed-sky": true,
  "client/plan": true,
  "view/modules": true,
  "held/arms": true,
  "held/gear": true,
  "held/finishes": true,
  "held/loadout": true,
  "held/equipment": true,
  "ui/completion": true,
  "sim/runtime-plan": true,
  "actors/species-programs": true,
  "actors/moves": true,
  "actors/spawn-scripts": true,
  "actors/return-scripts": true,
  "actors/strikes": true,
  "sim/scripts": true,
  "sim/bodies": true,
  "ui/strings": true,
  "world/physics": true,
  "world/targets": true,
  "world/scenes": true,
  "world/trees": true,
};
/** Exact public platform names; schema implementations stay on the checked side. */
export function isPlatformDataSection(name: string): name is keyof PlatformDataSections {
  return Object.hasOwn(DATA_SECTION_NAMES, name);
}

/** Deterministic platform section values; custom author sections are added separately. */
export function outputSectionPayloads(source: Shardfile): ReadonlyMap<string, unknown> {
  const result = new Map<string, unknown>();
  for (const mapping of OUTPUT_SECTIONS) {
    const payload: Record<string, unknown> = {};
    for (const field of mapping.fields) if (Object.hasOwn(source, field)) payload[field] = source[field];
    if (mapping.row !== undefined) payload['rows'] = {[mapping.row]: source.rows[mapping.row]};
    if (mapping.spawns === true && source.runtime?.spawns !== undefined) payload['runtime'] = {spawns:source.runtime.spawns};
    if (Object.keys(payload).length > 0) result.set(mapping.name, payload);
  }
  return result;
}
/** Reconstruct host fields without transport metadata. This returns unknown fields, never an admitted host model. The caller must
 * verify its exact build hashes or supply the original checked readers. */
export function assembleOutputTransport(index: OutputIndex, sections: ReadonlyMap<string, unknown>, checks?: { readonly bounds: (name: string, value: unknown) => void; readonly platform: (name: keyof PlatformDataSections, value: unknown) => void; readonly fields: (name: string, value: object) => Record<string, unknown> }): Record<string, unknown> {
  const result: Record<string, unknown> = {version:index.version,identity:index.identity,requires:index.requires,...index.admission,files:index.files.filter(file => file.commons !== true).map(({path: _path,name: _name,tier: _tier,variantOf: _variant,commons: _commons,jsonSchema: _schema,kind,...rest}) => Object.assign(rest,{kind:kind === 'tile' || kind === 'bin' ? 'binary' : kind})),runtime:index.runtime === null ? null : {...('entry' in index.runtime ? {entry:index.runtime.entry} : {kind:index.runtime.kind}),...(index.runtime.cost === undefined ? {} : {cost:index.runtime.cost}),...(index.runtime.binds === undefined ? {} : {binds:index.runtime.binds})}};
  if (sections.size !== index.sections.length || index.sections.some(entry => !sections.has(entry.name))) throw new Error('Missing or surplus output section');
  const rows: Record<string, unknown> = {};
  for (const entry of index.sections) {
    checks?.bounds(entry.name, sections.get(entry.name));
    if (entry.name.startsWith('custom/')) continue;
    if (isPlatformDataSection(entry.name)) { checks?.platform(entry.name, sections.get(entry.name)); continue; }
    const payload=sections.get(entry.name);
    if(typeof payload!=='object'||payload===null||Array.isArray(payload))throw new Error('Output section envelope must be an object');
    const value = checks === undefined ? payload : checks.fields(entry.name, payload);
    for (const [key, data] of Object.entries(value)) {
      if (key === 'rows') Object.assign(rows,data);
      else if (key === 'runtime') Object.assign(result['runtime'] ?? {},data);
      else if (Object.hasOwn(result,key)) throw new Error('Overlapping output section'); else result[key] = data;
    }
  }
  result['rows'] = rows;
  return result;
}
