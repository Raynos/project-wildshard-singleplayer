# DOWNLOAD: the phone sitting (J136)

**State:** ready, 2026-11-07. The sweep ran on production `214b9bd-mw64p4pc`; its gaps wait on Jake (meta `docs/plans/multi-repo/DOWNLOAD-THEN-C.md`). Run once.
About 5 minutes. It closes DL10, DL21 and DL24, with E5.4's gate in the same sitting (J121, D9).

**Low Power Mode on.** The links open Safari, which starts with nothing held on this build.

1. Open [Nine Dragon Stack](https://wildshard-singleplayer.vercel.app/?chunk=nine-dragon-stack). On the title turn on DEV: Safari starts with Developer off, and Nine says "Coming soon" without it. Tap SHARD SELECT, then ENTER WORLD on Nine. This is the cold run.
2. Walk for 10 s, then hoverboard at boost for 20 s.
3. Close the tab and open the same link. Tap SHARD SELECT, then ENTER WORLD. This is the warm run. Repeat step 2.
4. Pause, scroll to Developer ▸ Developer tools ▸ Clear downloads, twice as it asks. Developer stays on and the saves stay.
5. Open [Driftwood Isle](https://wildshard-singleplayer.vercel.app/?chunk=driftwood-isle), tap SHARD SELECT, then ENTER WORLD, repeat step 2. Cold.
6. Close the tab, open the same link, tap SHARD SELECT, then ENTER WORLD, repeat step 2. Warm.

**Watch for three things, on all four runs:**

- **DL21:** the loading card moves every second. It names what it's on, including "Server world".
- **DL10:** no freeze at Shaders. If it fails, turn off Pause ▸ Debug ▸ Loading & memory ▸ Early shader compile and run that shard again.
- **DL24:** the first 30 s are smooth, boost included.

**Answer:** "pass", or the shard, the run and the line that failed.
