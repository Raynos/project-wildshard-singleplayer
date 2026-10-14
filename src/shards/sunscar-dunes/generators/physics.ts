import type { BoxColliderData } from '@wildshard/sdk/physics';
import { RIDGES, SEED } from '../data/layout';
import { SIGNAL_SPAWNS } from '../data/spawns';
import { STRINGS } from '../data/strings';
import { SCOUT_ROW } from '../data/questPresentation';
import rows from '../data/physicsRows.json' with { type: 'json' };
import { signalHeightAt } from './landscape';
import { signalDunesField } from './tiles';
import { signalPhysicsPlacements } from './physicsPlacements';
import { signalTowerPhysicsPlacements } from './towerColliders';

/** The creature manager's stream (mulberry32 on the level seed + 31): scale, rig seed, actor seed, then three brain rolls. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Kind = keyof typeof rows.species;
const isKind = (kind: string): kind is Kind => kind in rows.species;
/** The kind's authored simulation spec and scale range (`data/physicsRows.json`; test/shards/sunscar-dunes/physics-bake.test.ts
 * holds them to the species rows). */
function species(kind: string): (typeof rows.species)[Kind] {
  if (!isKind(kind)) throw new Error(`Signal physics: no species row for ${kind}`);
  return rows.species[kind];
}
/** A sandstone ridge lobe: the registry's footprint box, in its numeric operation order. */
function lobe(x: number, z: number, hw: number, hd: number, rot: number, yBottom: number, yTop: number): BoxColliderData {
  return { kind: 'box', x, y: (yTop + yBottom) / 2, z, hx: hw, hy: Math.max(0.005, (yTop - yBottom) / 2), hz: hd, yaw: -rot, surface: 'rock' };
}

/** G350-SD: Signal's physics product from authoring inputs only: the placement, tower, ridge and scout recipes, the species
 * scale ranges with the manager's seed stream, and the authored rows no recipe computes (arena, dressing tree, species, spots). */
export function signalPhysics(): Record<string, unknown> {
  const field = signalDunesField(), ridges = RIDGES.flatMap(r => [0, 1, 2].map(j => {
    const along = (j - 1) * r.len * 0.32, x = r.x + Math.sin(r.yaw) * along, z = r.z + Math.cos(r.yaw) * along;
    const h = r.h * (j === 1 ? 1 : 0.7), half = r.len * (j === 1 ? 0.3 : 0.24), w = Math.max(1.6, r.h * 0.7), y = field.heightAt(x, z) - 0.6;
    return lobe(x, z, w * 0.75, half * 0.8, -r.yaw, y - 1, y + h * 0.8);
  }));
  const rocks = { id: 'sunscar.rocks', name: STRINGS.rocks, category: 'nature', file: 'src/shards/sunscar-dunes/generators/rocks.ts', colliders: ridges,
    active: true, owner: 'piece:sunscar.rocks', surface: 'rock' };
  const groundAt = signalHeightAt(), at = SCOUT_ROW.at, c = SCOUT_ROW.collider, y = groundAt(at.x, at.z);
  const scout = { id: SCOUT_ROW.id, name: SCOUT_ROW.name, category: 'props', file: 'src/shards/sunscar-dunes/data/questPresentation.ts',
    colliders: [{ kind: 'box', x: at.x, y: y + (c.above - c.below) / 2, z: at.z, hx: c.half, hy: Math.max(0.005, (c.above + c.below) / 2), hz: c.half, yaw: 0, surface: c.surface }],
    active: true, owner: `piece:${SCOUT_ROW.id}`, surface: c.surface };
  const [tower] = signalTowerPhysicsPlacements(), [caravan, well, ...braziers] = signalPhysicsPlacements();
  const next = stream(SEED + 31);
  const actors = SIGNAL_SPAWNS.homes.map(home => {
    const made = species(home.kind), [low = 1, high = 1] = made.scale, scale = low + (high - low) * next();
    next(); const seed = next(); next(); next(); next();
    return { id: home.id, kind: home.kind, spec: made.spec, seed, scale };
  });
  const bosses = SIGNAL_SPAWNS.bosses.map(boss => ({ id: boss.id, kind: boss.kind, spec: species(boss.kind).spec }));
  const prompt = (id: string, position: { x: number; y: number; z: number }, radius: number): Record<string, unknown> => ({ id, position, radius, sight: { slack: 0.5 } });
  const promptRegistrations = [...rows.spots.interact.map(s => prompt(s.id, { x: s.x, y: s.y, z: s.z }, s.radius)),
    prompt(SCOUT_ROW.spot, { x: at.x, y: y + SCOUT_ROW.talkHeight, z: at.z }, SCOUT_ROW.talkRadius)];
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (signal-physics).', actors,
    pieces: [tower, caravan, well, rocks, rows.dressing, ...braziers, rows.arena, scout], spots: rows.spots, promptRegistrations, bosses };
}
