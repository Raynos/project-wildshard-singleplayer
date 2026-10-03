# Plan: Shard checkpoints — the repeatable review loop (E206)

**State:** `draft` 2026-10-03 — unblocked 2026-10-03 (Jake, E404): the E357 lock ended when GAME-NORMALIZATION was archived (`5390d75f9`). The skill and the two review PDFs are ready (E206 / E207, `3ed3285e`); Jake's process review is still the next checkpoint. WORLDCLAW-SHARD (draft) now covers the same ground, the human-in-the-loop shard workflow; whether this one folds into it is Jake's call.

## Purpose

Keep the exposed game mostly polished and playable while building one small rough pocket or interaction at a time. “80 / 20” is a scope discipline: pin reviewed work, leave one active slice. It is not a numeric quality claim. The agent owns internal multi-angle, movement, collision, performance and phone checks; Jake gets a small board and one taste decision per checkpoint.

The working instructions are [the shard-checkpoints skill](../../.claude/skills/shard-checkpoints/SKILL.md). Jake can review the process through the [five-page imaginary Nine Dragon play-by-play](../process/nine-dragon-imaginary-play-by-play.pdf) and Matthew can use the [three-page manual](../process/shard-checkpoints-user-guide.pdf).

## Repeatable checkpoint

| Gate | Agent brings | Human input | Exit |
| --- | --- | --- | --- |
| Frame | One small slice, a real portrait capture, a high-fidelity target and plausible in-engine next view at the same camera | One look direction | One accepted camera and limited scope |
| Form | Source, nine useful views, material/scale notes; used assets registered in Model Explorer | Approve or name one form/material correction | Approved asset set for this slice |
| Play | Moving capture and playable build with collisions, controls, hit/miss or landing, plus World/HUD Explorer evidence as appropriate | One steering note on what reads wrong first | Slice works, not only its still image |
| Pin | Real iPhone PWA load/frame/memory check, project gates, before/current/target board | Approve or revise the slice | Commit and deploy approved slice; only then open the next one |

Reject variants by removing their code and Debug rows. Keep internal nine-angle sheets and measurements as evidence, not nine simultaneous decisions. If a gate fails, reduce or polish the same slice.

## First application: Nine Dragon

The concrete scope and F-row ownership remain in [NINE-DRAGON-STACK.md](NINE-DRAGON-STACK.md). The present fragment is Lantern Square, a short street, stair corridor and Well edge. Its immediate active slice is the playable Fei Zhua crossing and landing; the grapple trailer shows it only after the verb works. The HUD/Weapon Explorer is a shared practice arena whose [mockups](../../art/hud-explorer/round-1-arena/README.md) precede implementation. The 500 m cube stays future plan, with new domes proposed individually after a pinned slice.

## Exclusions for this process review

The normalization, physics follow-ups and other engine backlog remain in their own plans and asks. This process plan does not silently schedule them or archive clean-room/lab code. Lab archival requires a separate feature-parity audit after the playable shard uses the feature.
