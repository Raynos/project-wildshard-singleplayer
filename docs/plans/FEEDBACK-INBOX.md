# Plan: the in-game feedback inbox

**State:** `draft` 2026-09-22 — ported from the trials-gauntlet review inbox; mockups in `art/feedback/round-1-inbox/`. Waiting on the user's go and the picks under Decisions (E17).

## Where this comes from

`~/projects/game-demos/trials-gauntlet-demo` already has a working review loop. The user plays on the phone,
taps **✎ NOTE**, types what is wrong, and the note lands with a screenshot and the full repro state in a
private store. An agent pulls the notes and works through them. It is four pieces:

| Piece | Gauntlet file | Lines | What it does |
|---|---|---|---|
| API | `api/inbox.ts` | 144 | Vercel Node function. `POST {password, note, context, screenshot}` → `inbox/<id>.json` + `.jpg` in **private Vercel Blob**. `GET ?list=1` / `?id=&file=` proxy the private blobs back. Constant-time check against `REVIEW_PASSWORD`, 1 MB body cap, 4000-char note cap, 30 / min / IP. |
| Client | `src/ui/inbox.ts` | 465 | The note sheet. It is lazy-loaded on the first tap, pauses the run, captures context and a ≤ 300 KB JPEG of the canvas, and remembers the password in localStorage. It **queues offline** (≤ 20 notes) and retries on the next open / `online`. |
| Pull | `scripts/inbox-pull.ts` | 102 | `pnpm inbox:pull` → `.review/inbox/<id>.json` + `.jpg` (gitignored), plus a table. The password comes from `.env.local`. |
| Drain | `.claude/skills/drain-inbox/SKILL.md` | — | Pull → read each note next to its picture → one ASKS row per note → reproduce → dispatch to the owning area → move to `.review/handled/` once fixed. |

Wildshard has none of it: no `api/`, no `@vercel/blob`, no `?review=1`.

## What changes for Wildshard (the port is not a copy)

| Topic | Gauntlet | Wildshard |
|---|---|---|
| Repro context | track, tick, run time, faults, checkpoint, bike, seed, rider | **shard** (`driftwood-isle` / `pine-hollow`), **position + heading** (`x, y, z, yaw, pitch`), **held weapon**, vitals, time of day, swimming / on board, nearest POI, enemies in range, tier (`src/core/tier.ts`), dpr, canvas, fps p50 over the last 5 s, `__BUILD_ID__`, UA, viewport, URL |
| Entry point | a ✎ NOTE pill on the run HUD | desktop: **F8** or a ✎ pill on the HUD. Touch: a ✎ disc next to PAUSE. Both open the same sheet (see D2). |
| Pause | HUD `pause` action | `hud.setPaused(true)` + release pointer lock; Esc closes the sheet and resumes |
| Screenshot | canvas `toDataURL` | Wildshard's renderer has no `preserveDrawingBuffer`, so we capture **inside the frame**: render one frame, then `canvas.toBlob` in the same task, downscaled to ≤ 1280 px wide JPEG q0.7 (≤ 300 KB). The frame is **frozen behind the sheet**, so what you see is what gets sent. |
| "Go there" | replay a golden run to the tick | `?chunk=<shard>&at=x,y,z,yaw,pitch&weapon=<id>`: a new boot param that spawns the player at the note's pose. It is the repro for every note, and it is useful on its own. |
| Native apps | web only | the Capacitor build (NATIVE-APPS) has no same-origin `/api`. `INBOX_URL` becomes absolute (`https://wildshard-singleplayer.vercel.app/api/inbox`) with CORS for `capacitor://localhost` / `https://localhost`. |
| Deploy | Vercel builds `api/` | same. Our CI uploads the repo and Vercel builds remotely, so `api/inbox.ts` deploys as a function **as long as `.vercelignore` keeps `api/`**. The service worker must **not** cache `/api/*`. |
| Strictness | — | `api/` gets its own `tsconfig` (Node types) and runs under the same `tsc --noEmit` + oxlint gates. The client stays a lazy chunk, so the phone tier's cold bytes (LOAD-PERF) don't grow. |

## Build order

| # | Checkpoint | Proof |
|---|---|---|
| F1 | **Store**: create a Vercel Blob store on `wildshard-singleplayer`, set `REVIEW_PASSWORD` (Production + Preview), `vercel env pull .env.local` | `vercel env ls` shows both |
| F2 | **API**: port `api/inbox.ts` + its tests (password, rate limit, id shape, JPEG sniff, body caps); add `@vercel/blob`; add `api/` to the tsc / oxlint gates | `curl -X POST …/api/inbox` → `{id}`; a wrong password → 401 |
| F3 | **Client**: `src/ui/Feedback.ts` + `src/ui/styles/feedback.css`, lazy chunk. Sheet: note, category chips, frozen-frame thumbnail, context chips, SEND. Password prompt on first use. Offline queue. Opened by F8 / the ✎ control when `?review=1` or a stored password. | desktop + 390×844 screenshots next to the mockups; `vite build` shows the separate chunk |
| F4 | **Context + go-there**: `captureContext()` from the player / world / HUD; the `?at=` boot param | a note filed at the wreck cove reopens at the same pose |
| F5 | **Pull**: `scripts/inbox-pull.mjs` (`pnpm inbox:pull`), `.review/` gitignored | pull lists the F3 test note with its jpg |
| F6 | **Drain skill**: `.claude/skills/drain-inbox/SKILL.md` rewritten for Wildshard's owners (world / entities / player / ui / audio / perf) and ASKS rules | one real phone note goes end to end: filed → pulled → ASKS row → fixed → handled |
| F7 | **Native**: absolute URL + CORS, once NATIVE-APPS is building | a note filed from the iOS simulator build lands |

F1–F5 is one agent-day. F6 waits for the first real notes. F7 waits for NATIVE-APPS.

## Decisions (the user's picks)

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Who can send? | (a) **password-gated** reviewers, like gauntlet · (b) any player, anonymous, with a stricter rate limit and no screenshot unless ticked | (a) for v1. Public feedback needs moderation and abuse handling. |
| D2 | Where does it live? | (a) HUD ✎ pill / disc · (b) a 5th MENU tab **FEEDBACK** with your sent history · (c) both | (c). The pill is the fast path mid-fight; the tab shows what was sent / queued. |
| D3 | Screenshot markup? | (a) plain frozen frame · (b) **circle / arrow on the frame** before sending | (b) is ~150 lines of canvas. It makes "this rock floats" notes unambiguous. |
| D4 | Categories | none · **Bug / Art / Feel / Perf / Idea** chips | chips: they route the drain skill straight to an owner |
| D5 | Where do notes go? | Blob + pull (gauntlet) · also post to a Slack / Discord webhook | Blob + pull; a webhook is a 10-line add later |

## Mockups (`art/feedback/round-1-inbox/`)

Generated with codex CLI image_gen from live 1600×900 / 390×844 captures (recipe in AGENTS.md § Mockups).

| File | Shows |
|---|---|
| `A-desktop-sheet.jpg` | F8 → frozen frame, note sheet docked right |
| `B-phone-sheet.jpg` | touch ✎ → bottom sheet, keyboard up |
| `C-menu-tab.jpg` | MENU's 5th tab: compose + sent / queued history |
| `D-annotate.jpg` | circle + arrow drawn on the frozen frame |
| `E-phone-sent.jpg` | back in play: sent toast, ✎ badge, offline-queued chip |
| `F-desktop-quick.jpg` | minimal one-line composer at the crosshair |
