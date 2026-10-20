import { arenaRoomBrain } from '@wildshard/game/boss/arenaRoom';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import speciesRows from './speciesRows.json' with { type: 'json' };
import type { SpeciesRow, SpeciesVariant } from '@wildshard/engine/ai/species';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { speciesWithLook, type SpeciesLook } from '@wildshard/engine/entities/species/look';
import { registerSpecies, type SpeciesDef, type VariantDef, type ThinkCtx, type RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { painterlyAnimalMaterial } from '../look/creatureMaterial';
import { productRiggedHulls, type RiggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import { HORSE_SPECIES } from './horse';
import { WOLF_SPECIES } from './wolf';
import { SHEEPDOG_SPECIES } from './sheepdog';
import { NALATI_STRIKES, sampleStrike } from '../combat/strikes';
import type { DamageRequest } from '@wildshard/engine/combat/pipeline';
import { preloadNalatiBodies, nalatiBody, poseNalatiCreature, balbalCrackGeometry, balbalProgram } from './presentation';
import * as THREE from 'three';
import * as schema from 'valibot';
import { CreatureFrame } from '@wildshard/game/population/creatureFrame';
import { NO_FUR, smooth01, step } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { Vector3 } from 'three';

import { LEOPARD_SPECIES } from './leopard';
import { EAGLE_SPECIES } from './eagle';
import { GHOSTRIDER_SPECIES } from './ghostRider';
import { KOKBORI_SPECIES } from './kokbori';

export const BALBAL = speciesRows.balbal.kind;
export const BALBAL_SLAM = speciesRows.slam;
export const balbalCombat: { melee: 'sabre' | 'spear' | 'other'; isPiercing?: (request: DamageRequest | undefined) => boolean | undefined } = { melee: 'other' };
const cracks = new WeakMap<Animal, THREE.MeshBasicMaterial>();
const localHit = new THREE.Vector3();
const weak = speciesRows.weak.map(([x, y, z]) => new THREE.Vector3(x, y, z));
/** A geometric contact query, shared by hit effects and the event-driven damage law. */
export function onBalbalCrack(a: Animal, point: THREE.Vector3): boolean {
  localHit.copy(point).sub(a.position); localHit.y -= a.yOffset;
  const cos = Math.cos(-a.yaw), sin = Math.sin(-a.yaw), x = localHit.x * cos + localHit.z * sin, z = -localHit.x * sin + localHit.z * cos;
  localHit.set(x, localHit.y, z).multiplyScalar(1 / a.scale);
  return weak.some(w => localHit.distanceTo(w) < .24);
}
function thinkBalbal(a: Animal, c: ThinkCtx): void {
  const m = a.mem, previous = m['balbalThinkAt'], dt = previous === undefined ? c.dt : c.t - previous;
  if (previous !== undefined && dt < .1 - 1e-9) return;
  const n = (key: string, fallback = 0) => m[key] ?? fallback;
  const bearing = Math.atan2(c.player.x - a.position.x, c.player.z - a.position.z), homeBearing = Math.atan2(n('homeX', a.position.x) - a.position.x, n('homeZ', a.position.z) - a.position.z);
  const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const answer = balbalProgram(app.levelScope ?? undefined).project('think', { bearing, homeBearing, homeOff: wrap(n('homeYaw', a.yaw) - a.yaw), hitOff: wrap(bearing - a.yaw), dt, field: n('field'), px: c.player.x, py: c.player.y, pz: c.player.z,
    x: a.position.x, ay: a.position.y, z: a.position.z, yaw: a.yaw, st: n('st', 1), t: n('t'), cd: n('cd'), rise: n('rise', m['init'] === 1 ? 1 : 0),
    emerge: n('emerge', 1), hit: n('hit'), gone: n('gone'), slamT: n('slamT'), state: ['rise', 'idle', 'stalk', 'wander', 'attack'].indexOf(a.state), init: n('init'),
    homeX: n('homeX', a.position.x), homeZ: n('homeZ', a.position.z), homeYaw: n('homeYaw', a.yaw), calm: Number(c.calm), dawn: n('dawn'), emergeT: n('emergeT', 1.6), attack: a.attackPhase,
    bounds: Number(['minX', 'maxX', 'minZ', 'maxZ'].every(key => m[key] !== undefined)), minX: n('minX'), maxX: n('maxX'), minZ: n('minZ'), maxZ: n('maxZ'), scale: a.scale, dmg: n('dmg', m['field'] === 1 ? 30 : 18) });
  const out = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing balbal decision'); return value; };
  for (const key of ['st', 't', 'cd', 'rise', 'emerge', 'hit', 'gone', 'slamT', 'open']) m[key] = out(key);
  m['init'] = 1; m['balbalThinkAt'] = c.t; m['balbalPlayerX'] = c.player.x; m['balbalPlayerZ'] = c.player.z;
  a.position.x = out('x'); a.position.z = out('z'); a.lookTarget.copy(c.player); a.lookWeight = out('look');
  const state = (['rise', 'idle', 'stalk', 'wander', 'attack'] as const)[out('state')]; if (state !== undefined) a.state = state;
  if (out('start') === 1) a.startAttack(2.9);
  if (out('motion') === 1) { if (out('path') === 1) c.steer(a, out('yaw'), out('speed'), out('turn')); else a.setMotion(out('yaw'), out('speed'), out('turn')); }
  if (out('cancel') === 1) a.cancelAttack();
  if (out('strike') === 1) { sampleStrike(NALATI_STRIKES.balbal, a, c.player, () => { c.hurt(out('damage')); }, { shape: { kind: 'wedge', length: 3.1 * a.scale / 1.18 + .4, halfAngle: .96 }, reach: () => c.reach(a) }); c.sound('sailor_slash'); }
  const sound = (['', 'bear_growl', 'bear_roar', 'coconut_land'] as const)[out('sound')]; if (sound !== undefined && sound !== '') c.sound(sound);
}
function animateBalbal(c: RigAnimCtx): void {
  const m = c.mem, a = c.animal;
  let material = cracks.get(a);
  if (material === undefined) {
    material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .46, .1), toneMapped: false }); material.name = 'balbal-cracks';
    const mesh = new THREE.SkinnedMesh(balbalCrackGeometry(), material); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    a.mesh.add(mesh); mesh.bind(a.mesh.skeleton, a.mesh.bindMatrix); cracks.set(a, material);
  }
  const atk = c.attack, wind = atk >= 0 ? step(atk, 0, .52) : 0, flash = atk >= 0 ? Math.max(0, 1 - Math.abs(atk - .55) * 14) : 0;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0, rising = m['field'] === 1 ? 1 - (m['rise'] ?? 1) : 0;
  m['glow'] = (.9 + .25 * Math.sin(c.t * 2.3 + c.seed) + 2.6 * wind * wind + 4 * flash + 1.5 * rising * (.6 + .4 * Math.sin(c.t * 17))) * (1 - dead * .85);
  material.color.setRGB(1, .46, .1).multiplyScalar(m['glow']);
  if (!c.alive) m['deadT'] = (m['deadT'] ?? 0) + c.dt;
  const ground = terrainHeight(a.position.x, a.position.z), sink = Math.max(0, (m['deadT'] ?? 0) - .9) * 1.1;
  a.yOffset = (m['field'] === 1 ? -(1 - smooth01(m['rise'] ?? 1)) * 2.5 * a.scale : (m['floorY'] ?? ground) - ground) - sink;
  poseNalatiCreature('balbal', c);
}
const finite = schema.pipe(schema.number(), schema.finite());
export const BALBAL_SPECIES: SpeciesDef = {
  ...speciesRows.balbal, fur: NO_FUR,
  build: variant => nalatiBody('balbal', variant), animate: animateBalbal, think: thinkBalbal,
  damageMul: (a, point, _direction, request) => schema.parse(finite, balbalProgram(app.levelScope ?? undefined).project('damage', {
    field: a.mem['field'] ?? 0, rise: a.mem['rise'] ?? 1, open: a.mem['open'] ?? 0,
    range: Math.hypot(point.x - (a.mem['balbalPlayerX'] ?? 0), point.z - (a.mem['balbalPlayerZ'] ?? 0)),
    piercing: Number(balbalCombat.isPiercing?.(request) ?? balbalCombat.melee === 'spear'), crack: Number(onBalbalCrack(a, point)),
  })['damage']),
};

export const GOLDEN_KING = speciesRows.king.kind;
export interface GoldenKingPorts {
  think: (a: Animal, c: ThinkCtx) => void; act: (a: Animal, c: ThinkCtx) => void;
  damageMul: (a: Animal, point: Vector3, direction: Vector3) => number;
}
const kingBrains = new WeakMap<Animal, GoldenKingPorts>();
export function bindGoldenKing(a: Animal, ports: GoldenKingPorts): void { kingBrains.set(a, ports); }
let clips: CreatureFrame | null = null;
/** Bind the admitted visual state and numeric channels before any body pose. */
export function prepareGoldenKing(input: unknown): void {
  const programs = parseClientChannels(input);
  clips = new CreatureFrame({ ...speciesRows.kingFrame,defaults: speciesRows.kingPoseDefaults,
    observations: programs.filter(row => row.numeric?.group === 'king.observe'),
    pose: { group: 'creature.pose',programs: programs.filter(row => row.numeric?.group === 'creature.pose') } });
}
export function animateGoldenKing(c: RigAnimCtx): void {
  if (clips === null) throw new Error('Golden King pose rows are not prepared');
  clips.animate(c);
}
export const GOLDENKING_SPECIES: SpeciesDef = {
  ...speciesRows.king, fur: NO_FUR,
  build: v => nalatiBody('goldenKing', v), animate: animateGoldenKing, tick: 'always',
  think: (a, c) => {
    const m = a.mem;
    if (m['init'] !== 1) { m['init'] = 1; m['pose'] ??= 0; m['rise'] ??= 0; m['cape'] ??= 1; m['crown'] ??= 1; m['floorY'] ??= c.heightAt(a.position.x, a.position.z); }
    (kingBrains.get(a) ?? arenaRoomBrain(a))?.think(a, c);
  },
  act: (a, c) => { (kingBrains.get(a) ?? arenaRoomBrain(a))?.act(a, c); },
  damageMul: (a, point, direction) => (kingBrains.get(a) ?? arenaRoomBrain(a))?.damageMul(a, point, direction) ?? 1,
};


const creatureRigs = productRiggedHulls('nalati-grasslands');

export const NALATI_DEFINITIONS: readonly SpeciesDef[] = [HORSE_SPECIES, WOLF_SPECIES, SHEEPDOG_SPECIES, BALBAL_SPECIES, GOLDENKING_SPECIES, LEOPARD_SPECIES, EAGLE_SPECIES, GHOSTRIDER_SPECIES, KOKBORI_SPECIES];
function variantRow(v: VariantDef): SpeciesVariant {
  const { tint: _tint, fur: _fur, traits: _traits, ...row } = v;
  return row;
}
export function nalatiRow(def: SpeciesDef): SpeciesRow {
  const { rigContract: _rigContract, fur: _fur, build: _build, pose: _pose, gait: _gait, postPose: _postPose, rig: _rig, animate: _animate,
    damageMul: _damageMul, eyeGlow: _eyeGlow, eyeGlowIntensity: _eyeGlowIntensity, variants, spawnOnly, ...row } = def;
  return { ...row, id: `species.nalati.${def.kind}`, variants: variants.map(variantRow),
    ...(spawnOnly === undefined ? {} : { spawnOnly: spawnOnly.map(variantRow) }) };
}
/** `rigs`: the page's creature rigs unless a test passes its own */
export function nalatiLook(def: SpeciesDef, rigs: RiggedHulls = creatureRigs): SpeciesLook {
  const row = nalatiRow(def);
  const { rigContract, fur, build, pose, gait, postPose, rig, animate, damageMul, eyeGlow, eyeGlowIntensity } = def;
  return { id: `look.nalati.${def.kind}`, species: row.id, kind: def.kind, rigContract, fur, build,
    ...(pose === undefined ? {} : { pose }), ...(gait === undefined ? {} : { gait }),
    ...(postPose === undefined ? {} : { postPose }), ...(rig === undefined ? {} : { rig }),
    ...(animate === undefined ? {} : { animate }), ...(damageMul === undefined ? {} : { damageMul }),
    ...(eyeGlow === undefined ? {} : { eyeGlow }), ...(eyeGlowIntensity === undefined ? {} : { eyeGlowIntensity }),
    variants: Object.fromEntries([...def.variants, ...(def.spawnOnly ?? [])].map(v => [v.id, {
      ...(v.tint === undefined ? {} : { tint: v.tint }), ...(v.fur === undefined ? {} : { fur: v.fur }),
      ...(v.traits === undefined ? {} : { traits: v.traits }),
    }])),
    material: painterlyAnimalMaterial,
    // the rigged hulls and the baked bodies (species/bodies.ts): the factory awaits both before the first herd
    preload: async () => {
      await Promise.all([rigs.preload(), preloadNalatiBodies()]);
      if (def.kind === GOLDEN_KING && clips === null) {
        const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
        const product = await loadFirstPartyProduct('nalati-grasslands');
        if (product.shardfile.clientChannels === undefined) throw new Error('Missing Golden King pose rows');
        prepareGoldenKing(product.shardfile.clientChannels.filter(channel => channel.id.startsWith('king.')));
      }
    },
    hasSkin: v => rigs.hullOf(def.kind, v.id) !== null,
    loadSkin: async v => { const name = rigs.hullOf(def.kind, v.id); if (name !== null) await rigs.load(name); },
    skin: (v, bones) => { const hull = rigs.skin(def.kind, v.id, bones); return hull === null ? null : { ...hull, normalMap: null, overgrown: false }; },
  };
}
export const NALATI_SPECIES = NALATI_DEFINITIONS.map(nalatiRow);
export const NALATI_LOOKS = NALATI_DEFINITIONS.map((def) => nalatiLook(def));
/** Dynamically derived elite kinds belong to the same resident scope as their parent. */
export function registerNalatiDefinition(def: SpeciesDef, scope: Scope | null = app.levelScope): void {
  if (scope === null) { registerSpecies(def); return; }
  app.species.registerRow(nalatiRow(def), scope); app.species.registerLook(nalatiLook(def), scope);
}
export function installNalatiSpeciesForTests(): void {
  for (const def of NALATI_DEFINITIONS) registerSpecies(speciesWithLook(nalatiRow(def), nalatiLook(def)));
}
