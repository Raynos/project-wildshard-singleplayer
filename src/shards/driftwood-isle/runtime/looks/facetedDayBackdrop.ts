/**
 * Driftwood's sky backdrop (DRIFTWOOD-REMASTER L2, the user's pick D2: a stylized gradient dome + faceted cumulus, no HDRI):
 * the dome and cumulus are the shard's material graphs (data/skyLook.ts) on the SDK's graph day sky
 * (`@wildshard/sdk/looks/graphDaySky`), a PMREM of the dome is the (specular-only, toon.ts) environment, re-rendered as the
 * day / night clock moves on, and the sun starts where the clock puts it. The clock's keys, arcs and curves are data
 * (data/skyDay.ts, through look/dayKeys.ts); every knob the blended preset turns (the palette, the toon day light, the ramp
 * fog, the fog, disc and planet) is the numeric channel group generators/skyChannels.ts emits. This file keys the preset,
 * turns the CSM light and builds the cumulus ring.
 *
 *   ?tod=0.5      // start phase (default 0.2 of the day: mid-morning, the sun 36° up in the ESE)
 *   ?clock=120    // cycle length in seconds (default 2880 = 48 min) — for testing the whole loop quickly
 *   Settings ▸ Time of day (E55, `setting('time')`): park the sun at a fixed phase or 'live' to run the clock; ?tod / ?clock win
 */
import type { SkyBackdropFactory } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { driveDayLight, runDayClock } from '@wildshard/sdk/looks/daySky';
import type { DayClock, DayClockStyle } from '@wildshard/sdk/looks/dayClock';
import { domeEnvironmentScene, graphDaySkyBackdrop } from '@wildshard/sdk/looks/graphDaySky';
import * as THREE from 'three';
import { MIDDAY_SKY_ROWS, SKY_CLOUD_LOOK, SKY_DOME_LOOK, type FACETED_DAY_PRESET } from '../const';
import { SECTIONS } from '../sections';
import { dayLight, rampFog } from '../look/toon';

/** the whole cycle in seconds (E147, the user: "72 minutes is too big … 48 is good"; it was 24 min, as BotW's) */
const CYCLE_S = 48 * 60;

/** The cumulus ring: one icosahedron instanced per puff row `[x, y, z, r, puff, cluster, baseY]` (`aPuff` centre + radius,
 *  `aLump` phases + base cut); its graph lumps, squashes and turns each puff. */
export function cumulusGeometry(puffs: readonly (readonly number[])[]): THREE.InstancedBufferGeometry {
  if (puffs.length === 0 || puffs.some(row => row.length !== 7)) throw new Error('faceted sky: the cumulus rows must be [x, y, z, r, puff, cluster, baseY]');
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.IcosahedronGeometry(1, 1).getAttribute('position'));
  geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(row => row.slice(0, 4))), 4));
  geo.setAttribute('aLump', new THREE.InstancedBufferAttribute(new Float32Array(puffs.flatMap(row => row.slice(4))), 3));
  geo.instanceCount = puffs.length;
  return geo;
}

/** a faceted day's clock: the shared day clock over its row, with the backdrop's numbers */
type FacetedDay = DayClock<typeof FACETED_DAY_PRESET, DayClockStyle<typeof FACETED_DAY_PRESET> & {
  readonly startSun: readonly [number, number, number]; readonly sunIBase: number; readonly shadowStepDeg: number; readonly envSize: number; readonly envRefresh: number;
}>;

/** The backdrop over the island's built output and its day clock: its sky graphs compile from the product's look materials. */
export const facetedDayBackdrop = (product: ShardProduct, day: FacetedDay): SkyBackdropFactory => {
  const style = day.style, mid = MIDDAY_SKY_ROWS, rgb = (c: readonly [number, number, number]): THREE.Color => new THREE.Color(...c);
  const startSun = new THREE.Vector3(...style.startSun).normalize(), second = style.frames[1]?.[1] ?? style.frames[0]?.[1], first = day.presets[second ?? ''];
  if (first === undefined) throw new Error('faceted day: keys missing');
  return graphDaySkyBackdrop({ name: 'driftwood-isle', source: product.shardfile, ids: [SKY_DOME_LOOK, SKY_CLOUD_LOOK], dome: { graph: SKY_DOME_LOOK, radius: 2200, segments: [48, 24], order: -20 }, channels: 'driftwood.sky', build: (context, g, dome) => {
    const { sky, scene, level } = context, envScene = domeEnvironmentScene(dome), cloudMaterial = g.material(SKY_CLOUD_LOOK);
    sky.sunDir.copy(startSun); g.setParam(SKY_DOME_LOOK, 'sunDir', startSun.toArray()); // the first (offscreen) environment's sun
    cloudMaterial.toneMapped = false;
    const clouds = new THREE.Mesh(cumulusGeometry(product.section('custom/cumulusPuffs', SECTIONS)), cloudMaterial);
    clouds.frustumCulled = false; clouds.renderOrder = -15; dome.add(clouds); // drawn after the world (depth-tested against it)
    scene.environmentIntensity = level.sky.envIntensity;
    rampFog.zenith.value.copy(rgb(mid.zenith)); // the colour-ramp fog fades into the dome's own gradient
    const clock = runDayClock(day, CYCLE_S), P = day.clone(first), sun = new THREE.Vector3(), moon = new THREE.Vector3();
    const sunIScale = level.sky.sunIntensity / style.sunIBase, shadowStep = style.shadowStepDeg * (Math.PI / 180);
    const palette = { uHorizon: { value: rgb(mid.horizon) }, uCloudLit: { value: rgb(mid.cloudLit) }, uSunGlow: { value: rgb(mid.sunGlow) }, uSunDir: { value: startSun.clone() } };
    return Promise.resolve({
      clock, follow: false, horizon: rgb(mid.horizon),
      // one owner for the environment (SF57): a grid region builds this backdrop as a layer each time it is admitted (G223)
      environment: { source: { kind: 'scene', scene: envScene, size: style.envSize, near: 1, far: 3000 }, refresh: { every: style.envRefresh, stepped: false }, offscreenFirst: true },
      owners: new Map<string, unknown>([['preset', P], ['palette.horizon', palette.uHorizon], ['palette.cloudLit', palette.uCloudLit], ['palette.sunGlow', palette.uSunGlow], ['palette.sunDir', palette.uSunDir],
        ['light.night', dayLight.uToonNight], ['light.lift', dayLight.uToonLift], ['light.rim', dayLight.uToonRim], ['light.cloudShadow', dayLight.uCloudShadow], ['fog.near', rampFog.near], ['fog.zenith', rampFog.zenith]]),
      // the clean chain: no post the clock turns; it steps its own shadow light, so it runs after the cascades
      drive: (T, _post, snap) => {
        if (T === null) return;
        const p = clock.phase;
        clock.key(P); clock.sunAt(sun); clock.moonAt(moon);
        driveDayLight(T, day, p, sun, moon, P, sunIScale, shadowStep, snap, T.shadowBusy);
      },
      tick: (dt) => { dayLight.uCloudTime.value += dt; },
      bound: (T) => { T.planet.uCrisp.value = 1; }, // a crisp, opaque disc against the faceted dome
      backdrop: { updateAt: 'late', fadesPlanet: false, palette: { ...palette, middayLit: rgb(mid.cloudLit) } },
    });
  } });
};
