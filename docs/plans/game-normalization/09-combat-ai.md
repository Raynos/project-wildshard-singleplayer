# GAME-NORMALIZATION v2 · 09 — Combat and creature AI

This spec says what every combat and creature row of the plan builds, with today's numbers, so that "every weapon keeps
its own behaviour" (decision 12′) and "each fight unchanged" can be checked line by line. It builds on the interfaces in
[01-architecture.md](01-architecture.md) §3 (events, asks, tags), §10 (input), §12 (scheduler), §18 (Equipment, Weapon,
Tool, GAS-lite, the pipeline), §19 (creatures and AI) and §21 (the kit). Where this spec needs something 01 does not
have, it says so in §8 ("Questions for the lead"); it never changes 01.

Rows covered: S1.2, S1.3, S1.4 (the Tool contract), S2.2, S2.3, S2.5 (starter effects), S2.6 (tick rates for AI),
S3.3, S3.4, S4.2. Decisions: 4, 5, 10, 11, 12′, 15, 16, 18, 19, 20, 23, 24–27, 55, 55′, 67, 70 in
[E357](../../tasks/asks/E357.md).

**Every file:line below is at `a9904a84` (2026-09-30).** A row that moves code first re-checks its line refs with
`git grep`; a ref that moved is fixed in this file in the same commit.

## 0. Rules for this spec

| Rule | Detail |
|---|---|
| Identical by default | Every step is identical under the parity harness ([03-harness-gate.md](03-harness-gate.md)) unless this spec names a difference. Named differences are either a **bug fix** (§3.4, each with a test) or a **board item** (§7). Nothing else may change |
| Ids | Dot-case typed strings (01 §0). Weapons `weapon.<id>`, tools `tool.<id>`, effects `effect.<id>`, damage rules `rule.<id>`, species `creature.<kind>`, strikes `strike.<kind>.<name>`, cues `cue.<…>`, spawn tables `spawn.<shard>.<name>`, loot tables `loot.<shard>.<name>` |
| Save ids | Today's `WeaponId` strings (`Weapons.ts:37`) and `OwnedId`s are save data. Saves reset once (decision 13, 01 §9), so new ids are free; the migration table in [02-foundations.md](02-foundations.md) F10 lists none for weapons |
| Randomness | Every `Math.random()` in a weapon, a brain or a damage roll moves to `app.rng.stream('gameplay')` (damage, spread, pickups) or `stream('ai')` (brain picks, timers). The list is in §3.5 |
| Where code goes | Mechanism → `src/engine/combat/`, `src/engine/ai/`. Families, shared species, starter effects → `src/kit/`. One-shard content → `src/shards/<slug>/` (01 §0, §21) |
| Behaviour vs tuning | A subclass for behaviour, a typed row with `parent` for tuning (decision 67). Every number in a row below is today's value; a row field with no value listed keeps the family default, which is also listed |

## 1. Weapons and tools

### 1.1 Inventory (every weapon and tool today)

| # | New id | HUD name today | Shard(s) | File, class line | Lines | Family | Rung | Built where today |
|---|---|---|---|---|---|---|---|---|
| W1 | `weapon.sword` | Wooden sword | Driftwood | `src/player/Sword.ts:427` + `SwordMoves.ts` + castaway arms `src/chunks/driftwood-isle/fpArms.ts` | 1,061 + 113 | Melee | 1 profile | `main.ts:533` (`chunk.weapon === 'sword'`), name `main.ts:549` |
| W2 | `weapon.sword-iron` | Iron sword | Driftwood (found on the wreck) | same class, `{ blade: 'iron' }`; pickup `src/player/IronSword.ts` (`IronSwordPickup`, `ironSwordSite`) | 318 (pickup) | Melee | 1 profile (parent W1) | `main.ts:548`, unlock `main.ts:735–740` |
| W3 | `weapon.jian` | Neon Jian | Nine Dragon | same class + `ShardSword.arms` from `src/chunks/nine-dragon-stack/vm/arms.ts:30` (fallback `world/jian.ts`) | vm/ 2,606 | Melee | 1 profile (parent W1) | `main.ts:533` with `def.sword` (`nine-dragon-stack/def.ts:105`), `portraitFov` 78 (`def.ts:103`), name `bag.ts:14` |
| W4 | `weapon.sabre` | Sabre | Nalati | `src/player/Sabre.ts:202` (`extends Sword`) | 258 | Melee | 2 extend | `nalatiKit.ts:42` |
| W5 | `weapon.naizagai` | Naizagai | Nalati (Storm Titan reward) | `src/player/Naizagai.ts:121` (an upgrade object applied to the sabre, `apply()` :150) | 264 | Melee | 2 extend (`extends Sabre`) | `stormTitan.ts` reward → `nz.apply(kit.sabre)`; name `nalati/bag.ts:56` |
| W6 | `weapon.spear` | Spear | Nalati | `src/player/Spear.ts:203` (own class) | 758 | Melee (+ owns W7) | 2 extend | `nalatiKit.ts:43` |
| W7 | `weapon.javelin` | (the spear's THROW) | Nalati | inside `Spear.ts` (flight :433–520) | — | Thrown | 1 profile, composed by W6 | — |
| W8 | `weapon.bow` | Bow | Nalati | `src/player/Bow.ts:577` + `bowDraw.ts` + `Projectiles.ts` | 981 + 100 + 453 | Bow | 1 profile | `nalatiKit.ts:44` |
| W9 | `weapon.golden-bow` | Golden Bow | Nalati (Golden King reward) | `src/player/GoldenBow.ts:47` (an upgrade object applied to the bow) | 233 | Bow | 2 extend (`extends Bow`) | `kurganBoss.ts:672` grant → `golden.apply(play.bow)`; name `nalati/bag.ts:55` |
| W10 | `weapon.longbow` | Warden's longbow | Pine (Antler King reward) | `src/player/Longbow.ts:454` (a fork of Bow) | 792 | Bow | 1 profile (parent W8's family default) | `main.ts:544`, extra slot id `'bow'` `main.ts:549` |
| W11 | `weapon.crossbow` | Hunting crossbow | Pine (default) | `src/player/Crossbow.ts:768` | 1,307 | Crossbow | 1 profile | `main.ts:534` |
| W12 | `weapon.rifle` | AR-15 | Nalati (locked; practice loan) | `src/player/Rifle.ts:221` | 613 | Firearm | 1 profile | `main.ts:541` |
| W13 | `weapon.lever` | Lever-action | Pine (cabin pickup) | `src/player/LeverRifle.ts:268` | 929 | Firearm | 2 extend (`extends Firearm`) | `main.ts:540` |
| T1 | `tool.fei-zhua` | Fei Zhua | Nine Dragon | `src/chunks/nine-dragon-stack/grapple/Traversal.ts:252` (`installFeiZhua`) + `line.ts`, `fx.ts`, `course.ts` | 589 + 469 | — (Tool) | 3 custom | `def.ts` `traversal` hook → `main.ts:560` `chunk.traversal?.(…)`; Bag card `bag.ts:17` |
| T2 | `tool.hoverboard` | (HOVER disc, `H`) | every shard | `src/player/Hoverboard.ts` (viewmodel) + `Player.hover` (motor mode) | 137 | — (Tool) | 3 custom (kit) | `Player` constructs it | 

Not weapons or tools: lock-on (`LockOnSystem`, `main.ts:550`) is an engine ability every weapon opts into with
`lockOn: true` (§1.6). Riding (`Mount.ts`, `Reins.ts`, `Taming.ts`) stays a Nalati mechanism (plan §2.4, S3.3); its
weapon effects are profile data (`mounted`). The dodge and the lunge are player-motor moves (`Player.ts:297`), not
equipment.

### 1.2 The contracts (engine, `#engine/combat`)

Built on 01 §18. The members this spec needs, all public:

```ts
export abstract class Equipment {
  abstract readonly id: WeaponId | ToolId;
  readonly row: EquipmentRow;                 // the typed profile row (below); name, icon, bag entry come from it
  protected readonly blocks: BlockSet;        // what install() created (01 §18 blocks)
  holster: number;                            // 0 held … 1 out of frame (the swap / stow blend; Weapons.ts:29–34)
  enabled: boolean;                           // input gate (menu, pause, stow, swap)
  install(ctx: EquipContext): void;           // creates blocks, binds actions (01 §10), registers cues + HUD
  abstract update(dt: number, t: number): void;
  dispose(): void;                            // through ctx.scope
}
export abstract class Weapon extends Equipment {
  readonly slot = 'main';
  abstract tryFire(): void;                   // the `attack` action press
  reload?(): void;                            // the `reload` action
  readonly state: WeaponState;                // { ammo?: number; magazine: number; reserve: number; loaded: boolean; reloading: boolean; reloadProgress: number; ads: boolean }
  readonly charge?: number;                   // 0..1 held charge (sword heavy, bow draw): the touch ring
  readonly reach?: number;                    // melee reach from the eye (Combat's MISS judgement)
  readonly aimInfo: AimInfo | null;           // range readout target
  aimRay(o: Vector3, d: Vector3): Vector3;    // default: the camera's forward
  adsHeld: boolean; altHeld: boolean;         // the touch latches (AIM / THROW, BRACE / DRAW)
}
export abstract class Tool extends Equipment {
  readonly slot: 'tool' | 'offhand';
  readonly actions: readonly Action[];        // actions it binds in its own input context (01 §10)
}
export interface EquipmentService {           // replaces Weapons.ts (the kit manager)
  add(w: Weapon | Tool, opts: { locked: boolean; order?: number }): void;
  replace(id: WeaponId, next: Weapon): void;  // keeps ammo + held state: the Golden Bow / Naizagai upgrades (§1.5)
  unlock(id: WeaponId | ToolId): void; has(id: WeaponId | ToolId): boolean;
  select(id: WeaponId, instant?: boolean): void; step(dir: 1 | -1): void;
  readonly current: Weapon; readonly available: readonly Weapon[]; readonly tools: readonly Tool[];
  stowed: boolean; lendAll(): void; endLoan(): void;
}
```

`EquipmentService` keeps `Weapons.ts`'s rules exactly: `SWAP_TIME` 0.25 s each way, `STOW_TIME` 0.25 s, keys `1`–`9`
over the owned list in kit order, `Q` = next, wheel step 60 px with a 180 ms gap, input off during a swap, the practice
loan (`lendAll` / `endLoan`, `Weapons.ts:249–264`). Its DOM listeners (`Weapons.ts:178–197`) become the `swap`,
`swap.next`, `swap.prev`, `swap.slot.1`…`swap.slot.9` actions (01 §10). `BaseWeapon` and its `instanceof Crossbow`
guess (`Weapons.ts:101–142`) are deleted: every weapon is a `Weapon`.

### 1.3 Family API (kit, `#kit/weapons/`)

Each family is a `Weapon` subclass on the public blocks. "Overridable" = `protected` methods a rung-2 subclass may
override; everything else is `private`.

| Family | Class | Profile type | Blocks it uses (01 §18) | Overridable methods |
|---|---|---|---|---|
| Melee | `Melee extends Weapon` | `MeleeProfile` | `viewmodel`, `melee`, `hitStop`, `aimRay` | `onSwingStart(move)`, `onMoveHit(move, hit, killed)`, `pickMove(input): Move \| null`, `moveDamage(move): number`, `poseExtra(pos, q, dt)` |
| Bow | `Bow extends Weapon` | `BowProfile` | `viewmodel`, `projectile`, `ads`, `ammo`, `hitStop`, `aimRay` | `onLoose(power, origin, vel)`, `onArrowHit(req)`, `setMount(m)`, `limbPose(draw)` |
| Crossbow | `Crossbow extends Weapon` | `CrossbowProfile` | `viewmodel`, `projectile`, `ads`, `ammo`, `hitStop`, `aimRay` | `onShot(bolt)`, `onBoltHit(req)`, `nextAmmo(): AmmoRow` |
| Firearm | `Firearm extends Weapon` | `FirearmProfile` | `viewmodel`, `ads`, `ammo`, `brass`, `hitStop`, `aimRay` + hitscan (`castRay` via `#engine` query) | `cycle(dt)`, `reloadStep(dt)`, `animateAction(t, pose)`, `onShot()`; the trigger hooks (R2-09, W13): `actionReady()` (default `cooldown <= 0`, `Rifle.ts:322`), `roundReady()` (default `ammo > 0`, `:323`), `onEmptyTrigger()` (default: `reload()` when `reserve > 0`, `:323`), `onTriggerWhileReloading()` (default: nothing, `:322` returns), `reload()`, `autoReloadDue(): boolean` (default `Rifle.ts:496`'s condition) |
| Thrown | `Thrown` (a block-built helper, not a `Weapon`: a weapon composes it) | `ThrownProfile` | `projectile`, `ammo` | `onRelease(power)`, `onStick(point)` |

`ViewmodelFeel` (the `viewmodel` block's data, one per profile — today's numbers differ per weapon, so each profile
carries its own; nothing converges, decision 12′):

```ts
interface ViewmodelFeel {
  lag: { gain: number; clampYaw: number; clampPitch: number; k: number; c: number; posYaw: number; posPitch: number };
  bob: { x: number; y: number; rz?: number; rx?: number };
  sway: { ax: number; fx: number; ay: number; fy: number };
  fovHip: number; portraitFov?: number;       // Hor+ via fovForAspect (Crossbow.ts:129) — one function, three copies today
  dodgeKick?: { kick: number; k: number; c: number };   // Sword.ts:170 (E63); absent = none
  sprint?: { blendRate: number };
}
```

### 1.4 Profiles (every tuning number and asset, today's values)

Each block below is the row that the family consumes. "src" gives where the value lives today; the parity tests in
§1.8 assert each one.

#### Melee family defaults = W1 `SWORD_WOOD` (kit, `#kit/weapons/melee/sword.ts`)

| Field | Value | src |
|---|---|---|
| damage | 12 (wood), light combo ×1 / ×1 / ×16⁄12, heavy ×2 | `Sword.ts:148`, `SwordMoves.ts:73,85,97,109` |
| reach | 2.2 m from the eye | `Sword.ts:149` |
| cooldown / comboGap / chainLag | 0.08 s / 0.6 s / 0.02 s | `Sword.ts:150–152` |
| heavy | charge 0.45 s, charge blend 0.16 s; RMB toggles, touch hold 250 ms / < 12 px (`TouchControls.ts:97–98`) | `Sword.ts:153–154` |
| lunge | range 4 m (heavy 5 m) feet→body edge, cone ±25°, stop 1.1 m short, 22 m/s clamped 0.08–0.15 s | `Sword.ts:155–160` |
| sweep | 5 rays grip→tip, extensions [0.12, 0.24, 0.36, 0.48] rad below, sub-step 0.09 rad, ≤ 6 sub-samples, ≤ 8 animals per swing; hit test `bladeBlocked` (occlusion) | `Sword.ts:163–167, 819` |
| moves | `SLASH` windup .07 / slashEnd .235 / total .35, stagger 0, sweep +1, hitStop .06, kick (−.6, 1.6), trail from .62 α .6 inner 0 life .13 · `BACKHAND` .06 / .22 / .34, stagger 0, sweep −1, hitStop .06, kick (−.6, −1.6), trail from .58 α .6 inner .05 · `FINISHER` .10 / .28 / .44, stagger .25, sweep .5, hitStop .09, kick (−1.8, 1.1), trail from .5 α .7 inner .1 life .15 · `HEAVY` .06 / .30 / .62, stagger 1, sweep .35, hitStop .14, kick (−2.6, .8, fov −2), trail from .34 α 1 inner .35 life .22. Keyframes `REST`, `CHARGE`, `SPRINT` and every move's 3 keys verbatim | `SwordMoves.ts:58–111` |
| swingScale | 1 (a move's time ÷ this; hit-stop and trail life × this) | `Sword.ts:449, 766, 877, 934` |
| hit feel | first contact: hit-stop = move.hitStop × swingScale, jolt 1 (heavy 1.6), kick × 0.5, stars 9 (heavy 14), white flash 0.8 (heavy 1), push 0.8 fwd + 0.5 × sweep; clang: hit-stop 0.045 × swingScale, jolt 0.8, kick × (0.3, −0.4) | `Sword.ts:846, 870–890` |
| impacts | sand burst 10 (× 1.6 heavy); iron only: sparks on `crab` / `sailor` | `Sword.ts:884–885` |
| feel | lag gain .5, clamp .12 / .10, k 220, c 20, pos .25 / .2 · bob .018 / .014 · sway .003 @ .7 Hz, .0025 @ 1.1 Hz · dodgeKick 2.2, k 160, c 14 · armFollow .45 · fovHip 72, portraitPullX .32, framing { shrink .33, dx −.03, dy −.055, tilt .36, yaw −.02 } | `Sword.ts:170–172, 446, 965–1000` |
| trail | 20 samples, Catmull-Rom 3 sub | `Sword.ts:161–162` |
| viewmodel | Driftwood: the castaway's skinned arms (`driftwood-isle/fpArms.ts`, `engineTrail: true`); fallback the code-built wooden sword + white gloves (`Sword.ts:187–330`) | `driftwood-isle.ts:102–107` |
| lockOn | true (`LOCK_WEAPONS`, `LockOnTarget.ts:57`) | |
| cues | `cue.swing` (speed 0.7 / finisher .85 / heavy 1, dir), `cue.swing.heavy`, `cue.hit.<surface>` (strength .5 / .75 / 1), `cue.clang.<stone\|wood>` — today `swordEvents.onSwing/onStrike/onClang` (`Sword.ts:87–92`) and `onHeavy` (`main.ts:691`) | |
| HUD / touch | name "Wooden sword" (`main.ts:549`), icon `sword` (`WeaponStrip.ts:32`), no ammo (strip hidden), touch layout `melee` (ATTACK + hold-heavy, no AIM: `TouchControls.ts:99`) | |

**W2 `SWORD_IRON`** (kit; parent `SWORD_WOOD`): damage 28 (`Sword.ts:148`), iron blade geometry + sparks on crab /
sailor, arms `ironArms` (Driftwood rig), name "Iron sword", pickup `IronSwordPickup` at `ironSwordSite(wreck)`.

**W3 `JIAN`** (Nine Dragon, `src/shards/nine-dragon-stack/weapons/jian.ts`; parent `SWORD_WOOD`): **damage 12 as a
real field** (decision 19; today it inherits `DAMAGE_WOOD` because `ShardSword` has no damage field,
`ChunkDef.ts:45–46`), `feel.portraitFov` 78, viewmodel = `jianArms()` (skinned rig, `vm/arms.ts:30`, own trail,
`CLIP` map `vm/arms.ts:18–20`), fallback `world/jian.ts` `jianSword()`, name "Neon Jian", assets `ARMS_FILES`
(`vm/arms.ts:25–27`). No iron sword on Nine Dragon (`main.ts:547–548`).

**W4 `SABRE`** (Nalati; `class Sabre extends Melee`):

| Field | Value | src |
|---|---|---|
| damage | 24 (combo 24 / 24 / 32, heavy 48) | `Sabre.ts:26` |
| swingScale | 0.9 (every move 10 % quicker; so hit-stops are 40.5 / 40.5 / 54 / 72 ms effective) | `Sabre.ts:27, 208` |
| moves | `S_SLASH` .07 / .24 / .35 hitStop .045 · `S_BACKHAND` .06 / .22 / .34 hitStop .045 · `S_FINISHER` .10 / .28 / .44 hitStop .06 · `S_HEAVY` .06 / .30 / .62 hitStop .08; stagger / sweep / kick / damage mults as the sword's; ice trails; `SABRE_REST/CHARGE/SPRINT` keys | `Sabre.ts:133–170` |
| mounted (override) | a tap = one pass slash `PASS_LEFT` / `PASS_RIGHT` (windup .09, slashEnd .3, total .5, stagger 1, sweep ∓1, hitStop .05, kick (−.5, ∓1.2), reach 2.8), side = nearest live target ≤ 6 m not > 2 m behind, else the look side; cooldown 0.7 s; no lunge; damage = round(24 × (1 + max(0, v) / 12) × chain), chain +0.1 per hit within 3 s, max ×1.4 | `Sabre.ts:28–33, 172–191, 213–257` |
| rig | `buildSabre` blade 0.62 m, curve 0.12 m, steel + gold materials | `Sabre.ts:35–36` |
| feel | as the sword; portraitPullX 0.85 | `Sabre.ts:207` |
| HUD / touch | name "Sabre", icon sabre (`WeaponStrip.ts:24–30`), touch `melee`, "2 HIT" chip from `passChain` / `passChainLeft` | |

**W5 `NAIZAGAI`** (Nalati; `class Naizagai extends Sabre`, parent row `SABRE`): overrides `onSwingStart`: mounted
at ≥ 11 m/s → a lightning crescent 15 m forward (flight 0.32 s, 40 damage to the first creature, then arcs to one
more within 6 m); on foot, a full heavy → a call-down within 25 m (`castRay`), 0.6 s gold ring, 60 damage in 3 m;
in a steppe storm damage × 1.25 and 2 arcs (`Naizagai.ts:36–37, 150–260`). Look: the steel recoloured
`STORM_BLUE` (0.62, 0.78, 1.0), emissive `STORM_GLOW`. Name "Naizagai". `LightningStrip` (`Naizagai.ts:44`) moves to
Nalati's shard folder (the Titan shares it).

**W6 `SPEAR`** (Nalati; `class Spear extends Melee`; composes W7):

| Field | Value | src |
|---|---|---|
| thrust | damage 30, stagger .5, wind .12, active end .22, total .35, reach 3.2, fan yaws [0, ±.05, ±.1] × pitches [0, −.15, −.3, −.5, −.7], first hit only, **no lunge**, **no hit-stop** (jolt 1 only) | `Spear.ts:56–59, 561–579` |
| brace (override) | set .25 s (touch BRACE = `altHeld`, or RMB held ≥ .25 s), max 4 s, cooldown 1 s, rehit 1.2 s per animal, cone ±30°, closing ≥ 4 m/s, reach 3.2 − 0.6 from the feet, damage round(60 + 8 v), stagger 1, jolt 1.4, `player.moveScale` 0 while set | `Spear.ts:60–61, 523–557, 609–621` |
| couched lance (override) | mounted ≥ 8 m/s, reach 2.5, cone ±15° of the horse's heading, damage round(40 + 6 v), rehit 1.2 s | `Spear.ts:62, 536–552, 647` |
| alt = javelins (W7) | touch THROW on the AIM spot (`adsHeld` held), desktop RMB tap < .25 s; `ammoLabel` "Javelins", segments = magazine = `maxJavelins` 3 | `Spear.ts:206, 219–220, 280–281, 301` |
| feel | lag gain .4, clamp .10 / .08, k 200, c 20 · bob .016 / .013 (+ roll terms `Spear.ts:710`) · no dodge kick · fovHip 72 · left hand 0.3 m up the shaft | `Spear.ts:65, 667–672, 709–710` |
| HUD / touch | name "Spear", layout `spear` (THROW on AIM, BRACE on JUMP: `TouchControls.ts:100–101`), lockOn true | |

**W7 `JAVELIN`** (Nalati; Thrown profile): speed 28 m/s + the mount's velocity, gravity 9.8, radius 0.03, head leads
0.8 m, windup 0.4 s (throw at .14, recover .45), damage round(55 × (head 2) × `damageMultiplier`), stagger 1, pool 5,
pickup radius 1.6 m (|dy| < 2.2), survive 0.9, sticks by material (`sticksIn`), river = lost, arc preview 32 points
after .12 s, carried 3 (`Spear.ts:37` promises 5 "with the camp upgrade"; no code sets it: `grep maxJavelins` has no
writer) (`Spear.ts:63–67, 433–520`).

#### Bow family defaults = W8 `BOW` (kit, `#kit/weapons/bow/bow.ts`)

| Field | Value | src |
|---|---|---|
| quiver | 24, `ammoLabel` "Arrows", segments 4, magazine 24 | `Bow.ts:81`, header :10–12 |
| draw | `BowDraw`: full 0.75 s (ease-out) ÷ `drawSpeedScale`, let-down .4 s, re-nock .62 s (next draw may start with .4 left), steady 3 s, tremble to ±1.5° by 8 s, tired 1.1 s; loose only at full draw | `bowDraw.ts:21–27` |
| flight | speed 30 + 28 p m/s, `damageScale` 1.2 × `damageFor` (§2.2's arrow formula) × `damageMultiplier(hit)` | `Bow.ts:84–85, 740` |
| arrow (projectile row) | length 0.8, gravity 5, drag .015 (`v *= 1 − drag·h·\|v\|·0.1`), windCoupling .25, bury .09, recover .7, maxFlying 8, maxStuck 64, radius .02, glance lift .03 / keep .35 / bounce .25 / max 9, recover reach 1.25 m / up 2.1 m | `Bow.ts:130, 174–178`; `Projectiles.ts:99–103, 173–184` |
| aim | zoom 2 (72° → 40°), vm zoom .85, sway × .5, spread × .5, aim-in rate 10; sway max 1.5° | `Bow.ts:82, 90` |
| spread | 0.3° × (1 − .5 × aim) + 0.6° × speedFactor + extraSpreadDeg + mountSpread | `Bow.ts:734` |
| Hunter's eye | arc from draw .25, 56 points, spacing .8, skip .5, blend 11, colour `0x8fe3ff`; setting `huntersEye` | `Bow.ts:80, 91` |
| mounted (data) | draw 0.9 s (scale .75 / .9), gait spread (< .3 m/s .3°, < 3.2 .8°, < 6.5 3.0°, < 10.5 1.5°, else 1.8°), Parthian (> 110° off heading): +.2 s draw, +.5° spread; carrier velocity added; no arc | `Bow.ts:775–785` |
| wind | the world's `WindField` (Nalati's `Wind.ts`) | `nalatiKit.ts:22` |
| feel | lag gain .5, clamp .12 / .10, k 200, c 20, pos .3 / .25 (× (1 − .6 r)(1 − .7 aim)) · bob .02 / .018, cant .03 | `Bow.ts:910–924` |
| hit feel | **none** (Nalati has no hit-stop on ranged hits today) | `feel.ts` is Pine only |
| look | painterly recurve, one painterly material, 5 draws, `setStyle('recurve' \| 'golden')` | `Bow.ts:68–76, 789–790` |
| HUD / touch | name "Bow", layout `bow` (FIRE held = draw ring, AIM = zoom toggle: `TouchControls.ts:209–218`), lockOn false | |
| cues | `cue.bow.draw` (`onDrawStart`), `cue.bow.letdown`, `cue.bow.loose` (power), `cue.arrow.impact.<surface>`, `cue.arrow.recover` (survived) | `nalati/sound.ts:105–120` |

**W9 `GOLDEN_BOW`** (Nalati; `class GoldenBow extends Bow`, parent row `BOW`): `drawSpeedScale` × 1.2 (0.625 s),
`onLoose` override: at draw ≥ 0.95 a **sun arrow** — the predicted path (`Projectiles.predict`) becomes a gold
streak (48 points, fades 1.1 s), and the second creature on that path takes round(its `damageFor` × 1.2) when the
arrow would reach it (distance ÷ (30 + 28 p)), × 3 on a balbal; the arrow's own hit on a balbal × 2 (golden) or × 3
(sun) (`GoldenBow.ts:42–44, 82–166`). Look: `setStyle('golden')` (gold limbs, light string `STRING_LIGHT`).

**W10 `LONGBOW`** (Pine; profile only, parent `BOW`; overrides only):

| Field | Longbow | Bow (parent) | src |
|---|---|---|---|
| quiver | 20 | 24 | `Longbow.ts:39` |
| sway max | 1.4° | 1.5° | `:41` |
| speed | 32 + 30 p | 30 + 28 p | `:42` |
| damageScale | 1.35 | 1.2 | `:43` |
| aim zoom | 1.6 | 2 | `:44` |
| arc colour | amber `0xffc070` | cyan | `:45` |
| arrow | length .76, gravity 6, drag .014, maxStuck 48 | .8 / 5 / .015 / 64 | `:99, 145` |
| wind | `pineWind` (speed 1.2 + 7 × `windGustAt`, along `WIND_DIR`) | world wind | `:57–59` |
| mounted | none (Pine has no riding) | data | — |
| spread | .3 × (1 − .5 aim) + .6 × speedFactor | + extra + mount | `:596` |
| hit feel | Pine bolt: hit-stop 35 / 55 (head) / 75 (kill) ms, kick .35 / .6 / .9 (roll ± rng × .3 / .6), trauma .28 on a kill of `bear` / `elk` / `antler-king`, .15 on a King headshot | none | `feel.ts:40–48`, `combatMath.ts:94` |
| look | PBR yew, `POSE` table, VM scale .72 | painterly | `:415–433` |
| HUD | name "Warden's longbow", icon `longbow`, touch `bow` (today id `'bow'`, so the `bow` class applies) | | `main.ts:549, 623` |
| cues | `cue.bow.draw` → Pine `longbowDraw` .8; `cue.bow.loose` → `longbowLoose`; recover toast "Arrow recovered / Arrow broke" | | `loadout.ts:173, 190–191` |

#### W11 `CROSSBOW` (Pine; Crossbow family defaults = this row)

| Field | Value | src |
|---|---|---|
| ammo | 30 carried (`MAX_BOLTS`), 1 loaded, `ammoLabel` "Bolts" (Bag: "Iron bolts"), segments 4 | `Crossbow.ts:97`, `Weapons.ts:110`, `main.ts:623` |
| cycle | fire cooldown .3 s, reload 1.35 s, auto-reload after 1.4 s | `:101–103` |
| bolt (projectile row) | speed 62, gravity 9.8, drag .012, radius .03, bury .08, maxFlying 8, maxStuck 200, glance keep .2 / bounce .25 / max 9 / lift .01; tracers 8 × life 6 s, fade 1.5, width 8 px, `TRACER_RED` | `:98–124` |
| damage | `damageFor(headshot, dist from camera)` × `mod.damage(kind)` | `:1231` |
| ADS | FOV 72 → 58 (1.3×), blend .18, motion .3, eye .056 above the rail, near margin .03, solved pose (tip / nut NDC), rear peep 2.1 cm | `:126, 139–146` |
| spread | 0.15° + (1 − ads) × 0.6° | `:986` |
| kick | 0.8° pitch | `:133` |
| ammo kinds (`AmmoRow`, §2.3) | iron (plain), pitch (gravity × .8, drag × .7, rain-proof), broadhead (gravity × 1.08, drag × 1.1, × 1.4 on `deer` / `boar`); rain: gravity × (1 + .2 r), drag × (1 + .9 r) except pitch; pouch max 30 each; selector key `B` and a tap on the bolts strip | `pinehollow/ammo.ts:19–46`, `loadout.ts:158–166` |
| feel | lag gain .5, clamp .12 / .10, k 220, c 20, pos .25 / .2 · bob .016 / .012, rz .02, rx .01 | `:1088–1111` |
| hit feel | Pine bolt (as the longbow) | `feel.ts` |
| finishes | cosmetic effects (§2.2 E12) | `Skins.ts:46` |
| HUD / touch | name "Hunting crossbow" (+ " · <finish>"), icon `crossbow`, touch `ranged` (FIRE tap, AIM latch), lockOn false | `main.ts:623` |

#### W12 `AR15` (Nalati; Firearm family defaults = this row)

| Field | Value | src |
|---|---|---|
| action | semi, interval .09 s | `Rifle.ts:54` |
| magazine / reserve | 30 / 90, `ammoLabel` "Rounds", segments 6 (HUD comment `HUD.ts:366`) | `:53` |
| reload | magazine, 1.6 s; auto after .35 s | `:55–56` |
| damage | `damageFor` × .55, hitscan 300 m (`worldHit` bounds it), range readout ≤ 120 m | `:57–58, 366–373, 588` |
| kick / spread | .35°; ADS .12°, hip 1.1°, bloom +.35°/shot max 1.6° | `:59–60` |
| flash / brass / tracers | 2 frames, light .05 s × 30 · 3 × 1.4 s · 3 × .09 s width 3 | `:61–63` |
| ADS | FOV 58 (borrows Crossbow's), blend .16, motion .3, near .03; sights y .064, rear .10, front −.455, muzzle −.645 | `:64–67, 527` |
| feel | lag gain .5, clamp .12 / .10, k 220, c 20 · bob .014 / .011, rz .018, rx .009 | `:538–559` |
| hit feel | none (Nalati) | |
| muzzle light | `!isOcean` (always on now that no ocean shard carries it) | `main.ts:541` |
| HUD | name "AR-15", icon `rifle` | `main.ts:623, 770` |

**W13 action states (R1-37, rewritten from the code, R2-09).** The lever's trigger, reload and cycle map onto
Firearm's hooks (§1.3). Every line below is today's code, quoted; the port keeps each one exactly, and nothing private
is left out.

Firearm's trigger is one template, `trigger()`: `if (reloading) { onTriggerWhileReloading(); return; }`, then
`if (!actionReady()) return;`, then `if (!roundReady()) { onDry; sinceEmpty = 0; onEmptyTrigger(); return; }`, then
`fire()`. With the defaults it is the AR-15's `tryFire` (`Rifle.ts:321–325`), unchanged. The lever's overrides:

| `LeverRifle.ts` today (quoted) | What it does | The Firearm hook |
|---|---|---|
| `:488` `if (this.phase === 'reload') { if (this.fed > 0 \|\| this.tube > 0 \|\| this.chambered) this.stopAfter = true; return; }` | A trigger mid-reload **fires nothing and cycles nothing**. It only asks the reload to stop after the round in hand, and only when a round is fed, in the tube or chambered | `onTriggerWhileReloading()` |
| `:489` `if (this.phase !== 'idle') return;` | A trigger during the recoil beat or the lever throw does nothing | `actionReady()` = `phase === 'idle'` |
| `:490–491` `if (!this.chambered) { this.onDry?.(); this.sinceEmpty = 0;` | An empty chamber is a dry click, and it restarts the auto-reload clock (the base's part of the template) | `roundReady()` = `chambered` |
| `:492` `if (this.tube > 0) this.startCycle(); else if (this.state.reserve > 0) this.reload();` | On the dry click it works the lever if the tube has a round, else it starts a reload if the reserve has one | `onEmptyTrigger()` |
| `:495` `this.fire();` | Fire the chambered round (`:510–519`: unchamber, case in the chamber, hammer down, `phase = 'beat'`, flash, `onFire`, hitscan) | `fire()` (the family's), then `onShot()` |
| `:499` `if (this.phase !== 'idle' \|\| this.tube >= TUBE_MAX \|\| this.state.reserve <= 0) return;` | R and the auto-reload start a reload only when idle, the tube not full (6) and a round in reserve | `reload()` |
| `:500–501` `this.phase = 'reload'; … this.fed = 0; this.stopAfter = false; this.dryAtStart = !this.chambered; this.planned = Math.min(TUBE_MAX - this.tube, this.state.reserve);` | A reload plans the rounds to fill the tube from the reserve, and records whether it began with an empty chamber | `reload()` |
| `:749` `if (this.phase === 'beat' && this.phaseT >= CYCLE_DELAY) this.startCycle();` | 0.12 s after the shot the lever starts down | `cycle(dt)` |
| `:751–757` `const u = this.phaseT / LEVER_TIME;` … `if (u >= 1) { const next = cycleAction(this.action); … this.phase = 'idle'; }` | The throw takes 0.56 s: the case ejects at u ≥ .34, the hammer cocks at u ≥ .2, and at u ≥ 1 `cycleAction` chambers a round from the tube if the chamber is empty and the tube is not | `cycle(dt)` |
| `:762–767` `const done = Math.max(0, Math.floor(inT / ROUND_TIME)); while (this.fed < Math.min(done, this.planned)) { … feedRound … this.fed++; … if (this.stopAfter \|\| this.tube >= TUBE_MAX \|\| s.reserve <= 0) { this.planned = this.fed; break; } }` | One round per 0.4 s after the 0.22 s roll-in moves from reserve to tube (`onRoundIn`). After each round the reload stops early on `stopAfter`, a full tube or an empty reserve | `reloadStep(dt)` |
| `:770–773` `if (this.fed >= this.planned && inT >= ROUND_TIME * this.planned) { this.phase = 'idle'; … this.onReloadEnd?.();` | The reload ends when the planned rounds are in | `reloadStep(dt)` |
| `:774` `if (this.dryAtStart && !this.chambered && this.tube > 0) this.startCycle();` | A reload that began with an empty chamber ends with a lever throw that chambers one | `reloadStep(dt)` |
| `:778` `else if (this.phase === 'idle' && !this.chambered && this.tube === 0 && s.reserve > 0 && this.sinceEmpty > AUTO_RELOAD_DELAY && this.sinceEmpty < 5 && this.active && this.enabled) { this.reload(); }` | Auto-reload: idle, chamber and tube empty, a round in reserve, **0.35–5 s after the last dry trigger** (`sinceEmpty` is reset only at `:491`; it starts at 99, `:308`), and only while the lever is drawn and enabled | `autoReloadDue()` |
| `:651–652` `this.sinceEmpty += dt; this.stepAction(dt);` and `main.ts:1152` `weapons.update(dt, t); // every weapon ticks` | The action clock runs every frame, drawn or stowed | the family's `update` runs for every owned weapon |
| `:747` `if (this.freezeCycle !== null) return;` (the field `:304–305` `freezeCycle: number \| null = null`; read by `:484` `cycleU` and `:655–658` the lever / hammer pose) | The dev evidence strip's freeze (`__weapons.get('rifle').freezeCycle = 0.45`): while set, the action clock stops (no beat, throw or reload progress) and the parts hold at that u; `null` = live | **kept as a debug handle** (R3-N): set through the lever's `ctx.debug.expose` handle (06 §1, today's `__lever`); `cycle(dt)` / `reloadStep(dt)` return first while it is set, and `animateAction` reads it. No gameplay path sets it |
| `:468–471` `setActive(on) { … if (!on) { this.enabled = false; this.mouseAds = false; } }` | Stow or swap **does not cancel** a reload or a throw in progress: the clock keeps running, so it completes while stowed (rounds fed, `onReloadEnd`, the dry-start throw). Stowing only stops a new auto-reload from starting (`active && enabled`) | `setActive` (the base's) |
| `:477–479` `s.ammo = this.tube + (this.chambered ? 1 : 0); s.loaded = this.chambered; s.reloading = this.phase === 'reload';` | The HUD state: rounds in the gun, the chamber shown apart, reloading | the `ammo` block's state |

`lever-actions.test.ts` records today's action traces **before** the move: full, partial and dry reloads; a trigger
mid-reload with a round fed (the reload stops after it and nothing fires) and with none (nothing changes); reserve
exhaustion; a dry trigger with rounds in the tube (a throw) and with an empty tube (a reload); the auto-reload window
(nothing at 0.3 s, a reload at 0.4 s, nothing after 5 s); swap and stow mid-reload (the reload completes stowed);
the chamber / tube HUD states. Its expected transitions are checked against the table above before the move, and the
Firearm subclass must replay them exactly (12′).

**W13 `LEVER`** (Pine; `class LeverRifle extends Firearm`, parent row `AR15`; overrides: `cycle` (lever throw), `reloadStep`
(per round), `animateAction` (lever / hammer / bolt parts), and the trigger hooks of the W13 action table above):

| Field | Lever | AR-15 (parent) | src |
|---|---|---|---|
| action | lever: shot → .12 s → lever .56 s (open + close) | semi .09 | `LeverRifle.ts:69–70` |
| magazine / reserve | tube 6 + 1 chambered / 21 | 30 / 90 | `:67–68` |
| reload | per round .4 s, roll in .22 / out .2 | magazine 1.6 | `:71–72` |
| damage | × 1.5, hitscan 320, readout 150 | .55 / 300 / 120 | `:74–75, 547–554, 732` |
| kick / spread | 1.25°; ADS .06, hip .9, **no bloom** | .35 / .12 / 1.1 + bloom | `:76–77` |
| flash / brass / tracers | 2 frames .06 s × 34 · 4 × 1.8 s · 2 × .09 | | `:78–80` |
| ADS | blend .17; sights y .045, eye z .36, rear −.13, front −.512, muzzle −.535 | | `:81–91` |
| parts | lever open .92, bolt travel .058, hammer −.12 → .5, pivots `:93–99`, bead r .0055, hand turn .6 | | `:83–102` |
| model | `/assets/pine-hollow/weapons/lever-rifle.glb`, parts steel · forend · stock · lever · hammer · bolt, walnut shared from the crossbow (`woodFrom`) | GLB-less AR | `:139–141`, `main.ts:540` |
| hit feel | Pine bolt | none | `feel.ts` |
| cues | `cue.fire` → `leverShot` + `leverEcho` after `ECHO_DELAY`; dry → `leverDry`; reload = its rounds (`onRoundIn`), not the AR's magazine sound | | `loadout.ts:170–182` |
| HUD | name "Lever-action", icon `lever` | "AR-15" | `main.ts:623, 770` |

### 1.5 Where each weapon lives and how the upgrades work

| Weapon | Row file | Class file | Kit or shard | Reason |
|---|---|---|---|---|
| W1, W2 | `#kit/weapons/melee/sword.ts` | `#kit/weapons/melee/Melee.ts` | kit (row), W2's pickup model in Driftwood | the family default + "shared profiles (the iron sword)" (01 §21) |
| W3 | `src/shards/nine-dragon-stack/weapons/jian.ts` | — | shard | one shard |
| W4, W5, W6, W7, W8, W9, W12 | `src/shards/nalati-grasslands/weapons/*.ts` | `Sabre.ts`, `Naizagai.ts`, `Spear.ts`, `GoldenBow.ts` there | shard | one shard each |
| W10, W11, W13 | `src/shards/pine-hollow/weapons/*.ts` | `LeverRifle.ts` there | shard | one shard each |
| Families | `#kit/weapons/{melee,bow,crossbow,firearm,thrown}/` | | kit | decision 25 |

**Upgrades** (W5, W9). Today `GoldenBow.apply(bow)` and `Naizagai.apply(sabre)` reconfigure the live instance
(`GoldenBow.ts:78`, `Naizagai.ts:150`). The new form: the reward's `grant` calls
`app.equipment.replace('weapon.bow', new GoldenBow(GOLDEN_BOW))` (resp. the sabre). `replace` carries the ammo
(quiver count), the held state and the slot position, so play is identical. On boot, the shard's save (`owned
golden`) builds `GoldenBow` directly. The Bag name comes from the row, which deletes `nalati/bag.ts:55–56`.

**Loadouts (manifest `loadout`, 01 §6):**

| Shard | start (held first) | locked until | order |
|---|---|---|---|
| Driftwood | `weapon.sword` | `weapon.sword-iron` (IronSwordPickup, owned `iron-sword`) | sword, sword-iron |
| Nine Dragon | `weapon.jian`; tool `tool.fei-zhua` | — | jian |
| Nalati | `weapon.bow` (held), `weapon.sabre`, `weapon.spear` all owned (`nalatiKit.ts:49–52`) | `weapon.rifle` (practice loan only); `weapon.golden-bow` / `weapon.naizagai` replace their slot | bow, sabre, spear, rifle |
| Pine | `weapon.crossbow` | `weapon.lever` (cabin pickup / finish drop), `weapon.longbow` (King reward) | crossbow, lever, longbow |
| every shard | tool `tool.hoverboard` | — | — |

### 1.6 Touch and HUD data each weapon declares

`EquipmentRow.ui` replaces every weapon-id set:

```ts
interface WeaponUi {
  name: StringId; icon: IconId;                 // 'sword' | 'sabre' | 'spear' | 'bow' | 'longbow' | 'crossbow' | 'rifle' | 'lever'
  ammo?: { label: StringId; segments: number; bagLabel?: StringId };   // absent = the strip hides
  touch: 'melee' | 'spear' | 'bow' | 'ranged';  // the disc layout while held
  lockOn: boolean;                              // LOCK / Z works while held
  melee: boolean;                               // Settings' melee rows, Combat's MISS reach, the audio family
  tracers: boolean;                             // Settings ▸ tracer rows (Menu.ts:475)
}
```

| File:line today | What it branches on | Becomes |
|---|---|---|
| `src/player/TouchControls.ts:99–101, 198–218` | `MELEE`, `SPEAR` sets, `id === 'bow'` | `current.row.ui.touch` |
| `src/player/LockOnTarget.ts:57, 167` | `LOCK_WEAPONS` | `current.row.ui.lockOn` |
| `src/ui/WeaponStrip.ts:24–34, 49` | `ICONS`, `NAMES` by id | `row.ui.icon`, `row.ui.name` |
| `src/ui/Menu.ts:475, 544` | `has('crossbow') \|\| has('rifle')`; `icon === 'sword'` | `some(w => w.row.ui.tracers)`; `some(w => w.row.ui.melee)` |
| `src/ui/bag.ts:109–112` | `w.icon === 'sword'` = melee | `row.ui.melee` |
| `src/ui/HUD.ts:283, 353` | defaults 'Crossbow' / 'Bolts' / 4 | the held weapon's row always passed; defaults deleted |
| `src/main.ts:623` | icon / name / ammo label by id + `nalatiKitName` + skins | `row.ui` + the worn cosmetic effect's name suffix |
| `src/main.ts:692–706` | `meleeHeld()`, `id === 'rifle'` → sounds | cues from the row (§4.3) mapped by the shard's CueMap |
| `src/nalati/sound.ts:164–178` | `id === 'bow' / 'sabre' / 'spear'` | Nalati's CueMap entries |
| `src/nalati/bag.ts:55–56` | golden / naizagai names | the replaced weapon's row name |
| `src/pinehollow/loadout.ts:158–182` | `id === 'crossbow' / 'rifle' / 'bow'` | the ammo selector is the crossbow row's `ammoSelect` action; sounds via Pine's CueMap |
| `src/nalati/balbalWarriors.ts:188` + `balbal.ts:42, 442` | `sabre` / `spear` model visible | the request's tags (`weapon.spear`) read by the balbal damage rule (§3.3) |

### 1.7 Tools

**T1 `tool.fei-zhua`** (Nine Dragon, `class FeiZhua extends Tool`, slot `offhand`, rung 3 custom):

| Field | Value | src |
|---|---|---|
| input context | `grapple` (01 §10): pushed while a hook is centred in reach; actions `lock` (target a hook) and `jump` (fire / zip) | `Traversal.ts:1–12` |
| touch | relabels, no new disc: LOCK reads "Lock" (rest) / "Grapple" (ready, gold `#ffcf70`, claw icon) / "Locked"; JUMP reads "Zip" / "Armed" / "Fire" (`HINT_*`) | `Traversal.ts:44–53`; today `ShardTraversalContext.touchHint` (`ChunkDef.ts:80`) → `ctx.hud.relabel` (01 §11) |
| reach | 2.5–38 m, in view window ±.52 × ±.68 NDC, line of sight, a landing floor; round robin 2 hooks / frame; landing cache stale after 1.2 s | `Traversal.ts:25–36` |
| motion | fire .27 s, bite .10 s, zip 22 m/s through the player capsule, reel .48 s; body 1.95 m; rim wall `Y0 + 3.2` | `:26–42` |
| markers | ≤ 8 ◇ marks, the "◇ DRAGON HOOK" chip | `:38, 262–278` |
| rig | left-arm channel `playLeft('grapple_aim' \| 'grapple_fire' \| 'grapple_hold' \| 'idle')`, `setClawVisible` on the jian's arms | `Sword.ts:118–120` |
| course | `GrappleCourse` from the fragment or a playground (`setGrappleCourse`) | `course.ts:17–45` |
| Bag | GEAR card: "Fei Zhua" · "Grapple" · "Lock a hook, then jump" · icon `grapple` | `bag.ts:17` |
| cues | `cue.grapple.fire`, `.bite`, `.zip`, `.dock`, `.miss` (muzzle / bite / dock flashes, 24 sparks) | `:288–294` |

**T2 `tool.hoverboard`** (kit, `#kit/tools/hoverboard.ts`, `class Hoverboard extends Tool`, slot `tool`): the board
viewmodel (deck 0.9 × 0.28 m, cyan edge, 0.25 s fade) and the `hover` toggle action (`H`, the HOVER disc). The motor
mode (`Player.hover`, ride height spring, `HOVER_TOP`) stays in the engine player motor as the `board` context
(01 §10). It moves in X1 (13-lead-resolutions 09#7).

Anything else considered and rejected as a Tool: the reins (part of Nalati's `ride` context), the lasso-less taming
(Nalati's `Taming.ts`), the lock-on (engine ability), the swim hands (`Hands.ts`: player motor presentation).

### 1.8 Parity tests to write BEFORE any weapon moves (F5, node, fake `Game`)

| Test | What it asserts | Written in |
|---|---|---|
| `test/combat/trajectory-snapshots.test.ts` | Every projectile row (Bow arrow, Longbow arrow, sun-arrow predict path, Crossbow × iron / pitch / broadhead × rain 0 and 1, javelin, ghost-rider arrow) launched at pitches −10°, 0°, 10°, 25°, 45° × draws 0.25, 0.6, 1 (bows) or full (others), position every 1/60 s for 3 s, no wind, no world, `toMatchSnapshot` with 4-decimal rounding. Needs the flight step extracted as a pure function first (`Projectiles.ts:170–186`, `Crossbow.ts:1190–1200`, `Spear.ts:440–445`: a mechanical extract, its own commit) | before S1.2 |
| `test/combat/melee-moves.test.ts` | The Sword, Sabre (incl. passes), jian and Spear move tables: windup / slashEnd / total / damage mult / stagger / sweep / hitStop / kick / reach / trail, and the effective timings with `swingScale`; the combo rules (gap .6, chain lag .02, cooldown .08); the heavy (.45); lunge numbers | before S1.2 |
| `test/combat/weapon-profiles.test.ts` | Every field of every row in §1.4 equals the value in this spec (one table-driven test; the table is the spec's) | S1.2 (Melee), S2.2 (ranged), S3.3 (Nalati) |
| `test/combat/weapon-contract.test.ts` | Every registered weapon satisfies `Weapon`; no `instanceof` on a weapon class outside `#kit/weapons` (lint count 0); every row's `ui` is complete; ids unique | S1.2 |
| `test/combat/equipment.test.ts` | Swap timings (.25 + .25), stow .25, number keys over owned, `Q`, wheel 60 px / 180 ms, loan / end loan, `replace` keeps the quiver | S1.2 |
| `test/combat/hitscan-damage.test.ts` | AR-15 and lever: damage = `damageFor` × scale with the seeded stream; range cut at 300 / 320; readout 120 / 150 | S2.2 |
| existing | `bow-draw.test.ts`, `lockon.test.ts`, `hit-damage.test.ts`, `pine-combat.test.ts`, `keepsakes.test.ts`, `fight-rules.test.ts` keep passing unchanged (imports updated by the F6 codemod) | always |

The harness's scripted **swing + shot to a kill** (F2) runs on every shard at every step. A weapon moves in its own
commit; its row's parity test and the harness are green before the next weapon moves.

## 2. GAS-lite: attributes, effects, damage rules, tags

### 2.1 Attribute sets (engine types, extended by merging; 01 §18)

| Actor | Attribute | Base today | src |
|---|---|---|---|
| player | `health` / `maxHealth` | 100 / 100 (Driftwood hearts + charm raise max; `setMaxHealth` keeps the gain: `health += max(0, new − old)`) | `main.ts:612, 808` |
| player | `healthRegen` | 4 /s after `regenDelay` 6 s without a hurt | `main.ts:1186–1187` |
| player | `dodgeCooldownMul` | 1 (dodge 3 m / .25 s, cooldown .8 s × this) | `Player.ts:66–82, 212–214` |
| player | `moveLocked` | 0 (1 = `player.carried`, the Pine stun) | `pinehollow/index.ts:69–71, 141` |
| player | `moveSpeedMul` | 1 (the starter `slow` writes it) | new |
| player | `incomingCap` | ∞ (the hit cap writes it) | `ChunkDef.ts:452` |
| weapon | `damage` (per melee weapon) | its row's damage; whetstones multiply the blade rows | `install.ts:111–117` |
| weapon | `heavyDamageMul` | 1 (bear claw) | `Sword.ts:440` |
| weapon | `drawSpeedMul` | 1 (the Golden Bow row sets 1.2; riding multiplies its own share) | `Bow.ts:62` |
| creature | `health` / `maxHealth` | the species / variant `hp` | `Animal.ts:126` |
| creature | `damageTakenMul` | the variant's `mods.damageTaken` (body hits only; head hits in full) | `Animal.ts:336–340` |
| creature | `moveSpeedMul` | the variant's `mods.speed` | species rows |

A weapon is not an `Actor`: it carries its own `AttributeSet` (01 §18), and `EffectService.apply` takes an
`Actor | Equipment` target (13-lead-resolutions 09#3). A whetstone is applied to each owned equipment row tagged
`weapon.blade` (`effects.apply(weapon, 'effect.whetstone.1')`), the bear claw to the melee weapons, and the Golden Bow
row's draw to that bow.

### 2.2 Every effect today, as rows

`EffectDef` is 01 §18's. Rows whose rule depends on the hit (target kind, weapon, time since a shot) are
`DamageRuleDef` rows (below), because an attribute modifier cannot see the request. Effects with no numbers are
cosmetic (they grant a tag the viewmodel reads).

| # | Row | Kind | Modifiers / rule | Granted by (today) | Shard | src |
|---|---|---|---|---|---|---|
| E1 | `effect.sturdy-heart` | permanent, stacking `{ max: 2 }` | `maxHealth` add 20 per stack | Owned `heart-1` (1 stack), `heart-2` (2 stacks) | Driftwood | `shop.ts:68–72` |
| E2 | `effect.charm.1` | permanent | `maxHealth` add 10 | 5 sea glass | Driftwood | `shop.ts:72` |
| E3 | `effect.charm.2` | permanent | `dodgeCooldownMul` mul 0.7 (.8 → .56 s) | 10 sea glass | Driftwood | `perks.ts:19, 23` |
| E4 | `effect.charm.3` | permanent, cosmetic | grants `cosmetic.seaglass-glow`; the sword viewmodel computes `nightGlow` (0 until night .3, full at .75, smoothstep) | 15 sea glass | Driftwood | `perks.ts:30–34`, `keepsakes.ts:219` |
| E5 | `effect.whetstone.1` | permanent | melee rows tagged `weapon.blade` `damage` mul 1.25, rounded once (12 → 15, 28 → 35) | shop | Driftwood | `shop.ts:66`, `install.ts:116–117` |
| E6 | `effect.whetstone.2` | permanent, `blockedBy` none, removes E5 on apply | `damage` mul 1.5 (12 → 18, 28 → 42) | shop | Driftwood | same |
| E7 | `effect.bear-claw` | permanent | `heavyDamageMul` mul 1.2 (wood 24 → 29, iron 56 → 67) | trophy | Driftwood | `perks.ts:21, 25` |
| E8 | `effect.boar-tusk` | permanent | grants `guard.dodge` → rule R2 | trophy | Driftwood | `perks.ts:27`, `main.ts:832` |
| E9 | `effect.hit-cap` | permanent | `incomingCap` override = `level.fight.maxHitDamage` (Driftwood 20) → rule R1 | the shard at load | Driftwood | `driftwood-isle.ts:243–244` |
| E10 | `effect.sneak-shot` | timed 4 s, `refresh` | grants `state.sneak-shot` → the sneak source multiplier (§2.2) | a loose / throw from HIDDEN (`stealth.ts:150–161`) | Nalati | `stealth.ts:61` |
| E11 | `effect.captain-hat`, `effect.cape` | permanent, cosmetic | grant `cosmetic.hat.captain` / `cosmetic.cape` (wardrobe) | trophy / shop | Driftwood | `keepsakes.ts:143` |
| E12 | `effect.finish.<id>` × 7 | permanent, cosmetic, one per weapon kind (`stacking: 'none'`, a new one replaces the worn one of its weapon) | grants `cosmetic.finish.<id>`; the weapon's viewmodel applies the skin (`applySkin`) | hollow-ash, ghost-stag, blackpaw, imperial, warden, ironhide, scarback-furnace | Pine | `finishes.ts:12–20`, `Skins.ts:46–119` |
| E13 | `effect.skin.<id>` × 4 | the same as E12 | irbis-sabre, sky-wolf-bow, storm-wing-arrows (gold streak), night-rider-mount | Nalati elite drops | Nalati | `nalatiSkins.ts:31–40`, `elites.ts:72–100` |
| E14 | `effect.ammo.<kind>` | instant, on the projectile's request | via `AmmoRow` (flight) + the broadhead source multiplier (damage, §2.2) | the selected bolt | Pine | `ammo.ts:34–46` |

**Damage rules** (`DamageRuleDef`, engine type; registered by rows, run as `ask('damage.modify')` answerers in `order`):

```ts
interface DamageRuleDef {                            // 01 §18, as is (13-lead-resolutions 09#2)
  id: string; order: number;                         // lower runs first; answers ask('damage.modify') in `order`
  when: { sourceTags?: readonly Tag[]; targetTags?: readonly Tag[]; weaponTags?: readonly Tag[]; targetState?: readonly Tag[] };
  op: 'cap' | 'add' | 'mul' | 'negate' | 'override'; value: number;
}
```

How the table maps onto 01's row: "req" = the hit's own tags and "source" = the source actor's tags, both in the
request's `sourceTags` (the pipeline adds the actor's own and granted tags, e.g. `state.sneak-shot`); "target" =
`targetTags`; "has" = `targetState` (the target's granted state tags: `guard.dodge`, `state.dodging`,
`state.death-fade`); `weapon.*` tags = `weaponTags`. A list matches when any of its tags matches (`.*` parent
matching), and every list given must match. "negate" cancels the hit (the answer returns `null`). Three rules need more
than a row can say, so each is a plain `ctx.answer('damage.modify', fn, { order })` answerer at the same `order`
(01 §18): R0b (registered only when `app.params` has `bossGod`), R1 (its exemption list is `level.fight.capExempt`)
and R7 (a computed value). R3–R5 are source multipliers inside their source's base formula, and R6 is gone (R1-31,
R2-10).

| # | Rule | order | when | op / value | today |
|---|---|---|---|---|---|
| R0 | `rule.death-fade` | 0 | target `actor.player`, the death fade is active | negate | `main.ts:966–967, 1191` |
| R0b | `rule.boss-god` | 1 | param `bossGod` (harness allowlist), target `actor.player`, source `boss.*` \| `elite.*` \| `add.*` | veto | `kurganBoss.ts:652–657`, `stormTitan.ts:994–995`, `pinehollow/index.ts:67, 85–86` |
| R2 | `rule.dodge-guard` | 10 | target `actor.player` has `guard.dodge` and `player.dodging`; source `creature.*` \| `boss.*` \| `elite.*` \| `add.*` | veto | `main.ts:832` |
| R8 | `rule.damage-taken` | 40 | **creature target**, it has `damageTakenMul` ≠ 1, not a headshot | amount = `max(1, round(amount × damageTakenMul))` | `Animal.ts:336–340` (variant **before** species, as today) |
| R7 | species / elite / boss damage rules | 50 | **creature target** = that actor | amount = `max(1, round(amount × damageMul(·)))` (the brain's rule, §3.3 table) | `Animal.ts:341–342` `damageMul` hooks |
| R1 | `rule.hit-cap` | 90 | target `actor.player` with `incomingCap`; source `creature.*` \| `boss.*` \| `elite.*` \| `add.*`; `not` = `level.fight.capExempt` (Driftwood `creature.captain`) | cap | `ChunkDef.ts:452–453` |

**How today's arithmetic is kept exactly (R1-31, finding A14).** A hit's damage is built in three stages, never by
one rule overwriting another.

1. **The base, per source** (not a rule: the source's `DamageRequest.amount` is computed exactly as today, before the
   pipeline). The source multipliers sit at the rounding point each source has today:

   | Source | `amount` handed to the pipeline (today's expression) | Source multipliers inside it | Code today |
   |---|---|---|---|
   | arrow (Bow, Longbow, Golden Bow) | `max(1, round(damageFor(head, dist) × damageScale × Π sourceMul))` | sneak ×2 (was R3), golden vs balbal ×2 / ×3 with `arrow.sun` (was R5) | `Projectiles.ts:316` |
   | bolt (Crossbow) | `damageFor(head, dist) × boltMul` (damageFor already rounds; the product stays unrounded) | broadhead ×1.4 on `size.deer` (was R4) | `Crossbow.ts:1231`, `Animal.ts:59–64` |
   | javelin (Spear) | `round(JAV_DAMAGE × (head ? JAV_HEAD : 1) × Π sourceMul)` | sneak ×2 (was R3) | `Spear.ts:455` |
   | thrust / brace / lance (Spear) | `THRUST_DAMAGE` and today's brace / lance values, flat | none | `Spear.ts:523, 552, 572` |
   | melee swing (Sword family) | the move's damage × the weapon's base, as `Sword.ts:870` computes it | none | `Sword.ts:870` |
   | golden pierce | `balbal ? q.dmg × 3 : q.dmg` | — | `GoldenBow.ts:166` |
   | hitscan (AR-15, lever) | `damageFor(head, dist) × DAMAGE_SCALE` (.55 / 1.5; damageFor already rounds, the product stays unrounded) | none | `Rifle.ts:373`, `LeverRifle.ts:554` |

   `damageFor` draws from the seeded `rng.stream('gameplay')` instead of `Math.random` (B5). `SourceMulDef` rows
   (`{ id, when, mul }`) hold sneak, broadhead and golden. The source's formula multiplies them in **at that
   source's own point**, so a later rule can never discard them.
2. **Creature-target rules** (`ask('damage.modify')`, only when the target is a creature): R8 (variant shrug, order
   40), then R7 (species / elite / boss `damageMul`, order 50), each `max(1, round(·))` exactly as
   `Animal.applyDamage` does today. `Animal.applyDamage` then takes the **final** amount and applies no modifier of
   its own: its variant and species code **moves** into R8 / R7, so nothing is applied twice.
3. **Player-target rules** (only when the target is the player): R0 (0), R0b (1), R2 (10), R1 the cap (90).

**Proof:** `damage-golden.test.ts` (§3.6) is a golden table of today's damage for every combination that can happen
today: each source × head / body × with and without each source multiplier × plain / variant (Old Ironhide
`damageTaken`) × each species with a `damageMul` × distance 20 / 60 / 100 m, on a seeded stream. The combined cases
include:
- a broadhead bolt to a variant boar, head and body;
- a sneak golden arrow to a kurgan balbal, with and without `arrow.sun`;
- a sneak javelin to a variant deer.
Expected values are computed by calling today's code before S1.3 lands, and the table must match exactly after.

### 2.3 AmmoRow (the crossbow's bolt mods)

```ts
interface AmmoRow { id: AmmoId; label: StringId; name: StringId; flight: { gravity: number; drag: number }; wet?: { gravity: number; drag: number }; tags: readonly Tag[]; material?: MaterialRef; pouchMax: number }
```
| Row | flight × | wet × at rain 1 | tags | pouch |
|---|---|---|---|---|
| `ammo.iron` | 1 / 1 | gravity 1.2, drag 1.9 | `ammo.iron` | 30 (`POUCH_MAX`) |
| `ammo.pitch` | .8 / .7 | none | `ammo.pitch` | 30 |
| `ammo.broadhead` | 1.08 / 1.1 | 1.2, 1.9 (multiplied) | `ammo.broadhead` | 30 |

### 2.4 The starter effects (kit, `#kit/effects/`, decision 55′) — proposed values, tuned on the creatures board

| Row | Kind | Modifiers | Stacking | Cue | Icon | Who applies it on day one |
|---|---|---|---|---|---|---|
| `effect.stun` | timed, duration = the source's (Blackpaw's roar 1.3 s) | player: `moveLocked` override 1; creature: brain in `stunned` | `refresh` = max(remaining, new), as `stunT = max(stunT, s)` today | `cue.status.stun` | `status-stun` | **Blackpaw's roar** (`pinehollow/elites.ts:344`): today's stun moves onto this row, identical |
| `effect.burn` | timed 3 s, period 0.5 s | 4 damage per tick (= the Titan fire's 8 dps) | `refresh` | `cue.status.burn` | `status-burn` | nobody (tuned on the board; the Titan grass fire and the King's lanterns stay zone damage, identical) |
| `effect.poison` | timed 6 s, period 1 s | 3 damage per tick | `refresh` | `cue.status.poison` | `status-poison` | nobody (board) |
| `effect.bleed` | timed 4 s, period 0.5 s | 2 damage per tick | `{ max: 3 }` | `cue.status.bleed` | `status-bleed` | nobody (board) |
| `effect.slow` | timed 3 s | `moveSpeedMul` mul 0.6 | `refresh` | `cue.status.slow` | `status-slow` | nobody (board) |

Every value in this table is **proposed, tuned on the creatures board** (M2). A periodic tick is a `DamageRequest`
with source = the effect's source actor, tags `effect.<id>` + the source's tags, so the hit cap and the dodge guard
treat it like its source. Debug ▸ Combat & weapons gets one row "Apply effect" (choices: off · stun · burn · poison ·
bleed · slow; `note: 'E357 starter effects'`) that applies it to the player every 5 s, for the board clips (AGENTS.md
Debug registry rules).

### 2.5 Tag vocabulary (the full initial list; shards extend it by merging)

| Group | Tags |
|---|---|
| actors | `actor.player`, `actor.creature`, `actor.npc`, `actor.dummy` |
| creature kinds | `creature.boar`, `creature.bear`, `creature.deer`, `creature.elk`, `creature.horse`, `creature.wolf`, `creature.sheep`, `creature.sheepdog`, `creature.eagle`, `creature.leopard`, `creature.kokbori`, `creature.balbal`, `creature.kurgan-balbal`, `creature.ghost-rider`, `creature.golden-king`, `creature.argymaq`, `creature.crab`, `creature.monkey`, `creature.sailor`, `creature.captain`, `creature.antler-king`, `creature.marmot` |
| roles | `boss.golden-king`, `boss.storm-titan`, `boss.antler-king`, `boss.captain`, `elite.aqbars`, `elite.kokbori`, `elite.qyran`, `elite.qara-batyr`, `elite.argymaq`, `elite.ironhide`, `elite.ghost-stag`, `elite.blackpaw`, `elite.imperial-bull`, `add.thrall`, `add.kurgan-balbal`, `add.storm-rider`, `add.ghost-rider` |
| sizes | `size.deer` (deer, boar), `size.big` (bear, elk, antler-king: the Pine trauma set) |
| environment | `env.fall`, `env.lightning`, `env.ride` (thrown from the saddle, a bolting horse, a failed taming), `env.storm-wall`, `env.fire`, `env.sand` |
| damage kinds | `dmg.melee`, `dmg.ranged`, `dmg.hitscan`, `dmg.thrown`, `dmg.aoe`, `dmg.charge`, `dmg.effect` |
| weapons | `weapon.sword`, `weapon.sword-iron`, `weapon.jian`, `weapon.sabre`, `weapon.naizagai`, `weapon.spear`, `weapon.javelin`, `weapon.bow`, `weapon.golden-bow`, `weapon.longbow`, `weapon.crossbow`, `weapon.rifle`, `weapon.lever`, `weapon.blade` (the sword rows whetstones affect: sword, sword-iron) |
| moves | `move.slash`, `move.backhand`, `move.finisher`, `move.heavy`, `move.pass`, `move.thrust`, `move.brace`, `move.lance`, `move.crescent`, `move.calldown`, `arrow.sun`, `arrow.pierce` |
| ammo | `ammo.iron`, `ammo.pitch`, `ammo.broadhead` |
| models | `model.fixed`, `model.blade`, `model.speed` (the bolt has no model tag: its base is its source's formula, §2.2, R2-10) |
| cover | `through.walls` (by design: rings, beams, fire, sand, lightning, storm wall, call-down, effect ticks), `cover.checked` (the block already tested the world: projectiles, hitscan, javelin, pierce) |
| states | `state.sneak-shot`, `state.hidden`, `state.dodging`, `state.mounted`, `state.stunned`, `state.open` (an elite / boss vulnerability window) |
| guards | `guard.dodge` |
| status | `status.stun`, `status.burn`, `status.poison`, `status.bleed`, `status.slow` |
| cosmetic | `cosmetic.seaglass-glow`, `cosmetic.hat.captain`, `cosmetic.cape`, `cosmetic.finish.<id>`, `cosmetic.skin.<id>` |
| feel | `feel.blow` (hurt arc + shake + shove + grunt), `feel.jolt` (flash + thud + toast), `feel.silent` |

## 3. The damage pipeline

### 3.1 Types

```ts
// #engine/combat — 01 §18's DamageRequest and DeathCause, exactly as 01 declares them: the superset every path fills
// (13-lead-resolutions 09#11; R2-14: one death-cause type)
interface DamageRequest {
  source: Actor | 'env'; target: Actor;
  sourceTags: readonly Tag[];         // the hit's tags (dmg.*, ammo.*, env.*); the pipeline adds the source actor's own and granted tags (creature.*, boss.*, state.sneak-shot …)
  amount: number;                     // the source's base formula with its source multipliers (§2.2, R1-31); the pipeline's rules start from it (no rule recomputes it: R6 is gone, R2-10)
  point: THREE.Vector3; dir: THREE.Vector3;   // dir × knockback is Nalati's env.knock push (today `knock: { x, z }`)
  surface?: SurfaceId; weaponId?: string; moveId?: string;
  headshot?: boolean;
  stagger?: number;                   // 0..1 → Animal.stagger / knock
  knockback?: number; throughWalls?: boolean;   // throughWalls mirrors the `through.walls` tag
  from?: THREE.Vector3;               // occlusion origin: the attacker's reach point or the player's eye; absent = no occlusion
  distance?: number; scale?: number;  // the hit distance and the draw / charge scale the source's formula used (§2.2), kept for floats and analytics
  cause?: DeathCause;                 // the killer for the death card (today's Killer, main.ts:830)
  toast?: StringKey;                  // the "why" line (Titan, lightning), a string key
}
interface DeathCause {                // ONE type: DamageRequest.cause, damage.dealt (its req), player.died, death.checkpoint, the death card (01 §18, R2-14)
  kind: string;                       // the actor's kind ('boar', 'storm-titan' …) or the env tag ('env.lightning', 'env.ride')
  label: StringKey;                   // its name, today's Killer.label ('the Storm Titan', main.ts:923)
  text?: StringKey;                   // a full line for a cause with no actor ('Struck by lightning', 'Thrown from the saddle')
}
interface DamageDealt { req: DamageRequest; dealt: number; killed: boolean }
```

Every killer today maps onto the one `DeathCause` (R2-14); the strings move to the string tables as keys:

| Today (`main.ts`) | `cause` |
|---|---|
| a creature's hit, `killer = { kind: a.kind, label: a.label }` (`:835`) | `{ kind: <species kind>, label: <the species' name key> }` |
| the Storm Titan, `killer = { kind: 'storm-titan', label: 'the Storm Titan' }` (`:923`) | `{ kind: 'storm-titan', label: 'cause.stormTitan' }` |
| lightning, `killer = { cause: 'Struck by lightning' }` (`:907`) | `{ kind: 'env.lightning', label: 'cause.lightning', text: 'cause.lightning.text' }` |
| the ride (a throw, a bolting horse, a failed taming), `killer = { cause: 'Thrown from the saddle' }` (`:903`) | `{ kind: 'env.ride', label: 'cause.ride', text: 'cause.ride.text' }` |
| a hard landing, `if (health <= 0) killer = null` (`:945`) | no `cause` (the death card's no-killer line, as today) |

`combat.hit(req): DamageDealt | null` runs 01 §18's six steps. Step 2 (occlusion) is `lineOfSight(physics, from, point,
radius)` with the player's capsule excluded when the source is the player (as `bladeBlocked`, `MeleeSweep.ts`), and the
attacker's own body excluded when the target is the player (as `canReach`, `AnimalManager.ts:1020–1030`: radius
`bodyRadius × scale + 0.1`, from the player's chest `+1.2`). It is skipped for `through.walls`, `cover.checked` or no
`from`. Step 4 writes `health` and, for a creature, runs today's `applyDamage` body (flinch, ragdoll, `onDamaged`).

### 3.2 Player → creature, every path

| Path | file:line today | Request | Occlusion today → after |
|---|---|---|---|
| Sword / iron / jian / sabre swept blade (incl. pass slash) | `Sword.ts:819, 870` | `dmg.melee`, `weapon.<id>`, `move.<name>`, `model.blade`: amount = round(damage × move.damage × (heavy ? heavyDamageMul : 1)), stagger = move.stagger, `from` = eye | yes → yes (same test) |
| **Spear thrust** | `Spear.ts:561–579` | `dmg.melee`, `weapon.spear`, `move.thrust`, fixed 30, stagger .5, `from` = eye | **no → yes (bug B1)** |
| **Spear brace / couched lance** | `Spear.ts:523–557` | `dmg.melee`, `move.brace` / `move.lance`, `model.speed` (60 + 8 v / 40 + 6 v), stagger 1, `from` = eye | **no → yes (bug B1)** |
| Javelin | `Spear.ts:451–462` | `dmg.thrown`, `weapon.javelin`, fixed 55 × (head 2), `cover.checked` | yes (`worldHit`) → kept |
| Bow / Longbow arrows | `Projectiles.ts:311–317` | `dmg.ranged`, `weapon.<id>`, amount = the arrow's formula (§2.2, `Projectiles.ts:316`), scale = damageScale, `cover.checked` | yes → kept |
| Golden sun-arrow pierce | `GoldenBow.ts:118–166` | `dmg.ranged`, `arrow.pierce`, amount round(damageFor × 1.2), `cover.checked` (the predicted path stops at walls) | yes → kept |
| Crossbow bolt | `Crossbow.ts:1225–1231` | `dmg.ranged`, `weapon.crossbow`, `ammo.<kind>`, amount = the bolt's formula (§2.2, `Crossbow.ts:1231`), distance from the camera, `cover.checked` | yes → kept |
| AR-15 / lever hitscan | `Rifle.ts:366–373`, `LeverRifle.ts:547–554` | `dmg.hitscan`, `weapon.rifle` / `weapon.lever`, amount = `damageFor(head, dist) × DAMAGE_SCALE` (.55 / 1.5, the unrounded product, as the bolt; §2.2), `cover.checked` | yes → kept |
| **Naizagai crescent + arcs** | `Naizagai.ts:204–247` | `dmg.melee`, `move.crescent`, fixed 40 × storm 1.25, `from` = eye (crescent) and the previous target's body (each arc) | **no → yes (bug B2)** |
| Naizagai call-down | `Naizagai.ts:253–260, 185–195` | `dmg.aoe`, `move.calldown`, 60 × storm, `through.walls` (from the sky, by design) | none → none |
| Training dummy | `TrainingArena.ts:64, 131` | as the weapon's request, target `actor.dummy` | — |

### 3.3 Creature / world → player, every path

`feel` decides the presentation (today's, unchanged): `feel.blow` = the onCharge block's hurt arc, trauma
`min(.85, .3 + dmg / 40)`, shove `5 + min(4, .15 dmg)`, `audio.hurt(dmg / 20, pan)`, `music.combat(.9)`, killer =
the creature; `feel.jolt` = flash + `audio.land(true)` + the toast; falls = flash only.

| Path | file:line today | Request tags | feel | Cap + guard today → after |
|---|---|---|---|---|
| Herd charge (boar, bear, elk thralls, horse stallion) | `AnimalManager.ts:942–947` (+ melee contact `:950–960`) | `creature.<kind>`, `dmg.charge`, amount `mods.chargeDamage`, `from` = its body | blow | yes → yes |
| Self-thinking species `c.hurt` (crab, monkey bite, sailor, captain, balbal, wolf, golden-king adds) | `AnimalManager.ts:779` | `creature.<kind>`, `dmg.melee` | blow | yes → yes |
| Coconut | `Enemies.ts:309` | `creature.monkey`, `dmg.ranged`, 8, `cover.checked` | blow | yes → yes |
| Pine elites, Antler King, thralls (`ctx.hurt`) | `pinehollow/index.ts:85` | `elite.*` / `boss.antler-king` / `add.thrall` | blow | yes → yes |
| Blackpaw roar stun | `pinehollow/elites.ts:344` | `elite.blackpaw`, `dmg.aoe`, 12, `through.walls` + `effect.stun` 1.3 s | blow | yes → yes |
| Nalati elites (`env.hurt`) | `nalati/elites.ts:861` | `elite.*` | blow | yes → yes |
| Golden King + his hazards (`host.hurt`) | `kurganBoss.ts:663` (strike `:264`, sunburst `:439`, sand `:504`, beam `:535`) | `boss.golden-king` (+ `through.walls` for sunburst, sand, beam) | blow | yes → yes |
| Ghost-rider arrows | `nightEnemies.ts:57`, `Projectiles.ts:300` | `add.ghost-rider`, `dmg.ranged`, 10, `cover.checked` | blow | yes → yes |
| **Ride**: thrown / bolting horse / failed taming | `main.ts:903` ← `ride.ts:73–76`, `Mount.ts:617, 764`, `Taming.ts:254` | `env.ride`, 10 (`THROWN_DAMAGE`), `cause` `{ kind: 'env.ride', label, text }`, the text "Thrown from the saddle" (§3.1) | jolt | no → no (exempt by tag, decision 20) |
| **Lightning** | `main.ts:907` ← `nalati/weather.ts:235` ← `world/Weather.ts:70, 324` | `env.lightning`, 60, `through.walls`, toast, `cause` `{ kind: 'env.lightning', label, text }`, the text "Struck by lightning" (§3.1) | jolt | no → no (exempt) |
| **Storm Titan** (spear 40, wind charge 30, fire 4 per .5 s, chain 18, whirl 15, storm wall 10) | `main.ts:923` ← `stormTitan.ts:639, 722, 831, 865, 903, 972, 1097` | `boss.storm-titan` (+ `through.walls` fire, chain, wall; `env.fire` on fire), `cause` `{ kind: 'storm-titan', label }` (`main.ts:923`, §3.1) | jolt (as today) | **no → yes (bug B3)** |
| **Fall** (hard landing: v.y < −9 m/s, cushion < .6; hover landing > 9) | `main.ts:945` ← `Player.ts:489, 647–649` | `env.fall`, 8, no source | flash only | no → no (exempt) |

**The 5 hurt blocks in `main.ts` (831–841, 903, 907, 923, 945)** and the `let health` (612), the regen (1186–1187)
and the death check (1192–1197) are deleted. What replaces them:
1. `app.player.attributes.health` (engine).
2. One engine listener on `damage.dealt` for `actor.player` that plays `feel.*` (above) and records the killer: the
   request's `DeathCause` (§3.1).
3. The regen as an engine system (`engine.player.regen`, phase `update`): +4 /s after 6 s since the last request that
   was not `env.fall` (today's fall does not touch `lastHurt`, `main.ts:945` — kept, see Q6).
4. The death: `health ≤ 0` → `emit('player.died', { cause })` with the last `DeathCause` (none after a fall); the respawn flow asks `ask('death.checkpoint')`
   (answered true by a running boss encounter: today's `pineFights.onPlayerDeath() || boss.onPlayerDeath() ||
   titan.onPlayerDeath()` chain, `main.ts:1195`), then refills (`nalatiKit.refill`, `pineLoadout.onPlayerDeath`) via
   `player.respawned` listeners.

### 3.4 Bugs fixed inline (each with its test)

| # | Bug | Fix | Test (`test/combat/damage-pipeline.test.ts` unless named) | Row |
|---|---|---|---|---|
| B1 | Spear thrust, brace and couched lance hit through walls (`Spear.ts:523–579`: animal ray only) | their requests carry `from` = eye; the pipeline's occlusion | a wall collider between the eye and a boar 2.5 m ahead: thrust / brace / lance each deal 0; with no wall they deal 30 / 60 + 8v / 40 + 6v | S1.2 (weapons board) |
| B2 | Naizagai's crescent and arcs hit through walls (`Naizagai.ts:204–247`: capsule over `animals.animals`) | `from` = eye (crescent) / previous target (arc) | a wall 5 m out: a creature at 10 m on the crescent's line takes 0; the arc does not jump through a wall | S3.3 (weapons board) |
| B3 | The Storm Titan's hits skip the hit cap and the dodge guard | its requests are `boss.storm-titan`; R1 / R2 answer `boss.*` | with `incomingCap` 20 a 40 spear deals 20; with `guard.dodge` + dodging it deals 0; lightning 60 and a fall 8 are unchanged by both | S3.4 (creatures board) |
| B4 | `canReach` runs only on melee shards (`AnimalManager.ts:435, 779, 926, 1043`): Pine's boar / bear charges, both elite sets, all four bosses and the thralls hit through walls | every strike's request carries `from` (the attacker); occlusion is default on every shard; `through.walls` only for the listed AoE | `test/ai/can-reach.test.ts`: on a Pine-shaped fake world a bear charge through a cabin wall deals 0; the same charge in the open deals 35; a Blackpaw roar ring (`through.walls`) still lands | S2.3 (creatures board) |
| B5 | `damageFor` uses `Math.random()` (`Animal.ts:62`) | the seeded `gameplay` stream | the same seed gives the same 20 rolls; the range stays 32–40 | S1.3 |
| B6 | The big crab's `mods.chargeDamage 14` (`crab.ts:301`) is dead data: the snap always deals `SNAP_DAMAGE` 10 (`crab.ts:266`) | **Jake, decision 86: the big crab hits for 14** (the data wins); the snap reads its row's damage | strike table (§5.3) asserts 14 for the big crab, 10 for the others | S4.2 (on the creatures board) |

### 3.5 Randomness that moves to the seeded streams

`Animal.ts:62` (bolt roll, `gameplay`), `Spear.ts:484` (javelin survive), `Projectiles.ts:287` recover roll, `Bow.ts:738`,
`Longbow.ts:599–600`, `Crossbow.ts:989`, `Rifle.ts:361`, `LeverRifle.ts:544` spread (`gameplay`); brass spin `Rifle.ts:456–457`, `LeverRifle.ts:619–620`, javelin spin `Spear.ts:425` (`cosmetic`); `feel.ts:45` kick roll
(`cosmetic`); `kurganBoss.ts:504` sand roll, `pinehollow/elites.ts:213` Ironhide's second charge, `antlerKing.ts:483`
thrall charge roll, `nalati/elites.ts` Qyran stoop interval (`ai`). Every other `Math.random` in `src/entities`,
`src/nalati`, `src/pinehollow` and `src/game` goes the same way and is counted by the F4 ratchet
(`wildshard/no-raw-random-time`).

### 3.6 Pipeline tests (before S1.3; node, fake `Game`)

`test/combat/damage-pipeline.test.ts`: B1–B5 above; every pipeline rule (R0, R0b, R2, R8, R7, R1) in isolation and
in order (a boar charge 25 with cap 20 → 20; 40 with the captain exempt → 40; dodging with the tusk → 0; Ironhide
`damageTaken` .6 on a body hit, head in full); every source formula with its source multipliers (a sneak arrow × 2
inside the arrow's rounding; a broadhead on a boar × 1.4 inside the bolt's product), run through the public
`combat.hit` and the final `applyDamage`, so an overwrite or a double application fails (R2-10); the `feel` of each path;
the regen timing; `death.checkpoint` answered by a fake encounter; `bossGod` vetoes a boss hit and not a fall.
`test/combat/hurt-paths.test.ts` builds one request per row of §3.3 and asserts the health delta equals today's.

## 4. Events and asks (combat + creatures)

### 4.1 EventMap (queued, 01 §3)

| Event | Payload | Emitted by | Listened by |
|---|---|---|---|
| `damage.dealt` | `DamageDealt` | the pipeline | Combat floats (`ui/Combat.ts`), health bars, hit-stop / kick cues, blood, audio, player feel (§3.3), analytics |
| `actor.died` | `{ actor: Actor; req: DamageRequest }` | the pipeline | loot (coins, trophies), compendium, quests (Spine, Ecology, Pine quest, Nalati adventure), Pine life (ravens), feats, kill feed |
| `player.died` | `{ cause?: DeathCause }` (§3.1) | the player service | death fade, analytics `death.cause`, respawn flow |
| `player.respawned` | `{ at: Vec3; checkpoint: boolean }` | respawn flow | kit refill (Nalati), Pine loadout, effects cleanup |
| `weapon.fired` | `{ id: WeaponId; move?: MoveId }` | every weapon | cues, Combat's MISS judgement, analytics `weapon.used` |
| `weapon.hit` | `{ id; kind: string; headshot: boolean; killed: boolean }` | every weapon (after `damage.dealt`) | hit marker, Pine's big-kill trauma |
| `weapon.impact` | `{ id; surface: ImpactSurface; point: Vec3 }` | every weapon | impact cues (debris by surface) |
| `weapon.reload` | `{ id; phase: 'start' \| 'end' \| 'round' }` | ranged weapons | cues |
| `weapon.dry` | `{ id }` | ranged weapons | cues |
| `weapon.swap` / `weapon.unlocked` | `{ to }` / `{ id }` | equipment | cue, WeaponStrip, touch SWAP pill |
| `weapon.charge` | `{ id; phase: 'heavy' \| 'draw' \| 'letdown' \| 'loose' \| 'throw' \| 'brace-on' \| 'brace-off' \| 'recover'; value? }` | Melee heavy, Bow draw, Spear | cues, toasts ("Arrow recovered") |
| `tool.used` | `{ id: ToolId; phase: string }` | tools | cues |
| `ai.windup` | `{ actor; strike: StrikeId; dur: number }` | the strike runner | WindupWarn, species windup cues |
| `ai.sound` | `{ actor; name: AnimalSound; at }` | brains | `audio.animal` |
| `ai.state` | `{ actor; from; to }` | HFSM | debug overlay |
| `encounter.phase` / `encounter.state` | `{ id; phase }` / `{ id; state }` | encounter runtime | music, banners, toasts |
| `elite.event` | `{ id; e: 'banner' \| 'phase2' \| 'kill' }` | elite runtime | stings |
| `effect.applied` / `effect.removed` | `{ target; id }` | effect service | HUD status icons, cues |

### 4.2 AskMap (synchronous, 01 §3)

| Ask | In → out | Answered by |
|---|---|---|
| `damage.modify` | `DamageRequest` → `DamageRequest \| null` (null = negated) | R0, R0b, R2, R8, R7, R1 (§2.2) + brains' rules |
| `death.checkpoint` | `{ cause?: DeathCause }` → `boolean` | running encounters (Boss runtime) |
| `ai.mayAttack` | `{ actor }` → `boolean` | the aggression director (§5.5) |
| `ai.claim` | `{ actor }` → `boolean` | the director (takes a token) |
| `aim.target` | `{ origin; dir; max; hit }` → `TargetHit \| null` | the arena, Nalati's sheep flock, the ghost riders' torso test (`main.ts:520–526`, `nightEnemies.ts` `target`) |

### 4.3 Every hook field today → its event

| Hook today | file:line | Becomes |
|---|---|---|
| `weapons.onFire` / each weapon's `onFire` | `Weapons.ts:168`, `main.ts:694` | `weapon.fired` |
| `weapons.onHit` (+ Pine `feel.ts:42` chain) | `main.ts:706`, `feel.ts:41–48` | `weapon.hit` |
| `weapons.onImpact` (+ `feel.ts:50`, `loadout.ts:186`) | `main.ts:698` | `weapon.impact` |
| `weapons.onReloadStart/End`, `onDry` (+ `loadout.ts:177, 182`) | `main.ts:695–696` | `weapon.reload`, `weapon.dry` |
| `weapons.onSwap`, `onUnlock` | `main.ts:697`, `Weapons.ts:149–151` | `weapon.swap`, `weapon.unlocked` |
| `sword.onHeavy`, `swordEvents.onSwing/onStrike/onClang` | `main.ts:691, 850–857` | `weapon.charge {heavy}`, `weapon.fired`, `damage.dealt`, `weapon.impact {surface: stone \| wood}` |
| `sword.onMoveHit` | `Sword.ts:465` | the `Melee.onMoveHit` override (Sabre's chain) |
| `spear.onThrow/onBrace/onPickup`, `bow.onDrawStart/onLetDown/onRecover`, `longbow.onDrawStart/onRecover` | `nalati/sound.ts:105–110`, `loadout.ts:190–191` | `weapon.charge` phases |
| `animals.onKill` (8 chained: main, loot install, keepsakes, Spine, Ecology, Pine life, Pine quest, compendium, Nalati adventure) | `main.ts:790`, `install.ts:100`, `keepsakes.ts:184`, `Spine.ts:71`, `Ecology.ts:65`, `life/index.ts:277`, `quest/index.ts:386`, `compendium/install.ts:115`, `adventure.ts:223` | `actor.died` |
| `animals.onCharge` (+ the death-fade wrap `main.ts:966`, the god wrap `kurganBoss.ts:657`) | `main.ts:831` | `combat.hit` requests; the wraps become R0 / R0b |
| `animals.onWindup` (+ WindupWarn chain `main.ts:862`, `onWindup` host verb `main.ts:984`) | `main.ts:857` | `ai.windup` |
| `animals.onSound` (+ Nalati chain `sound.ts:120`) | `main.ts:846` | `ai.sound` |
| `animals.onDamage` (Combat's tap) | `ui/Combat.ts:119` | `damage.dealt` |
| `boss/titan/pineFights.onPlayerDeath` chain | `main.ts:1195` | `death.checkpoint` ask |
| `nalatiNow().bindPlay/weather.bind/boss.bind/elites.bind/titan.bind` hurt callbacks | `main.ts:901–926` | `combat.hit` from each source |
| `player.onLand` (fall) | `main.ts:945` | `combat.hit` `env.fall` |
| `lockSys.onLock/onSwitch/onUnlock/onNone/onFlickMiss` | `main.ts:939–943` | `lock.*` events (01 input spec; listed here for completeness: `lock.on`, `lock.switch`, `lock.off`, `lock.none`, `lock.flickMiss`) |
| `ride.taming.onBreaking` | `main.ts:928` | `equipment.stowed = true` from Nalati's plugin |

## 5. Creatures and AI

### 5.1 The runtime (engine, `#engine/ai`, on 01 §19)

| Piece | Today | Target |
|---|---|---|
| Creature runtime | `AnimalManager` (1,462 lines) + `Animal` (922) | `CreatureService`: spawn / retire / raycast / hit volumes / ragdolls / animation LOD (`ANIM_LOD` 140 m, far batching `farHerd.ts`) unchanged; the brains leave it |
| Brain | the herd brain inside `AnimalManager.think` (10 Hz, `:686–699`), species `think(a, ThinkCtx)` hooks, `eliteThink` (`eliteBrain.ts`), group brains (`Pack.ts`, `Herd.ts`, `Flock.ts`) | `CreatureBrain` subclasses with an `Hfsm`; group brains are `GroupBrain` (a blackboard over members); `ThinkCtx` (`AnimalManager.ts:1037–1047`) becomes `BrainCtx` with the same fields (`player`, `playerSpeed`, `rng`, `calm`, `steer`, `pathYaw`, `confine`, `reach`, `claim`, `mayAttack`, `sound`, `world`) |
| Shared states (behaviour library) | `AnimalState` (`Animal.ts:54`) | `idle`, `graze`, `wander`, `alert`, `flee`, `charge`, `stalk`, `attack`, `perch`, `rise`, `hide`, `sidestep`, `stagger`, `dead`, plus E297's `circle` / `backoff`. A species picks from these and adds at most its own named states |
| Attack timing | 40 hand-written blocks (§5.3; the audit counted the 24 `startAttack` ones) + `LaneCharge` (`pinehollow/ctx.ts:79`) | `StrikeSpec` rows run by one `StrikeRunner`: wind-up (pose + `telegraph` + `ai.windup`) → active window (the shape test, then `combat.hit` with `from` = the attacker) → recover (the shot window) → cooldown |
| Utility pick | `if` ladders per brain | `pickStrike(ctx)`: the strike with the highest `weight(ctx)` among those in range and off cooldown; ties keep list order. Each brain's weights reproduce its old ladder exactly (the `strike-table` test drives the same inputs through both) |
| Aggression director | `AttackTokens` (`fightRules.ts:18`), Driftwood only; wolves' own tokens (`Pack.ts:268–275`) | `combat.director` (§5.5) answering `ai.claim` / `ai.mayAttack`; the pack's rule is a `GroupBrain` policy on it |
| Encounters | `Boss` (`game/Boss.ts:136`; used by the Golden King, the Storm Titan, the Antler King), the Captain's own bar (`game/quest/Finale.ts`), `Elites` (`game/Elite.ts:126`) with two script bases (`nalati/elites.ts` `Base`, `pinehollow/elites.ts:120` `PineElite`) | `EncounterService.boss(def, brain)` for all four bosses; `EncounterService.elite(def)` with **one** `EliteBrain` base; the Captain moves onto `boss()` with his bar, phases and arena (S4.2) |
| Spawning | `ChunkDef.fauna`, `Enemies.ts`, `Wildlife.ts`, `nightEnemies.ts`, `nightThralls.ts`, `swapRolledElites`, five `retire()`s | `EncounterService.spawn(table)` over `WeightedTable` rows (§5.6); one `creatures.retire(a)` |

### 5.2 Species (rule of two) and their states

| Species | Kit / shard | File today | hp (variants) | Brain → states | Strikes (§5.3) | tick |
|---|---|---|---|---|---|---|
| boar | **kit** (Driftwood + Pine) | `species/boar.ts:236` | 100 (sow 70, big 140, scarback 180, ironhide 300, thrall 140) | Herd: idle · graze · wander · alert · flee · charge · stalk · dead (+ circle / backoff with the director) | S8 (Driftwood rows), S9 (Pine rows) | `ai` |
| bear | **kit** | `species/bear.ts:247` | 220 (brown 320, black-old 330, brown-old 480) | Herd hunter (stalk) | S8 / S9 | `ai` |
| horse | **Nalati** (rule of two: its only other user, the horse playground, is Nalati's; 13-lead-resolutions 09#5) | `species/horse.ts:574` | 150 (foals 70, tulpar / stallion 150) | Herd (`Herd.ts`): graze · flee · stampede; stallion watch · warn · display · charge · wheel · lead · beaten · ridden (`Herd.ts:44`); `horseDamageMul` (§5.4) | S18 (stallion) | `ai` |
| deer | Pine | `species/deer.ts:265` | 60 (big-stag 90, ghost 130) | Herd prey (never charges) | — | `ai` |
| elk | Pine | `species/elk.ts:310` | 160 (bull 200, big-bull 260, imperial 340, thrall 220), `damageTaken` .8 | Herd prey | — | `ai` |
| thrall | Pine (variant rows of boar / elk: `spawnOnly`) | `species/thrall.ts`, `quest/nightThralls.ts` | as the variants | Herd (roam, millrace, the King's adds) | S9, S33 | `ai` |
| antler-king | Pine | `pinehollow/antlerKing.ts:108` (`kingOwnSpecies`) | from `elk` | `BossBrain` (§5.4) | S30–S34 | `always` in the fight |
| wolf | Nalati | `species/wolf.ts:354` | 70 (scout 55, alpha 110) | `GroupBrain` pack: roam → shadow → encircle ⇄ regroup → break; roles alpha / flank / scout (`Pack.ts:55–60`) | S10 | `ai` |
| sheep, sheepdog | Nalati | `species/sheep.ts`, `sheepdog.ts:12` (60) | — | `GroupBrain` flock (`Flock.ts`): graze · flee · herd | — | `ai` |
| marmot | Nalati | `entities/Marmots.ts` | — | ambient (pop up / hide) | — | `fx` |
| eagle (Qyran), leopard (Aqbars), kokbori | Nalati | `species/eagle.ts:143`, `leopard.ts:221`, `kokbori.ts:22` | 600, 700, 650 | `EliteBrain` (§5.4) | S13–S16 | `ai` |
| balbal, kurgan-balbal | Nalati | `species/balbal.ts:463`, `kurganBalbal.ts` | 220 (kurgan 220) | rise · guard · stalk · attack · return · sink · emerge (`balbal.ts:339`) | S11 | `ai` |
| ghost-rider (+ Qara Batyr `captain` variant 800) | Nalati | `species/ghostRider.ts:105`, `nalati/ghostRiders.ts` | 70 | circle · engage · shoot · disengage (group line) | S12, S17 | `ai` |
| golden-king | Nalati | `species/goldenKing.ts:420` | 2400 | `BossBrain` | S19–S22 | `always` in the fight |
| argymaq | Nalati (`parent: horse`) | `nalati/elites.ts:706` | 750 | Herd stallion + `EliteBrain` lane tell | S18 | `ai` |
| storm titan (heart 2600) + 3 storm riders (250 each) | Nalati | `nalati/stormTitan.ts:81, 91` | 2600 / 250 | `BossBrain` | S23–S28 | `always` in the fight |
| crab | Driftwood | `species/crab.ts:290` | 25 (big 70) | idle · engage · attack · flee (`crab.ts:213`) | S1 | `ai` |
| monkey | Driftwood | `species/monkey.ts:350` | 30 (elder 45) | perch · groundIdle · attack · drop · ground · return · climb (`monkey.ts:232`) | S2, S3 | `ai` |
| sailor | Driftwood | `species/sailor.ts:354` | 60 | hide · rise · attack · guard · sink (`sailor.ts:275`) | S4 | `ai` |
| captain | Driftwood | `species/captain.ts:315` | 320 | `BossBrain`: hide · rise · fight · attack · sink · under (`captain.ts:227`) | S5–S7 | `always` in the fight |
| training dummy | engine (`#engine/practice`) | `practice/TrainingArena.ts` | — | none | — | — |

Nine Dragon spawns nothing (`fauna: []`, `def.ts:75`). Kit species rows carry every shard-independent number; a
shard's differences are a child row with `parent: KIT.boar` (Driftwood's `faunaTuning.boar`, `driftwood-isle.ts:252–254`;
Driftwood's `ISLAND_BOARS` variant subset; Pine's charge tell and thrall variants).

### 5.3 Strike table (every creature attack; windup / active / recover in s, range in m)

`shape` is 01 §19's `StrikeShape` (13-lead-resolutions 09#1): `arc { radius, halfAngle }` · `lane { length, width }` ·
`ring { inner, outer }` · `wedge { length, halfAngle }` · `point { radius }`. The table's older names map onto it:
arc / wedge `reach` → `radius` / `length`; lane `reach` → `length`; ring `maxR` → `outer`, `halfWidth` → `outer −
inner` = 2 × `halfWidth`; point `r` → `radius`; a `zone { r, period }` is a `point` strike repeated every `period`.
The motion and timing numbers a shape can't hold (arc `maxDy`; lane `speed`, `overshoot`, `skid`; ring `speed`,
`jumpDodges`; point `delay`) stay on the strike row beside `shape` (sent to the lead: 01 §19's `StrikeSpec` has no
field for them yet). "cover" = occlusion (✔ = `from` set, ✘ = `through.walls`); "today" =
does it check walls now.

| # | Strike | file:line | windup → hit | recover / cooldown | shape | dmg | cover (today → after) | token |
|---|---|---|---|---|---|---|---|---|
| S1 | `strike.crab.snap` | `crab.ts:214–267` | starts d < 1.9; dur .78, hit at .5 s | cd 1.4; a hit taken cancels, cd ≥ .6 | point r 1.6 × max(1, .8 scale) | 10; the big crab 14 (B6, decision 86) | ✔ → ✔ | yes |
| S2 | `strike.monkey.bite` | `monkey.ts:233, 296` | d < 1.3; dur .9, hit at .45 (.405 s) | cd 1.2 | point r 1.3 | 6 | ✔ → ✔ | yes |
| S3 | `strike.monkey.coconut` | `monkey.ts:289–303`, `Enemies.ts:58, 300–312` | 2.5 < d < 14; dur 1.0, release at .62; ballistic (g 9.81, r .13, ≤ 16 in flight) | cd 2.5–4 (`ai` rng) | projectile, hit within .45 m of the feet→head segment | 8 | ✔ (physics body) → `cover.checked` | yes |
| S4 | `strike.sailor.swing` | `sailor.ts:276, 315, 340` | d < 1.8 and `reach`; dur .9, hit at .645 s (.6 / .9 + .05) | cd 1.5 → guard | point r 1.9 | 14 | ✔ → ✔ | yes |
| S5 | `strike.captain.swing` | `captain.ts:228–229, 268–276` | d < 2.3; dur windup + .35 (phase 1 / 2 / 3: .7 / .62 / .5), hit at windup / dur + .04 | cd 1.4 / 1.2 / .8; phase 1: a hit taken cancels | point r 2.5 | 24 (cap-exempt) | ✔ → ✔ | yes |
| S6 | `strike.captain.second-cut` | `captain.ts:277` | phase 3 only, right after S5; dur .55, hit at .628 × .55 s | → fight, cd .8 | point r 2.5 | 24 | ✔ → ✔ | held |
| S7 | `strike.captain.burst` | `captain.ts:262, 285–305` | phase ≥ 2 every 7 / 5 s of fight: sink .9 → under 1.1 s (bubbles at the burst point, 1.2–2.2 m from you) | rise 1.1 | point r 3 | 16 | ✘ → ✘ (from under water) | no |
| S8 | `strike.<boar\|bear>.charge` (Driftwood rows) | `AnimalManager.ts:217–226, 919, 950–960` | face within .6 rad, windup .55 (bear .65), charge 7.5 m/s (bear 9) × `mods.speed`, commit at 4.5 m (turn 1.1) | cd 3.4 (director on) | arc reach 1.4 × max(1, scale), ±50°, \|dy\| ≤ 2.5, per fixed step | `mods.chargeDamage`: boar, sow, black, big 25 (`ISLAND_BOARS`, `driftwood-isle.ts:86`); bear black / black-blaze 35, brown 45 | ✔ → ✔ | yes |
| S9 | `strike.<boar\|bear>.charge` (Pine rows, thralls) | `AnimalManager.ts:926, 942–947` | windup 0; charge as S8 | cd `stalk.rechargeCd` (hunters), relentless 2, else 6 → flee | point r 1.4 × max(1, scale) at the brain tick, no arc | boar 25, scarback 32, ironhide 40; bear 35, brown 45, black-old 42, brown-old 55 | **✘ → ✔ (B4)**; Pine tell lane (≤ 3 within 45 m, width 2.2 × max(1, .8 scale), `feel.ts:57–80`) | no |
| S10 | `strike.wolf.lunge` | `Pack.ts:58–60, 287, 352–364` | token → telegraph .4, dash ≤ 1.8 s at 9.5 | breakoff 1.1 | point r 1.4 × max(1, scale) + .25 | 12 (alpha 18) | ✔ → ✔ | pack policy |
| S11 | `strike.balbal.slam` | `balbal.ts:263, 340–343, 402` | starts d < 2.6; ATK 2.9 s, windup to .52 (1.508 s), strike to .58 (hit at 1.595 s) | cd 1.4 | wedge reach 3.1 × scale / 1.18 + .4, ±.96 rad | 30 (kurgan 18) | ✔ → ✔ | no |
| S12 | `strike.ghost-rider.arrow` | `ghostRiders.ts:65–67` | circle 34 m, engage 70, shoot ≤ 62 | respawn 60 s | projectile 34 m/s, g 5 | 10 | ✔ (`Projectiles`) → `cover.checked` | no |
| S13 | `strike.aqbars.swipe` | `nalati/elites.ts:223–240` | d < 2.4; dur 1.0, hits at .45 and .8 | cd 1.4 | point r 2.9 | 14 + 14 | **✘ → ✔ (B4)** | no |
| S14 | `strike.aqbars.pounce` | `elites.ts:245–290` | ring tell 1.0 s → leap .6 s | miss → `state.open` 1.5 s | point r 1.9 at the landing | 35 + knock | ✘ → ✔ | no |
| S15 | `strike.kokbori.bite` | `elites.ts:362–367` | d < 3.5; dur .9, hit at .7 | cd 1.8 | point r 3.2 | 22 | ✘ → ✔ | no |
| S16 | `strike.qyran.stoop` | `elites.ts:468–500` | from soar every 7–9 s (phase 2: 4.5–6), tell 1.2 (p2 .9), stoop 40 m/s | miss → grounded (`state.open`) | point r 2.4, feet ≤ 1.5 up | 30 + knock | ✘ → ✔ | no |
| S17 | `strike.qara-batyr.charge` | `elites.ts:590–646` | lane tell 1.3 s | — | lane (the line), hit r 1.9, feet ≤ 1.6 | 38 + knock | ✘ → ✔ | no |
| S18 | `strike.horse.stallion` / Argymaq trample | `Herd.ts:32, 300–331`, `elites.ts:731–745` | display (< 20 m, standing, after 1.2 s) → charge if d < 10, trust < 20; Argymaq lane tell 1.2 / 1.4 s | charge ≤ 4.5 s, cd 5 | lane, 12 m/s, through the player on foot | 25 + knock-down | ✔ (melee shard) → ✔ | no |
| S19 | `strike.golden-king.cut[0–3]` | `kurganBoss.ts:56, 249–270, 296–300` | dur .95 (phase 3 .78), hit at .62 | combo while d < 5.5 | arc reach 3.0 (i ≥ 2: 3.3), ±.95 (±1.35), player y < king + 2.6 | 14, 14, 22, 22; shove 3 / 5 | **✘ → ✔** | no |
| S20 | `strike.golden-king.sunburst` | `kurganBoss.ts:56, 439` | — | — | ring 8.5 m/s to 17 m | 25 | ✘ → ✘ | no |
| S21 | `strike.golden-king.beam` | `kurganBoss.ts:57, 535` | — | 1 s rehit | zone r 1.15 on a 6.2 m beam | 15 | ✘ → ✘ | no |
| S22 | `strike.golden-king.sand` | `kurganBoss.ts:504` | pour 1.0 s tell, 6 s pour | — | zone r .55, rate 2 /s (`ai` rng) | 4 | ✘ → ✘ | no |
| S23 | `strike.titan.spear` | `stormTitan.ts:89, 639` | aim 1.5 + lock .5 | stuck 3 s | point r 4.5 | 40 (+ thrown from the saddle) | ✘ → ✔ | no |
| S24 | `strike.titan.whirl` | `stormTitan.ts:90, 903` | — | — | point r 3.2 | 15 | ✘ → ✔ | no |
| S25 | `strike.titan.wind-charge` (storm riders) | `stormTitan.ts:91, 722` | lane 1.2 s, flank 2 s | stun 4 s after a miss | lane, hit r 3.4 | 30 | ✘ → ✔ | no |
| S26 | `strike.titan.chain` | `stormTitan.ts:93, 865` | lands .6 s after the tell | — | point r 3 | 18 | ✘ → ✘ | no |
| S27 | `strike.titan.fire` | `stormTitan.ts:92, 831` | cells 4 m burn 7 s | — | zone, 4 per .5 s (8 dps) | 4 | ✘ → ✘ | no |
| S28 | `strike.titan.storm-wall` | `stormTitan.ts:1097` | — | 1.2 s | zone (the wall) | 10 | ✘ → ✘ | no |
| S29 | `strike.ironhide.gore` | `pinehollow/elites.ts:190–213` | lane tell .9 (p2 .62, speed × 1.12); p2: 55 % a second charge (tell .55, × 1.1) | skid 1.1 | lane w 2.4, 12.5 m/s, overshoot 7, reach 1.7 | 30 | ✘ → ✔ | no |
| S30 | `strike.blackpaw.roar` | `pinehollow/elites.ts:300, 330–344` | ring tell 1.1 s | — | ring r 8 (p2 11) | 12 + `effect.stun` 1.3 | ✘ → ✘ | no |
| S31 | `strike.blackpaw.charge` | `elites.ts:296, 346, 366` | tell .75 (p2 .6, × 1.12) | skid 1.2 | lane 2.6 / 10.5 / 5 / reach 1.6 | 28 | ✘ → ✔ | no |
| S32 | `strike.blackpaw.swipe` | `elites.ts:355–358` | swipe delay then hit | mode 1.2 s | arc ±1.1, reach 3.8 × scale / 1.65 | 22 | ✘ → ✔ | no |
| S33 | `strike.imperial-bull.charge` | `elites.ts:381, 444` | every 3.2 s (p2 2), tell 1.0 (p2 .75, × 1.12) | skid 1.3 | lane 2.8 / 11 / 8 / reach 1.8 | 34 | ✘ → ✔ | no |
| S34 | `strike.imperial-bull.rival` × 2 | `elites.ts:382` | bugle at dusk / night (`bugleHour`) | skid 1.4 | lane 2.4 / 9.5 / 6 / reach 1.7 | 18 | ✘ → ✔ | no |
| S35 | `strike.antler-king.sweep` | `antlerKing.ts:77–78, 376, 386` | d < 7.1; dur .9 | sweep cd | arc near 4 m ±1.31 **or** far 7.1 m aimed −.26 ±.52 | 24 | ✘ → ✔ | no |
| S36 | `strike.antler-king.stomp` | `antlerKing.ts:80, 377, 423, 449` | dur 1.0 | stomp cd | ring, half width .9, jump dodges (`ringCatches`) | 20 | ✘ → ✘ | no |
| S37 | `strike.antler-king.charge` | `antlerKing.ts:172, 424` | brace 1.2 s, tell 1.1 | skid 1.6 | lane 5.2 / 13 / 10 / reach 2.0 | 32 | ✘ → ✔ | no |
| S38 | `strike.thrall.charge` | `antlerKing.ts:173, 479–483` | d < 11 at rate .9 /s (`ai` rng), tell .7 | skid 1.2 | lane 2.4 / 9 / 5 / reach 1.7 | 14 | ✘ → ✔ | no |
| S39 | `strike.antler-king.lantern` | `antlerKing.ts:536–539` | fallen lantern fire | — | zone, 9 per .8 s bite (`burnTick`) | 9 | ✘ → ✘ | no |
| S40 | the Ghost Stag | `pinehollow/elites.ts:222` | no attack: fades (cd 4.5, p2 2.4, `combatMath.ts` `fadeCooldown`), reappears 14–18 m behind | — | — | — | — | — |

`test/ai/strike-table.test.ts` (before S2.3): one row per strike above, asserting every number against the constants
(imported), and — for S1–S11, S19, S29–S39 — driving the old code and the StrikeSpec runner through the same seeded
scenario (a fake player at a fixed distance, the fixed step) and asserting the same hit frame ± one brain tick and the
same damage.

### 5.4 Elites and bosses → rows

**Bosses** (`class X extends BossBrain`, each in its shard; `BossDef` rows keep today's text and numbers):

| Boss | Class / file today | Phases (hp fraction: caption) | Arena / intro | Damage rule (R7) | Reward |
|---|---|---|---|---|---|
| The Golden King (Kurgan) | `GoldenKingFight`, `kurganBoss.ts:75, 668` | 1: — · 0.6: "PHASE II" The Kurgan Wakes (two kurgan-balbal adds) · 0.3: "PHASE III" The Gold Burns | the dungeon chamber; intro 4.2 s (short 1.4); headdress 200 hp; beam to king 50 | 0 while shielded / to coffin / in coffin / rising; head × 1 (× 1.25 stunned or kneeling); melee (< 3.8 m) and body rules `kurganBoss.ts:343–360` | the Golden Bow (`replace`, §1.5) |
| The Storm Titan | `StormTitanFight`, `stormTitan.ts:341, 1004` | 1: — · 0.6: "PHASE II · THE THREE WINDS" · 0.3: "PHASE III · THE GRASS FIRE" | arena r 68 round the cairn; intro 3.6 (1.3); heart 2600; riders 250 (chip .08) | riders: melee (< 5 × scale) × 3 when `state.open` else × 1, ranged × .5 (`stormTitan.ts:672–676`); heart: a full-draw arrow (≥ 43) × 2.5 (`:94`) | Naizagai (`replace`) |
| The Antler King | `AntlerKingFight`, `antlerKing.ts:137, 636` | 1: "I · THE WARDEN" · 0.6: "II · LANTERNS FALL" · 0.3: "III · THE LAST LIGHT" (`combatMath.ts:13`) | clearing r 22 in, wall 27.5 (soft push `wallPush`), fog 31 | .01 invulnerable / dormant; ribs × 3 when open > .5 else × .6; elsewhere × .25 (`antlerKing.ts:247–252`) | the Warden's longbow + the `warden` finish |
| The Drowned Captain | `captain.ts:237–312`, `game/quest/Finale.ts` (bar) | 1: > .66 · 2: .66–.33 (sinks every 7 s) · 3: < .33 (sinks every 5 s, second cut) (`captain.ts:235`) | the shrine pool, arena 22, woken by `used:altar` | none (hits in full; hit-cap exempt) | the captain's hat (`effect.captain-hat`), 25 coins, `dead:captain` |

The goal stack for one-off beats (01 §19): the Golden King's shield / coffin / rising cycle and the Titan's rider
waves are goal scripts on their `BossBrain`, run in the order the code runs them today; nothing else changes.

**Elites** (one `EliteBrain` base = Nalati `Base` + Pine `PineElite` merged; `EliteDef` fields unchanged, `Elite.ts:31–50`;
phase 2 at 50 % with a 1 s invulnerable beat, `Elite.ts:24`; store `ws.elites.v1` becomes per shard: plan §7 item 6):

| Elite | Shard | Species / variant | aware / engage / leash (m) | rule | signature · phase 2 | Damage rule | Drop |
|---|---|---|---|---|---|---|---|
| Aqbars the Pale | Nalati | leopard `aqbars` 700 | 60 / 25 / 90 | always | POUNCE · ENRAGED | leap × 2; open: head × 1.2; p2 perched × .25 (`elites.ts:198–202`) | skin irbis-sabre |
| Kokbori | Nalati | kokbori 650 | 80 / 50 / 120 | dusk | PACK HOWL · THE PACK FALLS BACK | ranged from hidden (crouched, grass > .6) × 2 (`:329–335`) | skin sky-wolf-bow |
| Qyran the Storm-Wing | Nalati | eagle `qyran` 600 | 110 / 75 / 150 | storm | STOOP · INTO THE STORM | grounded: body × 2.5, head × 1 (`:437–440`) | skin storm-wing-arrows |
| Qara Batyr the Unburied | Nalati | ghost-rider `captain` 800 | 90 / 60 / 150 | night (after 5 riders) | DEATH CHARGE · THE DEAD RIDE | open + melee × 3 (`:588`); the rider rule × 1.5 for blades near the rider (`ghostRider.ts:125–128`) | skin night-rider-mount |
| Argymaq the Unbroken | Nalati | argymaq `stallion` 750, `once` | 80 / 40 / 100 | always | TRAMPLE · HE RUNS | `horseDamageMul` (`Herd.ts:523–529`) | the horse |
| Old Ironhide | Pine | boar `ironhide` | 55 / 32 / 85 | always | GORE CHARGE · BOTH TUSKS NOW | variant `damageTaken` .6 | finish ironhide + tusk |
| The Ghost Stag | Pine | deer `ghost` | 70 / 40 / 110 | always | FADE · NOW YOU DON'T | — | finish ghost-stag + antler |
| Old Blackpaw | Pine | bear `black-old` | 30 / 22 / 60 | always | ROAR · WOKEN UP PROPERLY | — | finish blackpaw + claw |
| The Imperial Bull | Pine | elk `imperial` | 75 / 45 / 110 | always | BUGLE · FULL VOLUME | variant `damageTaken` .8 | finish imperial + crown |

Every elite respawns after `respawnMin` 20 min of play (`Elite.ts:29`). Pine's rolled-elite swap
(`swapRolledElites`, `pinehollow/elites.ts:98–112`) becomes a `when: ['not.elite-variant']` filter on Pine's spawn
tables. Nalati's **balbals** (dusk wake, `balbalWarriors.ts`, ring 9) and **ghost riders** (night lines,
`ghostRiders.ts`) are spawn tables with a `when` on the day cycle; **night thralls** (`quest/nightThralls.ts`, max 3 on
phone / 4 otherwise) are Pine's night spawn table.

**Species damage rules** (R7, answerers registered by each brain for its own actors): crab front × .5
(`crab.ts:284–288`); balbal: half-buried (< .6 risen) × .25, ranged (> 4.2 m) × .5, spear on a crack × 2.5, other
melee × 1.5, all × 1.25 open (`balbal.ts:436–452`, reads the request's `weapon.spear` tag instead of
`balbalCombat.melee`); ghost rider × 1.5 for a blade within 4 m of the rider; owned horses never below 10 % and the
stallion never below 20 % (`Herd.ts:523–529`).

### 5.5 The aggression director (engine, decision 18)

| Shard | `level.fight.attackers` | E297 behaviours (circle / back-off, boars that stalk, WindupWarn) | src |
|---|---|---|---|
| Driftwood | 2 | on: ring boar 6.5 / bear 7.5 (default 6.5), back-off past 1.0 m for ≤ 2.2 s, cd after a hit 3.4 / a miss 2.0, break off below 25 % hp at 50 %, circle 1.7 m/s, back-off 4.2 m/s, face within .6 rad before a charge, clearance .68 m, hold rings (crab 3.6, monkey 3.4, sailor 3.0, captain 3.4) | `driftwood-isle.ts:251`, `fightRules.ts:67–109`, `AnimalManager.ts:225–231` |
| Pine, Nalati, Nine Dragon | omitted = `Infinity` | off (today's fights) | — |
| Nalati wolves | — | the pack's own policy: 1 token (2 when you ride and there is no prey), +1 while bold | `Pack.ts:268–275` |

The director is on only when `attackers` is finite, which reproduces `this.rules !== null` (`AnimalManager.ts:441,
599, 1045–1046`). Decision 18: today's numbers, no new shard gets a cap.

### 5.6 Spawn and loot tables (`WeightedTable`, 01 §19)

| Table | Rows (item · weight · count / when) | src |
|---|---|---|
| `spawn.driftwood.fauna` | fixed anchors: boar × 4 at (66, −132), × 3 at (−140, −30), × 4 at (30, 150), variants `ISLAND_BOARS`; bear `brown` × 1 at (56, −84); bear `black` / `black-blaze` × 1 at (−122, −100) | `driftwood-isle.ts:230–237` |
| `spawn.driftwood.enemies` | crabs: per site 3–5 (first `big`, rest `small`); the practice crab (back after 45 s when you are 30 m off); monkeys: ≤ 3 troops of 3–4 on palm groves ≥ 60 m from the spawn and 30 m from the wreck; the drowned sailor(s) | `Enemies.ts:56, 153–240` |
| `spawn.pine.fauna` | 56 m grid, jitter 15, margin 25, ring 20, seed 1337: empty 10 · deer 36 [3, 4] open, trail 10–25 · boar 32 [2, 3] canopy, trail 12–40 · elk 18 [2, 4] open, trail 15–40 (× 1.8 at 15–40); the Den: bear × 2 (black, black-blaze, black-old), bear × 1 (brown, brown-old); `when: not.elite-variant` | `pine-hollow.ts:274–296` |
| `spawn.pine.night` | thralls: roamers + the millrace three (`RACE`), max 3 phone / 4 | `nightThralls.ts:44–60` |
| `spawn.nalati.*` | wolf packs, horse herds, sheep flocks (`Wildlife.ts`), balbals at dusk, ghost-rider lines at night (spacing 11, respawn 60 s) | `Wildlife.ts`, `balbalWarriors.ts`, `ghostRiders.ts:65–66` |
| species variant rolls | each species' `variants[].weight` (e.g. boar 49 / 26 / 10 / 8 / 3 / 1) | species files |
| `loot.driftwood.coins` | crab 1, monkey 1, boar 2, sailor 5, bear 10, captain 25; ≤ 12 coin meshes a burst | `coins.ts:10–31` |
| `loot.driftwood.trophies` | brown bear → bear-claw; any boar → boar-tusk; captain → captain-hat; each only while not owned | `keepsakes.ts:49–66` |
| `loot.<shard>.harvest` | fixed yields (`mode: 'each'` with `count`, 01 §19; 13-lead-resolutions 09#9): deer [venison, deer-hide (+ antlers: stag / ghost)], boar [meat, hide (+ tusk unless sow)], elk [meat, hide (+ antlers: bull / imperial)], bear [pelt, claw], crab [meat, claw (+ shell: big)], monkey [coconut, fur / silver-fur (elder)]; Pine keeps only its 7 kinds; Nalati and Nine Dragon none | `Inventory.ts:64–86` |
| elite / boss drops | the skins and rewards in §5.4 | `elites.ts:72–100`, `pinehollow/elites.ts:62–92` |

### 5.7 Tick classes (01 §12)

**Driftwood's self-thinking species (crab, monkey, sailor, the Drowned Captain), R1-32.** Their strike checks sit in
their `think` callback, sampled at the 10 Hz brain tick (`AnimalManager.ts:686–699, 777–782`, `captain.ts:275–285`).
- **Until S4.2**, they stay on that callback, unchanged; S2.6's switch covers only the creatures already on the runtime.
- **At S4.2** they join the runtime, and their strike phases move to the body clock (decision 85). That can shift a
  hit by up to one brain tick (≤ 100 ms).
- **Parity at S4.2** is identical **except** those strike frames. A seeded before / after trace (the first and second
  cuts, rise and sink, the phase transitions, damage, the kill) is the boarded item at M4, with a clip. "His fight
  unchanged" means rules, moves, phases and damage; the timing shift is the one boarded difference.

| System | Today | Class | During S2.3 (identical) | From S2.6 (decision 85, creatures board) |
|---|---|---|---|---|
| creature brains (herd, species `think`, elite brains) | 10 Hz for every animal at any distance (`AnimalManager.ts:686–699`) | `ai` | shard tier override `ai: { bands: [{ upTo: ∞, brainHz: 10, body: 'frame' }] }` | decision 85's bands: near 0–60 m brain 20 Hz + body every frame; mid 60–160 m brain 10 Hz + body every 2nd frame; far paused; interrupts; pinned bosses / elites / quest actors |
| strike runner (contact, active windows) | per frame for charges (`:716`), 10 Hz for `think` strikes | fixed step (60 Hz) | yes for S8 (as today); `think` strikes sampled at the brain tick (as today) | every strike on the body clock (01 §12): fixes the up-to-100 ms telegraph / hit drift |
| group brains (pack, herd, flock) | 10 Hz | `ai` | as above | as above |
| engaged elites and bosses | every frame (`Elite.ts` tick, `Boss` update) | `always` | same | same (never paused while engaged or in an arena) |
| creature animation | every frame, LOD at 140 m, far batch | `fx` (visual only) | same | same |
| Marmots, ambient birds | every frame | `fx` | same | 30 Hz near, paused from 120 m |

A brain's timers use the tick's real `dt`, never the literal `0.1` (`AnimalManager.ts:698`).

### 5.8 AI tests (node, fake `Game`)

`test/ai/strike-table.test.ts` (§5.3), `test/ai/can-reach.test.ts` (B4), `test/ai/director.test.ts` (2 tokens on
Driftwood, unlimited elsewhere, the pack's policy; extends `fight-rules.test.ts`), `test/ai/hfsm.test.ts` (each
brain's state sequence for a scripted approach, identical to today's), `test/ai/boss-phases.test.ts` (each boss
enters its phases at the listed fractions; `death.checkpoint` returns true inside the arena),
`test/ai/spawn-tables.test.ts` (seeded: the same animals at the same spots as today's `layoutFauna` and `Enemies`),
`test/ai/tick-rates.test.ts` (S2.6: rates by distance).

## 6. Migration order (combat + AI inside S1–S4)

**Inside S1 (R1-23):** S1.2 (Equipment / Weapon + the Melee family) and S1.3 (the pipeline, cues, the effects core)
land **before** S1.4 (the Tool contract and the Fei Zhua, which uses them). 05 §0 follows this order.

Every step: harness green → pathspec commit → `scripts/push-main.sh` (plan §3). A red step is reverted.

| Step | Row | What moves | Done when |
|---|---|---|---|
| 1 | F5 | Write §1.8, §3.6, §5.3 / §5.8 tests against today's code; extract the flight steps as pure functions (`Projectiles`, `Crossbow`, `Spear`) in one mechanical commit | tests green on today's code |
| 2 | S1.2a | `Equipment`, `Weapon`, `Tool`, `EquipmentService` replace `Weapon.ts` / `Weapons.ts` / `BaseWeapon` on every shard; `WeaponUi` rows replace the 12 id-branch sites (§1.6) | `equipment.test.ts`, harness identical on 4 shards |
| 3 | S1.3a | `combat.hit` + `DamageRequest` + player `health` in the engine; the 5 hurt blocks, regen and death check leave `main.ts`; R0, R0b, R1, R2, R8; each source's base formula as today (§2.2, R1-31; no R6, R2-10); B5 (seeded rolls) | `damage-pipeline` + `hurt-paths` green; harness identical |
| 4 | S1.2b | Melee family + `SWORD_WOOD`, `SWORD_IRON`, `JIAN` (damage 12 field); `Sabre`, `Spear` (+ `Thrown`/`JAVELIN`) subclasses; **B1** fixed through the pipeline; Naizagai's crescent routed through `combat.hit` → **B2** | `melee-moves`, `weapon-profiles` (melee), B1 / B2 tests |
| 5 | S1.3b | Effects core: E1–E14, the source multipliers (sneak, broadhead, golden: `SourceMulDef` rows, §2.2) and R7; cues `cue.*` from every weapon (§4.1); hit-stop on the weapon rows | `effects.test.ts` (each row's number), `keepsakes.test.ts` unchanged |
| 6 | S1.4 | `FeiZhua extends Tool`, the `grapple` input context + LOCK / JUMP relabels; the `traversal` hook deleted | harness grapple pose identical; ND playground boots |
| M1 | — | weapons board (§7) | Jake's go |
| 7 | S2.2 | Bow family (`BOW` serves Nalati's bow too; `LONGBOW` as a row; ~450 Longbow lines deleted), Crossbow family (+ `AmmoRow`s), Firearm family (`AR15` row, `LeverRifle extends Firearm`); projectile, ADS, brass blocks | trajectory snapshots unchanged, `weapon-profiles` (ranged), `hitscan-damage` |
| 8 | S2.3 | AI runtime: HFSM, `StrikeRunner`, director, `BossBrain` + the Antler King, one `EliteBrain` (Pine's four), night thralls, spawn / loot tables; kit species `boar`, `bear` (+ Driftwood / Pine child rows); the horse moves to Nalati's folder in S3.3; **B4** | strike table, can-reach, director, hfsm, boss-phases, spawn-tables |
| 9 | S2.5 | Starter effects in `#kit/effects/` + the Debug row; Blackpaw's stun on `effect.stun` | `effects.test.ts` starter rows |
| 10 | S2.6 | Tick classes: decision 85's bands replace the 10 Hz override; strikes move to the body clock; interrupts on | `tick-rates.test.ts` |
| M2 | — | creatures board (§7), ranged clips on the weapons board | Jake's go |
| 11 | S3.3 | `GoldenBow extends Bow`, `Naizagai extends Sabre` via `replace`; the sabre's mounted pass and the bow's mount data verified; stealth's sneak = E10 / the sneak source multiplier (§2.2) | `weapon-profiles` (Nalati), upgrade `replace` test |
| 12 | S3.4 | Golden King and Storm Titan on `BossBrain` (**B3**), Nalati's five elites on `EliteBrain`, wolves' `GroupBrain`, balbals, ghost riders, herds, flock | boss-phases, strike table S10–S28 |
| M3 | — | Nalati board items (§7) | Jake's go |
| 13 | S4.2 | crab, monkey, sailor on `StrikeSpec`; the Captain on `BossBrain` + `EncounterService.boss` (bar, arena, phases; the fight unchanged); coins / trophies on the loot tables | strike table S1–S7, `loot.test.ts` |
| M4 | — | — (no combat board item expected) | Jake's go |

## 7. The boards (combat and creature items; iPhone portrait, clips for motion)

| Board | Item | Exact contents |
|---|---|---|
| Weapons (M1) | B1 | Nalati, a boar 2.5 m behind a yurt wall: 3 before / after clips (thrust, brace against a charge, couched lance at a gallop); before = damage floats, after = none |
| Weapons (M1) | B2 | Nalati, Naizagai at a gallop, a wolf behind a crag 10 m out: before = the crescent's 40 lands, after = it stops at the rock |
| Weapons (M1) | parity proof | a one-line table: every row of §1.4 "identical" (the `weapon-profiles` test output) and the harness's swing + shot on 4 shards; no clip unless a family could not match a weapon (none expected) |
| Weapons (M2) | ranged | the trajectory-snapshot diff (empty) and one clip each of the Longbow, Crossbow (3 bolt kinds), lever and AR-15 before / after, side by side |
| Creatures (M2) | B4 | Pine: a brown bear charging at a cabin wall with you inside (before: hit, after: no hit); Old Ironhide's lane through a fence; the Antler King's sweep through the fallen log |
| Creatures (M2) | tick rates | a herd at 40 m, 100 m and 200 m, before (10 Hz) / after (near 20 Hz, mid 10 Hz, far paused) — a clip each; a strike telegraph at 40 m before / after the body-clock move; plus the frame-time delta from the harness |
| Creatures (M2) | starter effects | 5 clips (the Debug "Apply effect" row) with the proposed numbers of §2.4 in a table for Jake to accept or retune |
| Creatures (M3) | B3 | the test output only: Nalati sets no hit cap and has no tusk, so the Titan fix changes nothing a player sees today (it matters for a shard that sets a cap) |
| Creatures (M3) | strike sampling | one clip of the Golden King's cut and a balbal slam before / after moving strikes to the fixed step (hits land up to one brain tick, ≤ 100 ms, earlier) |

## 8. Questions for the lead

Every question is answered in [13-lead-resolutions.md](13-lead-resolutions.md) (09 table); the body above follows each
answer.

| # | Question | Resolution |
|---|---|---|
| Q1 | 01 §19's `StrikeSpec.shape` was a bare string with one `range` | **Resolved → 13-lead-resolutions 09#1:** `StrikeShape` = arc (radius, halfAngle) / lane (length, width) / ring (inner, outer) / wedge (length, halfAngle) / point (radius); §5.3 maps the table onto it. **Also resolved → 13 C4 / C5:** the strike's motion numbers (lane speed, ring speed, point delay …) have no `StrikeSpec` field yet |
| Q2 | 01 §18's `EffectDef` can't express hit-dependent rules | **Resolved → 13-lead-resolutions 09#2:** `DamageRuleDef` (`when` tags + `op` cap / add / mul / negate / override + `order`), §2.2. **Also resolved → 13 C4 / C5, R1-31, R2-10:** R0b, R1, R7 need more than a row and are plain answerers; R3–R5 are source multipliers and R6 is gone |
| Q3 | Whetstones, the bear claw and the Golden draw modify a weapon | **Resolved → 13-lead-resolutions 09#3:** weapons carry their own `AttributeSet`; `EffectService` targets `Actor \| Equipment` (§2.1) |
| Q4 | Today every brain runs at 10 Hz | **Resolved → 13-lead-resolutions 09#4** (Jake, decision 85): 10 Hz through S2.5 (identical); at S2.6 the 3 bands (20 / 10 / paused) + interrupts + pinned bosses / elites / quest actors + strikes on the body clock, on the creatures board (§5.7) |
| Q5 | The horse: kit or Nalati? | **Resolved → 13-lead-resolutions 09#5:** Nalati (§5.2) |
| Q6 | A fall does not reset the regen delay | **Resolved → 13-lead-resolutions 09#6:** kept as today; `env.fall` isn't tagged `interruptsRegen` (§3) |
| Q7 | The hoverboard fits the Tool contract | **Resolved → 13-lead-resolutions 09#7:** a kit Tool in `#kit/tools/`, moved in X1; its movement mode (`board` context, motor) stays engine (§1.7, 10 X1) |
| Q8 | The big crab's `chargeDamage 14` is dead data | **Resolved → 13-lead-resolutions 09#8** (Jake, decision 86): **14**, on the creatures board (§5.3) |
| Q9 | `WeightedTable` has no "every row once" mode | **Resolved → 13-lead-resolutions 09#9:** `mode: 'weighted' \| 'each'` + `count` (§5.6) |
| Q10 | Pine's finishes and Nalati's skins have no numbers | **Resolved → 13-lead-resolutions 09#10:** cosmetic `EffectDef` rows with no modifiers, tagged `cosmetic` (E12, E13) |
| Q11 | `DamageRequest` has more fields here than in 01 | **Resolved → 13-lead-resolutions 09#11:** 01 takes the superset (§3.1 uses 01's names). **Also resolved → 13 C4 / C5, R2-14:** `from`, `distance`, `scale`, `cause`, `toast` are in 01 §18's type; `cause` is the one `DeathCause` (§3.1) |
| Q12 | The Spear's 5 javelins "with the camp upgrade" are never granted | **Resolved → 13-lead-resolutions 09#12** (Jake, decision 87): **keep 3**; the unreachable promise is removed |
