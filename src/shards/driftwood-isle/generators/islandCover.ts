import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };
/** Build-time cover splat; the page only admits and installs its declared file. */
import * as THREE from 'three';
import * as v from 'valibot';
import { triAreas, type CoverTri } from './coverTris';
import { islandProtos, type IslandProto } from './islandProtos';
import { AuthorCoverGrid, baseCoverGrid } from './coverGrid';
import { bakeCoverCells, coverJitter } from './coverCells';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { area } from './blenderArea';
import ISLAND_FACTS from '../data/islandFacts.generated.json' with {type:'json'};
import { coveFamilyOf, type CoveFamily } from './coveModels';
import { WORLD_DROP } from './sea';
import { ISLAND_LOOK, ISLAND_TIERS } from './islandRows';
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import type { Tier } from '@wildshard/engine/core/tier';


/** one cover triangle in world space (`a`, `b`, `d` its corners) and its mean tinted colour */
export interface CoverTriangle { ax: number; ay: number; az: number; bx: number; by: number; bz: number; dx: number; dy: number; dz: number; r: number; g: number; b: number }

/**
 * E156: each cover triangle's corners and colour, in world space, exactly as the instanced tiles draw them (f32
 * positions, the truncated tinted Uint8 colour), set by set, tile by tile, each tile's placements in order (placements:
 * f32 × 10 each: proto, x, y, z, quaternion, scale, tint).
 */
export function* coverTrianglesOf(protos: readonly (IslandProto | undefined)[], f: Float32Array, sets: readonly (readonly (readonly number[])[])[]): Generator<CoverTriangle> {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), e = m.elements;
  const o: CoverTriangle = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, dx: 0, dy: 0, dz: 0, r: 0, g: 0, b: 0 };
  const w = new Float32Array(9);
  for (const tiles of sets) for (const items of tiles) for (const i of items) {
    const pr = protos[f[i * 10] ?? 0];
    if (pr === undefined) continue;
    const k = i * 10, tint = f[k + 9] ?? 1, sc = f[k + 8] ?? 1;
    t.set(f[k + 1] ?? 0, f[k + 2] ?? 0, f[k + 3] ?? 0); q.set(f[k + 4] ?? 0, f[k + 5] ?? 0, f[k + 6] ?? 0, f[k + 7] ?? 1);
    m.compose(t, q, s.set(sc, sc, sc));
    const ch = (vi: number, c: number) => Math.trunc(Math.min(255, (pr.col[vi * 4 + c] ?? 0) * tint)) / 255;
    for (let tri = 0; tri + 2 < pr.index.length; tri += 3) {
      for (let j = 0; j < 3; j++) {
        const vi = pr.index[tri + j] ?? 0, px = pr.pos[vi * 3] ?? 0, py = pr.pos[vi * 3 + 1] ?? 0, pz = pr.pos[vi * 3 + 2] ?? 0;
        w[j * 3] = e[0] * px + e[4] * py + e[8] * pz + e[12];
        w[j * 3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
        w[j * 3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
      }
      o.ax = w[0] ?? 0; o.ay = w[1] ?? 0; o.az = w[2] ?? 0; o.bx = w[3] ?? 0; o.by = w[4] ?? 0; o.bz = w[5] ?? 0; o.dx = w[6] ?? 0; o.dy = w[7] ?? 0; o.dz = w[8] ?? 0;
      const a = pr.index[tri] ?? 0, b = pr.index[tri + 1] ?? 0, d = pr.index[tri + 2] ?? 0;
      o.r = (ch(a, 0) + ch(b, 0) + ch(d, 0)) / 3; o.g = (ch(a, 1) + ch(b, 1) + ch(d, 1)) / 3; o.b = (ch(a, 2) + ch(b, 2) + ch(d, 2)) / 3;
      yield o;
    }
  }
}

/**
 * The cells of `grid` inside [x0, x1] × [z0, z1] splatted from triangles of cover geometry (world space), row by row as
 * `CoverGrid.writeBlock` takes them: each triangle adds its ground (top) and upright (side) areas × its colour to its
 * cell; `k` scales area to optical depth (fronds overlap). r, g, b, top, side (1 − e^−τ) per cell.
 */
export function splatBlock(grid: AuthorCoverGrid, tris: Iterable<CoverTri>, x0: number, x1: number, z0: number, z1: number, k: number): Float32Array {
  const step = grid.step, n = grid.n, half = CHUNK_HALF;
  const ix = (at: number) => Math.max(0, Math.min(n - 1, Math.round((at + half) / step)));
  const acc = new Map<number, [number, number, number, number, number]>();
  for (const t of tris) {
    const c = Math.round((t.z + half) / step) * n + Math.round((t.x + half) / step);
    const s = acc.get(c) ?? [0, 0, 0, 0, 0], w = t.top + t.side;
    s[0] += t.r * w; s[1] += t.g * w; s[2] += t.b * w; s[3] += t.top; s[4] += t.side;
    acc.set(c, s);
  }
  const i0 = ix(x0), i1 = ix(x1), k0 = ix(z0), k1 = ix(z1), cell = step * step, out = new Float32Array(grid.blockLength(x0, x1, z0, z1));
  let o = 0;
  for (let kk = k0; kk <= k1; kk++) for (let i = i0; i <= i1; i++, o += 5) {
    const s = acc.get(kk * n + i), w = s ? s[3] + s[4] : 0;
    if (s && w > 0) out.set([s[0] / w, s[1] / w, s[2] / w, 1 - Math.exp(-(s[3] / cell) * k), 1 - Math.exp(-(s[4] / cell) * k)], o);
  }
  return out;
}

const coverByte = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 255);
/** A terrain's cover bytes (E156, baked): per vertex `aCover` (the grid's colour × the facet jitter, and its top) then
 *  `aCoverSide`, sampled at each vertex's world (x, z) as the graph reads them, `flat` like the facet colour. */
export function terrainCoverBytes(grid: AuthorCoverGrid, count: number, at: (i: number, out: THREE.Vector3) => THREE.Vector3): Uint8Array {
  const out = new Uint8Array(count * 5), s = { r: 0, g: 0, b: 0, top: 0, side: 0 }, p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    at(i, p); grid.sample(p.x, p.z, s);
    const j = coverJitter(p.x, p.z); // the facet jitter the terrain's own colour has, so covered ground still reads as facets
    out[i * 4] = coverByte(s.r * j); out[i * 4 + 1] = coverByte(s.g * j); out[i * 4 + 2] = coverByte(s.b * j); out[i * 4 + 3] = coverByte(s.top); out[count * 4 + i] = coverByte(s.side);
  }
  return out;
}

/** The cover plants' ground map: the cropped grid as half-float RGBA, per cell rgb × (top + side) and top + side, a ring
 *  of empty cells round it (a bilinear sample's rgb over its alpha is the cover colour); `uv`: a world (x, z) is
 *  (x, z) × [2, 3] + [0, 1]. */
export function coverTexture(data: Float32Array, rect: { x: number; z: number; width: number; height: number }, step: number): { bytes: Uint8Array; width: number; height: number; uv: [number, number, number, number] } {
  const w = rect.width + 2, h = rect.height + 2, out = new Uint16Array(w * h * 4);
  for (let z = 0; z < rect.height; z++) for (let x = 0; x < rect.width; x++) {
    const o = (z * rect.width + x) * 5, a = (data[o + 3] ?? 0) + (data[o + 4] ?? 0), t = ((z + 1) * w + x + 1) * 4;
    for (let c = 0; c < 3; c++) out[t + c] = THREE.DataUtils.toHalfFloat((data[o + c] ?? 0) * a);
    out[t + 3] = THREE.DataUtils.toHalfFloat(a);
  }
  const k = CHUNK_HALF / step;
  return { bytes: new Uint8Array(out.buffer), width: w, height: h, uv: [(k - rect.x + 1.5) / w, (k - rect.z + 1.5) / h, 1 / (step * w), 1 / (step * h)] };
}

/** island.glb's terrain tiles of a tier (the 1 m grid, or the phone's 2 m `terrainlo_*`) in the order the page loads them,
 *  each with its world matrix (meshopt's dequantisation lives there). */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
async function islandTerrainTiles(glb: Uint8Array, phone: boolean): Promise<{ geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]> {
  await MeshoptDecoder.ready;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(glb).buffer, '');
  gltf.scene.updateMatrixWorld(true);
  const protoNames = new Set(ISLAND_FACTS.protos.map((p) => `${ISLAND_LOOK.protoPrefix}${p.name}`)), tiles: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  gltf.scene.traverse((o) => { if (isMesh(o) && !protoNames.has(o.name) && o.name.startsWith('terrainlo') === phone) tiles.push({ geometry: o.geometry, matrix: o.matrixWorld.clone() }); });
  return tiles;
}

interface CoverMeta { protos: { name: string; kind: string }[]; mustDraw: number }
/** E156 / G144: each cover triangle's centre, ground / upright areas and colour, for CoverGrid.splat, from the instanced
 *  placements in world space */
function* instancedCoverTriangles(tris: Iterable<CoverTriangle>): Generator<CoverTri> {
  const o: CoverTri = { x: 0, z: 0, top: 0, side: 0, r: 0, g: 0, b: 0 };
  for (const t of tris) {
    const ar = triAreas(t.ax, t.ay, t.az, t.bx, t.by, t.bz, t.dx, t.dy, t.dz);
    o.top = ar.top; o.side = ar.side;
    o.x = (t.ax + t.bx + t.dx) / 3; o.z = (t.az + t.bz + t.dz) / 3;
    o.r = t.r; o.g = t.g; o.b = t.b;
    yield o;
  }
}

/** The declared tier-specific cover output. */
export const islandCoverUrl = (tier: Tier): string => ISLAND_COVER_FILES[tier].url;

/** the area's splatted block (`splatBlock`) from the cover sets' triangles */
export function islandCoverBlock(tris: Iterable<CoverTriangle>): Float32Array {
  return splatBlock(new AuthorCoverGrid(), instancedCoverTriangles(tris), area.x0, area.x1, area.z0, area.z1, ISLAND_LOOK.coverDepth);
}

/** placements.bin as the build reads it: each placement's y dropped with the world (G164) */
export function islandPlacements(buf: ArrayBuffer): Float32Array {
  const f = new Float32Array(buf);
  for (let i = 2; i < f.length; i += 10) f[i] = (f[i] ?? 0) - WORLD_DROP;
  return f;
}

/** how many placements this tier builds (every palm / rock / log, and the tier's share of the small cover: a prefix) */
export const islandUsed = (f: Float32Array, meta: CoverMeta, phone: boolean): number => meta.mustDraw + Math.round((f.length / 10 - meta.mustDraw) * (phone ? ISLAND_TIERS.phone.share : ISLAND_TIERS.desktop.share));

/**
 * The placements by set and tile: casters CT×CT, small cover and big cover VT×VT; the small rocks rockKit rebuilds.
 * E114: the loose rocks are rockKit's — the boulders (rock*, rockb*: the shore boulders' spots, drawn by Boulders.ts
 * instead) are skipped, the small scattered rocks (smallrock*) rebuilt below. The crag plates on the cliffs (cliff*) stay
 * the Blender ones.
 */
export function islandSets(f: Float32Array, meta: CoverMeta, used: number, phone: boolean): { casters: number[][]; covers: number[][]; bigs: number[][]; smallRocks: number[] } {
  const look = phone ? ISLAND_TIERS.phone : ISLAND_TIERS.desktop;
  const { casters, covers, bigs, apart } = placementSets(f, meta.protos, used, area, { casterTiles: look.casterTiles, coverTiles: look.coverTiles, ...ISLAND_LOOK.names });
  return { casters, covers, bigs, smallRocks: apart };
}

/** The tier's cover file (world/islandCover.ts): the ground map, then each terrain's cover bytes — part 0 the faceted
 *  ground's grid (TERRAIN_RES², row by row), then the island's terrain tiles — and the layout its declaration carries. */
export async function bakeFullIslandCover(readAsset: (url: string) => Uint8Array, phone: boolean, palms: readonly {x:number;z:number}[], ground: {heightAt:(x:number,z:number)=>number;normalAt:(x:number,z:number,eps:number)=>[number,number,number];trailDistance:(x:number,z:number)=>number}, seed: number): Promise<{bytes:Uint8Array;cells:Uint8Array;used:number;texture:{width:number;height:number};groundRect:[number,number,number,number];parts:[number,number][]}> {
  const base = '/assets/models/driftwood-blender/';
  const meta = v.parse(v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })), mustDraw: v.number() }), JSON.parse(new TextDecoder().decode(readAsset(`${base}island.json`))));
  const protos = await islandProtos(readAsset(`${base}island.glb`), meta), f = islandPlacements(Uint8Array.from(readAsset(`${base}placements.bin`)).buffer);
  const used = islandUsed(f, meta, phone), sets = islandSets(f, meta, used, phone);
  const grid=baseCoverGrid(palms,ground.heightAt,ground.normalAt,ground.trailDistance);
  grid.writeBlock(islandCoverBlock(coverTrianglesOf(protos,f,[sets.covers,sets.bigs])),area.x0,area.x1,area.z0,area.z1);
  const {data,rect}=grid.crop(),texture=coverTexture(data,rect,grid.step),res=TERRAIN_RES,d=CHUNK_SIZE/(res-1);
  const chunks=[texture.bytes,terrainCoverBytes(grid,res*res,(i,p)=>p.set(Math.fround(-CHUNK_HALF+(i%res)*d),0,Math.fround(-CHUNK_HALF+Math.floor(i/res)*d)))];
  for(const tile of await islandTerrainTiles(readAsset(`${base}island.glb`),phone)){
    const pos=tile.geometry.getAttribute('position');
    chunks.push(terrainCoverBytes(grid,pos.count,(i,p)=>p.fromBufferAttribute(pos,i).applyMatrix4(tile.matrix)));
  }
  const parts:[number,number][]=[];let at=texture.bytes.length;
  for(const chunk of chunks.slice(1)){parts.push([at,chunk.length/5]);at+=chunk.length;}
  const bytes=new Uint8Array(at);at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  return {bytes,cells:bakeCoverCells(grid,palms,ground,seed,area),used,texture:{width:texture.width,height:texture.height},groundRect:texture.uv,parts};
}


/** How the placements sort: by prototype kind and name (data/islandRows.ts `names`), and the tile counts per side (the
 *  casters' set and the two cover sets). */
type PlacementSetsRow = typeof ISLAND_LOOK.names & { readonly casterTiles: number; readonly coverTiles: number };

/** The placements of a baked set by set and tile, and the ones set apart. */
export interface PlacementSets { casters: number[][]; covers: number[][]; bigs: number[][]; apart: number[] }

/** The tile of `rect` (`n` × `n`) holding (x, z), clamped to the rect. */
function tileOf(rect: typeof area, x: number, z: number, n: number): number {
  const tx = Math.min(n - 1, Math.max(0, Math.floor((x - rect.x0) / (rect.x1 - rect.x0) * n)));
  const tz = Math.min(n - 1, Math.max(0, Math.floor((z - rect.z0) / (rect.z1 - rect.z0) * n)));
  return tz * n + tx;
}

/** The first `used` placements by set and tile (the casters `casterTiles`², the small and big cover `coverTiles`²). */
export function placementSets(f: Float32Array, protos: readonly { readonly name: string; readonly kind: string }[], used: number, rect: typeof area, row: PlacementSetsRow): PlacementSets {
  const CT = row.casterTiles, VT = row.coverTiles;
  const skip = new RegExp(row.skip), apartRe = new RegExp(row.apart), big = new RegExp(row.big);
  const casters: number[][] = Array.from({ length: CT * CT }, () => []), covers: number[][] = Array.from({ length: VT * VT }, () => []), bigs: number[][] = Array.from({ length: VT * VT }, () => []);
  const apart: number[] = [];
  for (let i = 0; i < used; i++) {
    const pi = f[i * 10] ?? 0, kind = protos[pi]?.kind ?? 'small';
    const x = f[i * 10 + 1] ?? 0, z = f[i * 10 + 3] ?? 0;
    const name = protos[pi]?.name ?? '';
    if (skip.test(name)) continue;
    if (apartRe.test(name)) { apart.push(i); continue; }
    if (row.casterKinds.includes(kind)) casters[tileOf(rect, x, z, CT)]?.push(i); else (big.test(name) ? bigs : covers)[tileOf(rect, x, z, VT)]?.push(i);
  }
  return { casters, covers, bigs, apart };
}


interface IslandBox { x:number; z:number; hw:number; hd:number; rot:number; yTop:number; yBottom:number }
interface IslandPlanMeta extends CoverMeta { colliders:IslandBox[] }
interface IslandFamily { key:CoveFamily;indices:number[];boxes:number[];colliders:IslandBox[] }
interface IslandPlacementPlan { version:1;used:number;sets:{casters:number[][];covers:number[][];bigs:number[][]};smallRocks:{x:number;y:number;z:number;matrix:number[];params:{r:number;sq:number}}[];families:IslandFamily[];unclaimed:IslandBox[] }
/** Compile the native placement partitions, world picking bounds and collider ownership once. */
export function bakeIslandPlan(f:Float32Array,meta:IslandPlanMeta,phone:boolean):IslandPlacementPlan {
  const look=phone?ISLAND_TIERS.phone:ISLAND_TIERS.desktop,used=islandUsed(f,meta,phone);
  const sets=placementSets(f,meta.protos,used,area,{casterTiles:look.casterTiles,coverTiles:look.coverTiles,...ISLAND_LOOK.names});
  const local=ISLAND_FACTS.protos.map(fact=>!fact.present?undefined:fact.empty?new THREE.Box3():new THREE.Box3(new THREE.Vector3(fact.min.x,fact.min.y,fact.min.z),new THREE.Vector3(fact.max.x,fact.max.y,fact.max.z)));
  const families=new Map<CoveFamily,IslandFamily>();
  const claim=new Map<string,IslandBox>(),spot=(x:number,z:number)=>`${x},${z}`;
  for(const original of meta.colliders){const c={...original,yTop:original.yTop-WORLD_DROP,yBottom:original.yBottom-WORLD_DROP};claim.set(spot(Math.fround(c.x),Math.fround(c.z)),c);}
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),t=new THREE.Vector3(),b=new THREE.Box3();
  for(let i=0;i<used;i++){
    const o=i*10,pi=f[o]??0,name=meta.protos[pi]?.name??'',key=coveFamilyOf(name),lb=local[pi];
    if(key===undefined||lb===undefined)continue;
    t.set(f[o+1]??0,f[o+2]??0,f[o+3]??0);q.set(f[o+4]??0,f[o+5]??0,f[o+6]??0,f[o+7]??1);
    const sc=f[o+8]??1;b.copy(lb).applyMatrix4(m.compose(t,q,scale.set(sc,sc,sc)));
    let entry=families.get(key);if(entry===undefined){entry={key,indices:[],boxes:[],colliders:[]};families.set(key,entry);}
    entry.indices.push(i);
    entry.boxes.push(b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z);
    const own=claim.get(spot(t.x,t.z));if(own!==undefined){entry.colliders.push(own);claim.delete(spot(t.x,t.z));}
  }
  const smallRocks=sets.apart.map(i=>{
    const o=i*10,pi=f[o]??0,sc=f[o+8]??1,{half,top}=ISLAND_FACTS.protos[pi]??{half:0.4,top:0.25};
    t.set(f[o+1]??0,f[o+2]??0,f[o+3]??0);q.set(f[o+4]??0,f[o+5]??0,f[o+6]??0,f[o+7]??1);
    const r=(half*sc)/1.1,sq=THREE.MathUtils.clamp((top*sc)/(0.92*r),0.4,0.9);
    return{x:t.x,y:t.y,z:t.z,matrix:m.compose(t,q,scale.set(1,1,1)).toArray(),params:{r,sq}};
  });
  return{version:1,used,sets:{casters:sets.casters,covers:sets.covers,bigs:sets.bigs},smallRocks,families:[...families.values()],unclaimed:[...claim.values()]};
}
