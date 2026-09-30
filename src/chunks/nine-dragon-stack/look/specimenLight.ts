// E315 (Jake, on the Nine Dragon models board: the Kowloon stele, the lotus-bud finial and the roll shutter open dark): the
// Model Explorer lights Nine Dragon's specimens like a studio, not the city's blue-hour night. On the turntable a specimen
// stands alone at the origin, far from every lantern pool and its baked neon spill, lit only by the look's ambient (0.9),
// its faces turned from the sky screens in the navy shade wash, its stone rain-wet — so the dark granite, stone and steel
// pieces read as ink next to the other shards' daylit specimens. While the turntable is up (`ws:turntable`,
// src/explore/ModelExplorer.ts; the Set Explorer's diorama and play never send it): the ambient is raised, the shade wash
// lifted toward white, the top light turned to come from the side the turntable opens on (its key: the engine sun it opens
// toward), and the washes drawn dry. All four are put back when it closes. Uniform values only: no program recompiles, and
// the world is hidden while a model is on show.
import { Color, type Vector3 } from 'three';
import type { Shared } from './style';

/** the turntable's light: the ambient, how far the shade wash is lifted toward white (0 = the city's, 1 = unshaded), the
 *  key's height (its level part is the side the turntable opens on) */
export const SPECIMEN_LIGHT = { ambient: 1.45, lift: 0.6, keyUp: 0.8 } as const;

/** what the turntable says (ModelExplorer.ts isolate / unisolate): on or off, and the direction it opens toward */
interface Turntable { on: boolean; key?: { x: number; y: number; z: number } }

const WHITE = new Color(1, 1, 1);
let saved: { shared: Shared; ambient: number; shade: Color; light: Vector3; dry: number } | null = null;
let current: () => Shared | null = () => null;
let listening = false;

/** light the Model Explorer's specimens (`on`, keyed from `key`'s side) or put the city's light back */
export function specimenLight(shared: Shared, on: boolean, key?: { x: number; z: number }): void {
  const u = shared.u;
  if (on && saved === null) {
    saved = { shared, ambient: u.uLpAmb.value, shade: u.uShade.value.clone(), light: u.uLightDir.value.clone(), dry: u.uDry.value };
    u.uLpAmb.value = SPECIMEN_LIGHT.ambient;
    u.uShade.value.lerp(WHITE, SPECIMEN_LIGHT.lift);
    u.uDry.value = 1;
    const h = key === undefined ? 0 : Math.hypot(key.x, key.z);
    if (key !== undefined && h > 1e-3) u.uLightDir.value.set((key.x / h) * (1 - SPECIMEN_LIGHT.keyUp), SPECIMEN_LIGHT.keyUp, (key.z / h) * (1 - SPECIMEN_LIGHT.keyUp)).normalize();
  } else if (!on && saved !== null) {
    const s = saved.shared.u;
    s.uLpAmb.value = saved.ambient;
    s.uShade.value.copy(saved.shade);
    s.uLightDir.value.copy(saved.light);
    s.uDry.value = saved.dry;
    saved = null;
  }
}

/** listen for the turntable (once per page); `world` hands the running fragment's shared uniforms (null: none built) */
export function installSpecimenLight(world: () => Shared | null): void {
  current = world;
  if (listening) return;
  listening = true;
  document.addEventListener('ws:turntable', (event) => {
    const t = (event as CustomEvent<Turntable>).detail;
    const shared = saved?.shared ?? current();
    if (shared !== null) specimenLight(shared, t.on, t.key);
  });
}
