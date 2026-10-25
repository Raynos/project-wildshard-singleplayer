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
9. **Optional sync** — sign in to carry your one character across devices; playing never needs an account.
10. **Server-only cut** — loot tables, spawn logic and boss scripts stop shipping to the phone once a server exists.

**Order (SN-D16, SN-D20):** A and B first (they protect what exists today), then I, C, E, F, D with J, G, H. Any phase can start alone except
where a row names a dependency.

## Rules for every row

- Every new or changed platform host passes the host bar ([docs/HOST-BAR.md](../HOST-BAR.md)): data-only APIs, no
  shard nouns, no shard branches in the engine. That includes tag ids and intent ids.
- No URL switches. A risky rendering or memory change ships default-off behind a Debug row until a device reading
  backs it. New behaviour a player could see goes behind Developer first.
- Memory stays a platform limit: 1.2 GB per shard playing, 1.8 GB loading. Nothing here lets a shard choose its own
  memory use.
- No new bots, cron jobs or proof machinery (G585), except the one scorecard job Jake picked (SN-D31).
- Script ABI changes (rows E2, F2) are agreed with [WASM-HOST](WASM-HOST.md), which owns the ABI's next version.
- Numbers go in commit messages. No receipts or proof files.

## Decisions

Jake's grill, 2026-10-24 (page: [Shardfile Next Decisions](https://claude.ai/artifact/RqPe89PKTh8Yv5pYwXEQvD)):

- **SN-D1 Progress survives a rebuild, the world resets.** Quest steps, flags and dialogue move into the player record;
  enemies, doors and pickups start fresh on a new revision.
- **SN-D2 One character record per player, with a section per zone.** Travelling items and the profile go
  everywhere; quest progress and local coins stay in that zone's section.
- **SN-D3 A removed quest step falls back** to the last step that still exists, keeping completed steps and rewards.
  A shard may declare an explicit step migration to do better.
- **SN-D4 The record only moves forward.** An older product reads what it knows and leaves unknown fields untouched,
  so a rollback is invisible to players and rolling forward restores them.
- **SN-D5 Old builds live in Cloudflare R2,** content-addressed and uploaded by the deploy; the last 10 products per
  shard are kept (answers Q2).
- **SN-D6 A pin or rollback happens only on Jake's word.** Agents may prepare the catalogue change and say which
  product they'd pin; the commit that lands it quotes Jake.
- **SN-D7 A lock never moves by itself** (answers Q3). `commons outdated` lists, someone runs `update`, the commit
  says why.
- **SN-D8 Tags come from both places:** a shared tag vocabulary kept as data in commons, plus each shard's own
  declared tags. A host row points at a tag from either. Platform code still never compares a tag name; the shared
  words live in commons data, not in engine or game code.
- **SN-D9 A request that breaks its rule is dropped silently and counted:** the debug overlay shows refusals and
  telemetry counts how often each rule trips.
- **SN-D10 Streaming classes are mostly automatic.** The build marks seam-crossing groups `atomic` and derives
  `quest` groups from the quest graph; authors declare only `landmark`, which the validator charges.
- **SN-D11 Add D1 / D7 retention now,** with a stable anonymous player id across days. Funnels still come from
  `quest.step` and coin flows from the ledger.
- **SN-D12 Agents drive a live dev session through a small `wildshard-dev` MCP server** with typed tools (list
  entities and tags, read state, move the player, fire an event, capture a frame), dev builds only.
- **SN-D13 The record lives on the device by default, with optional sync through sign-in** (phase I). Playing never
  requires an account.
- **SN-D14 Retention counts public sessions in the headline.** Developer-on sessions get their own column; test
  browsers are not counted.
- **SN-D15 Add the server-only cut** (audit idea 1) as phase J. Shared world state across zones (idea 7) stays out;
  it is SHARD-PLATFORM-NEXT S10.
- **SN-D16 Order: A and B first,** then C, E, F, D, G, H.
- **SN-D17 Sign-in offers three methods:** passkeys, Sign in with Apple and an email magic link.
- **SN-D18 Signed-in records live in Cloudflare R2, one object per player,** written through an `api/` route with
  conditional writes so two devices never silently overwrite each other.
- **SN-D19 Two devices merge per zone, by kind:** quests keep the furthest step and completed stays completed; coins,
  bag and travelling items take the newest write. Progress never goes back and coins never duplicate.
- **SN-D20 Phase I comes right after B; phase J lands next to D.** Full order: A, B, I, C, E, F, D + J, G, H.
- **SN-D21 One account can link several sign-in methods.** The first sign-in creates it; Settings adds the others;
  every method opens the same character. No auto-linking by email.
- **SN-D22 Magic-link emails go through Resend.**
- **SN-D23 Players delete their account from Settings:** it removes the R2 record and the linked sign-ins, and the
  device keeps playing locally (Apple requires in-app deletion for the native apps).
- **SN-D24 Telemetry is never linked to an account.** It stays anonymous per install, even when signed in.
- **SN-D25 Every player action needs an intent row.** The build fails without one; a one-line row inherits range from
  the action's radius and a rate of 10 per second.
- **SN-D26 A tag joins the shared vocabulary once two shards use it,** like shared content today; any agent promotes
  it with a one-line meaning.
- **SN-D27 Landmarks get a sub-cap of 20 % of the shard's budget** (about 240 MB of the 1.2 GB); the validator refuses
  more.
- **SN-D28 Claude and Codex lanes both use the `wildshard-dev` MCP server;** each session still takes a browser lane
  slot.
- **SN-D29 Fresh start for today's saves.** The player record does not migrate the current format; old save keys are
  cleared when the record ships.
- **SN-D30 Template 2 pilots the player record** behind Developer, then every shard switches in one landing.
- **SN-D31 The scorecard is a standing dashboard page refreshed by a scheduled job.** Jake picked it knowing it is a
  new automation, so it is his explicit exception to G585 for this one job.
- **SN-D32 A rollback is proposed as a question to Jake** with the broken shard, the product to pin and a before /
  after capture; his answer is quoted in the commit.

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
so any rebuild that bumps a revision can wipe quest progress. Coins, bag and loadout already sit in their own
per-instance save slots (`GridWallet`, `src/game/grid/wallet.ts`) and the ledger keeps a profile, so they survive;
quest flags, current steps and dialogue do not. Declared `migrations` exist, but their hooks are null.

- **B1** One player record (SN-D2) with a section per shard, declared by the format; each section holds quest steps and flags, dialogue progress and the
  `state.player` fields; travelling items and the profile sit at the top level, next to the wallet slots and ledger
  facts that already persist. Keyed by stable ids, stored
  in the save store (`src/engine/saves/store.ts`). — open
- **B2** The record is the source of truth. The exact snapshot becomes a cache, restored only when the revision
  matches; on a revision bump the world starts fresh and the record is re-applied. — open
- **B3** Wire the declared `migrations` hooks for the player record: a rename or a removed quest step migrates by id
  instead of dropping the record. — open
- **B5** Ship with a fresh start (SN-D29): today's save keys are cleared, not migrated. Template 2 pilots behind
  Developer, then every shard switches in one landing (SN-D30). — open
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
- **C3** A one-shard rollback is a one-line catalogue change, landed only on Jake's word, given as an answer to a question with evidence (SN-D6, SN-D32); write the drill into
  [docs/process/DEPLOY.md](../process/DEPLOY.md). Still one site and one deployment: a pin is data. — open

**Done when** one shard can be rolled back to its previous product while every other shard stays on `latest`.

### D. Typed, checked player requests (M)

Today script commands are checked before they stage (SCRIPT-ABI.md "Commands and authority"), but player input
(`plumbing.input` actions, `targets.interactions`, item actions) has no declared rate limit, range check or state gate.

- **D1** An `intents` section (required for every player action, SN-D25): one row per player request, with its argument schema, maximum rate, range from the
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
  section declaring each shard tag with one line of meaning, on top of the shared vocabulary in commons data
  (SN-D8; a tag is promoted once two shards use it, SN-D26). An undeclared tag fails validation. — open
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

- **F1** A `stream` class on placed groups (SN-D10: `atomic` and `quest` derived by the build, `landmark` declared): `atomic` (never half-loaded across a tile seam), `landmark` (always
  resident, charged up front) and `quest` (resident while a quest step points at it). — open
- **F2** A `prefetch(x, z)` request for `socketLift` and `portalLink` entryways, so the far side is resident before
  arrival. Agreed with WASM-HOST if it becomes a script read. — open
- **F3** The validator charges landmark and quest sets at their worst case against the 1.2 GB cap, with landmarks
  held to 20 % of it (SN-D27), and refuses overages, like `critical`. One device reading per shard that adopts a class. — open

**Done when** one shard uses all three classes within its cap, with no half-loaded group at a seam.

### G. Analytics: a funnel and scorecard per shard (S–M)

Today `api/telemetry.ts` accepts six fixed event names (`death.cause`, `quest.step`, `weapon.used`, `shard.time`,
`level.time`, `boss.attempt`), and `scripts/telemetry-brief.mjs` reads a daily digest. Shards can't say what progress
means for them.

- **G1** Each shard's funnel is derived from its `quests` section: step reached, time to step, where people stop.
  No new event names unless a step can't be read from `quest.step`. — open
- **G2** Coin flows in and out by source, read from the `ledger`. — open
- **G3** A standing dashboard page with one scorecard per shard (funnel, coin flow, retention), refreshed by one
  scheduled job (SN-D31, Jake's exception to G585). It never asks Jake to do anything. — open
- **G4** D1 / D7 retention (SN-D11): a stable anonymous player id across days, sent with the existing session
  records, and retention in the scorecard. — open

**Done when** the daily brief shows a scorecard for every shipped shard.

### H. A live dev session agents can drive (M–L)

Today `wildshard dev` rebuilds and reloads the page on every edit, and the player starts again from spawn
([docs/SDK-DEV.md](../SDK-DEV.md)). Agents poke `window.__wildshard` handles through ad hoc scripts.

- **H1** In `__DEVSERVER__` builds only: hot-swap a changed data section in place, re-admit it, restore the
  same-revision logical checkpoint and keep the player's pose. If scripts or colliders changed, fall back to a full
  reload. — open
- **H2** A small `wildshard-dev` MCP server next to it (SN-D12), with typed tools: list entities and tags, read state fields, move the player,
  fire a scene event, capture a frame. Never in production builds and never a URL switch. — open
- **H3** Document both in SDK-DEV.md. Every use still goes through `scripts/browser-lane.sh`, under the
  four-browser cap. — open

**Done when** an agent can edit a quest row, see it live in the same session without a reload, and capture the
result through the port.

### I. Optional sync through sign-in (M, SN-D13)

The record from phase B stays on the device unless the player chooses to sign in.

- **I1** An optional sign-in from pause ▸ Settings with passkeys, Sign in with Apple or an email magic link (SN-D17).
  Playing never needs it. — open
- **I2** One R2 object per signed-in player, behind an `api/` route like `api/telemetry.ts`, with conditional writes
  (SN-D18). — open
- **I3** The merge rule (SN-D19): per zone section, quests keep the furthest step, coins, bag and travelling items take
  the newest write. — open
- **I5** Account linking and deletion in Settings (SN-D21, SN-D23); magic links sent through Resend (SN-D22).
  Telemetry never carries the account (SN-D24). — open
- **I4** A test: play on device A, sign in on device B, and expect the same quests, travelling items and profile. — open

**Done when** a signed-in player continues on a second device, and a player who never signs in sees no change.

### J. A server-only part of each shard (M, SN-D15)

Today one `shard.json` and every file ship to every client; the template's `critical` roots include the sim script
hashes listed in `sim.scripts`, and `ledger`, `encounters`, `serverBudget` and host-privacy state sit in the same
document (`public/shardfiles/_template/shard.json`).

- **J1** Each section and `files` row gets a side: `server`, `shared` or `client`. — open
- **J2** The build writes two cuts: `shard.json` (shared + client) and `shard.server.json` (everything). The client
  cut lists server file hashes and costs but not their bytes. Single-player loads both, behind the same admission.
  — open
- **J3** A check: no view or presentation module reads a `server` section (the other side of WASM-HOST W13's
  headless sim lane). — open

**Done when** every shard builds both cuts and J3 passes.

## Open questions (answer when the plan is unparked)

- **Q1 Where does the player record live?** Recommended: one save-store key per slug, with the existing versioned
  store and migrations. A future server serves the same record.
- **Q2** answered by SN-D5 (Cloudflare R2, last 10 per shard). **Q3** answered by SN-D7 (never).

## Not in this plan

- A `world` state scope (audit idea 7): shared world state is already SHARD-PLATFORM-NEXT S10.
- Anything the audit says not to borrow: separate places with teleports, one binary place file, a runtime tree any
  script can change, free-form attributes, per-frame scripting, author-set streaming radii, client-owned physics, a
  creator marketplace, live shared editing, per-shard GUIs, opt-in sandboxing.
