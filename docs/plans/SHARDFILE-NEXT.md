# Plan: SHARDFILE-NEXT — what a live MMO zone needs from the Shardfile

**State:** `draft`, parked (2026-10-24, E499). Nothing here is built until Jake says so. Not worked by the
SHARD-PLATFORM builder or its lanes. Status: [shardfile-next/STATE.md](shardfile-next/STATE.md).

Jake, 2026-10-24 (E497, then E499): *"we want to keep our MMO but there's learnings to be had"*; *"Come up with a
shardfile next plan … It's a draft / parked plan"*, listing improved persistence, versioning, analytics, shared
assets and streaming, plus seven ideas from the audit.

Source: the audit [docs/audits/shardfile-vs-roblox.md](../audits/shardfile-vs-roblox.md)
([page](https://claude.ai/artifact/8FPsa7PyG2JseeSM46v2U1)). The Shardfile is stricter and safer than a Roblox place
but less ready to be a live MMO zone. This plan closes the gaps Jake picked and keeps everything that makes us
different: one continuous grid, AI-built shards, budget-first loading on the phone.

## What it delivers

1. **Shared assets** — a lock file per shard, so a shard's look never drifts when a shared pack changes.
2. **Persistence** — player progress survives a shard rebuild; the world may reset, the player never does.
3. **Versioning** — each shard can be pinned to a built product and rolled back on its own.
4. **Player requests** — every request a player makes is typed, rate-limited, range-checked and state-gated.
5. **Tags** — placed things carry declared tags that hosts and scripts can find, instead of a new section per mechanic.
6. **Streaming** — groups that load whole, landmarks that stay loaded, quest targets that stay loaded, and prefetch
   before lifts and portals.
7. **Analytics** — a funnel and a coin-flow scorecard for each shard, read from telemetry we already collect.
8. **Live dev session** — a dev build that swaps changed data in place, plus a small port agents can drive.

**Order:** A and B first (they protect what exists today), then C, E, F, D, G, H. Any phase can start alone except
where a row names a dependency.

## Rules for every row

- Every new or changed platform host passes the host bar ([docs/HOST-BAR.md](../HOST-BAR.md)): data-only APIs, no
  shard nouns, no shard branches in the engine. That includes tag ids and intent ids.
- No URL switches. A risky rendering or memory change ships default-off behind a Debug row until a device reading
  backs it. New behaviour a player could see goes behind Developer first.
- Memory stays a platform limit: 1.2 GB per shard playing, 1.8 GB loading. Nothing here lets a shard choose its own
  memory use.
- No new bots, cron jobs or proof machinery (G585). Analytics rows are reads of existing telemetry.
- Script ABI changes (rows E2, F2) are agreed with [WASM-HOST](WASM-HOST.md), which owns the ABI's next version.
- Numbers go in commit messages. No receipts or proof files.

## Rows

### A. Shared assets: a lock file (S)

Today `catalogueRef` (`src/commons/catalogue.ts`) resolves a commons id to the newest hash on every build, so each
shard silently picks up a changed pack.

- **A1** `src/shards/<slug>/commons.lock.json` (id → hash), written on first build and committed. A build resolves
  through the lock. An id missing from the lock fails the build with the command that adds it. — open
- **A2** `wildshard commons outdated` lists every locked id with a newer hash, and `wildshard commons update <id>
  [--shard <slug>]` moves one lock on purpose (`src/sdk/cli.ts`). — open
- **A3** The outdated report shows what a lag costs: when two resident shards lock two hashes of one pack, it prints
  the extra MB (the allocator already charges each hash once per resident shard). — open

**Done when** a commons change rebuilds every shard byte-for-byte until someone runs `update`.

### B. Persistence: player data apart from world state (M–L)

Today an instance's quest flags, steps and dialogue live in its logical checkpoint, next to an exact sim snapshot of
up to 512 K characters (`SIM_REGION_SNAPSHOT_CHAR_BUDGET`, `src/engine/sim/snapshot.ts`;
`src/game/grid/durability.ts`). A new `identity.revision` starts fresh (SHARDFILE.md "Local instance checkpoints"),
so any rebuild that bumps a revision can wipe progress. Declared `migrations` exist, but their hooks are null.

- **B1** A player record per shard, declared by the format: wallet, items whose catalogue family `travels`
  (`src/format/items.ts`), quest steps, ledger facts and the `state.player` fields. Keyed by stable ids, stored under
  one save-store key per slug (`src/engine/saves/store.ts`). — open
- **B2** The record is the source of truth. The exact snapshot becomes a cache, restored only when the revision
  matches; on a revision bump the world starts fresh and the record is re-applied. — open
- **B3** Wire the declared `migrations` hooks for the player record: a rename or a removed quest step migrates by id
  instead of dropping the record. — open
- **B4** A headless test: build a shard, play to a mid-quest step, bump the revision, rebuild, and expect the wallet,
  items and quest step back. — open

**Done when** B4 passes on every shard, and the same-revision exact resume still works.

### C. Versioning: pins and rollback per shard (M)

Today the site ships and rolls back as one SHA (`.github/deploy-pin.json`), and a grid placement names a slug, not a
product (`src/game/grid/singleplayer.json`, `src/game/grid/catalogue.ts`). Products are build outputs and are not
committed.

- **C1** Keep every product the deploy publishes, by its root hash, with a small `versions` list per slug
  (revision, root hash, date, the commit subject). Where the bytes live is open question Q2. — open
- **C2** A catalogue placement takes `product: <hash>` or follows `latest` (the default). A pin whose product fails
  today's `requires.sdk` or admission is refused at build time, with the reason. — open
- **C3** A one-shard rollback is a one-line catalogue change; write the drill into
  [docs/process/DEPLOY.md](../process/DEPLOY.md). Still one site and one deployment: a pin is data. — open

**Done when** one shard can be rolled back to its previous product while every other shard stays on `latest`.

### D. Typed, checked player requests (M)

Today script commands are checked before they stage (SCRIPT-ABI.md "Commands and authority"), but player input
(`plumbing.input` actions, `targets.interactions`, item actions) has no declared rate limit, range check or state gate.

- **D1** An `intents` section: one row per player request, with its argument schema, maximum rate, range from the
  player's actor and required state field. Defaults keep most rows to one line (range = the declared radius,
  rate = 10 Hz). — open
- **D2** The local sim refuses any request that fails its row, exactly as a future server will, and counts refusals
  where the debug overlay can show them. — open
- **D3** A headless test fires floods, NaN, wrong types, out-of-range and wrong-state requests at every shard and
  expects refusals with no state change. — open

**Done when** every player-issued action in every shard has an intent row and D3 passes.

### E. Tags on placed things (M)

Today each new mechanic tends to add a schema module (about 300 in `src/format/`), and placed colliders, targets and
spawns carry no labels (the template's `props.colliders` rows have only `id`, `initialActive`, `panel`, `shapes`).

- **E1** An optional `tags` list (at most 8 short ids) on collider, target, spawn and placed-piece rows, and a `tags`
  section declaring each tag with one line of meaning. An undeclared tag fails validation. — open
- **E2** A `tagged(tag)` list read plus tag enter / leave events in the Script ABI's next version, agreed with
  WASM-HOST. — open
- **E3** A lint rule: engine, game and SDK code never compares a tag *name*. A host keys on a tag the shard
  declares, never on a word in platform code. — open
- **E4** Convert one mechanic as the proof: pick an existing one-off section a tag can replace, move it, delete
  the old schema module. — open

**Done when** E4 has deleted at least one schema module and E3 guards the rest.

### F. Streaming classes for groups (M)

Today content is either library (resident for the level) or tile-bound (resident by distance), plus one whole-shard
`far` proxy. Tile rows carry bounds, files and costs, but no grouping or persistence class.

- **F1** A `stream` class on placed groups: `atomic` (never half-loaded across a tile seam), `landmark` (always
  resident, charged up front) and `quest` (resident while a quest step points at it). — open
- **F2** A `prefetch(x, z)` request for `socketLift` and `portalLink` entryways, so the far side is resident before
  arrival. Agreed with WASM-HOST if it becomes a script read. — open
- **F3** The validator charges landmark and quest sets at their worst case against the 1.2 GB cap and refuses
  overages, like `critical`. One device reading per shard that adopts a class. — open

**Done when** one shard uses all three classes within its cap, with no half-loaded group at a seam.

### G. Analytics: a funnel and scorecard per shard (S–M)

Today `api/telemetry.ts` accepts six fixed event names (`death.cause`, `quest.step`, `weapon.used`, `shard.time`,
`level.time`, `boss.attempt`), and `scripts/telemetry-brief.mjs` reads a daily digest. Shards can't say what progress
means for them.

- **G1** Each shard's funnel is derived from its `quests` section: step reached, time to step, where people stop.
  No new event names unless a step can't be read from `quest.step`. — open
- **G2** Coin flows in and out by source, read from the `ledger`. — open
- **G3** `telemetry-brief` prints one scorecard per shard (funnel plus coin flow). It is a read, not a new bot, and
  it never asks Jake to do anything. — open

**Done when** the daily brief shows a scorecard for every shipped shard.

### H. A live dev session agents can drive (M–L)

Today `wildshard dev` rebuilds and reloads the page on every edit, and the player starts again from spawn
([docs/SDK-DEV.md](../SDK-DEV.md)). Agents poke `window.__wildshard` handles through ad hoc scripts.

- **H1** In `__DEVSERVER__` builds only: hot-swap a changed data section in place, re-admit it, restore the
  same-revision logical checkpoint and keep the player's pose. If scripts or colliders changed, fall back to a full
  reload. — open
- **H2** A small, documented agent port next to it: list entities and tags, read state fields, move the player,
  fire a scene event, capture a frame. Never in production builds and never a URL switch. — open
- **H3** Document both in SDK-DEV.md. Every use still goes through `scripts/browser-lane.sh`, under the
  four-browser cap. — open

**Done when** an agent can edit a quest row, see it live in the same session without a reload, and capture the
result through the port.

## Open questions (answer when the plan is unparked)

- **Q1 Where does the player record live?** Recommended: one save-store key per slug, with the existing versioned
  store and migrations. A future server serves the same record.
- **Q2 Where do kept products live?** Products aren't committed, and the repo's storage limits rule out keeping them in
  git. Recommended: the deploy uploads each product's files to the content-addressed store that [REPO-WEIGHT](REPO-WEIGHT.md) chooses
  (Jake's E436 answer named Cloudflare R2). Keep the last 10 products per slug.
- **Q3 Should a lock move automatically?** Recommended: never. `outdated` lists, a person or an agent runs `update`,
  and the commit says why.

## Not in this plan

- A server-only cut of each product and a `world` state scope (audit ideas 1 and 7): they matter once multiplayer is
  planned. Shared world state is already SHARD-PLATFORM-NEXT S10.
- Anything the audit says not to borrow: separate places with teleports, one binary place file, a runtime tree any
  script can change, free-form attributes, per-frame scripting, author-set streaming radii, client-owned physics, a
  creator marketplace, live shared editing, per-shard GUIs, opt-in sandboxing.
