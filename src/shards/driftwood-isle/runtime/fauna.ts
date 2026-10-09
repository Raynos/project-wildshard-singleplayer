import { Rng } from '@wildshard/engine/core/rng';
import type { HuntSpecies, HuntTuning } from '@wildshard/engine/ai/hunt';
import { ISLAND_BOAR, ISLAND_BEAR } from '../creatures/species';
import { DRIFTWOOD_FAUNA_PLANS } from '../creatures/tables';

/** manifest.ts `faunaTuning` (the beach boars' long sight lines); test/shards/driftwood-isle/headless-runtime.test.ts holds
 *  it equal to DRIFTWOOD_ISLE.faunaTuning. */
export const DRIFTWOOD_FAUNA_TUNING: Partial<Record<string, Partial<HuntTuning>>> = {
  boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
};

/** The island fauna's species rows as the hunting brain reads them (creatures/install.ts registers these two). */
export function faunaSpecies(kind: string): HuntSpecies {
  if (kind === 'boar') return ISLAND_BOAR;
  if (kind === 'bear') return ISLAND_BEAR;
  throw new Error(`Driftwood's hunting brain has no fauna species ${kind}`);
}

/** One fauna body's placement as the manager's anchor search drew it: where it spawned, its yaw, its seed's stream index. */
export interface FaunaSpawn { readonly x: number; readonly z: number; readonly yaw: number; readonly at: number }
/** The fauna's placement read back off the creature stream. */
export interface FaunaPlacement { readonly spawns: ReadonlyMap<string, FaunaSpawn>; readonly centres: readonly (readonly [number, number])[]; readonly draws: number }

const TAU = Math.PI * 2;
/** draws after a body seed: its memory's timer, fleeUntil and callT (HuntBrain.adopt) */
const ADOPT = 3;

/**
 * The fauna's placement, read back off the creature stream `Rng(seed + 31)` (HuntBrain.placeHerds, in plan order): a herd's
 * centre is its anchor's accepted (angle, radius) pair; each member's accepted try is its (angle, radius) about that
 * centre, then its yaw, its variant roll, scale, rig seed and body seed (the baked `seed`, which places it on the stream),
 * then its memory's three draws. The bake's `at` is each body's memory goal at capture time, which a body that has already
 * thought has moved off its spawn; so the spawn, the yaw and the herd centres come from the stream, and the test holds
 * every not-yet-retargeted body's baked goal equal to its spawn. Every herd's first member was placed at its first try
 * (its seed sits 8 draws after the centre's pair); the parse refuses anything else.
 */
export function faunaPlacement(seed: number, fauna: readonly { readonly id: string; readonly herd: number; readonly seed: number }[]): FaunaPlacement {
  const rng = new Rng(seed + 31), u: number[] = [];
  for (let i = 0; i < 512; i++) u.push(rng.next());
  const draw = (i: number): number => { const value = u[i]; if (value === undefined) throw new Error(`Driftwood fauna stream ends before draw ${String(i)}`); return value; };
  const spawns = new Map<string, FaunaSpawn>(), centres: [number, number][] = [];
  let next = 0;
  DRIFTWOOD_FAUNA_PLANS.forEach((plan, herd) => {
    const anchor = plan.anchor, members = fauna.filter(a => a.herd === herd);
    if (anchor === undefined || members.length === 0) throw new Error(`Driftwood fauna herd ${String(herd)} is not an anchored, populated plan`);
    const first = u.indexOf(members[0]?.seed ?? Number.NaN), c = first - 8;
    if (first === -1 || c < next) throw new Error(`Driftwood fauna herd ${String(herd)} does not read off the stream`);
    const ang = draw(c) * TAU, r = anchor.rMin + (anchor.rMax - anchor.rMin) * draw(c + 1);
    const cx = anchor.x + Math.cos(ang) * r, cz = anchor.z + Math.sin(ang) * r;
    centres.push([cx, cz]);
    members.forEach(m => {
      const at = u.indexOf(m.seed);
      if (at === -1 || at - 6 < next) throw new Error(`Driftwood fauna ${m.id} does not read off the stream`);
      const a = draw(at - 6) * TAU, d = 1.5 + 7.5 * draw(at - 5);
      spawns.set(m.id, { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, yaw: draw(at - 4) * TAU, at });
      next = at + 1 + ADOPT;
    });
  });
  return { spawns, centres, draws: next };
}
