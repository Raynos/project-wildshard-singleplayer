import * as v from 'valibot';
import { interactionRules } from '@wildshard/sdk/interactions';
import { PINE_LANTERN_IDS, pineQuestRows } from './graph';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Game } from '@wildshard/engine/core/Game';
import { perfLap } from '@wildshard/engine/core/perfLap';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { place as placeModel } from '@wildshard/engine/models/place';
import { boxInFrame } from '@wildshard/engine/physics/box';
import type { Player } from '@wildshard/engine/player/Player';
import type { SkinDef } from '@wildshard/engine/player/Skins';
import type { NpcDef } from '@wildshard/engine/quest/core';
import type { NpcTalk } from '@wildshard/engine/quest/view';
import { saves } from '@wildshard/engine/saves/runtime';
import { jsonSchema } from '@wildshard/engine/saves/slots';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { FullMap, MapPoi } from '@wildshard/engine/ui/Map';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import { Flags, test } from '@wildshard/engine/world/interact/flags';
import { Interactables, type InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import type { Place, Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { CompendiumState } from '@wildshard/game/compendium/state';
import type { SkinLocker } from '@wildshard/game/cosmetics/locker';
import type { Inventory, ItemId } from '@wildshard/game/Inventory';
import { ShopPanel } from '@wildshard/game/loot/ui/ShopPanel';
import type { Progress } from '@wildshard/game/Progress';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeLedger, bindRuntimeQuest, bindRuntimeState } from '@wildshard/game/shardfile/hybridRows';
import { PineQuestLifetime } from '../runtime/questLifetime';
import { bindPineFacts } from '../runtime/facts';
import { isPineThrall, recordPineFeatKill, syncPineFlagFeats } from './featLaw';
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
 *   src/shards/pine-hollow/models/people.ts   the ranger / miller / trader stand-ins — ONE factory PH-M4 swaps
 *   contracts.ts   the lodge's rotating three (pure)      trades.ts   the trader's swaps (pure)
 *   rides.ts       the zipline ride, the canoe to the islet             hollowLog.ts   the hollow-log passage
 *   stagLead.ts    beat 5, the pale stag down the west road            nightThralls.ts the old-growth's night + the millrace
 *   ui.ts          the board, the slate, the counter                     beats.ts       `?quest=<beat>` dev jumps
 *
 * Dev: `?quest=ranger|pond|ridge|zip|den|stag|king|dawn|done` (beats.ts), `?resetquest`, `window.__pineQuest`.
 */
import * as THREE from 'three';
import type { Cabins } from '../world/homestead';
import type { PineHollowSfx } from '../runtime/audio/sfx';
import { SKINS } from '../loadout/skins';
import { PINE_PHASES } from '../look/dayKeys';
import type { PineClockEvent } from '../runtime/questClock';
import { installPineClock } from '../runtime/questDirector';
import { waystoneSites, contractBoardSite, CANOE_SITE, type PineLandmarks } from '../world/landmarks';
import { ZIP_YAW } from '../world/timberSites';
import { hamletRoofs } from '../world/cabinBake';
import { BEAVER_DAM, CREEK, CABIN_SITES, HAMLET_SITES, ISLET, LOOKOUT, PINE_HOLLOW_POIS, PINE_HOLLOW_ZONES, POND, STANDING_STONES, KINGS_CLEARING, WATERFALL, CREEK_BRIDGE } from '../layout';
import { KING_KIND } from '../runtime/antlerKing';
import { WARDENS_HOLLOW, RANGER, MILLER, TRADER, QUEST_DONE, LANTERN_FLAGS, type LanternId } from './wardensHollow';
import { pineTable, RESIN_SPOTS, RESIN_COUNT, RESIN_FLAG, TOKEN_FLAG, TOKEN_NAMES, type Spot } from './table';
import { makeNpcFigure, type NpcFigure, type NpcKind } from '../models/people';
import { preloadNpcModels } from './npcModels';
import { loadBoard, saveBoard, recordKill, claim, reroll, eliteOf, isFilled, type Board } from './contracts';
import { pineBenchPose } from './benchPose';
import { TRADE_GOODS, tradeCost, tradeShopState, type Room, type TradeGood, type TradeItem } from './trades';
import { BoardPanel, CountChip } from './ui';
import { ZipRide, CanoeRide } from './rides';
import { hollowLogFloor, hollowLogSite, insideHollowLog, HOLLOW_LOG, type HollowLog } from './hollowLog';
import { hollowLog, loadHollowLog } from '../models/hollowLog';
import { pineModels } from '../world/context';
import { StagLead } from './stagLead';
import { NightThralls } from './nightThralls';
import { BEATS, beatFlags, isBeat, type Beat } from './beats';
import { placeTokenShelf } from './tokenShelf';
import { PINE_QUEST_CONTENT } from './content';
import { BeaverPool } from '../world/beaverPool';

const lodgeSave = saves.define({ key: 'lodge', scope: 'shard', version: 1, schema: jsonSchema, initial: () => null });

export interface PineQuestHost {
  ctx: ShardContext;
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  hud: HUD; audio: Audio; music: Music;
  inventory: Inventory; progress: Progress; skins: SkinLocker; wearSkin: (s: SkinDef) => void;
  weapons: { setEnabled: (on: boolean) => void; visible: boolean };
  /** the crossbow's bolts, and the loadout's special ammo (PH-C11: pitch / broadhead bolts, cartridges, arrows) */
  crossbow: { addBolts: (n: number) => void; addAmmo?: (kind: 'pitch' | 'broadhead' | 'cartridge' | 'arrow', n: number) => void; /** can the kit hold n more? (E314 C: no trade into a full quiver) */ room?: Room };
  menu: { isOpen: boolean; close: (silent?: boolean) => void };
  interactables: Interactable[];
  registry: WorldRegistry;
  cabins: Cabins | null;
  landmarks: PineLandmarks | null;
  trees: readonly TreeInstance[];
  fullMap: FullMap;
  compendium: CompendiumState | null;
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

const TALK_R = 3.2;
const _v = new THREE.Vector3();

/** `deps`: the people's preload and the quest UI's loader (the page's by default; a test passes its own) */
/** the quest views, loaded after the NPC models (`deps.loadQuest` lets a test fail it) */
async function loadQuest() {
  const [{ QuestChip, NpcTalk }, { DialogueBox, RewardCaption }] = await Promise.all([import('@wildshard/engine/quest/view'), import('@wildshard/engine/quest/view/ui')]);
  return { QuestChip, NpcTalk, DialogueBox, RewardCaption };
}
export async function installPineQuest(h: PineQuestHost, deps: { preload?: () => Promise<void>; loadQuest?: typeof loadQuest } = {}): Promise<PineQuest> {
  await (deps.preload ?? preloadNpcModels)();
  if (h.ctx.scope.disposed) throw new Error('Pine Hollow was unloaded during the NPC model load');
  const { DialogueBox, QuestChip, NpcTalk, RewardCaption } = await (deps.loadQuest ?? loadQuest)();
  const { ctx } = h;
  const { game, sky, player, animals, hud, inventory, progress } = h;
  const flags = new Flags(h.chunkId);
  if (h.params.has('resetquest')) flags.reset();
  const beatParam = h.params.get('quest');
  const beat: Beat | null = beatParam !== null && isBeat(beatParam) ? beatParam : null;
  if (beat) { flags.reset(); for (const f of beatFlags(beat)) flags.set(f); }
  const facts = bindRuntimeLedger(ctx, source, h.chunkId), featFacts = bindPineFacts(ctx, progress, h.chunkId, facts);
  const quest = bindRuntimeQuest(ctx, source, 'wardens-hollow', { flags, facts }).state;

  let sfx: PineHollowSfx | null = null;
  const kitSfx = new InteractSfx(h.audio);
  const shot = (name: Parameters<PineHollowSfx['shot']>[0], at?: THREE.Vector3): void => { sfx?.shot(name, at ? { at } : {}); };

  // ── floors + placements (world coordinates only) ──
  const floorAt = (x: number, z: number): number => {
    let y = heightAt(x, z);
    const r = h.registry.floorAt(x, z);
    if (r !== undefined && r > y && r - y < 20) y = r;
    return y;
  };
  const place = (p: Place): { x: number; y: number; z: number; yaw: number } => ({ x: p.x, z: p.z, yaw: p.yaw ?? 0, y: p.y ?? floorAt(p.x, p.z) + (p.dy ?? 0) });

  // ── the tower's frame (the lookout: local −Z faces the landing), its deck height ──
  const towerY = heightAt(LOOKOUT.x, LOOKOUT.z), deckY = towerY + 11;
  const tower = (lx: number, lz: number): { x: number; z: number } => {
    const c = Math.cos(ZIP_YAW), s = Math.sin(ZIP_YAW);
    return { x: LOOKOUT.x + lx * c + lz * s, z: LOOKOUT.z - lx * s + lz * c };
  };

  // ── the table's sites ──
  const resin: Spot[] = RESIN_SPOTS.map(([x, z]) => {
    let best: TreeInstance | null = null, bd = 9 * 9;
    for (const t of h.trees) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
    if (!best) return { x, z, dy: 0.25 };
    const dx = x - best.x, dz = z - best.z, d = Math.hypot(dx, dz) || 1, r = Math.max(0.18, best.r) + 0.07;
    const px = best.x + (dx / d) * r, pz = best.z + (dz / d) * r;
    return { x: px, z: pz, y: heightAt(best.x, best.z) + 1.15 };
  });
  const stone = STANDING_STONES[3] ?? [KINGS_CLEARING.x, KINGS_CLEARING.z - 24];
  const toC = Math.hypot(KINGS_CLEARING.x - stone[0], KINGS_CLEARING.z - stone[1]) || 1;
  const deckTok = tower(2.85, -2.85), finder = tower(0.9, 1.45), bench = tower(-2.8, 2.8);   // the bench: the catwalk's NW corner, over the lake and the snow range
  const tokens: Spot[] = [
    { x: deckTok.x, z: deckTok.z, y: deckY + 0.05 },
    { x: HOLLOW_LOG.x, z: HOLLOW_LOG.z, y: hollowLogFloor() },                           // inside the hollow log, on its bed
    { x: ISLET.x + 1.5, z: ISLET.z + 1.0 },
    { x: stone[0] + ((KINGS_CLEARING.x - stone[0]) / toC) * 2.2, z: stone[1] + ((KINGS_CLEARING.z - stone[1]) / toC) * 2.2 },
    { x: WATERFALL.foot.x + 7.5, z: WATERFALL.foot.z + 5 },
    { x: CABIN_SITES[2]?.x ?? 118, z: (CABIN_SITES[2]?.z ?? 142) - 6.5 },
    { x: HAMLET_SITES.shed.x + 2.6, z: HAMLET_SITES.shed.z - 2.2 },
    { x: CREEK_BRIDGE.x + 4.2, z: CREEK_BRIDGE.z + 1.4 },
  ];
  const d0 = CREEK[BEAVER_DAM.at - 1] ?? [-130, 76], d1 = CREEK[BEAVER_DAM.at + 1] ?? [-146, 38];
  const fl = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]) || 1, fx = (d1[0] - d0[0]) / fl, fz = (d1[1] - d0[1]) / fl;
  const table = pineTable({
    resin, tokens,
    dam: { x: BEAVER_DAM.x, z: BEAVER_DAM.z, fx, fz, ax: fz, az: -fx },
    finder: { x: finder.x, y: deckY + 1.1, z: finder.z },
    bench: { x: bench.x, y: deckY, z: bench.z, yaw: ZIP_YAW - Math.PI / 4 },
  });
  const graph = interactionRules(flags, pineQuestRows(table));
  const kit = new Interactables({ scene: game.scene, sky, player, flags, place, floorAt, prompts: h.interactables }).build(table);
  ctx.system({ id: 'quest.kit', phase: 'update', after: ['engine.compendium.installCompendium'], before: ['quest.pool', 'hud.combat', 'main.frame'], run: (dt, t) => { kit.update(dt, t); } });

  // ── the beaver pool behind the dam (E322 F-L6): the sluice's flag drains it, and a reload with it open starts drained ──
  const pool = new BeaverPool(sky).build();
  game.scene.add(pool.group);
  pool.setOpen(flags.has('open:dam-sluice'), true);
  ctx.scope.onDispose(flags.onChange((f, on) => { if (f === 'open:dam-sluice') pool.setOpen(on); }));
  ctx.system({ id: 'quest.pool', phase: 'update', after: ['quest.kit'], before: ['quest.shelf', 'quest', 'hud.combat', 'main.frame'], run: (dt) => { pool.update(dt); } });

  // ── the counters, the toasts ──
  const ui = new PineQuestLifetime(ctx);
  const chip = ui.view('count', (scope) => new CountChip(scope));
  const tokenCount = (): number => flags.count(TOKEN_FLAG), resinCount = (): number => flags.count(RESIN_FLAG);
  // PH-C8: all eight tokens → the pine rack of them on the ranger's mantel (a model: tokenShelf.ts places it)
  const rangerRoot = h.cabins?.roots[0];
  const shelf = rangerRoot ? placeTokenShelf(sky, rangerRoot, h.registry) : null;
  if (shelf) {
    shelf.setShown(tokenCount() === TOKEN_NAMES.length);
    ctx.system({ id: 'quest.shelf', phase: 'update', after: ['quest.pool'], before: ['quest', 'hud.combat', 'main.frame'], run: () => { shelf.update(game.camera); } });
  }
  kit.onEvent = (e: InteractEvent) => {
    const d = e.def;
    switch (e.type) {
      case 'take':
        if (d.kind === 'pickup' && d.look === 'resin') {
          inventory.add('amber-resin');
          chip().show('Amber resin', resinCount(), RESIN_COUNT);
          kitSfx.interact('chime', e.at, { gain: 0.7 });
          if (resinCount() === RESIN_COUNT) hud.toast(`Every drop of amber in the Hollow · ${RESIN_COUNT} / ${RESIN_COUNT}`);
        } else if (d.kind === 'pickup' && d.look === 'token') {
          const i = Number(d.id.split('-')[1] ?? '1') - 1;
          chip().show('Carved tokens', tokenCount(), TOKEN_NAMES.length);
          hud.toast(`Carved token — ${TOKEN_NAMES[i] ?? 'somewhere quiet'}`);
          kitSfx.interact('glyph', e.at);
          if (tokenCount() === TOKEN_NAMES.length) { hud.toast("All eight carved tokens — they're on the ranger's mantel now"); shelf?.setShown(true); }
        } else { if (e.text) hud.toast(e.text); kitSfx.interact('chime', e.at); h.music.sting('pickup'); }
        break;
      case 'locked': hud.toast(e.text ?? 'Locked'); kitSfx.interact('locked', e.at); break;
      case 'lever': case 'door':
        kitSfx.interact(e.type === 'lever' ? 'lever' : 'grate', e.at);
        if (e.text) hud.toast(e.text);
        break;
      case 'sit': case 'press': case 'release': break;
      case 'open': case 'light': case 'found': case 'use': case 'barrel-reset': if (e.text) hud.toast(e.text); break;
      default: break;
    }
  };
  // the vista bench: sit → face the far country, a little lift of the chin
  kit.onSit = (at, yaw) => {
    const pose = pineBenchPose(at, yaw);
    player.position.set(pose.x, pose.y, pose.z); player.velocity.set(0, 0, 0);
    player.yaw = pose.yaw; player.pitch = pose.pitch;
    hud.toast('You sit a while. The far country goes on and on, blue and then bluer.');
  };

  // ── the lanterns ──
  const lm = h.landmarks;
  const WS = waystoneSites();
  const lanternId = (f: string): LanternId => (f === 'lit:pond' ? 'pond' : f === 'lit:ridge' ? 'ridge' : 'den');
  const syncLanterns = (): void => { if (lm) for (const f of LANTERN_FLAGS) lm.setLit(lanternId(f), flags.has(f) || flags.has(QUEST_DONE)); };
  syncLanterns();
  const NEEDS: Record<LanternId, { needs: string; cold: string; name: string }> = {
    pond: { needs: 'taken:pond-glass', cold: "The pond lantern is cold — its glass is gone", name: 'the pond lantern' },
    ridge: { needs: 'taken:ridge-flint', cold: 'The ridge lantern is cold — you have nothing to light it with', name: 'the ridge lantern' },
    den: { needs: 'talked:ranger', cold: 'A cold waystone lantern', name: 'the den lantern' },
  };
  const lanternPrompts: Partial<Record<LanternId, Interactable>> = {};
  for (const id of ['pond', 'ridge', 'den'] as const) {
    const s = WS[id], flag = `lit:${id}`, n = NEEDS[id];
    const y = floorAt(s.x, s.z);
    const it: Interactable = {
      position: new THREE.Vector3(s.x, y + 1.2, s.z),
      get radius() { return flags.has(flag) ? 0 : 2.8; },
      get label() { return flags.has(n.needs) ? `Relight ${n.name}` : n.cold; },
      onInteract: () => {
        if (flags.has(flag)) return;
        if (!graph.run(PINE_LANTERN_IDS[id]).ok) { hud.toast(n.cold); kitSfx.interact('locked', it.position); return; }
        lm?.setLit(id, true);
        shot('lanternCreak', it.position); // its little door swung open, then the wick takes
        ui.timeout(350, () => { shot('lanternLight', it.position); });
        kitSfx.interact('ignite', it.position);
        hud.toast(`${n.name[0]?.toUpperCase() ?? ''}${n.name.slice(1)} burns again`);
      },
    };
    h.interactables.push(it);
    lanternPrompts[id] = it;
  }

  // ── the miller's errand: the wheel stands still until the race is clear ──
  const payMiller = (): void => {
    flags.set('errand:paid');
    inventory.add('lodge-ribbon', 3); inventory.add('amber-resin', 4);
    hud.toast('Brandt pays · 3 lodge ribbons · 4 amber resin');
    h.music.sting('pickup');
  };
  const syncWheel = (): void => { if (h.cabins) h.cabins.wheelSpeed = flags.has('errand:done') ? 0.55 : 0; };
  syncWheel();
  // the mill's door (E322 F-M7): a cabin door like the others (Cabin.ts swings it, its kinematic piece follows the pivot),
  // barred until the race is clear — pressed before `errand:done` it only rattles. The cabin door's own piece lets go of the
  // player within 1.4 m of its hinge (main.ts: a swing never pins anyone), so while barred a second piece holds the shut
  // leaf solid: the same slab, following the same pivot, on until the errand is done
  const millDoor = ((): Interactable | null => {
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
    return best;
  })();
  if (millDoor) {
    h.cabins?.barDoor(millDoor, () => {
      if (flags.has('errand:done')) return false;
      hud.toast(flags.has('errand:asked') ? 'Barred from inside. Brandt keeps the mill shut until the race is clear' : 'The mill door is barred from inside');
      kitSfx.interact('locked', millDoor.position);
      return true;
    });
  }
  const night = (): number => sky.dayNight?.night ?? 0;
  const thralls = new NightThralls({
    animals, scene: game.scene, night,
    errand: () => flags.has('errand:asked') && !flags.has('errand:done'),
    onErrandDone: () => { flags.set('errand:done'); syncWheel(); hud.toast('The last of them goes down in the race. Behind you the mill wheel shudders, and turns'); h.music.sting('chunk'); },
    shot: (name, at) => { shot(name, at); },
  });

  // ── the lodge's contract board ──
  const lodge = bindRuntimeState(ctx, source, 'pine.lodge', () => JSON.stringify(lodgeSave.read(h.chunkId)), h.chunkId);
  const store = { getItem: (_key: string): string => String(lodge.read()), setItem: (_key: string, raw: string): void => {
    v.parse(jsonSchema, JSON.parse(raw) as unknown); lodge.write(raw);
  } };
  const board: Board = loadBoard(store);
  const boardUi = ui.view('board', (scope) => {
    const panel = new BoardPanel(() => board, scope);
    panel.onClaim = (i) => {
      const r = claim(board, i);
      if (!r) return;
      for (const it of r.items) inventory.add(it.id, it.n);
      if (r.bolts > 0) h.crossbow.addBolts(r.bolts);
      if (r.skin) { const s = SKINS[r.skin]; h.skins.own(s.id); h.wearSkin(s); hud.toast(`${s.name} crossbow finish — ${s.blurb}`); }
      saveBoard(board, store);
      kitSfx.interact('chest');
      h.music.sting('pickup');
      featFacts.event('streak', board.streak);
      hud.toast(`Contract claimed · ${board.claimed} so far · ${board.streak} in a row`);
    };
    panel.onReroll = (i) => { reroll(board, i); saveBoard(board, store); kitSfx.interact('door'); };
    return panel;
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
  const traderVoice = new THREE.Vector3();   // his head (set once he stands in his stall, below)
  const pack = { count: (id: TradeItem): number => inventory.count(id) };
  const owns = (s: string): boolean => s in SKINS && h.skins.has(s);
  const room: Room = (k, n) => h.crossbow.room?.(k, n) ?? true;
  // the platform draws the stall (SF28; the G87 sheet since G181): the goods and the rules are declared here
  const trade = ui.view('trade', (scope) => {
    const panel = new ShopPanel<TradeGood>({
      trader: 'Mott', place: 'Pine Hollow', goods: TRADE_GOODS, verb: 'Trade',
      state: (g) => tradeShopState(g.trade, pack, owns, room), cost: (g) => tradeCost(g.trade, pack),
      scope,
    });
    panel.onBuy = ({ trade: t }) => {
      for (const g of t.give) inventory.take(g.item, g.n);
      const got = t.get;
      if ('bolts' in got) h.crossbow.addBolts(got.bolts);
      else if ('ammo' in got) h.crossbow.addAmmo?.(got.ammo, got.n);
      else { const s = SKINS[got.skin]; h.skins.own(s.id); h.wearSkin(s); } // nothing Mott gives goes in the pack (E314 C)
      sfx?.bark('trader', traderVoice);
      kitSfx.interact('chime');
      hud.toast(`Traded · ${t.label}`);
      return true;
    };
    return panel;
  });

  // ── panels: the board and the slate release the lock + the weapons like the journal ──
  let holdTimer: ReturnType<typeof setTimeout> | 0 = 0;
  const onOpen = (): void => {
    ui.cancelTimer(holdTimer);
    hud.holdPause = true; h.weapons.setEnabled(false);
    if (h.menu.isOpen) h.menu.close(true);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const onClose = (): void => {
    hud.onResume?.();
    holdTimer = ui.timeout(450, () => {
      hud.holdPause = false;
      if (!h.nolock && !h.touchUi() && !document.pointerLockElement && hud.entered && !h.menu.isOpen && !boardUi().isOpen && !trade().isOpen) hud.setPaused(true);
    });
  };
  ui.enter(() => {
    boardUi().onOpen = onOpen; boardUi().onClose = onClose;
    trade().onOpen = onOpen; trade().onClose = onClose;
  });
  ui.leave(() => { hud.holdPause = false; holdTimer = 0; });

  // ── the people ──
  const dialogue = ui.view('dialogue', (scope) => new DialogueBox(scope));
  interface Person { kind: NpcKind; def: NpcDef; fig: NpcFigure; prompt: Interactable; talk: NpcTalk; barked: boolean; after: (() => void) | undefined }
  const people: Person[] = [];
  const addPerson = (kind: NpcKind, def: NpcDef, feet: { x: number; z: number }, yaw: number, label: string, after?: () => void): Person => {
    const y = floorAt(feet.x, feet.z);
    const fig = makeNpcFigure(kind, sky, { x: feet.x, y, z: feet.z }, yaw);
    game.scene.add(fig.group);
    h.registry.add({ id: `npc-${kind}`, name: def.name, category: 'people', file: 'src/shards/pine-hollow/quest/index.ts', colliders: [boxInFrame(fig.collider, fig.group, 'wood', false)], follows: fig.group, followRotation: false });
    const talk = new NpcTalk({ get dialogue() { return dialogue(); }, flags, npc: def, at: fig.talkPoint, radius: TALK_R, label, speaker: fig,
      onOpen: () => { sfx?.bark(kind, fig.talkPoint); }, onDone: () => { after?.(); }, onEmpty: () => { after?.(); } });
    // Mott's hatch moves the cloned prompt out in front of the stall.
    const prompt = talk.prompt; prompt.position = fig.talkPoint.clone();
    h.interactables.push(prompt);
    const person: Person = { kind, def, fig, prompt, talk, barked: false, after };
    people.push(person);
    return person;
  };
  // Hale out front of the ranger's cabin (the kit's frame: the door on local +X), facing the path in; at local z 0.2,
  // clear of the porch's stone exit (at z 1.7 his collider stalled the walk route there, SHARD-PLATFORM SF22d finding)
  const rc = CABIN_SITES[0] ?? { x: -14, z: -34, rot: 0.35 };
  const rl = { x: 6.0, z: 0.2 }, rcos = Math.cos(rc.rot), rsin = Math.sin(rc.rot);
  const rangerAt = { x: rc.x + rl.x * rcos + rl.z * rsin, z: rc.z - rl.x * rsin + rl.z * rcos };
  addPerson('ranger', RANGER, rangerAt, Math.atan2(rcos, -rsin), 'Talk to Hale');
  const front = (site: { x: number; z: number; rot: number }, d: number): { x: number; z: number } => ({ x: site.x - Math.sin(site.rot) * d, z: site.z - Math.cos(site.rot) * d });
  const millerAt = front(HAMLET_SITES.miller, 2.5 + 1.8 + 1.4);
  addPerson('miller', MILLER, millerAt, HAMLET_SITES.miller.rot + Math.PI, 'Talk to Brandt, the miller', () => { if (flags.has('errand:thanked') && !flags.has('errand:paid')) payMiller(); });
  const traderAt = front(HAMLET_SITES.trader, 0.55);
  const traderPerson = addPerson('trader', TRADER, traderAt, HAMLET_SITES.trader.rot + Math.PI, 'Trade with Mott', () => { trade().open(); });
  // the trader stands behind his hatch: his prompt is out front of it
  { const f = front(HAMLET_SITES.trader, 2.6); traderPerson.prompt.position.set(f.x, floorAt(f.x, f.z) + 1.4, f.z); traderVoice.copy(traderPerson.fig.talkPoint); }

  // ── kills: the King, thralls, the contracts ──
  ctx.on('actor.died', ({ actor }) => {
    const a = animals.animals.find((animal) => animal.combatActor() === actor);
    if (a === undefined) return;
    if (a.kind === KING_KIND) flags.set('dead:king');
    recordPineFeatKill(featFacts, a);
    const thrall = isPineThrall(a);
    const moved = recordKill(board, { kind: a.kind, variant: a.variant, rarity: a.rarity, elite: eliteOf(a.kind, a.variant), thrall });
    if (moved.length > 0) {
      saveBoard(board, store);
      for (const i of moved) {
        const c = board.slots[i];
        if (c) hud.toast(isFilled(c) ? `Contract filled · ${c.goal} — claim it at the lodge` : `Contract · ${c.goal} · ${c.have} / ${c.need}`);
      }
    }
  });

  // ── the rides ──
  let zip: ZipRide | null = null, canoe: CanoeRide | null = null;
  if (lm) {
    zip = new ZipRide(sky, lm.zip.top, lm.zip.bottom, lm.zip.launch, lm.zip.landing);
    game.scene.add(zip.trolley);
    h.interactables.push(zip.prompt);
    zip.onRide = (on) => {
      h.weapons.visible = !on; h.weapons.setEnabled(!on);
      if (on) { shot('zipline', lm.zip.top); kitSfx.interact('lever', lm.zip.launch); }
      else { flags.set('used:ph-zip'); kitSfx.interact('plate', lm.zip.landing); hud.toast('Down the line and into the Hollow'); }
    };
    const shoreBank = new THREE.Vector3(CANOE_SITE.x - 1.2, 0, CANOE_SITE.z); shoreBank.y = Math.max(heightAt(shoreBank.x, shoreBank.z), POND.level);
    const beach = new THREE.Vector3(ISLET.x + ISLET.r - 1.6, 0, ISLET.z + 0.4); beach.y = Math.max(heightAt(beach.x, beach.z), POND.level);
    const shoreStand = new THREE.Vector3(CANOE_SITE.x + 2.6, 0, CANOE_SITE.z + 1.4); shoreStand.y = floorAt(shoreStand.x, shoreStand.z);
    const isletStand = new THREE.Vector3(ISLET.x + ISLET.r - 3.8, 0, ISLET.z + 0.6); isletStand.y = floorAt(isletStand.x, isletStand.z);
    canoe = new CanoeRide(sky, shoreBank, beach, shoreStand, isletStand);
    game.scene.add(canoe.mesh);
    h.interactables.push(canoe.out, canoe.back);
    canoe.onRide = (on, arrived) => {
      h.weapons.visible = !on; h.weapons.setEnabled(!on);
      if (on) { lm.setCanoeAway(true); kitSfx.interact('door', shoreBank, { gain: 0.6 }); }
      if (arrived === 'islet') { if (!flags.has('secret:islet')) hud.toast('The islet. Nobody has stood here in a long time'); flags.set('secret:islet'); }
      if (arrived === 'shore') lm.setCanoeAway(false);
    };
  }

  // ── the hollow log: a model (E315 M2) placed once on its bed; its materials are the cabins' (already loaded, so it
  // lands a frame later). Its LOD (the shell alone past 60 m) is the model's
  let hollow: HollowLog | null = null;
  const logModels = pineModels(sky);
  void loadHollowLog(logModels).then(() => {
    const site = hollowLogSite();
    placeModel(hollowLog, [{ x: HOLLOW_LOG.x, y: site.floorY, z: HOLLOW_LOG.z, yaw: HOLLOW_LOG.yaw, params: { len: HOLLOW_LOG.len, R: HOLLOW_LOG.R, r: HOLLOW_LOG.r } }],
      { ctx: logModels, draw: 'single', registry: h.registry, piece: { id: 'hollow-log', floor: (x, z) => (insideHollowLog(x, z) ? site.floorY : undefined), solidFloor: true } });
    hollow = site;
    return site;
  });

  // ── the clock: Hale's watch till dark, the dawn ──
  const questChip = new QuestChip({ chip: () => quest.chip(), markers: () => quest.markers().map((m) => ({ id: m.id, label: m.label, short: m.short ?? m.label, x: m.at.x, z: m.at.z })) });
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
  const publishClock = (event: PineClockEvent, value: number): void => {
    if (event === 'night.consume') flags.clear('wait:night');
    else if (event === 'night.start') { hud.toast('You sit with Hale on the porch while the light goes out of the Hollow…'); fastForward(PINE_PHASES.night, value); }
    else if (event === 'dawn.start') hud.toast('The Antler King falls. In the east, the sky is going grey');
    else if (event === 'dawn.sunrise') fastForward(PINE_PHASES.sunrise + 0.012, value);
    else if (event === 'dawn.lanterns') { for (const f of LANTERN_FLAGS) flags.set(f); if (lm) for (const id of ['pond', 'ridge', 'den'] as const) lm.setLit(id, true); h.music.sting('dawn'); }
    else if (event === 'dawn.caption') { reward.show(true); objective.hide(true); }
    else {
      reward.show(false); objective.hide(false);
      inventory.add('amber-resin', 4); // was 2 amber heartwood, which nothing used (E314 C)
      hud.toast("Hale's thanks · 4 amber resin — and the Warden's bow is yours to keep");
      flags.set('seen:dawn');
    }
  };
  const clock = await installPineClock(ctx, { seen: () => flags.has('seen:dawn'), hasClock: () => sky.dayNight !== null, night, publish: publishClock }, quest.current?.id === 'dawn');
  ctx.scope.onDispose(flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') clock.night();
    if (f.startsWith('lit:')) syncLanterns();
  }));
  const runDawn = (): void => { clock.dawn(); };

  // ── the quest ──
  h.fullMap.setQuest(() => ({ title: quest.isStarted ? WARDENS_HOLLOW.title : 'Pine Hollow', objective: quest.objective(), hint: quest.isComplete ? '' : quest.hint() }));
  quest.onStep = (step, prev) => {
    if (prev === null && step?.id === 'pond') hud.toast(`New quest · ${WARDENS_HOLLOW.title}`);
    else if (step) hud.toast(`Objective · ${quest.objective()}`);
    h.music.sting('chunk');
    if (step?.id === 'dawn') runDawn();
  };
  quest.onComplete = () => { hud.toast(`Quest complete · ${WARDENS_HOLLOW.title}`); };

  // ── the stag ──
  const stag = new StagLead(game.scene, animals);
  stag.onAppear = (first) => { if (first) hud.toast('On the west road, something pale is standing very still'); };
  stag.onDone = () => { flags.set('followed:stag'); hud.toast('The stag is gone. Ahead, the standing stones, and the fog between them'); };

  // ── the map (C9's hook): the places with discovery, the live quest markers ──
  const liveMarkers = (): { label: string; x: number; z: number; short: string }[] => quest.markers().map((m) => ({ label: m.label, short: m.short ?? m.label, x: m.at.x, z: m.at.z }));
  h.fullMap.setPois((): MapPoi[] => [
    ...PINE_HOLLOW_POIS.map((p): MapPoi => (flags.has(`seen:${p.id}`) ? { x: p.x, z: p.z, label: p.name, kind: 'place' } : { x: p.x, z: p.z, label: '?', kind: 'unknown' })),
    ...liveMarkers().map((m): MapPoi => ({ x: m.x, z: m.z, label: m.label, kind: 'quest' })),
  ], { declutter: true });
  // the zones a place's name does not already say (the Ridge, the old-growth, the Hollow), the real pines, the hamlet's roofs
  const placeNames = new Set(PINE_HOLLOW_POIS.map((p) => p.name.toUpperCase()));
  h.fullMap.setZones(PINE_HOLLOW_ZONES.filter((zn) => !placeNames.has(zn.label)));
  h.fullMap.setFeatures({ trees: h.trees, roofs: hamletRoofs() });

  // ── the event achievements, read back from the flags (a save from before an achievement still earns it) ──
  const syncFeats = (): void => {
    syncPineFlagFeats(flags, featFacts);
  };
  syncFeats();
  ctx.scope.onDispose(flags.onChange((f, on) => { if (on && !f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats(); }));
  const journalFull = (): boolean => {
    const st = h.compendium; if (!st) return false;
    return st.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; });
  };

  // ── per frame ──
  let slowT = 0;
  ctx.system({ id: 'quest', phase: 'update', after: ['quest.kit', 'quest.pool', 'quest.shelf'], before: ['hud.combat', 'main.frame'], run: (dt, t) => {
    const pp = player.position;
    dialogue().update(dt);
    for (const p of people) {
      p.fig.update(dt, t, pp);
      const d2 = p.fig.talkPoint.distanceToSquared(pp);
      p.talk.update(pp);
      if (!p.barked && d2 < 7 * 7) { p.barked = true; sfx?.bark(p.kind, p.fig.talkPoint); }
      else if (p.barked && d2 > 16 * 16) p.barked = false;
    }
    zip?.update(dt, player, game.camera);
    canoe?.update(dt, t, player);
    if (ff && sky.dayNight) {
      ff.t += dt;
      const k = Math.min(1, ff.t / ff.dur), e = k * k * (3 - 2 * k);
      sky.dayNight.phase = (ff.from + ff.span * e) % 1;
      if (k >= 1) { const to = ff.to; ff = null; void sky.dayNight.set(to); }
    }
    clock.tick(dt);
    if (!perfLap.active) { // E350 F-J1: the PERF LAP's teleports call no stag and no thralls
      stag.update(dt, t, quest.current?.id === 'stag' && night() > 0.5, pp);
      thralls.update(dt, t, pp);
    }
    questChip.update(t, player);
    if (t - slowT > 0.5) {
      slowT = t;
      const cam = game.camera.position;
      for (const p of people) p.fig.lod(cam.distanceTo(p.fig.talkPoint));
      if (zip) zip.trolley.visible = zip.isRiding || cam.distanceToSquared(zip.trolley.position) < 160 * 160;
      if (!perfLap.active) for (const p of PINE_HOLLOW_POIS) if (!flags.has(`seen:${p.id}`) && Math.hypot(p.x - pp.x, p.z - pp.z) < p.r) flags.set(`seen:${p.id}`); // E350 F-J1: a lap's spot is not discovered
      if (!perfLap.active && hollow && !flags.has('secret:log') && hollow.mid.distanceToSquared(_v.set(pp.x, hollow.floorY, pp.z)) < 2.2 * 2.2 && Math.abs(pp.y - hollow.floorY) < 0.8) {
        flags.set('secret:log'); hud.toast('Inside the fallen giant. It smells of rain and old resin');
      }
      if (journalFull()) featFacts.event('journal', 1);
    }
  } });

  // ── dev: `?quest=<beat>` puts you where the beat starts (and `__pineQuest.goto(beat)` does it without a reload) ──
  const standAt = (bt: Beat): void => {
    const b = BEATS[bt];
    const at = b.at === 'ranger' ? { x: rangerAt.x + 3.5 * rcos, z: rangerAt.z - 3.5 * rsin } : b.at === 'deck' ? tower(-1.2, -2.9) : b.at === 'launch' && lm ? { x: lm.zip.launch.x, z: lm.zip.launch.z } : b.at === 'lodge' ? { x: bs.x - Math.sin(bs.yaw) * 3, z: bs.z - Math.cos(bs.yaw) * 3 } : { x: b.x, z: b.z };
    const look = b.at === 'ranger' ? rangerAt : b.at === 'launch' && lm ? { x: lm.zip.bottom.x, z: lm.zip.bottom.z } : b.at === 'lodge' ? bs : b.look;
    player.spawn(at.x, at.z, Math.atan2(-(look.x - at.x), -(look.z - at.z)));
    if (b.at === 'deck' || b.at === 'launch') player.position.y = deckY + 0.05;
    if (b.night && sky.dayNight) void sky.dayNight.set(PINE_PHASES.night);
    if (b.day && sky.dayNight) void sky.dayNight.set(PINE_PHASES.day);
  };
  if (beat) standAt(beat);
  const goto = (bt: string): void => {
    if (!isBeat(bt)) return;
    flags.reset(); for (const f of beatFlags(bt)) flags.set(f);
    syncLanterns(); syncWheel();
    standAt(bt);
    if (quest.current?.id === 'dawn') runDawn();
  };
  const debug = {
    flags, quest, board, kit, stag, thralls, people, content: PINE_QUEST_CONTENT,
    jump: goto, goto,
    dawn: runDawn, night: (): void => { fastForward(PINE_PHASES.night, 2); },
    zip, canoe, lanterns: lanternPrompts, hollow: (): HollowLog | null => hollow,
    openBoard: (): void => { boardUi().open(); }, openTrade: (): void => { trade().open(); },
    callThralls: (): void => { thralls.force(player.position); },
    give: (id: ItemId, n = 1): void => { inventory.add(id, n); },
    fill: (i: number): void => { const c = board.slots[i]; if (c) { c.have = c.need; saveBoard(board, store); } },
    test: (c: { all?: string[] }): boolean => test(flags, c),
  };
  ctx.debug.expose('pine.quest', debug);
  ctx.debug.expose(`harness.quest.${ctx.manifest.slug}`, () => flags.all.slice().sort());
  if (!ui.exposeBrowser('__pineQuest', debug)) ctx.scope.expose(window, '__pineQuest', debug);
  ctx.scope.onDispose(() => {
    objective.root.remove(); reward.root.remove();
    ui.disposeLegacy(() => { dialogue().dispose(); boardUi().root.remove(); trade().root.remove(); chip().root.remove(); });
    ui.cancelTimer(holdTimer);
  });
  if (quest.current?.id === 'dawn') runDawn();   // an early kill (or `?quest=dawn`): the dawn plays now
  return { useSfx: (s) => { sfx = s; }, stagAt: () => stag.position };
}
