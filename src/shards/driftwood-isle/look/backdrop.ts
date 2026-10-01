/**
 * Driftwood's sky backdrop (E357 S4.3 step 2, 08 §6.3 B; it was Sky.ts's `setupStylized` and the stylized clock's
 * wiring): no HDRI at all — the stylized gradient dome + faceted cumulus (stylizedSky.ts) is the background, a PMREM of
 * the dome is the (specular-only, toon.ts) environment, re-rendered as the day / night clock moves on, and the sun starts
 * where the clock puts it. The clock (dayNight.ts) turns the lights, fog, toon uniforms, the dome's palette, the disc and
 * the planet's lit side from `bind` on; it steps its own shadow light, so it runs after the cascades (`updateAt: 'late'`),
 * and the planet keeps its opacity by night (`fadesPlanet: false`).
 */
import * as THREE from 'three';
import { preloadBakedTextures, loadLUT, type SkyBackdropFactory, type DayCycleClock } from '#engine';
import { DriftwoodSky } from './dayNight';
import { MIDDAY_SKY, StylizedSky } from './stylizedSky';
import { toonUniforms } from './toon';

/** the sun before the day / night clock moves it: mid-morning from the east-south-east, 38° up */
const STYLIZED_SUN = new THREE.Vector3(-0.74, 0.616, -0.27).normalize();

export const STYLIZED_BACKDROP: SkyBackdropFactory = async ({ sky, scene, renderer, level }) => {
  const [, lut] = await Promise.all([preloadBakedTextures(), loadLUT(level.id)]);
  sky.sunDir.copy(STYLIZED_SUN);
  const st = new StylizedSky(sky.sunDir).build();
  scene.add(st.dome);
  scene.background = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  let envRT: THREE.WebGLRenderTarget | null = null;
  /** re-render the dome into the PMREM environment (the clock calls it when the sky has moved on; ~1 ms of GPU) */
  const refreshEnvironment = (): void => {
    pmrem ??= new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(st.envScene, 0, 1, 3000, { size: 64 });
    envRT?.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  };
  refreshEnvironment();
  scene.environmentIntensity = level.sky.envIntensity;
  toonUniforms.uFogZenith.value.copy(st.u.uZenith.value); // the colour-ramp fog (L3) fades into the dome's own gradient
  let clock: DriftwoodSky | null = null;
  return {
    get clock(): DayCycleClock {
      if (clock === null) throw new Error('driftwood-isle: the sky backdrop is not bound yet');
      return clock.clock;
    },
    horizon: st.u.uHorizon.value.clone(),
    lut,
    clouds: st.dome, // Game.ts keeps `sky.clouds` on the camera: the dome and its cumulus ring
    updateAt: 'late',
    fadesPlanet: false,
    palette: { uHorizon: st.u.uHorizon, uCloudLit: st.u.uCloudLit, uSunGlow: st.u.uSunGlow, uSunDir: st.u.uSunDir, middayLit: MIDDAY_SKY.cloudLit },
    bind: (T) => {
      T.planet.uCrisp.value = 1; // a crisp, opaque disc against the stylized dome
      // the day / night clock (L7, D3) turns every knob above from here on
      clock = new DriftwoodSky({
        sunDir: T.sunDir, lights: T.lights, lightDirection: T.lightDirection, hemi: T.hemi, fog: T.fog,
        fogSunDir: T.fogU.fogSunDir.value, fogSunColor: T.fogU.fogSunColor.value, toon: toonUniforms,
        setSkyPalette: (pal, dir) => { st.setPalette(pal); st.u.uSunDir.value.copy(dir); },
        disc: T.disc, planetSun: T.planet.uSunDir.value, planetHaze: T.planet.uHaze.value,
        refreshEnvironment, shadowBusy: T.shadowBusy,
      }, level.sky.sunIntensity / 2.7);
    },
    update: (dt) => { clock?.update(dt); st.update(dt); toonUniforms.uCloudTime.value += dt; },
    rebuild: () => { pmrem = null; envRT = null; refreshEnvironment(); }, // a fresh generator: the old one's targets belong to the lost context
    attachPost: () => undefined, // the clean chain: no post the clock turns
  };
};
