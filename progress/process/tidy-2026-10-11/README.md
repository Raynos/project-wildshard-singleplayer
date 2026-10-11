# Git cleanup · 11 October 2026

Census: 1,250 status entries (683 staged, 417 unstaged, 512 untracked; overlapping), representing 990 distinct paths.
At this checkpoint: 22 entries remain, all 18 active sp-x4 map paths plus four held reference deletions; the shared index is empty.

| Cause at census | Paths | Outcome / origin |
|---|---:|---|
| Private-index aftermath and stale staging | 610 | HEAD/disk bytes and modes matched, or both absent; live lanes released them. Git does not record index authors. |
| Abandoned source/manual/policy ports | 144 | Coordinator attributes these to stopped op-* and pre-crash lanes; archived patches + bytes, then HEAD. [Path inventory](archived-paths.csv). |
| Incomplete W7 drafts prototype copy | 4 | E412's old drafts lane; eight strict errors. Archived, then HEAD; drafts strict passes. |
| Stray required source/manual changes | 4 | Three Nalati deletions still imported by HEAD, plus stale SHARDFILE text; restored with owner confirmation. |
| Disposable captures/intermediates | 186 | Ignored: 80 sky panels/logs, 87 raw proof dumps, 17 tool scratch paths, two uncatalogued Sky bake files. Disk copies retained. |
| Historical proof copies/tools | 20 | Restored 17 pinned receipts/scripts/images (eight missing); archived three untracked SF73 scratch tools. SF21a remains pinned and unvalidated. |
| Generated inventory/output drift | 4 | Three pusher outputs aligned to HEAD without regeneration; ask inventory regenerated and committed (33 receipt IDs). |
| File mode drift | 4 | Restored two SDK runners; retained executable gate mode; sp-x7 landed executable pre-commit with its lock guard. |
| Existing coherent work | 10 | Seven reset-recovery files landed, two existing asks retained separately, one stale map import restored. |
| Jake's missing references | 4 | HOLD citadel.mp4, progress.mp4, jungle-volcano-frontier.png, shard-grid-overview.png; coordinator asks Jake. |

Nine small commits: f38ce3edd, f48581dc9, 4d2e1c773, c66b5b324, adb4e24bb, e5e7fb09c, b5a90d3c6, 13ba0929a, 9daaad84b. Recovery: root strict + touched lint + 52 focused tests / 10 files green; real hooks passed. Preserved originals: /private/tmp/claude-501/sp-builders/sp-tidy/archive/.
Prevent recurrence: pathspec commits; after private-index landings immediately align only your committed index paths after rechecking HEAD/bytes/modes; captures stay in scratch until selected. The pusher alone regenerates measured outputs. Remaining plan: sp-x4 lands its live maps, coordinator resolves Jake's four references, automatic push carries these commits; no CI/deploy wait.
