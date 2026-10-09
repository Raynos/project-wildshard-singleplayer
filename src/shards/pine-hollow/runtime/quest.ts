import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { test } from '@wildshard/engine/world/interact/flags';
import { autoFlag, type InteractDef } from '@wildshard/engine/world/interact/types';
import { walkInPickup } from '@wildshard/engine/world/interact/pickup';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import { LANTERN_FLAGS } from '../quest/wardensHollow';
import { pineTable, RESIN_COUNT, TOKEN_NAMES } from '../quest/table';
import { StagWalk } from '../quest/stagWalk';
import { PINE_PHASES } from '../look/dayKeys';
import { createPineFacts, recordPineFeatKill, syncPineFlagFeats, isPineThrall } from '../quest/featLaw';
import { LegacyPineClock, type PineClockEvent } from './questClock';
import { LEVER_FLAG } from './weapons/headlessLoadout';
import { ZIP_LAUNCH_V, ZIP_START, ZipWire } from '../quest/zipWire';
import { createPinePack, PinePackSchema } from './pack';
import { PinePeople } from './people';
import { PineLodge, PINE_LODGE, PINE_LODGE_ACT } from './lodge';
import { eliteOf } from '../quest/contracts';
import { pineBenchPose } from '../quest/benchPose';
import baked from './spots.baked.json' with { type: 'json' };

/** The script command actor that carries Pine's [E] prompts (`{ kind: 'script', actorId: PINE_INTERACT, value: PINE_ACT.* }`). */
export const PINE_INTERACT = 'pine.interact';
/** The prompts a command's value names: Hale's talk, the table's quest rows, the three lanterns, the zipline, the lever-action, eight carved tokens and lookout bench. */
export const PINE_ACT = { talk: 0, logA: 1, logB: 2, glass: 3, flint: 4, pond: 5, ridge: 6, den: 7, zip: 8, rifle: 9,
  token1: 10, token2: 11, token3: 12, token4: 13, token5: 14, token6: 15, token7: 16, token8: 17, bench: 18, miller: 19, trader: 20, cancelTalk: -1 } as const;
/** The quest keeper's fixed-step id (the stag's walk, the dawn's clock, the clock's fast-forward, the ride, the feats' counts). */
export const QUEST_STEP = 'pine.quest';

/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** Interactables.ts: the kit's prompt radius. */
const PROMPT_R = 2.5;
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
/** The page's placements (scripts/bake-pine-spots.mjs), strictly. */
export type PineSpots = v.InferOutput<typeof Spots>;
/** Pine's baked quest spots, parsed strictly. */
export function pineSpots(): PineSpots { return v.parse(Spots, baked); }

const Fast = v.strictObject({ from: finite, span: finite, t: finite, dur: finite, to: finite });
const Saved = v.strictObject({ stag: v.strictObject({ i: v.pipe(finite, v.integer(), v.minValue(0)), mode: v.picklist(['none', 'stare', 'trot', 'gone']), t: finite }),
  dawn: finite, fast: v.nullable(Fast), zip: v.nullable(v.strictObject({ s: finite, v: finite })), rifle: v.boolean(),
  counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.optional(PinePackSchema, () => ({ counts: {}, order: [] })), dialogue: v.optional(v.unknown(), null), lodge: v.optional(v.unknown()), hollowAsh: v.optional(v.boolean(), false) });

/** The day clock the quest fast-forwards (the host's, PineDayNight's law). */
export interface PineQuestDay { phase: number; readonly night: number }
/** What the quest keeper is lent. */
export interface PineQuestPorts {
  readonly quests: QuestData;
  readonly spots: PineSpots;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The actual crossbow owner applies the page quiver cap. */
  readonly addBolts: (count: number) => void;
  /** the host's day clock (null: none, as a page without a sky clock: no fast-forward, no night wait) */
  readonly day: () => PineQuestDay | null;
  /** PineDayNight's night (0 day … 1 night) */
  readonly night: () => number;
}
export interface PineQuest {
  readonly quests: DeclaredQuests;
  readonly stag: StagWalk;
  /** The page's authored seven-kind pack, shared add/trade law, silently restored with the quest. */
  readonly pack: ReturnType<typeof createPinePack>;
  /** the zipline carries the player (the page's weapons are off and stowed for the ride) */
  readonly riding: () => boolean;
  /** The dialogue modal owns use input and suppresses weapon actions until completion or cancellation. */
  readonly talking: () => boolean;
  readonly lodge: PineLodge;
  /** Lodge finish ownership is gameplay state; its material view remains on the page. */
  readonly ownsLodgeFinish: () => boolean;
  /** the lever-action was just taken: the page's pickup selects it (read once, by the loadout's next pick) */
  readonly takeRifle: () => boolean;
}

/** One kit row of the quest's table, with its flag spellings made once. */
interface Rule { readonly d: InteractDef; readonly prompt: { x: number; y: number; z: number } | null; readonly auto: string | null; readonly lever: string; readonly taken: string; readonly open: string }

/**
 * "The Warden's Hollow" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `pine.feat.quest` fact through the platform's fact port) and the page's own rules
 * for every beat, each at the point the page placed it (baked: scripts/bake-pine-spots.mjs), driven by `script` commands at
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
  // the table's own rules for the quest's rows (their placements are the bake's; the sites only place the rows)
  const resinSpots = Array.from({ length: RESIN_COUNT }, (_, i) => {
    const id = `resin-${i + 1}`, matches = spots.rows.filter(row => row.id === id);
    const spot = matches[0];
    if (matches.length !== 1 || spot?.kind !== 'pickup') throw new Error(`Pine spots do not have one resin pickup ${id}`);
    return spot;
  });
  const tokenSpots = Array.from({ length: TOKEN_NAMES.length }, (_, i) => {
    const id = `token-${i + 1}`, matches = spots.rows.filter(row => row.id === id), spot = matches[0];
    if (matches.length !== 1 || spot?.kind !== 'pickup' || spot.prompt === null) throw new Error(`Pine spots do not have one token pickup ${id}`);
    return spot;
  });
  const benches = spots.rows.filter(row => row.id === 'lookout-bench'), bench = benches[0];
  if (benches.length !== 1 || bench?.kind !== 'bench' || bench.prompt === null) throw new Error('Pine spots do not have one lookout bench');
  const table = pineTable({ resin: resinSpots.map(spot => ({ x: spot.x, y: spot.y, z: spot.z, dy: 0 })), tokens: tokenSpots.map(spot => ({ x: spot.x, y: spot.y, z: spot.z, dy: 0 })),
    dam: { x: 0, z: 0, fx: 0, fz: 1, ax: 1, az: 0 }, finder: { x: 0, y: 0, z: 0 }, bench });
  const pack = createPinePack();
  const rules = QUEST_ROWS.map((id): Rule => {
    const d = table.rows.find(row => row.id === id), spot = spots.rows.find(row => row.id === id);
    if (d === undefined || spot?.kind !== d.kind) throw new Error(`Pine spots do not match the table's row ${id}`);
    return { d, prompt: spot.prompt, auto: autoFlag(d), lever: `lever:${id}`, taken: `taken:${id}`, open: `open:${id}` };
  });
  const [logA, logB, sluice, glass, flint] = rules;
  if (logA === undefined || logB === undefined || sluice === undefined || glass === undefined || flint === undefined) throw new Error('Pine\'s quest rows are missing');
  const tokenRules = tokenSpots.map((spot): Rule => {
    const d = table.rows.find(row => row.id === spot.id);
    if (d?.kind !== 'pickup' || d.look !== 'token') throw new Error(`Pine table has no token take law ${spot.id}`);
    return { d, prompt: spot.prompt, auto: autoFlag(d), lever: `lever:${d.id}`, taken: `taken:${d.id}`, open: `open:${d.id}` };
  });
  const seat = table.rows.find(row => row.id === bench.id);
  if (seat?.kind !== 'bench') throw new Error('Pine table has no lookout bench law');
  const benchRule: Rule = { d: seat, prompt: bench.prompt, auto: autoFlag(seat), lever: `lever:${seat.id}`, taken: `taken:${seat.id}`, open: `open:${seat.id}` };
  /** a command's table row (the prompts' order: the two logs, the glass, the flint) */
  const rowOf = (value: number): Rule | null => value === PINE_ACT.logA ? logA : value === PINE_ACT.logB ? logB : value === PINE_ACT.glass ? glass : value === PINE_ACT.flint ? flint
    : value === PINE_ACT.bench ? benchRule : Number.isInteger(value) && value >= PINE_ACT.token1 && value <= PINE_ACT.token8 ? tokenRules[value - PINE_ACT.token1] ?? null : null;
  const raiseAll = (list: readonly string[] | undefined, on: boolean): void => {
    if (list === undefined) return;
    for (let k = 0; k < MAX_SETS; k++) { const f = list[k]; if (f === undefined) break; flags.set(f, on); }
  };
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const chapter = quests.quests[0];
  if (chapter === undefined) throw new Error('Pine declares the Warden\'s Hollow');
  const eye = new Vector3(), at = new Vector3();
  const people = spots.people, boardPrompt = spots.board;
  if (people === undefined || boardPrompt === undefined) throw new Error('Pine needs captured NPC and lodge prompts');
  const personSpots = { ranger: people.find(person => person.kind === 'ranger'),
    miller: people.find(person => person.kind === 'miller'), trader: people.find(person => person.kind === 'trader') };
  const dialogue = new PinePeople(flags, people, kind => {
    if (kind === 'miller' && flags.has('errand:thanked') && !flags.has('errand:paid')) {
      flags.set('errand:paid'); pack.add('lodge-ribbon', 3); pack.add('amber-resin', 4);
    }
  });
  const near = (p: { x: number; y: number; z: number } | null, radius: number): boolean => {
    if (p === null || radius <= 0) return false;
    eye.copy(host.player.position); eye.y += EYE;
    return at.set(p.x, p.y, p.z).distanceTo(eye) < radius;
  };

  // ── the kit's rules (Interactables: shown / locked / prompt radius / interact) for the quest's rows ──
  const shown = (r: Rule): boolean => !(r.d.kind === 'pickup' && flags.has(r.taken)) && test(flags, r.d.showWhen);
  const radius = (r: Rule): number => {
    if (!shown(r)) return 0;
    const d = r.d;
    return d.kind === 'lever' ? (d.latch === true && flags.has(r.lever) ? 0 : PROMPT_R) : d.kind === 'pickup' ? PROMPT_R : d.kind === 'bench' ? PROMPT_R + 0.5 : 0;
  };
  const interact = (r: Rule): void => {
    const d = r.d;
    if (!shown(r) || !test(flags, d.requires)) return; // a locked row only toasts
    if (d.kind === 'lever') { if (d.latch !== true || !flags.has(r.lever)) raiseAll(d.sets, flags.toggle(r.lever)); return; }
    if (r.auto !== null) flags.set(r.auto);
    raiseAll(d.sets, true);
    if (d.kind === 'bench') {
      const pose = pineBenchPose(bench, bench.yaw);
      at.set(pose.x, pose.y, pose.z); host.player.motor.resetAt(at); host.player.position.copy(at);
      host.player.yaw = pose.yaw; host.playerFall.vy = 0;
    }
  };
  const resin = resinSpots.map(spot => {
    const d = table.rows.find(row => row.id === spot.id);
    if (d?.kind !== 'pickup' || d.touch !== true || d.item !== 'amber-resin') throw new Error(`Pine table has no resin take law ${spot.id}`);
    return { d, spot, taken: `taken:${d.id}` };
  });
  const touchResin = (): void => {
    for (let i = 0; i < 30; i++) {
      const row = resin[i]; if (row === undefined) break;
      const { d, spot, taken } = row;
      if (flags.has(taken) || !test(flags, d.showWhen) || !walkInPickup(host.physics, host.player.position, spot)) continue;
      flags.set(taken); raiseAll(d.sets, true);
      pack.add('amber-resin');
    }
  };

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
    else if (event === 'dawn.lanterns') raiseAll(LANTERN_FLAGS, true);
    else if (event === 'dawn.finish') flags.set('seen:dawn');
  };
  const clock = new LegacyPineClock({ seen: () => flags.has('seen:dawn'), hasClock: () => ports.day() !== null, night: ports.night, publish });

  // ── the ride down the wire (the page's ZipRide law, quest/zipWire.ts) ──
  const cable = new ZipWire(spots.zip.top, spots.zip.bottom), landing = spots.zip.landing;
  const hang = new Vector3(), walkOn = new Vector3();
  const state = { zip: { on: false, s: 0, v: 0 }, rifle: false };
  const carry = (p: Vector3): void => { host.player.motor.resetAt(p); host.player.position.copy(p); host.playerFall.vy = 0; host.playerFall.grounded = false; };
  const ride = (dt: number): void => {
    const zip = state.zip; if (!zip.on) return;
    const holding = cable.step(zip, dt);
    cable.rider(zip.s, hang);
    if (holding) { carry(hang); return; }
    // the drop onto the landing's deck, walking on down the wire's line
    zip.on = false;
    cable.dismount(landing, hang.y, hang, walkOn);
    carry(hang);
    host.impulsePlayer(walkOn);
    flags.set('used:ph-zip');
  };

  let counts: Record<string, number> = {};
  const feats = createPineFacts({ read: () => ({ ...counts }), write: current => { counts = current; }, emit: ports.fact });
  let hollowAsh = false;
  const lodge = new PineLodge({ prompt: boardPrompt, radius: boardPrompt.radius,
    addItem: (id, n) => { pack.add(id, n); }, addBolts: ports.addBolts, ownSkin: () => { hollowAsh = true; },
    streak: total => { feats.event('streak', total); } });
  const initialLodge = lodge.snapshot();

  // ── the prompts ──
  const LIT = { pond: 'lit:pond', ridge: 'lit:ridge', den: 'lit:den' } as const;
  const lantern = (id: 'pond' | 'ridge' | 'den', needs: string): void => {
    const flag = LIT[id];
    if (!flags.has(flag) && flags.has(needs) && near(spots.lanterns[id], spots.lanterns[id].radius)) flags.set(flag);
  };
  const act = (value: number): void => {
    if (state.zip.on) return; // the ride owns the player
    if (value === PINE_ACT.cancelTalk) { dialogue.dismiss(); lodge.use(PINE_LODGE_ACT.close, eye); return; }
    if (lodge.active) { lodge.use(PINE_LODGE_ACT.close, eye); return; }
    if (dialogue.active) { dialogue.press('ranger'); return; } // modal USE advances text; it cannot also take another prompt
    const speaker = value === PINE_ACT.talk ? 'ranger' : value === PINE_ACT.miller ? 'miller' : value === PINE_ACT.trader ? 'trader' : null;
    if (speaker !== null) {
      const spot = personSpots[speaker];
      if (spot !== undefined && near(spot.prompt, spot.prompt.radius)) dialogue.press(speaker);
      return;
    }
    if (value === PINE_ACT.pond) { lantern('pond', 'taken:pond-glass'); return; }
    if (value === PINE_ACT.ridge) { lantern('ridge', 'taken:ridge-flint'); return; }
    if (value === PINE_ACT.den) { lantern('den', 'talked:ranger'); return; }
    if (value === PINE_ACT.zip) { if (near(spots.zip.prompt, spots.zip.prompt.radius)) { state.zip.on = true; state.zip.s = ZIP_START; state.zip.v = ZIP_LAUNCH_V; } return; }
    if (value === PINE_ACT.rifle) { if (!flags.has(LEVER_FLAG) && near(spots.rifle, spots.rifle.radius)) { flags.set(LEVER_FLAG); state.rifle = true; } return; }
    const r = rowOf(value);
    if (r !== null && near(r.prompt, radius(r))) interact(r);
  };

  // ── one page/host feat law, fed only by committed flags and actual creature deaths ──
  const syncFeats = (): void => { syncPineFlagFeats(flags, feats); };
  const offFlags = flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') clock.night();
    if (!f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats();
  });
  host.scope.onDispose(offFlags);
  host.events.on('actor.died', ({ actor }) => {
    const body = [...host.entities.values()].find(candidate => candidate.combatActor() === actor);
    if (body === undefined) return;
    recordPineFeatKill(feats, body);
    lodge.killed({ kind: body.kind, variant: body.variant, rarity: body.rarity, elite: eliteOf(body.kind, body.variant), thrall: isPineThrall(body) });
  }, host.scope);
  syncFeats();

  const stag = new StagWalk();
  host.onStep(QUEST_STEP, dt => {
    const list = ports.commands();
    for (let c = 0; c < MAX_COMMANDS; c++) {
      const command = list[c]; if (command === undefined) break;
      if (command.actorId === PINE_INTERACT) act(command.value);
      else if (command.actorId === PINE_LODGE && !dialogue.active && !state.zip.on) {
        eye.copy(host.player.position); eye.y += EYE; lodge.use(command.value, eye);
      }
    }
    dialogue.advanceReading(dt, host.player.position);
    ride(dt);
    touchResin();
    // the sluice lifts on its own once both logs are off and latches open (Interactables.update's latching door)
    if (sluice.d.kind === 'door' && sluice.d.latch === true && !flags.has(sluice.open) && test(flags, sluice.d.opensWhen)) flags.set(sluice.open);
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
    snapshot: () => ({ stag: { i: stag.i, mode: stag.mode, t: stag.t }, dawn: clock.save(), fast: fast.on === null ? null : { ...fast.on }, zip: state.zip.on ? { s: state.zip.s, v: state.zip.v } : null,
      rifle: state.rifle, counts: { ...counts }, pack: pack.snapshot(), ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}), lodge: lodge.snapshot(), ...(hollowAsh ? { hollowAsh } : {}) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      const restoreDialogue = dialogue.prepareRestore(saved.dialogue);
      const lodgeState = saved.lodge === undefined ? initialLodge : saved.lodge;
      const restoreLodge = lodge.prepareRestore(lodgeState);
      const finish = v.parse(v.object({ board: v.object({ claimed: v.number() }), open: v.boolean() }), lodgeState);
      if (saved.hollowAsh !== (finish.board.claimed >= 3) || (finish.open && saved.dialogue !== null)) throw new RangeError('Invalid Pine lodge/modal ownership');
      stag.load(saved.stag); clock.load(saved.dawn); fast.on = saved.fast; state.zip.on = saved.zip !== null; state.zip.s = saved.zip?.s ?? 0; state.zip.v = saved.zip?.v ?? 0; state.rifle = saved.rifle;
      counts = { ...saved.counts };
      pack.restore(saved.pack);
      restoreDialogue(); restoreLodge(); hollowAsh = saved.hollowAsh;
    },
  });
  return { quests, stag, pack, riding: () => state.zip.on, talking: () => dialogue.active || lodge.active, lodge, ownsLodgeFinish: () => hollowAsh, takeRifle: () => { const took = state.rifle; state.rifle = false; return took; } };
}
