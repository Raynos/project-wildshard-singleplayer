# menu / round-8-shard-select: the SHARD SELECT screen behind the new main menu (G88)

**Question: which SHARD SELECT screen opens from the new main menu's "SHARD SELECT" card?** G88 picked the crossroads hero
with two big cards (`art/menu/round-7-new-main-menu/B-*`), so each variant uses that same crossroads hero, dimmed and
blurred, behind navy-glass cards. Every variant shows "DRIFTWOOD ISLE", "PINE HOLLOW" and "NALATI GRASSLANDS", the
Developer-only shards ("SIGNAL DUNES", "SKY REACH") with an amber "DEVELOPER" tag, and a locked "COMING SOON" card. Every
variant also has "BACK", the "SHARD SELECT" title, the build chip and a wide "ENTER WORLD" button.

| Variant | File | What it shows |
|---|---|---|
| A | `A-carousel.jpg` | Today's horizontal carousel, restyled: one big Driftwood card with "PINE HOLLOW" peeking in from the right, and a strip of six thumbnails as the index (two "DEVELOPER", one padlock "COMING SOON") |
| B | `B-grid.jpg` | A 2 × 3 grid of big picture cards, so all six are visible at once: Driftwood selected with cyan brackets, then Pine Hollow, Nalati, Signal Dunes and Sky Reach (both "DEVELOPER"), and a hatched "COMING SOON" card with a padlock |
| C | `C-hero-list.jpg` | A vertical list with one wide cinematic hero per row: Driftwood selected, Pine Hollow, Nalati, Signal Dunes ("DEVELOPER"), and a "COMING SOON" row that runs off the bottom so the list reads as scrollable |
| | `board.jpg` | The pick board: A / B / C side by side |

**Recommended: B.** It shows every shard on one screen with nothing hidden behind a swipe. Each card is a big thumb
target, and the grid copies the main menu's two-card look. It also has room for two more rows as shards ship. A keeps
today's swipe, which hides most shards. C's wide heroes look best but fit only four rows per screen.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen`. Each variant was built from two
references: a fresh capture of today's shard picker (the title carousel of the HEAD build `5ab6a3c08`, served with
`serve-build.sh --head` and captured as an iPhone 16 Pro, 402 × 874 @3×, muted, through the browser lane) and the picked
main menu `art/menu/round-7-new-main-menu/B-crossroads-cards.jpg`. The card art is codex's own rendering of each shard's
style, not a capture. Every UI string was quoted. The frames are 1024 × 1536, JPEG. No re-rolls were needed. These are
mockups only: nothing here is built.
