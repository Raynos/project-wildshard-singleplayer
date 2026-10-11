/** [dirX, dirZ, amplitude m, wavelength m, speed m/s, steepness 0..1] — gentle lagoon swell; λ ≥ 11 m so the phone's 4 m grid resolves them */
export const WAVES: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.86, 0.51, 0.17, 27, 3.4, 0.55],
  [-0.34, 0.94, 0.12, 17, 2.6, 0.5],
  [0.62, -0.78, 0.07, 11.5, 2.1, 0.45],
  [-0.9, -0.43, 0.06, 14, 2.3, 0.4],
];

