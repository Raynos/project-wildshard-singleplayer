import { BackSide, Color, Fog, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { createDay, SUN_DIR } from '../world/climate';

/** Golden-hour palette (the round-3 board Jake kept): lavender zenith, rose band, peach horizon, a pale cloud sea. */
export const PALETTE = { zenith: new Color(0x7f7cb2), band: new Color(0xd9a7ae), horizon: new Color(0xf2cdb4),
  cloud: new Color(0xf4e3da), sun: new Color(0xffe2bc), fog: new Color(0xe9c3b8) } as const;
const FOG_NEAR = 80, FOG_FAR = 340;

const VERT = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `uniform vec3 uZenith; uniform vec3 uBand; uniform vec3 uHorizon; uniform vec3 uCloud; uniform vec3 uSun; uniform vec3 uSunDir;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(uHorizon, uBand, smoothstep(0.0, 0.18, h));
  c = mix(c, uZenith, smoothstep(0.16, 0.75, h));
  c = mix(c, uCloud, smoothstep(0.02, -0.12, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSun * (pow(s, 6.0) * 0.35 + pow(s, 400.0) * 1.2);
  gl_FragColor = vec4(c, 1.0);
}`;

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }

/**
 * Sky Reach's look: it extends the engine's clean chain. Its own parts are a golden-hour gradient dome with a low sun
 * (the backdrop's `clouds`, kept on the camera by the engine), a fixed golden-hour key light, linear rose fog patched
 * into every lit material, and no ground painter (the islands are registry pieces; the terrain field only serves
 * placement and is never drawn).
 */
export function skyReachLook(): LookStrategy {
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      scene.fog = new Fog(PALETTE.fog.clone(), FOG_NEAR, FOG_FAR);
      scene.traverse((object) => {
        if (!isMesh(object)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof ShaderMaterial) continue;
          patchShader(material, 'far.linear-fog', PATCH_ORDER.decorate, (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
              `#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp((length(vFogWorldPos - cameraPosition) - ${FOG_NEAR.toFixed(1)}) / ${(FOG_FAR - FOG_NEAR).toFixed(1)}, 0.0, 1.0));\n#endif`);
          }, { scope });
        }
      });
      return { chain: engineChain('clean') };
    },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = createDay(), key = new Color(1, 0.8, 0.62), dir = SUN_DIR.clone();
      const material = new ShaderMaterial({ side: BackSide, depthWrite: false, fog: false, vertexShader: VERT, fragmentShader: FRAG,
        uniforms: { uZenith: { value: PALETTE.zenith }, uBand: { value: PALETTE.band }, uHorizon: { value: PALETTE.horizon },
          uCloud: { value: PALETTE.cloud }, uSun: { value: PALETTE.sun }, uSunDir: { value: new Vector3().copy(dir) } } });
      const dome = new Mesh(new SphereGeometry(900, 32, 16), material);
      dome.renderOrder = -10; dome.frustumCulled = false;
      return Promise.resolve({ clock, horizon: PALETTE.horizon.clone(), lut: null, clouds: dome,
        bind: () => undefined,
        update: (dt: number) => { clock.update(dt); sky.setKeyLight(dir, key, 2.4); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: () => Promise.resolve() },
  };
}
