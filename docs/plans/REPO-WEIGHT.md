# Plan: REPO-WEIGHT — what to do with the media committed to git (E436)

**State:** `draft` 2026-10-04 — Jake answered (E436, 2026-10-04, via the plan-status agent): **Cloudflare R2** as the store and **one history rewrite**, and **the plan stays a draft, not built** (his words: "Yes R2 and history rewrite but plan stays draft not built"). He approved the retention policy (Q1) in the same answer. R2's free tier (10 GB/month storage, zero egress) covers the ~2.9 GiB archive; Cloudflare asks for a payment method on file to enable R2. Q4 (which refs survive the rewrite) and Q5 (one repo per shard: recommended not now) stay open until he greenlights building. Nothing built.

## 0. Read this first

Jake, E436 (2026-10-04): *"Repo & pipeline weight is already a problem it's 3GB we need a real solution for this TBH,
Maybe git LFS maybe something else ? Don't know. Maybe one repo per shard lol. — You can get a subagent to make a second
plan called "repo-weight.md" and it can figure out what do with all the media committed lol. we want to keep some of the
progress & art work."*

**The goal.** A clone of the game repo is code, docs, the runtime assets the game ships, and a curated, downsized set of
the art and progress pictures the plans and reviews point at. Everything else (raw mockup rounds, capture runs, videos,
audio candidates, PDFs) lives in a media store, is listed in a committed manifest, and is one command away. The repo
stops growing by ~240 MiB a day.

**The words:**
- **Keep set:** media that stays in git (§3).
- **Archive:** media that leaves git for the store, listed in `media/manifest.json` (path → sha256, bytes, kind, URL).
- **Input:** a file under `art/` or `progress/` that code or a script reads at build or test time; it stays in git at
  full size wherever it lives.
- **The move:** one ordinary commit that removes the archive from HEAD (history still has it).
- **The rewrite:** `git filter-repo` over all history, so the archive leaves the pack too. Destructive: new SHAs for
  every commit, a force-push, every checkout re-cloned.

**Not in this plan:** `public/` runtime assets and deploy bytes ([DEPLOYMENT_ASSET_TRIM](DEPLOYMENT_ASSET_TRIM.md) T4,
T5); shardfiles and where shard projects live ([SHARD-PLATFORM](SHARD-PLATFORM.md) §3.5: shardfiles are build products,
git-ignored). This plan keeps both possible (§8).

## 1. The measures

1. **Pack size** of `origin/main` (`git count-objects -vH` on a fresh clone): 4.44 GiB today. Target after the move and
   the rewrite: **≤ 1.2 GiB**. Without the rewrite it stays ~4.4 GiB and the target is growth only.
2. **HEAD media bytes** under `art/`, `progress/`, `sources/`: 2.97 GiB today. Target: **≤ 300 MiB**.
3. **Growth**: media bytes added to git per week. Today ~1.4 GiB a week (of ~1.7 GiB in all). Target: **≤ 50 MiB a week** outside `public/`.

All three come from `scripts/repo-weight.mjs` (RW1), never a hand count.

## 2. What is heavy (measured 2026-10-04 on `85c3427c1`)

Measured read-only with `git rev-list --objects origin/main | git cat-file --batch-check` (on-disk size in the pack),
`git ls-tree -r -l HEAD`, and a reference scan of every tracked text file at HEAD. RW1 commits this method as a script.
The repo is **18 days old** (first commit 2026-09-16, 4,157 commits) and **public** on GitHub
(`Raynos/project-wildshard-singleplayer`, `diskUsage` 4.0 GiB).

**Totals.** `.git` 4.5 GB; pack 4.44 GiB (77,913 objects); 4.20 GiB of blobs reachable from `origin/main`, 4.42 GiB from
all 147 local refs (the extra 0.22 GiB is `prototypes/`, on the **local-only** tag `worldclaw-archive` and the local
`worldclaw*` branches, not on GitHub). HEAD: 12,537 files, 3.53 GiB.

**By top folder** (MiB on disk in the pack; "history only" = blobs no longer at HEAD):

| Folder | Total | At HEAD | History only | Blobs |
|---|---:|---:|---:|---:|
| `art/` | 1,840 | 1,575 | 265 | 4,995 |
| `progress/` | 1,621 | 1,300 | 321 | 3,239 |
| `public/` | 640 | 455 | 185 | 2,414 |
| `sources/` | 59 | 59 | 0 | 7 |
| code + docs (`src`, `scripts`, `docs`, `test`, the rest) | ~140 | ~70 | ~70 | ~25,000 |

**The point that decides the route: 82 % of the weight is still at HEAD.** History-only blobs are 0.6 GiB of media and
0.2 GiB of `public/`. Removing files from HEAD shrinks the checkout; only a rewrite shrinks the pack.

**By type at HEAD:** JPEG 1,709 MiB (5,607 files) · MP4 789 MiB (192) · PNG 513 MiB (314) · GLB 149 MiB · KTX2 129 MiB ·
M4A 68 MiB (562) · MP3 49 MiB · HDR 36 MiB · PDF 24 MiB · WAV 15 MiB.

**Largest folders at HEAD:** `art/nine-dragon-stack` 538 MiB (1,314 files, 89 round folders; `round-24-mockup-pass`
98 MiB, `round-15-eight-domes` 93 MiB) · `public/assets` 475 MiB · `progress/sunscar-dunes` 203 MiB (692 files, mostly
timestamped capture runs of the same 6–8 shots at 780×1688, 80–250 KB each) · `progress/far-reach` 145 MiB ·
`art/pine-hollow` 132 MiB · `art/nalati-grasslands` 126 MiB · `art/thin-ice` 100 MiB · `progress/e339-faces` 92 MiB
(25 orbit videos) · `art/hud` 74 MiB · `art/far-reach` 71 MiB · `art/music` 70 MiB (329 audio candidates).

**Largest files:** `progress/wildshard-trailer.mp4` 68 MB, `progress/wildshard-trailer-30s{,-music}.mp4` 49 MB each,
`sources/citadel.mp4` 36 MB, three Nine Dragon portrait clips 28–35 MB, `progress/progress-video.mp4` 27 MB and
`progress/timelapse.mp4` 26 MB (each re-committed 3–4 times: their old copies are 0.15 GiB of history),
`progress/sunscar-dunes/clips.mp4` 24 MB (5 versions), `docs/Driftwood-Isle-blow-by-blow.pdf` 13 MB.

**Videos:** 190 files, 779 MiB at HEAD under `art/`, `progress/`, `sources/`; 0.33 GiB more in history.

**Rule drift:** 165 `progress/` images are over the 500 KB cap (335 MiB): older than the hook or committed past it.
`art/` has no size rule at all, and videos are exempt everywhere.

**Duplicates:** 68 blobs over 100 KB sit at more than one path (79 extra copies, 27 MiB of checkout; git stores them
once). No PNG has a JPEG twin.

**Age** (art + progress + sources at HEAD, by week added): 09-16..22 721 MiB · 09-23..29 1,234 MiB · 09-30..10-04
1,057 MiB. Growth on `main`: **~240 MiB a day, ~85 % of it media** (09-17 388 MiB, 10-02 426 MiB). Non-media
(`public/` churn and code) is ~40 MiB a day on its own.

**What links to it** (a text file at HEAD names the file's path, or its round folder `art/<subject>/<round>/`; a round's
own README does not count):

| Area | HEAD MiB | Named by exact path | Named by path or round folder | Named by nothing |
|---|---:|---:|---:|---:|
| `art/` | 1,609 | 297 (494 files) | 1,010 (2,782) | **600 (1,363)** |
| `progress/` | 1,304 | 113 (173) | 357 (1,038) | **947 (1,366)** |
| `public/` | 485 | 411 | 481 | 4 |
| `sources/` | 59 | 57 | 57 | 1 |

- **1.55 GiB of art and progress is linked by nothing**: no plan, review, doc, ask, code, test or script names it.
- The referrers are mostly **plans, asks and the archive** (`project/archive/` 183 files, `docs/tasks/` 113), as
  backtick paths more than inline images; 1,633 path mentions in all.
- **Inputs:** code and scripts name ~400 MiB of art and progress, mostly as provenance comments, but some are real build
  or test inputs: `art/nine-dragon-stack/round-15-eight-domes` (the domes and budget scripts), the Pine Hollow and Far
  Reach palette-region and LUT targets, `art/hero-images/…@2x.jpg` (native icons), `art/music/*` (the music ranking
  tools), `art/pine-hollow/round-6-journal-sketches` (the compendium). RW2 tells the two apart per site.
- **The keep set by today's links:** 653 images are named by full path outside the media folders (272 MiB); with every
  `*board*` / `*sheet*` / contact image in `art/` it is 1,051 images, 444 MiB, about **230 MiB once each is capped at
  250 KB**.

**What the pipeline already avoids** (so the weight hits clones, pushes and GitHub, not CI):
- **CI** (`.github/workflows/*.yml`): every `actions/checkout` is `filter: blob:none` with a sparse checkout that drops
  `progress/ art/ sources/ docs/`; a job fetches `public/` (~0.47 GiB) and code only.
- **Vercel** (`.github/workflows/deploy.yml`): `vercel deploy --prebuilt` from CI; `.vercelignore` drops the media
  folders. The deploy's own bytes (524.5 MiB static) are DEPLOYMENT_ASSET_TRIM's.
- **The push gate** (`scripts/vercel-tree-gate.sh`) checks out only what `.vercelignore` lets through.
- **What it does not avoid:** a fresh clone is 4.4 GiB; every push carries its new media over the shared uplink (E19);
  GitHub recommends repos under 5 GB and the pack passes that in days at this rate; the shared Mac's disk holds 4.5 GB of
  `.git` plus a 3.5 GiB checkout.

## 3. What stays in git and what moves (the retention policy)

| Class | Stays in git | Moves to the store | Gone |
|---|---|---|---|
| **K1 linked pictures** | every image a live plan, review, `docs/`, `AGENTS.md`, code, test or script names by path, **downsized** to ≤ 1,600 px long edge, JPEG q80 or WebP, ≤ 300 KB (a pick board ≤ 500 KB) | the full-size original | — |
| **K2 decisions** | every pick board, contact sheet and A / B / C board in `art/` (`*board*`, `*sheet*`, `contact*`), downsized as K1; every round `README.md` (text) | the full-size original | — |
| **K3 progress** | per capture series, the **newest run** and any run a doc names, downsized as K1 | every other run | — |
| **Inputs** | in place, full size, marked `input` in the manifest (RW2) | — | — |
| **Raw rounds** | — | every unpicked candidate, render, reference and intermediate in `art/` | — |
| **Video, audio, PDF** | — | every `.mp4` / `.mov` / `.gif` > 1 MB, `.wav` / `.m4a` / `.mp3`, `.pdf` under `art/`, `progress/`, `sources/`, `docs/` (shipped `public/` media stays, DEPLOYMENT_ASSET_TRIM T4) | — |
| **Capture logs** | JSON / JSONL ≤ 100 KB | larger ones | — |
| **Duplicates** | one copy | — | the other paths (27 MiB) |
| **History-only versions** | — | — | 0.6 GiB of superseded media; kept only in the pre-rewrite backup (RW11) |

**Links.**
- A live doc (plans, reviews, `docs/`, `AGENTS.md`) that names an archived file gets its link rewritten to the store URL
  in the move commit (RW6). By K1 most of those files stay, so few links change.
- Asks (`docs/tasks/asks/`) and `project/archive/` are records: their text is not rewritten. The path stays the key:
  `node scripts/media.mjs url <path>` prints the URL and `fetch <path or folder>` restores the file to a git-ignored
  `media-cache/<path>`.
- `scripts/media.mjs check` (in `pnpm test` beside `check-paths`) fails a link in a live doc to a path that is neither in
  git nor in the manifest.

**Estimated result:** HEAD media 2.97 GiB → ~0.25–0.3 GiB; HEAD 3.53 GiB → ~0.85 GiB; the store holds ~2.9 GiB (every
archived file plus the originals of the downsized ones). After the rewrite the pack is ~1.0 GiB (`public/` history
0.64 + code 0.14 + keep set ~0.25).

## 4. The options compared

Prices are list prices as of 2026-10; RW3 rechecks them before anything is bought.

| Option | What it is | Cost | For | Against |
|---|---|---|---|---|
| **A. Media store + manifest (recommended)**, backend **GitHub release assets** | Files named by content hash (`<sha256-16>.<ext>`) on releases `media-<n>` of this repo; `media/manifest.json` in git; `scripts/media.mjs put / fetch / url / check` | **$0** (no storage or bandwidth charge; ≤ 2 GiB a file; about 1,000 assets a release, so the script rolls releases) | No new account (`gh` is authenticated); public repo, so URLs need no auth; uploads are per-file and concurrent-safe (no index, no push lock); the bulk upload runs **on a GitHub runner** from the already-pushed blobs, so 2.9 GiB never crosses the Mac's uplink; content hashes match SHARD-PLATFORM's content-addressed files | An image opens as a download, not inline (fine: by K1 everything a live doc shows stays in git); tied to this repo (backup in RW5); not a path-shaped store |
| A′. same, backend **Cloudflare R2** | A public bucket, same manifest | 10 GB free, then ~$0.015 / GB-month; **zero egress** | Inline viewing; path layout; the natural CDN if DEPLOYMENT_ASSET_TRIM T5 or SHARD-PLATFORM later serve runtime files from a store | Jake makes a Cloudflare account, adds a card and a token (a real-world chore) |
| A″. same, backend **Vercel Blob** | As `drafts/tools/images.ts` already does for the drafts site | Hobby: ~1 GB included (too small for 2.9 GiB); Pro ~$0.023 / GB-month + transfer | Precedent in the repo, `@vercel/blob` installed, token at `~/.config/wildshard-drafts/blob.env` | The plan of `raynos-projects` is unverified (the CLI token is expired); likely capped |
| B. **Git LFS** | Pointers in git, files on GitHub's LFS store | 10 GiB storage + 10 GiB bandwidth a month free, then ~$0.07 / GiB-month and ~$0.0875 / GiB (every LFS clone or fetch of the full set burns ~3 GiB) | Transparent paths; images render on GitHub | **Uploads still ride `git push`**, so the slow shared push (E19, the push lock) is unchanged; LFS hooks must be chained into `.githooks/pre-push` and `push-main.sh`; every agent's checkout runs the smudge filter; migrating the existing files is a history rewrite anyway; LFS objects historically cannot be pruned on GitHub without deleting the repo; CI and Vercel would keep `lfs: false` and sparse checkouts, so they gain nothing |
| C. **A separate media repo** | `wildshard-media` with today's `art/` / `progress/` layout; docs link its GitHub URLs | $0 | Inline viewing on GitHub; same paths; its history is disposable (can be squashed any time without touching code SHAs) | The same git limits (5 GB recommended, 100 MB a file), a second shared working tree for ~10 agents, or a submodule (a pain in one shared checkout); the uplink cost moves, it does not go away |
| D. **One repo per shard** | Each `src/shards/<slug>/` and its media in its own repo | $0 | Matches SHARD-PLATFORM's long-term shard projects | Does not shrink anything (Nine Dragon's 538 MiB moves with it); shards import the engine layers through the workspace, so a split needs SHARD-PLATFORM M1's SDK first; multiplies gates, CI and deploys. **Not now**; §8 keeps it possible |
| E. **No store, only guards** | Size and type rules from today on | $0 | Smallest change | HEAD stays 3.5 GiB, the pack 4.4 GiB; the past is not fixed |
| F. **History rewrite** (with A, B or C) | `git filter-repo` drops the archived blobs from every commit | $0 + one paused session | The only way the pack and a fresh clone shrink (4.4 → ~1.0 GiB) | **Destructive**: every SHA changes (plans, asks and commit messages cite SHAs as evidence; `version.json`, the deploy pin, Sentry releases, gate stamps, capture folder names carry them); force-push to `main`; every checkout and worktree re-cloned; the local-only refs (147, incl. the `worldclaw-archive` tag with `prototypes/`) need a keep / drop decision; GitHub only frees its server-side copy after a GitHub Support GC request; forks keep the old objects. Needs Jake's explicit go, a backup first, and every agent paused |

**Partial clone is not an option on its own:** a fresh `git clone --filter=blob:none --sparse` is already small and CI
uses it, but the shared checkout is a full clone and GitHub still stores and grows the full pack.

## 5. Recommended route

**A (media store, GitHub release assets backend) + guards now; F (one rewrite) after the move, only on Jake's go.**

1. **Measure and guard first** (RW1, RW7): the script, then the pre-commit and CI rules, so growth stops the day the
   store exists.
2. **The store** (RW3) with the backend behind one interface: switching to R2 later is a re-upload by hash and a manifest
   URL rewrite, not a redesign.
3. **The move** (RW4–RW6), one ordinary commit during an agent pause: the keep set downsized, the archive uploaded from a
   GitHub runner and verified byte-for-byte, then removed from HEAD. Reversible with `git revert`.
4. **The rewrite** (RW9–RW12), only if Jake says go (Q3): rehearsed on a scratch mirror, backed up twice, run in one
   scheduled pause, with a committed old→new SHA map so every cited SHA still resolves.

Why not LFS: it keeps media on the push path, which is the pain the shared Mac feels most, and costs money as the
archive grows ~1.4 GiB a week. Why not a media repo: it re-creates the same git weight and a second shared tree. Why not a
repo per shard: it moves weight, it does not remove it, and it needs the SDK first.

## 6. Rows

Sizes: S ≤ ½ day, M ≤ 2 days, L ≤ 5 days for one agent.

| Row | What | Done when | Size |
|---|---|---|---|
| RW1 | **`scripts/repo-weight.mjs`**: the measuring script. History by folder / type (`git rev-list --objects origin/main` + `cat-file --batch-check` `%(objectsize:disk)`), HEAD by folder / type / week added, growth per day, duplicates, and the **link graph**: every media file → the text files that name its path or its round folder, by referrer kind (plan, review, doc, ask, archive, code, test, script). `--json` for tools; `--check` against `lint/repo-weight.json` (HEAD media bytes and the `public/` large-file list may only shrink) | §2's numbers reproduce within 1 %; runs in < 30 s; `test/repo-weight.test.ts` builds a fixture repo and checks each count | M |
| RW2 | **The classification**: `repo-weight.mjs --classify` writes `media/plan.json`, every HEAD media file → `keep` / `input` / `archive` / `drop` with its reason (§3); each code / script / test reference checked as a real input or a comment (inputs listed in `lint/media-inputs.json`) | Every file classified; the keep set ≤ 300 MiB after downsizing; the inputs list reviewed by the owners of the scripts that read them (herdr) | S |
| RW3 | **The store**: `media/manifest.json` (path → sha256, bytes, w / h, kind, shard slug, URL, date) + `scripts/media.mjs put / fetch / url / check / verify`; backend = GitHub release assets named by hash, releases rolled under the asset cap; uploads idempotent by hash; `media-cache/` git-ignored. Price and limit check of the chosen backend written into §4 | Round trip of a folder (put → remove → fetch → byte-identical); `check` fails a fixture link to a missing path; a test with a fake backend; works from two agents at once | M |
| RW4 | **The downsizer**: `media.mjs shrink` re-encodes K1–K3 (≤ 1,600 px, JPEG q80 / WebP, ≤ 300 KB, boards ≤ 500 KB) after archiving the original | A sample of 20 boards side by side at iPhone portrait size shows no visible loss at 1× (agent judgement, no Jake check); every original is in the store first | S |
| RW5 | **The bulk upload, from GitHub**: `.github/workflows/media-archive.yml` (`workflow_dispatch`, a pinned SHA): a runner checks out the archive paths and runs `media.mjs put`, so no byte crosses the Mac's uplink; then `media.mjs verify` downloads every hash on a second runner. A local copy of the archive under `~/projects/wildshard-media-archive/` (outside the repo) as a second copy; the same verify on a weekly schedule | Every manifest entry downloads byte-identical; counts and bytes match RW2; the weekly verify is scheduled | M |
| RW6 | **The move commit** (in an agent pause; the owner announces it over herdr): remove the archived files from HEAD, add the downsized keep set and the manifest, rewrite live-doc links to archived files, update `art/README.md` and each touched round README with a "full set: `media.mjs fetch <folder>`" line | Local gates green; `media.mjs check` 0 broken links; `node scripts/check-paths.mjs` green; HEAD media ≤ 300 MiB (measure 2); the big new blobs pushed first to a side branch (GIT.md), then `scripts/push-main.sh` | M |
| RW7 | **Stop regrowth: the guards** in `scripts/precommit-guards.mjs` (the private-index runner the pre-commit hook already calls) and in CI's node checks via `repo-weight.mjs --check`: outside `public/` and the inputs list, an image > 300 KB (boards 500 KB) is refused; a video, audio file or PDF is refused with "`node scripts/media.mjs put <path>`"; any file > 5 MB anywhere is refused unless `lint/large-files.json` lists it (shrink-only); a commit adding > 20 MB outside `public/` is refused. Escape: none but `--no-verify`, which CI's check catches. Extends today's `progress/` 500 KB and `.blend` rules | One fixture per rule fails; today's tree passes after RW6 (until then the HEAD ratchet only stops growth) | S |
| RW8 | **Where new media goes** (process): AGENTS.md's Version-control line and [MOCKUPS.md](../process/MOCKUPS.md) say rounds keep their boards and README in git and the rest goes through `media.mjs put`; GIT.md's size line; the capture scripts that write `art/` or `progress/` (73 today) default their raw output to `media-cache/`; the skills that write media (mockup-to-model, worldclaw-*, drain-inbox, blow-by-blow, the trailer and timelapse scripts) put videos and raw rounds in the store | A grep finds no script writing a video or a raw round into a tracked path; a new mockup round lands with ≤ 1 MB in git | M |
| RW9 | **Rewrite rehearsal** (non-destructive, on a scratch `git clone --mirror`): `git filter-repo` dropping every blob under `art/`, `progress/`, `sources/`, `docs/*.pdf` that is not in the post-move HEAD; measure the pack; check that `filter-repo`'s `commit-map` resolves every SHA cited in live plans, reviews and asks; run the push gate on the rewritten tip | A report in this plan: pack size, refs kept, SHAs mapped / unmapped, gate result | M |
| RW10 | **Refs before the rewrite**: list the 147 local refs (11 branches, ~120 `sol-*` / `e357` / `codex` refs, 5 tags, 1 stash, 3 worktrees) with what each holds that `main` lacks; Jake's Q4 decides; `worldclaw-archive` (local only, 214 MiB of `prototypes/`) is bundled into the backup whatever he picks | The list is in this plan; nothing deleted by an agent | S |
| RW11 | **The rewrite** (**only on Jake's go, Q3**): announce and pause every agent over herdr; last push; `git bundle create --all` + a mirror clone, verified, in two places off the repo; filter-repo on a fresh mirror; one commit mapping old SHAs in live docs to new; Jake runs the force-push (`!` line: agents are blocked from force-pushing); Jake files the GitHub Support GC request; the main checkout and every worktree re-cloned with a checklist (hooks `core.hooksPath`, `node_modules` relink, untracked local files such as `public/assets/baked/`, `.git` gate stamps re-earned) | A fresh clone ≤ 1.2 GiB (measure 1); push gate, CI and the next deploy green on the new tip; every agent restarted on the new clone | L |
| RW12 | **Old SHAs still resolve**: `docs/process/sha-map.txt` (old → new, ~4,200 lines, from `commit-map`) + `scripts/sha.mjs <old>`; `scripts/asks.mjs` and the plan-State check accept a mapped old SHA | A random 20 cited SHAs from archived plans resolve to the right commit | S |

## 7. Order, risks

**Order:** RW1 → RW3 + RW7 (guards land with the store, so a refused video has somewhere to go) → RW8 → RW2 → RW4 →
RW5 → RW6. Then, only on Jake's go: RW10 → RW9 → RW11 → RW12. RW1–RW8 change no history and can start the day Jake
answers Q1 and Q2.

**Risks:**
- **A real input gets archived** and a script or test breaks. RW2 checks every code reference; `pnpm test`'s
  check-paths and the CI-only node checks run before the move is pushed.
- **The store loses files** (a release deleted, the repo renamed or removed). Two copies: the store and
  `~/projects/wildshard-media-archive/`; the pre-rewrite bundle holds every blob; `media.mjs verify` runs weekly in CI (RW5).
- **Agents keep committing media** from habit and skills. RW7 refuses it at commit time and CI catches `--no-verify`;
  RW8 changes the skills and scripts at the source.
- **The rewrite breaks SHA citations** across plans, asks, `version.json`, the deploy pin, Sentry and capture folder
  names. RW12's map resolves the docs; build ids and Sentry releases age out; the capture folders are archived anyway.
- **A rewrite with an agent still running** would push old history back. RW11 only runs with every agent paused, and adds a
  one-line check to `scripts/push-main.sh` that refuses a push whose history holds the old root commit.
- **GitHub keeps the old pack** until Support runs GC, and forks keep it forever. Clones are small at once; the
  server-side number drops later.
- **The uplink**: the downsized keep set (~230 MiB of new blobs) is pushed once, through a side branch first.
- **Concurrency**: the move and the rewrite touch thousands of paths other agents' docs name. Both run in a pause the
  owner announces over herdr, never mid-session for others.

## 8. Touches other plans

- **SHARD-PLATFORM** (§3.5): shardfiles are build products and stay out of git. A shard project's `assets/` sources stay
  in git under the RW7 caps; a source asset over the cap goes in the store and the baker fetches it by sha256 from the
  manifest (the same content address the shardfile uses). The manifest records the shard slug, so a later per-shard repo
  takes its own slice of it.
- **DEPLOYMENT_ASSET_TRIM** T4 / T5: shipped videos, HDRIs and `public/assets` packs are its call. If T5 picks an
  external CDN, A′ (R2) can be that store too; RW3's backend interface allows the swap.
- **MOCKUPS.md / GIT.md / AGENTS.md**: RW8 rewrites their media lines.

## 9. Open questions for Jake

**Jake's answers (2026-10-04):** Q1 yes (retention policy); Q2 **Cloudflare R2**; Q3 **yes, one rewrite**; the plan stays draft until he says build. Q4 and Q5 open.

Asked with the question tool when the plan goes to him (ASKS.md); each has one recommendation.

| # | Question | Recommended answer |
|---|---|---|
| Q1 | **The retention policy (§3)**: keep in git the pictures any doc or code names, every pick board and contact sheet, the newest capture run per series and the build inputs, all downsized to ≤ 1,600 px / ≤ 300 KB; archive the rest (raw rounds, old capture runs, every video, audio candidate and PDF) to the store, one command away | **Yes.** ~1,050 pictures stay (~230 MiB); ~2.9 GiB is archived, nothing deleted |
| Q2 | **The store backend**: GitHub release assets ($0, no new account, uploads from GitHub's own runners) vs Cloudflare R2 (inline viewing, zero egress, needs a Cloudflare account, card and token from you) vs Git LFS (paid past 10 GiB, keeps media on the slow push) | **GitHub release assets** now; R2 later only if DEPLOYMENT_ASSET_TRIM T5 wants a CDN for runtime files |
| Q3 | **Rewrite history once?** Shrinks a clone from 4.4 GiB to ~1.0 GiB; every SHA changes (a map keeps old ones resolvable), a force-push to `main`, every agent paused and every checkout re-cloned, backups first | **Yes, once**, after the move lands, in one pause you schedule; same repo plus a GitHub Support GC request |
| Q4 | **Which local refs survive the rewrite** (147: agent worktree branches, `sol-*` candidates, codex checkpoints, 5 tags; `worldclaw-archive` holds `prototypes/` and exists only on this Mac) | **Keep `main` and the 5 tags** (`worldclaw-archive` pushed as a tag first); drop the rest; everything stays in the backup bundle |
| Q5 | **One repo per shard?** | **Not now.** It moves weight without removing it and needs SHARD-PLATFORM's SDK first; the manifest is per-shard so a split stays possible |

## Handoff (repo-weight)

Written 2026-10-04 by a subagent of the shard-platform agent (ask E436).

**Done:** this draft; every number in §2 measured read-only on `85c3427c1` (no git state changed).

**Next:** Jake answers Q1–Q5 with the question tool; on Q1 + Q2, RW1 (the script) and then RW3 + RW7 together. The
rewrite rows wait for Q3.

**Owns:** nothing yet (no row claimed).

**Learned:** CI and Vercel already skip the media (partial clone + sparse checkout, `--prebuilt`), so the weight is in
clones, pushes, GitHub and the Mac's disk; 82 % of the pack is still at HEAD, so the move matters as much as the
rewrite; 1.55 GiB of art and progress is named by nothing; the drafts site already runs a content-hashed media store
(`drafts/tools/images.ts`, Vercel Blob), the pattern RW3 generalises; `worldclaw-archive` and `prototypes/` exist only
on this Mac.

**Done when:** measures 2 and 3 are met with the guards live; measure 1 too if Jake says go on Q3.
