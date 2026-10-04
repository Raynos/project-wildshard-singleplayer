# GW2-ZONES council: the seat brief

You are one seat of a council reviewing a design document. The protocol is in
`~/projects/games/wildshard-singleplayer/docs/process/COUNCIL.md`; read it first. You are a **fresh, independent reviewer**.
You have not seen the conversation that wrote the document, and you should judge only what is written plus the
evidence.

## The document and its evidence

- **Under review:** `~/projects/games/project-wildshard-meta/docs/gw2-zones/GW2-ZONES.md`. It is an audit of Wildshard's four
  singleplayer shards against Guild Wars 2 zones, broadened to the question **"how do we make the most fun shards
  possible, each designed by its own game director?"** (§4.4).
- **Evidence it rests on:** `docs/gw2-zones/evidence/shard-content-*.md` (inventories read from code) and
  `docs/gw2-zones/evidence/gw2-zone-research.md` (cited web research).
- **Context:** `docs/vision/VISION.md`, `docs/shard-platform/SHARD-PLATFORM-PLAN.md`, `docs/shard-platform/SHARD-IDEAS.md` in the same repo.
- **The game's code**, at the tag the audit used: `cd ~/projects/games/wildshard-singleplayer && git show
  pre-normalization:<path>`.
  - That checkout is a shared working tree with many agents editing it. **Never edit, stage, stash or check out
    anything there**; read only with `git show` / `git grep pre-normalization`.
  - The blow-by-blow build stories are `docs/*-blow-by-blow.pdf` there (`pdftotext -layout` reads them).
- **Frozen:** `docs/gw2-zones/council/ledger.md`. **Prior findings:** `docs/gw2-zones/council/register.md`.
  **Scenarios:** `docs/gw2-zones/council/battery.md`.

## The bar (design doc)

A finding counts only if Jake, a shard director or an outside author acting on the document would **make a worse,
less fun game, or would have to guess**, or if a claim is **wrong** against its evidence. Each finding needs:
- a **location** (doc §);
- **evidence** (a quote, file:line, source URL, or a precise argument);
- a **concrete fix** (the text or change you would make).

Severities:
- `must-fix`: wrong, or acting on it would make the game worse;
- `should-fix`: a gap someone would guess at;
- `should-add`: a missing idea that would change what gets built; say why it changes the outcome;
- `nit`: wording or taste; nits never block, so keep them to 3 at most.

Don't re-raise a register row that is closed unless you bring new evidence. Don't argue the ledger without new
evidence.

## Output

Write your review to the path your seat prompt names, as markdown:
1. A one-paragraph overall read.
2. `## Findings`: a table `| ID | Severity | Location | Finding | Evidence | Proposed fix |`, with IDs `<seat><n>` (e.g.
   `A1`) in round 1, or `R<round>-<seat><n>` later.
3. `## Battery`: for each scenario S1…Sn, `pass` / `partial` / `fail` with one or two lines of why. You may add one new
   scenario if it covers something none does.
4. A last line: `Verdict: <clean | not clean> — <n> must, <n> should, <n> should-add`.

Do not edit any file other than your own review file. Be concrete, specific to Wildshard, and brief. Better 10 sharp
findings than 40 vague ones.
