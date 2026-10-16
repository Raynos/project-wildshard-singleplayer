import { PINE_DEATH_EFFECTS } from '../data/questDeaths';
import { cableModes } from '@wildshard/engine/player/modes';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { NpcReading } from '@wildshard/engine/quest/dialogueClock';
import { bindInteractionTransitions, type InteractionState } from '@wildshard/engine/world/interact/flags';
import { walkInPickup } from '@wildshard/engine/world/interact/pickup';
import type { QuestData } from '@wildshard/format/quests';
import { installQuestGraph, bindQuestTableSpots, bindQuestDeathEffects, createReadingRoster } from '@wildshard/game/plugin/quests';
import { PINE_GRAPH, pineQuestRows } from '../quest/graph';
import { PINE_READING_DELAY, PINE_LANTERN_IDS, RESIN_COUNT, TOKEN_NAMES } from '../data/interactions';
import { LANTERN_FLAGS } from '../data/wardensHollow';
import { pineTableFromPlacements } from '../quest/table';
import { StagWalk } from '../quest/stagWalk';
import { PINE_PHASES } from '../look/dayKeys';
import { createPineFacts, isPineThrall } from '../quest/featLaw';
import { pineDirectorClock, type PineClockEvent } from './directorClock';
import type { DirectorLane } from '@wildshard/game/plugin/director';
import { LEVER_FLAG } from '../data/nativeLoadout';
import { NativeInventory, nativeInventorySchema, type NativeInventoryProfile } from '@wildshard/game/inventoryLaw';
import { PINE_READINGS } from '../data/readings';
import { PineLodge, PINE_LODGE, PINE_LODGE_ACT } from './lodge';
import { eliteOf } from '../quest/contracts';
import { pineBenchPose } from '../quest/benchPose';
import { PineTrader, PINE_TRADE, PINE_TRADE_CLOSE, type PineTradeSkin } from './trader';
import { PINE_AMMO_SAVED, type PineAmmunition } from './weapons/ammunition';
import baked from '../data/spots.generated.json' with { type: 'json' };

type SimHost = Parameters<typeof installQuestGraph>[0];

/** The script command actor that carries Pine's [E] prompts (`{ kind: 'script', actorId: PINE_INTERACT, value: PINE_ACT.* }`). */
export const PINE_INTERACT = 'pine.interact';
/** The prompts a command's value names: Hale's talk, the table's quest rows, the three lanterns, the zipline, the lever-action, eight carved tokens and lookout bench. */
export const PINE_ACT = { talk: 0, logA: 1, logB: 2, glass: 3, flint: 4, pond: 5, ridge: 6, den: 7, zip: 8, rifle: 9,
  token1: 10, token2: 11, token3: 12, token4: 13, token5: 14, token6: 15, token7: 16, token8: 17, bench: 18, miller: 19, trader: 20, kingBow: 21, cancelTalk: -1 } as const;
/** The quest keeper's fixed-step id (the stag's walk, the dawn's clock, the clock's fast-forward, the ride, the feats' counts). */
export const QUEST_STEP = 'pine.quest';
/** The page's bolt-cycle action, accepted only while its crossbow is live and no modal owns the player. */
export const PINE_AMMO = 'pine.ammo';

/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** Interactables.ts: the kit's prompt radius. */
/** questClock's two fast-forwards: to night over 6 s, to just past sunrise over 7 s */
const NIGHT_PHASE = PINE_PHASES.night, SUNRISE_PHASE = PINE_PHASES.sunrise + 0.012;
const MAX_COMMANDS = 1024, MAX_SETS = 16;
const QUEST_ROWS = ['dam-log-a', 'dam-log-b', 'dam-sluice', 'pond-glass', 'ridge-flint'] as const;

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Point = v.strictObject(xyz), Prompt = v.strictObject({ ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1),
  rows: v.array(v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.nullable(Point) })),
  people: v.exactOptional(v.pipe(v.array(v.strictObject({ kind: v.picklist(['ranger', 'miller', 'trader']), prompt: Prompt, at: Point })), v.length(3), v.check(people => new Set(people.map(person => person.kind)).size === 3))),
  board: v.exactOptional(Prompt), talk: Prompt, lanterns: v.strictObject({ pond: Prompt, ridge: Prompt, den: Prompt }),
  zip: v.strictObject({ prompt: Prompt, top: Point, bottom: Point, landing: Point }), rifle: Prompt });
/** The quest placements (generators/spots.ts, G350-PH), strictly. */
export type PineSpots = v.InferOutput<typeof Spots>;
/** Pine's baked quest spots, parsed strictly. */
export function pineSpots(): PineSpots { return v.parse(Spots, baked); }

const Fast = v.strictObject({ from: finite, span: finite, t: finite, dur: finite, to: finite });
const TradeSaved = v.strictObject({ modal: v.strictObject({ version: v.literal(1), open: v.boolean() }),
  skins: v.pipe(v.array(v.picklist(['hollow-ash', 'scarback-furnace'])), v.maxLength(2), v.check(skins => new Set(skins).size === skins.length)) });
const questSaved = (pack: ReturnType<typeof nativeInventorySchema<string>>) => v.strictObject({ stag: v.strictObject({ i: v.pipe(finite, v.integer(), v.minValue(0)), mode: v.picklist(['none', 'stare', 'trot', 'gone']), t: finite }),
  dawn: v.pipe(v.string(), v.maxLength(1000000)), fast: v.nullable(Fast), zip: v.nullable(v.strictObject({ s: finite, v: finite })), rifle: v.boolean(),
  counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.optional(pack, () => ({ counts: {}, order: [] })), dialogue: v.optional(v.unknown(), null), lodge: v.optional(v.unknown()), hollowAsh: v.optional(v.boolean(), false),
  trader: v.optional(TradeSaved), ammunition: v.optional(PINE_AMMO_SAVED) });

/** The day clock the quest fast-forwards (the host's, PineDayNight's law). */
export interface PineQuestDay { phase: number; readonly night: number }
/** What the quest keeper is lent. */
export interface PineQuestPorts {
  readonly inventory: NativeInventoryProfile<string>;
  readonly contracts: ConstructorParameters<typeof PineLodge>[0]['contracts'];
  readonly trades: ConstructorParameters<typeof PineTrader>[0]['catalogue'];
  /** USE on the King's pending orb, after the quest's modal ownership check. */
  readonly takeKingReward?: (eye: { x: number; y: number; z: number }) => boolean;
  readonly quests: QuestData;
  readonly spots: PineSpots;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The actual crossbow owner applies the page quiver cap. */
  readonly addBolts: (count: number) => void;
  /** Required for native Mott trades; isolated old quest fixtures without a complete kit cannot open the shop. */
  readonly ammunition?: PineAmmunition;
  readonly canSelectAmmo?: () => boolean;
  /** the host's day clock (null: none, as a page without a sky clock: no fast-forward, no night wait) */
  readonly day: () => PineQuestDay | null;
  /** An admitted script instance owned by this quest, never shared across hosts or driven by a second step. */
  readonly director: DirectorLane;
  /** PineDayNight's night (0 day … 1 night) */
  readonly night: () => number;
}
export interface PineQuest {
  readonly cables: ReturnType<typeof cableModes>;
  readonly quests: ReturnType<typeof installQuestGraph>['quests'];
  readonly stag: StagWalk;
  /** The page's authored seven-kind pack, shared add/trade law, silently restored with the quest. */
  readonly pack: NativeInventory<string>;
  /** the zipline carries the player (the page's weapons are off and stowed for the ride) */
  readonly riding: () => boolean;
  /** The dialogue modal owns use input and suppresses weapon actions until completion or cancellation. */
  readonly talking: () => boolean;
  readonly lodge: PineLodge;
  readonly trader: PineTrader;
  readonly ownsTradeFinish: (skin: PineTradeSkin) => boolean;
  /** Lodge finish ownership is gameplay state; its material view remains on the page. */
  readonly ownsLodgeFinish: () => boolean;
  /** the lever-action was just taken: the page's pickup selects it (read once, by the loadout's next pick) */
  readonly takeRifle: () => boolean;
}

/** One kit row of the quest's table, with its flag spellings made once. */
interface Rule extends InteractionState { readonly spot: PineSpots['rows'][number]; readonly prompt:{x:number;y:number;z:number}|null }

/**
 * "The Warden's Hollow" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `pine.feat.quest` fact through the platform's fact port) and the page's own rules
 * for every beat, each at the point the page placed it (data/spots.generated.json, generators/spots.ts), driven by `script` commands at
 * the browser's prompt radii from the player's eye:
 *  - Hale's talk (3.2 m from his head) plays the shared dialogue clock and raises its `sets` only on completion:
 *    `talked:ranger` starts the quest, `wait:night` asks the clock for the night;
 *  - the beaver dam (quest/table.ts, the kit's rules): the two logs are latching levers that need `talked:ranger`, the
 *    sluice latches open on both, its glass shows then and is taken (`taken:pond-glass`); the fire-watcher's flint is on the
 *    fire finder in the lookout's cab (`taken:ridge-flint`);
 *  - the three lanterns (2.8 m) light on their needs (`lit:<id>`);
 *  - the zipline (2.3 m at the launch) carries the player down the wire on ZipRide's law and sets `used:ph-zip` on the
 *    landing; the lever-action's pickup in the ranger's cabin (1.8 m) owns it (`owned:lever-rifle`) and selects it;
 *  - the Ghost Stag's walk after dark on the stag beat (quest/stagWalk.ts) sets `followed:stag`;
 *  - the King's fall is his own record (`dead:king`, runtime/king.ts); the dawn beat runs the page's clock (questClock.ts:
 *    the day fast-forwards to sunrise, every lantern lights, `seen:dawn` completes the quest);
 *  - the page's thirty resin drops use the captured trunk placements and shared native walk-in visibility law; each
 *    taken flag and resin fact precedes the pack add, as in Interactables.take / the page's take listener;
 *  - the eight captured carved tokens use the same table pickup flags, with no inventory item; repeated takes are hidden;
 *  - the lookout bench uses the shared page seat pose, raises its vista secret and clears ordinary fall velocity;
 *  - Brandt and Mott use their authored reading branches; Brandt pays ribbons/resin once after his thank-you completes;
 *  - the captured lodge prompt owns its modal and shared contract draws; deaths, pack rewards, bolt cap, finish ownership
 *    and streak facts have one silent continuation;
 *  - the shared page feat law files every flag-driven feat and actual creature death; its counters and pack restore silently.
 * Not modelled: the prompts' line of sight; the nearest-prompt pick (a command names its prompt); the reward's resin;
 * the sit-with-Hale wait as a walk (the night fast-forward runs on the host's clock).
 */
export function installHollowQuest(host: SimHost, ports: PineQuestPorts): PineQuest {
  const { spots } = ports, flags = host.flags;
  if (RESIN_COUNT !== 30) throw new Error('Pine resin continuation requires its thirty authored drops');
  const table = pineTableFromPlacements(spots.rows), indexed = bindQuestTableSpots(table, spots.rows, flags);
  const pack = new NativeInventory(ports.inventory), Saved = questSaved(nativeInventorySchema(ports.inventory));
  const required = (id: string): Rule => {
    const row = indexed.get(id);
    if (row === undefined) throw new Error(`Missing Pine quest row ${id}`);
    return { ...row, prompt: row.spot.prompt };
  };
  const [logA, logB, sluice, glass, flint] = QUEST_ROWS.map(required);
  if (logA === undefined || logB === undefined || sluice === undefined || glass === undefined || flint === undefined) throw new Error('Pine\'s quest rows are missing');
  const tokenRules = TOKEN_NAMES.map((_name, i) => {
    const row = required(`token-${i + 1}`);
    if (row.d.kind !== 'pickup' || row.d.look !== 'token' || row.prompt === null) throw new Error('Pine needs its token take law and prompt');
    return row;
  });
  const benchRule = required('lookout-bench'), bench = benchRule.spot;
  if (benchRule.d.kind !== 'bench' || benchRule.prompt === null) throw new Error('Pine needs its lookout bench law and prompt');
  /** a command's table row (the prompts' order: the two logs, the glass, the flint) */
  const rowOf = (value: number): Rule | null => value === PINE_ACT.logA ? logA : value === PINE_ACT.logB ? logB : value === PINE_ACT.glass ? glass : value === PINE_ACT.flint ? flint
    : value === PINE_ACT.bench ? benchRule : Number.isInteger(value) && value >= PINE_ACT.token1 && value <= PINE_ACT.token8 ? tokenRules[value - PINE_ACT.token1] ?? null : null;
  const graph = installQuestGraph(host, { quests: ports.quests, interactions: pineQuestRows(table), npcs: [], graph: PINE_GRAPH },
    { spots: { interact: [], crack: [] }, commands: ports.commands, fact: ports.fact, coins: ports.coins, drive: 'external' });
  const quests = graph.quests;
  const chapter = quests.quests[0];
  if (chapter === undefined) throw new Error('Pine declares the Warden\'s Hollow');
  const eye = new Vector3(), at = new Vector3();
  const people = spots.people, boardPrompt = spots.board;
  if (people === undefined || boardPrompt === undefined) throw new Error('Pine needs captured NPC and lodge prompts');
  const personSpots = { ranger: people.find(person => person.kind === 'ranger'),
    miller: people.find(person => person.kind === 'miller'), trader: people.find(person => person.kind === 'trader') };
  let hollowAsh = false;
  let tradeSkins = new Set<PineTradeSkin>();
  const trader = new PineTrader({ catalogue: ports.trades, pack, owns: skin => skin === 'hollow-ash' && hollowAsh || [...tradeSkins].some(owned => owned === skin),
    room: (kind, n) => ports.ammunition?.room(kind, n) ?? false,
    addBolts: ports.addBolts,
    addAmmo: (kind, n) => { if (ports.ammunition === undefined) throw new Error('Pine shop requires an ammunition owner'); ports.ammunition.add(kind, n); },
    ownSkin: skin => { tradeSkins.add(skin); } });
  const initialTrader = trader.snapshot();
  const dialogue = createReadingRoster(PINE_READINGS, people, (npc, head, radius) => new NpcReading(npc, flags, head, radius, PINE_READING_DELAY), kind => {
    if (kind === 'miller' && flags.has('errand:thanked') && !flags.has('errand:paid')) {
      flags.set('errand:paid'); pack.add('lodge-ribbon', 3); pack.add('amber-resin', 4);
    }
    if (kind === 'trader' && ports.ammunition !== undefined) trader.open();
  });
  const near = (p: { x: number; y: number; z: number } | null, radius: number): boolean => {
    if (p === null || radius <= 0) return false;
    eye.copy(host.player.position); eye.y += EYE;
    return at.set(p.x, p.y, p.z).distanceTo(eye) < radius;
  };

  // ── the kit's rules (Interactables: shown / locked / prompt radius / interact) for the quest's rows ──
  const interact = (r: Rule): void => {
    const d = r.d;
    if (!graph.run(d.id).ok) return; // the shared table flag law; a locked row only toasts
    if (d.kind === 'bench') {
      const pose = pineBenchPose(bench, bench.yaw);
      at.set(pose.x, pose.y, pose.z); host.player.motor.resetAt(at); host.player.position.copy(at);
      host.player.yaw = pose.yaw; host.playerFall.vy = 0;
    }
  };
  const resin = Array.from({ length: RESIN_COUNT }, (_unused, i) => {
    const row = required(`resin-${i + 1}`);
    if (row.d.kind !== 'pickup' || row.d.touch !== true || row.d.item !== 'amber-resin') throw new Error('Pine needs its resin take law');
    return row;
  });
  const transitions=bindInteractionTransitions([...resin,sluice],flags,{rowLimit:RESIN_COUNT+1,flagLimit:MAX_SETS,touch:'direct',
    commit:id=>graph.run(id),item:()=>{pack.add('amber-resin');},
    touched:row=>'spot' in row&&walkInPickup(host.physics,host.player.position,row.spot)});

  // ── the clock: Hale's watch till dark, the dawn (quest/index.ts publishClock, without its presentation) ──
  const fast: { on: { from: number; span: number; t: number; dur: number; to: number } | null } = { on: null };
  const fastForward = (to: number, dur: number): void => {
    const day = ports.day(); if (day === null) return;
    fast.on = { from: day.phase, span: (((to - day.phase) % 1) + 1) % 1, t: 0, dur, to };
  };
  const publish = (event: PineClockEvent, value: number): void => {
    if (event === 'night.consume') flags.clear('wait:night');
    else if (event === 'night.start') fastForward(NIGHT_PHASE, value);
    else if (event === 'dawn.sunrise') fastForward(SUNRISE_PHASE, value);
    else if (event === 'dawn.lanterns') transitions.setFlags(LANTERN_FLAGS);
    else if (event === 'dawn.finish') flags.set('seen:dawn');
  };
  const clockPorts = { seen: () => flags.has('seen:dawn'), hasClock: () => ports.day() !== null, night: ports.night, publish };
  const clock = pineDirectorClock(ports.director, clockPorts, () => !host.scope.disposed);
  const restoreClock = (saved: string): void => { clock.load(saved); };

  // ── the ride down the wire (the page's ZipRide law, quest/zipWire.ts) ──
  const cables = cableModes(host.scope), cableId = 'pine.zipline';
  cables.state(cableId);
  const state = { rifle: false };

  let counts: Record<string, number> = {};
  const feats = createPineFacts({ read: () => ({ ...counts }), write: current => { counts = current; }, emit: ports.fact });
  const lodge = new PineLodge({ contracts: ports.contracts, prompt: boardPrompt, radius: boardPrompt.radius,
    addItem: (id, n) => { pack.add(id, n); }, addBolts: ports.addBolts, ownSkin: () => { hollowAsh = true; },
    streak: total => { feats.event('streak', total); } });
  const initialLodge = lodge.snapshot();

  // ── the prompts ──
  const lantern = (id: 'pond' | 'ridge' | 'den'): void => {
    if (near(spots.lanterns[id], spots.lanterns[id].radius)) graph.run(PINE_LANTERN_IDS[id]);
  };
  const act = (value: number): void => {
    if (cables.state(cableId).riding) return; // the ride owns the player
    if (value === PINE_ACT.cancelTalk) { dialogue.dismiss(); lodge.use(PINE_LODGE_ACT.close, eye); trader.use(PINE_TRADE_CLOSE); return; }
    if (trader.active) { trader.use(PINE_TRADE_CLOSE); return; }
    if (lodge.active) { lodge.use(PINE_LODGE_ACT.close, eye); return; }
    if (dialogue.active) { dialogue.press('ranger'); return; } // modal USE advances text; it cannot also take another prompt
    if (value === PINE_ACT.kingBow) { eye.copy(host.player.position); eye.y += EYE; ports.takeKingReward?.(eye); return; }
    const speaker = value === PINE_ACT.talk ? 'ranger' : value === PINE_ACT.miller ? 'miller' : value === PINE_ACT.trader ? 'trader' : null;
    if (speaker !== null) {
      const spot = personSpots[speaker];
      if (spot !== undefined && near(spot.prompt, spot.prompt.radius)) dialogue.press(speaker);
      return;
    }
    if (value === PINE_ACT.pond) { lantern('pond'); return; }
    if (value === PINE_ACT.ridge) { lantern('ridge'); return; }
    if (value === PINE_ACT.den) { lantern('den'); return; }
    if (value === PINE_ACT.zip) { if (near(spots.zip.prompt, spots.zip.prompt.radius)) cables.start(cableId); return; }
    if (value === PINE_ACT.rifle) { if (!flags.has(LEVER_FLAG) && near(spots.rifle, spots.rifle.radius)) { flags.set(LEVER_FLAG); state.rifle = true; } return; }
    const r = rowOf(value);
    if (r !== null && near(r.prompt,r.promptRadius())) interact(r);
  };

  // ── one page/host feat law, fed only by committed flags and actual creature deaths ──
  const syncFeats = (): void => { feats.syncFlags(flags); };
  const offFlags = flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') clock.night();
    if (!f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats();
  });
  host.scope.onDispose(offFlags);
  const killed = bindQuestDeathEffects(PINE_DEATH_EFFECTS, { kill: feats.kill, event: feats.event,
    calls: new Map([['contracts', (body: SimHost['entities'] extends ReadonlyMap<string, infer Entity> ? Entity : never) => {
      lodge.killed({ kind: body.kind, variant: body.variant, rarity: body.rarity, elite: eliteOf(ports.contracts, body.kind, body.variant), thrall: isPineThrall(body) });
    }]]) });
  host.events.on('actor.died', ({ actor }) => {
    const body = [...host.entities.values()].find(candidate => candidate.combatActor() === actor);
    if (body !== undefined) killed(body);
  }, host.scope);
  syncFeats();

  const stag = new StagWalk();
  host.onStep(QUEST_STEP, dt => {
    const list = ports.commands();
    for (let c = 0; c < MAX_COMMANDS; c++) {
      const command = list[c]; if (command === undefined) break;
      if (command.actorId === PINE_INTERACT) act(command.value);
      else if (command.actorId === PINE_TRADE && !dialogue.active && !lodge.active && !cables.state(cableId).riding) trader.use(command.value);
      else if (command.actorId === PINE_AMMO && command.value === 0 && !dialogue.active && !trader.active && !lodge.active && !cables.state(cableId).riding && ports.canSelectAmmo?.() === true) ports.ammunition?.cycle();
      else if (command.actorId === PINE_LODGE && !dialogue.active && !trader.active && !cables.state(cableId).riding) {
        eye.copy(host.player.position); eye.y += EYE; lodge.use(command.value, eye);
      }
    }
    dialogue.advanceReading(dt, host.player.position);
    cables.updateNative(cableId, dt, host);
    transitions.step(resin);
    // the sluice lifts on its own once both logs are off and latches open (Interactables.update's latching door)
    transitions.latch(sluice);
    // the clock's fast-forward (a smoothstep over its span), then the clock, then the stag, as the page's quest frame
    const day = ports.day(), ff = fast.on;
    if (ff !== null && day !== null) {
      ff.t += dt;
      const k = Math.min(1, ff.t / ff.dur), e = k * k * (3 - 2 * k);
      day.phase = (ff.from + ff.span * e) % 1;
      if (k >= 1) { day.phase = ff.to; fast.on = null; }
    }
    if (chapter.current?.id === 'dawn') clock.dawn();
    clock.tick(dt);
    const lead = stag.step(dt, chapter.current?.id === 'stag' && ports.night() > 0.5, host.player.position);
    if (lead?.kind === 'vanish' && lead.done) flags.set('followed:stag');
  }, {
    snapshot: () => ({ stag: { i: stag.i, mode: stag.mode, t: stag.t }, dawn: clock.save(), fast: fast.on === null ? null : { ...fast.on }, zip: cables.state(cableId).riding ? { s: cables.snapshot(cableId).s, v: cables.snapshot(cableId).v } : null,
      rifle: state.rifle, counts: { ...counts }, pack: pack.snapshot(), ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}), lodge: lodge.snapshot(), ...(hollowAsh ? { hollowAsh } : {}),
      ...(trader.active || tradeSkins.size > 0 ? { trader: { modal: trader.snapshot(), skins: [...tradeSkins] } } : {}),
      ...(ports.ammunition?.changed === true ? { ammunition: ports.ammunition.snapshot() } : {}) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      const restoreDialogue = dialogue.prepareRestore(saved.dialogue);
      const lodgeState = saved.lodge === undefined ? initialLodge : saved.lodge;
      const restoreLodge = lodge.prepareRestore(lodgeState);
      const restoreTrader = trader.prepareRestore(saved.trader?.modal ?? initialTrader);
      if (saved.ammunition !== undefined && ports.ammunition === undefined) throw new RangeError('Pine saved ammunition has no owner');
      const restoreAmmo = ports.ammunition?.prepareRestore(saved.ammunition);
      const finish = v.parse(v.object({ board: v.object({ claimed: v.number() }), open: v.boolean() }), lodgeState);
      if (saved.hollowAsh !== (finish.board.claimed >= 3) || (finish.open && saved.dialogue !== null)) throw new RangeError('Invalid Pine lodge/modal ownership');
      if (saved.trader?.modal.open === true && (finish.open || saved.dialogue !== null || saved.zip !== null || ports.ammunition === undefined)) throw new RangeError('Invalid Pine trader/modal ownership');
      restoreClock(saved.dawn); stag.load(saved.stag); fast.on = saved.fast; cables.restore(cableId, { riding: saved.zip !== null, s: saved.zip?.s ?? 0, v: saved.zip?.v ?? 0 }); state.rifle = saved.rifle;
      counts = { ...saved.counts };
      pack.restore(saved.pack);
      restoreDialogue(); restoreLodge(); restoreTrader(); restoreAmmo?.(); hollowAsh = saved.hollowAsh; tradeSkins = new Set(saved.trader?.skins);
    },
  });
  return { quests, stag, pack, cables, riding: () => cables.state(cableId).riding, talking: () => dialogue.active || lodge.active || trader.active, lodge, trader,
    ownsTradeFinish: skin => tradeSkins.has(skin) || skin === 'hollow-ash' && hollowAsh,
    ownsLodgeFinish: () => hollowAsh, takeRifle: () => { const took = state.rifle; state.rifle = false; return took; } };
}
