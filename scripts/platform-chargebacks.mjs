// G520 / G496: fixture-only growth is still shard code. This is the cut list,
// not an allowance or a budget. A real second shard needs a reviewed re-score.
/** @type {Map<string,import('./shard-components.mjs').Component>} */
const modules = new Map([
  ...['game/boss/arenaScript', 'game/boss/arenaField', 'game/boss/encounterPatrol',
    'game/population/creatureGuest', 'game/population/creatureFrame',
    'format/creatureGuest', 'format/creatureFrame'].map(path => [`src/${path}.ts`, 'C4']),
  ...['game/riding/mountedFigure', 'game/riding/pastureView'].map(path => [`src/${path}.ts`, 'C7']),
  ['src/game/systems/viewmodel/graphArms.ts', 'C6'],
]);
/** @type {Map<string,Map<string,import('./shard-components.mjs').Component>>} */
const declarations = new Map([
  ['src/game/plugin/bossPhase.ts', new Map([['ArenaBossScript', 'C4']])],
  ['src/format/bossProfiles.ts', new Map([['ArenaScriptBossProfileSchema', 'C4'], ['ArenaScriptBossProfile', 'C4']])],
  ['src/game/population/pageGroups.ts', new Map([
    'Placement', 'Counts', 'point', 'whole', 'PageActorGroups', 'PagePopulationPlanner',
    'nearestPopulationActor', 'PageWildEnvironment', 'wildEnv', 'bindPageGroups',
    'renderedPacks', 'renderedHerds', 'renderedDamage', 'renderedPackOf',
    'renderedHerdOf', 'observeHerdDamage', 'PageGroups',
  ].map(name => [name, 'C4']))],
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
  ['src/game/shardfile/worldScenes.ts', new Map([['WorldSceneTierPools', 'C1'], ['WorldScenePoolPublications', 'C1']])],
  ['src/format/worldScenes.ts', new Map([['WorldSceneTierPools', 'C1'], ['WorldScenePoolPublications', 'C1']])],
]);

// Nine-only branches inside otherwise shared declarations. These spans select
// code lines, never fixed credits; packet/instance-matrix handling stays shared.
/** @type {Map<string,Map<string,[string,number][]>>} */
const inline = new Map([
  ['src/game/shardfile/worldScenes.ts', new Map([
    ['WorldSceneTierPools', [
      ['geometryPools: row.files.map(file =>', 1],
      ['async url => { const file = [...row.files.map(entry => tierFile(entry.file))', 1],
    ]],
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
]);

/** @param {string} path */
function nineOwner(path) { return path.endsWith('/worldScenes.ts') || path === 'src/game/systems/viewmodel/graphArms.ts'; }

/** @param {string} path @param {string} source @param {(line:string)=>void} [report]
 * @returns {{name:string,lines:number[]}[]} */
export function inlinePlatformSpans(path, source, report = console.error) {
  const rows = [], lines = source.split('\n'), claimed = new Set();
  for (const [name, blocks] of inline.get(path) ?? []) {
    const selected = [];
    for (const [needle, length] of blocks) {
      const matches = lines.flatMap((line, index) => line.includes(needle) ? [index] : []);
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
  const shard = reviewed ? nineOwner(row.path) ? 'nine-dragon-stack' : 'nalati-grasslands' : owner;
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
  for (const path of modules.keys()) if (moduleUsers.has(path)) {
    const shard = nineOwner(path) ? 'nine-dragon-stack' : 'nalati-grasslands';
    moduleUsers.set(path, new Set([shard]));
  }
  for (const [path, names] of declarations) for (const name of names.keys()) {
    const key = `${path}\0${name}`;
    if (bindingUsers.has(key)) bindingUsers.set(key, new Set([nineOwner(path) ? 'nine-dragon-stack' : 'nalati-grasslands']));
  }
}
