# DOWNLOAD — State (coordinator: the multi-repo DOWNLOAD lane; ≤ 3 KB)

**2026-11-05:** every open row is built, on the worker path as well as the shipped path. What is left is J136's close.
Rows and history: [DOWNLOAD.md](../DOWNLOAD.md). Queue: meta `docs/plans/multi-repo/DOWNLOAD-THEN-C.md`.

**Spine:** Runtime packs ON for everyone (DL16 `d0683e4e38`). Goal: tap → control and a smooth first 30 s (G1000, G1008), every
second something moves (G1006). The level is complete at control.

**The close, in order (J136):**
1. The upgrade visit: a watcher runs `run.sh --upgrade --out tmp/loading-flow/upgrade driftwood nalati` on the first production
   deploy past `a3e7ef2`.
2. The flip lands and deploys (SESSION stage 2). No reading counts before that.
3. `scripts/loading-flow/sweep.sh https://wildshard-singleplayer.vercel.app`: about 3 hours, resumable, a verdict per row.
4. [The phone sitting](PHONE-SITTING.md), with E5.4's gate: Nine and Driftwood, cold and warm, Low Power Mode on.
5. DL10's Debug row goes, this plan archives, C starts (J25).

**Open, all readings:** DL1, DL5, DL10, DL11, DL15, DL17, DL18, DL21, DL23, DL24, DL25. DL20 needs one digest, and
`~/.config/wildshard/telemetry.key` isn't on this Mac, so `telemetry-brief.mjs` reads nothing here.
**Closed by J136:** DL6, DL7. **Closed by SHARD-SIZE S2:** DL2, reversed. DL20: files only a whole-level set lists left the deploy 11-06 (164 MB); a default set's stay for road crossings (G828).

**Named exception:** DL11 (J143).

**Calls, for Jake's review:**
- 11-05 DL25: the worker asks the page over a third port instead of `clients.claim`: `sw.ts` claims no document, on purpose. The page
  also moves an asked file to the front of its job. The port carries no format change, so `standaloneControl` stays.
- 11-06 DL17, DL21: the server boots under the card, before control (`76391156c6`). Nalati warm pays about 6 s, Simulator under load.
- 11-06 DL10: the flip adds a dark fifth light on Pine, owner unfound: 61 / 107. Re-bake right after the flip, not before.
- 11-06 DL23: a cold run wiped the upgrade arm, so `1ac1ea6`'s visit read cold. Redo: swap builds on one local port.
- 11-05 DL17: only the server's code and server class are listed apart. A worker fetching anything else is a bug, so it stays red.
- 11-05 boost and harness: Developer boost is a `NET_BUTTONS` bit a standalone server honours and any other host ignores. A harness's
  move has its own port, not the format's control port.
- 11-05 sweep: DL5's n=3 runs Driftwood, Nine and Pine; the other three shards run packs only, once.
- DL5 "whole level" = the tier's whole inventory at control, unless a shard selects packs-set 'fence' (Pine, Nalati, Driftwood; phones only since S3).
- DL17 (A): distance show / hide / LOD of resident models is listed, not red. Grid neighbours keep today's loading (G828).
- G872's earlier calls are in git: this file at `f117380538`.

**Rules:** G844, G848, G1006, G1008; goldens before any look change (G998); no reverts.
