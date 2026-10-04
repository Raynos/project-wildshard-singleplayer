/**
 * The VR void past the outer road (SHARD-PLATFORM SF17b look, G77 / G89 "A: Tron grid + rail"): a black unlit floor with
 * cyan grid lines to the horizon, starting at the rail on the outer road's shoulder, and the thin glowing cyan rail itself
 * on short posts. The rail is where the grid's closed rim walls stand (`session.ts` `rimEdges`), so the wall you bump is
 * the rail you see.
 *
 * Cheap by construction: the floor is one square annulus (8 triangles) with a grid shader (no textures, no lights, no fog),
 * the rail one mesh of four beams, the posts one instanced mesh. Lines are anti-aliased with screen derivatives and fade
 * as they shrink under a pixel, so the horizon stays clean instead of shimmering.
 */
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, type Object3D, ShaderMaterial,
} from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { GridCell } from './assembly';
import type { RailBox } from './roadLayout';

/** The void floor's reach past the rail (well beyond the camera's 2.6 km far plane). */
const REACH = 6000;
/** The floor sits a hair above road level so it covers the outer strip beyond the rail. */
const FLOOR_Y = 0.04;
const RAIL_Y = 0.95, POST_STEP = 6;
const CYAN = new Color(0x38e6ff);

const vertex = /* glsl */ `
uniform vec2 uOrigin;
varying vec2 vGrid;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vGrid = world.xz + uOrigin;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const fragment = /* glsl */ `
uniform vec3 uLine;
uniform vec3 uBase;
uniform vec4 uRail; // minX, maxX, minZ, maxZ in the home frame
varying vec2 vGrid;
varying vec3 vWorld;
float lines(vec2 p, float cell, float width) {
  vec2 g = p / cell;
  vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-5));
  float line = 1.0 - min(min(d.x, d.y) / width, 1.0);
  // fade a family of lines out as a cell shrinks toward a pixel (no moire at the horizon)
  return line * (1.0 - smoothstep(0.12, 0.45, max(w.x, w.y)));
}
void main() {
  float minor = lines(vGrid, 20.0, 1.0);
  float major = lines(vGrid, 100.0, 1.6);
  float d = length(vWorld.xz - cameraPosition.xz);
  float edge = min(min(vWorld.x - uRail.x, uRail.y - vWorld.x), min(vWorld.z - uRail.z, uRail.w - vWorld.z));
  edge = max(edge, -min(min(uRail.x - vWorld.x, vWorld.x - uRail.y), min(uRail.z - vWorld.z, vWorld.z - uRail.w)));
  float glow = exp(-abs(edge) / 6.0) * 0.35; // the floor brightens at the rail
  float fade = exp(-d / 1400.0);
  float lit = max(minor * 0.55, major) * (0.35 + 0.65 * fade) + glow * fade;
  vec3 colour = uBase + uLine * lit;
  gl_FragColor = vec4(colour, 1.0);
}`;

/** The void floor: a square annulus from the rail box out to REACH, in the home frame. */
function floorGeometry(box: RailBox, home: GridCell): BufferGeometry {
  const x0 = box.minX - home.origin.x, x1 = box.maxX - home.origin.x, z0 = box.minZ - home.origin.z, z1 = box.maxZ - home.origin.z;
  const X0 = x0 - REACH, X1 = x1 + REACH, Z0 = z0 - REACH, Z1 = z1 + REACH;
  // inner ring 0..3 (sw, se, ne, nw), outer ring 4..7
  const p = [x0, z0, x1, z0, x1, z1, x0, z1, X0, Z0, X1, Z0, X1, Z1, X0, Z1];
  const position = new Float32Array(24);
  for (let k = 0; k < 8; k++) { position[k * 3] = p[k * 2] ?? 0; position[k * 3 + 1] = FLOOR_Y; position[k * 3 + 2] = p[k * 2 + 1] ?? 0; }
  // each side a quad between inner edge (a, b) and outer edge (A, B), wound to face up
  const index = new Uint16Array([0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0].map((n) => n));
  for (let k = 0; k < index.length; k += 3) { const b = index[k + 1] ?? 0; index[k + 1] = index[k + 2] ?? 0; index[k + 2] = b; }
  const g = new BufferGeometry().setAttribute('position', new BufferAttribute(position, 3)).setIndex(new BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/** The readout. */
export interface VoidLookState { readonly rail: RailBox; readonly posts: number }

/** Draw the void and its rail; everything is disposed with the scope. */
export function installVoidLook(input: { readonly rail: RailBox; readonly home: GridCell; readonly scene: Object3D; readonly scope: Scope }): VoidLookState {
  const { rail: box, home, scene, scope } = input, group = new Group();
  group.name = 'grid-void';
  const x0 = box.minX - home.origin.x, x1 = box.maxX - home.origin.x, z0 = box.minZ - home.origin.z, z1 = box.maxZ - home.origin.z;
  const floorMaterial = new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, fog: false, lights: false,
    uniforms: { uOrigin: { value: [home.origin.x, home.origin.z] }, uLine: { value: CYAN.clone().multiplyScalar(0.9) }, uBase: { value: new Color(0x02050a) }, uRail: { value: [x0, x1, z0, z1] } },
  });
  floorMaterial.name = 'grid-void-floor';
  const floor = new Mesh(floorGeometry(box, home), floorMaterial);
  floor.name = 'grid-void-floor'; floor.frustumCulled = false;
  // the rail: four thin beams; unlit, past tone mapping, so it glows the HUD's cyan
  const beam = new BoxGeometry(1, 0.07, 0.07), railMaterial = new MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(1.6), toneMapped: false });
  const sides: readonly [number, number, number, number][] = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
  const rail = new InstancedMesh(beam, railMaterial, 4), m = new Matrix4(), scale = new Matrix4();
  sides.forEach(([ax, az, bx, bz], k) => {
    const len = Math.hypot(bx - ax, bz - az) + 0.07;
    m.makeRotationY(-Math.atan2(bz - az, bx - ax)).setPosition((ax + bx) / 2, RAIL_Y, (az + bz) / 2);
    rail.setMatrixAt(k, m.multiply(scale.makeScale(len, 1, 1)));
  });
  rail.name = 'grid-void-rail'; rail.frustumCulled = false;
  // short dark posts carry it
  const perSide = sides.map(([ax, az, bx, bz]) => Math.max(1, Math.floor(Math.hypot(bx - ax, bz - az) / POST_STEP)));
  const posts = new InstancedMesh(new BoxGeometry(0.08, RAIL_Y, 0.08), new MeshLambertMaterial({ color: 0x2b3036 }), perSide.reduce((a, b) => a + b, 0));
  let k = 0;
  sides.forEach(([ax, az, bx, bz], side) => {
    const n = perSide[side] ?? 1;
    for (let i = 0; i < n; i++) { const t = i / n; posts.setMatrixAt(k++, m.makeTranslation(ax + (bx - ax) * t, RAIL_Y / 2, az + (bz - az) * t)); }
  });
  posts.name = 'grid-void-posts'; posts.frustumCulled = false;
  const meshes: Mesh[] = [floor, rail, posts];
  for (const mesh of meshes) { mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); group.add(mesh); }
  scene.add(group);
  scope.onDispose(() => {
    group.removeFromParent();
    for (const mesh of meshes) { mesh.geometry.dispose(); const material = mesh.material; for (const mat of Array.isArray(material) ? material : [material]) mat.dispose(); }
  });
  return { rail: box, posts: k };
}
