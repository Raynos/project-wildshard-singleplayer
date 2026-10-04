import { Color, Fog, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, DoubleSide, type Object3D } from 'three';
import { patchShader, PATCH_ORDER, type LookStrategy } from '@wildshard/engine';
import { createDay } from '../world/climate';

function primitive(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** Extend the engine chain; primitive ground and a gradient dome supply only grey-box content. */
export function templateLook(): LookStrategy {
  return { mode: 'extend', compose: ({ engineChain, scene, scope }) => {
      const dome = new Mesh(new SphereGeometry(600, 24, 12), new ShaderMaterial({ side: DoubleSide, depthWrite: false,
        vertexShader: 'varying float h; void main(){ h=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying float h; void main(){ gl_FragColor=vec4(mix(vec3(0.75),vec3(0.35,0.42,0.5),clamp(h,0.0,1.0)),1.0); }' }));
      scene.add(dome); scene.fog = new Fog(new Color(0xa9afb5), 60, 180);
      scope.own(dome.geometry); scope.own(dome.material); scope.onDispose(() => { dome.removeFromParent(); });
      scene.traverse((object) => { if (!primitive(object)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          patchShader(material, 'template.linear-fog', PATCH_ORDER.decorate, (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp((length(vFogWorldPos-cameraPosition)-60.0)/120.0,0.0,1.0));\n#endif');
          }, { scope });
        }
      });
      return { chain: engineChain('clean') };
    }, sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => {
      const clock = createDay(), keyColor = new Color(1, 1, 1);
      return Promise.resolve({ clock, horizon: new Color(0xa9afb5), lut: null,
        bind: () => undefined, update: (dt: number) => { clock.update(dt); sky.setKeyLight(clock.sunDir, keyColor, 1.5); },
        rebuild: () => undefined, attachPost: () => undefined });
    },
    terrainPainter: { build: (terrain, field) => {
      const geometry = new PlaneGeometry(200, 200, 40, 40); geometry.rotateX(-Math.PI / 2);
      const pos = geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) pos.setY(i, field.heightAt(pos.getX(i), pos.getZ(i)));
      geometry.computeVertexNormals(); const material = new MeshStandardMaterial({ color: 0x7e8388, flatShading: true });
      const mesh = new Mesh(geometry, material); terrain.group.add(mesh); terrain.mesh = mesh; terrain.material = material;
      return Promise.resolve();
    } },
  };
}
