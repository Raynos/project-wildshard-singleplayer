# Shardfile vs Roblox: what to borrow

Ask: [E497](../tasks/asks/E497.md). Jake: *"Audit and review how our shardfile format compares to Roblox and what are
the top 10 ideas we should borrow. Basically we want to keep our MMO but there's learnings to be had."*

Audited 2026-10-24 against local `main` (`be7c3e1dcd`) and the Roblox Creator docs. Read-only: nothing in the repo
changed except this file.

## 1. Verdict

The Shardfile is stricter and safer than a Roblox place, but less ready to be a live MMO zone. We are well ahead
on the parts a phone and AI builders need: every byte is hashed and costed, admission runs before any load, the
scripts are fuel-metered Wasm with capability lists, the source is all text, and a continuous grid of zones is a
first-class idea. Roblox is ahead on the parts a running online world needs. It keeps server-only content
apart from client content. Player data lives apart from world state. Each place has its own version history and
rollback. Objects carry generic tags. Each model can choose how it streams. Builders get a live editor. And
analytics come built in. The top ten ideas below are mostly about those gaps. None of them asks us to stop being one
continuous, AI-built, budget-first world.

## 2. Side by side

Each concept: what Roblox does, what we do (with files), and who is ahead.

### Package

- **Roblox:** a place is one `.rbxl` (binary) or `.rbxlx` (XML) file holding the whole DataModel, up to 100 MB.
  Assets live outside it, named by numeric asset id.
- **Wildshard:** a built `shard.json` plus immutable files named by SHA-256, with exact wire, decoded and GPU sizes
  for each file (`docs/SHARDFILE.md` "Shardfile 0.x", the `files` row). The template's product has 42 top-level
  sections (`public/shardfiles/_template/shard.json`, a build output).
- **Ahead:** Wildshard. Content addressing gives us dedupe across shards, offline caching
  (`docs/CONTENT-CACHE.md`) and costs checked before a fetch.

### Scene tree

- **Roblox:** one Instance tree. Each node has a class and typed properties. Services (Workspace, ReplicatedStorage,
  ServerStorage, ServerScriptService, StarterPlayer, StarterGui, Lighting…) are the fixed top-level layout. Every
  tool, script and person reads that one tree.
- **Wildshard:** no tree ships. A three.js scene exists only at build time (`readScene` / `wildshard synth`,
  SHARDFILE.md "Authoring scene input (DS1.3)"). The product is flat sections of rows keyed by dotted ids
  (`template.door`, `template.door.use`). The format has about 300 schema modules in `src/format/`, one per
  mechanic (`bossEncounter.ts`, `herdShelter.ts`, `grazers.ts`…).
- **Ahead:** Roblox for discoverability. Wildshard for cost and safety. Our flat rows are easy to budget, but there is
  no single place to "see the zone".

### Scripts

- **Roblox:** Luau. `Script` runs on the server, `LocalScript` on the client, `ModuleScript` is shared code. A script's
  place in the tree and its `RunContext` decide where it runs. Scripts can touch almost any engine API, every frame.
- **Wildshard:** AssemblyScript compiled to Wasm (`behaviour/*.as`). Each script row declares its capabilities.
  Fuel is metered, memory is fixed (1–4 pages) and `memory.grow` is refused. Decisions run at most 10 Hz and only
  when events are queued. Commands are a checked whitelist (`docs/SCRIPT-ABI.md` "Commands and authority",
  "Limits, cadence and failures").
- **Ahead:** Wildshard for safety and phone cost. Roblox for expressiveness.

### Types

- **Roblox:** Luau has gradual typing: `--!strict`, `--!nonstrict` or `--!nocheck` per script.
- **Wildshard:** strict TypeScript at build time, typed AssemblyScript, and every section is checked against Valibot
  schemas before any field is read. `wildshard schema` prints them (SHARDFILE.md "Inspect author declarations").
- **Ahead:** Wildshard.

### Data on objects

- **Roblox:** Attributes are free-form custom properties on any Instance, with change signals. CollectionService
  tags put string labels on instances. Code finds them with `GetTagged` and reacts with added/removed signals.
- **Wildshard:** `state` declares named, typed and bounded shared and per-player fields, each with a privacy level
  (`public`, `owner`, `host`; SHARDFILE.md section table). Placed props, colliders and targets have no tags. For
  example, the template's `props.colliders` rows have only `id`, `initialActive`, `panel` and `shapes`.
- **Ahead:** a split. Our fields are safer than Attributes. Roblox's tags are something we lack.

### Assets and shared libraries

- **Roblox:** `rbxassetid://` ids, moderation, the Creator Store. Packages are reusable groups with version history,
  `AutoUpdate` and "Update All".
- **Wildshard:** the `@wildshard/commons` packs (`src/commons/`). At build time a stable entry id resolves to a hash
  (`catalogueRef` in `src/commons/catalogue.ts`). The product pins exact `commons:<hash>` references with exact
  costs (`requires.commonsWire` / `commonsCosts`).
- **Ahead:** Wildshard on integrity. Roblox on workflow: there is no lock or "outdated" report, so a shard picks up
  a commons change silently on its next build.

### Streaming

- **Roblox:** `StreamingEnabled` (on by default for new places), with min and target radii and a stream-out policy.
  Each model can set `ModelStreamingMode` to `Atomic`, `Persistent` or `PersistentPerPlayer`. Code can ask for
  extra foci and `RequestStreamAroundAsync`. SLIM gives far-away detail.
- **Wildshard:** budget-first. 62.5 m (L0) and 125 m (L1) tiles with exact costs, `critical` and `library` roots,
  a whole-shard `far` proxy, and an allocator that charges each byte once (SHARDFILE.md "Minimal singleplayer
  load"). Hard caps are 1,000 MB playing and 1,800 MB loading. A tile row carries bounds, files and costs, but no
  grouping or persistence class.
- **Ahead:** Wildshard on memory safety. Roblox on author control of what stays loaded.

### Travel between zones

- **Roblox:** an experience holds many places. `TeleportService.TeleportAsync` moves players between them through a
  loading screen, optionally into reserved servers. The docs warn that teleport data is visible to the client.
- **Wildshard:** one continuous grid. Cells are 500 m on a 562.5 m pitch, joined by roads. There are four 8 m
  entryways per cell, at most four resident sims, and neighbours prefetch on the road approach
  (`docs/GRID-SIMULATION.md`; `src/game/grid/catalogue.ts`). Placements are stable instances such as `template-2`,
  so one product can fill several cells (`src/game/grid/copyIdentity.ts`).
- **Ahead:** Wildshard, by design. This is the MMO we want.

### Networking and trust

- **Roblox:** a real client/server split. RemoteEvents, UnreliableRemoteEvents and RemoteFunctions cross it. The
  docs say to treat every client call as hostile: check types, bounds and NaN, check distance and state, and
  rate-limit with token buckets. ServerStorage and ServerScriptService never reach clients.
- **Wildshard:** single-player today. Shards are written to be "MMO compatible": `sim` is the 60 Hz authority,
  `authorCaps.players` is 1–32, `serverBudget` is declared "not a server implementation", and field privacy is
  declared. Script commands are checked before they stage. But the whole product ships to the client, the sim's Wasm
  included. In the template, the `critical` list names the two sim script hashes from `sim.scripts`.
- **Ahead:** Roblox. We have the authority model on paper, but no content partition and no checks on
  player-issued requests.

### Persistence

- **Roblox:** DataStores are server-only key/value storage. They have `UpdateAsync`, versions on each key and
  metadata. MemoryStores hold short-lived data shared across servers (sorted maps, queues, hash maps; up to 45 days).
  A place's world state is thrown away when its server ends.
- **Wildshard:** a save store with a version and migrations on each key (`src/engine/saves/store.ts`). Each instance
  has a region continuation, `platform.region`, holding an exact sim snapshot plus a logical checkpoint
  (`src/game/grid/durability.ts`). A changed product revision drops the instance checkpoint, quest flags in it
  included (SHARDFILE.md "Local instance checkpoints"). Declared `migrations` exist, but their hooks stay null.
- **Ahead:** Roblox, for an MMO. Splitting player data from world state is the lesson.

### Sandboxing

- **Roblox:** Script Capabilities (RunServerScript, AccessOutsideWrite, Network, DataStore…) on sandboxed
  containers. The docs still call this experimental, a client beta.
- **Wildshard:** mandatory. Admission reads the bytes without running them. Imports are a whitelist, with no
  clock, entropy or DOM. Fuel, memory and depth have caps, and a script that fails three times is disabled
  (SCRIPT-ABI.md "Authoring, compilation and admission", "Limits"). Shard code cannot reach outside its folders
  (`wildshard/shard-sandbox`).
- **Ahead:** Wildshard.

### Versioning and publishing

- **Roblox:** each save of a place is a version with notes. Publishing is separate from saving. Restore makes a new
  version. "Restart servers for updates" can wait 1–60 minutes. The Open Cloud API can publish a place from CI.
- **Wildshard:** `SHARDFILE_VERSION = "0.1"` covers the format and the ABI, with "no version 1 freeze". Each product
  has a positive `identity.revision`. Products are build outputs and none are committed. The site ships as one unit
  (`.github/deploy-pin.json` pins one site SHA), and a grid placement names a `slug`, not a product hash
  (`src/game/grid/singleplayer.json`).
- **Ahead:** Roblox. We cannot pin or roll back one shard.

### Tooling and editing

- **Roblox:** Studio has an Explorer, live play-and-edit, Team Create with drafts and per-script history, Rojo for
  text sync, and an official Studio MCP server so AI agents can read and edit a live session.
- **Wildshard:** all text and git. `wildshard build`, `validate`, `schema`, `synth`, `prove`. `wildshard dev`
  rebuilds and *reloads the page* on each edit (`docs/SDK-DEV.md`). `ctx.debug.expose` puts handles on
  `window.__wildshard`.
- **Ahead:** Wildshard for agents who diff, review and gate. Roblox for fast, live iteration.

### Analytics

- **Roblox:** dashboards for D1, D7 and D30 retention, session time and monetisation. `AnalyticsService` has
  `LogFunnelStepEvent`, `LogOnboardingFunnelStepEvent`, `LogEconomyEvent` and `LogCustomEvent`.
- **Wildshard:** `api/telemetry.ts` takes anonymous session records and a fixed set of event names
  (`death.cause`, `quest.step`, `weapon.used`, `shard.time`, `level.time`, `boss.attempt`) with 30-day retention.
  `scripts/telemetry-brief.mjs` reads a daily digest. Shards cannot declare funnels.
- **Ahead:** Roblox.

## 3. Top 10 ideas to borrow

They are ranked by value to our MMO. Size: S is days, M is about a week or two, L is several weeks.

### 1. A server-only part of the product (ServerStorage / ServerScriptService)

- **Roblox:** content in ServerStorage and ServerScriptService never reaches a client. Only the server sees loot
  logic, spawn tables and boss scripts.
- **Us today:** one `shard.json` and every file ship to every client. The template's `critical` roots include the
  sim script hashes listed in `sim.scripts`. `ledger`, `encounters`, `serverBudget` and host-privacy state all sit
  in the same document (`public/shardfiles/_template/shard.json`). Field `privacy: host` exists for *values*, not
  for *content*.
- **Change:** give each section and each `files` row a side: `server`, `shared` or `client`. The build writes two cuts,
  `shard.json` (shared + client) and `shard.server.json` (all of it). The client cut lists server file hashes and
  costs but not their bytes. Single-player keeps loading both cuts for now, behind the same admission. Add one
  check: no view or presentation module reads a `server` section. That check is what W13 in
  `docs/plans/WASM-HOST.md` (the sim lane runs headless, with "no client-only inputs") needs from the other side.
- **Size:** M.
- **Risk:** single-player gains nothing visible this year. The value is that the split becomes honest early, before
  hundreds of AI-written rows assume the client can read everything.

### 2. Keep player data apart from world continuation (DataStores vs server state)

- **Roblox:** player progress lives in DataStores: small records, written by the server, versioned per key. A
  place's world state is disposable. When a server dies, nothing important is lost.
- **Us today:** the region save, `platform.region`, holds an exact sim snapshot (a budget of up to 512 K characters,
  `SIM_REGION_SNAPSHOT_CHAR_BUDGET` in `src/engine/sim/snapshot.ts`) plus a logical checkpoint
  (`src/game/grid/durability.ts`). Quest flags, steps and dialogue for an instance live in that checkpoint. A new
  `identity.revision` "starts fresh" (SHARDFILE.md "Local instance checkpoints"). Every AI rebuild that bumps a
  revision can wipe that progress.
- **Change:** name one small player profile record per shard: wallet, items with `travels: true`
  (`src/format/items.ts`), quest steps, ledger facts and the `state.player` fields. It is keyed by stable ids and
  versioned with the existing `migrations` rows. It is the source of truth and survives revisions. The exact
  snapshot becomes a cache, used only when the revision matches. Log out on desktop, log in on the phone (Jake's
  words in WASM-HOST W13): that is this record, served by the future server.
- **Size:** M to L.
- **Risk:** mid-fight exact resume still works on the same revision. After a revision bump the world resets, but the
  player keeps their progress. That is the Roblox trade, and the right one for an MMO.

### 3. Version history, pins and rollback for each shard (place versions, "restart servers")

- **Roblox:** every place keeps its own versions with notes. One place can be restored without touching the rest.
  Live servers move to the new version with a 1–60 minute delay.
- **Us today:** products exist only as build outputs. The whole site ships and rolls back as one SHA
  (`.github/deploy-pin.json`). A grid placement names `slug`, not a product (`src/game/grid/catalogue.ts`). So a bad
  Nalati build forces a choice: roll back every shard, or fix forward.
- **Change:** products are already content-addressed, so keep each published product by hash. Keep a small
  `versions` list per slug (revision, root hash, date, notes from the commit). Let a catalogue placement pin
  `product: <hash>` or follow `latest`. A one-line catalogue change rolls back one shard. Later, the MMO server uses
  the same list to move live cells to a new revision on a delay.
- **Size:** M.
- **Risk:** an old product must still pass the current client's `requires.sdk` and admission. Refuse the pin if it
  doesn't. Still one site and one deployment: a pin is data, not a second deploy.

### 4. Typed, checked player intents (RemoteEvents and the client-server boundary)

- **Roblox:** every client-to-server message is a named remote. The docs list the server's checks: types, finite
  numbers, distance, alive state, ownership and a token-bucket rate limit.
- **Us today:** a player's input becomes `plumbing.input` actions and `targets.interactions` scenes, each with a
  `radius`, plus item actions. Script commands get strong checks (SCRIPT-ABI.md "Commands and authority"). Player
  requests get no declared rate limit, range proof or state gate.
- **Change:** declare each player-originated request as an `intent` row: id, argument schema, the maximum rate,
  the range from the player's actor, and the required state field. Today's local sim runs exactly the checks a
  server will run. A test fires floods, NaN and out-of-range intents headless and expects refusals.
- **Size:** M.
- **Risk:** extra rows for every verb. Keep the defaults generous (range = the declared radius, rate = 10 Hz) so most
  rows stay one line.

### 5. Tags on placed things (CollectionService)

- **Roblox:** any instance can carry string tags. The docs say to put behaviour on tags rather than in scripts
  scattered through Workspace.
- **Us today:** each new mechanic tends to add a new schema module (about 300 in `src/format/`). Placed colliders,
  targets and spawns have no labels. The v1 ABI's list reads cover zones, players and paths, not "all things of a
  kind" (SCRIPT-ABI.md "Read whitelist").
- **Change:** add an optional `tags` list (≤ 8 short ids) to collider, target, spawn and placed-piece rows. Add a
  `tags` section that declares each tag with one line of meaning. Add a `tagged(tag)` list read and enter/leave-tag
  events in ABI v2. A host such as "burnable", "climbable" or "quest marker" then keys on a tag and needs no new
  section.
- **Size:** M.
- **Risk:** tags could become a stringly-typed back door for shard branches. Tags must be declared, the engine must
  never test a tag *name*, and the host-bar test "No shard nouns" (`docs/HOST-BAR.md`) applies to tag ids too.

### 6. Streaming classes for groups (ModelStreamingMode, RequestStreamAroundAsync)

- **Roblox:** `Atomic` loads a model as a whole. `Persistent` keeps a landmark loaded. `PersistentPerPlayer` keeps it
  loaded for chosen players. Code can ask the engine to stream around a point before a player arrives.
- **Us today:** content is either library (resident for the level) or tile-bound (resident by distance), plus one
  whole-shard `far` proxy. Tile rows carry no group or persistence class (template `tiles` rows). Neighbour prefetch
  is automatic on the road approach (`docs/GRID-SIMULATION.md`).
- **Change:** add a `stream` class on placed groups: `atomic` (a house never half-loads across a tile seam),
  `landmark` (always resident, charged up front), `quest` (resident while a quest step points at it). Add a
  `prefetch(x, z)` intent for lifts and portals before arrival (`entryways` kinds `socketLift` / `portalLink`).
- **Size:** M.
- **Risk:** each persistent group spends the 1.2 GB per-shard cap. The validator must charge landmark and quest sets
  at their worst case and refuse overages, exactly like `critical`.

### 7. A world scope for shared, short-lived state (MemoryStores)

- **Roblox:** MemoryStores give every server in an experience shared, expiring maps and queues. They are used for
  matchmaking, world events and global leaderboards.
- **Us today:** `state` has two scopes, `shared` (per instance, host-owned) and `player`. Nothing is declared for the
  grid as a whole. A storm, a roaming world boss or an "a beacon was lit somewhere" event cannot cross cells as data.
- **Change:** add a third declared scope, `world`. Fields are namespaced by slug, with a time to live, and owned by
  one shard. Other shards may read them through a declared `reads` entry. Single-player keeps them in the save
  store. The MMO keeps them in its shared store.
- **Size:** M.
- **Risk:** coupling between shards. Keep it one-way and declared: a shard never imports another shard, it only reads
  a namespaced field, and a missing field reads as its default.

### 8. Declared funnels and a scorecard for each shard (AnalyticsService)

- **Roblox:** funnel steps, economy events and custom events are logged per experience. D1 retention and session
  time are the first numbers creators read.
- **Us today:** `api/telemetry.ts` accepts six fixed event names, and `scripts/telemetry-brief.mjs` reads a daily
  digest. Shards cannot say what "progress" means for them.
- **Change:** derive a funnel for each shard from its quest graph (`quests` section): step reached, time to step,
  where people stop. Log coins in and out by source from the `ledger`. `telemetry-brief` prints one scorecard per
  shard. AI-built shards get a real signal of which places are fun, not only Jake's playtests.
- **Size:** S to M.
- **Risk:** few players today, so the numbers are thin. The scorecard is a read of existing telemetry, not a new bot
  (G585), and it never asks Jake to do anything.

### 9. A live dev session agents can drive (Studio live edit and the Studio MCP server)

- **Roblox:** Studio edits a running place, and its built-in MCP server lets an AI agent read scripts, insert assets
  and act inside the open session.
- **Us today:** `wildshard dev` rebuilds and reloads the page on every edit. The player starts again from spawn
  (`docs/SDK-DEV.md`). Agents poke `window.__wildshard` handles through ad hoc scripts.
- **Change:** in DEVSERVER builds only, hot-swap a changed data section in place. Re-admit it, restore the
  same-revision logical checkpoint and keep the player's pose. Add a small, documented agent port next to it:
  list entities and tags, read state fields, move the player, fire a scene event, capture the frame.
- **Size:** M to L.
- **Risk:** it must stay behind `__DEVSERVER__`, never a URL switch. It must respect the four-browser cap on the
  shared Mac. A hot swap has to fall back to a full reload when the swap is not safe (scripts or colliders changed).

### 10. Lock and "outdated" reports for commons (Packages / AutoUpdate)

- **Roblox:** a package copy records which version it uses. Updates are offered, applied one by one or with
  "Update All", and changed copies are never overwritten.
- **Us today:** `catalogueRef` resolves a commons id to the current hash at build time (`src/commons/catalogue.ts`).
  The next build of every shard silently takes a changed pack. That is risky when each shard keeps its own style
  (Driftwood toon, Nalati painterly, Pine photoreal).
- **Change:** keep a `commons.lock.json` per shard (id → hash). Add `wildshard commons outdated` and
  `wildshard commons update <id>`. A shard keeps its locked bytes until someone updates it on purpose.
- **Size:** S.
- **Risk:** two shards on two versions of one pack hold both sets of bytes. The allocator charges each hash once
  per resident shard, so the report should show the extra memory a lag costs.

## 4. What not to borrow

- **Separate places and teleports.** Roblox splits big worlds into places joined by loading screens. Our grid with
  roads and prefetch is the MMO. Keep `portalLink` entryways as places inside the grid, not as a way to leave it.
- **One monolithic place file.** A 100 MB binary DataModel can't be diffed or reviewed, and it can't be deduped
  across zones. Ten agents share one `main`. Text sources and hashed products suit them.
- **A runtime tree any script can change.** `Instance.new` anywhere, at any time, defeats budget-first admission and
  the 1.2 GB per-shard cap. Spawns and placements stay declared and costed.
- **Free-form Attributes.** Typed, bounded, privacy-labelled `state` fields are better. Take tags (idea 5), not
  untyped properties.
- **Per-frame general scripting.** Luau with the full engine API every frame suits Roblox's PCs and laptops. Our
  scripts are event-driven, 10 Hz and fuel-metered on an iPhone. Keep it that way. Per-frame drawing stays in
  platform hosts.
- **Author-set streaming radii.** `StreamingTargetRadius` lets each place pick its memory use. For us, memory is a
  platform limit, not a shard choice. Authors get streaming *classes* (idea 6), never radii.
- **Client network ownership of physics.** Roblox lets clients simulate nearby parts, and its own docs warn that
  exploiters abuse this. Our server-authoritative, state-based plan (WASM-HOST W13) is the safer path.
- **A UGC marketplace, moderation and the Creator Store.** Our content is first-party and built by AI. Shared content
  goes through commons and the host bar, not through a store.
- **Team Create on one live document.** Live shared editing would bypass git, the commit hooks and the push gate.
  Our agents already work in parallel on one `main` with small commits.
- **Per-place GUIs and Studio settings toggles.** One HUD is shared (E332), and new shards use the baseline.
  Variants go in pause ▸ Settings ▸ Debug rows, never in settings or URL switches.
- **Opt-in sandboxing.** Roblox's capability sandbox is an experimental opt-in. Ours is mandatory admission. Never
  relax it to match.

## 5. Sources

Roblox (Creator docs unless noted):

- Data model and services: https://create.roblox.com/docs/projects/data-model
- Place files: https://create.roblox.com/docs/en-us/projects/place-files
- Script types and RunContext: https://create.roblox.com/docs/scripting/locations
- Luau type checking: https://create.roblox.com/docs/luau/type-checking
- Attributes: https://create.roblox.com/docs/scripting/attributes
- CollectionService: https://create.roblox.com/docs/reference/engine/classes/CollectionService
- Packages: https://create.roblox.com/docs/projects/assets/packages
- Assets and asset ids: https://create.roblox.com/docs/projects/assets
- Experiences and places: https://create.roblox.com/docs/production/publishing/publish-experiences-and-places
- Teleporting: https://create.roblox.com/docs/projects/teleport
- Instance streaming: https://create.roblox.com/docs/workspace/streaming
- Remote events: https://create.roblox.com/docs/en-us/scripting/events/remote
- Client-server boundary: https://create.roblox.com/docs/en-us/scripting/security/client-server-boundary
- Data stores: https://create.roblox.com/docs/cloud-services/data-stores
- Memory stores: https://create.roblox.com/docs/cloud-services/memory-stores
- Script capabilities: https://create.roblox.com/docs/scripting/capabilities
- Version history: https://create.roblox.com/docs/en-us/projects/version-history
- Releasing updates and restarting servers: https://create.roblox.com/docs/projects/update-games
- Open Cloud place publishing: https://create.roblox.com/docs/cloud/guides/usage-place-publishing
- Collaboration (Team Create): https://create.roblox.com/docs/projects/collaboration
- Studio MCP server: https://create.roblox.com/docs/studio/mcp
- Analytics: https://create.roblox.com/docs/production/analytics
- AnalyticsService: https://create.roblox.com/docs/reference/engine/classes/AnalyticsService
- Rojo sync details: https://rojo.space/docs/v7/sync-details/
- Rojo project format: https://rojo.space/docs/v7/project-format/

Ours: `docs/SHARDFILE.md`, `docs/SCRIPT-ABI.md`, `docs/HOST-BAR.md`, `docs/SHARDS.md`, `docs/GRID-SIMULATION.md`,
`docs/CONTENT-CACHE.md`, `docs/SDK-DEV.md`, `docs/plans/SHARD-PLATFORM.md`, `docs/plans/WASM-HOST.md`,
`src/shards/_template/`, `src/shards/sunscar-dunes/`, `src/format/`, `src/game/grid/`, `src/commons/catalogue.ts`,
`src/engine/saves/store.ts`, `api/telemetry.ts`, and the built `public/shardfiles/_template/shard.json`.
