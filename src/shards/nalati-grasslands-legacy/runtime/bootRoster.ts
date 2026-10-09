import { Rng, type RngState } from '@wildshard/engine/core/rng';
import { spawnRolls } from '@wildshard/engine/ai/hunt';
import type { VariantDef, VariantTable } from '@wildshard/engine/entities/species/registry';
import { SHEEPDOG_VARIANTS, WOLF_SPECIES } from '../species/wolf';
import { HORSE_SPECIES } from '../species/horse';
import { LEOPARD_SPECIES } from '../species/leopard';
import { GOLDENKING_SPECIES } from '../species/goldenKing';
import { ARGYMAQ, argymaqDefinition, eliteRuleHolds, NALATI_ELITE_ANIMALS, NALATI_ELITE_DEFS } from '../combat/eliteRoster';
import { inChunk, NALATI_WILDLIFE, placeDog, placeHerd, placePack, type WildGround, type WildPlacer } from '../creatures/wildPlacement';
import { HITCH_HORSE_SPOTS } from '../world/layout';
import { NALATI_RUNTIME_SPAWNS } from '../data/spawns';
import { SEED } from '../world/terrain';

/** The creature manager's stream: `Rng(SEED + 31)` with the level's seed (shard.config.ts `seed: 0x4a1a`). */
export const NALATI_CREATURE_STREAM = SEED + 31;
/** Wildlife's own placement stream (creatures/wildlife.ts): `Rng(seed ^ 0x3a17)`. */
export const NALATI_WILD_STREAM = SEED ^ 0x3a17;

/**
 * Nalati's creature rows as the manager's spawn rolls read them, renderer-free (SF72; `spawnRolls`' species seam): the
 * shipping wolf, horse, leopard and Golden King rows, the sheepdog's variant, and Argymaq's row derived from the horse's
 * stallion as combat/elites.ts registers it. A renderer-free host reads these, never the global registry.
 */
export function nalatiSpawnSpecies(): (kind: string) => VariantTable {
  const stallion = HORSE_SPECIES.variants.find(v => v.id === 'stallion');
  if (stallion === undefined) throw new Error('Nalati horse has no stallion');
  const rows = new Map<string, VariantTable>([['wolf', WOLF_SPECIES], ['horse', HORSE_SPECIES], ['sheepdog', { kind: 'sheepdog', variants: SHEEPDOG_VARIANTS }],
    ['leopard', LEOPARD_SPECIES], ['golden-king', GOLDENKING_SPECIES], [ARGYMAQ, argymaqDefinition(HORSE_SPECIES, stallion)]]);
  return kind => { const row = rows.get(kind); if (row === undefined) throw new Error(`Nalati has no creature row '${kind}'`); return row; };
}

/** One body the manager spawned at boot: its id and rolled recipe, its herd slot (−1: none), where it stood, and where
 *  the hunting brain adopted it: the manager stream before its memory's three draws and the spawn spot (HuntBrain.adopt). */
export interface NalatiBootBody {
  readonly id: string; readonly kind: string; readonly variant: VariantDef; readonly seed: number; readonly scale: number;
  herd: number; readonly position: { x: number; z: number }; yaw: number; readonly adopted: { readonly stream: RngState; readonly x: number; readonly z: number };
}
/** A herd as the manager keeps it: its kind, centre and members (a sheepdog's herd is set on the dog but holds no one). */
export interface NalatiBootHerd { readonly kind: string; readonly cx: number; readonly cz: number; readonly members: NalatiBootBody[] }
/** The day and the storm at boot: which lair elites spawn (combat/elites.ts rules). */
export interface NalatiBootClock { readonly phase: string; readonly storm: boolean }

/**
 * The creature manager's boot roster, renderer-free (SF72), in the page's exact order: Wildlife's pack, wild herd, the
 * flock's dog and the camp's two saddled horses (creatures/wildPlacement.ts over the given ground, Wildlife's stream), the
 * shepherd's horse (creatures/sheepRaid.ts), the Golden King's body (combat/goldenKing.ts `fight.reset(0)` spawns it through
 * the boss row, then `setPresent(false)` takes it out of every list: `parked`), then the lair elites whose rule holds
 * (Aqbars; Argymaq with his herd of eight mares and a foal). Every spawn takes the manager stream's six draws (the spawn
 * rolls, then the hunting brain's three memory draws). Kokbori, Qyran and Qara Batyr are not modeled: a clock that would
 * spawn them at boot refuses.
 */
export function nalatiBootRoster(ground: WildGround, clock: NalatiBootClock, species: (kind: string) => VariantTable = nalatiSpawnSpecies()): {
  bodies: NalatiBootBody[]; parked: NalatiBootBody[]; herds: NalatiBootHerd[];
  /** the manager stream after the boot (its decisions' `ThinkCtx.rng` and every later spawn draw on from here) */
  stream: RngState;
  wildStream: RngState;
} {
  const rng = new Rng(NALATI_CREATURE_STREAM), bodies: NalatiBootBody[] = [], parked: NalatiBootBody[] = [], herds: NalatiBootHerd[] = [];
  let next = 0;
  /** AnimalManager.spawnAnimal's draws: the spawn rolls, then HuntBrain.adopt's three (timer, fleeUntil, callT). */
  const spawn = (kind: string, x: number, z: number, yaw: number, variant: string): NalatiBootBody => {
    const r = spawnRolls(rng, kind, variant, bodies.some(b => b.kind === kind && b.variant.rarity === 'legendary'), species);
    const adopted = { stream: rng.snapshot(), x, z };
    for (let i = 0; i < 3; i++) rng.next();
    const body: NalatiBootBody = { id: `creature:${String(next++)}`, kind, variant: r.variant, seed: r.seed, scale: r.scale, herd: -1, position: { x, z }, yaw, adopted };
    bodies.push(body);
    return body;
  };
  const addHerd = (kind: string, cx: number, cz: number): number => { herds.push({ kind, cx, cz, members: [] }); return herds.length - 1; };
  const join = (herd: number) => (body: NalatiBootBody): void => { body.herd = herd; herds[herd]?.members.push(body); };
  const wild: WildPlacer<NalatiBootBody> = { rng: new Rng(NALATI_WILD_STREAM), ground, bodies: () => bodies, spawn,
    place: (body, x, z, yaw) => { body.position.x = x; body.position.z = z; body.yaw = yaw; } };
  const layout = NALATI_WILDLIFE;
  layout.packs.forEach(p => { placePack(wild, p.x, p.z, p.variants, join(addHerd('wolf', p.x, p.z))); });
  layout.herds.forEach(h => { placeHerd(wild, h.x, h.z, h.mares, h.foals, h.stallion, join(addHerd('horse', h.x, h.z))); });
  layout.flocks.forEach(f => { if (f.dog) { const dog = placeDog(wild, f.x, f.z); dog.herd = addHerd('sheepdog', f.x, f.z); } });
  if (layout.campHorses === true) HITCH_HORSE_SPOTS.forEach((h, i) => { spawn('horse', h.x, h.z, Math.atan2(h.face.x, h.face.z), i === 0 ? 'camp-bay' : 'camp-black'); });
  // the shepherd's horse, 12 m east and 16 m south of the first flock's centre, facing it
  const flock = layout.flocks[0];
  if (flock !== undefined && inChunk(flock.x + 12, flock.z + 16, 10)) spawn('horse', flock.x + 12, flock.z + 16, Math.atan2(-12, -16), 'camp-bay');
  // the Golden King's body: spawned through its boss row, then parked out of the manager's list
  const king = NALATI_RUNTIME_SPAWNS.bosses.find(row => row.id === 'nalati.golden-king');
  if (king === undefined) throw new Error('Nalati declares the Golden King\'s boss row');
  const [kingX, kingZ] = king.at;
  if (kingX === undefined || kingZ === undefined) throw new Error('The Golden King\'s boss row has no spot');
  const kingBody = spawn(king.kind, kingX, kingZ, king.yaw, king.look);
  bodies.splice(bodies.indexOf(kingBody), 1); parked.push(kingBody);
  Object.keys(NALATI_ELITE_DEFS).forEach(id => {
    const def = NALATI_ELITE_DEFS[id], who = NALATI_ELITE_ANIMALS[id];
    if (def === undefined || who === undefined) throw new Error(`Nalati elite ${id} has no animal`);
    if (!eliteRuleHolds(def.rule, clock.phase, clock.storm)) return;
    if (id === 'aqbars') spawn(who.kind, def.lair.x, def.lair.z, 0, who.variant);
    else if (id === ARGYMAQ) {
      const herd = addHerd('horse', def.lair.x - 8, def.lair.z + 6);
      placeHerd(wild, def.lair.x - 8, def.lair.z + 6, 8, 1, false, join(herd));
      join(herd)(spawn(who.kind, def.lair.x, def.lair.z, 0, who.variant));
    } else throw new Error(`Nalati boot roster does not model the ${id} elite (${clock.phase}${clock.storm ? ', storm' : ''})`);
  });
  return { bodies, parked, herds, stream: rng.snapshot(), wildStream: wild.rng.snapshot() };
}
