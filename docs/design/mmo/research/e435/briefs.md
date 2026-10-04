# E435 research briefs

The prompts each clean-room seat received (Codex: gpt-6-astra, reasoning high; Claude: Opus 5.5 subagents with the same content).

## Plan audit

You are an independent, clean-room auditor for the Wildshard repo (this working directory). READ-ONLY: do not edit,
create, stage or commit any file in the repo. Your whole report is your final message (markdown).

## Who is asking and why

Jake owns this project. Other AI agents wrote a plan to turn a single-player browser game into the foundation of a
sandbox MMO. Jake's instruction, verbatim: "Audit & review what we have before we start going with it, assume the
other agents are idiots and are full of shit." So: trust nothing in the docs. Verify every claim you can against the
code and git, and judge the strategy from first principles, not from the docs' own framing.

## What to audit

- `docs/plans/SHARD-PLATFORM.md` — the plan (phases P0–P6, rows SP0–SP32, decisions, metric).
- `docs/design/mmo/` — MMO-REQUIREMENTS.md, SHARD-PLATFORM-PLAN.md, VISION.md, GLOSSARY.md, SHARD-IDEAS.md,
  ONE-SHOT-REVIEW.md.
- The code they describe: `src/engine/`, `src/game/`, `src/kit/`, `src/shards/<slug>/`, `lint/`, `scripts/`
  (especially `scripts/shard-platform.mjs`, `lint/shard-platform.json`, `lint/wildshard-plugin.js`,
  `scripts/check-row-data.mjs`, `lint/row-functions.json`, `src/engine/saves/`, `src/engine/core/config.ts`,
  `test/world/world-contract.test.ts`), and `git log`.
- Note: a commit landed minutes ago removing every barrel index (src/engine/index.ts etc.); imports now name the
  defining module. Docs that still assume barrels are stale.

## The goal (Jake's words, 2026-10-03)

"high level the vision is the MMO. … Since the MMO is hard we started with single player. But the sandbox MMO
including an API with user generated shards has lots of constraints. … a high level plan to get to the 80/20 split.
The 80/20 split can be 80% data and approved systems (logic system, stacks, graphs, wasm plugins). The remaining 20%
is custom runtime per shard so we don't have to rewrite everything in one go."

The MMO: a browser sandbox on a grid of 500 m shards; strangers author shards with Claude Code and upload them;
others play together, including on an iPhone at 30 fps inside ~1 GB. Jake decided today: the milestone is
**package-first** (a new shard / the template is born as a package that boots with no trusted code; the six existing
shards go to the 80/20 split afterwards). Still open: which language sandboxed shard behaviour is written in (data
graphs vs a TS-like language compiled to WASM vs Rust WASM vs QuickJS), and how much the server is authoritative.

## What to produce

1. **Verdict** in 5 lines: is this plan a sound route to the goal? What is its single biggest flaw?
2. **Claims checked** — a table: claim (quote, file:line) · verdict (true / false / exaggerated / unverifiable) ·
   evidence (command output, file:line). Check at least 25, prioritising: the §2 audit numbers (usage counts like
   `ctx.app` 127 / `ctx.game` 86 / `ctx.game.runtime` 61, subclass counts, line counts), every "done" row in P0, the
   per-shard custom-share figures in P5 (5 %, 16 %, 15 %, 28 %, 25 %, 28 %, 31 %) and the 42 % / 11 % / 27 % phase
   splits, the metric's definition and whether `scripts/shard-platform.mjs` measures what the plan says.
3. **Strategy review from first principles**: the irreducible constraints (untrusted code, server authority, phone
   budget, API longevity, Claude Code as the editor) — does the plan's shape follow from them? Is "line count of
   custom TS" a meaningful metric? Is the device / logic-graph catalogue the right bet vs a sandboxed general-purpose
   language? What is over-built, what is missing (networking, server, persistence, security boundary, asset
   pipeline, moderation, cost), what is ordered wrong?
4. **Risks the docs don't name.**
5. **Keep / cut / change** — a list.
6. **Top 10 recommendations**, ranked, each one sentence + why.

Be blunt and specific. Cite file:line for everything. No flattery of the existing docs.


## Server authority

You are an independent, clean-room researcher. READ-ONLY in this repo: do not edit, create, stage or commit any
file. Use live web search extensively and cite sources (URLs) for factual claims. Your whole report is your final
message (markdown).

## Context

Wildshard is a browser game (three.js / WebGL / TypeScript, custom engine, Rapier physics) that wants to become a
**sandbox MMO**: a grid of 500 m × 500 m "shards"; each shard is authored by a player (with Claude Code) and
uploaded; players walk, ride and fight (PvE: creatures, bosses, quests, loot, earned titles, achievements) across the
grid and play each shard together. Each shard runs as a room on a server keyed by shard id. The reference client is
an iPhone (portrait Safari PWA, 30 fps sustained, ~1 GB memory). User-generated shards are untrusted. There is an
anti-farming "meaningful activity" ranking that decides which shards stay near the centre of the grid.
Background docs, if useful: `docs/design/mmo/VISION.md`, `docs/design/mmo/MMO-REQUIREMENTS.md`.

The owner asked: "Do me a full audit & review of each approach for an MMO … a deep research for other multiplayer
games like Rust, Minecraft, Black Desert Online, etc etc etc."

The question: **how much should the server be authoritative?** Candidate approaches (add others you find):
1. Full server authority over all shared simulation (combat, AI, loot, quest state); clients predict and reconcile.
2. Progress-only authority: clients simulate PvE; the server validates what can be farmed or traded (loot, XP,
   titles, achievements, activity) with plausibility checks.
3. Client authority with server-side validation / anti-cheat heuristics (Valheim-, early-Minecraft-style).
4. Host / owner authority per room (one player's client or the shard's room host is the authority).
5. Hybrid per system (movement client-auth with checks, combat server-auth, etc.).

## What to produce

1. **Case studies**, one compact section each, at least 12, covering: Rust (Facepunch), Minecraft (Java server,
   Bedrock, and big networks like Hypixel), Black Desert Online, World of Warcraft, EVE Online, Roblox (critical: UGC
   + server authority + Luau sandboxing + FilteringEnabled history), Fortnite / UEFN + Verse, Second Life (LSL
   scripts run server-side), VRChat (Udon), Valheim, Albion Online, RuneScape / Old School RuneScape, Guild Wars 2,
   plus any of: Dual Universe, Star Citizen (server meshing), New World (its client-authority exploits), SpatialOS
   games, Hytale, Core, Rec Room, Garry's Mod, Screeps. For each: the authority model, tick rate and netcode
   (prediction, lag compensation, interest management), how user content or scripts are sandboxed (if any), notable
   cheats / exploits that came from the authority choice, and scale per server / instance.
2. **Lessons for user-generated content** specifically: how platforms that run strangers' scripts (Roblox, Second
   Life, UEFN, VRChat, Garry's Mod, Screeps) contain them on the server and the client (language, metering, memory
   caps, determinism, API surface).
3. **Each approach audited for Wildshard** — a table and prose: cheat resistance (for loot, titles, the activity
   ranking), server cost per player (CPU for physics + AI), latency feel on a phone over mobile networks, engineering
   cost from a single-player TypeScript engine, what it forces on shard authors, failure modes.
4. **Recommendation** with reasoning, and the 5 things Wildshard must decide or build first because of it.

Be blunt; mark anything you could not source as unverified.


## Streaming and the crossroads

You are an independent, clean-room researcher and designer. READ-ONLY in the repo at
this repo: never edit, create, stage or commit a repo file. Use live web
search extensively and cite URLs. Mark anything unsourced as unverified.

## Context

Wildshard is a browser game (custom three.js / WebGL 2 / TypeScript engine, Rapier physics) becoming a sandbox MMO.
The world is a grid of **shards**: each is a **500 m × 500 m × 500 m** cube (x, z ∈ [−250, 250]; 250 m below and
250 m above the highway level y = 0), authored by a different player (untrusted, uploaded), each with its **own
art style** (low-poly toon, painterly, photoreal PBR, neon…). Shard centres sit **515 m apart**, with a **15 m
server-owned highway** between all shards; each shard has a 15 m road running ≥ 50 m in from each edge midpoint.
The first grid is 5 × 5. Each shard runs as a **server room** keyed by shard id. Players walk, ride horses and drive
(assume up to ~30 m/s) across the grid.

The reference client is an **iPhone 17 Pro, portrait Safari home-screen PWA**: 30 fps sustained when hot (Low Power
Mode caps at 30; the phone throttles ~2× within minutes), render scale fixed at 2×, **memory 1.0 GB while playing,
1.8 GB while loading** (Safari kills the tab beyond that). Today ONE shard alone uses most of that budget, and
shards are monolithic levels (code-built + GLB), not spatial tiles. Repo docs if useful: `docs/design/mmo/VISION.md`,
`docs/design/mmo/MMO-REQUIREMENTS.md` (W7 seamless travel, W8 horizon impostors), `docs/process/RENDERING.md`.

The owner, verbatim: "These are huge technical requirements that are challenging. So we should front run these in
any and all way we can at the plan & design stage. How do you travel seamlessly, how do you see multiple shards
whilst driving, and especially the 4 shards on the corners."

## Produce (markdown)

1. **Prior art**, compact, cited: how seamless worlds stream and hand over — WoW (seamless continents, phasing,
   layering), Guild Wars 2 (zones + loading screens: why), Star Citizen (server meshing, object container streaming),
   Microsoft Flight Simulator (streamed photogrammetry tiles), Cesium / OGC 3D Tiles + glTF (browser HLOD), Google
   Earth, Minecraft (chunks, view distance, Bedrock render distance on phones), Roblox StreamingEnabled (and its
   phone limits), Unreal World Partition + HLOD, Unity/large-world streaming, No Man's Sky, Dual Universe, Second Life
   (region crossings, neighbouring-region rendering, the classic region-crossing bugs), Hytale, Fortnite (mobile
   streaming), Genshin Impact on phones. For each: tiling, LOD/HLOD scheme, view distance on mobile, memory and
   bandwidth budgets, server handoff at borders, known failure modes.
2. **The geometry of the problem for Wildshard:** what is in view and in simulation range at (a) a shard's
   interior, (b) the highway between two shards, (c) **a crossroads where four shards meet**, (d) driving at speed.
   Quantify: how many shards / tiles are within N metres for a few candidate view distances; memory if each shard
   keeps its own textures and materials; streaming bandwidth needed at 30 m/s on a mobile link (e.g. 5–20 Mbit/s,
   with stalls).
3. **A proposed design**: the LOD rings (near full detail / neighbour band / far proxy / horizon impostor), how a
   shard package must be authored and baked so it can be streamed in tiles (tile size, per-tile LODs, an edge band,
   a baked far proxy and impostor, per-tile budgets), how four different art styles coexist on screen at a corner
   (lighting, sky, fog, post-processing: per-shard look vs one global frame), memory partition per ring, the
   server side (which room owns a player on the highway, how neighbours' creatures and players are seen across a
   border, handoff without duplication), and what the highway itself is.
4. **What the package format must contain because of this** (the decisions that are expensive to change later).
5. **The cheapest prototype** that would prove or kill the design on the phone, and the numbers it must hit.
6. **Risks and open questions**, ranked.

Be blunt and concrete; numbers over adjectives.
