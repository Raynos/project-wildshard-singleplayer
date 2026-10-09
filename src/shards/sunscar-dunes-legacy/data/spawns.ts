import { BASIN, PACKS, RAY_HOME, STRIDERS } from './layout';

/** Seconds after a creature falls before its home spawns it again. */
export const RESPAWN = { duneRay: 25, sandSkitterer: 50, duneStrider: 70 } as const;

interface Home { id: string; kind: keyof typeof RESPAWN; look: string; at: [number, number]; yaw: number; respawn: number }
const home = (index: number, kind: keyof typeof RESPAWN, x: number, z: number, yaw: number): Home => ({ id: `sunscar.home:${String(index)}`, kind, look: 'dusk', at: [x, z], yaw, respawn: RESPAWN[kind] });
const skitterers = PACKS.flatMap((p) => Array.from({ length: p.n }, (_, i) => {
  const a = (i / p.n) * Math.PI * 2 + p.x * 0.1;
  return { x: p.x + Math.sin(a) * 3.5, z: p.z + Math.cos(a) * 3.5, yaw: a };
}));

/**
 * The dune's creatures (C2) as declared rows its runtime binds (`runtime.spawns`, SF50-p): one dune ray over the tower,
 * three skitterer packs burrowed along the paths, two striders grazing the far flats, each home `sunscar.home:<authored
 * index>` in that order; and the Dune Matriarch's body in the basin. The species, brains and the boss script stay the
 * runtime's (species/, runtime/brains.ts, combat/matriarch.ts).
 */
export const SIGNAL_SPAWNS = {
  homes: [home(0, 'duneRay', RAY_HOME.x, RAY_HOME.z, 0),
    ...skitterers.map((s, i) => home(1 + i, 'sandSkitterer', s.x, s.z, s.yaw)),
    ...STRIDERS.map((s, i) => home(1 + skitterers.length + i, 'duneStrider', s.x, s.z, 0))],
  bosses: [{ id: 'sunscar.matriarch', kind: 'duneMatriarch', look: 'matriarch', at: [BASIN.x, BASIN.z] as [number, number], yaw: 0 }],
};
