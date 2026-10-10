// Nine Dragon Stack (PROGRESS-TRAILER §2.2 0:22–0:28, row PT5) — scouted, NOT a lapse: its stages do not read as growth.
// The in-engine first commit, 3719d1d8e (26 Sep), is already the whole of Lantern Square under neon rain (the gate,
// the banyan, the stalls, the crowd); 26 Sep's checkpoints add a far bank of towers across the Well; 29 Sep's E281
// passes restyle it (a green-roofed paifang for the red one, lantern strings, red umbrellas, steam) — a different look,
// not a fuller one, and the bright red gate and pink neon of the first commit read as strongly as the end; 29 Sep 02:43
// → 30 Sep (19a434635) changes nothing visible. The sheet (lapse-cut.mjs sheet) shows the stages at one pose over the
// square; by §2.2 the lapse becomes the Pine Hollow remaster (lapses/pine-hollow.mjs).
export const lapse = {
  name: 'nine-dragon',
  title: 'Nine Dragon Stack · scouted stages (not growth)',
  seconds: 6,
  query: 'chunk=nine-dragon-stack&nolock=1&skipintro=1&mute=1',
  fov: 50,
  warmSec: 20,
  path: [
    { t: 0, cam: [2, 134, 18], at: [6, 128, -24] },
    { t: 6, cam: [2, 134, 18], at: [6, 128, -24] },
  ],
  sheetT: 0,
  stages: [
    { sha: '3719d1d8e', t0: 0, t1: 1 }, // 26 Sep 01:40 the in-engine partial shard: Lantern Square, the Well rim, the stair
    { sha: '670935023', t0: 1, t1: 2 }, // 26 Sep 02:45 checkpoint 2: the eight-dome build, towers across the Well
    { sha: '291d7ddfd', t0: 2, t1: 3 }, // 26 Sep 19:19 the Fei Zhua zip, verandas, painted textures
    { sha: '4fea5c24e', t0: 3, t1: 4 }, // 29 Sep 00:10 F4/F5: the Well's cloud strata, stair pass 1
    { sha: '94c4e1175', t0: 4, t1: 5 }, // 29 Sep 01:08 E281 render pass 5: lantern strings, the restyled gate, umbrellas
    { sha: '19a434635', t0: 5, t1: 6 }, // 30 Sep 23:57 main's day 15
  ],
};
