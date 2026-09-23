/**
 * Look v2 — the lighting cheat + the values (port-v2.md step 4; the clean-room prototype's "two directions").
 *
 * The painting's sun sits low in the WSW (250°, 26°) and the camp shots look toward it, so a physical key back-lights
 * everything. A painter cheats: the sky keeps its painted sun (the dome), but the light that shades the world swings
 * ~40° further round and ~15° higher, so the camp, the yurts and the grass read warm and front / side-lit. Applied
 * after the weather rig each frame, only while the key is the sun (the moon keeps its own direction), easing back onto
 * the real sun as it sets (a low sun is not lifted 15° into the sky).
 *
 * The values: hemisphere fill lower and cooler (a blue sky above, an olive bounce below), so the shade sides carry the
 * painted cool / warm split and the whole frame drops toward the mockups' olive / golden range; the grade's saturation
 * follows the hour (the rig's own saturation keys: night greys out, the after-storm world is cleaner). The olive albedo
 * remap of the painted ground is `V2_OLIVE_GLSL` (terrainSurface.ts takes it in v2).
 */
import * as THREE from 'three';
import type { Sky } from '../../world/Sky';
import type { SkyLook } from '../../world/DayNight';
import { syncPainterlySun } from '../../world/painterly';
import { gradeUniforms } from './grade';

const D2R = Math.PI / 180;
/** the cheat: degrees further round (compass, clockwise) and higher than the sun */
export const KEY_CHEAT = { az: 40, el: 15 };
const HEMI_SKY = new THREE.Color(0.40, 0.46, 0.62);
const HEMI_GROUND = new THREE.Color(0.30, 0.30, 0.16);
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * GLSL: `vec3 v2Olive(vec3 albedo)` — green-dominant albedo (the lime valley grass) pulled toward olive / gold and ~25 %
 * down in value; neutral / warm / blue paint (felt, dirt, gravel, rock, snow) is left alone.
 */
export const V2_OLIVE_GLSL = /* glsl */`
vec3 v2Olive(vec3 c) {
  float gr = smoothstep(0.02, 0.45, (c.g - max(c.r, c.b)) / max(c.g, 1e-3));
  vec3 olive = vec3(c.r * 0.97, mix(c.g, c.r * 1.12, 0.72), c.b * 0.8) * 0.8;
  return mix(c, olive, gr);
}
`;

const _dir = new THREE.Vector3(), _c = new THREE.Color();

export class LightCheat {
  private readonly daySat: number;

  constructor(private readonly sky: Sky, daySaturation: number) { this.daySat = daySaturation; }

  /** after the rig applied `look` this frame */
  apply(look: SkyLook): void {
    const sky = this.sky;
    if (look.moon <= 0) {
      const d = look.sunDir;
      const el = Math.asin(Math.min(1, Math.max(-1, d.y)));
      const az = Math.atan2(-d.x, d.z); // compass: 0 = north (+z), +π/2 = east (−x)
      const lift = smooth(-1 * D2R, 12 * D2R, el);
      const az2 = az + KEY_CHEAT.az * D2R * lift, el2 = Math.max(el, el + KEY_CHEAT.el * D2R * lift);
      _dir.set(-Math.sin(az2) * Math.cos(el2), Math.sin(el2), Math.cos(az2) * Math.cos(el2));
      sky.setKeyLight(_dir, look.keyColor, look.keyIntensity);
      syncPainterlySun(sky);
    }
    // the fill: lower and cooler, the bounce olive (scaled with the hour's own fill, so night keeps its darkness)
    sky.hemi.color.copy(look.hemiSky).lerp(_c.copy(HEMI_SKY), 0.6);
    sky.hemi.groundColor.copy(look.hemiGround).lerp(_c.copy(HEMI_GROUND), 0.6);
    sky.hemi.intensity = look.hemiIntensity * 0.8;
    gradeUniforms.uV2LookSat.value = Math.max(0, 1 + (look.saturation - this.daySat));
  }
}
