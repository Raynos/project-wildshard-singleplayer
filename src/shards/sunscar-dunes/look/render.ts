import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3, type ShaderMaterial, type SphereGeometry } from 'three';
import { DayCycle, compassDir, patchShader, PATCH_ORDER, type LookStrategy, type PainterField, type SkyBackdropTargets } from '#engine';
import { duskDome, DUSK } from './sky';

/** The set sun: its disc is hidden (it has just gone down); a low warm key from the north-west glow rakes the dune faces. */
const SUN = { azimuth: 318, elevation: 6, color: new Color(1, 0.47, 0.2), intensity: 1.9 };
/** A clock held just after sunset (hour 18.9): dusk, no day cycle. */
export function duskClock(): DayCycle {
  const clock = new DayCycle({ units: 'hour', start: 18.9, schedule: [{ phase: 'dusk', from: 0, to: 24, minutes: 600 }],
    sun: { maxElevation: 40, azimuthOffset: 0 }, fixed: { midday: 18.9, golden: 18.9, sunset: 18.9, night: 18.9 }, presets: { dawn: 18.9, noon: 18.9, dusk: 18.9, night: 18.9 } });
  clock.paused = true;
  return clock;
}
const INNER = 250, INNER_STEPS = 180, OUTER = 1100, OUTER_STEP = 30;
const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
/** Grid lines: coarse out to the far dune sea, fine over the playable square, so the seam matches the physics ground. */
function lines(): number[] {
  const out: number[] = [];
  for (let v = -OUTER; v < -INNER; v += OUTER_STEP) out.push(v);
  for (let i = 0; i <= INNER_STEPS; i++) out.push(-INNER + 2 * INNER * i / INNER_STEPS);
  for (let v = INNER + OUTER_STEP; v <= OUTER; v += OUTER_STEP) out.push(v);
  return out;
}
/** Far dunes past the edge: no colliders, they only carry the dune sea out to the ridges. */
function farDunes(x: number, z: number): number {
  const u = z + 18 * Math.sin(x * 0.009) + 0.2 * x, t = ((u / 80) % 1 + 1) % 1;
  return 3 + 7 * (t < 0.7 ? smooth(t / 0.7) : 1 - smooth((t - 0.7) / 0.3)) * (0.7 + 0.3 * Math.sin(x * 0.013 + z * 0.004));
}
function heightOf(field: PainterField, x: number, z: number): number {
  const ex = Math.max(-INNER, Math.min(INNER, x)), ez = Math.max(-INNER, Math.min(INNER, z)), out = Math.hypot(x - ex, z - ez);
  const inside = field.heightAt(ex, ez);
  if (out <= 0) return inside;
  const w = smooth(out / 140);
  return inside * (1 - w) + farDunes(x, z) * w - smooth((out - 400) / 300) * 6;
}
/** The dune mesh: dark orange sand, a little lighter on the crests, cooler and darker down in the hollows. */
export function buildDunes(field: PainterField): BufferGeometry {
  const xs = lines(), n = xs.length, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  const sand = new Color(0.42, 0.15, 0.045), crest = new Color(0.55, 0.21, 0.065), hollow = new Color(0.17, 0.075, 0.06), tmp = new Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0, z = xs[j] ?? 0, k = (j * n + i) * 3, h = heightOf(field, x, z);
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    const local = h - (heightOf(field, x + 9, z) + heightOf(field, x - 9, z) + heightOf(field, x, z + 9) + heightOf(field, x, z - 9)) / 4;
    tmp.copy(sand).lerp(local > 0 ? crest : hollow, Math.min(1, Math.abs(local) / 2.2));
    const grain = 0.94 + 0.06 * Math.sin(x * 1.7 + z * 2.3) * Math.sin(x * 0.9 - z * 1.3);
    col[k] = tmp.r * grain; col[k + 1] = tmp.g * grain; col[k + 2] = tmp.b * grain;
  }
  const index: number[] = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; index.push(a, c, b, b, c, d); }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setIndex(index); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Signal Dunes' look: the engine's clean chain, a held dusk clock, its own dome, a raked key light and wind ripples in the sand. */
export function dunesLook(): LookStrategy {
  const sunDir = compassDir(SUN.azimuth, SUN.elevation, new Vector3()), haze = new Color(DUSK.haze);
  let targets: SkyBackdropTargets | null = null, ground: Mesh | null = null, sky: Mesh<SphereGeometry, ShaderMaterial> | null = null;
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
  return { mode: 'extend',
    compose: ({ engineChain, scope }) => {
      // Wind ripples: a fine, wind-aligned normal tilt that fades with distance (no texture download).
        patchShader(material, 'sunscar.ripples', PATCH_ORDER.decorate, (shader) => {
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRipple;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRipple = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRipple;')
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
              { float fade = 1.0 - smoothstep(12.0, 70.0, length(vRipple - cameraPosition));
                float u = vRipple.z * 2.6 + sin(vRipple.x * 0.35) * 1.8 + sin(vRipple.x * 1.3 + vRipple.z * 0.4) * 0.35;
                vec3 tilt = vec3(0.0, 0.0, cos(u) * 0.16 * fade);
                normal = normalize(normal + (viewMatrix * vec4(tilt, 0.0)).xyz); }`);
        }, { scope });
        scope.own(material); if (ground) scope.own(ground.geometry);
        return { chain: engineChain('clean') };
      },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky: rig }) => {
      const clock = duskClock(), dome = duskDome(sunDir); sky = dome;
      const time = dome.material.uniforms['uTime'];
      return Promise.resolve({ clock, horizon: haze.clone(), lut: null, clouds: dome,
        bind: (t: SkyBackdropTargets) => { targets = t; t.disc.visible = false; if (t.halo) t.halo.visible = false; },
        update: (dt: number) => {
          if (time) time.value += dt;
          rig.setKeyLight(sunDir, SUN.color, SUN.intensity);
          if (targets) { targets.fog.color.copy(haze); targets.far.uHazeCol.value.copy(haze); targets.disc.visible = false; if (targets.halo) targets.halo.visible = false; }
        },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: async (terrain, field) => {
      await field.ready();
      const mesh = new Mesh(buildDunes(field), material); ground = mesh; mesh.receiveShadow = true; mesh.castShadow = false;
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
    } },
    dispose: () => { sky?.geometry.dispose(); sky?.material.dispose(); sky?.removeFromParent(); sky = null; },
  };
}
