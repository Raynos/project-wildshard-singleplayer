# Candidate 6 local mounted Site check

## Verdict

24/25 harness checks passed. This is partial functional evidence, not an overall pass or a release/quality recommendation. Player defeat was not reached: ordinary AI attacks reduced the player from 100 to 20 HP inside the 180-second wall-time window. The blocked-after-defeat attack was therefore not attempted. The separate same-product supplement supplies zero-HP and blocked-attack evidence, not this mounted run.

The exact 137-file candidate 6 host was routed only on loopback `/mantis-engine/` while the actual Site HTML stayed unchanged. Product source hash: `1411a8ac1dbbbc08e9da4e3857ac9b369de248e491a23ba25566279842a59996`. No source rebuild, host edits or public deployment occurred. Candidate 4 remains the existing public Mantis host.

## Observed passes

- Actual desktop Site Play link opened the mounted host; Start entered the native single-Mantis arena.
- Cloud iPhone 16 Pro emulation: 402×874 CSS pixels, device DPR 3, engine pixel ratio 2, canvas 804×1748, touch enabled.
- Ordinary touch sword attacks killed the 55-HP Mantis. Practice reward was exactly 3 coins, complete and practice-scoped. No corpse strike or post-death player damage occurred during the observed reward window.
- Retry after reward reset actor identity, 55 enemy HP, 100 player HP and zero/incomplete reward; read-only animation-frame observations avoid a late health sample hiding an earlier reset.
- Ordinary AI attacks damaged the player. Retry after that damage and reload/reentry returned fresh state.
- Browser local/session stores stayed empty. World document keys and shard state stayed empty and shard generation stayed 0 throughout.
- Mounted/reloaded asset paths stayed under the mount, with no runtime errors or failed requests.
- All 137 candidate host files matched the frozen manifest before and after. All 194 broader frozen inputs/product/host files matched during and after the run. All four existing 137-file Site hosts and Site index HTML remained byte-identical.

## Evidence and limits

`run1/report.json` is the unchanged raw harness report. Inherited field names `playerDefeat`, `playerDeathDoesNotKillEnemy` and `retryAfterDefeat` refer to the attempted defeat phase; they do not establish player death. The explicit `playerDefeated:false`, 20-HP sample and overall `pass:false` control interpretation. There is no `defeatedAttackBlocked` result because that branch was not reached.

Screenshots are actual native first-person rendering with viewmodel, without observer camera or overlay. Only diagnostic player placement and aim were changed, with every placement logged. Placement uses inward angles near walls. No enemy state, health, damage, clocks, RNG or simulation-rate edits occurred. Browser audio was muted. The owned browser/server closed after completion.

This cloud Chromium software-rendering run establishes neither physical iPhone/Safari behavior nor performance, collider/visual acceptance or fun. Separate main and supplement pose/film reviews retain their own limitations; mounted gameplay checks do not replace them.

## Reproduction and provenance

Use the installed Chrome headless shell and dependencies, with HOME pointing to repo/tmp/home, PATH prefixed by repo/tmp/dot-audit/bin, PLAYWRIGHT_BROWSERS_PATH pointing to repo/tmp/dot-audit/playwright, and CHROME_PATH pointing to repo/tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell. Set a new MOUNTED_RUN_SUFFIX to preserve this run, then invoke `bash scripts/browser-lane.sh --max 15 node scripts/qa-mantis-knee-mounted.mjs`.

`run1/executed-harness.mjs` preserves the executed source. The final script differs only by replacing equivalent string concatenation with a template literal to satisfy prefer-template lint. Final node syntax check and type-aware oxlint passed; no gameplay changes were made. No full suite was run for this QA-only addition.

## Timing

Browser/server closure is recorded at 2026-10-19T10:48:17.608Z. The coordinator checkpoint hook started at 10:48:57 UTC, after browser closure; only evidence preparation overlapped that hook. No hook-time browser contention is claimed. The bounded cloud observation window is not device-performance evidence.
