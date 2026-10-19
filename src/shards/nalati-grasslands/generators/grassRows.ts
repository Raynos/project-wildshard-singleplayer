import * as THREE from 'three';
import type { InstancedBufferGeometry } from 'three';
import { tileFieldGeometry, type TileCardRow } from '@wildshard/sdk/looks/tileField';
import type { SceneBuffers } from '@wildshard/format/sceneBuffers';

interface RingCfg { T: number; G: number; s: number; w: number; seg: number }
const MAX_TILES = 256;
/** A clump's outline on the tile field: 3 crossed quads, 2 rows each (the top row bends): across −0.5 … 0.5, up 0 … 1, part = the quad */
const CLUMP: TileCardRow = {
  shape: [0, 1, 2].flatMap((k) => [0, 0.5, 1].flatMap((y) => [[-0.5, y, k], [0.5, y, k]] as const)),
  triangles: [0, 1, 2].flatMap((k) => [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4].map((i) => i + k * 6)),
};

/** one tile of blades (`per` a side, `seg` segments): aBlade = the cell's offset in the tile (m), t up the blade, side; the
 *  ring's spacing / width / fade and its card hand-over ride along per vertex, the tile origin and the inner ring's square
 *  per instance (`aTile`, `aHole`: written as the frame culls) */
function bladeTile(per: number, cfg: RingCfg, fade: readonly [number, number], near: readonly [number, number, number]): InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  const nv = cfg.seg * 2 + 1, blade: number[] = [], idx: number[] = [];
  for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
    const b = (j * per + i) * nv;
    for (let k = 0; k < cfg.seg; k++) { const t = k / cfg.seg; blade.push(i * cfg.s, j * cfg.s, t, -1, i * cfg.s, j * cfg.s, t, 1); }
    blade.push(i * cfg.s, j * cfg.s, 1, 0);
    for (let k = 0; k < cfg.seg - 1; k++) { const a = b + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const a = b + (cfg.seg - 1) * 2; idx.push(a, a + 1, a + 2);
  }
  return tileGeometry(g, blade, 'aBlade', idx, [cfg.s, cfg.w, fade[0], fade[1]], near);
}

/** one tile of flower heads: aHead = the cell's offset in the tile (m), the quad corner (−0.5 … 0.5, 0 … 1) */
function flowerTile(per: number, s: number, fade: readonly [number, number], near: readonly [number, number, number]): InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry(), head: number[] = [], idx: number[] = [];
  for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
    const b = (j * per + i) * 4;
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]] as const) head.push(i * s, j * s, x, y);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return tileGeometry(g, head, 'aHead', idx, [s, 0, fade[0], fade[1]], near);
}


function tileGeometry(g: InstancedBufferGeometry, cells: number[], name: string, idx: number[], ring: readonly number[], near: readonly number[]): InstancedBufferGeometry {
  const n = cells.length / 4;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute(name, new THREE.Float32BufferAttribute(cells, 4));
  g.setAttribute('aRing', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => ring).flat(), 4));
  g.setAttribute('aNear', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => near).flat(), 3));
  g.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TILES * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aHole', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TILES * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  g.instanceCount = 0;
  return g;
}



const encoded = (array: ArrayBufferView): string => btoa(Array.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), byte => String.fromCodePoint(byte)).join(''));
function scene(list: readonly THREE.InstancedBufferGeometry[]): SceneBuffers {
  const buffers: SceneBuffers['buffers'] = [], attributes: SceneBuffers['attributes'] = [], geometries: SceneBuffers['geometries'] = [], draws: SceneBuffers['draws'] = [];
  for (const [i, geo] of list.entries()) {
    const id = String(i), refs: Record<string,string> = {};
    for (const [name, value] of Object.entries(geo.attributes)) {
      if (!(value instanceof THREE.BufferAttribute)) throw new Error('Grass geometry needs plain channels');
      const key = `${id}.${name}`; refs[name] = key;
      buffers.push({ id: key, storage: 'f32', bytes: encoded(value.array), instanced: value instanceof THREE.InstancedBufferAttribute });
      attributes.push({ id: key, buffer: key, size: value.itemSize, offset: 0, normalized: false });
    }
    const index = geo.getIndex(); if (index === null) throw new Error('Grass triangles missing');
    const key = `${id}.index`; buffers.push({ id: key, storage: 'u16', bytes: encoded(Uint16Array.from(index.array)), instanced: false });
    attributes.push({ id: key, buffer: key, size: 1, offset: 0, normalized: false });
    geometries.push({ id, attributes: refs, index: key, instances: geo.instanceCount });
    draws.push({ id, name: id, at: [0,0,0], draw: { kind: 'mesh', geometry: id, at: [0,0,0], frustum: false } });
    geo.dispose();
  }
  return { version: 1, name: 'grass-field', buffers, attributes, geometries, draws };
}
export function grassRows(phone: boolean): { rings: RingCfg[]; flowers: { T: number; G: number; s: number }; cards: { T: number; across: number; s: number }; near: readonly [number,number]; per: number; scenes: { blades: SceneBuffers; flowers: SceneBuffers; cards: SceneBuffers } } {

const RINGS: RingCfg[] = phone
  ? [{ T: 4, G: 8, s: 0.085, w: 0.047, seg: 3 }, { T: 8, G: 12, s: 0.2, w: 0.1, seg: 2 }, { T: 16, G: 14, s: 0.45, w: 0.2, seg: 1 }]
  : [{ T: 4, G: 8, s: 0.06, w: 0.034, seg: 3 }, { T: 8, G: 14, s: 0.15, w: 0.08, seg: 3 }, { T: 16, G: 18, s: 0.34, w: 0.16, seg: 2 }];
const FLOWERS = phone ? { T: 8, G: 10, s: 0.3 } : { T: 8, G: 14, s: 0.22 };
/** the near field (0 – ~3 m): painted card clumps (GRASS_CARDS), 3 crossed quads each, on the SDK tile field (`across` 2 m
 *  tiles round the camera's, so the cards reach past NEAR[1] every way); the blades thin out under them */
const CARDS = phone ? { T: 2, across: 5, s: 0.2 } : { T: 2, across: 5, s: 0.17 };
/** where the cards hand over to the blades (m from the camera): cards full inside NEAR[0], gone past NEAR[1] */
const NEAR = [2.3, 3.4] as const;



  const blades = RINGS.map((cfg, index) => { const half = cfg.G * cfg.T / 2; return bladeTile(Math.round(cfg.T / cfg.s), cfg, index === RINGS.length - 1 ? [half * .6,half * .95] : [1e4,1e4], index === 0 ? [NEAR[0],NEAR[1],.4] : [-1,0,1]); });
  const cfg = FLOWERS, half = cfg.G * cfg.T / 2;
  const flowers = flowerTile(Math.round(cfg.T / cfg.s), cfg.s, [half * .6,half * .96], [NEAR[0]-.4,NEAR[1]-.2,0]);
  const per = Math.round(CARDS.T / CARDS.s), cards = tileFieldGeometry({ across: CARDS.across, layers: 0, seed: 0x4a1a, grid: per, card: CLUMP }, per * per);
  return { rings: RINGS, flowers: FLOWERS, cards: CARDS, near: NEAR, per, scenes: { blades: scene(blades), flowers: scene([flowers]), cards: scene([cards]) } };
}
