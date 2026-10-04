/**
 * The zip-line cable (E315 M2; PINE-HOLLOW-REMASTER PH-B3): the steel cable, a sagging chord (≈ 1.2 % of its span) from
 * the lookout's launch gantry to the landing's — a thin iron tube in the cabins' iron. Its own space: from its origin
 * (the top end) to `span` (the bottom end, relative). Placed once between the two anchors (src/shards/pine-hollow/world/landmarks.ts).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { timberMats } from '../world/timber';

export interface ZipCableParams {
  /** the far end, relative to the near one (m) */
  readonly span: readonly [number, number, number];
}

export const zipCable = defineModel<ZipCableParams>({
  id: 'pine-hollow/zip-cable', name: 'Zip-line cable', category: 'props', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/zipCable.ts',
  defaults: { span: [0, -8, -60] },
  build: (ctx, p) => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(...p.span);
    const sag = a.distanceTo(b) * 0.012;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0))); }
    return [{ geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 5, false), material: timberMats(ctx).iron }];
  },
});
