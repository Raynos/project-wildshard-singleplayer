// W1-M0: roles attribute existing G291/G294 contributions, never change their size.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSync } from 'vite';
import { platformChargeback } from './platform-chargebacks.mjs';

/** One milestone roster drives component collection and every report. */
export const SHARD_WAVES = [
  { id:'W1',status:'current',current:true,shards:[{slug:'far-reach',name:'Sky'},{slug:'sunscar-dunes',name:'Signal'}] },
  { id:'W2',status:'next',current:false,shards:[{slug:'pine-hollow',name:'Pine'},{slug:'driftwood-isle',name:'Driftwood'}] },
  { id:'W3',status:'next',current:false,shards:[{slug:'nalati-grasslands',name:'Nalati'},{slug:'nine-dragon-stack',name:'Nine'}] },
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
const questOwners=new Set([
  'src/game/client/systems/npc/npcRig.ts',
  'src/game/client/complete/ShardComplete.ts',
]);
// Reviewed W2 baseline owners. Exact paths/exports only; mixed AST ownership below still applies.
const reviewedW2Owners = new Map([
  ['src/game/server/loot/tables.ts#readLootTables', 'C6'],
  ['src/format/lootEconomy.ts', 'C6'],
  ['src/game/shared/shard/declaredRows.ts#EconomyGrant', 'C6'],
  ['src/game/shared/shard/declaredRows.ts#DeclaredLootEconomy', 'C6'],
  ['src/game/shared/shard/declaredRows.ts#declaredLootEconomy', 'C6'],
  ['src/engine/client/models/ownedGeometry.ts', 'C1'],
  // Reviewed runtime tile views, lent looks, terrain admission and combat status.
  ['src/game/client/shardfile/runtimeProduct.ts#bindRuntimeProductProps', 'C1'],
  ['src/game/client/shardfile/hybridPresentation.ts#hybridPresentation', 'C2'],
  ['src/game/client/shardfile/runtimeProduct.ts#runtimePresentation', 'C2'],
  ['src/engine/shared/physics/bodies.ts#BodyLaunchRow', 'C6'],
  ['src/format/nativeItems.ts#BodyLaunchSchema', 'C6'],
  ['src/format/lootEconomy.ts#ClaimedPickupSchema', 'C6'],
  ['src/engine/client/combat/effects/EffectService.ts#playerBindings', 'C6'],
  ['src/engine/client/combat/effects/EffectService.ts#bindPlayerEffects', 'C6'],
  ['src/engine/shared/physics/terrain.ts#EDGE_WALL_INSET', 'C1'],
  ['src/engine/shared/physics/terrain.ts#isStandaloneEdgeWall', 'C1'],
  ['src/game/shared/bag/itemCatalog.ts#isItemId', 'C6'],
  ['src/game/client/plugin/ui.ts#STARTER_EFFECTS', 'C6'],
  ['src/game/client/plugin/ui.ts#StatusMovement', 'C6'],
  ['src/game/client/plugin/ui.ts#StarterContext', 'C6'],
  ['src/game/client/plugin/ui.ts#installStarterEffects', 'C6'],
  ['src/game/client/systems/effects/starter.generated.ts#STARTER_EFFECT_ROWS', 'C6'],
  ['src/game/client/systems/effects/view.ts#PATHS', 'C6'],
  ['src/game/client/systems/effects/view.ts#StatusIcons', 'C6'],
  // Graph look-material collection. The decoded texture loan is committed.
  ['src/game/client/plugin/shaderFamily.ts#lookGraphMaterials', 'C2'],
  ['src/game/client/plugin/shaderFamily.ts#SPLICER', 'C2'],
  ['src/game/client/plugin/shaderFamily.ts#spliceEdits', 'C2'],
  // Fixed authored site placement and metadata translation; actual sole-user charging is retained.
  ['src/engine/client/models/place.ts#ModelSiteLayout', 'C1'],
  ['src/engine/client/models/place.ts#ModelSite', 'C1'],
  ['src/engine/client/models/place.ts#placeModelSite', 'C1'],
  // Static scene geometry, placements, building assembly and their bake contracts.
  ['src/engine/shared/sim/shore.ts#SHORE_REVETMENT_INNER_FACE', 'C1'],
  ['src/game/client/shardfile/bakedKinds.ts#loadBakedKinds', 'C1'],
  ['src/engine/shared/physics/box.ts#FloorRect', 'C1'],
  ['src/game/client/shardfile/caveInterior.ts', 'C1'],
  // Material/rig look decoding and authored appearance rows.
  ['src/sdk/bake/rig.ts', 'C2'],
  // Weather and visual fight effects.
  // C3 review: private ambient orchestration and weather remain counted custom.
  ['src/game/client/weather/forest.ts', 'C3'],
  ...['src/game/server/weather/continuation.ts', 'src/game/server/weather/reactions.ts', 'src/game/client/shardfile/weatherFields.ts'].map(path => [path, 'C3']),
  // Animal/boss goals, bodies, pose and ambient wildlife.
  ['src/engine/client/entities/lowpoly.ts#crestSpikes', 'C4'],
  ['src/sdk/phasedBoss.ts#RoamingBossRow', 'C4'],
  ...['NativeCreaturePoseRecipe', 'NativeCreaturePose', 'attachNativeCreaturePose'].map(name => [`src/game/server/plugin/animation.ts#${name}`, 'C4']),
  // Journal, onboarding, discovery and quest presentation.
  ['src/sdk/interactions.ts#interactionRules', 'C5'],
  // Equipment, combat feel, held viewmodels, loot and owned rewards.
  ['src/engine/shared/combat/ammo.ts', 'C6'],
  ['src/engine/client/combat/cues.ts#resolveHitStop', 'C6'],
  ['src/engine/shared/combat/Firearm.ts#RangedAction', 'C6'],
  ['src/engine/shared/combat/Firearm.ts#RangedActionRow', 'C6'],
  ['src/engine/client/combat/view/projectile.ts#ProjectilePresentation', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#weaponDisplay', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#TRACER_ORDER', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#TRACER_RED', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#edgeWear', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#makeBoltAtlas', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#makeCord', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#ViewmodelSet', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#ViewmodelMaterialRow', 'C6'],
  ['src/engine/client/combat/view/ranged.ts#viewmodelRowMaterial', 'C6'],
  ['src/engine/client/combat/view/rangedFeel.ts', 'C6'],
  ['src/engine/client/player/Skins.ts#STATE', 'C6'],
  ['src/engine/client/player/Skins.ts#SkinState', 'C6'],
  ['src/engine/client/player/Skins.ts#applySkin', 'C6'],
  ['src/engine/client/player/Skins.ts#clearSkin', 'C6'],
  ['src/engine/client/player/Skins.ts#cloneWith', 'C6'],
  ['src/engine/client/player/Skins.ts#white', 'C6'],
  ['src/engine/client/player/Skins.ts#whiteTex', 'C6'],
  ['src/game/server/loot/tables.ts#registerLootTable', 'C6'],
  ['src/game/client/shard/retainedHooks.ts#installRetainedPlayerEffects', 'C6'],
  ['src/game/client/shard/retainedHooks.ts#playerBindings', 'C6'],
  ['src/game/client/systems/viewmodel/armClips.ts#SWIM_CLIPS', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#CLIP', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#RigArms', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#RigMeta', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#RigState', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#VmFrame', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#isMesh', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#parsed', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#rigScene', 'C6'],
  ['src/game/client/systems/viewmodel/rigArms.ts#swordArmsOf', 'C6'],
  // Loading, continuation parsing, lifecycle plumbing, instrumentation and localization.
  ['src/engine/client/core/assets.ts#gltfLoader', 'C9'],
  ['src/engine/client/core/assets.ts#loadGLTF', 'C9'],
  ['src/engine/server/script/host.ts#preparationWait', 'C9'],
  ['src/engine/server/script/host.ts#preparingOwners', 'C9'],
  ['src/engine/server/script/host.ts#requirePreparationOwner', 'C9'],
  ['src/sdk/headlessRuntime.ts#HeadlessCommandPorts', 'C9'],
  ['src/sdk/headlessRuntime.ts#bindHeadlessCommands', 'C9'],
  ['src/game/server/plugin/context.ts#buildProgress', 'C9'],
  ['src/game/client/shard/retainedHooks.ts#installEnteredRuntimeAttachment', 'C9'],
  ['src/game/client/shard/retainedHooks.ts#installEnteredRuntimeObserver', 'C9'],
  ['src/game/client/shard/retainedHooks.ts#installEnteredRuntimeUpdate', 'C9'],
  ['src/game/shared/grid/pageMode.ts#gridPage', 'C9'],
]);
function namedRole(name,path='') {
  const reviewed = reviewedW2Owners.get(`${path}#${name}`); if (reviewed !== undefined) return reviewed;
  return roles.find(([, pattern]) => pattern.test(name))?.[0] ?? null; }
// W3 folder baselines describe the runtime owner; mixed declarations still split
// through the existing AST rules. Build-time generators are outside this census.
const w3Paths = [
  ['C5', /^(?:quest\/|adventure\.ts$|campPeople(?:Models)?\.ts$|models\/people\.ts$)/u],
  ['C6', /^(?:weapons\/|runtime\/(?:weapons|viewmodel)\/|vm\/|bag\.ts$|models\/gear\.ts$|runtime\/jian\.ts$)/u],
  ['C7', /^(?:ride\/|grapple\/|playground\/|runtime\/(?:tools|portals)\/|runtime\/(?:grapple|playerModes|headlessMounted)\.ts$|world\/(?:portalRide|portalVeil|portals|feats)\.ts$)/u],
  ['C3', /^(?:world\/(?:installWeather|weatherStep|WeatherFX|Lightning|rainProgram|Flutter)\.ts$|combat\/nightFx\.ts$|runtime\/looks\/(?:burstFx|ropeFilament|strandCloth)\.ts$)/u],
  ['C4', /^(?:species\/|creatures\/|models\/(?:creatures|ambientLife)\.ts$|runtime\/(?:enteredEnvironment|[a-zA-Z]+Keeper|[a-zA-Z]+Brain|headless(?:Creatures|Raid|Taming)|flockDeclared|groups?|group[A-Z][a-zA-Z]*|raidDirector|ghostVolleyDirector|tamingLaw)\.ts$|combat\/(?:stormTitan|goldenKing|ghostRiders|balbalWarriors|eliteRoster|elites|night)\.ts$|data\/(?:species\/|fauna|brains|eliteEncounters|crowds)\.ts$)/u],
  ['C6', /^combat\//u],
  ['C1', /^(?:world\/|runtime\/heightPatch\.ts$|assets\/contracts\/(?:modelPlacement|tangentRows)\.ts$|generators\/bakeWrite\.ts$|models\/|runtime\/(?:cull|kit|props)\/|(?:terrain|edge|wet|layout)\.ts$|data\/(?:layoutPlan|floorPlan|decks|casts|worldDressing|specimenDims|lod)\.ts$)/u],
  ['C2', /^(?:assets\/contracts\/signPlacement\.ts$|look\/|runtime\/(?:looks|signs)\/|data\/(?:aoLook|weaponLooks|arms|cloth|facadeModels|signs|specimenProfiles)\.ts$)/u],
  ['C9', /^(?:boot\/|runtime\/(?:index|state|baked|headless|headlessMounted|enteredEnvironment|facts)\.ts$|(?:manifest|plugin|roster|shard\.config|util|stealth)\.ts$|data\/(?:budgets|ledger|words|modes|campParams|(?:layout|poiLayout)\.generated\.d\.json)\.ts$)/u],
];
// Sole-user platform contributions retain their canonical size. These reviewed
// owners only distribute W3's existing charges into the component table.
const w3SharedOwners = new Map([
  ...['src/engine/shared/combat/targets.ts', 'src/engine/client/combat/effects/types.ts',
    'src/engine/client/player/firstPersonArms.ts', 'src/game/client/weapons/heldLauncher.ts',
    'src/game/client/systems/viewmodel/armRig.ts'].map(path => [path, 'C6']),
  ...['src/sdk/crowds.ts',
    'src/game/shared/shardfile/crowdRuntime.ts', 'src/sdk/phasedBoss.ts'].map(path => [path, 'C4']),
  ...['src/engine/client/core/gpuOnly.ts', 'src/sdk/kit/bakedGeometry.ts',
    'src/sdk/kit/geometryPack.ts'].map(path => [path, 'C1']),
  ['src/engine/client/core/ktx2.ts', 'C2'],
  ...['src/game/server/plugin/quests.ts'].map(path => [path, 'C5']),
  ['src/game/server/shardfile/portalLinkProof.ts', 'C7'],
  ...['src/game/shared/grid/pageMode.ts', 'src/sdk/assets.ts',
    'src/sdk/buildBehaviour.ts', 'src/engine/client/app/systems.ts'].map(path => [path, 'C9']),
]);
function w3FileRole(path) {
  const match = /^src\/shards\/(?:nalati-grasslands|nine-dragon-stack)\/(.+)$/u.exec(path);
  return match === null ? null : w3Paths.find(([, pattern]) => pattern.test(match[1]))?.[0] ?? null;
}
/** Explicit file ownership; an unrecognised file stays visible and cannot close C9. */
function fileRole(path, name = '') {
  const reviewed = reviewedW2Owners.get(name ? `${path}#${name}` : path) ?? reviewedW2Owners.get(path);
  if (reviewed !== undefined) return reviewed;
  const w3 = w3FileRole(path); if (w3 !== null) return w3;
  if (/\/systems\/life\//u.test(path)||path==='src/engine/shared/ai/ambientFlight.ts'||name==='installAmbientLife')return 'C4';
  if (path === 'src/engine/shared/world/waves.ts' && name === 'GERSTNER_TERMS') return 'C2';
  if (['src/format/materialGraph.ts', 'src/game/client/shardfile/clientMaterials.ts', 'src/game/client/shardfile/clientGraphs.ts'].includes(path)) return 'C2';
  if (path === 'src/game/client/shardfile/hybrid.ts') return 'C9';
  if(questOwners.has(path))return 'C5';
  if(path==='src/engine/server/world/interact/flags.ts'&&name==='bindInteractionState')return 'C5';
  if (path === 'src/game/client/plugin/ui.ts' && ['WorldSceneBoundParts', 'bindWorldSceneParts'].includes(name)) return 'C1';
  if (path === 'src/game/client/plugin/ui.ts' && ['moverChannelValues', 'moverChannelView', 'moverChannelViews', 'moverChannelPrompts'].includes(name)) return 'C7';
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
  const tags = blanked.split('\n').map((line, index) => line.trim() ? { line:index + 1, component:fallback, priority:0, reason:'file owner', symbol:'' } : null);
  const lineOf = offset => { let low=0, high=starts.length-1; while(low<high){const mid=(low+high+1)>>1;if(starts[mid]<=offset)low=mid;else high=mid-1;}return low; };
  // R19: retain defining symbols without changing semantic ownership or counts.
  const symbol = (node, name) => {
    for (let i=lineOf(node.start);i<=lineOf(Math.max(node.start,node.end-1));i++) if(tags[i]) tags[i].symbol=name;
  };
  for (const statement of parsed.program.body) {
    const node=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
    if(!node)continue;
    if(node.type==='VariableDeclaration')for(const declaration of node.declarations)symbol(declaration,nodeName(declaration.id));
    else if(node.id) {
      const name=nodeName(node.id);symbol(node,name);
      if(node.type==='ClassDeclaration')for(const member of node.body.body)if(member.type==='MethodDefinition')symbol(member,`${name}.${nodeName(member.key)}`);
    }
  }
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
      const bindingOwner = /\/quest\//u.test(path) ? 'C5' : null;
      const admittedBoot = path === 'src/shards/driftwood-isle/shard.config.ts' && node.source.value === './data/movers';
      const owner = admittedBoot ? 'C9' : cable && bindingOwner !== null ? bindingOwner : namedRole(spec.local.name,path) ?? from;
      imports.set(spec.local.name, owner);
    }
    assign(node, node.specifiers.map(spec=>imports.get(spec.local.name)).find(Boolean),1,`import ${node.source.value}`);
  }
  const methods = { arm:'C6',armed:'C6',dress:'C6',enter:'C6',witnessed:'C4',ray:'C4',stage:'C5',build:'C1' };
  const wire = node => node === null || node === undefined || ['Identifier', 'Literal', 'ThisExpression'].includes(node.type)
    || (node.type === 'MemberExpression' && !node.computed && wire(node.object));
  const visit=(node,depth)=>{
    let role=null, reason='';
    if(node.type==='VariableDeclarator'||node.type==='FunctionDeclaration') {
      const name=nodeName(node.id);role=(node.type==='VariableDeclarator' && (node.init?.type!=='Literal' && wire(node.init) || node.init?.type==='CallExpression' && node.init.callee.type==='MemberExpression' && calledName(node.init.callee)==='get') ? null : (node.init?.type==='CallExpression' ? imports.get(calledName(node.init.callee)) ?? namedRole(calledName(node.init.callee),path) : null) ?? namedRole(name,path));reason=`declaration ${name}`;
    } else if(node.type==='MethodDefinition') { const name=nodeName(node.key);role=(Object.hasOwn(methods,name)?methods[name]:null)??namedRole(name,path);reason=`method ${name}`;
    } else if(node.type==='Property'||node.type==='PropertyDefinition') {
      const name=nodeName(node.key);
      // Borrowed service references and destructuring fields retain the enclosing
      // declaration/call owner. A literal tuning row still owns its semantics.
      const reference=node.type==='Property' && node.value?.type!=='Literal' && wire(node.value);
      role=reference?null:namedRole(name,path);reason=`property ${name}`;
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
  // G515: dependency crumbs belong to the enclosing file's component. Keep
  // imported owners above for real calls, but don't turn wiring into a feature.
  const crumbs = node => {
    const field = (node.type === 'Property' || node.type === 'PropertyDefinition')
      && !node.computed && !node.method && node.kind !== 'get' && node.kind !== 'set'
      && lineOf(node.start) === lineOf(Math.max(node.start,node.end-1)) && wire(node.value)
      && !blanked.slice(starts[lineOf(node.start)],node.start).trim()
      && /^[,;]?\s*$/u.test(blanked.slice(node.end,starts[lineOf(node.end)+1] ?? source.length));
    if (node.type === 'ImportDeclaration'
      || (['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && !node.declaration)
      || field) assign(node,fallback,Number.MAX_SAFE_INTEGER,'file owner wiring');
    for (const child of children(node)) crumbs(child);
  };
  crumbs(parsed.program);
  return tags.filter(row=>row!==null);
}
/** Attribute each canonical contribution exactly once; ranges retain physical TS lines for auditing.
 * @param {string} root @param {string} shard @param {import('./shard-platform.mjs').CustomSource[]} sources
 * @param {number} canonical @returns {import('./shard-components.mjs').ComponentInventory} */
export function componentInventory(root, shard, sources, canonical) {
  const counts=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,0])), unknown=[], spans=[];
  for(const row of sources) {
    const reviewed = platformChargeback(row.path, row.name);
    if (reviewed !== null) {
      counts[reviewed] += row.lines;
      spans.push({path:row.path,symbol:row.name??null,kind:row.kind,component:reviewed,lines:row.lines,reason:'G520 fixture-only host; real second shard absent'});
      continue;
    }
    const ownerPath=row.ownerPath??row.path;
    const role=fileRole(ownerPath,row.name) ?? (/^(?:nalati-grasslands|nine-dragon-stack)$/u.test(shard) ? w3SharedOwners.get(ownerPath) ?? null : null);
    if(role===null)unknown.push(`${row.path}${row.name?`#${row.name}`:''}`);
    const owner=role??'C9';
    if(row.kind==='runtime-ts'||row.kind==='sole-module') {
      const tags=runtimeTags(readFileSync(resolve(root,row.path),'utf8'),ownerPath,owner).filter(tag=>!row.excludedLines?.includes(tag.line));
      if(tags.length!==row.lines)throw new Error(`Component line mismatch: ${row.path} ${tags.length}/${row.lines}`);
      for(const tag of tags) {
        counts[tag.component]++;
        const last=spans.at(-1);
        if(last && last.path===row.path && last.kind===row.kind && last.component===tag.component && last.end===tag.line-1 && last.reason===tag.reason && last.symbol===(tag.symbol||null)){last.end=tag.line;last.lines++;}
        else spans.push({path:row.path,symbol:tag.symbol||null,kind:row.kind,component:tag.component,start:tag.line,end:tag.line,lines:1,reason:tag.reason});
      }
    } else {
      // Additional GLSL is the canonical shader unit; sole exports already have deduplicated declaration spans.
      const component=row.kind==='additional-glsl'?(owner==='C3'?'C3':'C2'):namedRole(row.name??'',row.path)??owner;
      counts[component]+=row.lines;
      spans.push({path:row.path,symbol:row.name??null,kind:row.kind,component,lines:row.lines,reason:row.name?`G294 declaration ${row.name}`:'additional GLSL owner'});
    }
  }
  const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
  if(total!==canonical)throw new Error(`${shard}: component total ${total} differs from canonical ${canonical}`);
  return {shard,counts,total,unknown,spans};
}
/** Known zero counts close independently. Unresolved ownership remains charged
 * to C9 and prevents that component from closing; no charge is discarded. */
export function componentStates(rows, slugs, closing = []) {
  const shards = slugs.map(shard => rows[shard]?.components), known = shards.length > 0 && shards.every(row => row !== undefined);
  return Object.fromEntries(Object.keys(COMPONENTS).map(key => {
    const closed = known && shards.every(row => row.counts[key] === 0 && (key !== 'C9' || row.unknown.length === 0));
    return [key, { closed, state: closed ? 'closed' : closing.includes(key) ? 'closing' : 'open',
      lines: Object.fromEntries(slugs.map((slug, index) => [slug, shards[index]?.counts[key] ?? null])) }];
  }));
}
/** A component closes when all measured shards in its wave reach zero. */
export function componentWave(rows, id=currentWave().id, closing = []) {
  const wave=waveRow(id),slugs=wave.shards.map(row=>row.slug),shards=slugs.map(shard=>rows[shard]?.components);
  const components=componentStates(rows,slugs,closing);
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
      `Components closed ${wave.closed} of ${wave.total}. Unknown ownership stays charged to C9.`,
      'Nine disjoint totals reconcile to canonical custom lines. Mixed TS uses AST declarations and owner calls;',
      'each code line has one owner. Extra GLSL belongs to its look/effect owner.','',
      `| Component | ${wave.shards.map(slug=>`${wave.names[slug]} lines`).join(' | ')} | Closed across both |`,
      `|---|${wave.shards.map(()=>'---:').join('|')}|---|`,
      ...Object.entries(wave.components).map(([key,row])=>`| ${key} ${COMPONENTS[key]} | ${wave.shards.map(slug=>row.lines[slug]??'unavailable').join(' | ')} | ${row.state.toUpperCase()} |`),
      `| Total | ${wave.shards.map(slug=>rows[slug]?.components?.total??'unavailable').join(' | ')} | |`,'','### Custom contribution owners','',
      '| Shard | Source | Unit / span | Component | Lines | Owner rule |','|---|---|---|---|---:|---|');
    for(const slug of wave.shards){const report=rows[slug]?.components;if(!report)continue;
      for(const span of report.spans)lines.push(`| ${slug} | ${span.path} | ${span.kind}${span.start===undefined?'':`:${span.start}-${span.end}`} | ${span.component} | ${span.lines} | ${span.reason} |`);
      for(const path of report.unknown)lines.push(`Unknown owner: ${path}`);
    }
  }
  return lines;
}
