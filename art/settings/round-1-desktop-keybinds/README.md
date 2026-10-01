# Desktop Settings / key bindings, round 1 (E357 J9, 2026-10-01)

Jake (wave 2): the pause ▸ Settings key bindings on desktop "is just a mobile layout on desktop" — a phone-width
column with one big box per key and raw ids (`ONFOOT · MOVE.FORWARD`), see
`progress/normalization/x1-board/controls-desktop/1440x900-*.jpg`. These are three desktop layouts, codex `image_gen`
edits of that live 1440 × 900 capture (Nalati, pause ▸ Settings), so the world behind stays true (gpt-6.1-sol, one take each, ~100 s; none re-rolled: every string came back verbatim). Mockups only: no
game code changed. iPhone keeps no key bindings (the panel stays desktop-only, `pointer: fine`).

| file | layout |
|---|---|
| `A-two-pane-table.jpg` | **A — two panes.** A category rail on the left (VIDEO · AUDIO · CONTROLS · KEY BINDINGS · GAMEPLAY · SAVE · REVIEW), the content on the right: a dense two-column ACTION / KEY / ALT table grouped On foot · Swimming · Combat · Riding · Menus, a live conflict (Interact → F, already Attack's alt) shown amber with SWAP KEYS / CANCEL, RESET TO DEFAULTS. |
| `B-keyboard-diagram.jpg` | **B — keyboard diagram.** Context chips (On foot · Combat · Riding · Swimming · Menus) over a full keyboard; bound keys lit with their action, a mouse diagram beside it, a detail card for the picked action (key, alt, REBIND / CLEAR) and a "changed from old defaults" card. |
| `C-four-columns.jpg` | **C — one board.** Every context as its own column (On foot · Combat · Riding & swimming · Menus), all visible without scrolling, a search field, a preset picker and RESET TO DEFAULTS in the toolbar, a row mid-rebind ("PRESS A KEY…"), and mouse look / invert Y on the bottom strip. |

All three: the pause menu becomes one wide panel (~88 % of the screen) with the MAP · GEAR · FINDS · FEATS · SETTINGS
tabs across the top, human action names instead of `context · action` ids, and the footer reads "Click outside or Esc
to resume" (desktop wording; the phone keeps "Tap outside…").

## Proposed default-key changes

The real defaults (`src/game/inputContexts.ts`, audited in `docs/tasks/asks/E365.md` § Audit) are mostly right: WASD,
Space jump, Shift sprint, C crouch, E interact, Q swap, 1–9 slots, R reload, LMB/F attack, RMB heavy/aim, Z/MMB lock,
Esc pause, Tab/I bag, M map, J journal, F8 quick note, H hoverboard. Changed in the mockups:

| action | now | proposed | why |
|---|---|---|---|
| Dodge | Left Alt | **V** (alt: Left Alt) | Alt on Windows Chrome / Edge moves focus to the browser menu on release, and it is the awkward thumb-tuck on a Mac. V sits next to C under the left index finger, beside the other movement verbs. |
| Crouch (hold) | Left / Right Ctrl | **removed** (C only) | `InputService` drops every Ctrl-modified keydown (`event.ctrlKey`), so the Ctrl default never worked, and Ctrl+W / Ctrl+S / Ctrl+D are browser shortcuts (close tab!) while W/S/D are held. |
| Move | WASD | WASD **+ arrow keys as alt** | One-handed / left-handed play; arrows were already wired for the Explorer free camera. |
| Note | N | **removed from the list** | N opens nothing in play (it only closes an open compendium, E365 audit); J is the journal. |
| Bag | Tab / I | **I** (alt Tab) | Tab moves browser focus whenever the pointer isn't locked; I is the primary, Tab stays as the alt. |
| Weapon slots | 1 … 9, one row each | **one "Weapon 1–4" row** | Nine near-identical rows were most of the old list; 5–9 stay bound behind the same row. |

Also proposed (not keys): VIDEO as its own category (quality tier and frame cap, today Debug-only rows) and the
binding list hiding contexts the current shard doesn't use (the audit: all four weapon contexts are listed on every
shard, so the list is not a capability list).
