// W1-M0: roles attribute existing G291/G294 contributions, never change their size.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync } from 'vite';

/** One milestone roster drives component collection and every report. */
export const SHARD_WAVES = [
  { id:'W1',status:'closed at 90/10',current:false,shards:[{slug:'far-reach',name:'Sky'},{slug:'sunscar-dunes',name:'Signal'}] },
  { id:'W2',status:'current',current:true,shards:[{slug:'pine-hollow',name:'Pine'},{slug:'driftwood-isle',name:'Driftwood'}] },
];
const waveRow = id => { const row=SHARD_WAVES.find(wave=>wave.id===id);if(row===undefined)throw new Error(`Unknown shard wave ${id}`);return row; };
export const W1_SHARDS = waveRow('W1').shards.map(row=>row.slug);
export const COMPONENT_SHARDS = SHARD_WAVES.flatMap(wave=>wave.shards.map(row=>row.slug));
const currentWave = () => { const row=SHARD_WAVES.find(wave=>wave.current);if(row===undefined)throw new Error('No current shard wave');return row; };
export const COMPONENTS = {
  C1: 'Static world', C2: 'Looks', C3: 'Effects', C4: 'Creatures',
  C5: 'NPCs and quests', C6: 'Items and combat', C7: 'Movers',
  C8: 'Audio', C9: 'Boot glue',
};
// Ordered semantic roles apply to owner APIs, declarations and imported bindings.
// File roles supply a baseline; explicit owner declarations/calls split mixed code.
const roles = [
  ['C3', /fireFx|gustFx|windFx|windLook|WIND_FIELDS|WIND_LOOKS|UPDRAFT_AXIS|wakeRibbon|discLayer|heroStoneDiscs|GUST_FX|RAY_WAKE/iu],
  ['C5', /quest|bindDirectorActions|signalStages|PivotNpc|NpcSurface|NpcLevel|scout|sefa|keeper|turnVanes|vaneFlag|QUEST|LATER_FLAGS|PAID_FLAG|SCOUT_FLAG|COMPLETE_FLAG/iu],
  ['C7', /mover|updraft|SocketLift|isletCalls|IsletCalls|RisingIslet|RISING_ISLETS|winch|commandSocketLift/iu],
  ['C6', /weapon|lash|whip|fan|strike|swings|cracks|worldCommands|heavy|released|bindRuntimeItemContexts|item/iu],
  ['C4', /species|creature|Animal|flock|brain|bossStages|undrawnRig|matriarch|stormRoc|rocBrain|bossOwner|BossView|SkySpecs|SKY_HOMES|GOAT_|\bray\b|skitterer|strider|setHome|bindPlayerPush|homes|encounter/iu],
  ['C8', /audio|cues|voices|score/iu],
  ['C2', /look|Glsl|shader|Material|scarfed|dusk|light|fog|paint|texture|SKY_SUN|SAND|SKIRT|Atmosphere|stormWeather/iu],
  ['C1', /terrain|ground|worldBuild|buildWorld|bakedWorld|BakedTerrain|meadow|mesh|geometry|collider|props|Primitives/iu],
];
// W2 reviewed ownership: native animal keepers are creature managers, not quest NPCs.
const creatureOwners=new Set([
  'src/shards/pine-hollow/runtime/nightDirector.ts',
  'src/shards/pine-hollow/runtime/elites.ts',
  'src/shards/pine-hollow/combat/eliteRoster.ts',
  'src/shards/pine-hollow/combat/eliteScripts.ts',
  'src/shards/pine-hollow/runtime/kingPoseKeeper.ts',
  'src/shards/pine-hollow/runtime/kingQueryPose.ts',
  'src/shards/pine-hollow/runtime/kingQueryView.ts',
  'src/shards/pine-hollow/runtime/roster.ts',
  'src/shards/pine-hollow/runtime/fauna.ts',
  'src/shards/driftwood-isle/runtime/keeper.ts',
  'src/shards/driftwood-isle/runtime/fauna.ts',
  'src/shards/pine-hollow/runtime/herds.ts',
  'src/shards/driftwood-isle/runtime/ecology.ts',
  'src/shards/driftwood-isle/runtime/captain.ts',
  'src/shards/pine-hollow/runtime/KingGoals.ts',
  'src/shards/pine-hollow/runtime/antlerKing.ts',
  'src/shards/pine-hollow/runtime/king.ts',
  'src/shards/pine-hollow/runtime/elitePrelude.ts',
  'src/shards/pine-hollow/runtime/nightPopulation.ts',
  'src/shards/pine-hollow/combat/kingFight.ts',
  'src/shards/pine-hollow/combat/kingTiming.ts',
  'src/shards/driftwood-isle/runtime/placement.ts',
  'src/shards/driftwood-isle/combat/captain.ts',
]);
const questOwners=new Set([
  'src/shards/driftwood-isle/runtime/director.ts',
  'src/sdk/runtime/prompts.ts',
  'src/shards/pine-hollow/runtime/facts.ts',
  'src/shards/pine-hollow/runtime/people.ts',
  'src/shards/pine-hollow/runtime/lodge.ts',
  'src/shards/pine-hollow/runtime/trader.ts',
  'src/shards/pine-hollow/runtime/questLifetime.ts',
  'src/shards/driftwood-isle/runtime/reward.ts',
  'src/shards/pine-hollow/runtime/dialogue.ts',
  'src/shards/pine-hollow/runtime/directorClock.ts',
  'src/shards/pine-hollow/runtime/pack.ts',
  'src/shards/pine-hollow/runtime/npc/standInPerson.ts',
  'src/shards/driftwood-isle/runtime/pack.ts',
  'src/shards/driftwood-isle/runtime/kills.ts',
  'src/shards/driftwood-isle/npc/Castaway.ts',
  'src/shards/driftwood-isle/npc/Trader.ts',
  'src/shards/driftwood-isle/npc/faceHeads.ts',
  'src/game/systems/npc/npcRig.ts',
  'src/game/complete/ShardComplete.ts',
]);
// Reviewed W2 baseline owners. Exact paths/exports only; mixed AST ownership below still applies.
const reviewedW2Owners = new Map([
  // Static scene geometry, placements, building assembly and their bake contracts.
  ['src/engine/sim/shore.ts#SHORE_REVETMENT_INNER_FACE', 'C1'],
  ['src/game/shardfile/bakedKinds.ts#loadBakedKinds', 'C1'],
  ['src/sdk/kit/mergedPrimitives.ts', 'C1'],
  ['src/shards/driftwood-isle/assets/contracts/shrine.ts', 'C1'],
  ['src/shards/driftwood-isle/assets/contracts/wreck.ts', 'C1'],
  ['src/shards/driftwood-isle/runtime/kit/kitParts.ts', 'C1'],
  ['src/shards/driftwood-isle/runtime/props/mooringLines.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/cull/batchedLod.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/kit/caveInterior.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/kit/glbNodes.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/kit/lodGlb.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/kit/primitiveParts.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/props/bakedBuilding.ts', 'C1'],
  ['src/shards/pine-hollow/runtime/props/buildingLife.ts', 'C3'],
  // Door and wheel motion within the mixed light/mover building host.
  ...['BuildingDoor', 'BuildingSwing', 'doorPieces', 'barDoor', 'onDoor', '_doorUse', '_door', '_swing', '_wheel'].map(name => [`src/shards/pine-hollow/runtime/props/buildingLife.ts#${name}`, 'C7']),
  // Material/rig look decoding and authored appearance rows.
  ['src/sdk/bake/rig.ts', 'C2'],
  ['src/shards/pine-hollow/runtime/props/cabinBuild.ts', 'C2'],
  // Weather and visual fight effects.
  ['src/shards/pine-hollow/combat/fxKit.ts', 'C3'],
  ['src/shards/pine-hollow/runtime/air.ts', 'C3'],
  // Animal/boss goals, bodies, pose and ambient wildlife.
  ['src/engine/entities/lowpoly.ts#crestSpikes', 'C4'],
  ['src/sdk/phasedBoss.ts#RoamingBossRow', 'C4'],
  ['src/shards/driftwood-isle/runtime/posedVolumes.ts', 'C4'],
  ['src/shards/pine-hollow/combat/combatMath.ts', 'C4'],
  ['src/shards/pine-hollow/combat/ctx.ts', 'C4'],
  ['src/shards/pine-hollow/combat/eliteStreams.ts', 'C4'],
  ['src/shards/pine-hollow/combat/elites.ts', 'C4'],
  ['src/shards/pine-hollow/combat/kingRig.ts', 'C4'],
  ['src/shards/pine-hollow/combat/lane.ts', 'C4'],
  ['src/shards/pine-hollow/combat/spawns.ts', 'C4'],
  ['src/shards/pine-hollow/combat/strikes.ts', 'C4'],
  ['src/shards/pine-hollow/life/birdFix.ts', 'C4'],
  ['src/shards/pine-hollow/life/birdModels.ts', 'C4'],
  ['src/shards/pine-hollow/life/index.ts', 'C4'],
  ['src/shards/pine-hollow/life/lifeMath.ts', 'C4'],
  ['src/shards/pine-hollow/life/trunks.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/kingCollision.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/kingCollisionBake.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/kingPoseHost.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/kit/hullSpots.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/rainShelter.ts', 'C4'],
  // Journal, onboarding, discovery and quest presentation.
  ['src/sdk/interactions.ts#interactionRules', 'C5'],
  ['src/shards/driftwood-isle/onboarding/firstMinutes.ts', 'C5'],
  ['src/shards/driftwood-isle/runtime/finalePresentation.ts', 'C5'],
  ['src/shards/pine-hollow/compendium.ts', 'C5'],
  ['src/shards/pine-hollow/compendium/install.ts', 'C5'],
  ['src/shards/pine-hollow/runtime/compendium/trophyWall.ts', 'C1'],
  // Equipment, combat feel, held viewmodels, loot and owned rewards.
  ['src/engine/combat/ammo.ts', 'C6'],
  ['src/engine/combat/view/ranged.ts#edgeWear', 'C6'],
  ['src/engine/combat/view/ranged.ts#makeBoltAtlas', 'C6'],
  ['src/engine/combat/view/ranged.ts#makeCord', 'C6'],
  ['src/engine/combat/view/rangedFeel.ts', 'C6'],
  ['src/engine/player/Skins.ts#STATE', 'C6'],
  ['src/engine/player/Skins.ts#SkinState', 'C6'],
  ['src/engine/player/Skins.ts#applySkin', 'C6'],
  ['src/engine/player/Skins.ts#clearSkin', 'C6'],
  ['src/engine/player/Skins.ts#cloneWith', 'C6'],
  ['src/engine/player/Skins.ts#white', 'C6'],
  ['src/engine/player/Skins.ts#whiteTex', 'C6'],
  ['src/game/loot/tables.ts#registerLootTable', 'C6'],
  ['src/game/shard/retainedHooks.ts#installRetainedPlayerEffects', 'C6'],
  ['src/game/shard/retainedHooks.ts#playerBindings', 'C6'],
  ['src/game/systems/viewmodel/armClips.ts#SWIM_CLIPS', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#CLIP', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#RigArms', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#RigMeta', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#RigState', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#VmFrame', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#isMesh', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#parsed', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#rigScene', 'C6'],
  ['src/game/systems/viewmodel/rigArms.ts#swordArmsOf', 'C6'],
  ['src/sdk/runtime/effects.ts', 'C6'],
  ['src/shards/driftwood-isle/combat/strikes.ts', 'C6'],
  ['src/shards/driftwood-isle/fpArms.ts', 'C6'],
  ['src/shards/driftwood-isle/loadout/rows.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/effects.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/finds.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/keepsakes.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/perks.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/presentation.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/shop.ts', 'C6'],
  ['src/shards/driftwood-isle/loot/tables.ts', 'C6'],
  ['src/shards/driftwood-isle/runtime/loadout.ts', 'C6'],
  ['src/shards/driftwood-isle/runtime/swords.ts', 'C6'],
  ['src/shards/driftwood-isle/runtime/viewmodel/toonArms.ts', 'C6'],
  ['src/shards/pine-hollow/combat/chargeTells.ts', 'C6'],
  ['src/shards/pine-hollow/combat/install.ts', 'C4'],
  ['src/shards/pine-hollow/loadout/ammo.ts', 'C6'],
  ['src/shards/pine-hollow/loadout/effects.ts', 'C6'],
  ['src/shards/pine-hollow/loadout/events.ts', 'C6'],
  ['src/shards/pine-hollow/loadout/finishes.ts', 'C6'],
  ['src/shards/pine-hollow/loadout/loadout.ts', 'C6'],
  ['src/shards/pine-hollow/loadout/skins.ts', 'C6'],
  ['src/shards/pine-hollow/runtime/combatService.ts', 'C6'],
  ['src/shards/pine-hollow/runtime/kingLifetime.ts', 'C4'],
  ['src/shards/pine-hollow/runtime/kit/heldTool.ts', 'C6'],
  ['src/shards/pine-hollow/runtime/rangedVolumes.ts', 'C6'],
  ['src/shards/pine-hollow/runtime/viewmodel/gloveHands.ts', 'C6'],
  ['src/shards/pine-hollow/runtime/viewmodel/staveBow.ts', 'C6'],
  // Loading, continuation parsing, lifecycle plumbing, instrumentation and localization.
  ['src/engine/core/assets.ts#gltfLoader', 'C9'],
  ['src/engine/core/assets.ts#loadGLTF', 'C9'],
  ['src/engine/script/host.ts#preparationWait', 'C9'],
  ['src/engine/script/host.ts#preparingOwners', 'C9'],
  ['src/engine/script/host.ts#requirePreparationOwner', 'C9'],
  ['src/engine/script/host.ts#withPreparedScriptMemories', 'C9'],
  ['src/game/plugin/context.ts#buildProgress', 'C9'],
  ['src/game/shard/retainedHooks.ts#installEnteredRuntimeAttachment', 'C9'],
  ['src/game/shard/retainedHooks.ts#installEnteredRuntimeObserver', 'C9'],
  ['src/game/shard/retainedHooks.ts#installEnteredRuntimeUpdate', 'C9'],
  ['src/game/shard/runtimeVariant.ts#gridPage', 'C9'],
  ['src/shards/driftwood-isle/runtime/baked.ts', 'C9'],
  ['src/shards/driftwood-isle/strings.ts', 'C9'],
  ['src/shards/driftwood-isle/tiers.ts', 'C9'],
  ['src/shards/pine-hollow/debug/options.ts', 'C9'],
  ['src/shards/pine-hollow/dev/perfLap.ts', 'C9'],
  ['src/shards/pine-hollow/runtime/baked.ts', 'C9'],
  ['src/shards/pine-hollow/runtime/landmarkLifetime.ts', 'C9'],
  ['src/shards/pine-hollow/strings.ts', 'C9'],
]);
function namedRole(name,path='') {
  const reviewed = reviewedW2Owners.get(`${path}#${name}`); if (reviewed !== undefined) return reviewed;
  if(creatureOwners.has(path)&&/keeper/iu.test(name))return 'C4'; return roles.find(([, pattern]) => pattern.test(name))?.[0] ?? null; }
/** Explicit file ownership; an unrecognised file stays visible and cannot close C9. */
function fileRole(path, name = '') {
  const reviewed = reviewedW2Owners.get(name ? `${path}#${name}` : path) ?? reviewedW2Owners.get(path);
  if (reviewed !== undefined) return reviewed;
  if (path === 'src/engine/world/waves.ts' && name === 'GERSTNER_TERMS') return 'C2';
  if (['src/format/materialGraph.ts', 'src/game/shardfile/clientMaterials.ts', 'src/game/shardfile/clientGraphs.ts'].includes(path)) return 'C2';
  if (path === 'src/shards/driftwood-isle/runtime/hybrid.ts' || path === 'src/game/shardfile/hybrid.ts') return 'C9';
  if(creatureOwners.has(path))return 'C4';
  if(questOwners.has(path))return 'C5';
  if(path==='src/shards/driftwood-isle/combat/coconuts.ts')return 'C6';
  if(path==='src/engine/world/interact/flags.ts'&&name==='bindInteractionState')return 'C5';
  if (path === 'src/game/plugin/ui.ts' && ['WorldSceneBoundParts', 'bindWorldSceneParts'].includes(name)) return 'C1';
  if (path === 'src/game/plugin/ui.ts' && ['moverChannelValues', 'moverChannelView', 'moverChannelViews', 'moverChannelPrompts'].includes(name)) return 'C7';
  if (path === 'src/sdk/questGraph.ts' && name === 'parseNpcRow') return 'C5';
  if (path === 'src/sdk/bake/texture.ts') return 'C2';
  if (name && /PivotNpc|NpcSurface|NpcLevel/iu.test(name)) return 'C5';
  if (name && /SocketLift|Updraft/iu.test(name)) return 'C7';
  if (name && /bindRuntimeItemContexts/iu.test(name)) return 'C6';
  if (/fireFx|windFx|wakeRibbon|discLayer|skyCardsLook|cardField/iu.test(path)) return 'C3';
  if (/\/(?:quest|quests)\/|\/runtime\/quest\.ts$/u.test(path)) return 'C5';
  if (/\/(?:species|creatures)\/|brain|flock|\/ai\/|(?:models|combat)\/(?:creatures|matriarch|stormRoc)/iu.test(path)) return 'C4';
  if (/\/(?:weapons|items)\/|\/items\.ts$|lash|fan|\/models\/gear|weaponFamily/iu.test(path)) return 'C6';
  if (/mover|entries\.ts$|islets?\.ts$|risingIslet|isletLift|updraft/iu.test(path)) return 'C7';
  if (/audio|cues|voices/iu.test(path)) return 'C8';
  if (/\/look[s]?\/|Look|Glsl|\/render\/|Atmosphere|materialPreparation/iu.test(path)) return 'C2';
  if (/\/world\/|\/models\/|\/layout\.ts$|\/plugin\/geometry\.ts$/u.test(path)) return 'C1';
  if (/\/(?:boot|explore|thumbs)\/|\/(?:manifest|plugin|roster|budgets|budgetCeilings|shard\.config)\.ts$|\/runtime\/(?:index|headless|signalPlan|standalone|source|persistence)\.ts$|\/runtime\/shardfile\/markedBoss\.ts$|\/plugin\/(?:headless|simulation)\.ts$|\/game\/saves\.ts$/u.test(path)) return 'C9';
  return null;
}
const children = node => Object.values(node).flatMap(value => Array.isArray(value) ? value.filter(item => item?.type) : value?.type ? [value] : []);
const nodeName = node => node?.name ?? (typeof node?.value === 'string' ? node.value : '');
const calledName = node => node?.type === 'MemberExpression' ? nodeName(node.property) : nodeName(node);
function runtimeTags(source, path, fallback) {
  const parsed = parseSync(path, source), starts = [0];
  let blanked = '', cursor = 0;
  for (const comment of parsed.comments) { blanked += source.slice(cursor, comment.start) + source.slice(comment.start, comment.end).replaceAll(/[^\n]/gu, ' '); cursor = comment.end; }
  blanked += source.slice(cursor);
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  const tags = blanked.split('\n').map((line, index) => line.trim() ? { line:index + 1, component:fallback, priority:0, reason:'file owner' } : null);
  const lineOf = offset => { let low=0, high=starts.length-1; while(low<high){const mid=(low+high+1)>>1;if(starts[mid]<=offset)low=mid;else high=mid-1;}return low; };
  const assign = (node, component, priority, reason) => {
    if (!component) return;
    const owner = fallback === 'C3' && (component === 'C1' || component === 'C2') ? 'C3' : component;
    for (let i=lineOf(node.start);i<=lineOf(Math.max(node.start,node.end-1));i++) {
      const row=tags[i]; if(row && priority>row.priority){row.component=owner;row.priority=priority;row.reason=reason;}
    }
  };
  const imports = new Map();
  for (const node of parsed.program.body) if(node.type==='ImportDeclaration') {
    const from=fileRole(node.source.value);
    for(const spec of node.specifiers) {
      // Shared cable construction is quest binding or static rest geometry, not a private mover law.
      const cable = ['ZiplineDriver', 'CableLayout', 'ZiplineSpec', 'ZiplineRideState'].includes(spec.local.name)
        && node.source.value === '@wildshard/sdk/movers';
      const bindingOwner = path === 'src/shards/driftwood-isle/models/zipline.ts' ? 'C1'
        : ['src/shards/pine-hollow/quest/rides.ts', 'src/shards/pine-hollow/runtime/quest.ts',
          'src/shards/driftwood-isle/runtime/quest.ts', 'src/shards/driftwood-isle/world/Zipline.ts'].includes(path) ? 'C5' : null;
      const admittedBoot = path === 'src/shards/driftwood-isle/shard.config.ts' && node.source.value === './data/movers';
      const owner = admittedBoot ? 'C9' : cable && bindingOwner !== null ? bindingOwner : namedRole(spec.local.name,path) ?? from;
      imports.set(spec.local.name, owner);
    }
    assign(node, node.specifiers.map(spec=>imports.get(spec.local.name)).find(Boolean),1,`import ${node.source.value}`);
  }
  const methods = { arm:'C6',armed:'C6',dress:'C6',enter:'C6',witnessed:'C4',ray:'C4',stage:'C5',build:'C1' };
  const visit=(node,depth)=>{
    let role=null, reason='';
    if(node.type==='VariableDeclarator'||node.type==='FunctionDeclaration') {
      const name=nodeName(node.id);role=(node.init?.type==='CallExpression' ? imports.get(calledName(node.init.callee)) ?? namedRole(calledName(node.init.callee),path) : null) ?? namedRole(name,path);reason=`declaration ${name}`;
    } else if(node.type==='MethodDefinition') { const name=nodeName(node.key);role=(Object.hasOwn(methods,name)?methods[name]:null)??namedRole(name,path);reason=`method ${name}`;
    } else if(node.type==='Property'||node.type==='PropertyDefinition') {
      const name=nodeName(node.key);role=namedRole(name,path);reason=`property ${name}`;
      // A world's winch prompt and its anchor are quest interaction handles,
      // distinct from the kinematic mover command/pose owners.
      if (path === 'src/shards/driftwood-isle/shard.config.ts' && name === 'movers') role='C9';
      if (path.endsWith('/world/build.ts') && ['winch', 'winchAt'].includes(name)) role='C5';
    } else if(node.type==='CallExpression'||node.type==='NewExpression') {
      const name=calledName(node.callee);role=imports.get(name)??namedRole(name,path);reason=`owner API ${name}`;
    }
    assign(node,role,2+depth,reason);
    for(const child of children(node))visit(child,depth+1);
  };
  visit(parsed.program,0);
  return tags.filter(row=>row!==null);
}
/** Attribute each canonical contribution exactly once; ranges retain physical TS lines for auditing.
 * @param {string} root @param {string} shard @param {import('./shard-platform.mjs').CustomSource[]} sources
 * @param {number} canonical @returns {import('./shard-components.mjs').ComponentInventory} */
export function componentInventory(root, shard, sources, canonical) {
  const counts=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,0])), unknown=[], spans=[];
  for(const row of sources) {
    const role=fileRole(row.path,row.name);
    if(role===null)unknown.push(`${row.path}${row.name?`#${row.name}`:''}`);
    const owner=role??'C9';
    if(row.kind==='runtime-ts'||row.kind==='sole-module') {
      const tags=runtimeTags(readFileSync(resolve(root,row.path),'utf8'),row.path,owner);
      if(tags.length!==row.lines)throw new Error(`Component line mismatch: ${row.path} ${tags.length}/${row.lines}`);
      for(const tag of tags) {
        counts[tag.component]++;
        const last=spans.at(-1);
        if(last && last.path===row.path && last.kind===row.kind && last.component===tag.component && last.end===tag.line-1 && last.reason===tag.reason){last.end=tag.line;last.lines++;}
        else spans.push({path:row.path,kind:row.kind,component:tag.component,start:tag.line,end:tag.line,lines:1,reason:tag.reason});
      }
    } else {
      // Additional GLSL is the canonical shader unit; sole exports already have deduplicated declaration spans.
      const component=row.kind==='additional-glsl'?(owner==='C3'?'C3':'C2'):namedRole(row.name??'',row.path)??owner;
      counts[component]+=row.lines;
      spans.push({path:row.path,kind:row.kind,component,lines:row.lines,reason:row.name?`G294 declaration ${row.name}`:'additional GLSL owner'});
    }
  }
  const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
  if(total!==canonical)throw new Error(`${shard}: component total ${total} differs from canonical ${canonical}`);
  return {shard,counts,total,unknown,spans};
}
/** A component closes only when its wave has known canonical inventories with zero left. */
export function componentWave(rows, id=currentWave().id) {
  const wave=waveRow(id),slugs=wave.shards.map(row=>row.slug),shards=slugs.map(shard=>rows[shard]?.components);
  const complete=shards.every(row=>row!==undefined && row.unknown.length===0);
  const components=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,{closed:complete && shards.every(row=>row.counts[key]===0),
    lines:Object.fromEntries(slugs.map((slug,i)=>[slug,shards[i]?.counts[key]??null]))}]));
  return {id:wave.id,status:wave.status,current:wave.current,shards:slugs,names:Object.fromEntries(wave.shards.map(row=>[row.slug,row.name])),
    unknown:Object.fromEntries(slugs.map((slug,i)=>[slug,shards[i]?.unknown??null])),
    closed:Object.values(components).filter(row=>row.closed).length,total:Object.keys(COMPONENTS).length,components};
}
/** @param {Record<string,{components?:import('./shard-components.mjs').ComponentInventory}>} rows */
export function componentMarkdown(rows) {
  const lines=[];
  for(const milestone of SHARD_WAVES.toSorted((a,b)=>Number(b.current)-Number(a.current))){
    const wave=componentWave(rows,milestone.id);
    lines.push('',`## ${wave.id} (${wave.status}) component checklist`,'',
      `Components closed ${wave.closed} of ${wave.total}. Unknown ownership never counts closed.`,
      'Nine disjoint totals reconcile to canonical custom lines. Mixed TS uses AST declarations and owner calls;',
      'each code line has one owner. Extra GLSL belongs to its look/effect owner.','',
      `| Component | ${wave.shards.map(slug=>`${wave.names[slug]} lines`).join(' | ')} | Closed across both |`,
      `|---|${wave.shards.map(()=>'---:').join('|')}|---|`,
      ...Object.entries(wave.components).map(([key,row])=>`| ${key} ${COMPONENTS[key]} | ${wave.shards.map(slug=>row.lines[slug]??'unavailable').join(' | ')} | ${row.closed?'yes':'no'} |`),
      `| Total | ${wave.shards.map(slug=>rows[slug]?.components?.total??'unavailable').join(' | ')} | |`,'','### Custom contribution owners','',
      '| Shard | Source | Unit / span | Component | Lines | Owner rule |','|---|---|---|---|---:|---|');
    for(const slug of wave.shards){const report=rows[slug]?.components;if(!report)continue;
      for(const span of report.spans)lines.push(`| ${slug} | ${span.path} | ${span.kind}${span.start===undefined?'':`:${span.start}-${span.end}`} | ${span.component} | ${span.lines} | ${span.reason} |`);
      for(const path of report.unknown)lines.push(`Unknown owner: ${path}`);
    }
  }
  return lines;
}
