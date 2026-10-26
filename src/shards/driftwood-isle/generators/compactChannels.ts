import { BufferAttribute, type BufferGeometry } from 'three';

/**
 * L18.3 (lighter Driftwood downloads): a baked world batch's vertex channels in compact storage, for the GLB writer's
 * `nativeAttributes` path (the engine intake restores the typed channels as they are). Positions stay exact float32;
 * normals become normalized Int8 (±0.4° at worst) and colours normalized Uint16 (linear, 1/65535 steps, so no dark
 * banding): 36 → 21 bytes a vertex for a position / normal / colour batch. Other channels are left as they are.
 */
export function compactChannels(geometry: BufferGeometry): BufferGeometry {
  const normal = geometry.getAttribute('normal');
  if (normal !== undefined) {
    const values = new Int8Array(normal.count * normal.itemSize);
    for (let i = 0; i < values.length; i++) values[i] = Math.round(Math.max(-1, Math.min(1, normal.getComponent(Math.floor(i / normal.itemSize), i % normal.itemSize))) * 127);
    geometry.setAttribute('normal', new BufferAttribute(values, normal.itemSize, true));
  }
  const colour = geometry.getAttribute('color');
  if (colour !== undefined) {
    const values = new Uint16Array(colour.count * colour.itemSize);
    for (let i = 0; i < values.length; i++) values[i] = Math.round(Math.max(0, Math.min(1, colour.getComponent(Math.floor(i / colour.itemSize), i % colour.itemSize))) * 65535);
    geometry.setAttribute('color', new BufferAttribute(values, colour.itemSize, true));
  }
  return geometry;
}
