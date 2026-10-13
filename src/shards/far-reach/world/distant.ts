import { DoubleSide, Group, InstancedMesh, ShaderMaterial } from 'three';
import { skyBakedGeometry } from './baked';

/** The falls' clock (the plugin advances it): the streaks run down the sheet. */
export const FALL_TIME = { value: 0 };
/**
 * Falling water, not a white card (council round 2): streaks of foam scrolling down, soft thin edges, a blue-white body
 * that frays into spray toward the bottom; brighter where the low sun backlights it. Local frame: x −0.5..0.5 across the
 * sheet, y 0 at the lip down to −1 (the instance scales it to its width and length).
 */
function fallMaterial(): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, fog: false, uniforms: { uTime: FALL_TIME },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
      void main(){
        float down = -vP.y, across = vP.x;
        // streaks: narrow columns of foam, each scrolling down at its own pace
        float streak = n(vec2(across * 26.0, down * 3.0 - uTime * 1.6)) * 0.6 + n(vec2(across * 60.0, down * 7.0 - uTime * 2.6)) * 0.4;
        // E399 (the council: 'a flat pale blue strip'): narrow at the lip, spreading as it falls; a deep blue-teal body
        // with bright foam ropes, gaps between them, breaking into mist toward the bottom
        float spread = 0.2 + 0.18 * down;
        float edge = 1.0 - smoothstep(spread * 0.7, spread, abs(across) + (n(vec2(down * 4.0, uTime * 0.3)) - 0.5) * 0.1);
        float fray = 1.0 - smoothstep(0.5, 1.0, down) * (0.35 + 0.65 * n(vec2(across * 9.0, down * 5.0 - uTime)));
        float ropes = smoothstep(0.42, 0.78, streak);
        float a = edge * fray * (0.18 + 0.8 * ropes);
        vec3 c = mix(vec3(0.3, 0.5, 0.58), vec3(1.0, 0.98, 0.94), ropes);
        // the plunge's mist: a soft white bloom over the last third
        float mist = smoothstep(0.62, 1.0, down) * (1.0 - smoothstep(0.25, 0.5, abs(across))) * (0.5 + 0.5 * n(vec2(across * 4.0, down * 2.0 - uTime * 0.4)));
        c = mix(c, vec3(1.0, 0.97, 0.92), mist * 0.7); a = max(a, mist * 0.55);
        // the lip's mist
        a = max(a, edge * (1.0 - smoothstep(0.0, 0.05, down)) * 0.7);
        gl_FragColor = vec4(c, a * 0.85);
      }` });
}

/** The falls, one instanced draw: each sheet hung from its isle's lip, facing out, at its baked matrix (generators/placements.ts). */
export function skyline(falls: readonly number[]): Group {
  const group = new Group();
  // the sheet's geometry is baked (generators/geometries.ts `fall`, 1 m by 1 m): each instance scales it
  const mesh = new InstancedMesh(skyBakedGeometry('fall'), fallMaterial(), falls.length / 16);
  mesh.instanceMatrix.array.set(falls); mesh.computeBoundingSphere(); group.add(mesh);
  return group;
}
