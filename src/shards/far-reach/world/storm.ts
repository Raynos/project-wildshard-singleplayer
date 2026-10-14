import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { createClientScene } from '@wildshard/game/plugin/ui';
import REST_SCENES from '../data/restScenes.generated.json' with { type: 'json' };
import { STORM } from '../data/storm';
import { SKY_LIBRARY } from './meshes';

/** The built storm: its group, `update(dt, t)` firing the lightning on the shard's play clock (seconds), and `strike(delay)`. */
export type CrownStorm = ReturnType<typeof crownStorm>;

/**
 * The storm from its rest scene (generators/restScene.ts `stormRest`: the vortex ring and three hidden bolts), centred at
 * the group's origin (place it over the crown at `STORM.lift`). The ring wears the `storm-ring` look (data/stormLook.ts);
 * `aFlash` carries the lightning to it; before the looks are set (a test) no ring shows. `strike(delay)` fires a strike
 * `delay` seconds from the next update (captures and tests use it through `__wildshard.shard.farReach`).
 */
export function crownStorm(random: () => number): { readonly group: Object3D; readonly update: (dt: number, t: number) => void; readonly strike: (delay?: number) => void } {
  const look = SKY_LIBRARY.look('storm-ring'), bolt = new MeshBasicMaterial({ color: STORM.bolt, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, fog: false, side: DoubleSide });
  const scene = createClientScene(REST_SCENES.storm, { geometry: SKY_LIBRARY.geometry, materials: new Map([['storm-ring', look ?? bolt], ['storm-bolt', bolt]]) });
  const ring = scene.parts.get('storm-ring'), shape: unknown = ring instanceof Mesh ? ring.geometry : null, bolts = Array.from({ length: STORM.bolts }, (_, i) => scene.parts.get(`storm-bolt-${String(i)}`));
  if (ring === undefined || !(shape instanceof BufferGeometry)) throw new Error('far-reach: the storm scene lost its ring');
  const position: unknown = shape.getAttribute('position'), flashes = new Float32Array(position instanceof BufferAttribute ? position.count : 0), flash = new BufferAttribute(flashes, 1);
  shape.setAttribute('aFlash', flash); ring.visible = look !== undefined;
  for (let i = 0; i < STORM.boltDraws; i++) random();
  // the lightning schedule: a strike every 3.5–8 s, a double flicker, one bolt shown
  let next = 2, strike = -10, which = 0, pending: number | null = null;
  return { group: scene.root, strike: (delay = 0) => { pending = delay; }, update: (_dt, t) => {
    if (pending !== null) { next = t + pending; pending = null; }
    if (t >= next) { strike = t; which = Math.floor(random() * bolts.length); next = t + 3.5 + random() * 4.5; }
    const s = t - strike, k = s < 0.08 ? 1 : s < 0.14 ? 0.15 : s < 0.24 ? 0.8 : Math.max(0, 1 - (s - 0.24) / 0.5) * 0.3;
    if (flashes[0] !== k) { flashes.fill(k); flash.needsUpdate = true; }
    bolts.forEach((b, i) => { if (b !== undefined) b.visible = i === which && s < 0.26 && k > 0.5; });
  } };
}
