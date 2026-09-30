# Combat + creature AI as engine mechanisms: audit and design (E357, 2026-09-30)

**Scope:** Jake's decisions 5, 10, 11, 12 (docs/tasks/asks/E357.md): melee and ranged combat are engine; the engine
owns five weapon archetypes (Melee, Bow, Crossbow, Firearm, Thrown) and a weapon is **archetype + profile**; feel
**converges per archetype** (before/after clip board per wave); creature AI, strike timing, hitboxes, ragdolls,
spawning, loot, bosses and elites are engine, species are content (rule of two: 2+ shards → `src/kit/`, else the shard).
Found bugs are fixed inline. Builds on [aaa-architecture.md](aaa-architecture.md) §2.6–2.7 (GAS-lite, HFSM + utility,
boss goal stack) and the audit's D1–D8 ([game-normalization-2026-09-30.md](../../audits/game-normalization-2026-09-30.md) §4).
Read-only on `src/`; every claim cites file:line at `3580db5c`.

## 0. Findings in one screen

1. **Melee is already archetype + profile in all but name.** `Sword` (Sword.ts:427) takes a rig, a move set, damage,
   reach and framing (`SwordOptions`, Sword.ts:134); Nine Dragon's jian is `ChunkDef.sword` → skinned arms on the same
   Sword (nine-dragon-stack/def.ts:105, vm/arms.ts:39); the Sabre `extends Sword` (Sabre.ts:202). `Move`
   (SwordMoves.ts:26: windup / slashEnd / total / damage / stagger / hitStop / kick / reach / trail) is the MoveDef.
   The **Spear is the outlier**: its own 758-line class (Spear.ts:203), no Sword reuse, no hit-stop, no occlusion.
2. **Two weapon contracts and an adapter that guesses.** `Weapon` (Weapon.ts:35; `bolts`, `onHit` typed
   `'deer' | 'boar'`) and `KitWeapon` (Weapons.ts:51; `ammo / magazine / reserve`) are bridged by `BaseWeapon`
   (Weapons.ts:101), which tells crossbow from sword by `instanceof Crossbow` (Weapons.ts:109). The kit is chosen by slug
   in five branches (main.ts:529–549); `ChunkDef.weapon: 'nalati'` is ignored. Weapon-id sets decide UI and sound in
   TouchControls.ts:99–101,209, LockOnTarget.ts:57, WeaponStrip.ts:24, Menu.ts:478, nalatiKit.ts:55, main.ts:694–703,
   nalati/sound.ts:164–178, pinehollow/loadout.ts:172–182.
3. **Feel differs by shard, not by weapon.** Hit-stop fires only from Sword (Sword.ts:846,877) and from Pine's
   `feel.ts:44`, which monkey-patches `weapons.onHit` for every Pine weapon: the Nalati Bow, Spear and javelins have
   none, and the same Longbow would lose it if it moved shards. The hurt arc and trauma shake are
   `meleeShard(chunk) || pineFights !== null` (main.ts:836–837).
4. **Occlusion is patchy in both directions.** Player → creature: every path checks the world **except** the spear
   thrust (Spear.ts:561–579, the known bug), the brace / couched lance (Spear.ts:523–557) and Naizagai's crescent
   (Naizagai.ts:204–247). Creature → player: `AnimalManager.canReach` (AnimalManager.ts:1020) runs **only on melee
   shards** (`this.melee`, :435), so on Pine Hollow a boar or bear charge (`chargeHit`, :944 at 1.4 m) and every
   `c.hurt` hit through a cabin wall; `LaneCharge` (pinehollow/ctx.ts:79), both elite sets and all four bosses check
   distance + arc only.
5. **Five ways to hurt the player**, all hand-written in main.ts: onCharge (:831), ride (:903), lightning (:907), Storm
   Titan (:923), fall (:945). Only onCharge applies the hit cap (`hitDamage`, ChunkDef.ts:452) and the tusk's dodge
   guard (:832). Health is a `let` in main.ts (:612).
6. **Three damage models**: the bolt model with `Math.random()` (Animal.ts:57–64; Crossbow, Projectiles, both
   rifles), blade base × move (Sword.ts:867), and fixed numbers (spear 30, javelin 55 × 2, brace 60 + 8v, crescent 40).
7. **Creature attacks are 24 hand-rolled `startAttack` + `attackPhase >= x && !hit && d <= R` blocks** (crab.ts:266,
   sailor.ts:340, monkey.ts:296, captain.ts:279, balbal.ts:402, nalati/elites.ts:238–646, kurganBoss.ts:257–264 …).
   `LaneCharge` (ctx.ts:79, 17 uses) and `AttackTokens` (fightRules.ts:18) are the seeds of the engine's strike spec
   and aggression director; `Boss` (game/Boss.ts:136) and `Elites` (game/Elite.ts:126) are already generic halves.

## 1. Weapon inventory

| Weapon (HUD name) | Class, file:line | Lines | Shard | Archetype | What is particular |
|---|---|---|---|---|---|
| Wooden sword | `Sword`, Sword.ts:427 (+ SwordMoves.ts) | 1,061 + 113 | Driftwood (base) | Melee | the reference: 3-hit combo + charged heavy, lunge, swept blade, clang, hit-stop 60/60/90/140 ms; 12 dmg; castaway arms `ChunkDef.sword` (driftwood-isle.ts:102) |
| Iron sword | `Sword {blade:'iron'}`, main.ts:548 | — | Driftwood (found; `IronSwordPickup` IronSword.ts:231) | Melee | 28 dmg, sparks |
| Neon Jian | `Sword` + `ShardSword.arms`, nine-dragon-stack/def.ts:105, vm/arms.ts:39 | vm/ 2,606 | Nine Dragon (only weapon) | Melee | skinned rig plays clips named by the engine's moves; own trail; portrait FOV 78 (def.ts:103); **12 dmg by default** (ShardSword has no damage field) |
| Sabre | `Sabre extends Sword`, Sabre.ts:202 | 258 | Nalati | Melee | 24 dmg, `swingScale` 0.9, own keys and hit-stops 45/45/60/80 ms (Sabre.ts:133–167), mounted pass slash + chain (:178–191) |
| Naizagai | `Naizagai`, Naizagai.ts:121 | 264 | Nalati (Titan reward) | Melee upgrade | crescent 40 dmg 15 m at a gallop, call-down 60 r 3 (:45–46) |
| Spear + javelins | `Spear`, Spear.ts:203 | 758 | Nalati | Melee (thrust, brace, lance) + **Thrown** | thrust 30 r 3.2 (:57–58), brace 60 + 8v, lance 40 + 6v, javelins 28 m/s full gravity 55 × 2 (:63–65), own flight loop (:433) |
| Bow | `Bow`, Bow.ts:577 (+ bowDraw.ts, Projectiles.ts) | 981 | Nalati (slot 1) | Bow | draw 0.75 s, zoom 2×, 30 + 28p m/s, g 5, drag .015 (:82–87,177); mount share (:779) |
| Golden Bow | `GoldenBow`, GoldenBow.ts:47 | 233 | Nalati (King reward) | Bow upgrade | draw × 1.2, sun-arrow pierce, balbal × 2 / × 3 |
| Warden's longbow | `Longbow`, Longbow.ts:454 | 792 | Pine (King reward) | Bow | **fork of Bow** (audit: 239 of 792 lines differ); PBR; zoom 1.6×, 32 + 30p, g 6, drag .014 (:42–45,145) |
| Crossbow | `Crossbow`, Crossbow.ts:768 | 1,307 | Pine (default `ChunkDef.weapon`) | Crossbow | own bolt integrator (:1225), `BoltMod` special bolts (:575, pinehollow/loadout.ts), ADS 1.3× (:126) |
| AR-15 | `Rifle`, Rifle.ts:221 | 613 | Nalati (locked; practice loan) | Firearm | semi 30-mag, 0.09 s, reload 1.6 s, × 0.55 (:53–64) |
| Lever-action | `LeverRifle`, LeverRifle.ts:268 | 929 | Pine (cabin pickup) | Firearm | tube 6 + 1, lever cycle 0.12 + 0.56 s, 0.4 s per round, × 1.5 (:67–81); audit: 179 lines verbatim Rifle / Crossbow |

Shared today: `BowDraw` (bowDraw.ts:33), `Projectiles` (Projectiles.ts:115; also the ghost riders' arrows with
`hurtsPlayer`), `MeleeSweep` (`bladeBlocked` / `bladeContact`), `AimTargets` / `AimAssist`, `CameraFX`,
`Game.hitStop` (core/Game.ts:457), `ItemPickup` / `WeaponPickup` (WeaponPickup.ts:139).

**Around the weapons**
- **Lock-on** (`LockOnSystem`, main.ts:550): gated by `LOCK_WEAPONS` = the melee ids (LockOnTarget.ts:57) → an
  archetype capability (`lockOn: true` on Melee), not an id list.
- **Dodge** (`Player.dodge`, Player.ts:299; 3 m / 0.25 s, cooldown 0.8 s, :66–82): no i-frames, except the E314 tusk
  keepsake (`dodgeGuard`, main.ts:832) on the onCharge path only. Only Sword kicks its viewmodel on a dodge (Sword.ts:170,1004).
- **Hit-stop**: see finding 3. **Hit caps**: `maxHitDamage` / `hitCapExempt` (ChunkDef.ts:569–571; Driftwood 20,
  `['captain']`, driftwood-isle.ts:243–244) through `hitDamage` in onCharge only. **fightRules** (ChunkDef.ts:583,
  Driftwood only, driftwood-isle.ts:251) → `AttackTokens` (AnimalManager.ts:441) + `WindupWarn` (main.ts:861); the
  wolves run a second token system of their own (Pack.ts:268).

## 2. Profile schema and the convergence board list

The engine owns one viewmodel shell (look lag, bob, sway, holster / stow, sprint pose, Hor+ FOV, dodge kick) with **one
set of numbers for every weapon**, one projectile pool, one ADS solver and the archetype state machines. A profile
holds only what differs by design. Ids per aaa-architecture §2.5 (`weapon:longbow`), rows with `parent`.

```ts
type Archetype = 'melee' | 'bow' | 'crossbow' | 'firearm' | 'thrown';
interface WeaponRowBase {
  id: `weapon:${string}`; parent?: `weapon:${string}`; archetype: Archetype; name: string;
  icon: string;                                  // touch SVG (WeaponStrip ICONS today)
  viewmodel: () => Promise<ViewmodelRig>;        // rigid model or skinned arms (SwordRig / SwordArms / ShardSword today)
  framing?: Partial<{ pullX: number; shrink: number; dx: number; dy: number; tilt: number; yaw: number }>;
  cues: { fire: CueId; hit: CueId; impact: CueId; dry?: CueId; reload?: CueId; trail?: CueId }; // the shard's look + sound kits resolve them
  ammo?: { label: string; segments: number; carry: number; kinds?: AmmoId[] }; // Bolts / Arrows / Rounds / Javelins; BoltMod → AmmoRow
  mounted?: MountedMods;                         // draw rate, spread, pass slash, lance (Nalati riding)
  upgrades?: EffectId[];                         // Golden Bow, Naizagai = effects that override fields + add a move
}
interface MeleeProfile extends WeaponRowBase { archetype: 'melee';
  damage: number; reach: number; moves: { rest: Key; charge?: Key; sprint: Key; combo: MoveId[]; heavy?: MoveId; alt?: 'brace' };
  lunge: boolean; clang: 'wood' | 'steel'; }     // timings + hit-stops live in the MoveDefs, converged per archetype
interface BowProfile extends WeaponRowBase { archetype: 'bow';
  damageScale: number; arrow: ProjectileRow; limb: 'recurve' | 'longbow'; arcColor?: CueId; }
interface CrossbowProfile extends WeaponRowBase { archetype: 'crossbow'; bolt: ProjectileRow; reload: number; }
interface FirearmProfile extends WeaponRowBase { archetype: 'firearm';
  action: 'semi' | 'lever'; magazine: number; reserve: number; reload: { kind: 'magazine' | 'per-round'; time: number };
  damageScale: number; kickDeg: number; sights: { eyeAbove: number; rearZ: number; frontZ: number }; }
interface ThrownProfile extends WeaponRowBase { archetype: 'thrown'; projectile: ProjectileRow; carry: number;
  damage: { body: number; headMul: number }; windup: number; pickup: { r: number; survive: number }; }
```

`ProjectileRow { speed: [base, perDraw]; gravity; drag; windCoupling; radius; length; bury; recover; stick }` is one
table for arrows, bolts, javelins, cartridges (hitscan = speed ∞) and enemy arrows. `maxFlying` / `maxStuck` move to
the tier table (64 vs 48 stuck arrows today is a perf cap, not design).

**The convergence board list** (each row = one before/after clip on the wave board; "keep" = profile data):

| # | Archetype | Parameter | Today | Verdict |
|---|---|---|---|---|
| M1 | Melee | hit-stop per move | Sword 60/60/90/140 ms; Sabre 45/45/60/80; Spear 0 | **converge** to Sword's |
| M2 | Melee | swing speed | Sabre × 0.9 (Sabre.ts:33), others 1 | **converge** to 1 (Jake: every sword the same) |
| M3 | Melee | combo timings | Sabre slash slashEnd 0.24 vs 0.235; its keys differ | **converge** timings; keys (the arc's look) stay per rig |
| M4 | Melee | occlusion, hit flash, camera kick, clang + debris | Sword family all; Spear none (jolt only) | **converge** (+ the thrust bug) |
| M5 | Melee | look lag / bob / dodge kick | Sword k 220, gain .5, bob .018/.014, dodge kick; Spear k 200, gain .4, clamp .10/.08, bob .016/.013, no kick | **converge** (shell) |
| M6 | Melee | lunge | Sword family yes; Spear no | keep (move-set data: the thrust holds a wolf off) — show on board |
| M7 | Melee | damage / reach | 12 · 28 · 12 (jian) · 24 · 30; 2.2 · 3.2 | keep; jian's 12 is a design question for Jake |
| M8 | Melee | portrait FOV | jian 78 via Sword option, others 72 | move to the shard camera (`ChunkDef.fov`), not the weapon |
| B1 | Bow | aim zoom | Bow 2×, Longbow 1.6× | **converge** |
| B2 | Bow | arrow flight | 30 + 28p / g 5 / drag .015 vs 32 + 30p / g 6 / drag .014 | **converge** (trajectory snapshot) |
| B3 | Bow | sway | 1.5° vs 1.4° | **converge** |
| B4 | Bow | hit-stop + kick on a hit | Nalati none; Pine 35/55/75 ms (combatMath `boltHitStop`) | **converge** (engine cue on every ranged hit) |
| B5 | Bow | damage scale, quiver | 1.2 / 24 vs 1.35 / 20 | keep (the legendary is stronger) |
| B6 | Bow | arc colour, material, limb | cyan painterly recurve vs amber PBR yew | keep (shard look cue, model) |
| B7 | Bow | wind | steppe wind vs `pineWind` (Longbow.ts:57) | engine reads the world's `WindField`; not a weapon field |
| F1 | Firearm | hitscan range / range readout | 300 / 120 vs 320 / 150 | **converge** |
| F2 | Firearm | spread | hip 1.1 / ADS .12 + bloom .35 (max 1.6) vs hip .9 / ADS .06, no bloom | **converge** hip / ADS; bloom stays a semi-auto rule |
| F3 | Firearm | ADS blend, flash, brass, tracers | .16 / .05 s 30 / 3 × 1.4 s / 3 vs .17 / .06 s 34 / 4 × 1.8 s / 2 | **converge** |
| F4 | Firearm | hit-stop | AR-15 on Nalati none; lever on Pine yes | **converge** (with B4) |
| F5 | Firearm | action, reload, damage, kick | semi / 1.6 s / .55 / .35° vs lever / per round / 1.5 / 1.25° | keep |
| X1 | all | shell: look lag, bob, FOV_HIP ×4, `fovForAspect` ×3, sprint blend | 5 bob sets, 2 spring constants (200 / 220), 2 gains | **converge** into the one shell (audit D1) |

Crossbow and Thrown have one weapon each: no in-archetype board. Their merges are mechanism-only (the bolt and the
javelin fly on the shared projectile pool) and must pass the trajectory snapshots unchanged. The Crossbow's ADS
(1.3×, blend .18) is the Crossbow archetype's; the firearms borrow its `FOV_ADS` (Rifle.ts:12) and keep it.

## 3. The damage pipeline

**Player → creature today** (all end in `Animal.applyDamage(amount, point, dir)`, Animal.ts:333, which applies the
variant's `damageTaken` and the species' `damageMul`):

| Path | file:line | Occlusion |
|---|---|---|
| Sword / iron / jian / Sabre swept blade + mounted pass | Sword.ts:819 → `bladeBlocked` | yes |
| **Spear thrust** | Spear.ts:561–579 | **no: hits through walls** (bug, fix inline) |
| **Spear brace / couched lance** | Spear.ts:523–557 (eye → body ray, animal capsules only) | **no** (same fix) |
| Javelin | Spear.ts:433–470 (`worldHit` bounds the animal ray) | yes |
| Bow / Longbow / enemy arrows | Projectiles.ts:311–317 | yes |
| Crossbow bolt | Crossbow.ts:1225–1231 | yes |
| AR-15 / lever hitscan | Rifle.ts:366–373, LeverRifle.ts:547–554 | yes |
| Golden Bow pierce | GoldenBow.ts:118–166 (walks `Projectiles.predict`, which stops at the wall) | yes |
| **Naizagai crescent + arcs** | Naizagai.ts:204–247 (15 m capsule over `animals.animals`) | **no** (fix inline) |
| Naizagai call-down | Naizagai.ts:185–195 (aimed by `castRay`, :257) | AoE from the sky: ignores cover by design |

**Creature / world → player today**: main.ts:831 `onCharge` gathers the AnimalManager charge (:944, per-frame :957),
species `c.hurt` (:779), coconuts (Enemies.ts:310), Pine's `ctx.hurt` (pinehollow/index.ts:85: elites, King, thralls),
Nalati elites (nalati/elites.ts:861), night enemies (nightEnemies.ts:59), the Golden King (kurganBoss.ts:663), the
ride (ride.ts:76) and ghost arrows (Projectiles `hurtsPlayer`). The ride (:903), lightning (:907), the Storm Titan
(:923) and falls (:945) write `health` directly. Only onCharge gets the cap, the dodge guard, the hurt arc (and that
only on melee shards + Pine). Pine's player stun (`ctx.stun`, pinehollow/index.ts:86) is a local status effect.

**The one pipeline** (`src/engine/combat/`; aaa-architecture §2.6):

```ts
interface HitSpec {
  attack: AttackId;                 // AttackRow { damage: DamageModel; type: Tag; poise; knockback; hitStop; effects?; cue; cover }
  source: EntityRef | 'world';      // a creature, the player, the weather, a fall
  target: EntityRef | 'player';
  point: Vec3; dir: Vec3; headshot?: boolean; distance?: number;
}
type DamageModel = { fixed: number } | { bolt: { body: [number, number]; headMul: number; falloff: [number, number, number] } }
                 | { blade: { mult: number } } | { speed: { base: number; perMs: number } };   // brace, lance, charges
function hit(h: HitSpec): HitResult | null;
// 1. cover: lineOfSight(source chest/eye → target body, radius) unless attack.cover === 'ignores' (lightning, rings, fire)
// 2. ask('combat.prehit'): dodge i-frames, brace / parry, stealth ×2, Parthian, balbal crack, hit cap (a shard RULE row,
//    not a ChunkDef special case), god mode (the three `?bossGod` / `god` patches today)
// 3. amount = model × modifiers (variant damageTaken, species damageMul, effect mods) with the SEEDED rng (no Math.random)
// 4. Vitals.apply (player health leaves main.ts), stagger / poise / knockback
// 5. emit('combat.hit' | 'combat.kill'): hit-stop, kick, trauma, hurt arc, flash, floats, blood, sound, loot, quests
```

Every row in the two tables above becomes one `hit()` call. The five hurt blocks become one `combat.hit` subscriber
(HUD flash, audio, hurt arc, killer toast). Hit-stop, kick and trauma become cues on the AttackRow, so a Longbow feels
the same on any shard.

## 4. Creature AI

| Brain | file:line | States / attack timing (wind-up → hit → recover; dmg; reach) | Shards |
|---|---|---|---|
| Herd hunter (deer, boar, bear, elk) | AnimalManager.ts:26–118, `HuntTuning` :144 | idle · graze · wander · alert · flee · charge · stalk · dead (Animal.ts:54) + E297 back-off / circle; charge wind-up boar .55, bear .65, default .5 (**melee shards only**, :218); contact 1.4 m, arc 50°, commit 4.5 m; boar 25, bear 35 (variants 32–55) | Driftwood, Pine |
| Crab | crab.ts:214 | snap: wind-up .5 of .78; r 1.6; 10 | Driftwood |
| Monkey | monkey.ts:233 | bite at .45 of .9, r 1.3, 6; coconut release .62 of 1.0, 8 | Driftwood |
| Drowned sailor | sailor.ts:276 | swing: wind-up .6 of .9 (+.05); r 1.9; 14 | Driftwood |
| Drowned Captain (boss, no Boss.ts) | captain.ts:229–312 | phases by hp .66 / .33 (:236); wind-up .7 / .62 / .5, cooldown 1.4 / 1.2 / .8; swing 24 r 2.5; burst 16 r 3 after 1.1 s of bubbles | Driftwood |
| Wolf pack (group brain) | Pack.ts:58–60 | roam → shadow → encircle ⇄ regroup → break; own token; .4 s telegraph, 9.5 m/s dash, bite 1.4 m, 12 / 18 | Nalati |
| Horse herd, sheep flock, sheepdog | Wildlife.ts, Flock.ts, Herd.ts | flee / stampede, no attack (stallion 25) | Nalati (+ horse playground) |
| Balbal warriors | balbal.ts:339–402 | rise · guard · stalk · attack · return · sink · emerge; ATK 2.9 s, wind-up to .52, strike .58, 1.5 s wedge; r 3.1 cone .96; 30 / 18 | Nalati |
| Ghost riders | ghostRiders.ts:133–188 | circle 34 m, arrows through Projectiles, 10 | Nalati |
| Nalati elites (`Base`) | nalati/elites.ts:132 | Aqbars :176 swipes at .45 / .8, 14 + 14, pounce 35 · Kokbori :301 bite .7, 22 · Qyran :408 dive 30 · Qara Batyr :551 charge 38 · Argymaq :709 lane | Nalati |
| Pine elites (`PineElite`) | pinehollow/elites.ts:120 | LaneCharge rows: Ironhide 30 @ 12.5 m/s · Blackpaw 28 + stun ring 12 + swipe · Imperial Bull 34 + rival lanes 18 · Ghost Stag fade | Pine |
| Golden King | kurganBoss.ts:75 | strikes at atk .62, reach 3.0 / 3.3, arc .95 / 1.35, 14/14/22/22; sunburst ring 25 @ 8.5 m/s; beam 15; phases .6 / .3 | Nalati |
| Storm Titan | stormTitan.ts:341 | spear aim 1.5 + lock .5, r 4.5, 40; whirl 15; wind-charge lane 1.2 s, 30; chain lightning lands .6 s, r 3, 18; fire 8 dps | Nalati |
| Antler King | antlerKing.ts:137 | sweep ring .9 s, 24; stomp 1.0 s → ring 20 (jump dodges); lanes 32 @ 13; thrall lanes 14; lantern fire 9; phases .6 / .3 (combatMath.ts:13) | Pine |
| Night thralls | quest/nightThralls.ts:30 | the herd brain on `thrall` variants of elk / boar | Pine |

Spawning today: `ChunkDef.fauna` herd plans, Enemies.ts, Wildlife.ts, nightEnemies.ts, nightThralls.ts, rolled-elite
swaps (pinehollow/elites.ts:98), boss adds; five `retire()`s (pinehollow/ctx.ts:61, balbalWarriors.ts:262, …).

**The engine AI runtime** (`src/engine/ai/`):
- **Brain = HFSM** over a shared behaviour library: today's herd states (senses and flee from `HuntTuning`), E297
  back-off / circle, hide / perch / rise / sink (Driftwood, balbal), stagger, dead. A species picks states and supplies
  at most a few of its own; the 24 hand-rolled attack blocks go away.
- **StrikeSpec**, the one attack-timing type (FromSoft TAE; `LaneCharge` generalised):
  ```ts
  interface StrikeSpec { id: StrikeId; attack: AttackId; windup: number; active: [number, number]; recover: number;
    shape: { arc: { reach: number; halfAngle: number; maxDy?: number } } | { lane: { width: number; speed: number; overshoot: number } }
         | { ring: { speed: number; halfWidth: number; jumpDodges: boolean } } | { wedge: { reach: number; halfAngle: number } } | { point: { r: number; delay: number } };
    tell: CueId; token: boolean; interruptible: boolean; turnCap?: number; cooldown: number; }
  ```
  The runtime runs wind-up (pose + tell cue + `ai.windup` for WindupWarn) → active window (shape test, then `combat.hit`
  with cover) → recover (the shot window). One code path for crab snap, bear charge, balbal slam, King sweep and Titan spear.
- **Utility pick** among a brain's strikes: range, HP band, cooldown, recent use (aaa §2.7).
- **Aggression director**: `AttackTokens` becomes engine-wide; `maxAttackers` is shard data (Driftwood 2, others to
  tune on the board); the wolves' behind-the-player token is a group policy on the same director.
- **Bosses / elites**: a species row + `phases: [{ hpBelow, strikeWeights, adds?, arena?, music? }]` + an optional
  goal-stack script for set pieces. `Boss` / `Elites` stay engine; nalati `Base` and pine `PineElite` merge into one
  engine elite script base; the Captain becomes a Boss row (a bar, checkpoints) like the three others.
- **Spawn director** over `PickTable`s (herds, packs, night thralls, balbal wake, ghost lines, adds) with the tier caps;
  one `animals.retire(a)`.
- **Occlusion default on**: `canReach` runs on every shard (fixes Pine's charges through walls); `cover: 'ignores'`
  only for rings, beams, fire and lightning.

**Species placement (rule of two):** **kit** — boar, bear (Driftwood + Pine), horse (Nalati + the horse playground,
`Mount` is engine); **Pine** — deer, elk, thrall, antler-king, its four elites; **Nalati** — wolf, sheep, sheepdog,
eagle, leopard, kokbori, balbal, kurgan-balbal, ghost rider, golden king, argymaq, titan; **Driftwood** — crab,
monkey, sailor, captain; **Nine Dragon** — none (the training dummy is engine). Mechanisms (herd brain, group brain,
strike shapes, tokens, bosses, elites, taming) are engine even when one shard uses them today.

## 5. Order and the tests to write first

**Tests first (before any move; they are the golden master for "identical" steps):**
1. `test/trajectory-snapshots.test.ts`: every projectile row (Bow, Longbow, Golden sun arrow, Crossbow × iron /
   pitch / broadhead, javelin, ghost arrow) launched at 5 pitches and 3 draws, position every 1/60 s for 3 s, no
   wind, no world. Needs the flight step split out of Projectiles / Crossbow / Spear as a pure function first (a
   mechanical extract). A converge row (B2) then changes the snapshot in its own commit, next to its clip.
2. `test/strike-table.test.ts`: every creature attack from §4 as a row (wind-up, active, reach, arc, damage, cover),
   asserted against today's constants; the StrikeSpec migration keeps it green row by row.
3. `test/melee-moves.test.ts`: the Sword / Sabre / Spear move tables (timings, hit-stops, damage mults) — the M1–M3
   board rows diff against it.
4. `test/damage-pipeline.test.ts`: cover (a thrust through a wall does 0, Spear.ts:561), the hit cap on every source
   (Titan, lightning, fall), the dodge guard, seeded `damageFor`, god mode.
5. `test/weapon-contract.test.ts`: every row satisfies its archetype profile; no `instanceof` on a weapon class.

**Migration order** (Jake's shard order, decision 8):
1. **Nine Dragon — Melee + the pipeline.** Its only weapon is the jian on `Sword`, the model to follow. Land the
   `WeaponRow` / `MeleeProfile`, the one contract (`Weapon` + `KitWeapon` → one), the shell (X1), `hit()` with cover and
   Vitals, the kit from `ShardManifest` rows (no slug branches). Fix inline: spear thrust + brace cover (Spear.ts:561,
   :523). Board: M1–M8 clips.
2. **Pine Hollow — Crossbow, Firearm, Bow + the AI runtime.** Crossbow and lever on the one projectile pool / hitscan;
   `BoltMod` → AmmoRows; Longbow = `weapon:bow` row with overrides (deletes ~450 lines); feel.ts → engine cues.
   AI: `LaneCharge` → StrikeSpec lane, Pine elites and the Antler King → rows, `canReach` on every shard (fix).
   Board: B1–B7, F1–F4 (lever), Pine creature clips.
3. **Nalati — the Bow converges with the Longbow, Sabre / Spear onto Melee, Thrown, mounted mods, the AR-15.** Golden
   Bow and Naizagai → upgrade effects (crescent cover fix). AI: pack group brain, balbal, ghost riders, elites, Golden
   King and Titan → rows; the Titan / lightning / ride hurts go through `hit()`.
4. **Driftwood — Melee is the reference already; creatures.** Boar and bear to `src/kit/`, crab / monkey / sailor onto
   StrikeSpec, the Captain onto `Boss`. Board: the enemy clips (timing unchanged unless a converge row says so).

Open questions for Jake (not decided here): the jian's damage (12 = the wooden sword today, M7); the converged bow zoom
(2× or 1.6×, B1) and arrow flight (B2); whether every shard gets `fightRules` tokens (default 2) and i-frames on the dodge.
