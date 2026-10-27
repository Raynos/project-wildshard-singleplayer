# Fail fast: build-slot contention and waits (G610)

Jake, 2026-10-22 ~15:05: *"Something is completely broken. We need to fail fast. Whatever was waiting, whatever's
waiting elsewhere, needs to have a timeout of 5 minutes."* Audit by the plan agent's subagent (read-only), ~15:10.

**Jake's picks (G612):** D1 delete batch-check · D2 five pooled check slots + ruler · D3 fail at 5 min naming the holder, no retry · D4 quiet window ends at 10 min or dead owner · D5 no checks before landing · D6 build-lease wait 5 min.

## Diagnosis

1. **Per-slice batch checks are still told to lanes.** `docs/plans/shard-platform/lanes/common.md:11` (the rule every
   lane reads first) still says "Per batch (G506, G509): `scripts/batch-check.sh`"; G568 only reached `ready-queue.md:145`.
   `.git/command-logs`: 21 batch checks today, 9 between 14:09 and 14:51 (8 on `check`), each one a single Claude commit,
   9 of 21 on commit objects never landed. sp-x6 does the same by hand (~20 `tmp/sp-x6-*/run.py` with `--slot check`).
2. **No slot picking.** `build-mirror.mjs:101/106`, `serve-build.sh:87`, `batch_check.py:113` all default to `check`;
   G547's least-busy pick was never built.
3. **Slots held while waiting.** A batch check takes the mirror twice and, inside the slot, `serve-build` waits without
   limit for preview room (`:193`) and one of the 2 build leases (`:223`): at most 2 holders progress, the rest hold slots.
4. **Checks grow with unpushed main.** `--base origin/main` pulls every lane's unpushed commits (123 sources, 882 tests).

`gate` and `commit` slots are dead since D8/D9. **Cost:** checks normally 5–7 min took 23–34 min between 14:09 and
14:57 (one timed out after 30 min) — about 2.3 lane-hours of waiting in that hour, plus the ruler's 30-min timeout.

## Waits today → proposed

| Tool | file:line | Now | Proposed |
|---|---|---|---|
| mirror slot lock | build-mirror.mjs:25, :71 | 30 min, names pid only | 5 min, names pid, command, age |
| heavy-lane queue | heavy-lane.py:331-334 | no limit | 5 min, names holders |
| serve-build preview room | serve-build.sh:193 (inside slot) | no limit | 5 min, checked before entering the mirror |
| serve-build build lease | serve-build.sh:223 (inside slot) | no limit | the heavy-lane 5 min |
| browser lane + wait | browser-lane.sh:231-242 | no limit | 5 min, prints status |
| sim lane | sim-lane.sh:177-186, :101, :96/:211 | no limit | 5 min (`lockf -t 300`) |
| model lock + memory wait | `lockf -k` without `-t`; run-locked.sh; blender/build.sh:115 | no limit | `-t 300`, memory wait 5 min |
| quiet window | MACHINE.md:83; push-loop.py:123 | until released | 10 min or dead owner ends it |
| commit lock | commit.sh:71 | 120 s | fine |
| push loop | push-loop.py:199-202, :127 | never waits, 45 s cap | fine |

## Rows

| Row | What | Size | Done when |
|---|---|---|---|
| **F1** | Slot pool + 5-min cap in build-mirror: no slot or any `check*` name = first free of check..check5; waits across all five up to 5 min, then fails naming every holder; `gate` → `ruler` (ruler default), `commit` deleted | S | 6 parallel runs spread over 5 slots; the 6th fails at 5:00 naming holders |
| **F2** | heavy-lane.py queue: 5-min cap, error lists active leases | S | a third build fails at 5:00 with both holders printed |
| **F3** | serve-build.sh: preview room checked before the mirror, 5-min cap, no `:-check` default | S | a full preview registry fails before any slot is taken |
| **F4** | browser-lane.sh, sim-lane.sh: 5-min caps | S | a full lane fails at 5:00 with status printed |
| **F5** | Model lock `lockf -t 300` (blender/build.sh, mockup-local.sh, run-locked.sh), memory wait 5 min | XS | a held lock fails at 5:00 |
| **F6** | Quiet window: push-loop ignores a marker older than 10 min or with a dead owner; MACHINE.md:83 | XS | a stale marker no longer stops pushes |
| **F7** | Stop per-slice checks for real: common.md:11 → types, lint, focused tests per slice; no exact-commit mirror checks; no checks on unlanded commit objects; MACHINE.md:49; delete batch_check.py / batch-check.sh and their tests (per D1) | S | `git grep batch.check` finds only history |
| **F8** | AGENTS.md / MACHINE.md slot line: five pooled check slots + ruler; every wait fails at 5 min naming the holder | XS | docs match the code |
| **F9** | Cleanup: 12 leftover `tmp/batch-check-*` dirs, dead `gate` / `commit` mirror trees | XS | gone |
