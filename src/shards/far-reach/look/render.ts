import { BackSide, Color, Fog, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { DayCycle, patchShader, PATCH_ORDER, type LookStrategy } from '#engine';

/** Golden hour, fixed: the sun sits low in the west-north-west and rakes across the island tops. */
export const SUN_DIR = new Vector3(0.75, 0.26, -0.4).normalize();
export const SKY = { zenith: 0x7d76a8, mid: 0xd4a1ae, horizon: 0xf3c690, below: 0xefe0d8, sun: 0xffd9a0, key: 0xffd2a2, fog: 0xdcb2b2 } as const;
export const FOG = { near: 110, far: 460 } as const;

/** A fixed golden-hour clock: Sky Reach does not run a day cycle (no `dayCycle` in `uses`). */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.5, schedule: [{ phase: 'day', from: 0, to: 24, minutes: 1440 }],
    sun: { maxElevation: 20, azimuthOffset: 300 }, fixed: { midday: 12, golden: 17.5, sunset: 18.5, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.5, night: 0 } });
}
function hex(value: number): string { const c = new Color(value); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; }
function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }

/**
 * Sky Reach's look (extend): the engine's clean chain, a gradient dome from violet zenith through rose to a gold horizon
 * with a soft sun glow, a warm raking key light and a rose distance fog that melts the far islands into the cloud sea.
 */
export function skyReachLook(): LookStrategy {
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => {
      const dome = new Mesh(new SphereGeometry(900, 32, 16), new ShaderMaterial({ side: BackSide, depthWrite: false, fog: false,
        uniforms: { sunDir: { value: SUN_DIR } },
        vertexShader: 'varying vec3 d; void main(){ d=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; }',
        fragmentShader: `uniform vec3 sunDir; varying vec3 d; void main(){ float h=d.y;
          vec3 c=mix(${hex(SKY.horizon)},${hex(SKY.mid)},smoothstep(0.0,0.22,h)); c=mix(c,${hex(SKY.zenith)},smoothstep(0.22,0.75,h));
          c=mix(c,${hex(SKY.below)},smoothstep(0.0,-0.12,h));
          float s=max(dot(normalize(d),sunDir),0.0); c+=${hex(SKY.sun)}*(pow(s,48.0)*0.9+pow(s,6.0)*0.22);
          gl_FragColor=vec4(c,1.0); }` }));
      dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.fog = new Fog(new Color(SKY.fog), FOG.near, FOG.far);
      scene.traverse((object) => {
        if (!primitive(object) || object === dome) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          patchShader(material, 'far.rose-fog', PATCH_ORDER.decorate, (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
              `#ifdef USE_FOG\n gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp((length(vFogWorldPos-cameraPosition)-${FOG.near.toFixed(1)})/${(FOG.far - FOG.near).toFixed(1)},0.0,1.0)*0.85);\n#endif`);
          }, { scope });
        }
      });
      return { chain: engineChain('clean') };
    },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = createDay(), key = new Color(SKY.key);
      return Promise.resolve({ clock, horizon: new Color(SKY.horizon), lut: null,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sky.setKeyLight(SUN_DIR, key, 2); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
  };
}
