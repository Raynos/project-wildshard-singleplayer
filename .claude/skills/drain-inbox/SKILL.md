---
name: drain-inbox
description: Pull the in-game review notes (pnpm inbox:pull → .review/inbox/), read every note next to its screenshot, file one ask per note, reproduce it on the spot it was filed from (the note's repro URL), then fix or dispatch. Use when the user says "drain the inbox", "process my notes", "act on my feedback", or after a playtest.
---

# Drain the review inbox

Playtesters unlock the review inbox in **Settings → REVIEW** (the password is `REVIEW_PASSWORD`, set on
Vercel and in `.env.local`). Then **F8** on desktop or the **✎ NOTE** disc on a phone (or the menu's **FEEDBACK** tab)
sends a note: their words, a category chip, a JPEG of the frame with any pen marks, and the repro context. It lands in
private Vercel Blob through `api/inbox.ts`. Plan: `project/archive/2026-09-22-feedback-inbox.md`. Draining is **on demand**: nothing
drains the inbox until the user asks.

The notes are the user's own words: authoritative about *what looks or feels wrong*, a hypothesis about *why*.

## 1. Pull and read

```bash
pnpm inbox:pull          # new notes → .review/inbox/<id>.json + <id>.jpg (gitignored); prints a table
```

Read every `.json` and **look at its `.jpg` with the Read tool**: a note is only actionable next to its picture, and a
cyan scribble on it is the tester pointing at the thing. Each note has `category` (bug / art / feel / perf / idea),
`note`, and `context`: `shard`, `pos` [x, y, z], `yaw`, `pitch`, `weapon`, `health`, `swimming`, `hover`, `tier`,
`fps`, `calls`, `tris`, `build` (git sha + time), `dpr`, `viewport`, `canvas`, `ua`, `url` and **`repro`**.

**Error reports (category `error`, E133)** land in the same folder with no jpg: the game sends them by itself
(`window.onerror`, unhandled rejections, a frame-loop system switched off, a fatal crash; `src/core/errorReport.ts` →
`api/errors.ts`), deduped and capped at 10 a session. `note` is `[system] message`; `error` holds `system`, `message`,
`stack`, `count`, `fatal`, `disabled` (the loop switched that system off) and `sinceBootMs`; `context` has `build`,
`shard`, `tier`, `touch`, `url`, `pos` / `yaw` / `pitch`, `viewport`, `loop`. One ask per distinct error (same message +
stack from several players = one ask); repro with its `url` (+ `&at=` from `pos`); the stack names the file.

**Check `build` first** against `git log --oneline`: a note filed on an older sha may already be fixed. Verify that
before you spend any effort on it.

## 2. One ask per note, before any work

`scripts/ask-new.sh "<the note's words, shortened> (review note <id>)"` for each note. Status `open`, evidence
`.review/handled/<id>` (where it will end up). AGENTS.md § The user's asks has the rules.

## 3. Reproduce on the spot

`context.repro` is the note's own URL:
`/?chunk=<shard>&at=x,y,z,yaw,pitch&weapon=<id>&skipintro`. main.ts reads `at` and starts you exactly where the note was
filed. Open it with agent-browser at the note's `viewport` (add `&tier=phone&touch` when `tier` is `phone`). Mind the
shared browser lane in AGENTS.md: at most 3 game browsers across all agents, and close your session when you are done.
Screenshot it and compare with the note's jpg. Cannot reproduce it? Say so in the ask and move on.

## 4. Fix or dispatch by area

| Category / symptom | Area |
|---|---|
| terrain, props, water, sky, POIs | `src/world/**`, `src/chunks/**` |
| animals, enemies, their models | `src/entities/**` |
| movement, weapons, viewmodels, touch controls | `src/player/**` |
| HUD, menu, settings, this inbox | `src/ui/**` |
| sound, music | `src/audio/**` |
| perf, load | `src/core/**`, `src/boot/**` (LOAD-PERF / PLAY-PERF are archived; open a new ask) |

Small and clear: fix it yourself (commit rules and gates are in AGENTS.md). Bigger: brief a subagent with the note's
words, the jpg path, the repro URL, the owning files, and "prove it with a screenshot at the repro URL".

## 5. Close the loop

```bash
mkdir -p .review/handled && mv .review/inbox/<id>.* .review/handled/
```

Move a note only once it is fixed and seen fixed (a screenshot at its repro URL), dropped, or handed to an owner. Flip its
ask: **done** (commit + build id), **dropped** (why), or **in flight** (who). Report per note: fixed / already fixed at
`<sha>` / not reproducible / dispatched / deferred with a reason. Notes stay in Blob. `pnpm inbox:pull` skips anything
already in `.review/handled/`, and `--all` fetches everything again.
