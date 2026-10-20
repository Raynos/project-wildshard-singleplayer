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
]);

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

/** Reconcile broad import reach with the audited, actual row consumers.
 * @param {Map<string,Set<string>>} moduleUsers
 * @param {Map<string,Set<string>>} bindingUsers */
export function chargePlatformUsers(moduleUsers, bindingUsers) {
  for (const path of modules.keys()) if (moduleUsers.has(path)) {
    const shard = path === 'src/game/systems/viewmodel/graphArms.ts' ? 'nine-dragon-stack' : 'nalati-grasslands';
    moduleUsers.set(path, new Set([shard]));
  }
  for (const [path, names] of declarations) for (const name of names.keys()) {
    const key = `${path}\0${name}`;
    if (bindingUsers.has(key)) bindingUsers.set(key, new Set(['nalati-grasslands']));
  }
}
