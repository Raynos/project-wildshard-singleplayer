# Closed rig1: separate defeat-first supplement

2026-10-19. **Attempt 3 remains incomplete: no actual player defeat.** It is a
separate recording, not a replacement or splice into attempt 2. Prior movies,
raw reports and frozen recorders are unchanged. No acceptance or promotion.

## What occurred

The isolated app started with 100 player HP and 45 enemy HP. One explicitly
logged diagnostic player placement put the player 1.6m from the opponent.
There were no subsequent teleports, player attacks, health writes, clock edits,
or product modifications. The opponent dealt actual 12-damage hits. At the
reserved cutoff player HP was 16; another real hit during video delivery reduced
it to 4. HP never reached zero, so the recorder correctly skipped defeated-input
blocking and post-defeat Retry. These remain open coverage, not failed mechanics.

The operation ran 21:28:34.125–21:31:24.669 UTC (170.5 seconds), within the
180-second browser budget. Its original 390×844 WebM is 166.6 seconds / 4,165
encoded frames. These include repeated software-render frames and do not imply
phone performance. Telemetry contains 442 consecutive rendered frame IDs 3–444,
with no missing IDs; median delivered interval was 360.3 ms. Every sampled game
clock was live, unpaused, scale1 and captureFps=null. Browser/world stores were
empty. All 137 app files and 50 product files remained exact before and after.
Evidence is approximately 16.4 MB, below 192 MiB. Owned browser/server closed.

## Observed video-tail verification

A small diagnostic frame-ID marker was added to the page overlay, without
changing game content. The supported Playwright screencast observer read the
same compositor feed used by the original movie recorder. It observed target
frame431 before close. The finalized movie's actual last encoded image decoded
as frame435, beyond the intended target. Direct inspection confirms HUD health4
and overlay f435/t156.765. This establishes delivery of the incomplete endpoint;
it does not establish defeat or repair attempt 2's missing final hold.

The recorder's offline JPEG marker roundtrip and exact-last-frame extraction
were checked before launch. No complete image dump was made. Only the final
encoded image and last observed feed JPEG were retained alongside the original
movie and telemetry. No extra recording is implied or scheduled.

## Why another hit did not fit

Without repeated positioning, the player/enemy distance changed during genuine
combat. Later hits were roughly 5.9 game seconds apart, rather than the earlier
repositioned run's 4.58 seconds. Eight hits reached 4 HP; a ninth would require
additional normal gameplay beyond the reserved cutoff. The bounded recorder
reports that exact missing outcome instead of extending the budget or injecting
health. Full-body motion and corpse settling are outside this supplement.

## Exact pins

- Recorder: `85e5f8e0a9cf5229129884856e89871ba133670af3464a0c008471ead742f637`
- Raw report: `29801becb9e77fe1d6fac4d1e17d29efd4678d0cee993bd21ecaae85b0663453`
- Original movie: `ad42640ae0e8053e48e856e200c595186c2de0e8763783a0e2ff77f15f1ce569`
- Product sourceHash: `99a69f9d3fc61912beaf08db8e7d67456756773976bb9a199dbd033910d610ed`

Normal DPR2 phone renderer, three passes, one shadow cascade, gray-v2 lighting,
contact-v1 and authored-pose recoil remained unchanged. Existing unaccepted
source and public fallback status remain unchanged.
