# SF65: LEGACY / SHARDFILE entry from SHARD SELECT (G237–G241, E435)

iPhone 16 Pro portrait captures, muted, from a `serve-build.sh --rev` preview of the SF65 commit. Script: `capture.mjs`
(results: `capture.json`).

## What changed

- **Developer ON**: the selected card's ENTER WORLD is two buttons in the same footprint: **LEGACY** ("ORIGINAL TYPESCRIPT")
  and **SHARDFILE** ("CURRENT PORT STATE"). Every card wears an **N% PORTED** badge: the SF6 public SDK share from
  `scripts/shard-platform.mjs`, generated at build time into `src/game/shard/portShares.generated.ts` by `pnpm gen`.
- **SHARDFILE disabled, "NOT YET"** where the shard has no standalone shardfile boot (Nine Dragon, Signal Dunes, Sky Reach).
- **LEGACY disabled, "SHARDFILE ONLY · NO LEGACY"** where the shard has no TypeScript plugin (the template, G241).
- **Developer OFF**: one ENTER WORLD, no badge. Each shard boots its public entry, unchanged: Driftwood hybrid, the rest legacy.
- The `pineHybrid` and `nalatiHybrid` Debug rows are gone (G239); `debugRows.max` 7 to 5.
- Feedback notes carry `entry` (legacy / shardfile) beside `shard` (G240); the composer shows it on its own Entry row.

| Shard | Badge | LEGACY | SHARDFILE |
|---|---|---|---|
| Driftwood Isle | 1% PORTED | TypeScript runtime alone | SF46 hybrid (the public boot) |
| Pine Hollow | 3% PORTED | public boot | SF47 hybrid |
| Nalati Grasslands | <1% PORTED | public boot | SF48 hybrid |
| Nine Dragon Stack | <1% PORTED | public boot | NOT YET |
| Signal Dunes | <1% PORTED | public boot | NOT YET |
| Sky Reach | 1% PORTED | public boot | NOT YET |
| Template shard | 91% PORTED | SHARDFILE ONLY · NO LEGACY | the built shardfile |

## Files

- `A-developer-off.jpg`: the public SHARD SELECT, unchanged.
- `B-developer-on-<shard>.jpg`: every card with Developer on.
- `C-<shard>-<mode>.jpg`: in the shard after entering from that button.
- `D-note-<shard>-<mode>.jpg`: the note sheet's Shard and Entry rows.
- `F-pine-hollow-*.jpg`: Pine fails to load both ways on this tree (see below).

## Entering each way

| Card | Button | Entered | Load (s) | fps | Note sheet |
|---|---|---|---|---|---|
| Driftwood Isle | LEGACY | yes | 9 | 30 | Shard driftwood-isle · Entry legacy |
| Driftwood Isle | SHARDFILE | yes | 7 | 30 | Shard driftwood-isle · Entry shardfile |
| Nalati Grasslands | LEGACY | yes | 10 | 30 | Shard nalati-grasslands · Entry legacy |
| Nalati Grasslands | SHARDFILE | yes | 12 | 30 | Shard nalati-grasslands · Entry shardfile |
| Nine Dragon Stack | LEGACY | yes | 10 | 30 | Shard nine-dragon-stack · Entry legacy |
| Nine Dragon Stack | SHARDFILE | disabled: NOT YET | | | |
| Signal Dunes | LEGACY | yes | 10 | 30 | Shard sunscar-dunes · Entry legacy |
| Signal Dunes | SHARDFILE | disabled: NOT YET | | | |
| Sky Reach | LEGACY | yes | 10 | 30 | Shard far-reach · Entry legacy |
| Sky Reach | SHARDFILE | disabled: NOT YET | | | |
| Template shard | LEGACY | disabled: SHARDFILE ONLY · NO LEGACY | | | |
| Template shard | SHARDFILE | yes | 9 | 30 | Shard _template · Entry shardfile |
| Pine Hollow | LEGACY | no: Pine Hollow could not load |  |  |  |
| Pine Hollow | SHARDFILE | no: Pine Hollow could not load |  |  |  |

The page errors were 0 on every run; the session slot held the chosen mode each time.

## Not done here

- **Pine Hollow fails to load either way** ("Compressed texture 40 has no mipmaps and is not resident on this renderer",
  stage `finish`). LEGACY is Pine's unchanged public boot and fails the same way, so this comes from the tree, not from SF65 (the SF57
  compressed-mips work and the Pine P0 lane).
- Signal Dunes and Sky Reach already run as hybrids in INFINITE WILDSHARD (their `gridShardfile`). Their standalone
  SHARDFILE stays NOT YET until their conversion rows add a standalone hybrid boot (`entries.shardfile: true` in the manifest).
