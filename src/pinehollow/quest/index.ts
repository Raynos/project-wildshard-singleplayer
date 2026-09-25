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
 *   npcFigure.ts   the ranger / miller / trader stand-ins — ONE factory PH-M4 swaps
 *   contracts.ts   the lodge's rotating three (pure)      trades.ts   the trader's swaps (pure)
 *   rides.ts       the zipline ride, the canoe to the islet             hollowLog.ts   the hollow-log passage
 *   stagLead.ts    beat 5, the pale stag down the west road            nightThralls.ts the old-growth's night + the millrace
 *   ui.ts          the board, the slate, the counter                     beats.ts       `?quest=<beat>` dev jumps
 *
 * Dev: `?quest=ranger|pond|ridge|zip|den|stag|king|dawn|done` (beats.ts), `?resetquest`, `window.__pineQuest`.
 */
import * as THREE from 'three';
import type { Game } from '../../core/Game';
import type { Sky } from '../../world/Sky';
import type { Player } from '../../player/Player';
import type { AnimalManager } from '../../entities/AnimalManager';
import type { Animal } from '../../entities/Animal';
import { cabinMats, type Interactable, type Cabins } from '../../world/Cabin';
import type { WorldRegistry } from '../../world/registry';
import type { HUD } from '../../ui/HUD';
import type { Audio } from '../../audio/Audio';
import type { Music } from '../../audio/Music';
import type { PineHollowSfx } from '../../audio/PineHollowSfx';
import { IslandSfx } from '../../audio/IslandSfx';
import type { Inventory, ItemId } from '../../game/Inventory';
import type { Progress } from '../../game/Progress';
import { SKINS, type SkinDef, type SkinLocker } from '../../player/Skins';
import type { FullMap, MapPoi } from '../../ui/Map';
import type { CompendiumState } from '../../ui/compendium/state';
import type { TreeInstance } from '../../world/placement';
import { heightAt } from '../../world/Heightfield';
import { PINE_PHASES } from '../../world/PineDayNight';
import { waystoneSites, contractBoardSite, CANOE_SITE, ZIP_YAW, type PineLandmarks } from '../../world/PineLandmarks';
import { Flags, test } from '../../world/interact/flags';
import { Interactables, type InteractEvent } from '../../world/interact/Interactables';
import type { Place } from '../../world/interact/types';
import { QuestState, lineFor, type NpcDef } from '../../game/quest/quest';
import { DialogueBox, ObjectiveLine, RewardCaption } from '../../game/quest/QuestUI';
import { BEAVER_DAM, CREEK, CABIN_SITES, HAMLET_SITES, ISLET, LOOKOUT, PINE_HOLLOW_POIS, POND, STANDING_STONES, KINGS_CLEARING, WATERFALL, CREEK_BRIDGE } from '../../chunks/pineHollowLayout';
import { KING_KIND } from '../antlerKing';
import { WARDENS_HOLLOW, RANGER, MILLER, TRADER, QUEST_DONE, LANTERN_FLAGS, type LanternId } from './wardensHollow';
import { pineTable, RESIN_SPOTS, RESIN_COUNT, RESIN_FLAG, TOKEN_FLAG, TOKEN_NAMES, SECRET_FLAGS, type Spot } from './table';
import { makeNpcFigure, type NpcFigure, type NpcKind } from './npcFigure';
import { loadBoard, saveBoard, recordKill, claim, reroll, eliteOf, isFilled, type Board } from './contracts';
import type { Trade, TradeItem } from './trades';
import { BoardPanel, TradePanel, CountChip } from './ui';
import { ZipRide, CanoeRide } from './rides';
import { buildHollowLog, hollowLogFloor, HOLLOW_LOG, type HollowLog } from './hollowLog';
import { StagLead } from './stagLead';
import { NightThralls, isThrall } from './nightThralls';
import { BEATS, beatFlags, isBeat, type Beat } from './beats';

export interface PineQuestHost {
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  hud: HUD; audio: Audio; music: Music;
  inventory: Inventory; progress: Progress; skins: SkinLocker; wearSkin: (s: SkinDef) => void;
  weapons: { setEnabled: (on: boolean) => void; visible: boolean };
  /** the crossbow's bolts, and the loadout's special ammo (PH-C11: pitch / broadhead bolts, cartridges, arrows) */
  crossbow: { addBolts: (n: number) => void; addAmmo?: (kind: 'pitch' | 'broadhead' | 'cartridge' | 'arrow', n: number) => void };
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

export function installPineQuest(h: PineQuestHost): PineQuest {
  const { game, sky, player, animals, hud, inventory, progress } = h;
  const flags = new Flags(h.chunkId);
  if (h.params.has('resetquest')) flags.reset();
  const beatParam = h.params.get('quest');
  const beat: Beat | null = beatParam !== null && isBeat(beatParam) ? beatParam : null;
  if (beat) { flags.reset(); for (const f of beatFlags(beat)) flags.set(f); }
  let sfx: PineHollowSfx | null = null;
  const kitSfx = new IslandSfx(h.audio);
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
  const kit = new Interactables({ scene: game.scene, sky, player, flags, place, floorAt, prompts: h.interactables }).build(table);
  game.onUpdate((dt, t) => { kit.update(dt, t); });

  // ── the counters, the toasts ──
  const chip = new CountChip();
  const tokenCount = (): number => flags.count(TOKEN_FLAG), resinCount = (): number => flags.count(RESIN_FLAG);
  kit.onEvent = (e: InteractEvent) => {
    const d = e.def;
    switch (e.type) {
      case 'take':
        if (d.kind === 'pickup' && d.look === 'resin') {
          inventory.add('amber-resin');
          chip.show('Amber resin', resinCount(), RESIN_COUNT);
          kitSfx.interact('chime', e.at, { gain: 0.7 });
          if (resinCount() === RESIN_COUNT) hud.toast(`Every drop of amber in the Hollow · ${RESIN_COUNT} / ${RESIN_COUNT}`);
        } else if (d.kind === 'pickup' && d.look === 'token') {
          const i = Number(d.id.split('-')[1] ?? '1') - 1;
          chip.show('Carved tokens', tokenCount(), TOKEN_NAMES.length);
          hud.toast(`Carved token — ${TOKEN_NAMES[i] ?? 'somewhere quiet'}`);
          kitSfx.interact('glyph', e.at);
          if (tokenCount() === TOKEN_NAMES.length) hud.toast('All eight carved tokens — someone whittled the whole Hollow');
        } else { if (e.text) hud.toast(e.text); kitSfx.interact('chime', e.at); h.music.sting('pickup'); }
        break;
      case 'locked': hud.toast(e.text ?? 'Locked'); kitSfx.interact('locked', e.at); break;
      case 'lever': case 'door':
        kitSfx.interact(e.type === 'lever' ? 'lever' : 'grate', e.at);
        if (e.text) hud.toast(e.text);
        break;
      case 'sit': case 'press': case 'release': break;
      case 'open': case 'light': case 'loot': case 'use': case 'barrel-reset': if (e.text) hud.toast(e.text); break;
      default: break;
    }
  };
  // the vista bench: sit → face the far country, a little lift of the chin
  kit.onSit = (at, yaw) => {
    const x = at.x + Math.sin(yaw) * 0.2, z = at.z + Math.cos(yaw) * 0.2;
    player.position.set(x, at.y + 0.02, z); player.velocity.set(0, 0, 0);
    player.yaw = yaw + Math.PI; player.pitch = 0.05;
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
        if (!flags.has(n.needs)) { hud.toast(n.cold); kitSfx.interact('locked', it.position); return; }
        flags.set(flag);
        lm?.setLit(id, true);
        shot('lanternCreak', it.position); // its little door swung open, then the wick takes
        window.setTimeout(() => { shot('lanternLight', it.position); }, 350);
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
  const night = (): number => sky.pine?.night ?? 0;
  const thralls = new NightThralls({
    animals, scene: game.scene, night,
    errand: () => flags.has('errand:asked') && !flags.has('errand:done'),
    onErrandDone: () => { flags.set('errand:done'); syncWheel(); hud.toast('The last of them goes down in the race. Behind you the mill wheel shudders, and turns'); h.music.sting('chunk'); },
    shot: (name, at) => { shot(name, at); },
  });

  // ── the lodge's contract board ──
  const store = ((): Storage | null => { try { return localStorage; } catch { return null; } })();
  const board: Board = loadBoard(store);
  const boardUi = new BoardPanel(() => board);
  boardUi.onClaim = (i) => {
    const r = claim(board, i);
    if (!r) return;
    for (const it of r.items) inventory.add(it.id, it.n);
    if (r.bolts > 0) h.crossbow.addBolts(r.bolts);
    if (r.skin) { const s = SKINS[r.skin]; h.skins.own(s.id); h.wearSkin(s); hud.toast(`${s.name} crossbow finish — ${s.blurb}`); }
    saveBoard(board, store);
    kitSfx.interact('chest');
    h.music.sting('pickup');
    progress.recordEvent('streak', board.streak);
    hud.toast(`Contract claimed · ${board.claimed} so far · ${board.streak} in a row`);
  };
  boardUi.onReroll = (i) => { reroll(board, i); saveBoard(board, store); kitSfx.interact('door'); };
  const bs = contractBoardSite();
  const boardPrompt: Interactable = {
    position: new THREE.Vector3(bs.x, heightAt(bs.x, bs.z) + 1.3, bs.z),
    get radius() { return boardUi.isOpen ? 0 : 2.8; },
    get label() { return board.slots.some(isFilled) ? 'Read the contract board — one is filled' : 'Read the contract board'; },
    onInteract: () => { boardUi.open(); kitSfx.interact('door', boardPrompt.position, { gain: 0.5 }); },
  };
  h.interactables.push(boardPrompt);

  // ── the trader's slate ──
  const traderVoice = new THREE.Vector3();   // his head (set once he stands in his stall, below)
  const pack = { count: (id: TradeItem): number => inventory.count(id) };
  const trade = new TradePanel(pack, (s) => s in SKINS && h.skins.has(s as keyof typeof SKINS));
  trade.onTrade = (t: Trade) => {
    for (const g of t.give) inventory.take(g.item, g.n);
    const got = t.get;
    if ('bolts' in got) h.crossbow.addBolts(got.bolts);
    else if ('ammo' in got) h.crossbow.addAmmo?.(got.ammo, got.n);
    else if ('skin' in got) { const s = SKINS[got.skin]; h.skins.own(s.id); h.wearSkin(s); }
    else inventory.add(got.item, got.n);
    sfx?.bark('trader', traderVoice);
    kitSfx.interact('chime');
    hud.toast(`Traded · ${t.label}`);
  };

  // ── panels: the board and the slate release the lock + the weapons like the journal ──
  let holdTimer = 0;
  const onOpen = (): void => {
    window.clearTimeout(holdTimer);
    hud.holdPause = true; h.weapons.setEnabled(false);
    if (h.menu.isOpen) h.menu.close(true);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const onClose = (): void => {
    hud.onResume?.();
    holdTimer = window.setTimeout(() => {
      hud.holdPause = false;
      if (!h.nolock && !h.touchUi() && !document.pointerLockElement && hud.entered && !h.menu.isOpen && !boardUi.isOpen && !trade.isOpen) hud.setPaused(true);
    }, 450);
  };
  boardUi.onOpen = onOpen; boardUi.onClose = onClose;
  trade.onOpen = onOpen; trade.onClose = onClose;

  // ── the people ──
  const dialogue = new DialogueBox();
  interface Person { kind: NpcKind; def: NpcDef; fig: NpcFigure; prompt: Interactable; barked: boolean; after: (() => void) | undefined }
  const people: Person[] = [];
  const addPerson = (kind: NpcKind, def: NpcDef, feet: { x: number; z: number }, yaw: number, label: string, after?: () => void): Person => {
    const y = floorAt(feet.x, feet.z);
    const fig = makeNpcFigure(kind, sky, { x: feet.x, y, z: feet.z }, yaw);
    game.scene.add(fig.group);
    player.colliders.push(fig.collider);
    const talk = (): void => {
      if (dialogue.isOpen) { dialogue.advance(); return; }
      const entry = lineFor(def, flags);
      if (!entry) { after?.(); return; }
      fig.talking = true;
      sfx?.bark(kind, fig.talkPoint);
      dialogue.open(def.name, entry.lines, () => { fig.talking = false; for (const f of entry.sets ?? []) flags.set(f); after?.(); });
    };
    const prompt: Interactable = { position: fig.talkPoint.clone(), get radius() { return dialogue.isOpen ? 0 : TALK_R; }, label, onInteract: talk };
    h.interactables.push(prompt);
    const person: Person = { kind, def, fig, prompt, barked: false, after };
    people.push(person);
    return person;
  };
  // Hale out front of the ranger's cabin (the kit's frame: the door on local +X), facing the path in
  const rc = CABIN_SITES[0] ?? { x: -14, z: -34, rot: 0.35 };
  const rl = { x: 6.0, z: 1.7 }, rcos = Math.cos(rc.rot), rsin = Math.sin(rc.rot);
  const rangerAt = { x: rc.x + rl.x * rcos + rl.z * rsin, z: rc.z - rl.x * rsin + rl.z * rcos };
  addPerson('ranger', RANGER, rangerAt, Math.atan2(rcos, -rsin), 'Talk to Hale');
  const front = (site: { x: number; z: number; rot: number }, d: number): { x: number; z: number } => ({ x: site.x - Math.sin(site.rot) * d, z: site.z - Math.cos(site.rot) * d });
  const millerAt = front(HAMLET_SITES.miller, 2.5 + 1.8 + 1.4);
  addPerson('miller', MILLER, millerAt, HAMLET_SITES.miller.rot + Math.PI, 'Talk to Brandt, the miller', () => { if (flags.has('errand:thanked') && !flags.has('errand:paid')) payMiller(); });
  const traderAt = front(HAMLET_SITES.trader, 0.55);
  const traderPerson = addPerson('trader', TRADER, traderAt, HAMLET_SITES.trader.rot + Math.PI, 'Trade with Mott', () => { trade.open(); });
  // the trader stands behind his hatch: his prompt is out front of it
  { const f = front(HAMLET_SITES.trader, 2.6); traderPerson.prompt.position.set(f.x, floorAt(f.x, f.z) + 1.4, f.z); traderVoice.copy(traderPerson.fig.talkPoint); }

  // ── kills: the King, thralls, the contracts ──
  const prevKill = animals.onKill;
  animals.onKill = (a: Animal) => {
    prevKill?.(a);
    if (a.kind === KING_KIND) flags.set('dead:king');
    const thrall = isThrall(a);
    if (thrall) progress.recordEvent('thrall');
    const moved = recordKill(board, { kind: a.kind, variant: a.variant, rarity: a.rarity, elite: eliteOf(a.kind, a.variant), thrall });
    if (moved.length > 0) {
      saveBoard(board, store);
      for (const i of moved) {
        const c = board.slots[i];
        if (c) hud.toast(isFilled(c) ? `Contract filled · ${c.goal} — claim it at the lodge` : `Contract · ${c.goal} · ${c.have} / ${c.need}`);
      }
    }
  };

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

  // ── the hollow log (its materials are the cabins': already loaded, so this lands a frame later) ──
  let hollow: HollowLog | null = null;
  const registerLog = (log: HollowLog): HollowLog => {
    const inside = (x: number, z: number): boolean => {
      const c = Math.cos(HOLLOW_LOG.yaw), s = Math.sin(HOLLOW_LOG.yaw), dx = x - HOLLOW_LOG.x, dz = z - HOLLOW_LOG.z;
      return Math.abs(dx * c - dz * s) < HOLLOW_LOG.len / 2 && Math.abs(dx * s + dz * c) < HOLLOW_LOG.r * 0.8;
    };
    h.registry.add({ id: 'hollow-log', name: 'Hollow log', category: 'nature', file: 'src/pinehollow/quest/hollowLog.ts', object: log.group, colliders: log.colliders, surface: 'wood', floor: (x, z) => (inside(x, z) ? log.floorY : undefined), solidFloor: true });
    return log;
  };
  void cabinMats(sky).then((mats) => {
    hollow = buildHollowLog(mats);
    return registerLog(hollow);
  });

  // ── the clock: Hale's watch till dark, the dawn ──
  const objective = new ObjectiveLine();
  const reward = new RewardCaption('Dawn over the Hollow', "The Warden's Hollow", 'Every lantern burns. The fog is going home.');
  let ff: { from: number; span: number; t: number; dur: number; to: number } | null = null;
  const fastForward = (to: number, dur: number): void => {
    const dn = sky.pine; if (!dn) return;
    const span = (((to - dn.phase) % 1) + 1) % 1;
    ff = { from: dn.phase, span, t: 0, dur, to };
  };
  flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') {
      flags.clear('wait:night');
      if (night() < 0.5 && sky.pine) { hud.toast('You sit with Hale on the porch while the light goes out of the Hollow…'); fastForward(PINE_PHASES.night, 6); }
    }
    if (f.startsWith('lit:')) syncLanterns();
  });
  let dawnT = -1;
  const runDawn = (): void => {
    if (dawnT >= 0 || flags.has('seen:dawn')) return;
    dawnT = 0;
    hud.toast('The Antler King falls. In the east, the sky is going grey');
  };
  const dawnTick = (dt: number): void => {
    if (dawnT < 0) return;
    const was = dawnT; dawnT += dt;
    const at = (s: number): boolean => was < s && dawnT >= s;
    if (at(2.5) && sky.pine) fastForward(PINE_PHASES.sunrise + 0.012, 7);
    if (at(4)) { for (const f of LANTERN_FLAGS) flags.set(f); if (lm) for (const id of ['pond', 'ridge', 'den'] as const) lm.setLit(id, true); h.music.sting('dawn'); }
    if (at(5)) { reward.show(true); objective.root.classList.add('ws-quest-hide'); }
    if (at(12)) {
      reward.show(false); objective.root.classList.remove('ws-quest-hide');
      inventory.add('amber-heartwood', 2);
      hud.toast("Hale's thanks · 2 amber heartwood — and the Warden's bow is yours to keep");
      flags.set('seen:dawn');
      dawnT = -1;
    }
  };

  // ── the quest ──
  const quest = new QuestState(WARDENS_HOLLOW, flags);
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
  ]);

  // ── the event achievements, read back from the flags (a save from before an achievement still earns it) ──
  const syncFeats = (): void => {
    progress.recordEvent('lantern', LANTERN_FLAGS.filter((f) => flags.has(f)).length);
    progress.recordEvent('resin', resinCount());
    progress.recordEvent('token', tokenCount());
    progress.recordEvent('secret', SECRET_FLAGS.filter((f) => flags.has(f)).length);
    if (flags.has('used:ph-zip')) progress.recordEvent('zipline', 1);
    if (flags.has('errand:done')) progress.recordEvent('miller', 1);
    if (flags.has('dead:king')) progress.recordEvent('king', 1);   // an event: the King's species is registered at runtime
    if (flags.has(QUEST_DONE)) progress.recordEvent('quest', 1);
  };
  syncFeats();
  flags.onChange((f, on) => { if (on && !f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats(); });
  const journalFull = (): boolean => {
    const st = h.compendium; if (!st) return false;
    return st.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; });
  };

  // ── per frame ──
  let slowT = 0, navT = 0;
  game.onUpdate((dt, t) => {
    const pp = player.position;
    dialogue.update(dt);
    for (const p of people) {
      p.fig.update(dt, t, pp);
      const d2 = p.fig.talkPoint.distanceToSquared(pp);
      if (dialogue.isOpen && p.fig.talking && d2 > (TALK_R + 2.5) ** 2) { dialogue.close(false); p.fig.talking = false; }
      if (!p.barked && d2 < 7 * 7) { p.barked = true; sfx?.bark(p.kind, p.fig.talkPoint); }
      else if (p.barked && d2 > 16 * 16) p.barked = false;
    }
    zip?.update(dt, player, game.camera);
    canoe?.update(dt, t, player);
    if (ff && sky.pine) {
      ff.t += dt;
      const k = Math.min(1, ff.t / ff.dur), e = k * k * (3 - 2 * k);
      sky.pine.phase = (ff.from + ff.span * e) % 1;
      if (k >= 1) { const to = ff.to; ff = null; void sky.pine.setPhase(to); }
    }
    dawnTick(dt);
    stag.update(dt, t, quest.current?.id === 'stag' && night() > 0.5, pp);
    thralls.update(dt, t, pp);
    if (hollow) hollow.update(game.camera.position);
    objective.update(t);
    if (t - navT > 0.1) {
      navT = t;
      const c = quest.chip();
      objective.set(c.label, c.count);
      let best: { short: string; x: number; z: number } | null = null, bd = Infinity;
      for (const m of liveMarkers()) { const d = Math.hypot(m.x - pp.x, m.z - pp.z); if (d < bd) { bd = d; best = m; } }
      if (best && bd > 6) {
        const dx = best.x - pp.x, dz = best.z - pp.z, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        objective.setNav(best.short, bd, Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy));
      } else objective.setNav(null, 0, 0);
    }
    if (t - slowT > 0.5) {
      slowT = t;
      const cam = game.camera.position;
      for (const p of people) p.fig.lod(cam.distanceTo(p.fig.talkPoint));
      if (zip) zip.trolley.visible = zip.isRiding || cam.distanceToSquared(zip.trolley.position) < 160 * 160;
      for (const p of PINE_HOLLOW_POIS) if (!flags.has(`seen:${p.id}`) && Math.hypot(p.x - pp.x, p.z - pp.z) < p.r) flags.set(`seen:${p.id}`);
      if (hollow && !flags.has('secret:log') && hollow.mid.distanceToSquared(_v.set(pp.x, hollow.floorY, pp.z)) < 2.2 * 2.2 && Math.abs(pp.y - hollow.floorY) < 0.8) {
        flags.set('secret:log'); hud.toast('Inside the fallen giant. It smells of rain and old resin');
      }
      if (journalFull()) progress.recordEvent('journal', 1);
    }
  });

  // ── dev: `?quest=<beat>` puts you where the beat starts (and `__pineQuest.goto(beat)` does it without a reload) ──
  const standAt = (bt: Beat): void => {
    const b = BEATS[bt];
    const at = b.at === 'ranger' ? { x: rangerAt.x + 3.5 * rcos, z: rangerAt.z - 3.5 * rsin } : b.at === 'deck' ? tower(-1.2, -2.9) : b.at === 'launch' && lm ? { x: lm.zip.launch.x, z: lm.zip.launch.z } : b.at === 'lodge' ? { x: bs.x - Math.sin(bs.yaw) * 3, z: bs.z - Math.cos(bs.yaw) * 3 } : { x: b.x, z: b.z };
    const look = b.at === 'ranger' ? rangerAt : b.at === 'launch' && lm ? { x: lm.zip.bottom.x, z: lm.zip.bottom.z } : b.at === 'lodge' ? bs : b.look;
    player.spawn(at.x, at.z, Math.atan2(-(look.x - at.x), -(look.z - at.z)));
    if (b.at === 'deck' || b.at === 'launch') player.position.y = deckY + 0.05;
    if (b.night && sky.pine) void sky.pine.setPhase(PINE_PHASES.night);
    if (b.day && sky.pine) void sky.pine.setPhase(PINE_PHASES.day);
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
    flags, quest, board, kit, stag, thralls, people,
    jump: (bt: string): void => { const u = new URL(location.href); u.searchParams.set('quest', bt); location.href = u.toString(); }, goto,
    dawn: runDawn, night: (): void => { fastForward(PINE_PHASES.night, 2); },
    zip, canoe, lanterns: lanternPrompts, hollow: (): HollowLog | null => hollow,
    openBoard: (): void => { boardUi.open(); }, openTrade: (): void => { trade.open(); },
    callThralls: (): void => { thralls.force(player.position); },
    give: (id: ItemId, n = 1): void => { inventory.add(id, n); },
    fill: (i: number): void => { const c = board.slots[i]; if (c) { c.have = c.need; saveBoard(board, store); } },
    test: (c: { all?: string[] }): boolean => test(flags, c),
  };
  Object.assign(window, { __pineQuest: debug });
  if (quest.current?.id === 'dawn') runDawn();   // an early kill (or `?quest=dawn`): the dawn plays now
  return { useSfx: (s) => { sfx = s; }, stagAt: () => stag.position };
}
