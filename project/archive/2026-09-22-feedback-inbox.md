# Plan: the in-game feedback inbox

**State:** `archived` 2026-09-22 (finished 2026-09-22) — F1–F6 built and live in build 1e46950-mudeqkbx and verified end to end on production (Settings unlock → F8 note → Blob → `pnpm inbox:pull`). The one leftover, F7 (proving a note from the native build), is open ask docs/tasks/asks/E30.md.

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
| Entry point | a ✎ NOTE pill on the run HUD, `?review=1` | **no query string.** Settings → **REVIEW** section: password field + UNLOCK; once unlocked, a **Quick note (F8 / ✎)** toggle and a 5th MENU tab **FEEDBACK** (composer only). Desktop F8 → one-line quick bar, Tab expands to the side sheet. Touch: ✎ NOTE disc under PAUSE → bottom sheet. |
| Pause | HUD `pause` action | `hud.setPaused(true)` + release pointer lock; Esc closes the sheet and resumes |
| Screenshot | canvas `toDataURL` | Wildshard's renderer has no `preserveDrawingBuffer`, so we capture **inside the frame**: render one frame, then `canvas.toBlob` in the same task, downscaled to ≤ 1280 px wide JPEG q0.7 (≤ 300 KB). The frame is **frozen behind the sheet**, so what you see is what gets sent. |
| "Go there" | replay a golden run to the tick | `?chunk=<shard>&at=x,y,z,yaw,pitch&weapon=<id>`: a new boot param that spawns the player at the note's pose. It is the repro for every note, and it is useful on its own. |
| Native apps | web only | the Capacitor build (NATIVE-APPS) has no same-origin `/api`. `INBOX_URL` becomes absolute (`https://wildshard-singleplayer.vercel.app/api/inbox`) with CORS for `capacitor://localhost` / `https://localhost`. |
| Deploy | Vercel builds `api/` | same. Our CI uploads the repo and Vercel builds remotely, so `api/inbox.ts` deploys as a function **as long as `.vercelignore` keeps `api/`**. The service worker must **not** cache `/api/*`. |
| Strictness | — | `api/` gets its own `tsconfig` (Node types) and runs under the same `tsc --noEmit` + oxlint gates. The client stays a lazy chunk, so the phone tier's cold bytes (LOAD-PERF) don't grow. |

## Build order

| # | Checkpoint | Proof | Status |
|---|---|---|---|
| F1 | **Store**: create a Vercel Blob store on `wildshard-singleplayer`, set `REVIEW_PASSWORD` (Production + Preview), `vercel env pull .env.local` | `vercel env ls` shows both | ✅ store `wildshard-review-inbox` (private) + `REVIEW_PASSWORD` on Production / Preview / Development, 2026-09-22 |
| F2 | **API**: port `api/inbox.ts` + its tests (password, rate limit, id shape, JPEG sniff, body caps); add `@vercel/blob`; add `api/` to the tsc / oxlint gates | `curl -X POST …/api/inbox` → `{id}`; a wrong password → 401 | ✅ `2778db8`: live 401 / check 200 / list 200; 10 API tests |
| F3 | **Client**: `src/ui/Feedback.ts` + `src/ui/styles/feedback.css`, lazy chunk. Settings REVIEW row (password → UNLOCK, Quick note toggle); MENU FEEDBACK tab; F8 quick bar → Tab → side sheet; ✎ disc + phone bottom sheet; category chips; frozen-frame thumbnail + freehand pen; context chips; SEND; offline queue + "queued" chip (D1–D6). | desktop + 390×844 screenshots next to the mockups; `vite build` shows the separate chunk | ✅ `1e46950`: headless 1600×900 (bar, sheet, pen, queue, settings, tab) + 390×844 touch (disc, bottom sheet); `Feedback` is a 9 KB lazy chunk |
| F4 | **Context + go-there**: `captureContext()` from the player / world / HUD; the `?at=` boot param | a note filed at the wreck cove reopens at the same pose | ✅ `1e46950`: context + `repro` URL on every note; `?at=` in main.ts |
| F5 | **Pull**: `scripts/inbox-pull.mjs` (`pnpm inbox:pull`), `.review/` gitignored | pull lists the F3 test note with its jpg | ✅ `2778db8`: pulled the live test note + its jpg |
| F6 | **Drain skill**: `.claude/skills/drain-inbox/SKILL.md` rewritten for Wildshard's owners (world / entities / player / ui / audio / perf) and ASKS rules | one real phone note goes end to end: filed → pulled → ASKS row → fixed → handled | ✅ `.claude/skills/drain-inbox/SKILL.md` (commit below) |
| F7 | **Native**: absolute URL + CORS, once NATIVE-APPS is building | a note filed from the iOS simulator build lands | ➜ open ask **E30**: the code is in `1e46950` (absolute URL in native mode, CORS for the Capacitor origins); only the native build can prove it |

Built 2026-09-22 in one session (E26). F7 moved to ask E30.

## Decisions (the user's picks, 2026-09-22, E26)

| # | Question | Pick |
|---|---|---|
| D1 | Who can send? | **Password-gated, no query string.** The feature ships live to everyone but stays hidden: Settings → REVIEW → password → UNLOCK (remembered in localStorage). |
| D2 | Where does it live? | **Both.** Unlocked: MENU gets a **FEEDBACK** tab (composer only), Settings gets a **Quick note (F8 / ✎)** toggle. Desktop F8 = quick bar (mockup F), **Tab expands** it to the side sheet (A). Touch = ✎ NOTE disc under PAUSE (B) plus the tab. |
| D3 | Screenshot markup | **Freehand pen** on the frozen frame (one pen, undo, clear); the strokes are baked into the JPEG. |
| D4 | Categories | **BUG / ART / FEEL / PERF / IDEA**, BUG by default. |
| D5 | Where do notes go? | Vercel Blob + `pnpm inbox:pull` (no webhook). |
| D6 | Note history | **None.** The tab is just the composer. Only a small "N queued · offline" chip while the offline queue is non-empty (mockup E). |
| D7 | Draining | **On demand**: the user says "drain the inbox" (the drain-inbox skill). |
| D8 | Password | Generated, set on Vercel (Production + Preview) + `.env.local`, told to the user once in chat; never in git. |

## Mockups (`art/feedback/round-1-inbox/`)

Generated with codex CLI image_gen from live 1600×900 / 390×844 captures (recipe in AGENTS.md § Mockups).

| File | Shows |
|---|---|
| `A-desktop-sheet.jpg` | F8 → frozen frame, note sheet docked right |
| `B-phone-sheet.jpg` | touch ✎ → bottom sheet, keyboard up |
| `C-menu-tab.jpg` | MENU's 5th tab: compose + sent / queued history (history dropped by D6) |
| `D-annotate.jpg` | circle + arrow drawn on the frozen frame (D3 picked a freehand pen instead) |
| `E-phone-sent.jpg` | back in play: sent toast, ✎ badge, offline-queued chip |
| `F-desktop-quick.jpg` | minimal one-line composer at the crosshair |
