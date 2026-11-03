# Mini plan: KITCHEN-SINK v2 enemies, elites and the Crate Titan (EB)

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md) §2 (19d–19g). Numbers (HP, hit, attributes, XP) are the
[levels-combat plan](levels-combat-mini-plan.md)'s §3; rewards the [loot plan](loot-economy-mini-plan.md)'s. Looks:
E1–E14 of `art/showcase-template/round-4-v2-layout/`; tiers: `round-6-enemy-tiers/`. Nothing is built until "build it".

## 1. Decisions (Jake, 2026-11-02)

- **Ladder: common → rare variant → elite → boss.** No "mini-bosses". **Six elites** on the existing elite host
  (`game/eliteSystem.ts`, `Elite.ts`): three band gates (Big Pallet L6, the Vault Warden L12, Foreman Unit 7 L18) and
  **three night elites** (night only, low, mid and high bands; designed in §4).
- **Rare variants** spawn at random among the commons: a shared rarity row (uncommon / rare: new look, +1 / +2
  levels, more Scrip, a trophy), generalised from Pine's coat rarity.
- **Night shift:** each band's robot swaps to a tougher variant at night (+1 level).
- Commons respawn ~90 s per pack. No mid-fight heals (no patch kits). **Grey kills pay nothing** (XP and Scrip).
- Currency **Scrip**; the legendary is the **Titan Cleaver** sword (the loot plan's "Crate Cleaver" renamed).

## 2. The six band robots

One silhouette per band, one telegraph language (red ground decal plus a glowing part), every windup ≥ **0.6 s**
(18 frames at the 30 fps Low Power cap). Damage-over-time never rolls (LV).

| Robot | Role | Telegraphs → attacks | Leans | Brain (existing rows) |
|---|---|---|---|---|
| **Crate Mite** L1–3 | swarm rusher; the tutorial | crouch + eye flash 0.6 s → hop-bite lunge 3 m; packs surround | AGI STR VIT | `pursue` + a group brain |
| **Pallet Jack** L4–6 | charger | tines lift, red lane 0.9 s → charge with knockback; a miss into cover stuns it 1.5 s · tine toss 0.7 s | STR TGH POI | `ram-grazer` charge |
| **Plumb Drone** L7–9 | flyer, kites at 12–18 m, 3–5 m up | plumb-line laser 0.7 s → 3-nail burst (each rolls) · under 30 % a dive ram (0.8 s whine) | DEX PRE AGI | `burst-flyer`, `flight` |
| **Welder Unit** L10–12 | area denial | torch blue → orange 0.8 s, cone decal → 6 m flame cone (energy), slag puddles (6 s) · back tank ×1.5 | RES VIT STR | `guardian` |
| **Riveter** L13–15 | shield tank; stealth yard patrol | plate up: front ×0.2 · slam ring 1.0 s → shockwave (jump) · rivet gun, laser 0.7 s; a heavy or parry knocks the plate aside 2 s | TGH POI | `guardian-patterns`, lamp cones (W10) |
| **Arc Sentry** L16–18 | duellist that parries | lance crackle 0.6 s → 3-hit combo · lunge 0.8 s · **parries** by PRE (LV9), riposte 0.5 s; bow and rifle bypass it | PRE AGI STR | `skirmisher` + AS parry |

**Packs.** An anchor per pack in its band strip, 30 m leash, 18 m notice. A cleared pack respawns **90 s** after its
last kill (LV10), never while you are within 40 m of its anchor (no pop-in in view).

| Band | Packs × size | Live | Notes |
|---|---|---|---|
| 1 Mite | 7 × 3–5 | ~28 | some sleep as plain crates until you're within 6 m |
| 2 Jack | 6 × 2–3 | ~15 | lanes between stacks so charges read |
| 3 Drone | 6 × 3 | ~18 | high perches; teaches bow and rifle |
| 4 Welder | 5 × 2 + 1 Mite | ~15 | slag stays 6 s |
| 5 Riveter | 5 × 2–3 + 4 patrols | ~16 | flank or break the plate |
| 6 Sentry | 5 × 2 | ~10 | open duelling ground |

Phone cap: **≤ 12 robots awake** (in combat or within 40 m); the rest hold a frozen pose or are culled past 150 m.

**Night shift (+1 level, XP and Scrip ×1.25).** After dusk each pack swaps at its next respawn. Same mesh: amber lamp
eyes, hi-vis chevrons, an unlit additive headlamp cone (no real light). Storm hour counts as night.

**Rare variants.** Each spawn rolls on its rarity row (Pine's species `variants` — `weight`, `rarity`, `hp`, `mods`
— plus level, reward, look): **uncommon 8 %** (+1 level, Scrip ×1.5, steel trim), **rare 2 %** (+2, Scrip ×2.5, a
trophy the first time; gold stencils, e.g. the Lamp-Eye Riveter). A palette and one extra part; day and night, levels
add. No name, lair or bar: an orange nameplate tag.

## 3. Look and model pipeline

Orange and grey chamfered blocks, black stencils ("1x1", "MK II"), cyan eyes by day, amber at night; vertex colour
with baked AO; one shared 512² stencil atlas.

| Robot | Silhouette | Size | Tris LOD0 / phone / LOD1 |
|---|---|---|---|
| Crate Mite | 1×1 crate on four stubby legs, one eye | 0.6 m | 500 / 400 / 150 |
| Pallet Jack | low, wide, forklift tines, 4 hydraulic legs | 1.4 m | 1,200 / 900 / 300 |
| Plumb Drone | quad-rotor box, nail gun, plumb-bob tail | 0.9 m | 900 / 700 / 250 |
| Welder Unit | stocky biped, torch arm, back tank | 2.0 m | 2,200 / 1,600 / 500 |
| Riveter | broad biped, riot plate, rivet gun | 2.2 m | 2,200 / 1,600 / 500 |
| Arc Sentry | tall thin biped, shock lance | 2.3 m | 1,800 / 1,400 / 450 |

**A Blender script per robot** (mockup-to-model §3): chamfers, AO into `COLOR_0.a`, rigid joints (each part 100 % on
one bone), baked clips (idle, move, telegraph, attacks, hit, death: it breaks into blocks and drops its part).
Scripts in `src/shards/showcase-template/blender/` (as Template 2's) on `scripts/blender/lib/devmap_robot.py`; GLBs
committed. **No TRELLIS.2 / Hunyuan3D-2**: hard blocks come back rounded, plates as sheets; code models would be
shard TS. Each: reference sheet, detail list, versus board, spin clip. **Budget:** every robot, palette, elite and the Titan ≤ **25 MB
GPU**, ≤ 3 MB download.

## 4. Elites and the boss

The elite host as is: a lair; aware → engaged → leash (walk home, heal to full); **phase 2 at 50 %** after a 1 s
invulnerable beat; the NAMED ELITE banner; a rule (`always`, `dusk`, `night`, `storm`); a play-time respawn; a drop;
a sting. Moves are elite scripts; phases change attributes (LV5). Soft gates. Rewards: the loot plan's rows.

**Big Pallet, L6** (band 2 pit, r 14 m, crate stacks, two pillars; ~3.2 m; E7). `always`, respawn 5 min.
P1: the charge (1.1 s lane); the **crate throw** (red ring at your feet 1.2 s; it lands as breakable cover); a charge
into a pillar stuns it 3 s, back hydraulics ×1.5. P2: two Pallet Jacks once; double charges; a 180° tine sweep (0.8 s).

**The Vault Warden, L12** (Training Vault room 4, r 12 m, sealed by DG1; a 3 m walking vault door, clamp arms, cyan
core; E9). `always`; the room is the leash and a death restarts it (DG2). P1: front armoured (TGH 30); **clamp slam**
(two rings, 1.0 s), after which the door swings open 2 s, core exposed ×1.5. P2 "Lockdown": floor tiles electrify in a
sweep (glow 1.0 s); a core beam sweeps a line (0.8 s); two Mites from wall hatches every 25 s. Then the vault chest
and SHRINE COMPLETE (DG3).

**Foreman Unit 7, L18** (the gauntlet's wave 5, ⌀ 84 m; hard hat, hi-vis, clipboard, rivet gun; E12). P1: rivet
bursts (laser 0.7 s; DEX, PRE 40); **the whistle**, a 1.5 s wind-up calling three buffed Mites (max 6); 30 damage
during it cancels the call. P2 "Overtime": a Pallet Jack and an Arc Sentry once; caution-tape zones (slowed 40 %);
under 25 % a 360° rivet spray with one gap (1.2 s tell).

**Night elites** (rule `night`, so storm hour too; respawn at the next dusk; each drops a weapon finish and a trophy):

| Elite | Band, L | Look | P1 → P2 |
|---|---|---|---|
| **Sir Nibbles** | 1, L4 | a 2 m Crate Mite in a cardboard crown | hides as a crate stack, pounces (0.8 s rattle) → splits off four Mites and rolls (1.0 s lane) |
| **Hot Mess** | 4, L13 | a Welder with two torches, leaking glowing slag | twin flame cones (0.8 s) → a slag trail that lights the dark, a 360° flare (1.2 s ring) |
| **Riveting Rita** | 5, L16 | a Riveter with a lamp-plate and a nail-gun arm | lamp sweep (seen = rivet volley, 0.7 s laser) → plate charge, then a slam ring (1.0 s) |

**The Crate Titan, L20** (the boss, on W11's path; the amphitheatre r 28 m, a 39 m approach; ~9 m of 1×1 to 4×8
crates around a core; E13, E14). 9,230 HP; the core plate TGH 12, RES 10.
- P1 "Stacked" (100–66 %): fist **slam** (ring 1.2 s, then a shock ring to jump: arena `rings`), arm **sweep** (180°,
  0.9 s), **crate rain** on ringed spots (1.0 s: arena `pour`). Knees glow 2 s after a slam (×1.5).
- P2 "Unpacked" (66–33 %): sheds shoulder crates as four Mite adds; the chest core shows (arena `crown`: break it for
  a 4 s stagger); denser rain.
- P3 "Overflow" (< 33 %): faster; edge leap and three ground-pound rings; rolls a 4×8 block down a lane (1.0 s);
  rain piles shrink the cover. No enrage timer.
- Reward: the Titan Cleaver and the loot plan's row; victory crumble; the shard-complete card (W17).
- Model: Blender, ~12k tris LOD0, ~7k phone; each crate a rigid part; an **assemble** clip for the intro.

## 5. The Titan's cutscene intro

On the W12 timeline (IN-GAME-CUTSCENES IC1–IC4): a cutscene id in the boss row's `intro`, data only. At the arena
gate; world live (the real Titan); no hero on screen (D2); letterbox, HUD hidden.

| Shot | s | Camera | What happens |
|---|---|---|---|
| 1 | 0–2.5 | `pov` ease to the centre | a still 6 m crate pile; the boss cue's first hit |
| 2 | 2.5–5.5 | `rig`, low wide | the crates tremble and stack upward (assemble clip) |
| 3 | 5.5–8 | `rig`, push-in up the body | the head locks on; eyes ignite orange |
| 4 | 8–10.5 | `rig`, high wide from the stands | both fists slam; a dust ring; crates rain |
| 5 | 10.5–12 | cut to `pov` | THE CRATE TITAN · LEVEL 20 · THE LAST CONTRACT; phase 1 on the downbeat |

12 s once, 3 s (shot 5) on retries; **hold to skip** (`SKIP_HOLD` 0.6 s). Cut on the cue's onsets. Behind Developer
until Jake has seen a portrait clip (D3).

## 6. Engine and host needs

Covered: the elite host, W2–W4, W6, W10–W13, W16, W17, LE7, DG1–DG3, LV3, LV5, LV9, LV10. New for Wave 1 (each dropped if a W row covers it):

| Row | Need | h |
|---|---|---|
| EBW1 | Frontal-arc block on a creature (Riveter plate ×0.2, knocked aside by a heavy or parry) | 4 |
| EBW2 | Creature projectile strikes (nails, rivets, arc bolts) on W6's projectile rows, rolling the dice | 6 |
| EBW3 | Interruptible wind-up: damage in a window cancels an elite action (the whistle) | 3 |
| EBW4 | Variant look on one GLB (palette, emissive eyes, a part toggled) for night and rarity | 4 |
| EBW5 | No respawn in view (anchor distance) | 2 |
| EBW6 | The shared rarity row: species `variants` plus level, Scrip, trophy, look, on any creature | 6 |
| EBW7 | An elite spawned by a wave-director stage (the Foreman), not only from its lair | 3 |

## 7. Wave 2 rows

The model and fight part of parent K3, K4, K5 (the Warden) and K6. Opus for anything seen (G848).

| Row | What | Effort |
|---|---|---|
| EB1 | Reference sheets and detail lists: 6 robots, 6 elites, the Titan | 0.5 d |
| EB2 | `devmap_robot.py`: parts, stencils, AO, joints, clips, LOD and phone export | 1 d |
| EB3 | Six band robots: models, clips, LODs, boards, spin clips | 2 d |
| EB4 | Band rows: species, brains, strikes, decals, packs, anchors (with LS2, LS4) | 1 d |
| EB5 | Night shift and rare variants: palettes, parts, rarity rows | 0.5 d |
| EB6 | Band-gate elites: Big Pallet, the Vault Warden (with K5), Foreman Unit 7 (wave 5) | 1.5 d |
| EB7 | Night elites: Sir Nibbles, Hot Mess, Riveting Rita (with LW6) | 1 d |
| EB8 | The Crate Titan: model, assemble clip, arena, three phases | 1.5 d |
| EB9 | The Titan intro as cutscene data; a portrait clip for Jake | 0.5 d |
| EB10 | Tuning: contacts per kill, telegraphs at 30 fps, soft-gate feel (with K11) | 0.5 d |
| | **Total** | **~10 d** (parent K3 + K4 + K6: ~7 d) |

## 8. Open questions for Jake

1. **Storm hour brings out the night shift and night elites?** Recommended: yes (the S3 frame).
2. **Rare odds:** uncommon 8 %, rare 2 %? Recommended: yes, about one rare every 50 kills.
3. **The Titan's skip:** hold or tap? Recommended: hold 0.6 s (the engine's), plus a 3 s short intro on retries.
4. **Blender scripts for every robot, no TRELLIS.2 / Hunyuan3D-2?** Recommended: yes; image-to-3D rounds hard blocks.
5. **Night elite names** (Sir Nibbles, Hot Mess, Riveting Rita, from the loot plan's list)? Recommended: keep them.
