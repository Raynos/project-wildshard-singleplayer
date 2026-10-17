/**
 * Shrine — where the Ring Shrine stands, and what moves round it (E306 / E315 M1: the shrine itself is the fixed-site model
 * src/shards/driftwood-isle/runtime/models/fixedSites.ts; this is the world side). It places the shrine on its knoll in
 * the north-west jungle (piece `shrine`; its anchors altar, pool, stairFoot and ring in world space) and runs its effects:
 * the glyphs' pulse and the firefly cloud drifting round the platform. `setDusk(k)`: 0 = broad day … 1 = dusk / night
 * (glyph brightness + the firefly cloud; the day clock drives it).
 *
 * The fireflies are one baked mesh of quads its material graph poses on the GPU (data/fireflyLook.ts, lent by the
 * runtime before the world builds); without it (a page outside the hybrid world) the cloud is not drawn.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { placeModelSite, type ModelSite } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { SHRINE_RUNE, bakedSite, shrine, shrineMaterials, shrineRow, type ShrineSite } from '../models/fixedSites';
import { FIREFLY_LOOK } from '../const';
import { hasLentLook, lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { fixedDraw } from '../boot/modelGeometry';

/** The placed shrine with its glyph pulse and its dusk writer. */
export interface Shrine extends ModelSite { readonly update: (dt: number) => void; readonly setDusk: (k: number) => void }

/** Place the shrine on its baked site (registered as piece `shrine` when a registry is given). */
export function placeShrine(sky: Sky, site: ShrineSite, registry: WorldRegistry | null): Shrine {
  const ctx = modelContext(sky), { origin, layout } = bakedSite('shrine', { site }), { baseY, terrace } = shrineRow(site), look = hasLentLook(FIREFLY_LOOK) ? lentLook(FIREFLY_LOOK) : null;
  const placed = placeModelSite(shrine, origin, layout, { ctx, registry, params: { site }, piece: { id: 'shrine' } });
  const glyphs = shrineMaterials(ctx).glyphs;
  // the firefly cloud (an effect, not the model): the baked quads (generators/fireflies.ts) the graph circles round the platform, 0.4–3 m up
  const g = fixedDraw('shrineFireflies').copy();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, terrace - baseY, 0), 18);
  const mesh = new THREE.Mesh(g, look ?? undefined);
  mesh.name = 'shrine-fireflies'; mesh.renderOrder = 4; mesh.visible = look !== null;
  mesh.position.set(site.x - origin.x, baseY, site.z - origin.z); // in the shrine's posed copy
  placed.group.add(mesh);
  let t = 0, dusk = 0.35;
  const out: Shrine = { ...placed,
    update: (dt) => {
      t += dt;
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.1) * Math.sin(t * 0.37 + 1);
      glyphs.color.copy(SHRINE_RUNE).multiplyScalar(1.6 + 2.6 * pulse * (0.6 + 0.4 * dusk));
    },
    setDusk: (k) => { dusk = Math.max(0, Math.min(1, k)); setLentParam(FIREFLY_LOOK, 'dusk', dusk); },
  };
  setLentParam(FIREFLY_LOOK, 'dusk', dusk);
  out.update(0);
  return out;
}
