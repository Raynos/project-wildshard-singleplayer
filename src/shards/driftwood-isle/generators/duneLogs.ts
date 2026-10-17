import * as THREE from 'three';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';
import { log } from '@wildshard/engine/world/geometryKit';
import { addDriftLog, DRIFT } from './driftLogs';
import authoredLayout from '../data/layout.json' with { type: 'json' };

const { ISLAND } = authoredLayout;

/** Author-only dune-log sculpt and scatter, shared by the fixed mesh and clipping compilers. */
export function duneLogs(heightAt:(x:number,z:number)=>number,trailDistance:(x:number,z:number)=>number,avoid:readonly{x:number;z:number;r:number}[],seaLevel:number,seed:number):{geometry:THREE.BufferGeometry;logs:{a:THREE.Vector3;b:THREE.Vector3;r:number;tone:number}[]} {
    const kit = new LowPolyKit(seed ^ 0x6c08), rng = kit.rng, sea = seaLevel;
    const logs: { a: THREE.Vector3; b: THREE.Vector3; r: number; tone: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += 9 / 200) {
      const dx = Math.cos(a), dz = Math.sin(a);
      // march outward from inland to the first sand below the dune crest (~1.6 m over the sea)
      let r = 120, found = false;
      for (; r < 250; r += 1) { const x = ISLAND.x + dx * r, z = ISLAND.z + dz * r; if (heightAt(x, z) - sea < 1.6) { found = true; break; } }
      if (!found || rng.next() < 0.2) continue;
      const x = ISLAND.x + dx * (r - rng.range(0, 3)), z = ISLAND.z + dz * (r - rng.range(0, 3));
      if (Math.abs(x) > 245 || Math.abs(z) > 245) continue;
      if (avoid.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 3) ** 2) || trailDistance(x, z) < 3.5) continue;
      const n = rng.next() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const len = rng.range(2.2, 4.2), rad = rng.range(0.12, 0.24), yaw = a + Math.PI / 2 + rng.range(-0.6, 0.6) + k * 1.1;
        const hx = Math.cos(yaw) * len / 2, hz = Math.sin(yaw) * len / 2;
        const A = new THREE.Vector3(x - hx, heightAt(x - hx, z - hz) + rad * 0.7 + k * 0.2, z - hz), B = new THREE.Vector3(x + hx, heightAt(x + hx, z + hz) + rad * 0.7 + k * 0.2, z + hz);
        addDriftLog(kit, A, B, rad, rad * 0.7, { sides: 6, twist: rng.range(0, 1), tone: k + Math.floor(a * 10), wobble: 0.02 });
        logs.push({ a: A, b: B, r: rad, tone: k + Math.floor(a * 10) });
        if (rng.next() < 0.5) { const m = A.clone().lerp(B, rng.range(0.3, 0.7)); kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(0.25, 0.5), rng.range(-0.3, 0.3))), rad * 0.4, rad * 0.25, 5), DRIFT.stub); }
      }
    }
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.35, strength: 0.5 } });
    return {geometry:geo,logs};
}

