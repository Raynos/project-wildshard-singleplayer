import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Isle } from '../layout';
import { SKY_ISLES } from './skyIsles';

/**
 * The falls (loop 5): waterfalls off the playable isles' rims into the cloud sea (the targets have them; council R1C-9).
 * Loop 2's fourteen 3-D skyline islands are gone (council R1C-12 / R1B-7: bare cones in front of the painted matte's
 * finished islands); the panorama (look/sky.ts) carries every far island now. Each fall is [isle, the rim angle in
 * radians (0 = +x), length].
 */
const FALLS: readonly (readonly [isle: string, angle: number, length: number])[] = [
  ['windmill', Math.PI, 60], ['grove', Math.PI * 0.75, 44], ['ruin', 0.2, 50], ['keeper', Math.PI * 1.15, 40], ['crown', Math.PI * 1.55, 70],
];

/** A falling sheet: white at the lip fading to nothing far below (vertex alpha), a slight outward bow. */
export function fallGeometry(length: number, width: number): BufferGeometry {
  const pos: number[] = [], col: number[] = [], rows = 6, c = new Color();
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows, t1 = (r + 1) / rows, y0 = -t0 * length, y1 = -t1 * length, b0 = Math.sin(t0 * 1.4) * 1.5, b1 = Math.sin(t1 * 1.4) * 1.5;
    const a0 = 1 - t0, a1 = 1 - t1;
    const quad: [number, number, number, number][] = [[-width / 2, y0, b0, a0], [width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y0, b0, a0], [width / 2, y1, b1, a1], [-width / 2, y1, b1, a1]];
    for (const [x, y, z, a] of quad) { pos.push(x, y, z); c.setRGB(0.95, 0.97, 1); col.push(c.r, c.g, c.b, a * 0.8); }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 4));
  return g;
}

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
        float edge = 1.0 - smoothstep(0.32, 0.5, abs(across) + (n(vec2(down * 4.0, uTime * 0.3)) - 0.5) * 0.12);
        float fray = 1.0 - smoothstep(0.55, 1.0, down) * (0.4 + 0.6 * n(vec2(across * 9.0, down * 5.0 - uTime)));
        float a = edge * fray * (0.35 + 0.55 * smoothstep(0.35, 0.8, streak));
        vec3 c = mix(vec3(0.62, 0.78, 0.86), vec3(0.97, 0.98, 1.0), smoothstep(0.4, 0.85, streak));
        // the lip's mist
        a = max(a, edge * (1.0 - smoothstep(0.0, 0.05, down)) * 0.7);
        gl_FragColor = vec4(c, a * 0.85);
      }` });
}

/** The falls, one instanced draw: each sheet hangs from its isle's lip, facing out. */
export function skyline(isles: readonly Isle[]): Group {
  const group = new Group(), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  const sky = SKY_ISLES.flatMap((s) => s.fall === null ? [] : [{ isle: s, a: s.fall, length: s.keel * 1.3 }]);
  const at = [...FALLS.flatMap(([id, a, length]) => { const isle = isles.find((i) => i.id === id); return isle === undefined ? [] : [{ isle, a, length }]; }), ...sky];
  const fall = fallGeometry(1, 1), falls = new InstancedMesh(fall, fallMaterial(), at.length);
  at.forEach(({ isle, a, length }, k) => {
    const r = isle.r * Math.cos(Math.PI / 12) * 0.9, width = 1.8 + isle.r * 0.04;
    q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a)));
    m.compose(new Vector3(isle.x + Math.cos(a) * r, isle.y - 1.1, isle.z + Math.sin(a) * r), q, new Vector3(width, length, 1)); falls.setMatrixAt(k, m);
  });
  falls.computeBoundingSphere(); group.add(falls);
  return group;
}
