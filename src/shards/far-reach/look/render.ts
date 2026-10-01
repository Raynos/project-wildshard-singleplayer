import { BackSide, Camera, Color, Fog, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { CLOUD_Y } from '../layout';

/** Golden hour, frozen: the sun sits low in the north-west, ahead and to the left of the spawn's view. */
export const SUN_DIR = new Vector3(-0.55, 0.17, -0.82).normalize();
const HORIZON = new Color(1, 0.78, 0.66);
const KEY = new Color(1, 0.8, 0.58);

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
const SKY_FRAG = `uniform vec3 uSun; varying vec3 vDir;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 zen = lin(vec3(0.43, 0.45, 0.70)), mid = lin(vec3(0.86, 0.66, 0.70)), hor = lin(vec3(1.0, 0.80, 0.64)), sea = lin(vec3(0.97, 0.83, 0.80));
  vec3 c = h > 0.0 ? mix(mix(hor, mid, smoothstep(0.0, 0.22, h)), zen, smoothstep(0.22, 0.85, h)) : mix(hor, sea, smoothstep(0.0, -0.08, h));
  float s = max(dot(d, uSun), 0.0);
  c += lin(vec3(1.0, 0.74, 0.46)) * (pow(s, 6.0) * 0.55 + pow(s, 48.0) * 0.6);
  c = mix(c, lin(vec3(1.0, 0.97, 0.88)) * 3.0, smoothstep(0.9994, 0.99975, s));
  gl_FragColor = vec4(c, 1.0);
}`;
const CLOUD_VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const CLOUD_FRAG = `uniform float uTime; uniform vec3 uSun; uniform vec3 uCam; varying vec3 vW;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec2 q = vW.xz * 0.012 + vec2(uTime * 0.004, uTime * 0.002);
  float n = fbm(q + fbm(q * 0.7) * 0.8);
  vec3 shade = lin(vec3(0.83, 0.66, 0.72)), lit = lin(vec3(1.0, 0.9, 0.84)), gold = lin(vec3(1.0, 0.78, 0.55));
  vec3 c = mix(shade, lit, smoothstep(0.35, 0.75, n));
  vec3 toSun = normalize(vec3(uSun.x, 0.0, uSun.z)); vec3 v = normalize(vW - uCam);
  c += gold * pow(max(dot(normalize(vec3(v.x, 0.0, v.z)), toSun), 0.0), 8.0) * 0.35 * n;
  float far = smoothstep(150.0, 900.0, length(vW.xz - uCam.xz));
  c = mix(c, lin(vec3(1.0, 0.8, 0.66)), far);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Sky Reach's look: extend the engine chain with a golden-hour dome, a cloud sea and a warm linear haze. */
export function skyReachLook(): LookStrategy {
  let cloud: Mesh | null = null, cloudMat: ShaderMaterial | null = null, camera: Camera | null = null, time = 0;
  const camPos = new Vector3();
  const domeGeometry = new SphereGeometry(800, 32, 16), domeMaterial = new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: BackSide,
    depthWrite: false, depthTest: false, fog: false, uniforms: { uSun: { value: SUN_DIR } } });
  return { mode: 'extend', compose: ({ engineChain, scene, scope }) => {
      scene.fog = new Fog(HORIZON.clone(), 90, 480);
      const sea = new PlaneGeometry(3000, 3000, 1, 1); sea.rotateX(-Math.PI / 2);
      cloudMat = new ShaderMaterial({ vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, fog: false,
        uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR }, uCam: { value: camPos } } });
      cloud = new Mesh(sea, cloudMat); cloud.position.y = CLOUD_Y; cloud.frustumCulled = false; scene.add(cloud);
      scope.own(sea); scope.own(cloudMat); scope.onDispose(() => { cloud?.removeFromParent(); cloud = null; cloudMat = null; });
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          patchShader(material, 'far.haze', PATCH_ORDER.decorate, (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
              '#ifdef USE_FOG\n float farD = length(vFogWorldPos - cameraPosition);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp((farD - 90.0) / 390.0, 0.0, 0.85));\n#endif');
          }, { scope });
        }
      });
      return { chain: engineChain('clean') };
    }, sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
        sun: { maxElevation: 30, azimuthOffset: 250 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
      const dome = new Mesh(domeGeometry, domeMaterial); dome.renderOrder = -1; dome.frustumCulled = false;
      return Promise.resolve({ clock, horizon: HORIZON.clone(), lut: null, clouds: dome,
        bind: () => undefined, update: (_dt: number) => { sky.setKeyLight(SUN_DIR, KEY, 2.2); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    frame: (dt) => {
      time += dt;
      if (cloudMat && cloud) {
        const t = cloudMat.uniforms['uTime'];
        if (t) t.value = time;
        if (camera === null) { const found = cloud.parent?.getObjectByProperty('isCamera', true); camera = found instanceof Camera ? found : null; }
        if (camera) { camera.getWorldPosition(camPos); cloud.position.x = camPos.x; cloud.position.z = camPos.z; }
      }
    },
    dispose: () => { domeGeometry.dispose(); domeMaterial.dispose(); camera = null; },
  };
}
