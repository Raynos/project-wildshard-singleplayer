# DOWNLOAD: the phone sitting (J136)

**State:** ready, 2026-11-05. Run once, after `scripts/loading-flow/sweep.sh` passes on the flip build and production ships it.
About 5 minutes. It closes DL10, DL21 and DL24, with E5.4's gate in the same sitting (J121, D9).

**Low Power Mode on.** The links open Safari, which starts with nothing held on this build.

1. Open [Nine Dragon Stack](https://wildshard-singleplayer.vercel.app/?chunk=nine-dragon-stack) and tap ENTER WORLD. This is the cold run.
2. Walk for 10 s, then hoverboard at boost for 20 s.
3. Close the tab and open the same link. This is the warm run. Repeat step 2.
4. Pause ▸ Settings ▸ Debug ▸ Clear downloads, twice as it asks.
5. Open [Driftwood Isle](https://wildshard-singleplayer.vercel.app/?chunk=driftwood-isle), tap ENTER WORLD, repeat step 2. Cold.
6. Close the tab, open the same link, repeat step 2. Warm.

**Watch for three things, on all four runs:**

- **DL21:** the loading card moves every second. It names what it's on, including "Server world".
- **DL10:** no freeze at Shaders. If it fails, turn off Debug ▸ Early shader compile and run that shard again.
- **DL24:** the first 30 s are smooth, boost included.

**Answer:** "pass", or the shard, the run and the line that failed.
