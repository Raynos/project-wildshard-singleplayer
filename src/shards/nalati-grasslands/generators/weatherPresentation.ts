import * as THREE from 'three';
import { Rng } from '@wildshard/sdk/random';
import { BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL, N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, CAMP_SPUR } from './layout';

const inChunk=(x:number,z:number,margin:number):boolean=>Math.abs(x)<250-margin&&Math.abs(z)<250-margin;
function trailDistance(x:number,z:number):number {
 let best=Infinity;
 for(const path of [...BOWL_TRACKS,EAGLE_TRAIL,CAVE_TRAIL,ARGYMAQ_TRAIL,N_ROAD_PTS,S_ROAD_PTS,W_ROAD_PTS,E_ROAD_PTS,CAMP_SPUR])for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i];if(a===undefined||b===undefined)continue;
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
 }return best;
}
const BOLT_SEGS = 220, PUDDLES = 110;
function noiseTexture(seed: number): THREE.DataTexture {
  const N = 128;
  const hash = (x: number, y: number, o: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(o + seed, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 5; o++) {
      const L = 4 << o, fx = (x / N) * L, fy = (y / N) * L;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const x1 = (x0 + 1) % L, y1 = (y0 + 1) % L;
      const a = hash(x0, y0, o), b = hash(x1, y0, o), c = hash(x0, y1, o), d = hash(x1, y1, o);
      v += (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * amp; norm += amp; amp *= 0.5;
    }
    const i = (y * N + x) * 4, b8 = Math.round((v / norm) * 255);
    data[i] = data[i + 1] = data[i + 2] = b8; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}


/** Static weather geometry, sampled once over the authored terrain. */
export function weatherPresentation(seed: number, heightAt: (x:number,z:number)=>number): { shapes: Record<string, Omit<THREE.BufferGeometryJSON, 'uuid'>>; puddles: number[]; noise: number[]; glow: number[]; fire: number[] } {
 const boltRng = new Rng(seed ^ 0xb017), boltA = new Float32Array(BOLT_SEGS * 12), boltB = new Float32Array(BOLT_SEGS * 12), boltW = new Float32Array(BOLT_SEGS * 4);
 let boltSegs = 0;
 function jag(a: THREE.Vector3, b: THREE.Vector3, levels: number, rough: number, width: number): THREE.Vector3[] {
    let pts = [a.clone(), b.clone()];
    let amp = a.distanceTo(b) * rough;
    for (let l = 0; l < levels; l++) {
      const next: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        if (!p0 || !p1) continue;
        const m = p0.clone().add(p1).multiplyScalar(0.5);
        m.x += boltRng.range(-amp, amp); m.z += boltRng.range(-amp, amp); m.y += boltRng.range(-amp, amp) * 0.3;
        next.push(p0, m);
      }
      const last = pts[pts.length - 1];
      if (last) next.push(last);
      pts = next; amp *= 0.55;
    }
    for (let i = 0; i < pts.length - 1 && boltSegs < BOLT_SEGS; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      if (!p0 || !p1) continue;
      const s = boltSegs++;
      const w = width * (1 - (i / pts.length) * 0.4);
      for (let k = 0; k < 4; k++) {
        const v = s * 4 + k;
        boltA[v * 3] = p0.x; boltA[v * 3 + 1] = p0.y; boltA[v * 3 + 2] = p0.z;
        boltB[v * 3] = p1.x; boltB[v * 3 + 1] = p1.y; boltB[v * 3 + 2] = p1.z;
        boltW[v] = w;
      }
    }
    return pts;
  }
 const strikeOrigin = { x: 0, y: 0, z: 0 };
    
    const top = new THREE.Vector3(strikeOrigin.x + boltRng.range(-60, 60), strikeOrigin.y + boltRng.range(320, 420), strikeOrigin.z + boltRng.range(-60, 60));
    const bottom = new THREE.Vector3(strikeOrigin.x, strikeOrigin.y, strikeOrigin.z);
    boltSegs = 0;
    const trunk = jag(top, bottom, 6, 0.16, 1);
    // 3–5 branches off the upper two thirds of the trunk
    const nb = boltRng.int(3, 5);
    for (let i = 0; i < nb && trunk.length > 4; i++) {
      const k = Math.floor(boltRng.range(0.08, 0.66) * (trunk.length - 1));
      const from = trunk[k];
      if (!from) continue;
      const len = boltRng.range(40, 110) * (1 - k / trunk.length);
      const a = boltRng.range(0, Math.PI * 2);
      const to = new THREE.Vector3(from.x + Math.cos(a) * len * 0.7, from.y - len * boltRng.range(0.5, 0.9), from.z + Math.sin(a) * len * 0.7);
      jag(from, to, 4, 0.22, 0.35);
    }

 function boltGeometry(): THREE.BufferGeometry {
    const n = BOLT_SEGS, corner = new Float32Array(n * 4 * 2), idx = new Uint16Array(n * 6);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { const v = i * 4 + k; corner[v * 2] = k & 1 ? 1 : -1; corner[v * 2 + 1] = k < 2 ? 0 : 1; }
      const b = i * 4; idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(boltA, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(boltB, 3));
    geo.setAttribute('aW', new THREE.BufferAttribute(boltW, 1));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return geo;
  }
 function smoke(): THREE.Points {
    const n = 28, rng = new Rng(seed ^ 0x5e0);
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { seeds[i * 4] = i / n; seeds[i * 4 + 1] = rng.range(-1, 1); seeds[i * 4 + 2] = rng.range(-1, 1); seeds[i * 4 + 3] = rng.range(0.7, 1.3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const p = new THREE.Points(geo, new THREE.MeshBasicMaterial());
    p.frustumCulled = false; p.visible = false; p.renderOrder = 9; p.name = 'lightning-smoke';
    return p;
  }
 function puddles(): THREE.InstancedMesh {
    const rng = new Rng(seed ^ 0x9dd1);
    const spots: { x: number; z: number; y: number; r: number }[] = [];
    for (let tries = 0; tries < 12000 && spots.length < PUDDLES; tries++) {
      const x = rng.range(-240, 240), z = rng.range(-240, 240);
      if (!inChunk(x, z, 6) || trailDistance(x, z) > 2.2) continue;
      const h = heightAt(x, z);
      const m = (heightAt(x + 2, z) + heightAt(x - 2, z) + heightAt(x, z + 2) + heightAt(x, z - 2)) / 4;
      if (h - m > -0.004 && rng.next() > 0.12) continue; // mostly concave spots, a few anywhere on the track
      if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 36)) continue;
      spots.push({ x, z, y: h, r: rng.range(0.6, 1.7) });
    }
    const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(), Math.max(1, spots.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
      s.set(sp.r * rng.range(1, 1.8), 1, sp.r);
      p.set(sp.x, sp.y + 0.03, sp.z);
      mesh.setMatrixAt(i, m4.compose(p, q, s));
    });
    mesh.count = spots.length;
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2; mesh.name = 'puddles';
    return mesh;
  }
 const boltShape = boltGeometry(); boltShape.setDrawRange(0, boltSegs * 6);
 // BufferGeometry JSON excludes drawRange; trim the unused segment tail.
 boltShape.setIndex(Array.from(boltShape.index?.array ?? []).slice(0, boltSegs * 6));
 const pool = puddles(), noise = noiseTexture(seed ^ 0x51);
 const shapes = {
  sky: new THREE.SphereGeometry(2400,32,16),
  deck: new THREE.SphereGeometry(770,48,20,0,Math.PI*2,0,Math.PI*.56),
  curtains: new THREE.CylinderGeometry(745,745,330,64,1,true).translate(0,-5,0),
  bolt: boltShape, smoke: smoke().geometry, puddles: pool.geometry,
 };
 const pixels=noise.image.data;if(!(pixels instanceof Uint8Array))throw new Error('Missing weather noise bytes');
 const glow = (inner: readonly number[], outer: readonly number[]): number[] => {
  const bytes: number[] = [];
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const r=Math.hypot(x-64,y-64)/64, t=Math.min(1,r/.35), fade=Math.max(0,Math.min(1,(1-r)/.65));
   for(let i=0;i<4;i++)bytes.push(Math.round(((inner[i]??0)*(1-t)+(outer[i]??0)*t)*(i===3&&r>.35?fade:1)));
  }
  return bytes;
 };
 return { shapes: Object.fromEntries(Object.entries(shapes).map(([id,g])=>{const {uuid:_uuid,...row}=new THREE.BufferGeometry().copy(g).toJSON();return [id,row];})),
  puddles: Array.from(pool.instanceMatrix.array).slice(0,pool.count*16), noise: Array.from(pixels),
  glow: glow([235,215,255,255],[150,90,255,115]), fire: glow([255,210,120,255],[255,90,20,128]) };
}
