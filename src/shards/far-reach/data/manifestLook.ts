/** Unchanged painted lighting, atmosphere and grade facts from the shipping manifest. */
export const SKY_MANIFEST_SKY = { sunColor: [1, 0.8, 0.58] as [number, number, number], sunIntensity: 2.3, envIntensity: 0.7, bgIntensity: 1, fogSunColor: [1, 0.82, 0.64] as [number, number, number], cloudSunColor: [1, 0.84, 0.7] as [number, number, number],
    hemiSky: 0xc8c6dc, hemiGround: 0x9e98ac, hemiIntensity: 1.4, sun: { azimuth: 300, elevation: 4.3 } };
export const SKY_MANIFEST_ATMOSPHERE = { fogHeight: -20, fogHeightFalloff: 0, fogHeightDensity: 0, fogDistDensity: 0, volumetricSunColor: [1, 0.8, 0.6] as [number, number, number] };
export const SKY_MANIFEST_GRADE = { saturation: 0, brightness: 0, contrast: 0.12, bloomIntensity: 0.35, bloomThreshold: 0.7, shadowTint: [0.97, 0.98, 1.04] as [number, number, number], highTint: [1.06, 1.0, 0.88] as [number, number, number], lift: [0.012, 0.004, 0] as [number, number, number], gain: [1, 0.99, 0.97] as [number, number, number], gamma: 1 };
