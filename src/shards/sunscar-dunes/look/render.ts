/**
 * Signal Dunes' look (an `extend` look on the engine's clean chain): realistic sand just after sunset.
 *   backdrop        the dusk dome (sky.ts) on the camera, a frozen dusk clock, the key light low off the glow, an
 *                   indigo hemisphere fill (the cool blue in the hollows) over warm bounce from the sand, the fog in
 *                   the dusk's mauve with an orange tint toward the glow, no sun disc (the sun has set)
 *   terrainPainter  the dune field as one smooth-shaded mesh: vertex-coloured sand and wind ripples in the normal
 *                   (a procedural patch, faded out with distance so it never shimmers)
 */
import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, BufferAttribute } from 'three';
import { CHUNK_SIZE, DayCycle, patchShader, PATCH_ORDER, type LookStrategy, type PainterField, type Terrain } from '#engine';
import { sandColor } from '../world/dunes';
import { GROUND } from '../layout';
import { buildDome, DUSK, KEY_DIR } from './sky';

const KEY_INTENSITY = 2.6, HEMI_INTENSITY = 0.85;

/** The clock stands at dusk: the shard is one moment, the sky never moves. */
export function duskClock(): DayCycle {
  return new DayCycle({ units: 'hour', start: 19.4, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 24 }],
    sun: { maxElevation: 60, azimuthOffset: 200 }, fixed: { midday: 12, golden: 18.5, sunset: 19, night: 21 }, presets: { dawn: 6, noon: 12, dusk: 19.4, night: 22 } });
}

const RIPPLE_VERT = 'varying vec3 vSandW;\n';
const RIPPLE_FRAG = /* glsl */ `
  {
    // wind ripples: a few-centimetre corrugation across the wind, bent by a slow wobble, gone by 30 m
    float fade = 1.0 - smoothstep(6.0, 30.0, length(vSandW - cameraPosition));
    if (fade > 0.0) {
      vec2 wind = vec2(0.85, 0.53);
      float ph = dot(vSandW.xz, wind) * 5.2 + sin(vSandW.x * 0.41 + vSandW.z * 0.23) * 2.4 + sin(vSandW.z * 1.3) * 0.6;
      float slope = cos(ph) * 0.16 * fade;
      vec3 gW = vec3(wind.x, 0.0, wind.y) * slope;
      normal = normalize(normal - (viewMatrix * vec4(gW, 0.0)).xyz);
    }
  }
`;

async function paintDunes(t: Terrain, f: PainterField): Promise<void> {
  await f.ready();
  const size = Math.min(CHUNK_SIZE, GROUND.size), geometry = new PlaneGeometry(size, size, GROUND.segments, GROUND.segments); geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position'), colors = new Float32Array(pos.count * 3), c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = f.heightAt(x, z); pos.setY(i, y);
    const [, ny] = f.normalAt(x, z, 1.2), grain = Math.sin(x * 12.9898 + z * 78.233) * 0.5 + 0.5;
    sandColor(y, 1 - ny, grain, c);
    // the crest path: trodden sand a shade darker
    const k = Math.max(0, 1 - f.trailDistance(x, z) / 2.5) * 0.12;
    colors[i * 3] = c[0] * (1 - k); colors[i * 3 + 1] = c[1] * (1 - k); colors[i * 3 + 2] = c[2] * (1 - k);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  patchShader(material, 'sunscar.sand-ripples', PATCH_ORDER.material, (shader) => {
    shader.vertexShader = RIPPLE_VERT + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSandW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = RIPPLE_VERT + shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${RIPPLE_FRAG}`);
  }, { key: 'sunscar-sand' });
  const mesh = new Mesh(geometry, material); mesh.receiveShadow = true; mesh.castShadow = true;
  t.group.add(mesh); t.mesh = mesh; t.material = material;
}

export function sunscarLook(): LookStrategy {
  let built: ReturnType<typeof buildDome> | null = null;
  return { mode: 'extend', dispose: () => { if (built) { built.removeFromParent(); built.geometry.dispose(); built.material.dispose(); built = null; } }, compose: ({ engineChain }) => ({ chain: engineChain('clean') }),
    sky: { clouds: false, planet: false },
    shadows: { rig: 'tier', normalBias: 0.08, radius: 2 },
    backdrop: ({ sky, scene }) => {
      const clock = duskClock(), dome = buildDome(), keyColor = new Color().copy(DUSK.key);
      built = dome; scene.add(dome); // the engine keeps `clouds` on the camera; the backdrop puts it in the scene
      let hemi: { color: Color; groundColor: Color; intensity: number } | null = null;
      return Promise.resolve({ clock, horizon: new Color().copy(DUSK.fog), lut: null, clouds: dome, fadesPlanet: false,
        bind: (targets) => {
          hemi = targets.hemi; targets.disc.visible = false; if (targets.halo) targets.halo.visible = false;
          targets.fog.color.copy(DUSK.fog); targets.fogU.fogSunColor.value.copy(DUSK.fogSun);
          // the engine's far ridges (Horizon) take the dusk haze, not its default grey
          targets.far.uHazeCol.value.copy(DUSK.fog); targets.far.uSeaSky.value.copy(DUSK.away); targets.far.uSeaSun.value.copy(DUSK.fogSun);
        },
        update: () => {
          sky.setKeyLight(KEY_DIR, keyColor, KEY_INTENSITY);
          if (hemi) { hemi.color.copy(DUSK.hemiSky); hemi.groundColor.copy(DUSK.hemiGround); hemi.intensity = HEMI_INTENSITY; }
        },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: paintDunes },
  };
}
