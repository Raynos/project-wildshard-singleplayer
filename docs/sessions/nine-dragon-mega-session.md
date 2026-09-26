# Nine Dragon session — feedback ledger

Updated: 2026-09-26. This is the short list to use when Jake returns and asks to go through pending reviews. Keep each item here until Jake answers; move answered items to **Resolved**. Do not turn this into an implementation task list.

## Needs Jake

| ID | When ready | One thing to review or decide | Material |
| --- | --- | --- | --- |
| F1 | Now | Review the five-page **imaginary Nine Dragon** build story. Does its one-small-slice-at-a-time rhythm give enough room for taste and steering? | [PDF](../process/nine-dragon-imaginary-play-by-play.pdf), E207 |
| F2 | Now | Review the three-page skill user manual for Matthew. Is it understandable without reading the underlying skill? | [PDF](../process/shard-checkpoints-user-guide.pdf), E207 |
| F3 | Now | Review the shared HUD/Weapon Explorer mockups: portrait grid arena, three spaced humanoid dummies, first-person combat, a nine-angle sheet for each dummy, and nine views of the whole arena. Pick corrections before implementation. | [mockups](../../art/hud-explorer/round-1-arena/README.md), E208/E210 |
| F4 | Now | Review the **portrait Nine Dragon trailer recut** with the playable grapple. Does the crossing read clearly, and is the 15-second cut ready? | [video](../../art/nine-dragon-stack/round-19-portrait-grapple/nine-dragon-portrait-grapple.mp4), [contact sheet](../../art/nine-dragon-stack/round-19-portrait-grapple/contact.jpg), E204 |
| F5 | After model catalog deploy | Review the three placed GLB assets in Model Explorer and say which need more polish before further shard expansion. | E205 |
| F6 | If the physical-phone double load happens again | Read or screenshot pause → Settings → Debug → Loading & memory → **Last reload** after the second Nine Dragon load. It records whether the previous page ended intentionally or unexpectedly and which shards were resident. | E200 |

## Resolved decisions

| Decision | Jake's answer |
| --- | --- |
| Trailer cut | Re-cut with real grapple. Fall-through-the-Well cut is preliminary only. |
| HUD/Weapon Explorer scope | Shared across shards. |
| Practice targets | Wood frame + wood armor; straw body + cloth armor; wood frame + steel armor. All humanoid and animated. |
| Contact sheets | Nine views around the dummies **and** nine views around the entire arena with all three dummies. |
| Play-by-play PDF example | Nine Dragon, not Driftwood 2. Driftwood 2 is future work. |
| Dirty art and audio | Keep all art/audio; trim benchmarks. |
| PWA reload investigation | Reproduce in iOS Simulator; do not wait for Jake to inspect a debug panel. |

## How to use this file

When Jake says “go through the ledger,” start at F1, show one linked item, record the answer here, and only then advance. New questions enter **Needs Jake** with one clear decision and a reviewable artifact. Avoid asking for a batch of unrelated picks.
