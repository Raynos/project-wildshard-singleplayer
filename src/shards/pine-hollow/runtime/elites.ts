import * as v from 'valibot';
import { Vector3 } from 'three';
import { canReach } from '@wildshard/engine/ai/reach';
import type { SimHost } from '@wildshard/engine/sim';
import { EliteCore, memoryElitePersistence, type EliteCoreRule } from '@wildshard/game/eliteSystem';
import { PINE_ELITE_ANIMALS } from '../combat/eliteRoster';
import { pineEliteScripts, type Blackpaw, type GhostStag, type ImperialBull, type Ironhide, type PineEliteScript, type PineEliteWorld } from '../combat/eliteScripts';
import { Lane } from '../combat/lane';
import type { PineBody, PineHuntBody } from './roster';

/** The elites' fixed-step id (it runs before the roster's, as the page's elites tick before its creature manager). */
export const ELITES_STEP = 'pine.elites';
/** The page's save slot name for the lairs' records (one shard, one slug). */
const SLUG = 'pine-hollow';
/** combat/ctx.ts SCRIPTED: the state a fight's own animal holds. */
const SCRIPTED = 'sidestep';

const finite = v.pipe(v.number(), v.finite());
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Runner = v.strictObject({ version: finite, phase: v.picklist(['idle', 'windup', 'active', 'recover', 'cooldown']), currentId: v.nullable(v.string()), hit: v.boolean(),
  elapsed: finite, speedMul: finite, clock: finite, deadlines: v.array(v.strictObject({ id: v.string(), at: finite })), scores: v.array(v.strictObject({ id: v.string(), score: finite })),
  x0: finite, z0: finite, x1: finite, z1: finite, yaw: finite, length: finite });
const Lair = v.strictObject({ timer: finite, discovered: v.boolean(), skinTaken: v.boolean(), kills: finite, retired: v.boolean() });
const Entry = v.strictObject({ id: v.string(), state: v.picklist(['absent', 'idle', 'aware', 'engaged', 'leash', 'dead', 'broken', 'retired']), timer: finite, waitDusk: v.boolean(),
  discovered: v.boolean(), bannerArmed: v.boolean(), farT: finite, phase2: v.boolean(), beatT: finite, lockHp: finite, seenSig: v.boolean(), leashT: finite,
  lastHit: v.nullable(finite), forced: v.boolean() });
const Script = v.strictObject({ id: v.string(), animal: v.nullable(v.string()), mode: v.string(), fields: v.record(v.string(), v.union([finite, v.boolean(), v.null()])),
  lanes: v.array(v.strictObject({ tellT: finite, runner: Runner })), rngs: v.array(Stream) });
const Root = v.strictObject({ t: v.pipe(finite, v.minValue(0)), x: finite, y: finite, z: finite });
const Saved = v.strictObject({ version: v.literal(2), clocks: v.strictObject({ saveT: finite, lastDusk: v.boolean() }), records: v.record(v.string(), Lair),
  entries: v.array(Entry), scripts: v.array(Script), stun: v.nullable(Root) });

export interface PineElitesPorts {
  /** the roster's bodies (runtime/roster.ts): the four lair elites stand among them, spawned and scripted at install */
  readonly bodies: () => readonly PineBody[];
  readonly heightAt: (x: number, z: number) => number;
  /** the creature manager's live spawn and retire (runtime/roster.ts): an elite's respawn, the Imperial Bull's rivals */
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => PineHuntBody;
  readonly retire: (a: PineHuntBody) => void;
  /** PineDayNight's 0..1 dusk / night (0 without a day-night clock: never dusk, so he never bugles on his own) */
  readonly dusk?: () => number;
  readonly night?: () => number;
}

/**
 * Pine Hollow's four named elites in a renderer-free host (SF72): the page's own scripts (combat/eliteScripts.ts) under the game's
 * own rules (`EliteCore`, @wildshard/game/eliteSystem: the lair, aware / engaged / leash, phase 2 at 50 % with its beat, the kill
 * and its play-time respawn timer), on the roster's four lair bodies, every roll from each elite's seeded streams. One fixed step
 * runs the rules then the scripts, before the roster's (the page's elites tick before its creature manager); the fight's lane
 * charges are the bare lanes (no decal), a blow lands through the host's combat as the page's `ctx.hurt` files it, and the
 * view-only moments (the bar, banner, orb, puffs, voices) are silent. One continuation `{ version, clocks, records, entries, scripts }`
 * restores exactly, after an identical install has spawned the four (the lairs' records are in memory: the host's run is one play).
 *
 * An elite's respawn after its 20 minutes and the Imperial Bull's two rivals are live creature spawns through the roster
 * (the stream's draws, the manager's next entity id); a continuation names each script's body and each rival lane's bull by
 * entity id, and the roster reinstalls them before this restores. The roar's stun (the page's `effect.stun`: `moveLocked`,
 * no walking, no jumping, refreshed by a second roar) roots the host's player where the roar caught them for its seconds:
 * this step, after the host's move, holds the feet there.
 *
 * Not yet owned (inert, progress/shard-platform/handoffs/sf72-pine.md): without a day-night clock (the `dusk` / `night` ports)
 * it is never dusk, so he never bugles on his own; the Ghost Stag's fade hides it from no hit test (the host's player has no
 * aimed weapon yet).
 */
export function installPineElites(host: SimHost, ports: PineElitesPorts): {
  core: EliteCore<PineEliteScript<PineHuntBody>>;
  scripts: readonly [Ironhide<PineHuntBody>, GhostStag<PineHuntBody>, Blackpaw<PineHuntBody>, ImperialBull<PineHuntBody>]; initialize: () => void;
} {
  const player = host.player, half = host.level.ground.size / 2;
  const reach = (a: PineHuntBody, target: { x: number; y: number; z: number }): boolean => canReach(a, target, host.physics);
  const adopted = new Set<string>();
  const silent = (): void => undefined;
  const dusk = ports.dusk ?? ((): number => 0), night = ports.night ?? ((): number => 0);
  /** the roar's root: the seconds left and where the feet are held (null: free) */
  let root: { t: number; x: number; y: number; z: number } | null = null;
  const stun = (seconds: number): void => {
    const p = player.position;
    root = { t: seconds, x: root?.x ?? p.x, y: root?.y ?? p.y, z: root?.z ?? p.z };
  };
  let core: EliteCore<PineEliteScript<PineHuntBody>> | null = null;
  const world: PineEliteWorld<PineHuntBody> = {
    player, reach, god: false, trauma: silent, stun, dusk, night,
    // ctx.hurt: blocked unless it reaches (or the move goes through walls), a creature blow the host knocks the player back from
    hurt: (a, amount, throughWalls = false) => {
      if (!throughWalls && !reach(a, player.position)) return;
      host.combat.hit({ source: a.combatActor(), sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: player.health, amount,
        point: a.position.clone(), dir: new Vector3(), throughWalls, cause: { kind: a.kind, label: a.label } });
    },
    voice: silent,
    // the first spawn of each lair is the roster's body (spawned at install in the page's order, its yaw from the same stream)
    spawn: (kind, x, z, yaw, variant) => {
      const body = ports.bodies().find(b => b.scripted && b.kind === kind && b.actor.variant === variant && !adopted.has(b.id));
      if (body === undefined) return ports.spawn(kind, x, z, yaw, variant);
      adopted.add(body.id);
      return body.actor;
    },
    find: (id) => ports.bodies().find(b => b.id === id)?.actor ?? null,
    own: (a) => { a.herd = -1; a.state = SCRIPTED; a.scripted = true; },
    release: (a) => { a.scripted = false; if (a.alive && a.state === SCRIPTED) a.state = 'alert'; },
    retire: (a) => { ports.retire(a); },
    adopt: silent,
    lane: (row) => new Lane<PineHuntBody>(row, reach),
    ring: () => ({ setTime: silent, ring: silent, hide: silent }),
    heightAt: ports.heightAt,
    inChunk: (x, z, margin) => Math.abs(x) <= half - margin && Math.abs(z) <= half - margin,
    show: silent,
    fx: { fade: silent, reappear: silent, burstOut: silent, roar: silent },
    signature: (id) => { core?.signature(id); },
    feed: silent,
  };
  const scripts = pineEliteScripts(world, host.level.seed);
  const condition = (rule: EliteCoreRule): boolean => rule === 'always' || (rule === 'dusk' ? dusk() > 0.5 : rule === 'night' ? night() > 0.5 : false);
  const rules = new EliteCore<PineEliteScript<PineHuntBody>>({ player, condition }, {}, SLUG, memoryElitePersistence());
  core = rules;
  scripts.forEach(s => { if (PINE_ELITE_ANIMALS[s.def.id] === undefined) throw new Error(`Pine elite ${s.def.id} has no animal`); rules.add(s); });

  const held = new Vector3();
  const rootFeet = (dt: number): void => {
    if (root === null) return;
    held.set(root.x, root.y, root.z);
    player.position.copy(held); player.motor.resetAt(held);
    root.t -= dt; if (root.t <= 0) root = null;
  };
  host.onStep(ELITES_STEP, dt => { rootFeet(dt); rules.update(dt, host.clock.now); }, {
    snapshot: () => ({ version: 2, clocks: rules.clocks(), records: Object.fromEntries(Object.entries(rules.records()).map(([id, r]) => [id, { timer: r.timer, discovered: r.discovered, skinTaken: r.skinTaken, kills: r.kills, retired: r.retired }])),
      entries: rules.entries.map(e => ({ id: e.script.def.id, state: e.state, timer: e.timer, waitDusk: e.waitDusk, discovered: e.discovered, bannerArmed: e.bannerArmed,
        farT: e.farT, phase2: e.phase2, beatT: e.beatT, lockHp: e.lockHp, seenSig: e.seenSig, leashT: e.leashT, lastHit: e.lastHit === -Infinity ? null : e.lastHit, forced: e.forced })),
      stun: root === null ? null : { ...root },
      scripts: scripts.map(s => ({ id: s.def.id, animal: s.animal?.entityId ?? null, mode: s.brainState, fields: s.fields(), lanes: s.lanes().map(l => { const { tellT, runner } = l.snapshot(); return { tellT, runner: { ...runner, deadlines: runner.deadlines.map(d => ({ id: d.id, at: d.at })), scores: runner.scores.map(r => ({ id: r.id, score: r.score })) } }; }), rngs: s.rngs().map(r => { const x = r.snapshot(); return { version: x.version, state: x.state, initial: x.initial, scrambledFork: x.scrambledFork }; }) })) }),
    restore: value => {
      const state = v.parse(Saved, value);
      if (state.entries.length !== rules.entries.length || state.scripts.length !== scripts.length) throw new Error('Incompatible Pine elites continuation');
      rules.restoreClocks(state.clocks, state.records); root = state.stun === null ? null : { ...state.stun };
      state.entries.forEach((saved, i) => {
        const e = rules.entries[i]; if (e?.script.def.id !== saved.id) throw new Error('Incompatible Pine elites continuation');
        const { id: _id, lastHit, ...rest } = saved; Object.assign(e, rest, { lastHit: lastHit ?? -Infinity });
      });
      state.scripts.forEach((saved, i) => {
        const s = scripts[i], lanes = s?.lanes(), rngs = s?.rngs();
        if (s === undefined || lanes === undefined || rngs === undefined || s.def.id !== saved.id || saved.lanes.length !== lanes.length || saved.rngs.length !== rngs.length) throw new Error('Incompatible Pine elites continuation');
        // its body first (a respawn is a live spawn the roster reinstalled), then the fields that read it
        const animal = saved.animal === null ? null : world.find(saved.animal);
        if (saved.animal !== null && animal === null) throw new Error(`Incompatible Pine elites continuation (${saved.animal})`);
        s.animal = animal;
        s.restoreFields(saved.mode, saved.fields);
        saved.lanes.forEach((l, j) => { lanes[j]?.restore(l); });
        saved.rngs.forEach((r, j) => { rngs[j]?.restore(r); });
      });
    },
  });
  return { core: rules, scripts, initialize: () => { rules.initialize(); } };
}
