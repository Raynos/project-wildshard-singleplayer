import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { painterLightPatch, parsePaintedLookRow } from '@wildshard/engine/render/dataLook';
import rows from '../data/paintedLook.generated.json' with { type: 'json' };

/** The style bible's rim and shade floor ("Last Light", data/lightLook.ts): the shared painter light on every standard material under `root` (the world's props), once each. */
export function lastLightAll(root: Object3D, scope: Scope): void {
  const seen = new Set<MeshStandardMaterial>(), light = parsePaintedLookRow(rows.look).light;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const list: unknown[] = Array.isArray(o.material) ? o.material : [o.material];
    // a thin tube (the whip's coil) is all grazing faces: the rim would wash it pale, so it can opt out
    for (const m of list) if (m instanceof MeshStandardMaterial && !seen.has(m) && m.userData['sunscarNoRim'] !== true) { seen.add(m); painterLightPatch(m, light, rows.painterSun, scope); }
  });
}
