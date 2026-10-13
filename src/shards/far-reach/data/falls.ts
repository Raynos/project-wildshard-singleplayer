/**
 * The falls (loop 5): waterfalls off the playable isles' rims into the cloud sea (the targets have them; council R1C-9).
 * Loop 2's fourteen 3-D skyline islands are gone (council R1C-12 / R1B-7: bare cones in front of the painted matte's
 * finished islands); the panorama (look/sky.ts) carries every far island now. Each fall is [isle, the rim angle in
 * radians (0 = +x), length].
 */
export const FALLS: readonly (readonly [isle: string, angle: number, length: number])[] = [
  ['windmill', Math.PI, 60], ['windmill', Math.PI * 0.25, 46], ['grove', Math.PI * 0.75, 44], ['grove', Math.PI * 1.6, 38], ['ruin', 0.2, 50], ['ruin', Math.PI * 1.3, 40],
  ['keeper', Math.PI * 1.15, 40], ['keeper', Math.PI * 0.4, 34], ['crown', Math.PI * 1.55, 70], ['crown', Math.PI * 0.9, 60], ['roost', Math.PI * 0.35, 42], ['step', Math.PI * 1.05, 50], ['sunrest', Math.PI * 1.25, 46],
];
