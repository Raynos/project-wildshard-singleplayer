# Reviews: pages for Jake to read (E408)

A **review** is a page an agent made for Jake to read and react to: a report, an audit, a research write-up, a
decision page. Most are claude.ai artifacts; a PDF or a deployed page counts too. A review exists to finalise a plan
before it is built: Jake reads it, gives notes, the agent revises it, and once he has decided, the plan moves.

Plans hold the work; reviews hold the reading. One plan can have several reviews, and a review can come before its plan
exists (research that will become one).

## One file per review

`docs/reviews/<slug>.md`, made by the agent that publishes the page, in the same commit that links it:

```
# <the page's title>

**Status:** `unread` 2026-10-03 — <one line: what Jake decides from it, or what changed in the last revision>
**Link:** https://claude.ai/artifact/…
**Plan:** WORLDCLAW-SHARD (or "none yet: feeds <what>")
**Made by:** E359, <session / agent>
```

Notes, revisions and Jake's reactions go underneath, newest last.

## Status

- `unread` — published (or revised since Jake last read it), not read yet.
- `reading` — Jake has opened it and is iterating: he has given notes, or a revision is being made.
- `read` — Jake has read it and made the call. Move the file **in the same commit** to
  `project/archive/reviews/<YYYY-MM-DD>-<slug>.md`, the Status line reading `read <date>` plus what he decided
  (and the plan or ask it fed). So `docs/reviews/` only holds pages he still has to read or finish.

Only Jake's words move a review to `read`: "I read it", "approved", "done with X". An agent revising the page sets
it back to `unread` and says what changed.

The plan links its open reviews under its State line: `**Reviews:** [clef-in-wildshard](../reviews/clef-in-wildshard.md)`.
The session brief (`.claude/hooks/session-brief.sh`) prints every open review beside the live plans.
