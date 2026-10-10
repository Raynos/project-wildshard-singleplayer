import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type Texture } from 'three';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { onPaintedDispose } from '../look/image';

import { STORM } from '../data/storm';
import { STORM_PROGRAMS } from '../data/stormLook';

/** The storm's palette (sRGB): belly, mid, the gold of the lit edges, the violet-white of the lightning, the haze it melts into. */
export const STORM_COLORS = { belly: 0x343046, mid: 0x7e7286, top: 0xe8c6a8, gold: 0xffc983, bolt: 0xe2d6ff, haze: 0xedc9b0 } as const;

/** A jagged bolt: a crossed pair of thin ribbons along a zig-zag from the storm's base down `length` metres. */
function boltGeometry(random: () => number, length: number): BufferGeometry {
  const pts: [number, number, number][] = [[0, 0, 0]];
  let x = 0, z = 0;
  for (let i = 1; i <= 9; i++) { x += (random() - 0.5) * 4; z += (random() - 0.5) * 4; pts.push([x, -(i / 9) * length, z]); }
  const pos: number[] = [], w = 0.35;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; if (a === undefined || b === undefined) continue;
    const ww = w * (1 - i / pts.length);
    for (const [ox, oz] of [[ww, 0], [0, ww]] as const) {
      pos.push(a[0] - ox, a[1], a[2] - oz, a[0] + ox, a[1], a[2] + oz, b[0] + ox, b[1], b[2] + oz);
      pos.push(a[0] - ox, a[1], a[2] - oz, b[0] + ox, b[1], b[2] + oz, b[0] - ox, b[1], b[2] - oz);
    }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); return g;
}

export interface CrownStorm {
  readonly group: Group;
  /** Turn the vortex and fire the lightning; `t` is the shard's play clock (seconds). */
  readonly update: (dt: number, t: number) => void;
  /** Strike `delay` seconds from the next update (captures and tests use it through `__wildshard.shard.farReach`). */
  readonly strike: (delay?: number) => void;
}

let PAINT: Texture | null = null;
/** The painted cumulus spiral for the storm's underside (the sea's maelstrom painting; the plugin owns it). */
export function setStormPaint(t: Texture | null): void {
  PAINT = t;
  onPaintedDispose(t, () => { if (PAINT === t) PAINT = null; });
}

/** Build the storm, centred at the group's origin (place it over the crown at `STORM.lift`). */
export function crownStorm(sun: Vector3, tex: Texture, random: () => number): CrownStorm {
  const group = new Group(); group.name = 'far.storm';
  const time = { value: 0 }, flash = { value: 0 }, centre = new Vector3(), family = new ShaderFamily({}, STORM_PROGRAMS);
  STORM.layers.forEach((layer, i) => {
    const radius = STORM.radius * layer.r, geometry = new RingGeometry(0.5, radius, 72, 10); geometry.rotateX(-Math.PI / 2);
    // the vortex program (data/stormLook.ts), one dished ring per layer
    const material = family.material('ring', {}, { defines: PAINT !== null ? { FAR_STORM_PAINT: '' } : {},
      uniforms: { tex: { value: tex }, paint: { value: PAINT }, time, flash, sunDir: { value: sun }, twist: { value: layer.twist }, spin: { value: layer.spin },
        seed: { value: i * 17.3 }, radius: { value: radius }, dish: { value: 6 + i * 4 }, centre: { value: centre } } });
    const mesh = new Mesh(geometry, material); mesh.position.y = layer.dy; mesh.renderOrder = 3 - i; mesh.frustumCulled = false; group.add(mesh);
  });
  const boltMaterial = new MeshBasicMaterial({ color: STORM_COLORS.bolt, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, fog: false, side: DoubleSide });
  const bolts = [0, 1, 2].map((i) => {
    const bolt = new Mesh(boltGeometry(random, 18 + i * 6), boltMaterial); const a = random() * Math.PI * 2, rr = 8 + random() * 18;
    bolt.position.set(Math.cos(a) * rr, 2, Math.sin(a) * rr); bolt.visible = false; bolt.frustumCulled = false; group.add(bolt); return bolt;
  });
  // the lightning schedule: a strike every 3.5–8 s, a double flicker, one bolt shown
  let next = 2, strike = -10, which = 0;
  let pending: number | null = null;
  return { group, strike: (delay = 0) => { pending = delay; }, update: (dt, t) => {
    time.value += dt; group.getWorldPosition(centre);
    if (pending !== null) { next = t + pending; pending = null; }
    if (t >= next) { strike = t; which = Math.floor(random() * bolts.length); next = t + 3.5 + random() * 4.5; }
    const s = t - strike, k = s < 0.08 ? 1 : s < 0.14 ? 0.15 : s < 0.24 ? 0.8 : Math.max(0, 1 - (s - 0.24) / 0.5) * 0.3;
    flash.value = k;
    bolts.forEach((bolt, i) => { bolt.visible = i === which && s < 0.26 && k > 0.5; });
  } };
}
