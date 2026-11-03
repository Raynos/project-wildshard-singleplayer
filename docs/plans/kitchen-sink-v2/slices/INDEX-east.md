# Kitchen Sink v2: the east slices, in order

The east half (combat only: six level bands, rare and night variants, six elites, the stealth yard, storm hour, the
Training Vault, the three-court gauntlet, the Crate Titan behind its portal) as **54 small vertical slices**, each run
by the slice rule in [README.md](README.md): the platform work it needs first, every other shard that uses what it
touched migrated and proved unchanged in the same slice, then the showcase piece as data + AssemblyScript, playable and
checked. Researched against the code on 2026-11-03 (HEAD `83fe4ad845`); every slice file names the files and lines.
Hours are estimates; a lane-day is about 8 h. The west is [INDEX-west.md](INDEX-west.md); the east starts after W12
(Jake's west play), except where a lane would otherwise idle (Q10).

## The slices

| Id | The piece | Platform work, just in time | Other shards migrated | Hours (eng / mig / shard) | Blockers (east · west) |
|---|---|---|---|---|---|
| [E0a](E0a-progression-rows.md) | (the rules) | `progression` section, `levelMath`, the flat-parity guard (LV1, LV2, LV12) | every product admits flat (19z) | **20** (14/4/2) | — · W0a |
| [E0b](E0b-hit-stage.md) | Calibration pen: clean, crit, glance, DEFLECT, DODGE | the stat stage at order 30, `outcome`, `damage.failed`, `combat` rng (LV3, LV4, LVF1/2/5/6) | parity only | **24** (18/2/4) | E0a · W3d (soft) |
| [E0c](E0c-actor-stats-regen.md) | A rolled character; robots with kind stats; leash reset | HP = VIT, attributes on actors, regen 5 s / 12 s (LV5) | health v1 snapshots kept | **18** (14/2/2) | E0a |
| [E0d](E0d-xp-levelup-death.md) | XP, level-up, death cost; the west pays nothing | experience host, `pays` zones (LV6, LV8) | — | **18** (14/2/2) | E0a, E0c |
| [E0e](E0e-hud-xp-levelup.md) | XP bar, LV chip, level-up moment, death line | engine meter / burst slots (HC1, HC2, HC7; E332) | every HUD DOM unchanged | **16** (14/1/1) | E0d |
| [E0f](E0f-hud-nameplates-numbers-character.md) | Nameplates, floating numbers, Character tab | providers on today's `Combat.ts` bars and floats; a Bag tab (HC3–HC5) | every shard's bars and floats | **24** (20/3/1) | E0b, E0c |
| [E0g](E0g-stagger-status-effects.md) | Stagger bar; burn, shock, blast | on-hit effects over the existing `EffectService` | Pine, Nalati (parity) | **22** (14/6/2) | E0b, E0f · W3b |
| [E0h](E0h-enemy-cap.md) | ≤ 12 awake, ≤ 16 posed | a count cap over the existing 60 / 160 m tick bands (EC1) | every shard (replays) | **18** (12/6/0) | — |
| [E0i](E0i-weapon-tiers-forge-upgrades.md) | Forge I–IV and the combat upgrades work | effect modifiers, weapon tiers, the live level gate (LV7, LE6) | Driftwood, Pine (effects off `ShardContext`) | **22** (12/6/4) | E0b, E0c · W2b, W3b, W3d |
| [E1a](E1a-robot-blender-pipeline.md) | A test robot | `scripts/blender/lib/robot.py` → exported skins (EB2) | templates' skins re-admitted | **18** (14/2/2) | — · W0a |
| [E1b](E1b-crate-mite-model.md) | The Crate Mite | none | — | **16** (0/0/16) | E1a |
| [E1c](E1c-band1-packs-respawn.md) | Band 1: 7 packs, leash, 90 s pack respawn | spawn levels, group respawn, sleep pose (LV10, EBW5) | Driftwood, Pine, Nalati (replays) | **30** (14/6/10) | E0c, E0d, E0h, E1b · W0b |
| [E1d](E1d-scrip-payouts.md) | Scrip from kills and chests | payout rows, cap modes, chest currency (LE2) | Driftwood (92 doubloons) | **18** (8/8/2) | E1c · W2a, W4a |
| [E1e](E1e-salvage-parts.md) | A Servo per kill | salvage rows; `HARVEST` deleted (LE3) | Driftwood, Pine | **22** (8/12/2) | E1c · W2a |
| [E1f](E1f-contract-board.md) | The kill-contract board | `quests/contracts` section, fixed mode, typed rewards (QC5, LE8) | Pine's lodge board | **32** (16/10/6) | E1c, E0d · W1b, W2b |
| [E1g](E1g-quest-counters-tier1.md) | Clock In, Spare Servos; grey "!" by level | kill / hold steps, the `level` atom (QC3, QC1) | quest shards (parity) | **22** (12/4/6) | E1c, E1e, E0d · W1b |
| [E1h](E1h-pine-questruntime-table-trader.md) | (cleanup) | — | Pine: table, trader, NPCs, readings out of `custom/questRuntime` (M2.1 I) | **18** (2/16/0) | E1f · W4a, W1a, W2b |
| [E1i](E1i-pine-questruntime-retired.md) | (cleanup) | — | Pine: chapters, lead, spawns; the section deleted (M2.1 II) | **20** (2/18/0) | E1h, E11a (soft) |
| [E2](E2-band2-pallet-jacks.md) | Band 2: Pallet Jacks, Survey the Yard | strike `onBlocked` stun, rear zone | Sky goat, Driftwood chargers | **28** (8/2/18) | E1c, E1a |
| [E3](E3-band3-plumb-drones.md) | Band 3: Plumb Drones, Drone Season | creature projectile strikes (EBW2) | Driftwood's monkey throw | **34** (14/2/18) | E1c, E0b · W3b |
| [E4](E4-band4-welder-units.md) | Band 4: Welder Units | energy strikes, world hazards, hit zones | Nalati arena fire (look) | **36** (14/4/18) | E1c, E0g |
| [E5a](E5a-band5-riveters.md) | Band 5: Riveters, Rivet Count | the guard arc (EBW1) | Signal's Matriarch shield (Q) | **30** (10/2/18) | E3, E4, E1c · W3d |
| [E5b](E5b-stealth-yard-keycard.md) | The stealth yard, Keycard | stealth cover and lamp-cone sources | Nalati's grass stealth | **34** (14/8/12) | E5a, E1g · W1b |
| [E6](E6-band6-arc-sentries.md) | Band 6: Arc Sentries | defender parry, AS reads (LS7, LV9) | — | **26** (8/0/18) | E0b, E0g, E3 · W3d |
| [E7a](E7a-rare-variants.md) | Uncommon 8 %, rare 2 % | one rarity row, variant looks (EBW6, EBW4) | Pine and Nalati coats (M4.1) | **28** (12/8/8) | E1a, E1c, E1d, E1e |
| [E7b](E7b-night-shift.md) | The night shift (+1, storm = night) | shift variants, one world-phase read (LV10) | Pine night thralls, Nalati nights (M4.2) | **24** (8/8/8) | E7a, E1c · W11a |
| [E8a](E8a-elite-host.md) | (the host) | typed drops, named stings, attribute phases, interruptible wind-ups (EBW3, EBW7) | Pine, Nalati, template elites | **22** (12/10/0) | E0c · W2b, W11b |
| [E8b](E8b-big-pallet.md) | Big Pallet, L6 | none | — | **20** (2/0/18) | E8a, E2, E1f |
| [E8c](E8c-night-elites.md) | Sir Nibbles, Hot Mess, Riveting Rita | none | — | **28** (2/0/26) | E8a, E7b, E4, E5a |
| [E8d](E8d-trophy-wall.md) | The trophy wall | `world/trophyWall` section (LE9) | Driftwood plaques, Pine mounts (two custom sections gone) | **20** (8/8/4) | E0i, E8b · W2a |
| [E8e](E8e-finishes-titles.md) | Finishes and titles | finish and title grants (M1.3, H059) | Nalati finishes, Pine | **18** (6/8/4) | E8a, E1f |
| [E9](E9-storm-hour-beacons.md) | Storm hour, four beacons, Lights Out | weather `holds` | Pine, Nalati (logs) | **20** (8/2/10) | E7b, E5b · W11a, W4a, W1b |
| [E10a](E10a-portal-interiors.md) | The Vault portal and entry hall | `world/interiors`, the interior host | Nalati's arena room lifecycle, Nine's portal | **30** (16/10/4) | E5b · W0e, W9a |
| [E10b](E10b-shrine-host.md) | A sealed test room, the shrine card | sealed rooms, room checkpoints, shrine card (DG1–DG4) | template; Driftwood sea cave (DG5, Q) | **36** (24/8/4) | E10a, E1c · W4a, W3a |
| [E10c](E10c-vault-rooms.md) | Vault rooms 1–3 | none | — | **20** (0/0/20) | E10b · W4a, W6a, W6c, W8a, W8b |
| [E10d](E10d-vault-warden.md) | The Vault Warden, L12 | none | — | **22** (2/0/20) | E10c, E8a, E5a, E4 |
| [E11a](E11a-director-out-of-plugin.md) | (the move) | director out of `game/plugin` (N2/N5) | Driftwood, Pine, Sky, Signal, Nine, template | **24** (8/16/0) | — |
| [E11b](E11b-wave-rows.md) | A wave test court | `group:` inputs, group spawns, stage elites | template example | **14** (10/2/2) | E11a, E10b, E8a |
| [E11c](E11c-gauntlet-courts-supervisor.md) | C1, C2, waves 1–4, Shift Supervisor | none | — | **30** (2/0/28) | E11b, E6, E5a, E8a · W6a |
| [E11d](E11d-foreman-wave5.md) | C3, Foreman Unit 7, the Titan road | none | — | **28** (4/0/24) | E11c, E4, E3 |
| [E12a](E12a-one-boss-path.md) | (the host) | one boss row set and host (W11, CS8) | Driftwood, Sky, Signal, template bosses | **30** (14/16/0) | E11a, E4, E5a, E8a |
| [E12b](E12b-phased-bosses.md) | (cleanup) | `plugin/bossPhase` deleted | Pine's King, Nalati's Golden King | **26** (4/22/0) | E12a |
| [E12c](E12c-storm-titan-arena.md) | (cleanup) | the arena fight on the host (H110) | Nalati's Storm Titan | **26** (4/22/0) | E12a, E10a, E4, E0g |
| [E12d](E12d-cutscene-timeline.md) | A test cutscene at the Titan gate | `engine/cinematic` timeline, rows, tracks (IC1, IC3, IC4) | template example | **28** (26/0/2) | Jake's go (Q1) |
| [E12e](E12e-five-intros-rehomed.md) | (cleanup) | — | five boss intros + Driftwood's finale (IC2, M5.6) | **18** (2/16/0) | E12d, E12a–c |
| [E12f](E12f-crate-titan-model.md) | The Crate Titan model | none | — | **24** (0/0/24) | E1a |
| [E12g](E12g-titan-arena-fight.md) | Titan gate, hidden arena, three phases | none | — | **28** (4/0/24) | E12a, E12c, E12f, E10a, E11d, E11b |
| [E12h](E12h-titan-intro-cleaver.md) | The 12 s intro, the Titan Cleaver, victory | none | — | **16** (2/0/14) | E12g, E12d, E8e |
| [E13](E13-quest-tiers-east-secrets.md) | All 12 quests, lines by level, east chests / Gold / vistas | dialogue node `when` | — | **28** (6/0/22) | the quest slices · W9b |
| [E14](E14-shard-complete-required.md) | The shard-complete card | `boss` trigger, backfill, the rule (W17) | Pine, Nalati, Sky, Signal, templates get cards | **32** (8/20/4) | E12h |
| [E15a](E15a-east-audio-hosts.md) | (stand-in cues) | layers by field, boss / elite scene fields, metal, combat cues (W19b/c/e/f) | Pine King layers, Nalati scene; metal everywhere (Q) | **16** (10/6/0) | E12a, E8a, E0d · W11b |
| [E15b](E15b-east-audio-content.md) | The east score, stings, ~65 SFX, ambience | none | — | **32** (2/0/30) | E15a |
| [E16](E16-balance-pass.md) | The east tuned | a headless duel runner | — | **24** (4/0/20) | E2–E12h |
| [E17](E17-east-finish.md) | Jake plays the east | heavy proofs, grid swap | grid neighbours (seams) | **24** (0/2/22) | all · W12 |
| | **East total** | | | **1,302 h** (486 / 310 / 506) | |

Roughly **560 h Opus** (every robot, elite and the Titan, the bands, the Vault, the courts, the arena, the HUD pieces,
the cutscene camera, captures and goldens) and **740 h Codex** (rows, hosts, the levels maths, migrations, saves,
replays, the balance runner).

## Parallelism: 5 Opus + 5 Codex lanes

Graphical work is Opus-only (G848); a slice with both kinds splits across one Opus and one Codex lane.

| Phase (≈ days) | Opus lanes | Codex lanes |
|---|---|---|
| **1** (days 1–5) | O1 E1a → E1b · O2 HUD boards (E0e, E0f) → E0b looks · O3 E12d (on Jake's go) · O4 calibration pen + band 1 ground · O5 E15b briefs and first music runs | C1 E0a → E0b · C2 E0c → E0d · C3 E11a · C4 E0h → E14 backfill (other shards' cards) · C5 E1f engine + Pine board |
| **2** (days 6–11) | O1 E1c look → E2 Jack · O2 E0e → E0f · O3 E12d → E12f Titan model · O4 E3 Drone · O5 E4 Welder | C1 E1c rows → E1d · C2 E1e → E1g · C3 E1h → E1i · C4 E0g → E0i · C5 E3 projectiles → E4 hazards / zones |
| **3** (days 12–18) | O1 E5a Riveter · O2 E8b Big Pallet · O3 E6 Sentry · O4 E5b yard look · O5 E7a / E7b palettes | C1 E8a · C2 E7a → E7b · C3 E5b law + Nalati · C4 E10a · C5 E12a |
| **4** (days 19–25) | O1 E10c → E10d · O2 E11c courts · O3 E8c night elites → E11d Foreman · O4 E9 beacons, E8d / E8e looks · O5 E15b SFX batches | C1 E10b · C2 E11b → E8d rows · C3 E12b · C4 E12c · C5 E15a → E8e |
| **5** (days 26–31) | O1 E12g · O2 E12e captures · O3 E12h · O4 E13 placing and lines · O5 E15b finish | C1 E14 rule on · C2 E13 rows · C3 E16 runner · C4 E17 checks · C5 fixes |
| **6** (days 32–34) | all: E17 proofs, looks, fixes; Jake's play | E17 checks, W21's east docs |

**Critical path:** E0a → E0b → E0d → E1c → E3 → E5a → E11c → E11d → E12g → E12h → E14 (rule) → E17, about 28–30 working
days with each band's model and rows split across an Opus and a Codex lane; E11a → E12a → E12c runs beside it and must
land before E12g. **About six and a half to seven weeks** at 5 + 5 with slack for review; the effort alone (1,302 h over
10 lanes) is about 16 working days, so the order sets the pace, as in the west.

Never run together: E0b, E0c and E0g (the pipeline and the parity test, in turn); E1d and E1e (`lootEconomy.ts`, saves);
E1h and E1i (Pine's custom section); E7b after E11a (Pine's night runs on the director); E10a and E12c (`arenaRoom.ts`);
E12a, E12b and E12c (one boss host, in order); E8a before E8e (elite drops); E0e, E0f, E10b and E14 send their E332
notices one at a time.

## What the research changed from the old rows

1. **Pine's questRuntime is not "mostly the board".** The board is 2.5 KB of the 29 KB `custom/questRuntime`; the
   biggest part is a 44-row interactables table (11.4 KB), then NPCs, readings, chapters and a guide. W1b Q5's reason
   for moving it east was wrong; M2.1 becomes two migration slices of its own (E1h, E1i) after the board (E1f).
2. **Half the HUD rows exist.** Enemy health bars (60 m, 6 on phones) and floating damage text (HEADSHOT, KILL, aim
   MISS) are already in `src/engine/ui/Combat.ts`; the pause menu is a tab registry. HC3 / HC4 / HC5 are providers on
   today's pieces (E0f), not new UI.
3. **Status effects exist.** `EffectService` runs timed effects with periodic `tickDamage`, and starter rows ship
   `effect.burn`, `stun`, `slow`, `poison`, `bleed`; W3b's "no burn outside one boss" was wrong. What's missing is a hit
   that applies one (E0g).
4. **The enemy cap is half built.** The `ai` tick rate already runs full AI within 60 m, half rate to 160 m and pauses
   beyond, poses thin out at 30 / 70 / 140 m and attack tokens cap biters; only a *count* is missing (E0h).
5. **A contract board host exists**, Pine-shaped, on the plugin context (`format/contracts.ts`,
   `game/quest/contractBoard*.ts`): QC5 is a fixed mode, typed rewards and a move, not a new host (E1f).
6. **Robots need no new client path.** No Blender creature with clips exists, but the client already plays exported
   skins (SF9c, `skinPlayback.ts`; the templates use it); Blender robots only emit the same rig row (E1a).
7. **Most robot behaviour is rows already**: charge (`ram-grazer`, Sky's goat), flyers (`burst-flyer`, Sky's wisp),
   darting (`skirmisher`, Driftwood's crab), throwing (`perch-hunter`, Driftwood's monkey), strike shapes incl. cones
   (`wedge`) and jumpable rings (`jumpDodges`), leash and walk home (`pursue`). New: a wall stun, creature projectile
   strikes, energy damage, hazards, a guard arc, defender parry.
8. **Five boss classes over one `BossBrain`**, one of them (`DirectorBossBrain`) inside the plugin director: the director
   move (E11a) must come before the boss path (E12a–E12c).
9. **Director stages already set weather** (an unused `{ weather }` action) and **beacons are an interactable kind**;
   what the gauntlet lacks is a group input ("wave 2 is dead", E11b).
10. **Only Driftwood and the template ship a completion card**, and its trigger has no `boss` kind (E14).
11. **IN-GAME-CUTSCENES is a draft that waits for Jake's word**; the Titan's intro needs its IC1–IC4 (E12d, Q1).
12. Smaller: walking home doesn't heal commons today (E0c); respawn is per kind, not per pack (E1c); *Patch Notes* has no
    source since patch kits were cut (E8e); the Vault's 10 m height can't hold its climb room (E10c).

## The questions that matter most (one recommendation each; all questions are in the slice files)

1. **Start IN-GAME-CUTSCENES IC1–IC4 inside the east** (E12d Q1) so the Titan gets real camera shots. *Recommended: yes*;
   the generated-video rows stay parked.
2. **Approve the levels system as platform with one user** (E0a Q1, G595). *Recommended: yes*, the rollout to other
   shards named as its future second user.
3. **Approve the shrine host with Driftwood's sea cave as its second user** (E10b Q1, +6 h). *Recommended: yes.*
4. **The enemy cap on every shard**, hostiles only, proved by replays (E0h Q1). *Recommended: yes* (your 19n).
5. **Exempt the open plots and Nine Dragon from the completion-card rule** (E14 Q1). *Recommended: yes.*
6. **Deepen the Training Vault to 20 m** (y −50…−30, still 30 m above the Titan arena's sky) (E10c Q1). *Recommended: yes.*
7. **Metal impacts on every shard** (E15a Q1): bolts on metal stop sounding like stone. *Recommended: yes*, a fix.
8. **HUD placement** (E0e Q1, E0f Q1): the XP bar along the bottom, nameplates always within 25 m. *Recommended: yes*,
   boards with the controls showing first.
9. **Contracts count without accepting** (E1f Q1) and **titles worn from the Character tab** (E1f Q2). *Recommended: yes.*
10. **East lanes during the west's last week** (this index): the east starts after your west play, but lanes that would
    idle in the west's phase 5 start E0a, E11a and E1a (no west blockers, each checked on its own). *Recommended: yes*,
    lanes never wait.

Also asked: parts magnetise within 4 m (E1e), one shield row with the Matriarch (E5a), the director's weather action
deleted (E9), beacons without the Warden Core (E9), *Patch Notes* for BENCH crafts (E8e), the Warden as an elite (E10d),
retries in the arena alcove (E12g), keep ×1.618 and report the real hours (E16), the grid swap after your east play
(E17).
