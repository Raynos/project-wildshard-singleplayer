// G450 §5: output sections supply the defining host exports as G294 roots.
// This is a census table, not a runtime installer. No authoring import supplies
// a runtime user. Metadata-only sections have no independent executable host.
const hosts = {
  'explore/catalogue': ['game/models/explorerCatalogue#explorerRoster'],
  'look/rigged-hulls': ['sdk/looks/riggedHulls#productRiggedHulls'],
  'look/hull-book': ['game/looks/speciesBook#productHullBook'],
  'look/painted': ['game/looks/paintedLook#productPaintedLook'],
  'look/colour-functions': ['engine/render/graph/colourFunction#materialColourGraph'],
  'look/toon': ['game/looks/toonLook#toonLook'],
  'client/plan': ['game/shardfile/clientPlan#installClientPhase', 'game/shard/declaredEntry#declaredRuntimeEntry'],
  'world/tiles': ['game/shardfile/clientViews#clientTileViews'],
  'world/terrain': ['game/shardfile/clientGround#clientGround'],
  'world/edge': ['game/shardfile/portalTraversal#createPortalTraversal'],
  'world/collision': ['game/shardfile/collisionBindings#installShardfileColliders'],
  'world/navigation': ['game/shardfile/productNavigation#installProductNavigation'],
  'world/props': ['game/shardfile/props#propColliderDescriptors'],
  'world/water': ['game/shardfile/clientWater#installClientWater', 'game/shardfile/water#shardfileWater'],
  'world/movers': ['game/plugin/mover#installDeclaredMovers'],
  'world/traversal': ['game/shardfile/portalTraversal#createPortalTraversal'],
  'world/spawn': [], // Level admission metadata.
  'world/physics': [], // Handed to the runtime's explicitly imported native host.
  'world/days': ['game/shard/declaredRows#declaredDay'],
  'world/weather': ['game/shard/declaredRows#declaredWeather'],
  'look/look': ['game/shardfile/look#shardfileLook'],
  'look/map': ['game/shardfile/mapImage#reserveMapImage'],
  'look/materials': ['game/shardfile/clientMaterials#clientMaterials'],
  'look/keyed-sky': ['game/looks/keyedSky#keyedSkyBackdrop'],
  'actors/spawn-scripts': ['game/population/spawnScript#SpawnScript', 'format/spawnScripts#parseSpawnScript'],
  'player/stealth': ['game/stealth/controller#StealthController', 'format/stealth#StealthRowsSchema'],
  'actors/return-scripts': ['game/population/returnProgram#ReturnProgram', 'format/decisionScripts#parseDecisionScripts'],
  'actors/moves': ['engine/ai/moves#ActorMoveRunner', 'format/actorMoves#parseActorMoves'],
  'actors/creatures': ['game/shardfile/brainRuntime#installDeclaredBrains'],
  'actors/crowds': ['game/shardfile/crowdRuntime#prepareDeclaredCrowds'],
  'actors/npcs': ['game/plugin/simulation#installDeclaredQuestHost'],
  'actors/species': ['game/plugin/brain#speciesResolver', 'game/shardfile/clientRecipes#clientSpeciesLooks'],
  'actors/spawns': ['game/shardfile/brainRuntime#installDeclaredBrains'],
  'actors/strikes': [], // Consumed by the runtime's explicitly imported creature host.
  'actors/species-programs': [], // Metadata lent to existing page/native species and hunt owners.
  'held/arms': ['game/loadout/claims#HeldClaims', 'game/systems/viewmodel/toonArms#ToonArms'],
  'held/equipment': ['game/plugin/heldEquipment#HeldEquipment'],
  'held/loadout': ['game/loadout/held#installHeldLoadout', 'game/loadout/nativeAmmunition#NativeHeldAmmunition'],
  'held/finishes': ['game/loadout/finishes#HeldFinishes'],
  'held/gear': ['game/models/heldGear#heldGear'],
  'combat/items': ['game/shardfile/items#installDeclaredItems'],
  'combat/encounters': ['game/plugin/simulation#createShardfileSim'],
  'combat/strikes': ['game/plugin/simulation#createShardfileSim'],
  'quests/quests': ['game/quest/declared#DeclaredQuests'],
  'quests/host': ['game/plugin/simulation#installDeclaredQuestHost'],
  'quests/directors': ['game/shardfile/directorClient#installDeclaredDirector'],
  'economy/ledger': ['game/ledger#Ledger', 'game/ledger#installLedgerEmitter'],
  'economy/loot': ['game/shard/declaredRows#declaredLootPresentation'],
  'state/state': ['game/shardfile/scripts#numericScriptState'],
  'state/migrations': ['game/shardfile/logicalState#logicalStateFromLane'],
  'state/modes': ['engine/player/modes#playerModes'],
  'sim/runtime-plan': ['game/shardfile/nativePlan#prepareProductRuntimePlan'],
  'world/scenes': ['game/shardfile/worldScenes#installWorldScenes'],
  'world/targets': ['game/shardfile/worldTargets#WorldTargetHost'],
  'sim/scripts': ['engine/script/decision#DecisionHost', 'format/decisionScripts#parseDecisionScripts'],
  'sim/bodies': ['game/quest/bodyOps#DeclaredBodyOps', 'format/bodySlots#DeclaredBodyOpsSchema'],
  'sim/sim': ['game/shardfile/scripts#createShardfileScriptLane'],
  'sim/hooks': ['game/shardfile/scripts#createShardfileScriptLane'],
  'sim/client-scripts': ['game/shardfile/clientScripts#createShardfileClientScripts'],
  'sim/client-channels': ['game/plugin/ui#ClientScriptViews'],
  'sim/plumbing': ['game/shard/declaredPlumbing#installDeclaredPlumbing'],
  'audio/audio': ['engine/audio/declared#installDeclaredAudio'],
  'ui/card': [], // Discovery metadata; no per-shard executable implementation.
  'ui/level': [],
  'ui/ui': ['game/shard/declaredUi#mountDeclaredUi', 'game/shard/declaredTargets#installDeclaredTargets'],
  'ui/compendium': ['game/shard/declaredRows#declaredProductCompendium'],
  'ui/completion': ['game/complete/declared#installCompletion'],
  'ui/strings': [], // Read by an explicitly imported consumer, not executed.
};

/** A synthetic import list seeds named reach without becoming counted code.
 * Unknown platform sections refuse so a new host cannot disappear from G294.
 * @param {readonly {name:string}[]} sections @param {string} sourcePrefix */
export function sectionHostImports(sections, sourcePrefix = '../../src/') {
  const roots = new Set();
  for (const section of sections) {
    if (section.name.startsWith('custom/')) continue;
    if (!Object.hasOwn(hosts, section.name)) throw new Error(`No output host attribution: ${section.name}`);
    for (const host of hosts[section.name]) roots.add(host);
  }
  return [...roots].sort((a,b)=>a.localeCompare(b)).map((host, i) => {
    const [module, name] = host.split('#');
    return `import { ${name} as host${i} } from '${sourcePrefix}${module}'; void host${i};`;
  }).join('\n');
}
