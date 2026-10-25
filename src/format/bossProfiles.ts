import { DirectorStagesSchema } from './directorStages';
import * as v from 'valibot';
import { EliteScriptSchema } from './eliteScripts';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const fraction = v.pipe(finite, v.minValue(0), v.maxValue(1));
const count = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256));
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const list = <S extends v.GenericSchema>(schema: S) => v.pipe(v.array(schema), v.maxLength(256));

const BossRoarRowSchema = v.strictObject({
  act: count,
  seconds: finite,
  shed: v.exactOptional(v.strictObject({
    field: key,
    from: finite,
    rate: finite
  }))
});

const BossViewCallSchema = v.pipe(v.tupleWithRest([key], finite), v.maxLength(17));

const BossPhaseRowSchema = v.strictObject({
  at: fraction,
  mem: v.exactOptional(v.pipe(v.record(key, finite), v.maxEntries(64))),
  resume: v.exactOptional(v.strictObject({
    shieldSpot: v.exactOptional(v.boolean()),
    mode: v.exactOptional(key),
    mem: v.exactOptional(v.pipe(v.record(key, finite), v.maxEntries(64))),
    sweep: v.exactOptional(v.boolean())
  })),
  enter: v.exactOptional(v.strictObject({
    roar: v.exactOptional(BossRoarRowSchema),
    line: v.exactOptional(key),
    mode: key,
    modeT: finite,
    views: v.exactOptional(list(BossViewCallSchema)),
    pourDelay: v.exactOptional(finite),
    pourStop: v.exactOptional(v.boolean()),
    sweep: v.exactOptional(v.boolean()),
    crownReset: v.exactOptional(v.boolean()),
    lineFirst: v.exactOptional(v.boolean()),
    cooldowns: v.exactOptional(v.pipe(v.record(key, finite), v.maxEntries(64)))
  }))
});

const BossMotionSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('hold') }),
  v.strictObject({ kind: v.literal('fight') }),
  v.strictObject({ kind: v.literal('face'), yaw: v.exactOptional(finite), turn: finite }),
  v.strictObject({ kind: v.literal('goto'), spot: v.literal('shield'), speed: finite, turn: finite, arrive: finite, roarTurn: finite, next: key }),
]);

const BossEffectSchema = v.strictObject({
  modeT: v.exactOptional(finite),
  cancel: v.exactOptional(v.boolean()),
  mem: v.exactOptional(v.pipe(v.record(key, finite), v.maxEntries(64))),
  yaw: v.exactOptional(finite),
  motion: v.exactOptional(v.tuple([finite, finite, finite])),
  lockHp: v.exactOptional(v.boolean()),
  views: v.exactOptional(list(BossViewCallSchema)),
  wave: v.exactOptional(v.boolean()),
  cooldowns: v.exactOptional(v.pipe(v.record(key, finite), v.maxEntries(64))),
  line: v.exactOptional(key)
});

const BossTimeoutSchema = v.strictObject({
  seconds: finite,
  to: key,
  phase: v.exactOptional(finite),
  effect: v.exactOptional(BossEffectSchema)
});

const BossModeRowSchema = v.strictObject({
  damage: finite,
  shielded: v.boolean(),
  look: finite,
  glows: v.boolean(),
  motion: BossMotionSchema,
  timeouts: v.exactOptional(list(BossTimeoutSchema)),
  enter: v.exactOptional(BossEffectSchema)
});

const BossCutRowSchema = v.strictObject({
  damage: finite,
  reachMul: finite,
  arc: finite,
  shove: finite,
  painted: v.boolean()
});

const BossAttackRowsSchema = v.strictObject({
  burst: v.strictObject({
    act: count,
    min: finite,
    max: finite,
    seconds: v.tuple([finite, finite]),
    fireAt: positive,
    rings: v.tuple([finite, finite]),
    after: v.tuple([v.tuple([finite, finite]),
      v.tuple([finite, finite])]),
    comboFloor: finite,
    lines: v.tuple([key, key])
  }),
  combo: v.strictObject({
    act: count,
    reach: finite,
    engage: finite,
    count: v.tuple([finite, finite]),
    seconds: v.tuple([finite, finite]),
    hitAt: fraction,
    chain: finite,
    rest: v.tuple([finite, finite]),
    cuts: list(BossCutRowSchema),
    above: finite
  }),
  commit: v.strictObject({
    windup: finite,
    turn: v.tuple([finite, finite])
  }),
  chase: v.strictObject({
    stop: finite,
    speed: v.tuple([finite, finite]),
    turn: finite
  })
});

const BossRingRowSchema = v.strictObject({
  count,
  start: finite,
  gap: finite,
  speed: finite,
  max: finite,
  band: finite,
  jump: finite,
  damage: finite,
  push: finite,
  pushTime: finite,
  strike: key
});

const BossPourRowSchema = v.strictObject({
  spots: list(v.strictObject({
    x: finite,
    z: finite
  })),
  phase: count,
  every: v.tuple([finite, finite]),
  tell: finite,
  pour: positive,
  fadeIn: finite,
  fadeOut: v.tuple([finite, finite]),
  pile: v.strictObject({
    r: positive,
    rate: finite,
    cap: finite
  }),
  hitRadius: finite,
  hitRate: finite,
  damage: finite,
  strike: key,
  reset: finite
});

const BossSweepRowSchema = v.strictObject({
  radius: finite,
  squash: finite,
  offset: finite,
  speed: finite,
  limit: finite,
  start: finite,
  ease: finite,
  hitRadius: finite,
  damage: finite,
  every: finite,
  strike: key,
  boss: v.strictObject({
    damage: finite,
    every: finite,
    extra: finite,
    line: key
  })
});

const BossAddsRowSchema = v.strictObject({
  spots: list(v.strictObject({
    x: finite,
    z: finite,
    yaw: finite
  })),
  push: finite,
  pairs: v.tuple([list(count), list(count)]),
  mode: key,
  reinforce: finite,
  retireAfter: finite,
  cleared: v.strictObject({
    to: key,
    effect: BossEffectSchema
  })
});

const PhasedBossRowSchema = v.strictObject({
  origin: v.strictObject({
    x: finite,
    y: finite,
    z: finite
  }),
  bounds: finite,
  rest: v.strictObject({
    x: finite,
    z: finite,
    plinth: finite,
    lift: finite,
    halfW: finite,
    halfL: finite,
    inset: finite,
    focusY: finite
  }),
  shieldSpot: v.strictObject({
    x: finite,
    z: finite
  }),
  enragedFrom: count,
  phases: v.pipe(list(BossPhaseRowSchema), v.minLength(1), v.maxLength(16)),
  modes: v.pipe(v.record(key, BossModeRowSchema), v.maxEntries(64)),
  modeNames: v.strictObject({
    rest: key,
    rising: key,
    fight: key,
    dead: key
  }),
  attacks: BossAttackRowsSchema,
  fields: v.strictObject({
    act: key,
    strike: key,
    hitDone: key,
    floorY: key,
    floorS: key,
    rise: key,
    pose: key
  }),
  reset: v.strictObject({
    mem: v.pipe(v.record(key, finite), v.maxEntries(64)),
    combo: finite,
    burst: v.tuple([finite, finite]),
    pourDelay: finite,
    drifts: v.strictObject({
      fromPhase: count,
      height: finite,
      cap: finite,
      at: list(v.tuple([finite, finite, finite]))
    }),
    views: list(BossViewCallSchema),
    glow: finite
  }),
  intro: v.strictObject({
    long: v.strictObject({
      lid: v.tuple([finite, finite]),
      rise: v.tuple([finite, finite]),
      pulse: finite
    }),
    short: v.strictObject({
      lid: v.tuple([finite, finite]),
      rise: v.tuple([finite, finite]),
      pulse: finite
    }),
    shaft: v.strictObject({
      index: count,
      base: finite,
      amp: finite
    }),
    glow: v.strictObject({
      base: finite,
      peak: finite,
      lead: finite,
      fade: finite
    })
  }),
  begin: v.strictObject({
    mem: v.pipe(v.record(key, finite), v.maxEntries(64)),
    combo: finite,
    burst: v.tuple([finite, finite]),
    views: list(BossViewCallSchema)
  }),
  glow: v.strictObject({
    base: finite,
    glint: finite,
    charge: finite,
    glintFade: finite,
    chargeFade: finite,
    burn: v.tuple([finite, finite, finite])
  }),
  hits: v.strictObject({
    head: v.tuple([finite, finite]),
    armour: v.strictObject({
      melee: finite,
      breaks: count,
      ranged: finite,
      line: key
    })
  }),
  crown: v.strictObject({
    hp: finite,
    fromPhase: count,
    field: key,
    to: key,
    effect: BossEffectSchema
  }),
  rings: BossRingRowSchema,
  pour: BossPourRowSchema,
  sweep: BossSweepRowSchema,
  adds: BossAddsRowSchema,
  victory: v.strictObject({
    views: list(BossViewCallSchema),
    crumble: finite,
    drain: finite
  }),
  views: list(key)
});

const RoamingBossPhaseSchema = v.strictObject({
  at: fraction,
  beginMode: key,
  chaseSpeed: finite,
  recoverySeconds: finite,
  burstCooldown: finite,
  summons: v.boolean(),
  rings: finite,
  darkness: v.boolean(),
  enter: v.exactOptional(v.strictObject({
    mode: key,
    drop: v.exactOptional(v.boolean()),
    summonDelay: v.exactOptional(finite),
    resetChain: v.exactOptional(v.boolean()),
    roar: v.exactOptional(v.boolean())
  }))
});

const RoamingBossModeSchema = v.strictObject({
  kind: v.picklist(['idle', 'intro', 'pursue', 'strike', 'burst', 'wait-rings', 'recover', 'summon', 'lanes', 'dead']),
  damage: finite,
});

const RoamingBossRowSchema = v.strictObject({
  decision: v.strictObject({ mode:key,request:key,rings:key,adds:key,lane:key,phase:key,fight:key,modeT:key,strikeCd:key,burstCd:key,summonCd:key,chain:key,modes:list(key) }),
  kind: v.literal('roaming'),
  origin: v.strictObject({
    x: finite,
    z: finite
  }),
  phases: v.pipe(list(RoamingBossPhaseSchema), v.minLength(1), v.maxLength(16)),
  modes: v.pipe(v.record(key, RoamingBossModeSchema), v.maxEntries(64)),
  names: v.strictObject({
    idle: key,
    intro: key,
    dead: key,
    pursue: key,
    strike: key,
    burst: key,
    wait: key,
    recover: key,
    summon: key
  }),
  arena: v.strictObject({
    entry: finite,
    wall: finite,
    fog: finite,
    leash: finite,
    wallPad: finite,
    clampPad: finite,
    shoveBase: finite,
    shoveGain: finite,
    shoveDistance: finite,
    shoveSpan: finite,
    epsilon: positive
  }),
  seal: v.strictObject({
    inSeconds: finite,
    outSeconds: finite,
    darkIn: finite,
    darkOut: finite
  }),
  opening: v.strictObject({
    mode: key,
    lanesMode: key,
    inRate: finite,
    outRate: finite,
    inactiveRate: finite
  }),
  damage: v.strictObject({
    invulnerable: finite,
    weakOpen: finite,
    weakClosed: finite,
    opening: finite
  }),
  initial: v.strictObject({
    strikeCd: finite,
    burstCd: finite,
    summonCd: finite
  }),
  recoveryTurn: finite,
  reset: v.strictObject({
    glow: finite,
    strikeCd: finite,
    burstCd: finite,
    summonCd: finite,
    herd: finite
  }),
  intro: v.strictObject({
    short: finite,
    long: finite,
    glowStart: finite,
    glowEnd: finite,
    lookEnd: finite,
    roarAt: finite,
    crossingStep: positive,
    absentHeight: finite
  }),
  begin: v.strictObject({
    glow: finite,
    summonDelay: finite
  }),
  victoryGlow: finite,
  points: v.strictObject({
    rewardZ: finite,
    rewardY: finite,
    respawnZ: finite,
    respawnYaw: finite
  }),
  strike: v.strictObject({
    id: key,
    clip: v.strictObject({
      duration: positive,
      hitPhase: fraction
    }),
    action: key,
    reach: finite,
    chaseNear: finite,
    chaseTurn: finite,
    turn: finite,
    radius: finite,
    cooldown: finite,
    tell: v.tuple([finite, finite, finite, finite, finite]),
    trauma: finite,
    contactTrauma: finite
  }),
  burst: v.strictObject({
    clip: v.strictObject({
      duration: positive,
      hitPhase: fraction
    }),
    action: key,
    after: finite,
    turn: finite,
    radius: finite,
    tell: v.tuple([finite, finite, finite, finite, finite]),
    trauma: finite
  }),
  rings: v.strictObject({
    gap: finite,
    speed: finite,
    trauma: finite,
    strike: key
  }),
  summon: v.strictObject({
    clip: v.strictObject({
      duration: positive,
      hitPhase: fraction
    }),
    action: key,
    count,
    limit: count,
    cooldown: finite,
    turn: finite
  }),
  lanes: v.strictObject({
    stop: finite,
    speed: finite,
    turn: finite,
    burstRange: finite,
    after: finite,
    tell: finite,
    action: key,
    batch: count,
    rest: finite,
    chainRest: finite,
    soundTicks: finite,
    trauma: finite
  }),
  adds: v.strictObject({
    kinds: list(key),
    radius: finite,
    far: finite,
    near: finite,
    fast: finite,
    slow: finite,
    turn: finite,
    chargeRange: finite,
    rate: finite,
    tell: finite,
    trauma: finite,
    leashPad: finite
  }),
  hazards: v.strictObject({
    count,
    angleStart: finite,
    angleStep: finite,
    angleOffset: finite,
    radius: finite,
    radiusStep: finite,
    fallSeconds: finite,
    every: finite,
    damage: finite,
    strike: key,
    fromPhase: count
  }),
  sounds: v.strictObject({
    intro: key,
    roar: key,
    burst: key,
    add: key,
    charge: key
  })
});

const SpawnedBossRowSchema = v.strictObject({
  arena: v.strictObject({
    x: finite,
    z: finite,
    r: positive
  }),
  hpShares: v.pipe(list(fraction), v.minLength(1), v.maxLength(16)),
  riseSeconds: positive,
  stormPhases: list(count),
  stormFade: positive,
  fields: v.strictObject({
    fight: key,
    rise: key,
    phase: key
  })
});

const HeldBossRowSchema = v.strictObject({
  arena: v.strictObject({
    x: finite,
    z: finite,
    r: positive,
    floor: finite
  }),
  hpShares: v.pipe(list(fraction), v.minLength(1), v.maxLength(16)),
  rewardPoint: v.strictObject({
    x: finite,
    y: finite,
    z: finite
  }),
  respawn: v.strictObject({
    x: finite,
    y: finite,
    z: finite,
    yaw: finite
  })
});

function thresholds(values: readonly number[]): boolean {
  return values[0] === 1 && values.every((at, i) => at > 0 && (i === 0 || at < (values[i - 1] ?? 0)));
}
const arenaViews = ['adds.spot', 'strike.arc', 'strike.arc.off', 'hazard.ring.off', 'hazard.ring',
  'hazard.pour.off', 'hazard.pour.tell', 'hazard.pour.fall', 'hazard.sweep.off', 'hazard.sweep',
  'arena.fx.hide', 'boss.glow', 'arena.lid.open', 'arena.shaft', 'hazard.ring.tell', 'arena.shield.at', 'victory.heap'];
type ArenaFight = v.InferOutput<typeof PhasedBossRowSchema>;
type RoamingFight = v.InferOutput<typeof RoamingBossRowSchema>;
function arenaRules(row: ArenaFight): boolean {
  const mode = (name: string | undefined): boolean => name === undefined || Object.hasOwn(row.modes, name);
  const calls = (values: readonly v.InferOutput<typeof BossViewCallSchema>[] | undefined): boolean =>
  (values ?? []).every(([name]) => row.views.includes(name));
  const cooldowns = (values: Readonly<Record<string, number>> | undefined): boolean =>
  Object.keys(values ?? {}).every(name => name === 'combo' || name === 'burst');
  const effect = (value: v.InferOutput<typeof BossEffectSchema> | undefined): boolean => value === undefined
  || calls(value.views) && cooldowns(value.cooldowns);
  return thresholds(row.phases.map(phase => phase.at)) && row.enragedFrom < row.phases.length
  && Object.values(row.modeNames).every(mode) && mode(row.crown.to) && mode(row.adds.mode) && mode(row.adds.cleared.to)
  && effect(row.crown.effect) && effect(row.adds.cleared.effect)
  && row.phases.every(phase => mode(phase.resume?.mode) && mode(phase.enter?.mode)
    && calls(phase.enter?.views) && cooldowns(phase.enter?.cooldowns))
  && Object.values(row.modes).every(value => (value.motion.kind !== 'goto' || mode(value.motion.next)) && effect(value.enter)
    && (value.timeouts ?? []).every(out => mode(out.to) && (out.phase === undefined || Number.isInteger(out.phase)
        && out.phase >= 0 && out.phase < row.phases.length) && effect(out.effect)))
  && calls(row.reset.views) && calls(row.begin.views) && calls(row.victory.views)
  && new Set(row.views).size === row.views.length && arenaViews.every(name => row.views.includes(name))
  && row.adds.pairs.every(pair => pair.every(index => index < row.adds.spots.length))
  && row.attacks.combo.count.every(n => Number.isInteger(n) && n >= 0 && n <= row.attacks.combo.cuts.length)
  && row.attacks.burst.rings.every(n => Number.isInteger(n) && n >= 0 && n <= row.rings.count)
  && row.attacks.burst.min <= row.attacks.burst.max
  && row.attacks.burst.seconds.every(n => n > 0) && row.attacks.combo.seconds.every(n => n > 0)
  && row.attacks.burst.fireAt <= 1 && row.pour.phase < row.phases.length && row.crown.fromPhase < row.phases.length
  && row.rest.halfW > row.rest.inset && row.rest.halfL > row.rest.inset
  && row.intro.long.lid[1] > row.intro.long.lid[0] && row.intro.long.rise[1] > row.intro.long.rise[0]
  && row.intro.short.lid[1] > row.intro.short.lid[0] && row.intro.short.rise[1] > row.intro.short.rise[0]
  && row.intro.long.pulse > 0 && row.intro.short.pulse > 0 && row.intro.glow.lead > 0 && row.intro.glow.fade > 0 && row.hits.armour.breaks > 0 && row.sweep.every > 0 && row.sweep.boss.every > 0;
}
function roamingRules(row: RoamingFight): boolean {
  const mode = (name: string | undefined): boolean => name === undefined || Object.hasOwn(row.modes, name);
  return row.decision.modes.length > 0 && new Set(row.decision.modes).size === row.decision.modes.length && row.decision.modes.every(mode)
  && thresholds(row.phases.map(phase => phase.at)) && Object.values(row.names).every(mode)
  && mode(row.opening.mode) && mode(row.opening.lanesMode)
  && row.phases.every(phase => mode(phase.beginMode) && mode(phase.enter?.mode) && Number.isInteger(phase.rings)
    && phase.rings >= 0 && phase.rings <= 256)
  && row.hazards.fromPhase < row.phases.length && row.hazards.fallSeconds > 0
  && row.arena.leash > 0 && row.arena.shoveSpan > 0 && row.arena.shoveDistance > 0
  && row.adds.kinds.length > 0 && row.adds.near <= row.adds.far;
}
/** Strict arena pattern: phases, strikes, adds, hazards and named view/mode references are admitted together. */
export const ArenaBossProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ArenaBossProfileRowsInput['kind'], ArenaBossProfileRows['kind']>; readonly pattern: v.GenericSchema<ArenaBossProfileRowsInput['pattern'], ArenaBossProfileRows['pattern']>; readonly fight: v.GenericSchema<ArenaBossProfileRowsInput['fight'], ArenaBossProfileRows['fight']>; }, undefined>, v.CheckAction<ArenaBossProfileRows, 'Bound arena phase, mode, view, add and attack references'>]> = v.pipe(v.strictObject({ kind: v.literal('boss'), pattern: v.literal('arena'), fight: PhasedBossRowSchema }),
  v.check(row => arenaRules(row.fight), 'Bound arena phase, mode, view, add and attack references'));
/** Strict roaming pattern; the host retains its own streams, collision contacts, lane continuations and views. */
export const RoamingBossProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<RoamingBossProfileRowsInput['kind'], RoamingBossProfileRows['kind']>; readonly pattern: v.GenericSchema<RoamingBossProfileRowsInput['pattern'], RoamingBossProfileRows['pattern']>; readonly fight: v.GenericSchema<RoamingBossProfileRowsInput['fight'], RoamingBossProfileRows['fight']>; }, undefined>, v.CheckAction<RoamingBossProfileRows, 'Bound roaming phases, modes, adds and safe native divisors'>]> = v.pipe(v.strictObject({ kind: v.literal('boss'), pattern: v.literal('roaming'), fight: RoamingBossRowSchema }),
  v.check(row => roamingRules(row.fight), 'Bound roaming phases, modes, adds and safe native divisors'));
/** Strict spawned-body pattern, preserving checkpoint HP shares and the native weather clock. */
export const SpawnedBossProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<SpawnedBossProfileRowsInput['kind'], SpawnedBossProfileRows['kind']>; readonly pattern: v.GenericSchema<SpawnedBossProfileRowsInput['pattern'], SpawnedBossProfileRows['pattern']>; readonly fight: v.GenericSchema<SpawnedBossProfileRowsInput['fight'], SpawnedBossProfileRows['fight']>; }, undefined>, v.CheckAction<SpawnedBossProfileRows, 'Descending checkpoint shares and declared storm phases'>]> = v.pipe(v.strictObject({ kind: v.literal('boss'), pattern: v.literal('spawned'), fight: SpawnedBossRowSchema }),
  v.check(row => thresholds(row.fight.hpShares) && row.fight.stormPhases.every(index => index < row.fight.hpShares.length),
    'Descending checkpoint shares and declared storm phases'));
/** Strict held-body pattern; the host keeps the real brain/body identity instead of spawning a replacement. */
export const HeldBossProfileSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<HeldBossProfileRowsInput['kind'], HeldBossProfileRows['kind']>; readonly pattern: v.GenericSchema<HeldBossProfileRowsInput['pattern'], HeldBossProfileRows['pattern']>; readonly fight: v.GenericSchema<HeldBossProfileRowsInput['fight'], HeldBossProfileRows['fight']>; }, undefined>, v.CheckAction<HeldBossProfileRows, 'Descending held checkpoint shares'>]> = v.pipe(v.strictObject({ kind: v.literal('boss'), pattern: v.literal('held'), fight: HeldBossRowSchema }),
  v.check(row => thresholds(row.fight.hpShares), 'Descending held checkpoint shares'));
/** Strict existing AS policy wrapper; module, slots, contacts and action order remain the elite-script contract. */
export const ScriptBossProfileSchema: v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ScriptBossProfileRowsInput['kind'], ScriptBossProfileRows['kind']>; readonly pattern: v.GenericSchema<ScriptBossProfileRowsInput['pattern'], ScriptBossProfileRows['pattern']>; readonly fight: v.GenericSchema<ScriptBossProfileRowsInput['fight'], ScriptBossProfileRows['fight']>; }, undefined> = v.strictObject({ kind: v.literal('boss'), pattern: v.literal('script'), fight: EliteScriptSchema });
/** One bounded boss declaration; a host must bind the selected native pattern before allocating the fight. */
export const BossProfileSchema: v.GenericSchema<BossProfileInput, BossProfile> = v.variant('pattern', [ArenaBossProfileSchema, RoamingBossProfileSchema, SpawnedBossProfileSchema, HeldBossProfileSchema, ScriptBossProfileSchema]);
/** Admitted native or existing AS boss policy data; no host, renderer, clock or callback is serialized here. */

/** Parse strict bounded data and cross-field references before resolving a native recipe or allocating a script host. */
export function parseBossProfile(input: unknown): BossProfile { return v.parse(BossProfileSchema, input); }

const presentationFinite = v.pipe(v.number(), v.finite());
const presentationText = v.pipe(v.string(), v.minLength(1), v.maxLength(200));
/**
 * A marked boss fight's browser presentation as a row (SHARD-PLATFORM SF27, SF7f; Signal's Dune Matriarch): the arena `floor` its reward burst
 * leaves from; where a player death in the fight returns them (`respawn`, on the ground there); its storm's look — a
 * weather fog of `dist` per metre in `color` closing in eased with the fight's storm strength, and blown-sand shells
 * (`[radius m, opacity, look]`, the first coarse, the rest fine; `look` names the shard's `look.materials` graph each
 * wears) riding with the player, their streaks running down `wind` (presented by `@wildshard/game/plugin/bossStorm`);
 * and its toasts (the summons, the first fall's reward and a later fall's). The boss bar and the name card are the
 * engine's `BossBar`.
 */
export const MarkedBossPresentationSchema: v.GenericSchema<MarkedBossPresentationInput, MarkedBossPresentation> = v.strictObject({
  floor: presentationFinite,
  respawn: v.strictObject({ x: presentationFinite, z: presentationFinite, yaw: presentationFinite }),
  storm: v.strictObject({ dist: v.pipe(presentationFinite, v.minValue(0)), color: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(0xffffff)),
    shells: v.pipe(v.array(v.tuple([v.pipe(presentationFinite, v.minValue(0)), v.pipe(presentationFinite, v.minValue(0), v.maxValue(1)), v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]{0,127}$/u))])), v.maxLength(4)),
    wind: v.strictObject({ x: presentationFinite, z: presentationFinite }) }),
  toasts: v.strictObject({ summoned: presentationText, reward: presentationText, rewardAgain: presentationText }),
});
/** A validated marked boss presentation row (`MarkedBossPresentationSchema`). */

/** Compile an authored marked boss presentation row; an unknown field refuses. */
export function parseMarkedBossPresentation(input: unknown): MarkedBossPresentation { return v.parse(MarkedBossPresentationSchema, input); }

const ownerDefinition = v.strictObject({ id: key, name: key, title: key, retryTitle: key,
  intro: v.pipe(finite, v.minValue(0), v.maxValue(60)), introShort: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  phases: v.pipe(v.array(v.strictObject({ at: fraction, caption: key, name: key })), v.minLength(1), v.maxLength(16)),
  reward: v.strictObject({}) });
const ownerSaved = v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: count });
/** Native encounter binding, with no callbacks, body copies or second director clock.
 * The owned actor/keeper is lent separately by the host. Held bodies pay at victory;
 * spawned bodies may retain a flag-backed claim, exactly as their existing owner did. */
export const BossOwnerRowSchema: v.GenericSchema<BossOwnerRowInput, BossOwnerRow> = v.pipe(v.strictObject({ step: key, actor: key,
  profile: v.variant('pattern', [SpawnedBossProfileSchema, HeldBossProfileSchema]),
  definition: ownerDefinition, stages: DirectorStagesSchema,
  armed: v.boolean(),
  record: v.exactOptional(v.strictObject({ defeated: key, paid: key })),
  saved: v.exactOptional(ownerSaved),
  victory: v.strictObject({ flag: key, fact: key, once: v.boolean() }),
  reward: v.strictObject({ when: v.picklist(['claim', 'victory']), amount: count }),
  placement: v.exactOptional(v.strictObject({ rewardPoint: v.strictObject({ x: finite, y: finite, z: finite }),
    respawn: v.strictObject({ x: finite, z: finite, yaw: finite }) })) }),
  v.check(row => row.actor === row.definition.id
    && row.definition.phases.length === row.profile.fight.hpShares.length
    && row.definition.phases.every((phase, i) => phase.at === row.profile.fight.hpShares[i])
    && (row.profile.pattern === 'spawned') === (row.placement !== undefined)
    && (row.reward.when !== 'claim' || row.record !== undefined)
    && !(row.record !== undefined && row.saved !== undefined)
    && row.stages.script === null, 'Owned boss identity, placement, phases and reward binding'));
/** Admitted JSON binding for a real spawned or held native encounter owner. */

/** Validate the data contract before lending native bodies or installing callbacks. */
export function parseBossOwnerRow(input: unknown): BossOwnerRow { return v.parse(BossOwnerRowSchema, input); }

/** Admitted boss data independent of validator implementation metadata. */
export type ArenaBossProfileRowsInput = ArenaBossProfileRows;
// oxlint-disable-next-line typescript/consistent-type-definitions -- Valibot variant options require the alias's implicit dictionary compatibility.
export type ArenaBossProfileRows = { kind: 'boss'; pattern: 'arena'; fight: { origin: { x: number; y: number; z: number; }; bounds: number; rest: { x: number; z: number; plinth: number; lift: number; halfW: number; halfL: number; inset: number; focusY: number; }; shieldSpot: { x: number; z: number; }; enragedFrom: number; phases: ({ at: number; mem?: Record<string, number>; resume?: { shieldSpot?: boolean; mode?: string; mem?: Record<string, number>; sweep?: boolean; }; enter?: { roar?: { act: number; seconds: number; shed?: { field: string; from: number; rate: number; }; }; line?: string; mode: string; modeT: number; views?: ([string, ...(number)[]])[]; pourDelay?: number; pourStop?: boolean; sweep?: boolean; crownReset?: boolean; lineFirst?: boolean; cooldowns?: Record<string, number>; }; })[]; modes: Record<string, { damage: number; shielded: boolean; look: number; glows: boolean; motion: ({ kind: 'hold'; }) | ({ kind: 'fight'; }) | ({ kind: 'face'; yaw?: number; turn: number; }) | ({ kind: 'goto'; spot: 'shield'; speed: number; turn: number; arrive: number; roarTurn: number; next: string; }); timeouts?: ({ seconds: number; to: string; phase?: number; effect?: { modeT?: number; cancel?: boolean; mem?: Record<string, number>; yaw?: number; motion?: [number, number, number]; lockHp?: boolean; views?: ([string, ...(number)[]])[]; wave?: boolean; cooldowns?: Record<string, number>; line?: string; }; })[]; enter?: { modeT?: number; cancel?: boolean; mem?: Record<string, number>; yaw?: number; motion?: [number, number, number]; lockHp?: boolean; views?: ([string, ...(number)[]])[]; wave?: boolean; cooldowns?: Record<string, number>; line?: string; }; }>; modeNames: { rest: string; rising: string; fight: string; dead: string; }; attacks: { burst: { act: number; min: number; max: number; seconds: [number, number]; fireAt: number; rings: [number, number]; after: [[number, number], [number, number]]; comboFloor: number; lines: [string, string]; }; combo: { act: number; reach: number; engage: number; count: [number, number]; seconds: [number, number]; hitAt: number; chain: number; rest: [number, number]; cuts: ({ damage: number; reachMul: number; arc: number; shove: number; painted: boolean; })[]; above: number; }; commit: { windup: number; turn: [number, number]; }; chase: { stop: number; speed: [number, number]; turn: number; }; }; fields: { act: string; strike: string; hitDone: string; floorY: string; floorS: string; rise: string; pose: string; }; reset: { mem: Record<string, number>; combo: number; burst: [number, number]; pourDelay: number; drifts: { fromPhase: number; height: number; cap: number; at: ([number, number, number])[]; }; views: ([string, ...(number)[]])[]; glow: number; }; intro: { long: { lid: [number, number]; rise: [number, number]; pulse: number; }; short: { lid: [number, number]; rise: [number, number]; pulse: number; }; shaft: { index: number; base: number; amp: number; }; glow: { base: number; peak: number; lead: number; fade: number; }; }; begin: { mem: Record<string, number>; combo: number; burst: [number, number]; views: ([string, ...(number)[]])[]; }; glow: { base: number; glint: number; charge: number; glintFade: number; chargeFade: number; burn: [number, number, number]; }; hits: { head: [number, number]; armour: { melee: number; breaks: number; ranged: number; line: string; }; }; crown: { hp: number; fromPhase: number; field: string; to: string; effect: { modeT?: number; cancel?: boolean; mem?: Record<string, number>; yaw?: number; motion?: [number, number, number]; lockHp?: boolean; views?: ([string, ...(number)[]])[]; wave?: boolean; cooldowns?: Record<string, number>; line?: string; }; }; rings: { count: number; start: number; gap: number; speed: number; max: number; band: number; jump: number; damage: number; push: number; pushTime: number; strike: string; }; pour: { spots: ({ x: number; z: number; })[]; phase: number; every: [number, number]; tell: number; pour: number; fadeIn: number; fadeOut: [number, number]; pile: { r: number; rate: number; cap: number; }; hitRadius: number; hitRate: number; damage: number; strike: string; reset: number; }; sweep: { radius: number; squash: number; offset: number; speed: number; limit: number; start: number; ease: number; hitRadius: number; damage: number; every: number; strike: string; boss: { damage: number; every: number; extra: number; line: string; }; }; adds: { spots: ({ x: number; z: number; yaw: number; })[]; push: number; pairs: [(number)[], (number)[]]; mode: string; reinforce: number; retireAfter: number; cleared: { to: string; effect: { modeT?: number; cancel?: boolean; mem?: Record<string, number>; yaw?: number; motion?: [number, number, number]; lockHp?: boolean; views?: ([string, ...(number)[]])[]; wave?: boolean; cooldowns?: Record<string, number>; line?: string; }; }; }; victory: { views: ([string, ...(number)[]])[]; crumble: number; drain: number; }; views: (string)[]; }; };
export type RoamingBossProfileRowsInput = RoamingBossProfileRows;
// oxlint-disable-next-line typescript/consistent-type-definitions -- Valibot variant options require the alias's implicit dictionary compatibility.
export type RoamingBossProfileRows = { kind: 'boss'; pattern: 'roaming'; fight: { decision: { mode: string; request: string; rings: string; adds: string; lane: string; phase: string; fight: string; modeT: string; strikeCd: string; burstCd: string; summonCd: string; chain: string; modes: (string)[]; }; kind: 'roaming'; origin: { x: number; z: number; }; phases: ({ at: number; beginMode: string; chaseSpeed: number; recoverySeconds: number; burstCooldown: number; summons: boolean; rings: number; darkness: boolean; enter?: { mode: string; drop?: boolean; summonDelay?: number; resetChain?: boolean; roar?: boolean; }; })[]; modes: Record<string, { kind: 'idle' | 'intro' | 'pursue' | 'strike' | 'burst' | 'wait-rings' | 'recover' | 'summon' | 'lanes' | 'dead'; damage: number; }>; names: { idle: string; intro: string; dead: string; pursue: string; strike: string; burst: string; wait: string; recover: string; summon: string; }; arena: { entry: number; wall: number; fog: number; leash: number; wallPad: number; clampPad: number; shoveBase: number; shoveGain: number; shoveDistance: number; shoveSpan: number; epsilon: number; }; seal: { inSeconds: number; outSeconds: number; darkIn: number; darkOut: number; }; opening: { mode: string; lanesMode: string; inRate: number; outRate: number; inactiveRate: number; }; damage: { invulnerable: number; weakOpen: number; weakClosed: number; opening: number; }; initial: { strikeCd: number; burstCd: number; summonCd: number; }; recoveryTurn: number; reset: { glow: number; strikeCd: number; burstCd: number; summonCd: number; herd: number; }; intro: { short: number; long: number; glowStart: number; glowEnd: number; lookEnd: number; roarAt: number; crossingStep: number; absentHeight: number; }; begin: { glow: number; summonDelay: number; }; victoryGlow: number; points: { rewardZ: number; rewardY: number; respawnZ: number; respawnYaw: number; }; strike: { id: string; clip: { duration: number; hitPhase: number; }; action: string; reach: number; chaseNear: number; chaseTurn: number; turn: number; radius: number; cooldown: number; tell: [number, number, number, number, number]; trauma: number; contactTrauma: number; }; burst: { clip: { duration: number; hitPhase: number; }; action: string; after: number; turn: number; radius: number; tell: [number, number, number, number, number]; trauma: number; }; rings: { gap: number; speed: number; trauma: number; strike: string; }; summon: { clip: { duration: number; hitPhase: number; }; action: string; count: number; limit: number; cooldown: number; turn: number; }; lanes: { stop: number; speed: number; turn: number; burstRange: number; after: number; tell: number; action: string; batch: number; rest: number; chainRest: number; soundTicks: number; trauma: number; }; adds: { kinds: (string)[]; radius: number; far: number; near: number; fast: number; slow: number; turn: number; chargeRange: number; rate: number; tell: number; trauma: number; leashPad: number; }; hazards: { count: number; angleStart: number; angleStep: number; angleOffset: number; radius: number; radiusStep: number; fallSeconds: number; every: number; damage: number; strike: string; fromPhase: number; }; sounds: { intro: string; roar: string; burst: string; add: string; charge: string; }; }; };
export type SpawnedBossProfileRowsInput = SpawnedBossProfileRows;
// oxlint-disable-next-line typescript/consistent-type-definitions -- Valibot variant options require the alias's implicit dictionary compatibility.
export type SpawnedBossProfileRows = { kind: 'boss'; pattern: 'spawned'; fight: { arena: { x: number; z: number; r: number; }; hpShares: (number)[]; riseSeconds: number; stormPhases: (number)[]; stormFade: number; fields: { fight: string; rise: string; phase: string; }; }; };
export type HeldBossProfileRowsInput = HeldBossProfileRows;
// oxlint-disable-next-line typescript/consistent-type-definitions -- Valibot variant options require the alias's implicit dictionary compatibility.
export type HeldBossProfileRows = { kind: 'boss'; pattern: 'held'; fight: { arena: { x: number; z: number; r: number; floor: number; }; hpShares: (number)[]; rewardPoint: { x: number; y: number; z: number; }; respawn: { x: number; y: number; z: number; yaw: number; }; }; };
export interface ScriptBossProfileRowsInput { kind: 'boss'; pattern: 'script'; fight: v.InferInput<typeof EliteScriptSchema>; }
export interface ScriptBossProfileRows { kind: 'boss'; pattern: 'script'; fight: v.InferOutput<typeof EliteScriptSchema>; }
export type BossProfileInput = (ArenaBossProfileRowsInput) | (RoamingBossProfileRowsInput) | (SpawnedBossProfileRowsInput) | (HeldBossProfileRowsInput) | (ScriptBossProfileRowsInput);
export type BossProfile = (ArenaBossProfileRows) | (RoamingBossProfileRows) | (SpawnedBossProfileRows) | (HeldBossProfileRows) | (ScriptBossProfileRows);
export type MarkedBossPresentationInput = MarkedBossPresentation;
export interface MarkedBossPresentation { floor: number; respawn: { x: number; z: number; yaw: number; }; storm: { dist: number; color: number; shells: ([number, number, string])[]; wind: { x: number; z: number; }; }; toasts: { summoned: string; reward: string; rewardAgain: string; }; }
export interface BossOwnerRowInput { step: string; actor: string; profile: (SpawnedBossProfileRowsInput) | (HeldBossProfileRowsInput); definition: { id: string; name: string; title: string; retryTitle: string; intro: number; introShort: number; phases: ({ at: number; caption: string; name: string; })[]; reward: Record<never, never>; }; stages: v.InferInput<typeof DirectorStagesSchema>; armed: boolean; record?: { defeated: string; paid: string; }; saved?: { defeated: boolean; rewardTaken: boolean; kills: number; }; victory: { flag: string; fact: string; once: boolean; }; reward: { when: 'claim' | 'victory'; amount: number; }; placement?: { rewardPoint: { x: number; y: number; z: number; }; respawn: { x: number; z: number; yaw: number; }; }; }
export interface BossOwnerRow { step: string; actor: string; profile: (SpawnedBossProfileRows) | (HeldBossProfileRows); definition: { id: string; name: string; title: string; retryTitle: string; intro: number; introShort: number; phases: ({ at: number; caption: string; name: string; })[]; reward: Record<never, never>; }; stages: v.InferOutput<typeof DirectorStagesSchema>; armed: boolean; record?: { defeated: string; paid: string; }; saved?: { defeated: boolean; rewardTaken: boolean; kills: number; }; victory: { flag: string; fact: string; once: boolean; }; reward: { when: 'claim' | 'victory'; amount: number; }; placement?: { rewardPoint: { x: number; y: number; z: number; }; respawn: { x: number; z: number; yaw: number; }; }; }
