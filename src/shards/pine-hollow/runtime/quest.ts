import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { lineFor } from '@wildshard/engine/quest/core';
import { test } from '@wildshard/engine/world/interact/flags';
import { autoFlag, type InteractDef } from '@wildshard/engine/world/interact/types';
import type { QuestData } from '@wildshard/game/shardfile/quests';
import { DeclaredQuests } from '@wildshard/game/quest/declared';
import { LANTERN_FLAGS, QUEST_DONE, RANGER } from '../quest/wardensHollow';
import { pineTable } from '../quest/table';
import { StagWalk } from '../quest/stagWalk';
import { PINE_PHASES } from '../look/dayKeys';
import { PINE_FEATS } from '../feats';
import { LegacyPineClock, type PineClockEvent } from './questClock';
import { LEVER_FLAG } from './weapons/headlessLoadout';
import baked from './spots.baked.json' with { type: 'json' };

/** The script command actor that carries Pine's [E] prompts (`{ kind: 'script', actorId: PINE_INTERACT, value: PINE_ACT.* }`). */
export const PINE_INTERACT = 'pine.interact';
/** The prompts a command's value names: Hale's talk, the table's quest rows, the three lanterns, the zipline, the lever-action. */
export const PINE_ACT = { talk: 0, logA: 1, logB: 2, glass: 3, flint: 4, pond: 5, ridge: 6, den: 7, zip: 8, rifle: 9 } as const;
/** The quest keeper's fixed-step id (the stag's walk, the dawn's clock, the clock's fast-forward, the ride, the feats' counts). */
export const QUEST_STEP = 'pine.quest';

/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** Interactables.ts: the kit's prompt radius. */
const PROMPT_R = 2.5;
/** ZipRide (quest/rides.ts): gravity along the wire minus drag, 1.5–16 m/s, the rider 3.15 m under the trolley, a 1.2 % sag;
 *  it starts 0.7 m down the wire at 2.5 m/s and lets go 2 m short of the end, onto the landing at 2.5 m/s. */
const G = 9.8, DRAG = 0.012, VMIN = 1.5, VMAX = 16, HANG = 3.15, SAG = 0.012, START = 0.7, LAUNCH_V = 2.5, LET_GO = 2.0;
/** questClock's two fast-forwards: to night over 6 s, to just past sunrise over 7 s */
const NIGHT_PHASE = PINE_PHASES.night, SUNRISE_PHASE = PINE_PHASES.sunrise + 0.012;
const MAX_COMMANDS = 1024, MAX_SETS = 16;
/** the feats the quest's flags witness (quest/index.ts syncFeats; the King's is his own fall's, runtime/king.ts) */
const QUEST_FEATS = ['lanterns', 'zipline', 'quest'] as const;
const QUEST_ROWS = ['dam-log-a', 'dam-log-b', 'dam-sluice', 'pond-glass', 'ridge-flint'] as const;

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Point = v.strictObject(xyz), Prompt = v.strictObject({ ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1),
  rows: v.array(v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.nullable(Point) })),
  talk: Prompt, lanterns: v.strictObject({ pond: Prompt, ridge: Prompt, den: Prompt }),
  zip: v.strictObject({ prompt: Prompt, top: Point, bottom: Point, landing: Point }), rifle: Prompt });
/** The page's placements (scripts/bake-pine-spots.mjs), strictly. */
export type PineSpots = v.InferOutput<typeof Spots>;
/** Pine's baked quest spots, parsed strictly. */
export function pineSpots(): PineSpots { return v.parse(Spots, baked); }

const Fast = v.strictObject({ from: finite, span: finite, t: finite, dur: finite, to: finite });
const Saved = v.strictObject({ stag: v.strictObject({ i: v.pipe(finite, v.integer(), v.minValue(0)), mode: v.picklist(['none', 'stare', 'trot', 'gone']), t: finite }),
  dawn: finite, fast: v.nullable(Fast), zip: v.nullable(v.strictObject({ s: finite, v: finite })), rifle: v.boolean(),
  counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))) });

/** The day clock the quest fast-forwards (the host's, PineDayNight's law). */
export interface PineQuestDay { phase: number; readonly night: number }
/** What the quest keeper is lent. */
export interface PineQuestPorts {
  readonly quests: QuestData;
  readonly spots: PineSpots;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** the host's day clock (null: none, as a page without a sky clock: no fast-forward, no night wait) */
  readonly day: () => PineQuestDay | null;
  /** PineDayNight's night (0 day … 1 night) */
  readonly night: () => number;
}
export interface PineQuest {
  readonly quests: DeclaredQuests;
  readonly stag: StagWalk;
  /** the zipline carries the player (the page's weapons are off and stowed for the ride) */
  readonly riding: () => boolean;
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
 *  - Hale's talk (3.2 m from his head) plays his current dialogue (engine `lineFor`) and raises its `sets` at once (the
 *    page raises them when the box closes): `talked:ranger` starts the quest, `wait:night` asks the clock for the night;
 *  - the beaver dam (quest/table.ts, the kit's rules): the two logs are latching levers that need `talked:ranger`, the
 *    sluice latches open on both, its glass shows then and is taken (`taken:pond-glass`); the fire-watcher's flint is on the
 *    fire finder in the lookout's cab (`taken:ridge-flint`);
 *  - the three lanterns (2.8 m) light on their needs (`lit:<id>`);
 *  - the zipline (2.3 m at the launch) carries the player down the wire on ZipRide's law and sets `used:ph-zip` on the
 *    landing; the lever-action's pickup in the ranger's cabin (1.8 m) owns it (`owned:lever-rifle`) and selects it;
 *  - the Ghost Stag's walk after dark on the stag beat (quest/stagWalk.ts) sets `followed:stag`;
 *  - the King's fall is his own record (`dead:king`, runtime/king.ts); the dawn beat runs the page's clock (questClock.ts:
 *    the day fast-forwards to sunrise, every lantern lights, `seen:dawn` completes the quest);
 *  - the lanterns, the zipline and the quest file their ledger feats from the flags, as the page's progress does.
 * Not modelled: the prompts' line of sight; the nearest-prompt pick (a command names its prompt); the dialogue box's
 * reading time; the reward's resin; the sit-with-Hale wait as a walk (the night fast-forward runs on the host's clock).
 */
export function installHollowQuest(host: SimHost, ports: PineQuestPorts): PineQuest {
  const { spots } = ports, flags = host.flags;
  // the table's own rules for the quest's rows (their placements are the bake's; the sites only place the rows)
  const table = pineTable({ resin: [], tokens: [], dam: { x: 0, z: 0, fx: 0, fz: 1, ax: 1, az: 0 }, finder: { x: 0, y: 0, z: 0 }, bench: { x: 0, y: 0, z: 0, yaw: 0 } });
  const rules = QUEST_ROWS.map((id): Rule => {
    const d = table.rows.find(row => row.id === id), spot = spots.rows.find(row => row.id === id);
    if (d === undefined || spot?.kind !== d.kind) throw new Error(`Pine spots do not match the table's row ${id}`);
    return { d, prompt: spot.prompt, auto: autoFlag(d), lever: `lever:${id}`, taken: `taken:${id}`, open: `open:${id}` };
  });
  const [logA, logB, sluice, glass, flint] = rules;
  if (logA === undefined || logB === undefined || sluice === undefined || glass === undefined || flint === undefined) throw new Error('Pine\'s quest rows are missing');
  /** a command's table row (the prompts' order: the two logs, the glass, the flint) */
  const rowOf = (value: number): Rule | null => value === PINE_ACT.logA ? logA : value === PINE_ACT.logB ? logB : value === PINE_ACT.glass ? glass : value === PINE_ACT.flint ? flint : null;
  const raiseAll = (list: readonly string[] | undefined, on: boolean): void => {
    if (list === undefined) return;
    for (let k = 0; k < MAX_SETS; k++) { const f = list[k]; if (f === undefined) break; flags.set(f, on); }
  };
  const quests = new DeclaredQuests(host, ports.quests, { fact: ports.fact, coins: ports.coins });
  const chapter = quests.quests[0];
  if (chapter === undefined) throw new Error('Pine declares the Warden\'s Hollow');
  const eye = new Vector3(), at = new Vector3();
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
    return d.kind === 'lever' ? (d.latch === true && flags.has(r.lever) ? 0 : PROMPT_R) : d.kind === 'pickup' ? PROMPT_R : 0;
  };
  const interact = (r: Rule): void => {
    const d = r.d;
    if (!shown(r) || !test(flags, d.requires)) return; // a locked row only toasts
    if (d.kind === 'lever') { if (d.latch !== true || !flags.has(r.lever)) raiseAll(d.sets, flags.toggle(r.lever)); return; }
    if (r.auto !== null) flags.set(r.auto);
    raiseAll(d.sets, true);
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

  // ── the ride down the wire (ZipRide) ──
  const { top, bottom, landing } = spots.zip, len = Math.hypot(bottom.x - top.x, bottom.y - top.y, bottom.z - top.z), sag = len * SAG;
  const dl = Math.hypot(bottom.x - top.x, bottom.z - top.z), dir = { x: (bottom.x - top.x) / dl, z: (bottom.z - top.z) / dl };
  const wire = new Vector3(), ahead = new Vector3();
  const cable = (s: number, out: Vector3): Vector3 => {
    const t = Math.min(1, Math.max(0, s / len));
    return out.set(top.x + (bottom.x - top.x) * t, top.y + (bottom.y - top.y) * t - 4 * sag * t * (1 - t), top.z + (bottom.z - top.z) * t);
  };
  const state = { zip: { on: false, s: 0, v: 0 }, rifle: false };
  const carry = (p: Vector3): void => { host.player.motor.resetAt(p); host.player.position.copy(p); host.playerFall.vy = 0; host.playerFall.grounded = false; };
  const ride = (dt: number): void => {
    const zip = state.zip; if (!zip.on) return;
    const slope = -(cable(zip.s + 0.5, ahead).y - cable(zip.s, wire).y) / 0.5;
    zip.v = Math.min(VMAX, Math.max(VMIN, zip.v + (G * slope * 0.9 - DRAG * zip.v * zip.v) * dt));
    zip.s += zip.v * dt;
    cable(zip.s, wire); wire.y -= HANG;
    if (zip.s < len - LET_GO) { carry(wire); return; }
    // the drop onto the landing's deck, walking on at 2.5 m/s down the wire's line
    zip.on = false;
    carry(wire.set(landing.x - dir.x * 0.6, Math.max(wire.y, landing.y + 0.05), landing.z - dir.z * 0.6));
    host.impulsePlayer(ahead.set(dir.x * LAUNCH_V, 0, dir.z * LAUNCH_V));
    flags.set('used:ph-zip');
  };

  // ── the prompts ──
  const LIT = { pond: 'lit:pond', ridge: 'lit:ridge', den: 'lit:den' } as const;
  const lantern = (id: 'pond' | 'ridge' | 'den', needs: string): void => {
    const flag = LIT[id];
    if (!flags.has(flag) && flags.has(needs) && near(spots.lanterns[id], spots.lanterns[id].radius)) flags.set(flag);
  };
  const act = (value: number): void => {
    if (state.zip.on) return; // the ride owns the player
    if (value === PINE_ACT.talk) { if (near(spots.talk, spots.talk.radius)) raiseAll(lineFor(RANGER, flags)?.sets, true); return; }
    if (value === PINE_ACT.pond) { lantern('pond', 'taken:pond-glass'); return; }
    if (value === PINE_ACT.ridge) { lantern('ridge', 'taken:ridge-flint'); return; }
    if (value === PINE_ACT.den) { lantern('den', 'talked:ranger'); return; }
    if (value === PINE_ACT.zip) { if (near(spots.zip.prompt, spots.zip.prompt.radius)) { state.zip.on = true; state.zip.s = START; state.zip.v = LAUNCH_V; } return; }
    if (value === PINE_ACT.rifle) { if (!flags.has(LEVER_FLAG) && near(spots.rifle, spots.rifle.radius)) { flags.set(LEVER_FLAG); state.rifle = true; } return; }
    const r = rowOf(value);
    if (r !== null && near(r.prompt, radius(r))) interact(r);
  };

  // ── the feats the flags witness (bindPineFacts: one stable entity per count) ──
  const feats = QUEST_FEATS.map(id => {
    const feat = PINE_FEATS.find(f => f.id === id); if (feat === undefined) throw new Error(`Pine has no feat ${id}`);
    return { id, count: feat.count, name: `pine.feat.${id}`, entities: Array.from({ length: feat.count }, (_, k) => `${id}:${String(k + 1)}`), n: 0 };
  });
  const total = (id: (typeof QUEST_FEATS)[number]): number => id === 'lanterns' ? LANTERN_FLAGS.filter(f => flags.has(f)).length
    : id === 'zipline' ? Number(flags.has('used:ph-zip')) : Number(flags.has(QUEST_DONE));
  const syncFeats = (): void => {
    for (let i = 0; i < 3; i++) {
      const feat = feats[i]; if (feat === undefined) break;
      const value = Math.min(feat.count, Math.max(feat.n, total(feat.id)));
      for (let k = 0; k < MAX_SETS; k++) { if (feat.n >= value) break; feat.n++; ports.fact(feat.name, feat.entities[feat.n - 1] ?? feat.id); }
    }
  };
  const offFlags = flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'wait:night') clock.night();
    if (!f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats();
  });
  host.scope.onDispose(offFlags);

  const stag = new StagWalk();
  host.onStep(QUEST_STEP, dt => {
    const list = ports.commands();
    for (let c = 0; c < MAX_COMMANDS; c++) {
      const command = list[c]; if (command === undefined) break;
      if (command.actorId === PINE_INTERACT) act(command.value);
    }
    ride(dt);
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
      rifle: state.rifle, counts: Object.fromEntries(feats.map(f => [f.id, f.n])) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      stag.load(saved.stag); clock.load(saved.dawn); fast.on = saved.fast; state.zip.on = saved.zip !== null; state.zip.s = saved.zip?.s ?? 0; state.zip.v = saved.zip?.v ?? 0; state.rifle = saved.rifle;
      feats.forEach(f => { f.n = saved.counts[f.id] ?? 0; });
    },
  });
  return { quests, stag, riding: () => state.zip.on, takeRifle: () => { const took = state.rifle; state.rifle = false; return took; } };
}
