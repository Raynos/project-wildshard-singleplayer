/**
 * Pine Hollow's running water (PINE-HOLLOW-REMASTER PH-L9): the creek from the beaver dam to the slab's south edge, the
 * waterfall off the Ridge into the pond, the plunge-pool foam where it lands and a spray of mist at the foot.
 *
 *   const streams = await new PineStreams(sky).build();   // Pine Hollow only (its bake: ../generators/streams.ts)
 *   scene.add(streams.group);                        // nothing to update: it all runs on wind.ts's clock
 *
 * Two draws, no extra render pass, no per-frame CPU:
 *   · `water`: one mesh for the creek ribbon, the waterfall sheet and the plunge ring, in the pond's photoreal water
 *     (waterSurface.ts — the same program: the clock's sky, Fresnel, depth tint, flow-scrolled ripples, foam, the wet line
 *     on the banks). The creek follows the layout's polyline and `creekSurfaceAt` (the bed + 0.45 m, a thin sheet over the
 *     dam's crest), its uv.y is travel time so the ripples ride the flow and stretch where it is fast; the dam's face is
 *     white (`creekFoamAt`). The waterfall is a curved sheet down the Ridge's face (standing off the rock where it is
 *     steep, bulged at its middle), quickening with the drop, white all the way, ending on the pond's surface in a foam
 *     ring that spreads outward.
 *   · `spray`: a few soft puffs (Particles' mist texture + its fog) rising and fading at the foot of the fall's face and
 *     where it hits the pond, tinted by the fog / sun colours so they follow the clock.
 */
import * as THREE from 'three';
import { fogGLSL } from '@wildshard/game/systems/looks/fogProgram';
import { makeMistTexture } from '@wildshard/game/systems/looks/particles';
import * as v from 'valibot';
import streamJson from '../data/streams.json' with { type: 'json' };
import { fetchBake } from './bakeBytes';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';
import { windUniforms, WIND_DIR } from '@wildshard/engine/world/wind';

const num = v.pipe(v.number(), v.finite()), xyz = v.tuple([num, num, num]);
/** ../data/streams.json: the water mesh's counts and index width, the fall's plunge and face-foot anchors */
const StreamRows = v.strictObject({ bin: v.string(), bytes: num, vertices: num, indices: num, wide: v.boolean(), plunge: xyz, faceFoot: xyz });
/** the bake's rows, parsed strictly once */
export const STREAM_ROWS = v.parse(StreamRows, streamJson);
/** the bake's binary (`scripts/bake-pine-streams.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const STREAM_BAKE_URL = '/assets/pine-hollow/baked/streams.bin';

/** the water mesh from the bake's blocks, as the builder finished it: its index, smoothed normals and bounds */
export function streamGeometry(bytes: Uint8Array): THREE.BufferGeometry {
  if (bytes.length !== STREAM_ROWS.bytes) throw new Error(`[streams] the bake holds ${String(bytes.length)} bytes, its rows ${String(STREAM_ROWS.bytes)}`);
  const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes);
  const n = STREAM_ROWS.vertices, pad4 = (b: number): number => Math.ceil(b / 4) * 4;
  let at = 0;
  const floats = (count: number): Float32Array => { const a = new Float32Array(buffer, at, count); at += pad4(count * 4); return a; };
  const pos = floats(n * 3), uv = floats(n * 2), aw = floats(n * 4);
  const index = STREAM_ROWS.wide ? new Uint32Array(buffer, at, STREAM_ROWS.indices) : new Uint16Array(buffer, at, STREAM_ROWS.indices);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export class PineStreams {
  readonly group = new THREE.Group();
  /** the creek, the waterfall sheet and the plunge ring (one draw; null when its bake did not load) */
  water: THREE.Mesh | null = null;
  /** the mist puffs at the fall's foot and where it meets the pond (one draw) */
  spray!: THREE.InstancedMesh;
  /** where the fall's sheet meets the pond, and the foot of its steep face (the spray's anchors, the sound's) */
  readonly plunge = new THREE.Vector3(...STREAM_ROWS.plunge);
  readonly faceFoot = new THREE.Vector3(...STREAM_ROWS.faceFoot);

  constructor(private sky: Sky) {}

  /** the water from its bake (a bake that fails to load is a page fault, `console.error`: the spray stands alone), the spray */
  async build(): Promise<this> {
    const bytes = await fetchBake(STREAM_BAKE_URL).catch((error: unknown) => { console.error('[pine-hollow] the baked streams did not load:', error); return null; });
    if (bytes) {
      // the gully's banks and the forest over them fill the low reflections (sin 0.3 ≈ 17°)
      const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3 });
      const water = this.water = new THREE.Mesh(streamGeometry(bytes), material);
      water.name = 'creek-waterfall';
      water.receiveShadow = true;
      water.renderOrder = 6; // after the pond: the plunge ring lies on it
      this.group.add(water);
    }
    this.spray = this.buildSpray();
    this.group.add(this.spray);
    return this;
  }

  /** mist puffs: each rises and swells over its own few-second cycle, drifting downwind */
  private buildSpray(): THREE.InstancedMesh {
    const anchors: { p: THREE.Vector3; n: number; size: number; rise: number }[] = [
      { p: this.faceFoot, n: 5, size: 4.5, rise: 3.5 },
      { p: new THREE.Vector3(this.plunge.x, this.plunge.y + 0.3, this.plunge.z), n: 6, size: 5.5, rise: 3 },
    ];
    const total = anchors.reduce((a, x) => a + x.n, 0);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seed = new Float32Array(total * 4), m = new THREE.Matrix4();
    const mesh = new THREE.InstancedMesh(geo, this.sprayMaterial(), total);
    let i = 0;
    for (const a of anchors) for (let k = 0; k < a.n; k++, i++) {
      const j = (i * 0.618034) % 1;
      m.makeScale(a.size * (0.8 + 0.4 * j), a.size * (0.8 + 0.4 * ((j * 7.3) % 1)), a.rise);
      m.setPosition(a.p.x + Math.cos(i * 2.4) * 1.2, a.p.y, a.p.z + Math.sin(i * 2.4) * 1.2);
      mesh.setMatrixAt(i, m);
      seed[i * 4] = j; seed[i * 4 + 1] = 2.6 + 1.6 * ((j * 3.7) % 1); seed[i * 4 + 2] = (j * 5.1) % 1 - 0.5; seed[i * 4 + 3] = 0.8 + 0.4 * ((j * 11.3) % 1);
    }
    geo.setAttribute('spraySeed', new THREE.InstancedBufferAttribute(seed, 4));
    mesh.renderOrder = 7;
    mesh.name = 'waterfall-spray';
    mesh.computeBoundingSphere();
    return mesh;
  }

  private sprayMaterial(): THREE.ShaderMaterial {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) as Record<string, THREE.IUniform>;
    attachFogUniforms({ uniforms: u });
    u['uTex'] = { value: makeMistTexture() };
    u['uWindTime'] = windUniforms.uWindTime;
    u['uSunColor'] = { value: this.sky.sunColor };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      vertexShader: /* glsl */`
        attribute vec4 spraySeed;   // phase, period (s), sideways drift, opacity
        uniform float uWindTime;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          vec3 anchor = instanceMatrix[3].xyz;
          vec2 size = vec2( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ) );
          float rise = length( instanceMatrix[2].xyz );
          float t = fract( uWindTime / spraySeed.y + spraySeed.x );
          vec3 centre = anchor + vec3( 0.0, rise * t, 0.0 ) + vec3( ${WIND_DIR.x.toFixed(3)}, 0.0, ${WIND_DIR.z.toFixed(3)} ) * t * 2.2
            + vec3( spraySeed.z, 0.0, - spraySeed.z ) * t * 1.5;
          float grow = 0.55 + 0.75 * t;
          vec3 toCam = cameraPosition - centre;
          vec3 fwd = normalize( vec3( toCam.x, 0.0, toCam.z ) + 1e-4 );
          vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), fwd ) );
          vec3 w = centre + right * position.x * size.x * grow + vec3( 0.0, position.y * size.y * grow, 0.0 );
          vWorld = w;
          float ang = spraySeed.x * 6.283 + t * 0.8;
          vec2 c = uv - 0.5;
          vUv = vec2( c.x * cos( ang ) - c.y * sin( ang ), c.x * sin( ang ) + c.y * cos( ang ) ) + 0.5;
          vFade = sin( 3.14159 * t ) * spraySeed.w * smoothstep( 1.5, 5.0, length( toCam ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
        }`,
      fragmentShader: /* glsl */`
        ${fogGLSL}
        uniform sampler2D uTex; uniform vec3 uSunColor;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          float a = texture2D( uTex, vUv ).a * vFade * 0.55;
          // spray is lit like the air around it: the fog's colour, brighter toward the sun
          float sunAmt = max( dot( normalize( vWorld - cameraPosition ), fogSunDir ), 0.0 );
          vec3 col = mix( fogColor * 1.15, fogSunColor, 0.25 + 0.5 * pow( sunAmt, 3.0 ) ) + uSunColor * 0.04;
          col = mix( col, atmosFogColor( vWorld ), atmosFogFactor( vWorld ) );
          gl_FragColor = vec4( col, a );
        }`,
    });
    patchShader(mat, 'pine.stream-fog', PATCH_ORDER.material, (shader) => { attachFogUniforms(shader); }, { mode: 'replace' });
    return mat;
  }
}
