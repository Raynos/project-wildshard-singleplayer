# The one-shot build — a review

> What [Raynos/project-wildshard](https://github.com/Raynos/project-wildshard) actually built, read from
> `origin/main` at **bb608d4** (2026-09-18) on 2026-09-30. Read-only review; nothing was changed.
>
> **Verdict on reuse:** treat its shard-file format as **buggy and not to be ported**. This doc is a map of how one
> attempt tackled every requirement — useful for ideas and for knowing where the hard problems are, not as a base.

## Heads-up: the local checkout is stale

`~/projects/games/project-wildshard` is still at the 7-commit scaffold (2 source files). The real work is 824 commits
on `origin/main`, 408 of them on 2026-09-17 alone. Read it with `git show origin/main:<path>` or pull first.
`codex/playable-integration` is identical to `main` (both bb608d4).

## Size and shape

- ~86k lines of TypeScript excluding tests: server ~52k, client ~17k, shared ~17k. 306 test files.
- Node ≥ 22 running TS directly (no build step), three.js 0.186, Vite, Playwright.
- A very heavy paper trail: the binding brief `project/charter/BRIEF.md`, 54 ADRs in `project/adr/`, contracts in
  `project/design/`, hundreds of journal and report files. Much of the commit volume went to reports, journals and
  gate evidence rather than working code.
- Status (`project/status/project-status.md`): 70 of 88 requirements verified, `release_ready:false`. That status
  predates the viewer merge, so its renderer blockers are partly outdated.

## The shard file

- **Package:** a `.shard` file — a ZIP whose first entry is `chunk.json`, stored uncompressed. (`budgets.json` still
  says `.wildshard` in one place.)
- **Manifest** (`content/schema/manifest.schema.json`): `schema_version: 1`, `kind: "wildshard.chunk.manifest"`,
  `chunk { name, invitation, biome }`, `libraries { materials, lighting }`, `revision { parent_revision }`, and
  `entries[]` of `{ path, kind, sha256, size_bytes }`. Deliberately **no** chunk id, revision, author, placement or
  host — those are server-owned.
- **Schemas:** a closed layout (`content/schema/layout.json`), 19 schemas in `content/schema/*.schema.json`, and
  **every numeric limit in one file**, `content/schema/budgets.json` (container, geometry, assets, content, awards,
  behaviour fuel, combat, traversal, ingress), referenced from schemas via `x-ws-budget`.
- **Validator** (`src/server/upload/pipeline.ts`), 11 stages in order: container → manifest → entry reconciliation →
  strict JSON → denied keys → schema → ids / refs → budgets → semantics / behaviour → assets → spatial. A
  hand-written ZIP reader with capped inflate (`zip.ts`). The spatial stage (`src/shared/spatial/*`) checks the road
  entries are **walkable** — the most common rejection. Rejection corpora in `content/examples/rejects*/`.
- **Tools:** `pnpm shard:validate`, `pnpm shard:pack` (recomputes digests) in `src/server/upload/shard-cli.ts`; a
  skill at `skills/wildshard-shard/` with `references/format.md` and `references/rejections.md`.
- **Upload:** `POST` via `src/server/net/uploadroute.ts`, capability token checked before any body bytes are read.
- **Storage** (`src/server/upload/store.ts`): `quarantine/` → `revisions/<chunk>/<rev>/` → `heads/<chunk>.json`
  (activation is an atomic rename) → `public/assets/<chunk>/<sha>`. Private chunks publish nothing. Every revision is
  kept.

## Content loading

Purely declarative — no uploaded code runs.

- **Behaviour:** event → condition → action rules (ADR 0007; `src/shared/behaviour/{vocabulary,interpret,validate,limits}.ts`).
  Events like `plate_pressed`, `zone_entered`, `quest_step_completed`, `timer_elapsed`; actions like
  `set_variable`, `add_variable`, `start_timer`, `advance_quest`, `play_sound`, `show_message`. No arithmetic, no
  loops; fuel and cascade-depth limits. The interpreter is a pure `dispatch()` that **returns effects** rather than
  acting.
- **Materials:** must name entries in a committed server material library, or use closed KTX2 profiles. Custom
  shaders are refused.
- **Data files with schemas:** quests (ordered steps, own-chunk references only), npcs, dialogue, enemies, items,
  interactables, doors, awards, achievements, titles, cosmetics. Awards granted once, kept across reconnects
  (`retainedvault.ts`). Combat caps enforced server-side.

## Multiplayer

- Hand-written zero-dependency WebSocket server (`src/server/net/websocket.ts`); ADR 0011 tried and rejected Colyseus.
- 30 Hz simulation, 15 Hz snapshots (`src/shared/net/tick.ts`); client prediction, reconciliation, interpolation in
  `src/client/net/`.
- Server authority; one room per chunk id (`rooms.ts`); a static trusted host registry with `wrong_host` refusal
  (`hosts.ts`); cross-host handoff with fencing and epochs (`handoff.ts`, `fencing.ts`); the highway as a transit
  room (`transit.ts`).
- **Live update:** pin → drain → evacuate → swap → re-admit (`lifecycle.ts`) — evacuate-and-return, not a seamless
  swap.
- **Persistence:** no database. fsynced append-only JSONL journals (`jsonl.ts`, `authorityjournal.ts`,
  `grantjournal.ts`) and atomic-rename JSON (`world-catalogue.ts`).
- **Identity:** no accounts — a deployment-wide HTTP Basic gate (`basicboundary.ts`) plus a durable anonymous
  bearer-cookie PlayerId (`player-session-identity.ts`). Chat and Name / Title designed (ADR 0005), not built.

## World and ownership

- 5 × 5 cells 515 m apart, centre {2,2} (`src/shared/net/grid.ts`).
- The later `docs/shard-product-contract.md` (2026-09-17) replaced the single hardcoded centre with a **9-cell
  citadel** of ordinary shards (`content/examples/conforming/landing-citadel-cell-*`).
- Placement (`activity.ts`, ADR 0015): nearest free cell outward from the centre; popularity = distinct meaningful
  visitors over 30 days, **author excluded**; archive candidacy on a 7-day band with hysteresis; `E_GRID_FULL` rather
  than eviction when full. Takeover of abandoned shards on a 90 / 30 / 30-day clock (`renovation.ts`).
- One-editor lock ("chisel"), invitations, privacy (`collaboration.ts`, `invitations.ts`, `access.ts`).
- Not built: bin-packing across hosts.

## Working vs partial vs absent

| Working, with tests | Partial | Absent |
|---|---|---|
| Validator, CLI, skill | 9-beacon ritual: real server-side (`staging-ritual.ts`) and wired client-side, but the visible UI is an "Upload privately" file picker (`shard-upload-ui.ts`) | Chat, Name / Title |
| Rooms, authority, handoff | Upload → publication only partly wired (status gap T-0119-GAP-1) | Real accounts |
| Revision swap with players inside | Multi-shard world: a dev catalogue (`scripts/demo-host.ts`, `production_ready:false`) with low-detail neighbour views (`src/server/derived-overview/`) | Host bin-packing |
| Access control | Save-state migration: `planStateMigration` has no production caller | Load and soak tests |
| Server-side gameplay from loaded chunks; the three.js renderer and viewer | | The full 25-shard authored world |
| The Lantern Tide pirate shard, end to end in a hosted browser with two players | | |

## Ideas worth keeping (as ideas)

- Budgets in **one file**, referenced by schemas.
- **Server-owned fields** (id, revision, placement, host) kept out of the author's manifest.
- **Quarantine → atomic head flip** for activation; private shards publish nothing.
- A **pure, effect-returning** behaviour interpreter with fuel and cascade limits.
- **Spatial validation** that proves road entries are walkable, not just present.
- Popularity that **excludes the author**, with hysteresis.
- Rejection corpora: example shards that must fail, one per rule.
- `pack` recomputing digests and `validate` running the **same pipeline the server runs**.

## Lessons

- A single fast loop can produce a lot of contract and infrastructure, but it also produced a format now judged
  buggy and an unpolished game. The singleplayer repo's heavily steered approach got the polish; the platform still
  needs to be designed deliberately (see [SHARD-PLATFORM-PLAN](SHARD-PLATFORM-PLAN.md)).
- Paper trail is not progress: keep plans and ADRs in proportion to working code.
