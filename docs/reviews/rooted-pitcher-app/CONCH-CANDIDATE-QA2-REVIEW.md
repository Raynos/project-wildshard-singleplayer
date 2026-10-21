# Conch current-candidate QA2 independent review

2026-10-21. Bounded functional evidence accepted; **NOT public admission or quality completion**.

## Identity and method

Inspected the complete 243-row RAF trace, all 14 damage events and nine trusted touch inputs,
report/check implementation, damage pipeline and transparent observer. Re-ran the driver's
`--verify-only` against the retained `current-four-1553` host; exact inventory verification passed.
The archived source snapshot is `0bb568623d4b8ab3837b576996e7fa3fc50c9aafa3ffb647fe249d90a24f28cf`.
This proves that immutable candidate only, **not subsequent convex-motor working-tree changes**.

The owner is legacy `PracticeCreature` with borrowed fixed decisions and `AnimalView` authored
numeric poses, **not `PracticeNativeActor`**. Eleven explicit diagnostic player placements and
nine genuine CDP touch attacks were used. No navigation-only playability claim is justified.
The added bout-scoped `damage.modify` observer only snapshots into a WeakMap and returns the
identical request. It does not replace requests, force hits, call reaction callbacks or write
enemy state/pose/clock. Its cost is nevertheless part of this instrumented run.

## Findings

- All 33 reported checks passed. Trace independently contains thrust windup/active/recover and
  14 player damage; a guarded sword hit deals three damage at pre-apply guard clock 0.3,
  followed by stage 4 interruption, counter windup/active/recover and 16 player damage.
- Nine sword hits are backed by nine trusted touch pointer events. Dedicated lethal cohort
  contains eight attacks; final hit is 12 to zero HP during an actual counter active phase.
  Queued damage-event snapshots are delivery-time observations, not impact-time substitutes.
- All 39 post-death samples are dead with idle strike. Player health remains
  55.99120000004774; no subsequent positive damage event occurs. This spans 9.728 wall seconds
  but only about 3.673 authoritative elapsed seconds, not 9.728 seconds of native simulation.
  Local practice loot reaches three coins/complete, then Retry resets it.
- Three Retry checks establish fresh full-health actors, disposed old bouts and detached dead
  meshes. Back checks old owner disposal, empty targets/fixed callbacks; restart uses the same
  Game with fresh health. The trace has one Game/canvas and no iframe throughout.
- All four storage snapshots (before, after death, after restart, after reload) are empty for
  local/session storage, CacheStorage, IndexedDB and service workers. Live SaveStore snapshots
  have empty documents/shard data and generation zero. Reload is lazy. No page/observer errors.
- All sampled clocks have scale one and no capture-FPS override. Fifteen bones, pose inputs,
  root and bone world matrices are recorded. RAF gaps are 6 to 1006.8 ms, median 196.3 ms;
  these are cloud observations, not physical-phone performance or every fixed tick.

## Video and visual inspection

`ffprobe -count_frames` decoded 1,518 frames, 60.72 seconds, 402 by 874, at 25 recorder fps.
Video SHA-256 is `c5529744d066eef5f873e7c6006a2181777f407dee2b5a12a53d851d22464a10`;
its 6,341,442 bytes match the report. Report and completed-report are byte-identical.
Inspected decoded frames 150, 300, 350, 1050, 1200 and 1400 (6, 12, 14, 42, 48 and 56 seconds),
not the entire video at normal speed. They visibly show the real portrait runtime, health,
compact selector/Back/Retry and diagnostic labels. Close player placements substantially crop
and occlude the creature; these views cannot support a likeness or animation/readability score.

## Remaining limits

No full player-defeat cycle, navigation-only combat, swept/contact-world admission, full motion
quality review, six-shard coverage, physical-phone performance, or other three enemies' complete
cycles are established here. Existing earlier failures remain retained. No runtime, old host,
public selector or Site was changed during this independent review.

Raw report, trace, video and screenshot remain under the original QA2 evidence directory.
Compact independent hashes are in `test/proof/shared-arena/current-four-1553/conch-attempt2-review-manifest.json`.
