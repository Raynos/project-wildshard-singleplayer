// The Nalati look-pass reference poses — shared by scripts/nalati-parity.mjs and scripts/nalati-paintover.mjs.
/**
 * The reference poses (look-pass.md). x / z in engine metres (+z north, −x east), yaw 0 = facing south (−z),
 * +π/2 = east, −π/2 = west, π = north; pitch radians (+ = up). `phone` overrides the yaw / pitch for the narrow
 * portrait frame (the mockups ARE portrait phone frames; the desktop frame is wider, so it may centre differently).
 * `time` sets the day clock (DayNight.ts phases or an hour).
 */
export const POSES = [
  // the master frame: from the escarpment's first bench above the camp, looking N down across the braided Kunes to the
  // yurts on the valley floor and the ranges behind (the mockup's framing; the planet is behind us in this layout)
  { id: 'camp', mockup: 'round-1/1-art-style/style-B-painterly.jpg', what: 'the master frame: yurts below, the braided river, spruce, the valley, the snow range',
    x: 102, z: 92, yaw: 2.95, pitch: -0.2, phone: { yaw: 3.05, pitch: -0.24 } },
  // on the plateau south of the rim (clear of the brook), looking SSW across the grass to the snow range and the planet
  { id: 'plateau', mockup: 'round-2/1-combat/combat-C-bow-foot.jpg', what: 'grass carpet, flowers, wind',
    x: 82, z: -78, yaw: -0.3, pitch: -0.1 },
  // the horse plains, looking south over the herd to the range
  { id: 'horses', mockup: 'round-2/2-creatures/horses-1-wild-herd.jpg', what: 'open plateau, creatures, distance',
    x: 150, z: -62, yaw: -0.1, pitch: -0.06 },
  // the valley floor north of the Kunes, looking south up the waterfall ravine: river, gravel, spruce gullies, the rim
  { id: 'gully', mockup: 'round-1/5-concept-art/concept-3-river-gorge.jpg', what: 'trees, river, slope, rock',
    x: 64, z: 203, yaw: 0.05, pitch: 0.04 },
  // the road side of the hitching rail, the tied horse (B8) in front, looking W over the camp into the low sun (golden hour)
  { id: 'rail', mockup: 'round-2/2-creatures/taming-3-bonded.jpg', what: 'camp detail, props, close models',
    x: 73.5, z: 206, yaw: -1.3, pitch: -0.06, time: 17.8 },
  // the kurgan field at golden hour, the great kurgan ahead, the range behind
  { id: 'kurgan', mockup: 'round-2/4-named-elites/elite-2-kokbori-sky-wolf.jpg', what: 'stones, dusk light',
    x: -128, z: -62, yaw: 0.22, pitch: -0.02, time: 17.8 },
];
