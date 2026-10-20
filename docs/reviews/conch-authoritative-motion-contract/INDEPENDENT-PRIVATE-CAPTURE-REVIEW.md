# Independent private canonical capture review

Date: 2026-10-20. Verdict: captured canonical synthetic ownership lifecycle is
supported; the persistence-only failure is a confirmed assertion mismatch.
Original browser process remains **exit 1**, with no clean rerun claimed.
Post-hoc storage revalidation is accepted for these recorded observations only.
No selected-Conch geometry, contact, authored-motion or public admission follows.

## Identity and original failure

Independently hashed the unchanged original report:
`e1baf026f0a4de87c7e454d4c25b802c8cd0e3270acb330c4db67f50a41089eb`.
Its exact corrected host receipt is
`fc98822427d9fbca80b229ee726c60b5492e7f4e9d8969886901242fddfa662a`.
Of 17 checks, only emptyPersistence is false. No page errors, observer errors,
system faults, overflow or denied network requests are recorded.

SaveStore.exportAll (store.ts lines 326–334) always includes global; savedDoc
(lines 115–118) returns {keys:{}} when no raw document exists, without writing.
The original QA incorrectly required zero exported document names. Independent
post-hoc comparison of the immutable report found exactly empty local/session
maps at all four boundaries, saved=null before each boot, and precisely
{global:{keys:{}}} after each boot. No reward key exists in those observations.

The correction accepts only that exact running envelope, rejects null after
boot, additional namespaces, reset metadata, malformed containers and any key.
Tests use actual storage-disabled SaveStore and reject real global/profile/shard
writes, not just constructed happy-path JSON. Writer's 23-test combined run and
final 15-test persistence run are reported green; targeted strict/lint gates
pass. The wider concurrent engine type failure remains recorded, not a global
strict-pass claim. Original report/raw evidence is not rewritten. Verified the
frozen QA and post-hoc manifests below; independently inspected validator/tests.
This checks localStorage, sessionStorage and exported save docs, not every
browser storage API or a proof of no transient write between observations.

## Independent raw-trace inspection

Parsed original complete trace JSON, rather than relying only on report booleans:
- Cycle: 4,800 pre/post records, 829 render observations, 16 combat receipts,
  10 lifecycle records. Its 2,400 post ticks are contiguous within four bouts
  (547, 1,841, 7 and 5 observed post ticks), with no skipped ordinal inside them.
- Six actual enemy damage receipts culminate in death at native tick 224.
  206 live physical post records use one body handle. First frozen post is tick
  431; 121 frozen posts retain one identical actor position and physical
  quaternion. Live census has one rigid body; frozen census has zero.
- Three previous owners close and release their leases, each disposal recording
  zero remaining rigid bodies. Both Retry attachments start at native tick zero.
  Reselection is observed at tick three, not falsely claimed as a zero-tick read.
- Loot records three practice coins; Retry/reload records zero coins and fresh
  health. Eight actual enemy-to-player damage receipts culminate in player death
  at tick 1,783; defeat Retry restores 100/100 health and a reserved owner.
- Reload trace: 102 pre/post records, 27 render observations, no events/errors.
  Initial/reloaded attachment occurs after startup ticks; no all-startup trace
  coverage or historical restore is inferred.

Cycle trace SHA256: `2aa2a5b548b0bc2e89d515abdbaa325bb6831abd208f539705217558fdb25f55`.
Reload trace SHA256: `6da54cc1a328a7c241d281b85c040c3ca81224b3f4c00a74af1c8ef8fd7bc411`.

## Actual video inspection and cadence limits

Used ffprobe decoded-frame counting on the original VP8 WebM: **5,362 frames,
214.48 seconds, 402×874, encoded 25 fps**. Used single-thread ffmpeg to derive and
visually inspect 21 samples at ten-second cadence across the video, plus 16
one-second samples from its 10–26 second combat/collapse interval. This is
37 representative frames, not inspection of all 5,362 frames or a full-speed
continuous playback claim. Derived sheets remain separate from raw evidence.

The real first-person view visibly shows sword flashes, enemy topple, the local
three-coin message, Retry, player health depletion and restored health. The
synthetic/non-art disclaimer remains visible. Close framing and the conspicuous
numeric witness do not establish animation quality or surface contacts.

Encoded frame rate is not application cadence: cycle render observations span
127.8654 seconds, with median inter-observation time 131.6 ms (range 4.2–1,017.4
ms). The complete video also includes transfer/reload/wait time. Draw count and
wall time are not fixed simulation ticks; this cloud capture is not a phone
performance benchmark or a 25-fps gameplay claim.

Video SHA256: `e8abd5d2aa97e7cd12f1722abd7441bdf9b21251af9308bd88db3e912fae52fe`.
No browser/app build, production edit or gameplay tuning was performed by this
reviewer. Root owns checkpoint and any subsequent use of this engineering proof.

## Frozen QA and post-hoc evidence

```text
943c0d637c4a88cd56b9f6ef3cb8cc54a7e774a1880b829d125bd7e7da531d0e  scripts/native-owner-proof-persistence.ts
bcbd33602b1a55b5ac6e965ef93ce75dff90576b1ff213eefcc3d90206419f8c  scripts/qa-native-owner-proof.mjs
27cd6750d7df5c2aceb0a159c92dfede060068d7759e3b630abf95ab823a682c  scripts/qa-native-owner-revalidate.mjs
3ddaa6b13690c377d69f0ea4386dc79dd7d43c2adbd1af18966adb9ee8ab9c53  test/native-owner-proof-persistence.test.ts
8d40a6e0c5fdf25faf59d609b9a1cdb2becca9ff905dd4c0c1e7973788f4f2ba  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-BROWSER-PIN-RESOLVER1.json
f3ae70efcbd161b13bda8cb78bb7e1dfe29dbef9177d58265ba78f4bc16ff4f2  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-CAPTURE-POSTHOC.json
5db1b8c16ef94334f0003a594d716d2c3002b11c8bcf99105b12e6b764597234  docs/reviews/conch-authoritative-motion-contract/PRIVATE-CANONICAL-RESOLVER1-BUILD-SUMMARY.json
```
