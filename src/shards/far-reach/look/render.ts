import { Color, Fog, Mesh, Vector3, type Object3D, type Texture } from 'three';
import { ToneMappingMode } from 'postprocessing';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { FOG, SKY, SUN_DIR } from './sun';
import { installPaintedLight } from './light';
import { HEADING_GLSL, fogLut, loadPanorama, skyDome } from './sky';
import { bakeSeaTexture, cloudSea, maelstrom, paintedMaelstrom, paintedSea } from './cloudSea';
import { cumulus } from './puffs';
import { sunGlow } from './sunGlow';
import { PANO_SUN } from './panoramaData';
import { ISLES, SPANS } from '../layout';
import { SKY_ISLES } from '../world/skyIsles';
import { loadPainted } from './image';
import { TEX_URL } from '../boot/files';


/** A fixed golden-hour clock: Sky Reach does not run a day cycle (no `dayCycle` in `uses`). */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
    sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
}
function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** E399 (the council: 'no golden haze toward the sun'): how far the air toward the low sun goes gold over distance. */
const SUN_HAZE = 0.12;

/**
 * Sky Reach's look (extend; the style bible is docs/design/far-reach/style-bible.md): the engine's clean chain, a painted
 * golden-hour dome (gradient, sun bloom, baked cumulus and distant island silhouettes: look/sky.ts), the painted light
 * (warm bounce, rim, shade floor: look/light.ts), a layered lit cloud sea (look/cloudSea.ts) and a warm distance fog
 * that melts the far islands into the haze.
 */
/** Puffs wrapping every island's keel, low on its cone (E392: the mockups' islands rise out of the clouds). */
function keelPuffs(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let a = 4243;
  const rnd = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (const isle of [...ISLES, ...SKY_ISLES]) {
    const n = 5 + Math.round(isle.r / 4);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.6, r = isle.r * (0.35 + rnd() * 0.45), y = isle.y - isle.keel * (0.75 + rnd() * 0.3);
      out.push([isle.x + Math.cos(ang) * r, y, isle.z + Math.sin(ang) * r, isle.r * (0.4 + rnd() * 0.35)]);
    }
  }
  // cloud in the gaps the rope bridges cross, just under deck level (E410: mockup A's bridge runs over billowing lit
  // cumulus; ours crossed open air to a flat sea far below): puffs either side of each span's middle, their tops under it
  let c = 2203;
  const rndC = (): number => { c = (c * 16807) % 2147483647; return c / 2147483647; };
  for (const span of SPANS) {
    if (span.kind !== 'rope') continue;
    const len = Math.hypot(span.x1 - span.x0, span.z1 - span.z0), ux = (span.x1 - span.x0) / len, uz = (span.z1 - span.z0) / len;
    for (let i = 0; i < 6; i++) {
      const t = 0.15 + 0.7 * rndC(), side = (rndC() < 0.5 ? -1 : 1) * (5 + rndC() * 10), size = 7 + rndC() * 6;
      const deck = span.y + (span.y1 - span.y) * t;
      out.push([span.x0 + ux * len * t - uz * side, deck - 3 - size - rndC() * 4, span.z0 + uz * len * t + ux * side, size]);
    }
  }
  // a cumulus bank round the storm crown a little under its deck (E399 round 2, seat B: 'no cloud sea behind the stones';
  // from the arena the true sea, 52 m down, only shows past ~740 m): it reads as the sea just past the rim
  // its own random stream (round 9: sharing the keels' let every sky isle added or moved re-roll the whole bank; o4 put
  // lit puffs behind the stones next to the sun, D's glare 10.0 -> 12.6 % of the middle band)
  let b = 9137;
  const rndB = (): number => { b = (b * 16807) % 2147483647; return b / 2147483647; };
  const crown = ISLES.find((isle) => isle.id === 'crown');
  const to = new Vector3();
  if (crown !== undefined) for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rndB() * 0.15, r = crown.r + 14 + rndB() * 60;
    const x = crown.x + Math.cos(ang) * r, y = crown.y - 9 + rndB() * 5, z = crown.z + Math.sin(ang) * r, size = 14 + rndB() * 16;
    // only the sun disc stays clear, seen from the arena (E410: mockup D's stone gaps are full of lit cumulus tops; the
    // round-10 cone of ~32 deg toward the sun emptied D's whole view)
    to.set(x - crown.x, y - crown.y - 2.4, z - crown.z);
    if (to.angleTo(SUN_DIR) < Math.atan(size / to.length()) + (4 * Math.PI) / 180) continue;
    out.push([x, y, z, size]);
  }
  return out;
}

/**
 * The cumulus banks between and beyond the sky isles (E407 top-10 row 5: the mockups stack sunlit cloud at many depths
 * under and between their islands; ours sat in one painted sky): [x, y, z, size] in look/puffs.ts' painted cumulus,
 * seeded. Each clears every isle's rock (a cloud never cuts an island) and the playable islands by `clear` metres (no
 * bank in front of a player's face), and leaves the sun disc open from the spawn and from the crown: no bank within its
 * own angular size plus `sunGap` degrees of the sun from either.
 */
export const BANKS = { count: 48, centre: [0, -110], ring: [170, 560], y: [-2, 34], size: [22, 44], clear: 90, sunGap: 5 } as const;
export function cloudBanks(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let a = 7717;
  const rnd = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const eyes = ISLES.filter((isle) => isle.id === 'sunrest' || isle.id === 'crown').map((isle) => new Vector3(isle.x, isle.y + 1.7, isle.z));
  const to = new Vector3(), gap = (BANKS.sunGap * Math.PI) / 180;
  for (let tries = 0; out.length < BANKS.count && tries < BANKS.count * 20; tries++) {
    const ang = rnd() * Math.PI * 2, r = BANKS.ring[0] + (BANKS.ring[1] - BANKS.ring[0]) * Math.sqrt(rnd());
    const x = BANKS.centre[0] + Math.cos(ang) * r, z = BANKS.centre[1] + Math.sin(ang) * r;
    // nearer ones lower (under the decks), the far ones up into the isles' band
    const y = BANKS.y[0] + (BANKS.y[1] - BANKS.y[0]) * (0.35 * rnd() + 0.65 * (r - BANKS.ring[0]) / (BANKS.ring[1] - BANKS.ring[0]));
    const size = BANKS.size[0] + (BANKS.size[1] - BANKS.size[0]) * rnd();
    if (ISLES.some((isle) => Math.hypot(x - isle.x, z - isle.z) < BANKS.clear + size)) continue;
    // a puff card spans 0.75 size either side and size up and down round its centre: clear of every isle's deck-to-keel column
    if ([...ISLES, ...SKY_ISLES].some((isle) => Math.hypot(x - isle.x, z - isle.z) < isle.r + size * 0.75 && y - size < isle.y + 4 && y + size > isle.y - isle.keel)) continue;
    if (eyes.some((eye) => { to.set(x, y, z).sub(eye); const d = to.length(); return to.angleTo(SUN_DIR) < Math.atan(size / d) + gap; })) continue;
    out.push([x, y, z, size]);
  }
  return out;
}

export async function skyReachLook(): Promise<LookStrategy> {
  const pano: Texture = await loadPanorama();
  const [cloudAtlas, seaPaint, vortex] = await Promise.all([loadPainted(TEX_URL.clouds, 'far.cumulus'), loadPainted(TEX_URL.cloudsea, 'far.cloudsea', true), loadPainted(TEX_URL.maelstrom, 'far.maelstrom')]);
  // A regional frame reads this strategy's parts without composing its standalone scene. Until compose adopts these
  // eager sources, the strategy owns them, including a late strategy returned after its resident has already left.
  const pending = new Set([pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null));
  let seaTime: { value: number } | null = null;
  let glowUpdate: ((t: number) => void) | null = null;
  return { mode: 'extend',
    dispose: () => { for (const texture of pending) texture.dispose(); pending.clear(); },
    // `c.fx` builds the CINEMATIC chain when nothing is built yet, so the clean chain is asked first and `fx` only after
    // it (E399: destructuring `fx` in the parameters, or reading it before `engineChain('clean')`, makes the clean ask
    // throw 'already built', and the load hangs)
    compose: (c) => {
      const { scene, scope } = c, chain = c.engineChain('clean');
      for (const texture of pending) scope.own(texture);
      pending.clear();
      // E399 (council rounds 1-5, 'the light never glows'; measured as Rec. 709 luminance): AgX compressed the top 1 % to
      // 223-228 where the mockups reach 236-241. NEUTRAL with the manifest grade's saturation 0, contrast 0.12 and bloom
      // 0.35 measures 236-241, 2.1-3.6 % of the frame over 230 (the mockups 1.9-3.8 %)
      c.fx.tone.mode = ToneMappingMode.NEUTRAL;
      const haze = fogLut(), dome = skyDome(pano, haze); scope.own(pano); scope.own(haze);
      dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(SKY.fog), FOG.near, FOG.far);
      scene.traverse((object) => {
        if (!primitive(object) || object === dome) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          // the haze takes the painted horizon's colour in the direction you look (gold toward the sun, rose-lavender away)
          patchShader(material, 'far.rose-fog', PATCH_ORDER.decorate, (shader) => {
            shader.uniforms['farHaze'] = { value: haze };
            shader.fragmentShader = `#ifndef FAR_HAZE\n#define FAR_HAZE\nuniform sampler2D farHaze;\n${HEADING_GLSL}\n#endif\n${shader.fragmentShader.replace('#include <fog_fragment>',
              `#ifdef USE_FOG\n vec3 farV=vFogWorldPos-cameraPosition; gl_FragColor.rgb=mix(gl_FragColor.rgb,texture2D(farHaze,vec2(farHeading(farV),0.5)).rgb,clamp((length(farV)-${FOG.near.toFixed(1)})/${(FOG.far - FOG.near).toFixed(1)},0.0,1.0)*${FOG.max.toFixed(2)});\n float farSun=pow(max(dot(normalize(farV),vec3(${SUN_DIR.x.toFixed(4)},${SUN_DIR.y.toFixed(4)},${SUN_DIR.z.toFixed(4)})),0.0),24.0); gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,0.8,0.52),farSun*clamp((length(farV)-15.0)/160.0,0.0,1.0)*${SUN_HAZE.toFixed(2)});\n#endif`)}`;
          }, { scope });
        }
      });
      // the layered cloud sea goes in after the fog patch (its own haze; no scene fog)
      const seaTex = bakeSeaTexture(SUN_DIR), sea = cloudSea(SUN_DIR, seaTex); scope.own(seaTex);
      // the procedural sheet only stands in when the painted sea is missing (it drew over the painted one)
      for (const mesh of sea.meshes) { if (seaPaint === null) scene.add(mesh); scope.own(mesh.geometry); scope.own(mesh.material); }
      scope.onDispose(() => { for (const mesh of sea.meshes) mesh.removeFromParent(); });
      seaTime = sea.time;
      // the sun's bloom and light shafts at the painted sun (E392)
      const glow = sunGlow(SUN_DIR); scene.add(glow.group); glowUpdate = glow.update;
      scope.own(glow.geometry); for (const m of glow.materials) scope.own(m); scope.onDispose(() => { glow.group.removeFromParent(); });
      // the painted cloud sea (E392), wound into the maelstrom under the crown; without its texture the procedural maelstrom disc
      if (seaPaint !== null) {
        scope.own(seaPaint);
        if (vortex !== null) { const swirlDisc = paintedMaelstrom(vortex, sea.time); scene.add(swirlDisc); scope.own(vortex); scope.own(swirlDisc.geometry); scope.own(swirlDisc.material); scope.onDispose(() => { swirlDisc.removeFromParent(); }); }
        for (const upper of [false, true]) { const painted = paintedSea(seaPaint, sea.time, upper); scene.add(painted); scope.own(painted.geometry); scope.own(painted.material); scope.onDispose(() => { painted.removeFromParent(); }); }
      } else {
        const swirl = maelstrom(SUN_DIR, seaTex, sea.time); scene.add(swirl); scope.own(swirl.geometry); scope.own(swirl.material); scope.onDispose(() => { swirl.removeFromParent(); });
      }
      // cumulus over the sea (loop 5): the islands rise out of billowing cloud
      if (cloudAtlas !== null) {
        const puffs = cumulus(SUN_DIR, cloudAtlas, keelPuffs(), cloudBanks()); scene.add(puffs); scope.own(cloudAtlas); scope.own(puffs.geometry); scope.own(puffs.material); scope.onDispose(() => { puffs.removeFromParent(); });
      }
      return { chain };
    },
    lighting: { install: installPaintedLight },
    // the panorama paints the one sun (council R1B-1: the engine's disc drew a second one above it)
    // god rays from the painted sun (E398): the disc stays out of the frame, only the rays' source; the engine compass
    // faces (-sin az, cos az), the panorama heading (sin h, -cos h), so az = h + 180
    sky: { clouds: false, planet: false, sun: { disc: false, halo: false, rays: { azimuth: (PANO_SUN.heading + 180) % 360, elevation: PANO_SUN.elevation } } },
    // the shard grade (top-10 row 10): one learned LUT, global, the engine's last grade step (Debug ▸ Look ▸ Learned LUT
    // Off skips it). The second fit (art/far-reach/round-32-lut/): each mockup's sky its own region, eased to identity in
    // the highlights (the first, round-29-lut, greyed C's sky and overshot the highlights when measured live)
    backdrop: async ({ sky }) => {
      const clock = createDay(), key = new Color(SKY.key), lut = await loadLUT('far-reach');
      return { clock, horizon: new Color(SKY.horizon), lut,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sky.setKeyLight(SUN_DIR, key, 2); if (seaTime !== null) { seaTime.value += dt; glowUpdate?.(seaTime.value); } },
        rebuild: () => undefined, attachPost: () => undefined };
    },
  };
}
