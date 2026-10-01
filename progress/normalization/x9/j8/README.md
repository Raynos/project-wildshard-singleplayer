# E357 J8 — selected shard progress

Jake rejected both full shard ledgers. The title now shows one selected-shard line
and the Wildshard total, using A's compact navy glass and cyan rule styling.
The former B grid, live A/B option, Debug row and its unused labels are deleted.
The block remains visible on fresh saves: selected shard NOT VISITED, total 0.

Actual 390 × 844 portrait captures of clean candidate `86626d90d453aa02983f0fd35b21ba31fcfcb92e`:

- [Driftwood Isle](driftwood-isle.jpg): visited, 2 feats.
- [Pine Hollow](pine-hollow.jpg): visited, 3 feats.
- [Nalati Grasslands](nalati-grasslands.jpg): not visited.

These are three selections in one browser page, driven by the real carousel dots.
The total stays 5. Per-shard progress fixtures were saved before reload; the global
summary was removed so it rebuilt through the normal save reader. A hidden
_template save has 3 feats and contributes zero to the displayed total.
No DOM text or layout was edited. All three JPEGs were inspected at 390 × 844.
The browser used `--mute-audio` plus the existing mute/tier/touch harness params;
its named session was closed after captures, and its build preview was stopped.

Focused summary/title/deck/Debug checks: 4 files, 15 tests passed.
Selection tests cover fresh saves, visited/unvisited picks, active-card startup,
real dot clicks, deck subsets and hidden cards; data tests reject hidden totals,
including lines present in older saved summaries. Known saved denominators do not
change the requested earned-feats text.

Before the two new shards landed, the clean-export publication gate passed: CSS, generation, app/API/script types,
whole oxlint, ratchet, liveness, full Vitest and production Vite build.
All four real phone fingerprint/poses boots, plus the hidden template, are green
with empty `boot.errors`. [Proof](proof.json) records the validated candidate.
Raw gate/boot/capture logs: `/private/tmp/e357-sol-title/`.
Push, milestone acceptance and deploy remain lead-owned.

After the two new shards landed, candidate `ad33cd95` passed CSS, gen, app/API/script
types, whole oxlint, ratchet and liveness. The full suite has exactly the lead's
known 15 new-shard failures in 12 files (2241 passed on the full export); no J8
failure. The lead explicitly authorized landing with that exact failure set while
another builder makes those tests shard-count-generic. All seven phone boots have
empty errors; the five historical pairs differ only in `boot.saves.read` for the
two newly registered shard saves. The two new pairs have no historical baseline.
These results do not claim a green current full gate or accepted parity baseline.
The complete failure names and later boot results are in proof.json.

Final source candidate `98c7b998` also passed whole types/lint and the 15 focused
checks. Its full suite has 2247 passed and exactly the same 15 known failures;
all seven phone boot errors are empty. Final proof is recorded in proof.json.
