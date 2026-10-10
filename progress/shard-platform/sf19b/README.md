# SF19b: Signal Dunes, Nalati and Nine Dragon under the one frame (E435, 2026-10-10)

These captures are regression evidence for the look only, not a frame-floor reading. The build is a DEVSERVER build of HEAD `c314dad40` (Nine Dragon's cell exists only in DEVSERVER), with Developer on, phone tier at 2x and Memory saver on. Each shard ran in one fresh muted Chromium context as an iPhone 16 Pro in portrait, entered from the ordinary title. `capture.mjs` made them, and `capture.json` holds the frame readout for every shot plus the weight curve sampled through the drive in.

Each row of `board.jpg` shows:

- **the pinned pre-pick capture:** Jake's G175 board, `art/grid/sf19a-frame-owner/owner-board.jpg`, row ON at build `2b61493`. Nine Dragon has none, because it had no far proxy then.
- **on the road:** the road look owns the frame. You see the far proxy, the haze band and the loading screen on the soft wall.
- **8 m outside / on the edge / 8 m inside:** the 16 m blend.
- **home, 14 m in:** the shard owns the frame.

What the captures show:

- **The 16 m blend is smooth for all three shards** on a real drive in from the road. The shard's weight runs 0.001 at 257.8 m from the cell centre, 0.50 on the line at 250 m and 1.00 at 242 m. It is a smoothstep with no step where `inside` commits on the line.
- **Signal Dunes (G94):** at home it shows its dusk grade, carried as its own grade chain, with weight 1. From the road it shows its warm band. Its native dunes stay drawn from the road, because its terrain is shardfile tiles.
- **Nalati (G96):** its own painterly frame (sunset sky, grade chain) runs from 8 m in to home.
- **Nine Dragon (G95):** at home and 8 m in it shows its dusk violet grade chain and an entry portal (G224). From the road it shows its silk border band and its far proxy skyline.
- **Open, outside SF19b:** Nalati and Nine Dragon are legacy runtimes, and their live world is hidden when the player stands outside the cell. On the line and from the road you therefore see the coarse far proxy, so the scenery swaps at the line even though the grade blends. This is SF47 / M3 conversion territory. Signal Dunes does not do this.
- **The LUT:** `chain.lut` was false for all three in the grid.
