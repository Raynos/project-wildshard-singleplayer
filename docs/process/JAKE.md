# How Jake plays, steers and judges

Linked from [AGENTS.md](../../AGENTS.md). Jake's standing rules, gathered from his own words across sessions (until
E423 most of these lived only in one Claude session's private memory, so Codex and the other sessions never saw them).
Each line is a rule; the date or ask id is where he said it.

## How he plays

- **iPhone 17 Pro, Safari home-screen PWA, portrait.** No address bar: never a URL switch
  ([DEBUG-TOGGLES.md](DEBUG-TOGGLES.md)). Every screenshot you send him is iPhone portrait ([MOCKUPS.md](MOCKUPS.md)).
- **Low Power Mode caps Safari at 30 fps.** A 30 fps reading in his recordings is the OS cap, not a regression; his
  60 fps screen recordings hold each game frame twice (dedupe before frame-diffing).
- **The phone throttles** about 2× within 1–2 minutes of play. Budget the GPU for the sustained, hot frame; a
  first-minute reading or any Mac number overstates what the phone holds.
- **Render scale stays 2× on the phone.** Never dynamic resolution or a render-scale drop as a perf fix (E142: "a
  complete bullshit hack"); perf work is real cost cuts, measured at 2×.
- **Memory limits are 1.8 GB while loading and 1.0 GB in the Explorer** (decimal). The per-shard `gpuMB` ceilings are a
  ratchet for spotting jumps, not the device limit: never quote one as "the budget", never propose a cap below the
  device limits, and no GPU-memory check trips below 500 MB (E424, "ceremony porn").

## What he won't do

- **No phone chores** (E423 decision 5): no "Jake checks this on his iPhone" items, no A/B toggling to bisect ("either
  fix it or tell me it's good enough and we wrap it up"). His playtests and in-game FEEDBACK notes are the check. At
  most one passive action (a screenshot); any A/B cycles on its own.
- **Perf cuts are Debug cuts first** (E189): build each as a default-off Debug ▸ Performance row, send before/after
  stills (100 % crops) and a short turn video, and make it the default only when he sees no regression.

## How he steers

- **Plans are what he steers by** ([ASKS.md](ASKS.md)). Lead with the live plans' true state, not a backlog of picks.
  When something needs him, give one recommended answer.
- **"Implement X" in a plan session means: update the plan** (and mockups). Code starts on an explicit go.
- **Draft plans are his backlog.** Never propose dropping or parking FINISH-LINE, EXPLORE-V2 or the other big
  drafts (2026-09-29: "No we don't want to drop or park"); a draft is archived only when every row is built or he drops it.
- **Grill before a big plan**, with context: a short orientation, then one or two questions at a time, each with the
  background, what the plan says, why it matters, the trade-offs and a recommendation. Big plans then go through the
  council ([COUNCIL.md](COUNCIL.md), four rounds at most).
- **Finish what you start.** A leftover is built in the session that found it or becomes a plan row, never a new ask
  ("each its own ask is just the eternal backlog / graveyard", 2026-10-03).
- **Shard agents are never restarted from scratch** to prove a clean run (2026-10-01: "super wasteful"). Signal Dunes and
  Sky Reach content is built by Opus subagents only, never a GPT Sol builder.
- **MMO docs live in this repo, self-contained** (2026-10-03, E431: "requirements goes into wildshard singleplayer repo";
  E433: "a hard copy … not to leak any reference" to another repo): the vision, glossary, requirements, platform thinking
  and shard ideas in `docs/design/mmo/`, GW2-ZONES in `docs/plans/GW2-ZONES.md`, the route in
  `docs/plans/SHARD-PLATFORM.md`. Never link or name a private planning repo from here.
- **Clef / decision-model research is closed** (E394: "That's enough experimentation"). Using `decide.sh qa` in capture
  work is fine; don't propose new pilots.
- **The director loop** (2026-10-01) is how a shard is designed: pitch and style → a verb greybox he plays → beats and a
  content map → a ≤ 15 min session slice he plays → look → the whole arc. Taste picks stay A / B / C boards.

## What he judges

- **Taste is his call.** A change that is taste rather than an obvious fix (lighting model, sky, fog, grade / LUT,
  palette, horizon) keeps the old look selectable as a Debug variant and goes to him as a variant sheet; he picks.
  Bugs, perf and asset upgrades (primitive → real model) may ship without a pick.
- **Each shard keeps its own style:** Driftwood is faceted low-poly toon (never photoreal: "definitely not our style"),
  Nalati painterly, Pine Hollow photoreal PBR. Remasters raise a shard within its style.
- **Fun levels, not dioramas.** A shard is a standalone level with content, quests, theme and style. World generation
  starts from a level-design brief (spawn, hub, routes, arenas, boss, secrets, landmarks) and is judged by playing on
  the phone, not by aerial renders.
- **No screenshot cheats.** Everything in the playable area is real 3D that survives a 360° orbit and a top view;
  impostors only as a distance LOD of a real mesh; painted imagery only at infinity, as one seamless panorama. Validate
  with a walk-around strip, never one matching screenshot.
- **Council cameras are fixed.** In a look council, never move a `mock-*` camera or the ground under it to fit a metric;
  fix the world, or report the view as open.
- **A finished game** (Jake's words in AGENTS.md until E423): "will run at 60 FPS only" and "will have AAA graphics that are
  photo realistic worthy of PS5". The photoreal half is per shard: it does not apply to Driftwood's low-poly style.

## Facts that stop wrong arguments

- **Licences:** the game ships in North and South America only. Never raise a territory caveat (Hunyuan3D is as allowed
  as TRELLIS.2: "never fuck me off with the license again"). Research-only models are fine for mockups.
- **The slow uplink was temporary** (an Airbnb, 2026-10-01). Don't argue plan decisions from upload time; the push
  rules in [GIT.md](GIT.md) still apply.
- **A shard may be up to a 500 m cube** (250 m up, 250 m down; E169).
