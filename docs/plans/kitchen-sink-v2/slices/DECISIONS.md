# Slice decisions (Jake, 2026-11-03 grill)

Jake's answers to the slice questions. Where a slice file's "Questions for Jake" recommends something else, this file
wins; the slice files are updated when their slice is next touched. How slices run (when Jake plays, whole host
families, the parity bar, parallel toy slices) is in [README.md](README.md).

| # | Question | Jake's answer | Slice |
|---|---|---|---|
| D1 | AssemblyScript decision-module cap (9 per shard today) | **Raise to 32 per shard**; see D29 | W0e |
| D2 | The range lends weapons? | **Lends every weapon inside its fence**, taken back on leaving | W3a |
| D3 | When the showcase takes the hologram's grid cell [−1,−1] | **Off-grid until the east is done**; Developer reaches it from Select a shard | W0a, W12, east finish |
| D4 | A west-only tour quest | **Yes: "Shift Orientation"** from the Yard Boss (range, a riding lap, the movers' top deck, the zip into town, then report at the East Gate), no reward | W1b |
| D5 | A "Give 1,000 Scrip" Debug row to test shops in the west | **No: wait for the east.** Shops stay unbuyable until E1 pays; W2b proves the buy path in tests only | W2b, E1 |
| D6 | Parry input on the phone | **A GUARD button, shown only while a parry weapon (the sword) is held**; a mockup board to Jake before it lands (E332 HUD change) | W3d |
| D7 | The hover park reads flat | **Launch walls instead of a true halfpipe, taller kickers 2.4 / 3.6 / 4.8 m** | W5a |
| D8 | The quest-page gate on zipline / updraft / riding / grapple rows | **Drop the gate; the showcase has the grapple from arrival** | W7a |
| D9 | Render look family | **Toon, polished up** (richer materials and lighting than Driftwood) | W0a |
| D10 | Where the world geometry comes from | **One Blender script for the cell** (like blender-template) | W0a, W0b |
| D11 | Starting kit | **Start with a sword**; buy the rest | W2b, W3a |
| D12 | NPC names | **Yard Boss, Surveyor, Shift Boss, Tinker Rook, Gunsmith Brass, Stable Bot Hay** | W1a |
| D13 | How many quests active | **All 12 at once, one tracked on the HUD** | W1b |
| D14 | Where the quest list lives | **On the map tab, above the quest card** (a board of it before the UI lands) | W1b |
| D15 | When Pine's custom quest runtime migrates | **In E1, with the contract-board host** | E1 |
| D16 | Personal bests | **Per shard; Nalati's and Nine's playground bests save too** (the records host's second user) | W3a, W6d |
| D17 | Ammo storage | **A pouch counter per kind**, never pack slots; arrows and bolts separate | W3b |
| D18 | Free ammo | **Iron bolts, arrows and rifle rounds refill free at a town crate; pitch and broadhead come from the BENCH** | W2b, W3b |
| D19 | Physics-yard plates | **Held, no latch** (park two crates, stand on the third) | W4a |
| D20 | Pushed crates and balls | **Drift home after 60 s untouched** | W4a, W4b |
| D21 | A fall mid-course | **Back to the last checkpoint, the clock keeps running**; the movers pit has a ladder back | W6a, W6d |
| D22 | The course clock | **A shared HUD chip under the minimap, only during a run** (E332 notice) | W6d |
| D23 | A missed riding ring | **+5 s per missed ring** | W10b |
| D24 | Where the loaner horse goes | **The paddock and the oval only** (Jake, against the recommendation of the whole west) | W10a |
| D25 | Calibration Chip (every 5 Gold 1×1s) | **+5 % board and grapple reel speed each** | W9b |
| D26 | Hidden caches | **A cosmetic each** (a board finish, a hard-hat colour); the west still pays no Scrip | W9b |
| D27 | Natural storms | **1–2 a real hour, 3–5 min, day or night** | W11a |
| D28 | A "Storm now" Debug row | **Yes, short-lived**: deleted when storm hour lands in the east | W11a |
| D29 | The 40–80 ms iPhone freeze per script module on cell entry (`liveSession.ts`), Pine already at 9 of 9 | **Keep 32, and fix the freeze** (Jake: *"32 but fix the fucking freeze"*): W0e makes module load / compile stop blocking cell entry (precompile, cache, off the main thread or lazy on first use; W0e researches which), proved by a Simulator cell-entry reading on Pine | W0e |
| D30 | WASM-HOST H13 (the new script ABI) vs the slices moving the same plugin modules | **Slices move hosts on today's ABI; H13's switch-over lands between the west and the east halves** | W6a, W3c, E-gauntlet |
| D31 | Custom-sections rows overlapping slices | **Z6 and Z13 finish in their own plan; Z4 → E1, Z7 → W9b, Z8 → W1b / E1, Z11 → W11a, Z14 → W10a / the Titan** | COVERAGE.md |
| D32 | Hosts with one user (G595) | **Registered as "showcase first user" as they land; one approval sheet to Jake per half** (end of west, end of east) | W12, east finish |
| D33 | What touching a host family obliges | **A behaviour or shape change migrates every user in the slice; a new optional field only proves every user unchanged** | all |
| D34 | The parity bar, precisely | **Saves, item ids and replays byte-exact** (an old-save fixture per affected shard; never bump a save key's version); **looks "similar, no glitches"** goldens (G415) | all |
| D35 | Memory gates (report-only today; RENDERING.md still says 1.0 GB) | **At W12 measure every shard, then enforce 1,200 MB per shard** and fix the stale 1.0 GB texts | W12 |
| D36 | The crew | **5 Opus + 5 Codex**, named in AGENTS.md as a Codex-lane plan when Jake says build | build start |
| D37 | The in-game cutscenes plan (IC1–IC4) | **Its engine rows run inside the Titan slices**; the five shipped boss intros re-home onto the timeline in the same slice | E12d |
| D38 | One-user hosts: levels, shrine | **Both approved now as platform**; the shrine host's second user is **Driftwood's sea cave** (+6 h) | E0a, E10b |
| D39 | The enemy count cap | **Every shard, hostile enemies only** (never wildlife or NPCs), proved by replays | E0h |
| D40 | The required shard-complete card | **Every shard except the open plots and Nine Dragon**; the card gets a boss trigger | E14 |
| D41 | The Training Vault's height | **Deepened to 20 m (y −50…−30)**, still clear of the Titan arena (sky from −80) | E10c |
| D42 | The new metal impact sound | **On every shard's metal hits** | E15a |
| D43 | XP bar and nameplates | **Bottom bar above the control deck; nameplates always within 25 m**; a 1:1 in-engine board to Jake first | E0e, E0f |
| D44 | Kill contracts | **Accept first, then count** (Jake, against the recommendation); titles worn from the Character tab | E1f |
| D45 | Lanes idle late in the west | **They start the engine-only east slices early** (E0a, E11a, E1a); no east shard content until the west is done | INDEX |
| D46 | Leash heal (walk home to full) | **Showcase only**, an optional row off by default | E-band slices |
| D47 | Per-pack respawn | **A new optional row, showcase only** (D33: others proved unchanged) | E1c |
| D48 | The "Patch Notes" feat | **Dropped** | E8 |

## The 38 UI changes (Jake, 2026-11-03, one by one on the in-engine pairs)

33 approved, 5 cut; every item in [UI-PICKS.md](../UI-PICKS.md), the rules in the
[HUD mini plan](../hud-character-mini-plan.md). These rows answer or refine the slice questions they name.

| # | Question | Jake's answer | Slice |
|---|---|---|---|
| D49 | The XP bar, the tick-up card, nameplates, the Character tab's place (E0e Q1–Q2, E0f Q1–Q2) | **As recommended**: the bar on the touch bar's top edge, the tick-up card after 5 s calm with TAP TO SKIP, nameplates always within 25 m, CHARACTER in the bag (UI-01–UI-04, UI-10) | E0e, E0f |
| D50 | Where activity counters show (refines D22) | **In the quest chip's place, one chip at a time**; the quest chip comes back after: course clock, the vault's room count, the trick score (UI-20, UI-29 A, UI-31) | W6d, E10c, W5b |
| D51 | Wave, storm hour and beacon messages | **One centred line that fades in ~2 s**; nothing stays; no minimap beacons, no toast (UI-24, UI-22) | E11b, E9 |
| D52 | Where GUARD sits (refines D6) | **In the row: GUARD · LOCK · DODGE · JUMP**, in the slot the spear's THROW takes (UI-06) | W3d |
| D53 | The bag's tabs (supersedes D14's placement) | **Five tabs, MAP · CHARACTER · FINDS · PACK · FEATS**: Gear is a sub-tab of CHARACTER (opens on CHARACTER); the map tab has MAP / QUESTS sub-tabs (opens on MAP) with the list by tier, one quest's details, a locked quest (UI-10, UI-14) | E0f, W1b |
| D54 | Picking ammo (refines D17) | **No BOLTS disc and no pouch row: tap the weapon chip, three ammo tiles slide out beside it** (icon + count, the loaded one lit); no ammo list in the bag (UI-35 C2) | W3b |
| D55 | A quest above your level in dialogue | **NEEDS LV n once, by the quest name, and one OK**; no NEXT, no greyed button (UI-13) | W1b |
| D56 | Leaving a mini dungeon | **Walk through the real exit portal; rerun by walking back in**; the SHRINE COMPLETE card has one CONTINUE (UI-30) | E10b, E10c |
| D57 | Find and feat toasts | **One short line at a time**, no effect text, the next one waits; details in FINDS / FEATS (UI-18 A) | W9b, E8 |
| D58 | Stealth on the HUD | **One eye + UNSEEN row top left**, the quest chip unchanged, no toast (UI-23 B) | E5b |
| D59 | Boss intro skip (E12h Q1, enemies plan Q3) | **Hold** (the engine's HOLD TO SKIP ring; UI-26) | E12h |
| D60 | Signs and markers in the world | **Information boards are real signs placed in the world** (UI-21); the quest-giver "!" just above the head (UI-12); first-time hints teach a mechanic once (UI-11) | W3a, W6d, W1b, E0b |
| D61 | Cut | **The map's level heat map, the minimap band border, a HUD Scrip chip and the per-kill Scrip toast, the range's LOAN tags and toast, the tour-step toast** (UI-27, UI-28, UI-38, UI-37, UI-15). The features under them (D2's range loan, D4's Shift Orientation quest, Scrip itself) stay (Jake confirmed 11-03: "UI only") | map, E1d, W3a, W1b |
| D62 | Revisit loot? | **Lock the loot plan as written**; revisit after the east play only if it feels off | E1d, E1e, E0i |
| D63 | The 12 quest names (E13 Q1) | **Keep them** (Clock In … The Last Contract) | W1b, E1g, E13 |

The 67 questions still open, each with a recommendation, are in [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) (Jake: "walk me through them").
