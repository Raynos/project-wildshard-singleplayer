/**
 * The soft wall's look (SHARD-PLATFORM SF17b look, G85 "B: shimmer barrier"): while a neighbour isn't ready its edge holds
 * as a closed wall (SF18d `ReadinessWalls`); this draws that wall as a translucent cyan hex shimmer near the traveller, with
 * a "LOADING <shard>" panel and bar where they would cross. The same language as G89's void rail.
 *
 * One draw for every wall (a curtain quad per edge, additive, faded out past ~70 m so a 500 m wall never dominates the
 * view) plus the panel (two quads). Which walls are closed comes from the session each fixed step; a wall opens the
 * moment its neighbour is ready.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace, ShaderMaterial,
} from 'three';
import type { LookScope } from './roadLayout';

/** A wall in the home frame: the edge's centre, the axis its thin side faces, its half length; whose wall it is. */
export interface SoftWallEdge { readonly instance: string; readonly x: number; readonly z: number; readonly axis: 'x' | 'z'; readonly halfLength: number }
/** What the look reads each fixed step. */
export interface SoftWallPorts {
  readonly closed: (instance: string) => boolean;
  /** the traveller's feet in the home frame */
  readonly feet: () => { readonly x: number; readonly z: number };
  /** the shard name a wall's panel shows */
  readonly name: (instance: string) => string;
  /** G167: a refused shard's reason line (null: it is loading). Its panel then names the reason and keeps the save, no bar */
  readonly reason?: (instance: string) => string | null;
  /** A known unconverted cell waits for a product, not a network request. Keep its wall closed without a fake progress bar. */
  readonly waiting?: (instance: string) => { readonly line: string; readonly detail: string } | null;
}
/** The readout. */
export interface SoftWallState { readonly closed: number; readonly panel: string | null; readonly status: 'loading' | 'waiting' | 'refused' | null }

const HEIGHT = 7, PANEL_RANGE = 45, CYAN = new Color(0x38e6ff);

const vertex = /* glsl */ `
attribute float aClosed;
varying float vClosed;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vClosed = aClosed; vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const fragment = /* glsl */ `
uniform vec3 uColour;
uniform float uTime;
varying float vClosed;
varying vec2 vUv;
varying vec3 vWorld;
// distance to the nearest hex cell edge (cells ~0.9 m)
float hexEdge(vec2 p) {
  p /= 0.9;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  return 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
}
void main() {
  if (vClosed < 0.5) discard;
  float d = length(vWorld.xz - cameraPosition.xz);
  float near = 1.0 - smoothstep(25.0, 70.0, d);
  if (near <= 0.0) discard;
  float e = hexEdge(vUv);
  float line = 1.0 - smoothstep(0.0, 0.06, e);
  float wave = 0.5 + 0.5 * sin(vUv.y * 1.3 - uTime * 2.2 + vUv.x * 0.15);
  float ground = 1.0 - smoothstep(0.0, 0.6, vUv.y); // a bright foot where the wall meets the ground
  float top = 1.0 - smoothstep(${(HEIGHT * 0.55).toFixed(1)}, ${HEIGHT.toFixed(1)}, vUv.y);
  float a = (0.07 + line * (0.35 + 0.25 * wave) + ground * 0.35) * top * near;
  gl_FragColor = vec4(uColour * a, 1.0);
}`;

function curtain(edges: readonly SoftWallEdge[]): BufferGeometry {
  const position = new Float32Array(edges.length * 12), uv = new Float32Array(edges.length * 8), closed = new Float32Array(edges.length * 4), index: number[] = [];
  edges.forEach((edge, k) => {
    const along = edge.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 }, h = edge.halfLength;
    const corners = [[-h, 0], [h, 0], [h, HEIGHT], [-h, HEIGHT]] as const;
    corners.forEach(([s, y], c) => {
      position.set([edge.x + along.x * s, y, edge.z + along.z * s], (k * 4 + c) * 3);
      uv.set([s + h, y], (k * 4 + c) * 2);
    });
    const b = k * 4; index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new BufferGeometry().setAttribute('position', new BufferAttribute(position, 3)).setAttribute('uv', new BufferAttribute(uv, 2))
    .setAttribute('aClosed', new BufferAttribute(closed, 1)).setIndex(index);
  g.computeBoundingSphere();
  return g;
}

/** The loading panel's label, redrawn only when the wall it stands on (or its refusal) changes. A refused wall's label
 *  carries a second line (G167: "PINE HOLLOW · NEEDS UPGRADE" over "YOUR SAVE IS KEPT"), with no loading bar. */
function label(text: string, sub: string | null = null): CanvasTexture {
  const el = document.createElement('canvas'); el.width = 512; el.height = 128;
  const g = el.getContext('2d');
  if (g !== null) {
    g.fillStyle = 'rgba(6,22,36,0.82)'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#38e6ff'; g.lineWidth = 3; g.strokeRect(2, 2, 508, 124);
    g.fillStyle = '#e8fbff'; g.font = '600 38px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = text.toUpperCase(), w = g.measureText(t).width;
    g.save(); g.translate(256, sub === null ? 48 : 46); g.scale(Math.min(1, 470 / Math.max(1, w)), 1); g.fillText(t, 0, 0); g.restore();
    if (sub === null) { g.strokeStyle = 'rgba(56,230,255,0.6)'; g.lineWidth = 2; g.strokeRect(40, 86, 432, 18); }
    else {
      g.fillStyle = 'rgba(200,236,248,0.85)'; g.font = '500 26px "Helvetica Neue", Arial, sans-serif';
      const sw = g.measureText(sub).width; g.save(); g.translate(256, 92); g.scale(Math.min(1, 470 / Math.max(1, sw)), 1); g.fillText(sub, 0, 0); g.restore();
    }
  }
  const texture = new CanvasTexture(el); texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Draw the soft walls; `step` runs each fixed step (closed walls, the panel), `time` feeds the shimmer. */
export function installSoftWallLook(input: { readonly edges: readonly SoftWallEdge[]; readonly ports: SoftWallPorts; readonly scene: Object3D; readonly scope: LookScope; readonly time: () => number; readonly saveKept?: string }): { step: () => void; state: () => SoftWallState } {
  const { edges, ports, scene, scope } = input, group = new Group();
  group.name = 'grid-soft-walls';
  const uTime = { value: 0 };
  const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
    uniforms: { uColour: { value: CYAN }, uTime } });
  const wall = new Mesh(curtain(edges), material);
  wall.name = 'grid-soft-wall'; wall.frustumCulled = false; wall.renderOrder = 2;
  const closedAttr = wall.geometry.getAttribute('aClosed');
  // the panel: the label and, under it, a bar that fills while the neighbour loads
  const panel = new Group(), labelMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const card = new Mesh(new PlaneGeometry(3.2, 0.8), labelMaterial);
  const barMaterial = new MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const bar = new Mesh(new PlaneGeometry(1, 0.09), barMaterial);
  bar.name = 'grid-soft-wall-progress';
  bar.position.set(0, -0.19, 0.01); card.renderOrder = 3; bar.renderOrder = 4;
  panel.add(card, bar); panel.visible = false;
  group.add(wall, panel); scene.add(group);
  const flags = edges.map(() => -1);
  let panelFor: string | null = null, panelReason: string | null = null, progress = 0, closedCount = 0;
  let status: SoftWallState['status'] = null;
  const step = (): void => {
    uTime.value = input.time();
    const feet = ports.feet();
    let nearest: { edge: SoftWallEdge; d: number; s: number } | null = null;
    closedCount = 0;
    for (let k = 0; k < edges.length; k++) {
      const edge = edges[k];
      if (edge === undefined) continue;
      const closed = ports.closed(edge.instance) ? 1 : 0;
      if (closed === 1) closedCount++;
      if (flags[k] !== closed) { flags[k] = closed; for (let c = 0; c < 4; c++) closedAttr.setX(k * 4 + c, closed); closedAttr.needsUpdate = true; }
      if (closed === 0) continue;
      const across = edge.axis === 'x' ? feet.x - edge.x : feet.z - edge.z, alongRaw = edge.axis === 'x' ? feet.z - edge.z : feet.x - edge.x;
      const s = Math.max(-edge.halfLength + 2, Math.min(edge.halfLength - 2, alongRaw)), d = Math.hypot(across, alongRaw - s);
      if (d < PANEL_RANGE && (nearest === null || d < nearest.d)) nearest = { edge, d, s };
    }
    if (nearest === null) { panel.visible = false; panelFor = null; status = null; return; }
    const { edge, s } = nearest, reason = ports.reason?.(edge.instance) ?? null;
    const waiting = reason === null ? ports.waiting?.(edge.instance) ?? null : null;
    const message = reason ?? (waiting === null ? null : `${waiting.line}\n${waiting.detail}`);
    status = reason !== null ? 'refused' : waiting === null ? 'loading' : 'waiting';
    if (panelFor !== edge.instance || panelReason !== message) {
      panelFor = edge.instance; panelReason = message; progress = 0;
      labelMaterial.map?.dispose(); labelMaterial.needsUpdate = true;
      labelMaterial.map = reason !== null ? label(reason, input.saveKept ?? null) : waiting === null ? label(`Loading ${ports.name(edge.instance)}`) : label(waiting.line, waiting.detail);
    }
    bar.visible = reason === null && waiting === null;
    progress += (0.92 - progress) * 0.01; // eases toward full while the neighbour loads; the wall opening ends it
    bar.scale.x = Math.max(0.02, progress * 2.7); bar.position.x = -1.35 + bar.scale.x / 2;
    const facing = edge.axis === 'x' ? Math.sign(feet.x - edge.x) || 1 : Math.sign(feet.z - edge.z) || 1;
    if (edge.axis === 'x') { panel.position.set(edge.x + facing * 0.05, 2.2, edge.z + s); panel.rotation.set(0, facing * Math.PI / 2, 0); }
    else { panel.position.set(edge.x + s, 2.2, edge.z + facing * 0.05); panel.rotation.set(0, facing > 0 ? 0 : Math.PI, 0); }
    panel.visible = true;
  };
  scope.onDispose(() => {
    group.removeFromParent(); wall.geometry.dispose(); material.dispose(); card.geometry.dispose(); bar.geometry.dispose();
    labelMaterial.map?.dispose(); labelMaterial.dispose(); barMaterial.dispose();
  });
  return { step, state: () => ({ closed: closedCount, panel: panelFor, status }) };
}
