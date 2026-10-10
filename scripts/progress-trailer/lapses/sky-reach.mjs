// Sky Reach (PROGRESS-TRAILER §2.2 0:32–0:40, row PT5): from the first commit's three isles to a golden archipelago.
// The archive (progress/far-reach/*/meta.json) only picks the SHAs; the picture is a 16:9 re-render. Overview stages on
// a slow push from the archive's aerial-overview camera ((0, 130, 90) along (0, −0.466, −0.885)), one second each; then,
// on a beat, a near-spawn crane at c9aaa62ab that eases into the player's own first-person camera: its last frame
// releases the game camera (viewmodel back), so it is the week-3 take's frame 0 at the same SHA and pose. `player` is the
// shard's own spawn on Sunrest, (0, −5.5) facing the windmill bridge (a spawn at d22-sunrest's (0, −4) found no ground in
// the warm-up and the build put the player back on its spawn); PT3's week-3 take starts there, or this key moves to its
// spawn. The rail sliding out and the inset growing to full-bleed over the last bar are the authoring frame's
// (composited later); this is the picture, full-frame.
const CRANE_END = 8 - 1 / 60; // the clip's last frame
export const lapse = {
  name: 'sky-reach',
  title: 'Sky Reach · lapse stages',
  seconds: 8,
  query: 'chunk=far-reach&nolock=1&skipintro=1&mute=1',
  fov: 45,
  warmSec: 15,
  path: [
    { t: 0, cam: [0, 131, 95], at: [0, 61, -40] },
    { t: 5, cam: [0, 125, 82], at: [0, 59, -46] },
  ],
  sheetT: 2.5,
  stages: [
    // archive stages (the first 43 hours, 54e37d4dd → 6066f959c); 3526084b3's grey pucks (18:22) read worse than the first
    // commit's green isles and are dropped (stages are monotonic, §2.3)
    { sha: '54e37d4dd', t0: 0, t1: 1 }, // 1 Oct 14:56 the first commit: three isles, a windmill, rope and hover bridges
    { sha: '29719c971', t0: 1, t1: 2 }, // 1 Oct 22:25 the chain north, the crown isles, a warm sky
    { sha: 'c889fb2fa', t0: 2, t1: 3 }, // 2 Oct 00:43 council round 1: the painted sunset and cloud sea
    { sha: '7ec2c7370', t0: 3, t1: 4 }, // 2 Oct 21:49 mockup council round 1: the archipelago, waterfalls
    { sha: '6066f959c', t0: 4, t1: 5 }, // 3 Oct 09:52 E410: keeper and windmill sets, upper sky, isle light
    {
      sha: 'c9aaa62ab', t0: 5, t1: 8,
      // the crane: ~5 m in 3 s, eased (peak ≤ 3 m/s, checked by the receipt), from behind and above Sunrest's rim down into the take's eye
      path: [
        { t: 5, cam: [0, 34.5, -1.5], at: [0, 30.5, -40], fov: 72 },
        { t: CRANE_END, player: [0, -5.5, 0, 0] },
      ],
    },
  ],
};
