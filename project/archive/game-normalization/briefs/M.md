# E357 job M — the M1–M4 milestone batch: classify every parity delta, then re-baseline

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you, except that this job runs the full
parity profile in the browser (direct `node scripts/parity.mjs …`; it takes its own lane slots).

## Why
S1–S4 are built (Nine Dragon, Pine Hollow, Nalati, Driftwood). The stored baselines (`test/parity/baselines/m5/**`,
`gh-macos15/**`, recorded on ee0dd78b / f1cef374, B27) predate most of the moves, so every compare is red on many
fields. The milestone flow (12-process §3, 03 §8 + §13.4) needs every red field explained before the re-record:
decision 102 (never stop: take the recommended board option, log it) and 103 (the pin moves itself once `gpu-gate`
is green, the memory run passes and `pending.json` is empty).

## The job
1. Pick the candidate: the newest pushed SHA whose four phone boots have zero `boot.errors` (ask the lead).
2. Run the full compare on it: `node scripts/parity.mjs --export=<sha> --lane=m5 --shards=all --tiers=phone,desktop
   --out=/private/tmp/e357-m/compare` (P1's default fast clock; one run).
3. For **every** red field, write one row in `progress/normalization/m-classification.md`: shard · tier · field ·
   before → after · the cause (commit) · the verdict:
   - **intended**: cite the spec line (`0x-*.md §…`) or the build-log entry (`13-lead-resolutions.md B<n>`) that
     allows it (renamed system ids, registry moves, save bookkeeping, B55 / B56 / B59 asset deltas, B65 elite yaws,
     the removed clouds, …);
   - **board item**: visible and not yet allowed: name the board (Look / Creatures / Weapons / Input-HUD) and the
     recommended option (decision 102), with before / after images from the capture;
   - **regression**: not allowed by anything. List these at the top; don't fix them (the lead routes them).
   Group repeated causes (one row per cause, with the field list) so the file stays readable.
4. Put the intended + board rows into the harness's pending mechanism (03 §8: `pending.json` / renames under
   `test/parity/renames/` as 03 describes), so `--accept=<ids>` can record them.
5. Report: counts per verdict, every regression row verbatim, the exact `--accept` command. Don't run `--accept`
   or `--record` yourself, and don't touch `.github/deploy-pin.json`: those are the lead's.
- Owns: `progress/normalization/m-classification.md`, the pending / rename files, `/private/tmp/e357-m/`.
- Stop at ~90 min with a handoff that says how far the classification got; report ≤ 40 lines.
