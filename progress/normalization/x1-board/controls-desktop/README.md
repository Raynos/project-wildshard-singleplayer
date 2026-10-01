# E357 J7 — desktop Controls, hidden on touch

The existing Settings **Key bindings** card (the Controls entry and panel) is visible only when
`matchMedia('(pointer: fine)').matches`. A touch-only phone, tablet, or phone requesting a desktop site
has no card/title/buttons in the rendered Settings menu. Touchscreen laptops retain it in desktop pointer mode.
Pointer-mode changes update visibility and cancel pending key capture. Other Settings remain unchanged.

These are real in-game Nalati Settings captures, from clean candidate `cf5c56434cae280120e7aff4bf0ecdf135e8d4da`.
Chrome 153, Metal, muted; desktop captures used agent-browser. The portrait capture used a real coarse-pointer,
touch-enabled mobile context in the same Chrome browser through Playwright/CDP (iPhone emulation, not Safari).
The Settings menu has one tab, so its tab bar is hidden; Controls is the inline **KEY BINDINGS** card, with no
separate navigation button. Settings shots include SAVE immediately above its entry. No capture-only DOM/CSS changes.

| Frame | 1440×900 desktop | 1280×800 desktop |
|---|---|---|
| Settings and Controls entry | [Settings](1440x900-settings.jpg) | [Settings](1280x800-settings.jpg) |
| Defaults: forward W / back S | [Defaults](1440x900-defaults.jpg) | [Defaults](1280x800-defaults.jpg) |
| Forward picked, S pressed: conflict, SWAP KEYS / CANCEL | [Conflict](1440x900-conflict.jpg) | [Conflict](1280x800-conflict.jpg) |
| SWAP KEYS: forward S / back W | [Swapped](1440x900-swapped.jpg) | [Swapped](1280x800-swapped.jpg) |

[390×844 portrait touch Settings](390x844-touch-settings.jpg) shows the end of Settings after SAVE:
there is no Key bindings entry or panel. [DOM proof](proof.json) records fine=false, coarse=true, one touch point,
hidden=true, inert=true, display=none and zero bounds. The only visible card titles are Settings and SAVE.

All nine final JPEGs were inspected; all are under 100 KB. Defaults were reset between sizes and after the swap.
The browser and preview were closed after capture. Earlier capture attempts were replaced after correcting
the capture runner's Reset selector and SWAP KEYS text case; agent-browser's device preset alone did not enable
coarse-pointer emulation, so the portrait uses Playwright's `isMobile: true, hasTouch: true` context.

Validation on the clean source candidate: TypeScript, whole-tree oxlint, all 2,245 Vitest tests passed,
including six new Controls tests (both desktop sizes, hybrid laptop, phone, desktop-site touch, live mode change
and capture disposal). Four phone shard boots plus `_template` passed with empty `boot.errors` using
`--only=fingerprint+poses`; [proof.json](proof.json) records those errors. The final landing candidate is rechecked
against current HEAD before landing; its handoff is appended to `docs/tasks/asks/E357.md`.

Final candidate `c37d98b9` includes the two concurrently landed Z3 shards. TypeScript, whole-tree oxlint and
CSS check passed; all six Controls tests passed. Full Vitest: 2,244 passed, 15 known new-shard failures
(chunks/explore/fight-rules/ktx2-auto/loot/models-*/shard-prefetch/template/model-contract assumptions).
Every shard, including both new shards and `_template`, booted with `boot.errors: []`; the existing shards'
fingerprint comparison differs only in `boot.saves.read` now including the two new shard namespaces.
The lead explicitly authorized landing J7 despite these known failures; a separate builder owns their fixes.
The commit message lists all failing tests. The lead owns the push and milestone acceptance.

To reproduce: serve a clean build of the J7 commit, open Nalati muted in Chrome desktop, open PAUSE ▸ Settings,
scroll to SAVE/KEY BINDINGS, then select ONFOOT · MOVE.FORWARD and press S. Capture the conflict at the bottom,
pick SWAP KEYS and return to the top of the card. Repeat at both desktop sizes, resetting defaults each time.
For the portrait run use a 390×844 mobile context with touch enabled, phone tier and the existing touch harness,
then scroll to the bottom of Settings. Every browser run goes through `scripts/browser-lane.sh`; close it afterward.
