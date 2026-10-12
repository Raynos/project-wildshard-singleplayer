# W14: name missing approval rows immediately

The missing-coordinator diagnostic now includes the canonical exact
measured rows. Admission still requires the same named coordinator,
all exact rows, and refuses duplicates, overbroad or unused receipts.
Eight focused policy tests pass; scripts strict and touched typed lint
pass. Landing runs the actual private-index hooks.

At 02:00 UTC the entry-floor source 87fa0b8a4 was blocked by its two
filed generator-imports 0-to-1 rows. The coordinator's narrow approval
sweeper had completed its bounded three-hour run; its last entry was
00:35 UTC. Its process was absent and the coordinator's pane had hit
the weekly usage limit. Restarting that unchanged authorized sweeper
merged both rows, with no hand-edited receipt or admission change.
The normal post-commit worker retries the rewritten receipt; its next
complete gate supplies recovery qualification. The sweeper remains a
bounded three-hour service, so the standing watch must check its exit.
