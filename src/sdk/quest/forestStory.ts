import type { DeclaredSoundBank } from '@wildshard/engine/audio/declaredBank';
import { readChapterDirector, installQuestSpawnDirector, installChapterLead } from '@wildshard/game/quest/chapterDirector';
import { commitQuestEffects, readQuestServiceActions } from '@wildshard/game/quest/effects';
import { installChapterStory, installQuestFlags, installQuestInteractables } from '@wildshard/game/quest/chapter';
import { QuestStepRunner } from '@wildshard/game/quest/steps';
import { installQuestTrader } from '@wildshard/game/quest/trader';
import { parseContractCatalogue } from '@wildshard/format/contracts';
import { installDeclaredMovers, type MoverRuntime } from '@wildshard/game/plugin/mover';
import * as v from 'valibot';
import { forestPageAmbience } from '@wildshard/game/audio/forestPage';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import { perfLap } from '@wildshard/engine/core/perfLap';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { saves } from '@wildshard/engine/saves/runtime';
import { jsonSchema } from '@wildshard/engine/saves/slots';
import type { MapPoi } from '@wildshard/engine/ui/Map';
import { test } from '@wildshard/engine/world/interact/flags';
import type { InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { createQuestPlacements, type Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ItemId } from '@wildshard/game/Inventory';
import { ShopPanel } from '@wildshard/game/loot/ui/ShopPanel';
import { bindQuestDeathEffects } from '@wildshard/game/plugin/quests';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeLedger, bindRuntimeQuest, bindRuntimeState } from '@wildshard/game/shardfile/hybridRows';
import * as THREE from 'three';
import type { ForestStoryRows, ForestStoryContent, ForestStoryGood, ForestStory } from './forestStoryRows';
import { FigureCatalogue } from '../npc/figures';
import { GeometryPack, fetchDeflated, packedRows } from '../kit/geometryPack';
import type { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { forestPage } from '@wildshard/game/shardfile/forestPage';
import { rangedPage } from '@wildshard/game/loadout/rangedPage';
import { HeldFinishes } from '@wildshard/game/loadout/finishes';
import { loadBoard, saveBoard, recordKill, claim, reroll, contractKill, isFilled, type Board } from '@wildshard/game/quest/contracts';
import { readQuestStory, bindStoryAchievements, observeStoryFlags, bindStoryBench, installStoryTalks } from '@wildshard/game/quest/story';
import { Exchange } from '@wildshard/game/loot/exchange';
import { DataPanel, readDataPanels } from '../dataPanels';
import { isItemId } from '@wildshard/game/bag/itemCatalog';
import { isJsonData } from '@wildshard/format/json';
import { QuestViews, bindQuestPageInteractions, type QuestNpcTalkPorts } from '@wildshard/game/plugin/ui';

const defineBoardSave = (key: string) => saves.define({ key, scope: 'shard', version: 1, schema: jsonSchema, initial: () => null });
const stores = new Map<string, ReturnType<typeof defineBoardSave>>();
const _v = new THREE.Vector3();
/** Client-only story composition over native page owners. Rows supply every
 * content identity; custom world drawing consumes the returned observations. */
export async function installForestStory(ctx: ShardContext, rows: ForestStoryRows): Promise<ForestStory> {
  if (!isJsonData(rows)) throw new Error('Forest story requires JSON rows');
  const source = ctx.product.shardfile, floor = forestPage(ctx.scope, rows.page), equipment = rangedPage(ctx.scope, rows.ranged);
  const runtime = ctx.game.runtime, enteredWorld = runtime?.world, play = runtime?.play;
  if (runtime === undefined || enteredWorld === undefined || enteredWorld === null || play === undefined || play === null) throw new Error('Story requires entered play services');
  const h = { ...enteredWorld, ...play, ctx, cabins: floor.cabins, trees: enteredWorld.forest.trees,
    interactables: runtime.interactables, chunkId: ctx.manifest.slug, compendium: equipment.compendium?.state ?? null,
    crossbow: { addBolts: (n: number) => { equipment.loadout.addAmmo(rows.ammo, n); }, addAmmo: equipment.loadout.addAmmo, room: equipment.loadout.room } };
  const panels = await readDataPanels(h.ctx.product);
  const boardPanel = panels[rows.panels.board], countPanel = panels[rows.panels.count];
  if (boardPanel === undefined || countPanel === undefined) throw new Error('Story requires its named quest panels');
  const story = await readQuestStory(h.ctx);
  const native = h.ctx.product.section<ForestStoryContent>(rows.content);

  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.stall)));
  const exchangeRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.exchange)));
  const trades = h.ctx.product.section<{ goods: ForestStoryGood[] }>(rows.trades.section);
  const contracts = parseContractCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.contracts))));
  const lanternRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.signals))));
  const doorRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.door))));
  const transactionRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file(rows.files.transactions))));
  const figuresBook = await FigureCatalogue.fromProduct(ctx.product, rows.figures.catalogue);
  const parts = new GeometryPack(await fetchDeflated(rows.parts.url), packedRows(rows.parts.rows), rows.parts.label);
  if (ctx.scope.disposed) throw new Error('Story left during model admission');
  const { game, sky, player, animals, hud, inventory, progress } = h;
  const figureScenes = new SceneHandles(sky);
  const flags = installQuestFlags(ctx, story.quest.id, h.chunkId);
  const serviceActions = await readQuestServiceActions(ctx, story.quest.id, rows.files.services);
  const facts = bindRuntimeLedger(ctx, source, h.chunkId), featFacts = await bindStoryAchievements(ctx, story, progress, h.chunkId, facts);
  const { state: quest, cables } = bindRuntimeQuest(ctx, source, story.quest.id, { flags, facts });

  let sfx: DeclaredSoundBank | null = null;
  const kitSfx = new InteractSfx(h.audio);
  const shot = (name: Parameters<DeclaredSoundBank['shot']>[0], at?: THREE.Vector3): void => { sfx?.shot(name, at ? { at } : {}); };

  const { floorAt } = createQuestPlacements({ terrain: heightAt, registry: h.registry, registryReach: 20 });

  const { table, interactions: lanternRules } = native;
  const kit = await installQuestInteractables(ctx, story.quest.id, { table, registryReach: 20 });
  ctx.system({ id: 'quest.kit', phase: 'update', after: ['engine.compendium.installCompendium'], before: ['hud.combat', 'main.frame'], run: (dt, t) => { kit.update(dt, t); } });

  const ui = new QuestViews(ctx);
  const chip = ui.view('count', (scope) => new DataPanel(countPanel, { scope }));
  const shelf = rows.collections.find(row => row.shelf !== undefined);
  const shelfObject = shelf?.shelf === undefined ? null : (await h.cabins.resources.place(shelf.shelf)).object;
  const count = (row: ForestStoryRows['collections'][number]): number => flags.count(row.prefix);
  if (shelfObject !== null && shelf !== undefined) shelfObject.visible = count(shelf) === shelf.names.length;
  const calls = new Map<string, (e: InteractEvent) => void>(rows.collections.flatMap(row => [
    [row.event, (e: InteractEvent): void => {
      if (row.item !== undefined) { if (!isItemId(row.item)) throw new Error('Unknown story item'); inventory.add(row.item); }
      chip().show({ label: row.label, n: count(row), of: row.names.length });
      if (row.take !== undefined) { const index = Number(e.def.id.split('-').at(-1) ?? '1') - 1; hud.toast(row.take + (row.names[index] ?? row.fallback)); }
    }],
    [row.completeEvent, (): void => { if (count(row) === row.names.length) { hud.toast(row.complete); if (row.shelf !== undefined && shelfObject !== null) shelfObject.visible = true; } }],
  ]));
  calls.set(rows.pickupEvent, () => { h.music.sting('pickup'); });
  kit.onEvent = kitSfx.bindEvents(native.events, { toast: text => { hud.toast(text); }, calls });
  bindStoryBench(story, kit, player, new Map<string, unknown>([['hud', hud]]));

  const points = Object.fromEntries(rows.signals.map(row => [row.id, new THREE.Vector3(row.x, floorAt(row.x, row.z) + row.height, row.z)]));
  const lanternPage = bindQuestPageInteractions(lanternRows, { flags, interactions: lanternRules, timer: ui,
    promptIds: rows.signals.map(row => row.id), interactables: h.interactables, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['points', points], ['sound', { shot }], ['sfx', kitSfx]]) });
  const lanternPrompts = Object.fromEntries(rows.signals.map(row => [row.id, lanternPage.prompt(row.id)]));
  const syncWheel = (): void => { h.cabins.life.wheelSpeed = flags.has(rows.wheel.flag) ? rows.wheel.speed : 0; };
  syncWheel();
  ctx.scope.onDispose(flags.onChange(f => { if (f === rows.wheel.flag) syncWheel(); }));
  const millDoor = ((): { prompt: Interactable; use: () => void } | null => {
    const mill = h.cabins.buildings.find((b) => b.id === rows.door.building);
    const piece = mill ? h.cabins.life.doorPieces().find((d) => d.id === `cabin-${mill.index + 1}-door`) : undefined;
    if (!piece) return null;
    h.registry.add({ id: `${piece.id}-bar`, name: 'Mill door bar', category: 'buildings', file: 'src/sdk/quest/forestStory.ts', surface: 'wood',
      follows: piece.pivot, colliders: piece.colliders, active: () => !flags.has(rows.door.flag) });
    const hinge = piece.pivot.getWorldPosition(new THREE.Vector3());
    let best: Interactable | null = null, bestD = 1.5; // the prompt stands ~0.7 m from its hinge; the next door is metres off
    for (const it of h.cabins.life.interactables) {
      const d = Math.hypot(it.position.x - hinge.x, it.position.z - hinge.z);
      if (d < bestD && /^(Open|Close) door$/.test(it.label)) { best = it; bestD = d; }
    }
    return best === null ? null : { prompt: best, use: piece.use };
  })();
  if (millDoor) bindQuestPageInteractions(doorRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['door', millDoor], ['sfx', kitSfx]]) });
  const thralls = await installQuestSpawnDirector(ctx, native);
  let lodgeSave = stores.get(rows.store.slot);
  if (lodgeSave === undefined) { lodgeSave = defineBoardSave(rows.store.slot); stores.set(rows.store.slot, lodgeSave); }
  const savedBoard = lodgeSave;
  const lodge = bindRuntimeState(ctx, source, rows.store.state, () => JSON.stringify(savedBoard.read(h.chunkId)), h.chunkId);
  const store = { getItem: (_key: string): string => String(lodge.read()), setItem: (_key: string, raw: string): void => {
    v.parse(jsonSchema, JSON.parse(raw) as unknown); lodge.write(raw);
  } };
  const board: Board = loadBoard(contracts, store.getItem(contracts.store));
  const persistBoard = (): void => { try { store.setItem(contracts.store, saveBoard(board)); } catch { /* storage unavailable */ } };
  const traderVoice = new THREE.Vector3();   // his head (set once he stands in his stall, below)
  const transactions = bindQuestPageInteractions(transactionRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['inventory', inventory], ['crossbow', h.crossbow], ['skins', h.skins], ['music', h.music], ['sfx', kitSfx],
      ['ammo', { add: h.crossbow.addAmmo }], ['voice', { get current() { return sfx; } }], ['points', { trader: traderVoice }],
      ['finishes', Object.fromEntries(rows.trades.finishes.map(id => [id, { wear: () => { h.wearSkin(HeldFinishes.current(h.ctx.manifest.slug).get(id)); } }]))]]) });
  const boardUi = ui.view('board', (scope) => {
    const onClaim = (value: unknown): void => {
      if (typeof value !== 'number') throw new Error('Contract action requires its slot');
      const i = value;
      const contract = board.slots[i], r = claim(contracts, board, i);
      if (!r || contract === undefined) return;
      transactions.run(`contract.${contract.kind}.${contract.target}`);
      if (r.skin) transactions.run('contract.finish');
      persistBoard();
      transactions.run('contract.claimed');
      featFacts.event('streak', board.streak);
      hud.toast(`Contract claimed · ${board.claimed} so far · ${board.streak} in a row`);
    };
    const onReroll = (value: unknown): void => {
      if (typeof value !== 'number') throw new Error('Contract action requires its slot');
      reroll(contracts, board, value); persistBoard(); kitSfx.interact('door');
    };
    return new DataPanel(boardPanel, { scope, values: () => board, actions: new Map([['claim', onClaim], ['tear', onReroll]]) });
  });
  const bs = rows.board.at;
  const boardPrompt: Interactable = {
    position: new THREE.Vector3(bs.x, heightAt(bs.x, bs.z) + 1.3, bs.z),
    get radius() { return boardUi().isOpen ? 0 : 2.8; },
    get label() { return board.slots.some(isFilled) ? rows.board.filled : rows.board.label; },
    onInteract: () => { boardUi().open(); kitSfx.interact('door', boardPrompt.position, { gain: 0.5 }); },
  };
  h.interactables.push(boardPrompt);

  const owns = (s: string): boolean => HeldFinishes.current(h.ctx.manifest.slug).has(s) && h.skins.has(s);
  const room = h.crossbow.room;
  const exchange = new Exchange(exchangeRows, new Map<string, unknown>([['pack', inventory], ['skins', { owns, own: h.skins.own.bind(h.skins) }],
    ['ammo', { capacity: room, addBolts: h.crossbow.addBolts.bind(h.crossbow), grant: (kind: Parameters<typeof h.crossbow.addAmmo>[0], n: number) => h.crossbow.addAmmo(kind, n) }]]));
  const trade = ui.view('trade', (scope) => {
    const panel = new ShopPanel<ForestStoryGood>({
      trader: rows.trades.name, place: rows.trades.place, goods: trades.goods, verb: 'Trade',
      state: (g) => exchange.state(trades.goods.indexOf(g)), cost: (g) => exchange.cost(trades.goods.indexOf(g)),
      scope,
    });
    panel.onBuy = ({ trade: t }) => transactions.run(`trade.${t.id}`);
    return panel;
  });

  const tradeOwner = installQuestTrader(traderStall, { player, shop: trade });
  if (tradeOwner === null) throw new Error('The declared trader shop is required');
  const steps = new QuestStepRunner(native.steps);
  const payMiller = (): void => {
    const paid = flags.has(rows.payment.flag);
    commitQuestEffects(ctx, story.quest.id, steps.signal({ kind: 'talk', target: rows.payment.speaker }, { flags: flags.all,
      inventory: Object.fromEntries(inventory.items.map(item => [item.id, item.count])) }));
    if (!paid && flags.has(rows.payment.flag)) serviceActions.run(rows.payment.action);
  };

  ui.panelHold({ hud, weapons: h.weapons, menu: h.menu, nolock: h.nolock, touchUi: h.touchUi,
    panels: [boardUi, trade], closeMenu: true, resetOnLeave: true });

  const figures: QuestNpcTalkPorts<FigureRows>['figures'] = new Map(rows.figures.ids.map(kind => [kind, {
    kind: 'posed', create: (at, yaw) => figuresBook.create(kind, figureScenes, [at.x, at.y, at.z], yaw, ctx.scope), bark: fig => { sfx?.bark(kind, fig.talkPoint); },
  }]));
  const talks = installStoryTalks(ui, source, { flags, scene: game.scene, registry: h.registry,
    prompts: h.interactables, figures, groundAt: floorAt, calls: new Map([[rows.payment.call, payMiller], [rows.trades.call, tradeOwner.open]]) });
  const { people, dialogue } = talks;
  const trader = people.find(person => person.kind === rows.trades.figure);
  if (trader === undefined) throw new Error('The declared trader is required');
  traderVoice.copy(trader.fig.talkPoint);
  const killed = bindQuestDeathEffects(native.pageDeaths, { flags, kill: featFacts.kill, event: featFacts.event,
    calls: new Map([['contracts', (a: AnimalManager['animals'][number]) => {
      const moved = recordKill(contracts, board, contractKill(contracts, a));
      if (moved.length === 0) return;
      persistBoard();
      for (const i of moved) {
        const c = board.slots[i];
        if (c) hud.toast(isFilled(c) ? `Contract filled · ${c.goal} — claim it at the lodge` : `Contract · ${c.goal} · ${c.have} / ${c.need}`);
      }
    }]]) });
  ctx.on('actor.died', ({ actor }) => {
    const a = animals.animals.find(animal => animal.combatActor() === actor);
    if (a !== undefined) killed(a);
  });

  const cableId = rows.cable.id;
  let zip: { trolley: THREE.Mesh; prompt: ReturnType<typeof cables.bindView> };
  let canoe: { group: THREE.Mesh };
  let motion: MoverRuntime;
  let moverAway = false;
  {
    const trolley = new THREE.Mesh(parts.geometry(rows.cable.geometry), figuresBook.material(figureScenes)); trolley.castShadow = true; trolley.name = 'zip-trolley';
    zip = { trolley, prompt: cables.bindView(cableId, trolley, player,
      { position: new THREE.Vector3(...rows.cable.prompt), radius: rows.cable.radius, label: rows.cable.label }, game.camera) };
    game.scene.add(zip.trolley); h.interactables.push(zip.prompt);
    const world = ctx.game.runtime?.world; if (world === undefined || world === null) throw new Error('Canoe requires its active world');
    canoe = { group: new THREE.Mesh(parts.geometry(rows.mover.geometry), figuresBook.material(figureScenes)) }; canoe.group.castShadow = true; canoe.group.visible = false; canoe.group.name = 'canoe-ride';
    game.scene.add(canoe.group);
    motion = await installDeclaredMovers(ctx, world, { data: ctx.product.shardfile.movers, modules: new Map(), flags, prompts: h.interactables, systemId: rows.mover.system,
      borrowed: { rows: [{ id: rows.mover.id, target: 'canoe', group: 'group', visibility: 'enabled', order: 'XYZ' }], targets: { canoe } } });
  }

  let hollow: { floorY: number; mid: THREE.Vector3; mouths: THREE.Vector3[] } | null = null;
  void h.cabins.resources.place(rows.secret.scene).then(() => {
    const site = rows.secret;
    hollow = { floorY: site.floorY, mid: new THREE.Vector3().fromArray(site.mid), mouths: site.mouths.map(point => new THREE.Vector3().fromArray(point)) };
    return hollow;
  });

  const presentation = installChapterStory(ctx, story, { program: native.lead.program });
  const questChip = presentation.chip, objective = presentation.objective;
  const clock = await readChapterDirector(ctx, rows.files.director);
  ui.retainRoot(objective.root, () => { objective.hide(false); });
  ui.retainRoot(clock.caption.root, () => { clock.caption.show(false); });
  function runDawn(): void { clock.request('dawn.request'); }


  const stag = installChapterLead(ctx, native);
  // the guide's and the spawns' declared puffs: shimmer domes swelling where each cue fired
  const leadPuffs = new DomePuffs(game.scene, new THREE.Color(...stag.puffs.color), stag.puffs.count), spawnPuffs = new DomePuffs(game.scene, new THREE.Color(...thralls.puffs.color), thralls.puffs.count);
  ctx.scope.onDispose(() => { leadPuffs.dispose(); spawnPuffs.dispose(); });

  const liveMarkers = (): { label: string; x: number; z: number; short: string }[] => quest.markers().map((m) => ({ label: m.label, short: m.short ?? m.label, x: m.at.x, z: m.at.z }));
  h.fullMap.setPois((): MapPoi[] => [
    ...rows.map.pois.map((p): MapPoi => (flags.has(`seen:${p.id}`) ? { x: p.x, z: p.z, label: p.name, kind: 'place' } : { x: p.x, z: p.z, label: '?', kind: 'unknown' })),
    ...liveMarkers().map((m): MapPoi => ({ x: m.x, z: m.z, label: m.label, kind: 'quest' })),
  ], { declutter: true });
  const placeNames = new Set(rows.map.pois.map((p) => p.name.toUpperCase()));
  h.fullMap.setZones(rows.map.zones.filter((zn) => !placeNames.has(zn.label)));
  h.fullMap.setFeatures({ trees: h.trees, roofs: h.cabins.roofs });

  observeStoryFlags(story, ctx.scope, flags, new Map<string, unknown>([['counters', featFacts], ['hud', hud]]));
  const journalFull = (): boolean => {
    const st = h.compendium; if (!st) return false;
    return st.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; });
  };

  let slowT = 0;
  // each signal's lantern is lit while any of its declared flags is set
  const lanternLit = new Map<string, boolean>();
  const lightLanterns = (): void => { for (const row of rows.signals) { const on = row.lantern.when.some(flag => flags.has(flag));
    if (lanternLit.get(row.id) !== on) { lanternLit.set(row.id, on); floor.setLantern(row.lantern.id, on); } } };
  lightLanterns();
  ctx.system({ id: 'quest', phase: 'update', after: ['quest.kit'], before: ['hud.combat', 'main.frame'], run: (dt, t) => {
    const pp = player.position;
    talks.update(dt, t, pp);
    {
      cables.update(cableId, dt);
      for (const on of cables.takeTransitions(cableId)) {
        h.weapons.visible = !on; h.weapons.setEnabled(!on);
        if (on) { shot('zipline', new THREE.Vector3(...rows.cable.top)); kitSfx.interact('lever', new THREE.Vector3(...rows.cable.launch)); }
        else { kitSfx.interact('plate', new THREE.Vector3(...rows.cable.landing)); hud.toast(rows.cable.arrival); }
      }
    }
    for (const event of motion.takeRideTransitions(rows.mover.id)) {
      h.weapons.visible = !event.riding; h.weapons.setEnabled(!event.riding);
      if (event.riding) moverAway = true;
      if (event.arrived === -1) moverAway = false;
      h.cabins.resources.object(rows.mover.rest).visible = !moverAway;
      if (event.riding) {
        const at = motion.data.find(row => row.id === rows.mover.id)?.at; if (at === undefined) throw new Error('Missing canoe rest pose');
        kitSfx.interact('door', new THREE.Vector3(at.x, at.y, at.z), { gain: 0.6 });
      }
      if (event.hint !== undefined) hud.toast(event.hint);
    }
    clock.update(dt);
    if (!perfLap.active) { // E350 F-J1: the PERF LAP's teleports call no stag and no thralls
      stag.update(dt, t);
      thralls.update(dt, pp);
      leadPuffs.update(dt, t); spawnPuffs.update(dt, t);
      for (const puff of stag.takePuffs()) leadPuffs.burst(_v.set(puff.x, puff.y + stag.puffs.height, puff.z), ...stag.puffs[puff.kind]);
      for (const puff of thralls.takePuffs()) spawnPuffs.burst(_v.set(puff.x, puff.y + thralls.puffs.height, puff.z), ...thralls.puffs.burst);
    }
    questChip.update(t, player); lightLanterns();
    if (t - slowT > 0.5) {
      slowT = t;
      const cam = game.camera.position;
      for (const p of people) p.lod(cam);
      zip.trolley.visible = cables.state(cableId).riding || cam.distanceToSquared(zip.trolley.position) < 160 * 160;
      if (!perfLap.active) for (const p of rows.map.pois) if (!flags.has(`seen:${p.id}`) && Math.hypot(p.x - pp.x, p.z - pp.z) < p.r) flags.set(`seen:${p.id}`); // E350 F-J1: a lap's spot is not discovered
      if (!perfLap.active && hollow && !flags.has(rows.secret.flag) && hollow.mid.distanceToSquared(_v.set(pp.x, hollow.floorY, pp.z)) < 2.2 * 2.2 && Math.abs(pp.y - hollow.floorY) < 0.8) {
        flags.set(rows.secret.flag); hud.toast(rows.secret.text);
      }
      if (journalFull()) featFacts.event('journal', 1);
    }
  } });

  const standAt = (jump: ForestStoryRows['jumps'][string]): void => {
    player.spawn(jump.x, jump.z, Math.atan2(-(jump.look.x - jump.x), -(jump.look.z - jump.z)));
    if (jump.height !== undefined) player.position.y = heightAt(jump.height.x, jump.height.z) + jump.height.up;
    if (jump.phase !== undefined && sky.dayNight !== null) void sky.dayNight.set(jump.phase);
  };
  const goto = (bt: string): void => {
    const b = rows.jumps[bt]; if (b === undefined) return;
    flags.reset(); for (const f of b.flags) flags.set(f);
    syncWheel();
    standAt(b);
  };
  const debug = {
    flags, quest, board, kit, stag, thralls, people, content: native.content,
    jump: goto, goto,
    dawn: runDawn, night: (): void => { clock.run('debug.night'); },
    zip, cables, canoe, movers: motion, lanterns: lanternPrompts, hollow: () => hollow,
    openBoard: (): void => { boardUi().open(); }, openTrade: (): void => { trade().open(); },
    callThralls: (): void => { thralls.force(); },
    give: (id: ItemId, n = 1): void => { inventory.add(id, n); },
    fill: (i: number): void => { const c = board.slots[i]; if (c) { c.have = c.need; persistBoard(); } },
    test: (c: { all?: string[] }): boolean => test(flags, c),
  };
  ctx.debug.expose(rows.debug.id, debug);
  ctx.debug.expose(`harness.quest.${ctx.manifest.slug}`, () => flags.all.slice().sort());
  if (!ui.exposeBrowser(rows.debug.browser, debug)) ctx.scope.expose(window, rows.debug.browser, debug);
  ctx.scope.onDispose(() => {
    objective.root.remove(); clock.caption.root.remove();
    ui.disposeLegacy(() => { dialogue().dispose(); boardUi().root.remove(); trade().root.remove(); chip().root.remove(); });
  });
  return { flags, stag, thralls, motion, get moverAway() { return moverAway; }, bindAudio: id => {
    sfx = forestPageAmbience(ctx.scope, id).sfx; thralls.useSfx(sfx);
  } };
}
