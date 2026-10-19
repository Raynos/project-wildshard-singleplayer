import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicMaterial, type Material, Uint16BufferAttribute } from 'three';
import light from '../data/light.json' with { type: 'json' };
import type { Emitter as EmitterLike } from './receiverCards';



const isLamp = (e: EmitterLike): boolean => e.w < 0.5 && e.h < 0.5;

// SHARD-PLATFORM M3: the halos' tuning, GLSL and program row are data (data/light.ts HALO, HALO_PROGRAMS)
const HALO = light.halo;

export interface HaloSources { lanterns: readonly EmitterLike[]; shops: readonly EmitterLike[]; signs: readonly EmitterLike[] }



export function buildHalos(src: HaloSources): Mesh<InstancedBufferGeometry, Material> {
  const at: number[] = [], col: number[] = [], rad: number[] = [];
  const push = (e: EmitterLike, r: number, k: number, pull = 0, kind = 0): void => {
    at.push(e.at.x, e.at.y, e.at.z);
    // a lantern's paper glows orange-red, a sign its own neon, a shop amber: the halo is the light's colour, not the
    // emitter's saturated body colour pulled to white
    col.push(e.color.r * k, (e.color.g + pull) * k, e.color.b * k, kind);
    rad.push(r);
  };
  for (const e of src.lanterns) push(e, HALO.lantern.r * (e.w / 0.5), HALO.lantern.k, 0.18);
  for (const e of src.shops) {
    if (isLamp(e)) { push(e, HALO.lamp.r, HALO.lamp.k, 0, 1); continue; }
    push(e, Math.min(Math.max(HALO.shop.rPerW * e.w, HALO.shop.rMin), HALO.shop.rMax), HALO.shop.k * Math.min(Math.max(e.spill / 0.3, 0.5), 1.5), 0, 2);
  }
  for (const e of src.signs) {
    if (e.power <= 0) continue;
    push(e, HALO.sign.r + HALO.sign.rPerSize * Math.max(e.w, e.h), HALO.sign.k * Math.min(e.power, 1.5), 0, 3);
  }
  const n = rad.length;
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('aCorner', new Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  g.setAttribute('aAt', new InstancedBufferAttribute(new Float32Array(at), 3));
  g.setAttribute('aCol', new InstancedBufferAttribute(new Float32Array(col), 4));
  g.setAttribute('aR', new InstancedBufferAttribute(new Float32Array(rad), 1));
  g.instanceCount = n;
  const mat = new MeshBasicMaterial();
  mat.setValues(light.haloState);
  const mesh = new Mesh(g, mat);
  mesh.name = 'halos';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}
