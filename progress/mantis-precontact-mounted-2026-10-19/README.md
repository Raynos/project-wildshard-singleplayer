# Candidate7 local mounted verification

24/24 checks passed on 2026-10-19. Browser and local HTTP server closed before report.

- Exact product: `123eab925eca95a5275637259803235c85c670cb85c184e186334a3c24f8c9f7`.
- Exact preview SHA256: `32439dea716983ace271ff48afc75db7bbfab2e939b9e5d94dd3085ed18b8f7c`.
- All 137 frozen candidate7 app files matched before and after. All four existing Site app trees remained byte-identical.
- Real Site Play and Start worked on desktop and muted iPhone 16 Pro emulation in cloud Chromium. Phone viewport 402 × 874, device DPR 3, engine render scale 2, canvas 804 × 1748.
- Native touch attacks killed the single 55-HP Mantis. Exactly three practice coins collected; sampled corpse health/strike state showed no post-death strike. Native Retry reset actor, health and reward. Reload booted fresh.
- Local/session storage and world/shard persistence stayed empty. Runtime errors and failed requests were empty; observed HTTP responses were successful.
- Diagnostic player placement/aim only. No health, enemy AI, time, damage or RNG injection.

## Scope

Only `/mantis-engine/` was mapped to the exact candidate7 directory in a temporary local server. The existing Site HTML was read twice to verify a stable snapshot and served from memory. No Site files were changed by this check. Another authorized writer updated disk HTML during this run, so this is explicitly proof of the recorded initial snapshot, not the later disk HTML. Before/after HTML hashes are in the report. The four on-disk mounted apps were never replaced.

Player defeat, blocked attacks while defeated and Retry after defeat were not repeated here. The separate exact-candidate7 full capture supplies those checks. No physical-phone, Safari, performance, visual-quality or fun acceptance is claimed. The reward screenshot was inspected: it shows the native WIP overlay and three local practice coins; close corpse overlap remains visible.

## Evidence

`run1/report.json` contains checks, samples and persistence receipts. Inventories verify file parity. JPEGs are raw viewport captures, not presentation boards. `evidence-freeze.json` hashes the script and evidence after screening. No commit or remote write was performed by this verifier; coordinator owns checkpointing.
