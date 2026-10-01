import { BackSide, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute, Fog, Mesh, MeshStandardMaterial, ShaderMaterial, SphereGeometry, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { patchShader, PATCH_ORDER, type LookStrategy } from '#engine';
import { createGoldenDay } from '../world/climate';
import { CLOUD_Y } from '../layout';

/** Sky Reach's palette: a deep blue zenith over a peach horizon, a gold sun, a pink-gold cloud sea (E364 B mockup). */
export const SKY = { zenith: new Color(0x3d5f95), horizon: new Color(0xf4b183), sun: new Color(0xfff0c8), cloudLit: new Color(0xffe2c4), cloudShade: new Color(0xb79bb0), fogNear: 140, fogFar: 520 } as const;
const GROUND_MIN = CLOUD_Y + 4;

function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }
const SKY_VERT = 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const SKY_FRAG = `uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunColor; uniform vec3 uSun; varying vec3 vDir;
void main(){ vec3 d=normalize(vDir); float h=clamp(d.y,0.0,1.0); vec3 c=mix(uHorizon,uZenith,pow(h,0.55));
  float s=max(dot(d,normalize(uSun)),0.0); c+=uSunColor*(pow(s,600.0)*3.0+pow(s,12.0)*0.35+pow(s,3.0)*0.12*(1.0-h));
  gl_FragColor=vec4(c,1.0); }`;
const CLOUD_VERT = 'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';
const CLOUD_FRAG = `uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHorizon; uniform vec3 uSun; uniform float uTime; uniform vec3 uCam; varying vec3 vWorld;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
void main(){ vec2 p=vWorld.xz*0.018+vec2(uTime*0.004,uTime*0.002); float n=fbm(p), m=fbm(p*2.7-vec2(uTime*0.006,0.0));
  vec3 sun=normalize(vec3(uSun.x,0.0,uSun.z)); vec3 toFrag=normalize(vec3(vWorld.x-uCam.x,0.0,vWorld.z-uCam.z));
  float glow=pow(max(dot(toFrag,sun),0.0),4.0); vec3 c=mix(uShade,uLit,smoothstep(0.3,0.75,n*0.7+m*0.3)); c=mix(c,c*vec3(1.12,1.0,0.86)+vec3(0.08,0.05,0.0),glow);
  float far=smoothstep(120.0,520.0,length(vWorld.xz-uCam.xz)); gl_FragColor=vec4(mix(c,uHorizon,far*0.85),1.0); }`;

/** The island ground: one flat-shaded, vertex-coloured mesh over the island tops (nothing is drawn under the clouds). */
function islandGround(heightAt: (x: number, z: number) => number): Mesh<BufferGeometry, MeshStandardMaterial> {
  const step = 1.25, half = 112, n = Math.round(half * 2 / step), pos: number[] = [], col: number[] = [];
  const grass = new Color(0x6f8f34), dry = new Color(0xb39a4a), rock = new Color(0x8a7360), c = new Color(), e = new Vector3(), nrm = new Vector3();
  const corner = (i: number, j: number, out: Vector3): Vector3 => { const x = -half + i * step, z = -half + j * step; return out.set(x, heightAt(x, z), z); };
  const tri = (p: Vector3, q: Vector3, r: Vector3): void => {
    if (Math.min(p.y, q.y, r.y) < GROUND_MIN) return;
    nrm.subVectors(q, p).cross(e.subVectors(r, p)).normalize();
    const flat = Math.abs(nrm.y), cx = (p.x + q.x + r.x) / 3, cz = (p.z + q.z + r.z) / 3, k = Math.sin(cx * 0.31) * Math.cos(cz * 0.27) * 0.5 + 0.5;
    c.copy(grass).lerp(dry, k * 0.45); if (flat < 0.8) c.lerp(rock, Math.min(1, (0.8 - flat) * 4));
    for (const v of [p, q, r]) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
  };
  const p00 = new Vector3(), p10 = new Vector3(), p01 = new Vector3(), p11 = new Vector3();
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    corner(i, j, p00); corner(i + 1, j, p10); corner(i, j + 1, p01); corner(i + 1, j + 1, p11);
    tri(p00, p01, p10); tri(p10, p01, p11);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(pos, 3)); geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  return new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

/** Extend the engine chain: a gradient sky dome with the low sun, a cloud sea to the horizon, warm linear fog. */
export function skyReachLook(): LookStrategy {
  const sunDir = new Vector3(0, 0.2, -1), camera = new Vector3(), time = { value: 0 };
  const domeMat = new ShaderMaterial({ side: BackSide, depthWrite: false, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: { uZenith: { value: SKY.zenith }, uHorizon: { value: SKY.horizon }, uSunColor: { value: SKY.sun }, uSun: { value: sunDir } } });
  const cloudMat = new ShaderMaterial({ vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
    uniforms: { uLit: { value: SKY.cloudLit }, uShade: { value: SKY.cloudShade }, uHorizon: { value: SKY.horizon }, uSun: { value: sunDir }, uTime: time, uCam: { value: camera } } });
  let dome: Mesh | null = null, clouds: Mesh | null = null, view: PerspectiveCamera | null = null;
  return { mode: 'extend', compose: ({ engineChain, scene, scope, camera: cam }) => {
      view = cam;
      dome = new Mesh(new SphereGeometry(600, 32, 16), domeMat); dome.renderOrder = -10; dome.frustumCulled = false;
      clouds = new Mesh(new CircleGeometry(580, 48), cloudMat); clouds.rotation.x = -Math.PI / 2; clouds.position.y = CLOUD_Y; clouds.frustumCulled = false;
      scene.add(dome, clouds); scene.fog = new Fog(SKY.horizon.clone(), SKY.fogNear, SKY.fogFar);
      for (const mesh of [dome, clouds]) { scope.own(mesh.geometry); scope.onDispose(() => { mesh.removeFromParent(); }); }
      scope.own(domeMat); scope.own(cloudMat);
      scene.traverse((object) => { if (!primitive(object) || object === dome || object === clouds) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          patchShader(material, 'farReach.linear-fog', PATCH_ORDER.decorate, (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
              `#ifdef USE_FOG\n gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp((length(vFogWorldPos-cameraPosition)-${SKY.fogNear.toFixed(1)})/${(SKY.fogFar - SKY.fogNear).toFixed(1)},0.0,1.0));\n#endif`);
          }, { scope });
        }
      });
      return { chain: engineChain('clean') };
    }, sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = createGoldenDay(), keyColor = new Color(1, 0.8, 0.56);
      return Promise.resolve({ clock, horizon: SKY.horizon.clone(), lut: null,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sunDir.copy(clock.sunDir); sky.setKeyLight(clock.sunDir, keyColor, 2.2); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    frame: (dt) => {
      time.value += dt; if (view === null) return;
      view.getWorldPosition(camera); dome?.position.copy(camera); if (clouds) { clouds.position.x = camera.x; clouds.position.z = camera.z; }
    },
    terrainPainter: { build: (terrain, field) => {
      const mesh = islandGround((x, z) => field.heightAt(x, z));
      terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = mesh.material;
      return Promise.resolve();
    } },
  };
}
