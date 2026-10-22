# Legacy folders: what depends on them, and the deletion rows (G604)

Jake, 2026-10-22: *"Explore world … is that still built on top of the legacy shards, or is that built on top of the shard
files? … What other things in the game are going to break when we delete all the legacy shards?"* Then (G604): legacy
folders are deleted only on his word, after all shards are at zero, all grid-ready, a stable finished build and his full
phone QA of all six shards in SHARD SELECT. Audit by the plan agent's subagent at HEAD adba978f4a → 861e8a6414.

## The answer

**Explore (hub, Model / Set / World explorers, compare), the practice arena, the horse and grapple arenas, SHARD SELECT's
ENTER WORLD and Infinite Wildshard all run on the shardfile builds for all six shards.** None imports a `*-legacy` folder:
Explore boots the normal shard (`game/travel.ts:76`) and opens its viewer over that world (`play.ts:470-490`); its lists
come from shardfile data (`explorerCatalogue`, `clientPlaceSets`, `worldSceneWeld.ts:227`); the arenas come from
shardfile rows (`practice/registration.ts`, `clientPlan`). The only runtime path into legacy is Developer ▸ Debug ▸
"Legacy shard buttons" (`shard/legacy.ts:15-20`; Driftwood, Pine, Nalati, Nine). **No mini plan is needed to move Explore.**

Deleting the folders today breaks the **pipeline, not the game**. The legacy folders are 1,147 files, ~26.7 MB,
~132.7k TS lines.

## What breaks if every `*-legacy` folder goes today (worst first)

1. **Shardfile builds fail, so nothing deploys:** the AS budget for Driftwood, Pine, Nalati, Sky, Signal is read only
   through the legacy list (`gen-decision-policy.mjs:9-12`, `wildshard.mjs:47`); `buildDecisionScripts.ts:20-23` throws in
   clean checkouts and CI (a stale ignored file hides it locally).
2. **The Developer LEGACY button half-boots the normal shard** (`entries.legacy: true`, `context.ts:272`, `declaredEntry.ts:20,36`).
3. **The ruler throws and the zero verdict goes null** (`ruler.mjs:114-115`, `shard-platform.mjs:986-998`); the pinned
   baselines in `lint/legacy-line-basis.json` are looked up through the legacy list.
4. **A generator and its test go red:** `scripts/bake-pickups.mjs:12,14`, `generation-jobs.json:1062,1066`, `test/pickup-catalogue.test.ts:47-48`.
5. **Small type/tool breaks:** `test/shard-select-entries.test.ts:78` (`'pine-hollow-legacy'`), `scripts/families-board/part2.js:21`.
6. **Dead code left behind:** ~16 engine/game/SDK modules (~790 lines) only legacy imports (`DebugOverlay`, `nalatiArms`,
   `waterSurface`, `Thrown`, `faunaLayout` …), legacy-only exports, `lint/host-reviews.json` frozen exceptions, ~50
   `check-models.mjs` and 23 `runtime-performance.json` entries.
7. **The debugging reference is gone** (why G573 keeps them until Jake's QA).

## Rows

Rows LD1–LD4 delete nothing and need no QA; LD5–LD8 wait for Jake's word (G604). **Jake's picks (G606):** LD1–LD3 now, behind the zero work; LD4 once per shard as it reaches zero, before his QA; the LEGACY button stays until deletion day; LD6 deletes in pairs: Sky + Signal, Pine + Driftwood, Nalati + Nine.

| Row | What | Size | Done when |
|---|---|---|---|
| **LD1** | Each shard declares its own AS budget (`shard.config.ts` or `legacy-line-basis.json`; Driftwood 1716, Pine 2130, Nalati 2837 already hard-code theirs in their bake scripts) | S | all six build in a mirror with the legacy list emptied; budgets unchanged |
| **LD2** | Pickups generator without the legacy tables | XS | pickup test green; the job has no `-legacy` input |
| **LD3** | Ruler baselines read by shard name, not through the legacy list | S | an empty legacy list gives the same numbers and zero verdicts |
| **LD4** | Explorer parity, once per shard at a milestone (one browser lane): Explore in LEGACY vs SHARDFILE, model / set / world / arena lists compared | M | each diff empty, or every gap is a row in that shard's zero plan |
| **LD5** | Remove the LEGACY button: Debug row, dual buttons, legacy entry mode and loading path, `shard/legacy.ts`, `entries.legacy` | S | SHARD SELECT shows one ENTER WORLD everywhere |
| **LD6** | Delete the folders, one commit per shard: Sky + Signal (already unreachable), then Driftwood + Pine, then Nalati + Nine; each drops its list entry, regenerates `slugs.generated.json`, prunes lint entries | M | gates green per commit |
| **LD7** | Delete legacy-only engine/game code with each LD6 commit (~16 modules, exports, frozen exceptions) | M | nothing left whose only importer was legacy |
| **LD8** | Retire the legacy tooling: `legacy-shards.json`/`.mjs`, lint/script exemptions, `LEGACY_SHARDS`, synthetic legacy tests | S | `git grep legacy-shards` finds nothing |
