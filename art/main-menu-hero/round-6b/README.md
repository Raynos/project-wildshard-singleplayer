# Main-menu hero, round 6b: NE-b with all nine cells near (G383 / G380)

Jake picked NE-b from round 6 (G383; the coordinator shipped it in `bcaa12ff3`, and nothing here touches the title
images). His follow-up: *"once Sky Reach and the Blender Template have near views, re-shoot NE-b with them"*. Both got
their near views in `17279180a`, so this is that re-shoot.

Board: [`board.jpg`](board.jpg), square beside landscape. The single frames are
[`SQ-NE-b-1440x1440.jpg`](SQ-NE-b-1440x1440.jpg) and [`LS-NE-b-1920x1080.jpg`](LS-NE-b-1920x1080.jpg). They are real
canvas captures of a clean HEAD build (`c0d57c3`), with no paint-over:
`scripts/capture-main-menu-hero.mjs --round=6 --enter --only=SQ-NE-b,LS-NE-b --sessions=1440x1440,1920x1080`, labelled
by `scripts/near-tier-board.py <capture> <art> 6b`.

**The camera is exactly round 6's NE-b.** The eye is at (805, 520, 0) and aims at Driftwood's centre (0, 0, 0), 33°
down, with the phone-1x lens (62° square, 43° vertical landscape). `capture.json` matches round 6's to the digit.

Every frame's tiers, read from that frame and burned into its label:
- **entered:** Nalati, on its own runtime at full quality.
- **near:** all eight others (Debug > Look > Neighbour detail C, the capture-only row): Pine 633 m, template 305 m (plus
  its 6 L1 tiles), Signal 1110 m, Driftwood 555 m, **Sky Reach 633 m**, **Blender tmpl 1151 m**, Pastel 1151 m and
  Ink-cel 305 m.
- **far proxy:** none.

27.5 MB is resident on the `near` line.

Compared with round 6, Sky Reach (right of Driftwood) now draws its own island models in turf and stone over its cloud
sheet, and the Blender template (back left) draws its clay hall and blocks from its own tiles.
