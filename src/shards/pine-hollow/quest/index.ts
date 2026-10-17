import { readSpawnScript } from '@wildshard/game/population/spawnScript';
import { commitQuestEffects, readQuestServiceActions } from '@wildshard/game/quest/effects';
import { QuestStepRunner } from '@wildshard/game/quest/steps';
import { installQuestTrader } from '@wildshard/game/quest/trader';
import { parsePineQuestRows, parseTradeCatalogue, type TradeGood } from './rows';
import type { Progress } from '@wildshard/game/Progress';
import { parseContractCatalogue } from '@wildshard/format/contracts';
import { installDeclaredMovers, type MoverRuntime } from '@wildshard/game/plugin/mover';
import * as v from 'valibot';
import { yawWorld } from '@wildshard/engine/world/yawFrame';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import NPC_ROSTER from '../data/questNpcs.generated.json' with { type: 'json' };
import type { Audio } from '@wildshard/engine/audio/Audio';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Game } from '@wildshard/engine/core/Game';
import { perfLap } from '@wildshard/engine/core/perfLap';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { place as placeModel } from '@wildshard/engine/models/place';
import type { Player } from '@wildshard/engine/player/Player';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import type { QuestNpcTalkPorts } from '@wildshard/game/plugin/ui';
import { saves } from '@wildshard/engine/saves/runtime';
import { jsonSchema } from '@wildshard/engine/saves/slots';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { FullMap, MapPoi } from '@wildshard/engine/ui/Map';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import { Flags, test } from '@wildshard/engine/world/interact/flags';
import { Interactables, type InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { createQuestPlacements, type Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { SkinLocker } from '@wildshard/game/cosmetics/locker';
import type { Inventory, ItemId } from '@wildshard/game/Inventory';
import { ShopPanel } from '@wildshard/game/loot/ui/ShopPanel';
import { bindQuestDeathEffects } from '@wildshard/game/plugin/quests';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeLedger, bindRuntimeQuest, bindRuntimeState } from '@wildshard/game/shardfile/hybridRows';
import { isPineThrall } from './featLaw';
import source from '../shard.config';
/**
 * Pine Hollow's adventure layer, wired in one call from main.ts (PINE-HOLLOW-REMASTER: PH-C1 the quest *The Warden's
 * Hollow*, PH-C6 the mill hamlet, PH-C7 night play, PH-C8 collectibles + secrets, PH-C10's event achievements, the C9
 * map hook). Everything rides Driftwood's kit: the shard's `Flags` (persisted per shard), the interactables table
 * (table.ts) built by `Interactables`, `QuestState` over the quest data (wardensHollow.ts), the quest chip and the
 * dialogue box (QuestUI.ts).
 *
 *   const quest = installPineQuest({ … });   // after installPineCombat + installCompendium (it chains animals.onKill)
 *   quest.useSfx(ambience.sfx);              // the barks, lanterns, the zipline, the thralls, once the ambience exists
 *
 *   src/shards/pine-hollow/runtime/models/people.ts   the ranger / miller / trader stand-ins — ONE factory PH-M4 swaps
 *   contracts.ts   the lodge's rotating three (pure)      trades.ts   the trader's swaps (pure)
 *   world/movers   the admitted canoe path and carry             hollowLog.ts   the hollow-log passage
 *   stagLead.ts    beat 5, the pale stag down the west road            nightThralls.ts the old-growth's night + the millrace
 *   ui.ts          the board, the slate, the counter                     beats.ts       `?quest=<beat>` dev jumps
 *
 * Dev: `?quest=ranger|pond|ridge|zip|den|stag|king|dawn|done` (beats.ts), `?resetquest`, `window.__pineQuest`.
 */
import * as THREE from 'three';
import type { Cabins } from '../runtime/world/homestead';
import type {DeclaredSoundBank as PineHollowSfx} from '@wildshard/engine/audio/declaredBank';
import { HeldFinishes } from '@wildshard/game/loadout/finishes';
import { PINE_PHASES } from '../look/dayKeys';
import { DirectorScriptStageLane, readDirectorProduct } from '@wildshard/game/plugin/director';
import { waystoneSites, contractBoardSite, type PineLandmarks } from '../runtime/world/landmarks';
import { ZIP_YAW } from '../runtime/world/timberSites';
import { hamletRoofs } from '../runtime/world/cabinBake';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { QUEST_DONE, LANTERN_FLAGS, type LanternId } from '../data/wardensHollow';
import { npcMaterial, makeNpcFigure, type NpcFigure } from '../runtime/models/people';
import { preloadNpcModels } from '../runtime/quest/npcModels';
import { codePart, loadCodeParts } from '../runtime/world/codeParts';
import { loadBoard, saveBoard, recordKill, claim, reroll, eliteOf, isFilled, type Board } from '@wildshard/game/quest/contracts';
import { readQuestStory, bindStoryAchievements, observeStoryFlags, bindStoryBench, presentQuestStory, installStoryTalks } from '@wildshard/game/quest/story';
import { Exchange } from '@wildshard/game/loot/exchange';
import './pinehollow.css';
import { DataPanel, readDataPanels } from '@wildshard/sdk/dataPanels';
import { hollowLogSite, insideHollowLog, HOLLOW_LOG, type HollowLog } from './hollowLog';
import { hollowLog, loadHollowLog } from '../runtime/models/hollowLog';
import { pineModels } from '../runtime/world/context';
import { StagLead } from './stagLead';
import { NightThralls } from './nightThralls';
import { placeTokenShelf } from './tokenShelf';
import { BeaverPool } from '../world/beaverPool';

const lodgeSave = saves.define({ key: 'lodge', scope: 'shard', version: 1, schema: jsonSchema, initial: () => null });

type AmmoKind = 'iron' | 'pitch' | 'broadhead' | 'cartridge' | 'arrow';

export interface PineQuestHost {
  ctx: ShardContext;
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  hud: HUD; audio: Audio; music: Music;
  inventory: Inventory; progress: Pick<Progress, 'bindLedger' | 'refreshLedger'>; skins: SkinLocker; wearSkin: (s: SkinDef) => void;
  weapons: { setEnabled: (on: boolean) => void; visible: boolean };
  /** the crossbow's bolts, and the loadout's special ammo (PH-C11: pitch / broadhead bolts, cartridges, arrows) */
  crossbow: { addBolts: (n: number) => void; addAmmo?: (kind: 'pitch' | 'broadhead' | 'cartridge' | 'arrow', n: number) => void; /** can the kit hold n more? (E314 C: no trade into a full quiver) */ room?: (kind: AmmoKind, n: number) => boolean };
  menu: { isOpen: boolean; close: (silent?: boolean) => void };
  interactables: Interactable[];
  registry: WorldRegistry;
  cabins: Cabins | null;
  landmarks: PineLandmarks | null;
  trees: readonly TreeInstance[];
  fullMap: FullMap;
  compendium: { readonly def: { readonly entries: readonly { readonly id: string }[] }; stats: (id: string) => { readonly state: string } } | null;
  chunkId: string;
  params: URLSearchParams;
  touchUi: () => boolean;
  nolock: boolean;
}

export interface PineQuest {
  useSfx: (sfx: PineHollowSfx) => void;
  /** where the pale stag stands while it leads (null: not out) — the weather's dawn fog closes round it (PH-C7) */
  stagAt: () => THREE.Vector3 | null;
}

const _v = new THREE.Vector3();

/** `deps`: the people's preload and the quest UI's loader (the page's by default; a test passes its own) */
/** the quest views, loaded after the NPC models (`deps.loadQuest` lets a test fail it) */
async function loadQuest() {
  const [{ RewardCaption }, { QuestViews, bindQuestPageInteractions }] = await Promise.all([import('@wildshard/engine/quest/view/ui'), import('@wildshard/game/plugin/ui')]);
  return { QuestViews, bindQuestPageInteractions, RewardCaption };
}
export async function installPineQuest(h: PineQuestHost, deps: { preload?: () => Promise<void>; loadQuest?: typeof loadQuest } = {}): Promise<PineQuest> {
  const panels = await readDataPanels(h.ctx.product);
  const boardPanel = panels['board'], countPanel = panels['count'];
  if (boardPanel === undefined || countPanel === undefined) throw new Error('Pine requires its named quest panels');
  const story = await readQuestStory(h.ctx);
  const native = parsePineQuestRows(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/native.json'))));
  const { resinCount: RESIN_COUNT, resinFlag: RESIN_FLAG, tokenFlag: TOKEN_FLAG, tokenNames: TOKEN_NAMES } = native.policy;
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/stall.json')));
  const exchangeRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/exchange.json')));
  const trades = parseTradeCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/trades.json'))));
  const contracts = parseContractCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/contracts.json'))));
  const lanternRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/lanterns.json'))));
  const consequenceRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/consequences.json'))));
  const doorRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/mill-door.json'))));
  const clockRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/clock.json'))));
  const transactionRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await h.ctx.product.file('quests/transactions.json'))));
  await Promise.all([(deps.preload ?? preloadNpcModels)(), loadCodeParts()]); // the people, and the stand-ins' and rides' baked parts
  if (h.ctx.scope.disposed) throw new Error('Pine Hollow was unloaded during the NPC model load');
  const { QuestViews, bindQuestPageInteractions, RewardCaption } = await (deps.loadQuest ?? loadQuest)();
  const { ctx } = h;
  const { game, sky, player, animals, hud, inventory, progress } = h;
  const flags = new Flags(h.chunkId);
  if (h.params.has('resetquest')) flags.reset();
  const beatParam = h.params.get('quest');
  const beat = beatParam === null ? undefined : native.beats[beatParam];
  if (beat) { flags.reset(); for (const f of beat.flags) flags.set(f); }
  const serviceActions = await readQuestServiceActions(ctx, story.quest.id, 'quests/services.json');
  const facts = bindRuntimeLedger(ctx, source, h.chunkId), featFacts = await bindStoryAchievements(ctx, story, progress, h.chunkId, facts);
  const { state: quest, cables } = bindRuntimeQuest(ctx, source, story.quest.id, { flags, facts });

  let sfx: PineHollowSfx | null = null;
  const kitSfx = new InteractSfx(h.audio);
  const shot = (name: Parameters<PineHollowSfx['shot']>[0], at?: THREE.Vector3): void => { sfx?.shot(name, at ? { at } : {}); };

  // ── floors + placements (world coordinates only) ──
  const { floorAt, place } = createQuestPlacements({ terrain: heightAt, registry: h.registry, registryReach: 20 });

  // ── the tower's frame (the lookout: local −Z faces the landing), its deck height ──
  const towerY = heightAt(LAYOUT.LOOKOUT.x, LAYOUT.LOOKOUT.z), deckY = towerY + 11;
  const tower = (lx: number, lz: number): { x: number; z: number } => {
    const [x, z] = yawWorld({ x: LAYOUT.LOOKOUT.x, z: LAYOUT.LOOKOUT.z, yaw: ZIP_YAW }, lx, lz); return { x, z };
  };

  // ── the table's sites ──
  const { table, interactions: lanternRules } = native;
  const kit = new Interactables({ scene: game.scene, sky, player, flags, place, floorAt, prompts: h.interactables }).build(table);
  ctx.system({ id: 'quest.kit', phase: 'update', after: ['engine.compendium.installCompendium'], before: ['quest.pool', 'hud.combat', 'main.frame'], run: (dt, t) => { kit.update(dt, t); } });

  // ── the beaver pool behind the dam (E322 F-L6): the sluice's flag drains it, and a reload with it open starts drained ──
  const pool = await new BeaverPool(sky).build();
  game.scene.add(pool.group);
  pool.setOpen(flags.has('open:dam-sluice'), true);
  ctx.scope.onDispose(flags.onChange((f, on) => { if (f === 'open:dam-sluice') pool.setOpen(on); }));
  ctx.system({ id: 'quest.pool', phase: 'update', after: ['quest.kit'], before: ['quest.shelf', 'quest', 'hud.combat', 'main.frame'], run: (dt) => { pool.update(dt); } });

  // ── the counters, the toasts ──
  const ui = new QuestViews(ctx);
  const chip = ui.view('count', (scope) => new DataPanel(countPanel, { scope }));
  const tokenCount = (): number => flags.count(TOKEN_FLAG), resinCount = (): number => flags.count(RESIN_FLAG);
  // PH-C8: all eight tokens → the pine rack of them on the ranger's mantel (a model: tokenShelf.ts places it)
  const rangerRoot = h.cabins?.roots[0];
  const shelf = rangerRoot ? placeTokenShelf(sky, rangerRoot, h.registry) : null;
  if (shelf) {
    shelf.setShown(tokenCount() === TOKEN_NAMES.length);
    ctx.system({ id: 'quest.shelf', phase: 'update', after: ['quest.pool'], before: ['quest', 'hud.combat', 'main.frame'], run: () => { shelf.update(game.camera); } });
  }
  kit.onEvent = kitSfx.bindEvents(native.events, { toast: text => { hud.toast(text); }, calls: new Map<string, (e: InteractEvent) => void>([
    ['resin', () => { inventory.add('amber-resin'); chip().show({ label: 'Amber resin', n: resinCount(), of: RESIN_COUNT }); }],
    ['all-resin', () => { if (resinCount() === RESIN_COUNT) hud.toast(`Every drop of amber in the Hollow · ${RESIN_COUNT} / ${RESIN_COUNT}`); }],
    ['token', e => { const i = Number(e.def.id.split('-')[1] ?? '1') - 1;
      chip().show({ label: 'Carved tokens', n: tokenCount(), of: TOKEN_NAMES.length }); hud.toast(`Carved token — ${TOKEN_NAMES[i] ?? 'somewhere quiet'}`); }],
    ['all-tokens', () => { if (tokenCount() === TOKEN_NAMES.length) { hud.toast("All eight carved tokens — they're on the ranger's mantel now"); shelf?.setShown(true); } }],
    ['pickup', () => { h.music.sting('pickup'); }],
  ]) });
  // the vista bench: sit → face the far country, a little lift of the chin
  bindStoryBench(story, kit, player, new Map<string, unknown>([['hud', hud]]));

  // ── the lanterns ──
  const lm = h.landmarks;
  const WS = waystoneSites();
  const lanternId = (f: string): LanternId => (f === 'lit:pond' ? 'pond' : f === 'lit:ridge' ? 'ridge' : 'den');
  const syncLanterns = (): void => { if (lm) for (const f of LANTERN_FLAGS) lm.setLit(lanternId(f), flags.has(f) || flags.has(QUEST_DONE)); };
  syncLanterns();
  const points = Object.fromEntries((['pond', 'ridge', 'den'] as const).map(id => [id, new THREE.Vector3(WS[id].x, floorAt(WS[id].x, WS[id].z) + 1.2, WS[id].z)]));
  const lanternPage = bindQuestPageInteractions(lanternRows, { flags, interactions: lanternRules, timer: ui,
    promptIds: ['pond', 'ridge', 'den'], interactables: h.interactables, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['points', points], ['lamps', lm], ['sound', { shot }], ['sfx', kitSfx]]) });
  const lanternPrompts = { pond: lanternPage.prompt('pond'), ridge: lanternPage.prompt('ridge'), den: lanternPage.prompt('den') };

  // ── the miller's errand: the wheel stands still until the race is clear ──
  const syncWheel = (): void => { if (h.cabins) h.cabins.wheelSpeed = flags.has('errand:done') ? 0.55 : 0; };
  syncWheel();
  const consequences = bindQuestPageInteractions(consequenceRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['flags', flags], ['inventory', inventory], ['music', h.music], ['native', { syncWheel }]]) });
  // the mill's door (E322 F-M7): a cabin door like the others (Cabin.ts swings it, its kinematic piece follows the pivot),
  // barred until the race is clear — pressed before `errand:done` it only rattles. The cabin door's own piece lets go of the
  // player within 1.4 m of its hinge (main.ts: a swing never pins anyone), so while barred a second piece holds the shut
  // leaf solid: the same slab, following the same pivot, on until the errand is done
  const millDoor = ((): { prompt: Interactable; use: () => void } | null => {
    const mill = h.cabins?.buildings.find((b) => b.id === 'watermill');
    const piece = mill ? h.cabins?.doorPieces().find((d) => d.id === `cabin-${mill.index + 1}-door`) : undefined;
    if (!piece) return null;
    h.registry.add({ id: `${piece.id}-bar`, name: 'Mill door bar', category: 'buildings', file: 'src/shards/pine-hollow/quest/index.ts', surface: 'wood',
      follows: piece.pivot, colliders: piece.colliders, active: () => !flags.has('errand:done') });
    const hinge = piece.pivot.getWorldPosition(new THREE.Vector3());
    let best: Interactable | null = null, bestD = 1.5; // the prompt stands ~0.7 m from its hinge; the next door is metres off
    for (const it of h.cabins?.interactables ?? []) {
      const d = Math.hypot(it.position.x - hinge.x, it.position.z - hinge.z);
      if (d < bestD && /^(Open|Close) door$/.test(it.label)) { best = it; bestD = d; }
    }
    return best === null ? null : { prompt: best, use: piece.use };
  })();
  if (millDoor) bindQuestPageInteractions(doorRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['door', millDoor], ['sfx', kitSfx]]) });
  const night = (): number => sky.dayNight?.night ?? 0;
  const waveRows = await readSpawnScript(ctx.product, 'pine.night');
  if (ctx.scope.disposed) throw new Error('Pine left during night director admission');
  const thralls = new NightThralls({
    animals, scene: game.scene, night,
    errand: () => flags.has('errand:asked') && !flags.has('errand:done'),
    onErrandDone: consequences.action('errand.complete'),
    shot: (name, at) => { shot(name, at); },
  }, waveRows);

  // ── the lodge's contract board ──
  const lodge = bindRuntimeState(ctx, source, 'pine.lodge', () => JSON.stringify(lodgeSave.read(h.chunkId)), h.chunkId);
  const store = { getItem: (_key: string): string => String(lodge.read()), setItem: (_key: string, raw: string): void => {
    v.parse(jsonSchema, JSON.parse(raw) as unknown); lodge.write(raw);
  } };
  const board: Board = loadBoard(contracts, store.getItem(contracts.store));
  const persistBoard = (): void => { try { store.setItem(contracts.store, saveBoard(board)); } catch { /* storage unavailable */ } };
  const traderVoice = new THREE.Vector3();   // his head (set once he stands in his stall, below)
  const transactions = bindQuestPageInteractions(transactionRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['inventory', inventory], ['crossbow', h.crossbow], ['skins', h.skins], ['music', h.music], ['sfx', kitSfx],
      ['ammo', { get add() { return h.crossbow.addAmmo?.bind(h.crossbow) ?? null; } }], ['voice', { get current() { return sfx; } }], ['points', { trader: traderVoice }],
      ['finishes', Object.fromEntries((['hollow-ash', 'scarback-furnace'] as const).map(id => [id, { wear: () => { h.wearSkin(HeldFinishes.current(h.ctx.manifest.slug).get(id)); } }]))]]) });
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
  const bs = contractBoardSite();
  const boardPrompt: Interactable = {
    position: new THREE.Vector3(bs.x, heightAt(bs.x, bs.z) + 1.3, bs.z),
    get radius() { return boardUi().isOpen ? 0 : 2.8; },
    get label() { return board.slots.some(isFilled) ? 'Read the contract board — one is filled' : 'Read the contract board'; },
    onInteract: () => { boardUi().open(); kitSfx.interact('door', boardPrompt.position, { gain: 0.5 }); },
  };
  h.interactables.push(boardPrompt);

  // ── the trader's slate ──
  const owns = (s: string): boolean => HeldFinishes.current(h.ctx.manifest.slug).has(s) && h.skins.has(s);
  const room = (k: AmmoKind, n: number) => h.crossbow.room?.(k, n) ?? true;
  const exchange = new Exchange(exchangeRows, new Map<string, unknown>([['pack', inventory], ['skins', { owns, own: h.skins.own.bind(h.skins) }],
    ['ammo', { capacity: room, addBolts: h.crossbow.addBolts.bind(h.crossbow), grant: (kind: Exclude<AmmoKind, 'iron'>, n: number) => h.crossbow.addAmmo?.(kind, n) }]]));
  // the platform draws the stall (SF28; the G87 sheet since G181): the goods and the rules are declared here
  const trade = ui.view('trade', (scope) => {
    const panel = new ShopPanel<TradeGood>({
      trader: 'Mott', place: 'Pine Hollow', goods: trades.goods, verb: 'Trade',
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
    const paid = flags.has('errand:paid');
    commitQuestEffects(ctx, story.quest.id, steps.signal({ kind: 'talk', target: 'miller' }, { flags: flags.all,
      inventory: Object.fromEntries(inventory.items.map(item => [item.id, item.count])) }));
    if (!paid && flags.has('errand:paid')) serviceActions.run('miller.pay');
  };

  // ── panels: the board and the slate release the lock + the weapons like the journal ──
  ui.panelHold({ hud, weapons: h.weapons, menu: h.menu, nolock: h.nolock, touchUi: h.touchUi,
    panels: [boardUi, trade], closeMenu: true, resetOnLeave: true });

  // ── the people ──
  const figures: QuestNpcTalkPorts<NpcFigure>['figures'] = new Map((['ranger', 'miller', 'trader'] as const).map(kind => [kind, {
    kind: 'posed', create: (at, yaw) => makeNpcFigure(kind, sky, at, yaw), bark: fig => { sfx?.bark(kind, fig.talkPoint); },
  }]));
  const talks = installStoryTalks(ui, source, { flags, scene: game.scene, registry: h.registry,
    prompts: h.interactables, figures, groundAt: floorAt, calls: new Map([['pay-miller', payMiller], ['trade', tradeOwner.open]]) });
  const { people, dialogue } = talks;
  const { at: rangerAt, cos: rcos, sin: rsin } = NPC_ROSTER.ranger;
  const trader = people.find(person => person.kind === 'trader');
  if (trader === undefined) throw new Error('The declared trader is required');
  traderVoice.copy(trader.fig.talkPoint);

  // ── kills: the King, thralls, the contracts ──
  const killed = bindQuestDeathEffects(native.pageDeaths, { flags, kill: featFacts.kill, event: featFacts.event,
    calls: new Map([['contracts', (a: AnimalManager['animals'][number]) => {
      const moved = recordKill(contracts, board, { kind: a.kind, variant: a.variant, rarity: a.rarity, elite: eliteOf(contracts, a.kind, a.variant), tags: isPineThrall(a) ? ['thrall'] : [] });
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

  // ── the rides ──
  const cableId = 'pine.zipline';
  let zip: { trolley: THREE.Mesh; prompt: ReturnType<typeof cables.bindView> } | null = null, canoe: { group: THREE.Mesh } | null = null;
  let motion: MoverRuntime | null = null;
  if (lm) {
    const trolley = new THREE.Mesh(codePart('zip-trolley'), npcMaterial(sky)); trolley.castShadow = true; trolley.name = 'zip-trolley';
    zip = { trolley, prompt: cables.bindView(cableId, trolley, player,
      { position: new THREE.Vector3(lm.zip.launch.x, lm.zip.launch.y + 1.1, lm.zip.launch.z), radius: 2.3, label: 'Ride the zipline' }, game.camera) };
    game.scene.add(zip.trolley); h.interactables.push(zip.prompt);
    const world = ctx.game.runtime?.world; if (world === undefined || world === null) throw new Error('Canoe requires its active world');
    canoe = { group: new THREE.Mesh(codePart('canoe'), npcMaterial(sky)) }; canoe.group.castShadow = true; canoe.group.visible = false; canoe.group.name = 'canoe-ride';
    game.scene.add(canoe.group);
    motion = await installDeclaredMovers(ctx, world, { data: ctx.product.shardfile.movers, modules: new Map(), flags, prompts: h.interactables, systemId: 'pine.movers',
      borrowed: { rows: [{ id: 'pine.canoe', target: 'canoe', group: 'group', visibility: 'enabled', order: 'XYZ' }], targets: { canoe } } });
  }

  // ── the hollow log: a model (E315 M2) placed once on its bed; its materials are the cabins' (already loaded, so it
  // lands a frame later). Its LOD (the shell alone past 60 m) is the model's
  let hollow: HollowLog | null = null;
  const logModels = pineModels(sky);
  void loadHollowLog(logModels).then(() => {
    const site = hollowLogSite();
    placeModel(hollowLog, [{ x: HOLLOW_LOG.x, y: site.floorY, z: HOLLOW_LOG.z, yaw: HOLLOW_LOG.yaw }],
      { ctx: logModels, draw: 'single', registry: h.registry, piece: { id: 'hollow-log', floor: (x, z) => (insideHollowLog(x, z) ? site.floorY : undefined), solidFloor: true } });
    hollow = site;
    return site;
  });

  // ── the clock: Hale's watch till dark, the dawn ──
  const presentation=presentQuestStory(story,{scope:ctx.scope,player,fullMap:{setQuest:h.fullMap.setQuest.bind(h.fullMap)},toast:text=>{hud.toast(text);},sting:()=>{h.music.sting('chunk');}},quest,
    {afterStep:step=>{if(step?.id==='dawn')runDawn();}});
  const questChip=presentation.chip;
  const objective = questChip.line;
  const reward = new RewardCaption('Dawn over the Hollow', "The Warden's Hollow", 'Every lantern burns. The fog is going home.');
  ui.retainRoot(objective.root, () => { objective.hide(false); });
  ui.retainRoot(reward.root, () => { reward.show(false); });
  let ff: { from: number; span: number; t: number; dur: number; to: number } | null = null;
  const fastForward = (to: number, dur: number): void => {
    const dn = sky.dayNight; if (!dn) return;
    const span = (((to - dn.phase) % 1) + 1) % 1;
    ff = { from: dn.phase, span, t: 0, dur, to };
  };
  const clockPage = bindQuestPageInteractions(clockRows, { flags, toast: text => { hud.toast(text); },
    owners: new Map<string, unknown>([['flags', flags], ['inventory', inventory], ['music', h.music], ['lamps', lm],
      ['caption', reward], ['objective', objective], ['native', { fastForward }]]) });
  const dawnAtBoot = quest.current?.id === 'dawn';
  const director = await readDirectorProduct(ctx.product, ctx.scope);
  const clock = DirectorScriptStageLane.bind(director.stages, director.create(), director.bindings,
    new Map<string, unknown>([['flags', flags], ['clock', { day: () => sky.dayNight, night }], ['publication', { publish: clockPage.run }]]), ctx.scope);
  if (dawnAtBoot) clock.request('dawn.request');
  ctx.scope.onDispose(flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') clock.request('night.request');
    if (f.startsWith('lit:')) syncLanterns();
  }));
  function runDawn():void { clock.request('dawn.request'); }

  // ── the quest ──

  // ── the stag ──
  const stag = new StagLead(game.scene, animals, native.lead);
  stag.onAppear = (first) => { if (first) serviceActions.run('stag.appear'); };
  stag.onDone = () => { commitQuestEffects(ctx, story.quest.id, steps.signal({ kind: 'follow', target: 'stag' }, { flags: flags.all })); serviceActions.run('stag.complete'); };

  // ── the map (C9's hook): the places with discovery, the live quest markers ──
  const liveMarkers = (): { label: string; x: number; z: number; short: string }[] => quest.markers().map((m) => ({ label: m.label, short: m.short ?? m.label, x: m.at.x, z: m.at.z }));
  h.fullMap.setPois((): MapPoi[] => [
    ...LAYOUT.PINE_HOLLOW_POIS.map((p): MapPoi => (flags.has(`seen:${p.id}`) ? { x: p.x, z: p.z, label: p.name, kind: 'place' } : { x: p.x, z: p.z, label: '?', kind: 'unknown' })),
    ...liveMarkers().map((m): MapPoi => ({ x: m.x, z: m.z, label: m.label, kind: 'quest' })),
  ], { declutter: true });
  // the zones a place's name does not already say (the Ridge, the old-growth, the Hollow), the real pines, the hamlet's roofs
  const placeNames = new Set(LAYOUT.PINE_HOLLOW_POIS.map((p) => p.name.toUpperCase()));
  h.fullMap.setZones(LAYOUT.PINE_HOLLOW_ZONES.filter((zn) => !placeNames.has(zn.label)));
  h.fullMap.setFeatures({ trees: h.trees, roofs: hamletRoofs() });

  // ── the event achievements, read back from the flags (a save from before an achievement still earns it) ──
  observeStoryFlags(story, ctx.scope, flags, new Map<string, unknown>([['counters', featFacts], ['hud', hud]]));
  const journalFull = (): boolean => {
    const st = h.compendium; if (!st) return false;
    return st.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; });
  };

  // ── per frame ──
  let slowT = 0;
  ctx.system({ id: 'quest', phase: 'update', after: ['quest.kit', 'quest.pool', 'quest.shelf'], before: ['hud.combat', 'main.frame'], run: (dt, t) => {
    const pp = player.position;
    talks.update(dt, t, pp);
    if (zip !== null && lm) {
      cables.update(cableId, dt);
      for (const on of cables.takeTransitions(cableId)) {
        h.weapons.visible = !on; h.weapons.setEnabled(!on);
        if (on) { shot('zipline', lm.zip.top); kitSfx.interact('lever', lm.zip.launch); }
        else { kitSfx.interact('plate', lm.zip.landing); hud.toast('Down the line and into the Hollow'); }
      }
    }
    for (const event of motion?.takeRideTransitions('pine.canoe') ?? []) {
      h.weapons.visible = !event.riding; h.weapons.setEnabled(!event.riding);
      if (event.riding && motion !== null) {
        const at = motion.data.find(row => row.id === 'pine.canoe')?.at; if (at === undefined) throw new Error('Missing canoe rest pose');
        lm?.setCanoeAway(true); kitSfx.interact('door', new THREE.Vector3(at.x, at.y, at.z), { gain: 0.6 });
      }
      if (event.arrived === -1) lm?.setCanoeAway(false);
      if (event.hint !== undefined) hud.toast(event.hint);
    }
    if (ff && sky.dayNight) {
      ff.t += dt;
      const k = Math.min(1, ff.t / ff.dur), e = k * k * (3 - 2 * k);
      sky.dayNight.phase = (ff.from + ff.span * e) % 1;
      if (k >= 1) { const to = ff.to; ff = null; void sky.dayNight.set(to); }
    }
    clock.update(dt);
    if (!perfLap.active) { // E350 F-J1: the PERF LAP's teleports call no stag and no thralls
      stag.update(dt, t, quest.current?.id === 'stag' && night() > 0.5, pp);
      thralls.update(dt, t, pp);
    }
    questChip.update(t, player);
    if (t - slowT > 0.5) {
      slowT = t;
      const cam = game.camera.position;
      for (const p of people) p.lod(cam);
      if (zip) zip.trolley.visible = cables.state(cableId).riding || cam.distanceToSquared(zip.trolley.position) < 160 * 160;
      if (!perfLap.active) for (const p of LAYOUT.PINE_HOLLOW_POIS) if (!flags.has(`seen:${p.id}`) && Math.hypot(p.x - pp.x, p.z - pp.z) < p.r) flags.set(`seen:${p.id}`); // E350 F-J1: a lap's spot is not discovered
      if (!perfLap.active && hollow && !flags.has('secret:log') && hollow.mid.distanceToSquared(_v.set(pp.x, hollow.floorY, pp.z)) < 2.2 * 2.2 && Math.abs(pp.y - hollow.floorY) < 0.8) {
        flags.set('secret:log'); hud.toast('Inside the fallen giant. It smells of rain and old resin');
      }
      if (journalFull()) featFacts.event('journal', 1);
    }
  } });

  // ── dev: `?quest=<beat>` puts you where the beat starts (and `__pineQuest.goto(beat)` does it without a reload) ──
  const standAt = (b: NonNullable<typeof beat>): void => {
    const at = b.at === 'ranger' ? { x: rangerAt.x + 3.5 * rcos, z: rangerAt.z - 3.5 * rsin } : b.at === 'deck' ? tower(-1.2, -2.9) : b.at === 'launch' && lm ? { x: lm.zip.launch.x, z: lm.zip.launch.z } : b.at === 'lodge' ? { x: bs.x - Math.sin(bs.yaw) * 3, z: bs.z - Math.cos(bs.yaw) * 3 } : { x: b.x, z: b.z };
    const look = b.at === 'ranger' ? rangerAt : b.at === 'launch' && lm ? { x: lm.zip.bottom.x, z: lm.zip.bottom.z } : b.at === 'lodge' ? bs : b.look;
    player.spawn(at.x, at.z, Math.atan2(-(look.x - at.x), -(look.z - at.z)));
    if (b.at === 'deck' || b.at === 'launch') player.position.y = deckY + 0.05;
    if (b.night && sky.dayNight) void sky.dayNight.set(PINE_PHASES.night);
    if (b.day && sky.dayNight) void sky.dayNight.set(PINE_PHASES.day);
  };
  if (beat) standAt(beat);
  const goto = (bt: string): void => {
    const b = native.beats[bt]; if (b === undefined) return;
    flags.reset(); for (const f of b.flags) flags.set(f);
    syncLanterns(); syncWheel();
    standAt(b);
    if (quest.current?.id === 'dawn') runDawn();
  };
  const debug = {
    flags, quest, board, kit, stag, thralls, people, content: native.content,
    jump: goto, goto,
    dawn: runDawn, night: (): void => { fastForward(PINE_PHASES.night, 2); },
    zip, cables, canoe, movers: motion, lanterns: lanternPrompts, hollow: (): HollowLog | null => hollow,
    openBoard: (): void => { boardUi().open(); }, openTrade: (): void => { trade().open(); },
    callThralls: (): void => { thralls.force(player.position); },
    give: (id: ItemId, n = 1): void => { inventory.add(id, n); },
    fill: (i: number): void => { const c = board.slots[i]; if (c) { c.have = c.need; persistBoard(); } },
    test: (c: { all?: string[] }): boolean => test(flags, c),
  };
  ctx.debug.expose('pine.quest', debug);
  ctx.debug.expose(`harness.quest.${ctx.manifest.slug}`, () => flags.all.slice().sort());
  if (!ui.exposeBrowser('__pineQuest', debug)) ctx.scope.expose(window, '__pineQuest', debug);
  ctx.scope.onDispose(() => {
    objective.root.remove(); reward.root.remove();
    ui.disposeLegacy(() => { dialogue().dispose(); boardUi().root.remove(); trade().root.remove(); chip().root.remove(); });
  });
  if (quest.current?.id === 'dawn') runDawn();   // an early kill (or `?quest=dawn`): the dawn plays now
  return { useSfx: (s) => { sfx = s; }, stagAt: () => stag.position };
}
