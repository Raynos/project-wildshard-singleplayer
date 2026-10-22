// G520 / G496: fixture-only growth is still shard code. This is the cut list,
// not an allowance or a budget. A real second shard needs a reviewed re-score.
/** @type {Map<string,import('./shard-components.mjs').Component>} */
const modules = new Map([
  // Optional chapter dispatch does not give carried-prop ownership to its other pages.
  ['src/game/quest/carriedProp.ts', 'C5'],
  ...['game/boss/arenaScript', 'game/boss/arenaField'].map(path => [`src/${path}.ts`, 'C4']),
  // G530 O1: the seated-figure specimen's one user is Nalati's mounted shepherd (Explorer catalogue)
  ['src/game/models/mountedSpecimen.ts', 'C1'],
  // G516/G518: only one live shard drives these item hosts; fixtures grant no credit.
  ...['game/weapons/bowVariant', 'game/loadout/mounted'].map(path => [`src/${path}.ts`, 'C6']),
]);
/** @type {Map<string,Map<string,import('./shard-components.mjs').Component>>} */
const declarations = new Map([
  ['src/game/systems/npc/figureRows.ts', new Map(['FigureGroupMember', 'FigureGroup', 'memberPose', 'enterFigureGroup'].map(name => [name, 'C9']))],
  ['src/game/loot/runtime.ts',new Map([['LootBagProjection','C6']])],
  ['src/format/lootEconomy.ts',new Map([['LootBagProjection','C6']])],
  ['src/game/looks/speciesBook.ts',new Map(['SpeciesLookBook','packedRows'].map(name=>[name,'C1']))],
  ['src/game/practice/course.ts', new Map(['MountedCourseController', 'HookCourseController', 'hookCoursePad', 'yawToward', 'HookCourseCourse', 'HookCourseRow', 'HookCoursePad'].map(name => [name, 'C6']))],
  ['src/game/boss/encounterView.ts', new Map(['SlotEncounterView','SlotViewActor','SlotSiteChange','Awake','PatrolEncounterView','PatrolViewActor','PatrolHit','Rider','PatrolActor','PatrolActorRoster'].map(name=>[name,'C4']))],
  ['src/game/population/pageGroups.ts', new Map([
    'point', 'whole', 'PagePopulationPlanner',
    'nearestPopulationActor', 'PageWildEnvironment', 'wildEnv', 'bindPageGroups',
    'renderedPacks', 'renderedHerds', 'renderedDamage', 'renderedPackOf',
    'renderedHerdOf', 'observeHerdDamage', 'PageGroups',
  ].map(name => [name, 'C4']))],
  ['src/game/ambient/crowdPage.ts', new Map([['readCrowdBody', 'C4']])],
  ['src/game/shardfile/crowdRuntime.ts', new Map([
    'CrowdPrey', 'CrowdTargets', 'CrowdRoster', 'CrowdWeaponTarget',
  ].map(name => [name, 'C4']))],
  ['src/game/quest/elitePage.ts', new Map([
    'keeperBrains', 'keeperActs', 'keeperDamage', 'setEliteBrain', 'setEliteAct',
    'setEliteDamage', 'eliteThink', 'eliteAct', 'eliteDamageMul', 'KeeperEliteRow',
    'KeeperEliteEffect', 'KeeperEliteServices', 'KeeperElitePage',
    'ExternalEliteRow', 'ExternalEliteEffect', 'EncounterHerd', 'ExternalElitePage',
  ].map(name => [name, 'C4']))],
  ['src/game/looks/painterlyLook.ts', new Map([
    'PainterlyWorldSchema', 'PainterlyFrame', 'PainterlyCapture', 'PainterlyWorld',
  ].map(name => [name, 'C2']))],
  ['src/game/shardfile/worldScenes.ts', new Map([['WorldScenePoolPublications', 'C1']])],
  ['src/game/shardfile/scenePools.ts', new Map([['WorldSceneTierPools', 'C1']])],
  ['src/format/worldScenes.ts', new Map([['WorldSceneTierPools', 'C1'], ['WorldScenePoolPublications', 'C1']])],
  ['src/engine/models/geometrySources.ts', new Map(['registerPackedGeometrySource', 'PackedGeometryImports'].map(name => [name, 'C1']))],
]);

/** Concrete dependencies of the optional chapter facet retain their original
 * users and mixed component attribution; a dispatcher is not another owner.
 * @type {Map<string,readonly string[]|null>} */
const chapterViewNativeOwners = new Map([
  ["src/engine/physics/heightPatch.ts", null],
  ["src/engine/combat/effects/types.ts", ["SourceMulDef", "anyTag", "sourceMultiplier"]],
  ["src/game/loadout/actors.ts", ["EquipmentActorOwner", "owners", "equipmentActorOwner", "equipmentAnimals"]],
  ["src/game/quest/chapter.ts", ["installChapterStory"]],
  ["src/game/shardfile/clientTrails.ts", ["ProjectedTrail"]],
  ["src/game/systems/npc/figureSkins.ts", ["atlasFigureSkin"]],
  ["src/game/weapons/heldLauncher.ts", ["names", "PoolSchema", "HeldBowFileSchema", "bowLoads", "loadHeldBow"]],
]);

// Single-shard branches inside otherwise shared declarations. These spans select
// code lines, never fixed credits; packet/instance-matrix handling stays shared.
/** @type {Map<string,Map<string,[string,number][]>>} */
const inline = new Map([
  ['src/game/loot/runtime.ts',new Map([['LootBagProjection',[
    ["import { declaredLootEconomy,declaredLootPresentation }",1],["import { createFindsCatalogue }",1],["import { boundQuestState }",1],["import { InteractSfx }",1],
    ['if(row.economy?.presentation===undefined)',1],['const economy=declaredLootEconomy([row])',12],
  ]]])],
  ['src/format/lootEconomy.ts',new Map([['LootBagProjection',[
    ['export const LootPresentationSchema=',5],['presentation:v.exactOptional(LootPresentationSchema)',1],
  ]]])],
  // the tier-selected pool decoder the resident scenes and the catalogue's cold intake share
  ['src/game/shardfile/scenePools.ts', new Map([['WorldSceneTierPools', [
    ['geometryPools: files.map(file => ({ url: product.url(tierFile(file.file))', 1],
    ['const file = [...files.map(entry => tierFile(entry.file))', 1],
  ]]])],
  ['src/game/shardfile/worldScenes.ts', new Map([
    ['WorldScenePoolPublications', [
      ["for (const row of section.libraries) if (row.kind === 'pool' && row.publish !== undefined)", 3],
      ['if (row.publish !== undefined) for (const part of row.files.flatMap', 4],
    ]],
  ])],
  ['src/format/worldScenes.ts', new Map([
    ['WorldScenePoolPublications', [["v.strictObject({ id, kind: v.literal('pool'), publish:", 1]]],
    ['WorldSceneTierPools', [
      ['channels: v.exactOptional(bounded(v.strictObject', 1],
      ['const poolParts = ', 2],
      [": entry.kind === 'pool' ? { ...entry, files: entry.files.filter(active) }", 1],
    ]],
  ])],
  ['src/engine/models/geometrySources.ts', new Map([['PackedGeometryImports', [
    ["import { GeometryPack }", 1], ["import type { PackedGeometryRows }", 1],
  ]]])],
]);

/** @param {string} path @param {string} [name] */
function reviewedOwner(path, name) {
  if(path === 'src/game/practice/course.ts' && ['HookCourseController','hookCoursePad','yawToward','HookCourseCourse','HookCourseRow','HookCoursePad'].includes(name ?? '')) return 'nine-dragon-stack';
  if (path.endsWith('/worldScenes.ts') || path === 'src/game/shardfile/scenePools.ts') return 'nine-dragon-stack';
  if (path === 'src/engine/models/geometrySources.ts') return 'pine-hollow';
  if (['src/game/loot/runtime.ts','src/format/lootEconomy.ts'].includes(path)) return 'driftwood-isle';
  return 'nalati-grasslands';
}

/** Shared declarations containing reviewed single-shard branches. */
export function inlinePlatformPaths() { return [...inline.keys()]; }

/** @param {string} path @param {string} source @param {(line:string)=>void} [report]
 * @returns {{name:string,lines:number[]}[]} */
export function inlinePlatformSpans(path, source, report = console.error) {
  const rows = [], lines = source.split('\n'), claimed = new Set();
  for (const [name, blocks] of inline.get(path) ?? []) {
    const selected = [];
    for (const [needle, length] of blocks) {
      const matches = lines.flatMap((line, index) => (needle.startsWith('=') ? line === needle.slice(1) : line.includes(needle)) ? [index] : []);
      if (matches.length !== 1) { report(`shard-platform: skip changed inline span ${path}#${name}: ${needle}`); continue; }
      for (const start of matches) for (let line = start; line < start + length; line++) if (!claimed.has(line)) { claimed.add(line); selected.push(line); }
    }
    rows.push({ name, lines: selected });
  }
  return rows;
}

/** Reviewed sole-user ownership, including declarations hidden behind shared
 * optional dispatch. FixedPageSpawnTable and StaticCapture remain shared.
 * @param {string} path @param {string} [name]
 * @returns {import('./shard-components.mjs').Component|null} */
export function platformChargeback(path, name) {
  return modules.get(path) ?? (name === undefined ? null : declarations.get(path)?.get(name) ?? null);
}
/** @param {string} path */
export function hasChargebackDeclarations(path) { return declarations.has(path); }

/** Whole-module G520 deletions leave no host to receive a pending-user credit.
 * Keep the shared WIP ledger untouched. @param {string} path */
export function retiredPlatformModule(path) {
  return path === 'src/engine/models/glbNodes.ts' || path === 'src/game/shardfile/buildingAssembly.ts';
}

/** A canonical output census can omit an audited host's owning shard.
 * Preserve its owner without indexing a shard outside this measurement.
 * @template {{path:string,lines:number,name?:string}} T
 * @param {Map<string,T[]>} charges @param {string|undefined} owner
 * @param {T} row @param {(line:string)=>void} [report] */
export function recordPrivateCharge(charges, owner, row, report = console.error) {
  const reviewed = platformChargeback(row.path, row.name) !== null;
  const shard = reviewed ? reviewedOwner(row.path, row.name) : owner;
  const target = charges.get(shard ?? '');
  if (target === undefined) {
    report(`shard-platform: skip ${row.path}${row.name === undefined ? '' : `#${row.name}`}: ${row.lines} lines owned by ${shard ?? 'no user'}, outside measured shards`);
    return false;
  }
  target.push(row);
  return true;
}

/** Reconcile broad import reach with the audited, actual row consumers.
 * @param {Map<string,Set<string>>} moduleUsers
 * @param {Map<string,Set<string>>} bindingUsers */
export function chargePlatformUsers(moduleUsers, bindingUsers) {
  for (const [path, names] of chapterViewNativeOwners) {
    if (names === null) { if (moduleUsers.has(path)) moduleUsers.set(path, new Set(['nalati-grasslands'])); }
    else for (const name of names) { const key = `${path}\0${name}`; if (bindingUsers.has(key)) bindingUsers.set(key, new Set(['nalati-grasslands'])); }
  }
  for (const path of modules.keys()) if (moduleUsers.has(path)) {
    const shard = reviewedOwner(path);
    moduleUsers.set(path, new Set([shard]));
  }
  for (const [path, names] of declarations) for (const name of names.keys()) {
    const key = `${path}\0${name}`;
    if (bindingUsers.has(key)) bindingUsers.set(key, new Set([reviewedOwner(path, name)]));
  }
}
