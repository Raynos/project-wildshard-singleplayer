# Storage policy: what Git may hold

Linked from [AGENTS.md → Version control](../../AGENTS.md) and [GIT.md](GIT.md). Ported from Rockhop's storage policy
(2026-10-15) without its history rewrite: the rewrite stays [REPO-WEIGHT](../plans/REPO-WEIGHT.md) RW9–RW12. Jake set
the growth budget at **50 MB a week**.

Git keeps code, docs, the runtime assets the game ships and small preview pictures. Videos, audio candidates, raw
captures, archives, logs, PDFs, `.blend` files and generated trees do not belong in it: every push crosses the shared
uplink (E19) and every byte stays in every clone forever. All sizes are decimal (1 MB = 1,000,000 bytes).

## The rules

`scripts/storage-policy.json` is the reviewed data; `scripts/repo-size.mjs` applies it to real Git objects (the commit's
own index, a committed tree, every outgoing commit), never to the working tree. The script holds ceilings: the policy
may lower a cap, never raise one.

| Rule | Limit |
| --- | --- |
| One blob | 1 MB, unless exactly pinned |
| A preview image (`.png` / `.jpg` / `.webp` / `.avif` outside the runtime roots) | 250 KB |
| A board (`*board*`, `*sheet*`, `contact*` in the file name) | 500 KB |
| New binary bytes outside the runtime roots waiting to push (and per push) | 10 MB |
| The same over the rolling 7 days | 50 MB |

- **Runtime roots** (shipped bytes): `public/`, `android/app/src/main/res/`, `ios/App/App/Assets.xcassets/` and each
  shard's content-addressed `src/shards/<slug>/assets/`. They are not counted in the budgets, but a blob over 1 MB there
  needs an exact `runtime` pin.
- **What the budgets count:** distinct new blobs with a binary name (images, models, archives, extension-less content
  hashes) outside the runtime roots. Text (source, JSON, Markdown, shell, ...) is capped per blob but not counted: Git
  deltas it, and last week's 1.2 GB of logical text edits packed to ~25 MB.
- **Forbidden outside `public/`:** video, audio and archives (`.mp4 .mov .webm .gif .mp3 .m4a .wav .ogg .zip .gz .br
  .zst` and kin), `.jsonl`, `.heap.json`, `.blend`, PDF; a binary file behind a text name, and media or archive bytes
  behind any other name. These are the guards `.githooks/pre-commit` lost in 819a36b8d (progress images, `.blend`,
  raw soak archives), now everywhere and on every commit a push sends.
- **Never, even force-added:** `dist`, `dist-*`, `node_modules`, `.native-build`, `.wildshard`, `.tsc-layers`,
  `boot-smoke-results`, `scratchpad`, `tmp`, `.claude/worktrees` and `media-cache` path segments; nested repositories
  and submodules; a symlink that leaves the tree or points into those paths.

Ignoring a file only prevents an accident (`.gitignore` lists the media patterns); the object check is the enforcement.

## Exact pins

A pin names one path, its Git blob id, its bytes, a kind and a purpose. Kind `runtime` is for a shipped file under a
runtime root; kind `input` is for an exact build or test input elsewhere (it still counts in the budgets, and only
`test/fixtures/` may pin media). A refusal prints the pin line to paste, with `"purpose": "<why>"` to fill in:

```json
{ "path": "public/assets/pine-hollow/terrain.ktx2", "oid": "<git rev-parse :path>", "bytes": 1234567,
  "kind": "runtime", "purpose": "Pine Hollow terrain atlas, shipped" }
```

Commit the pin in the same commit as the file. Replacing the file changes its blob id, so the pin must be reviewed and
updated with it; a stale pin refuses the commit.

## Legacy debt (migration mode)

`migrationBase` pins the commit the policy started from (local `main` when it landed, 2026-10-15). Every path/blob pair
in that commit is legacy debt: it may stay unchanged or be deleted, but it never grows and never returns. Only added or
changed pairs face the rules, so renaming a legacy video is refused just like adding one. Measured at the base:
22,925 files, 4.98 GB; the strict check finds 5,824 files (3.69 GB) that the rules would refuse today: 3,332 previews
over 250 KB, 111 boards over 500 KB, 870 videos / audio files, 984 raw soak archives and logs, 520 blobs over 1 MB
(210 of them in `public/`), 6 PDFs and one jar. REPO-WEIGHT's move (RW6) pays that debt down; drop `migrationBase` only
when `node scripts/repo-size.mjs --tree HEAD --strict` passes.

## Where it is enforced

- **Pre-commit** runs `node scripts/repo-size.mjs --index`. It reads the commit's own index (`GIT_INDEX_FILE`), so a
  pathspec commit's temporary index and a lane's private index are checked, never the shared index or the disk. It also
  refuses a commit that would push the unpushed binary bytes over 10 MB or the rolling week over 50 MB: a refusal at
  commit time keeps a shared `main` from holding a push the pre-push hook must refuse.
- **Pre-push** runs `--pre-push` on every outgoing commit of every pushed ref (adding and later deleting a payload still
  costs every clone), then the rolling week, before the Vercel gate. `SKIP_VERCEL_GATE` does not skip it.
- **CI** (`.github/workflows/storage.yml`) checks the pushed range of every push and pull request, including the
  docs / art / progress-only pushes `deploy.yml` skips. Its checkout is blobless; the checker fetches only the range's
  new blobs. It cannot undo bytes already uploaded: a bypassed hook (`--no-verify`, a hook-less `commit-tree`) is a
  storage incident to report.

A lane's private-index landing (GIT.md) runs the real pre-commit hook with its index, so it gets the same check. Run
it by hand with:

```sh
node scripts/repo-size.mjs --index                    # the staged commit (honours GIT_INDEX_FILE)
node scripts/repo-size.mjs --tree HEAD [--strict]     # every path; --strict ignores the legacy allowance
printf 'refs/heads/main %s refs/heads/main %s\n' "$(git rev-parse main)" "$(git rev-parse origin/main)" \
  | node scripts/repo-size.mjs --pre-push             # what the next push sends, plus the rolling week
```

## Where media goes instead

Until the media store (REPO-WEIGHT RW3) exists: keep captures, videos, audio candidates, raw rounds and soak logs in
the git-ignored `./tmp/<task>` or outside the checkout, and commit the summary, the numbers and a downsized board
(JPEG / WebP: `cwebp -q 82 in.png -o out.webp`, `sips -s format jpeg in.png --out out.jpg`). A picture a doc links to
stays in Git, downsized under its cap.
