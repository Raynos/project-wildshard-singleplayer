// Driftwood Isle is born (PROGRESS-TRAILER §2.2 0:12–0:18, row PT5): six stages, one second each, one slow drift from
// the south-east over the south pier toward the island (2.7 m/s, no orbit). The plan's first SHA, 3a83028ec ("open ocean +
// the south pier"), and step 2, 54e85c542, never load: Undergrowth.place picks from an empty forest (`this.forest.trees`,
// "reading 'r'") and the loading screen never ends, so the lapse starts at the first loadable SHA, step 3's beach (§3.1).
export const lapse = {
  name: 'driftwood',
  title: 'Driftwood Isle · lapse stages',
  seconds: 6,
  query: 'chunk=driftwood-isle&nolock=1&skipintro=1&mute=1',
  fov: 50,
  warmSec: 12,
  path: [
    { t: 0, cam: [124, 91, -334], at: [0, 4, -150] },
    { t: 6, cam: [112, 86, -324], at: [-4, 4, -146] },
  ],
  sheetT: 3,
  stages: [
    { sha: 'd845c26c1', t0: 0, t1: 1 }, // 18 Sep 01:50 step 3: the beach (island landscape, lagoon shelf, sand crescent)
    { sha: '9625c070c', t0: 1, t1: 2 }, // 18 Sep 02:05 step 4b: the hut plateau and its hut, palms
    { sha: '9877ac180', t0: 2, t1: 3 }, // 18 Sep 02:13 step 4c: the north-east headland and the lookout tower
    { sha: '1873f316a', t0: 3, t1: 4 }, // 18 Sep 02:29 step 4f: Wreck Cove, the ring shrine, bushes, three jetties
    { sha: '43d602e5a', t0: 4, t1: 5 }, // 23 Sep 02:51 W1b: toon light, stylized sky, the turquoise lagoon, the wreck rebuilt
    { sha: '2d2c5815a', t0: 5, t1: 6 }, // 23 Sep 20:40 main's day 8: the Blender cove, ocean v2, the full island
  ],
};
