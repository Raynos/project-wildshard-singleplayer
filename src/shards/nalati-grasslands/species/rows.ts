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
import { PageCreatureGuest } from '@wildshard/game/population/creatureGuest';
import { preloadNalatiBodies, nalatiBody, poseNalatiCreature, balbalCrackGeometry, speciesGuestRows } from './presentation';
import * as THREE from 'three';
import { CreatureFrame } from '@wildshard/game/population/creatureFrame';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';
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
const cracks = new WeakMap<Animal, THREE.MeshBasicMaterial>();
let guest: PageCreatureGuest | null = null;
function creatureGuest(): PageCreatureGuest {
  guest ??= new PageCreatureGuest({ ...speciesRows.balbalGuest,...speciesGuestRows(),weak: speciesRows.weak });
  return guest;
}
export function onBalbalCrack(a: Animal, point: THREE.Vector3): boolean { return creatureGuest().weakPoint(a,point); }
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
export const BALBAL_SPECIES: SpeciesDef = {
  ...speciesRows.balbal, fur: NO_FUR,
  build: variant => nalatiBody('balbal', variant), animate: animateBalbal,
  think: (actor,context) => { creatureGuest().binding.think(actor,context); },
  damageMul: (actor,point,direction,request) => creatureGuest().binding.damageMul(actor,point,direction,request),
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
export function animateGoldenKing(c: AnimalRigContext): void {
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
