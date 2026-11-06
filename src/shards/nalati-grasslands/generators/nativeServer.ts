import speciesRows from '../data/speciesRows.json' with { type: 'json' };
import { GREAT_KURGAN, GREAT_KURGAN_DOOR } from './poiLayout';
import { nativeAssemblyFiles, type NativeAssemblyPlan, type ServerBlob } from '@wildshard/sharddev/blobs';
import { parsePopulationKnockdownSource } from '@wildshard/sharddev/nativePopulationRows';
import boot from '../data/headlessBoot.json' with { type: 'json' };
import combatTargets from '../data/combatTargets.json' with { type: 'json' };
import crowdNativeProjection from '../data/crowdNativeProjection.json' with { type: 'json' };
import nativeRide from '../data/nativeRiding.json' with { type: 'json' };
import worldUpdates from '../data/worldUpdates.json' with { type: 'json' };
import type { NalatiAdmission } from './admissionProgram';
import { NALATI_ECOLOGY as ecology } from './ecology.mjs';
import { buildEliteEntryPageRows } from './eliteEntryRows';
import { nalatiHeadlessAssembly } from './nativeGroups';
import { nalatiPhysics } from './physics';
import { nalatiRidingPopulation, type NalatiRidingPrograms } from './ridingRows.mjs';
import type { NalatiTitanProgram } from './stormTitanRows.mjs';

function declared<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }

const bootRows = (pasture: NalatiTitanProgram, admissionInput: NalatiAdmission, ridingPrograms: NalatiRidingPrograms) => {
  const { compiled: _admissionCompiled, ...admission } = admissionInput;
  const { compiled: _ridingCompiled, ...riding } = ridingPrograms;
  return { ...boot, worldUpdates, combatTargets,
    hunt: { ...ecology.gameplay, ...ecology.species, sheepdog: { aggressive: false, walkSpeed: 1.4 }, [ecology.argymaq]: ecology.gameplay.horse },
    admission, pasture, riding };
};
/** Every authored native identity, stream, recipe and policy the riding world boots from, around the build's programs. */
export type NalatiNativeBootRows = ReturnType<typeof bootRows>;
export function nalatiNativeBootRows(pasture: NalatiTitanProgram, admission: NalatiAdmission, riding: NalatiRidingPrograms): NalatiNativeBootRows { return bootRows(pasture, admission, riding); }

const assemblyRows = (pasture: NalatiTitanProgram, admission: NalatiAdmission, nativeShelters: [number, number, number][]) => {
  const assembly = nalatiHeadlessAssembly(pasture, admission), constants = assembly.constants;
  const riding = nalatiRidingPopulation(ecology);
  return { ...assembly, constants: { ...constants,
    pageElites: { ...buildEliteEntryPageRows(), profiles: ecology.keeperElites.map(value => ({ id: value.def.id, value })) },
    eliteDefs: Object.fromEntries(Object.entries(ecology.elites).filter(([id]) => ['aqbars', 'kokbori', 'argymaq'].includes(id)).map(([id, def]) => [id, {
      id: def.id, lair: def.lair, awareR: def.awareR, engageR: def.engageR, leashR: def.leashR, rule: def.rule, respawnMin: def.respawnMin, drop: { skin: def.drop.skin },
    }])),
    nativePopulation: { ...riding, driver: { ...riding.driver, projection: crowdNativeProjection } },
    nativeRide: { ...nativeRide, speeds: ecology.modes.ride[0].gaits, roads: boot.roads }, nativeShelters,
  } };
};
/** The population, riding, elite and shelter rows the native hosts read, around the build's programs and placed shelters. */
export type NalatiNativeAssemblyRows = ReturnType<typeof assemblyRows>;
export function nalatiNativeAssemblyRows(pasture: NalatiTitanProgram, admission: NalatiAdmission, nativeShelters: [number, number, number][]): NalatiNativeAssemblyRows { return assemblyRows(pasture, admission, nativeShelters); }

/** The elite roster the native kernels bind: three members, two kernels and the borrowed stallion's projection. */
export function nalatiEliteRows(constants: {
  eliteDefs: Readonly<Record<string, unknown>>;
  pageElites: { profiles: readonly { value: { def: { id: string; lair: { x: number; z: number }; awareR: number }; spec: unknown } }[] };
  nativeKnockdown: unknown;
}, nativeEliteStrikes: Readonly<Record<'swipe' | 'pounce' | 'bite', { readonly id: string }>>): unknown {
  const profile = (at: number) => declared(constants.pageElites.profiles[at], 'Missing elite profiles').value, aqbars = profile(0), kokbori = profile(1);
  return { step: 'nalati.elites', version: 1, wire: { detached: 'argDetached' },
    rows: [{ def: constants.eliteDefs['aqbars'], snapshot: 'aqbars', member: { kind: 'leopard', variant: 'aqbars', source: 'boot', yaw: 0, memory: { low: 0.3 } } },
      { def: constants.eliteDefs['kokbori'], snapshot: 'kokbori', member: { kind: 'kokbori', variant: 'kokbori', source: 'spawn', yaw: 3.141592653589793 }, pack: { offset: [-6, 4], variants: ['grey', 'tawny', 'grey', 'dark', 'scout'], kind: 'wolf', idPrefix: 'creature:' } },
      { def: constants.eliteDefs['argymaq'], snapshot: 'argymaq', member: { kind: 'argymaq', variant: 'stallion', source: 'herd', yaw: 0 }, continuation: { borrowed: { group: 1, role: 'guard' }, detachable: true } }],
    roles: ['native', 'native', 'borrowed'],
    kernels: [{ id: aqbars.def.id, profile: { pattern: 'pouncer', spec: aqbars.spec }, lair: { x: aqbars.def.lair.x, z: aqbars.def.lair.z }, awareRadius: aqbars.def.awareR, contacts: [{ amount: 14, strike: nativeEliteStrikes.swipe.id }], fallbackStrike: nativeEliteStrikes.pounce.id, knockdown: constants.nativeKnockdown },
      { id: kokbori.def.id, profile: { pattern: 'howler', spec: kokbori.spec }, lair: { x: kokbori.def.lair.x, z: kokbori.def.lair.z }, awareRadius: kokbori.def.awareR, contacts: [], fallbackStrike: nativeEliteStrikes.bite.id, knockdown: constants.nativeKnockdown }],
    projections: { argymaq: { signal: 'argymaqTick', states: { display: 1, charge: 2, beaten: 3 }, bondedState: 'bonded', brokenState: 'beaten', adoption: { variant: 'tulpar', scale: 1.3 } } } };
}

/** How each elite's condition word reads the clock and the storm through the admission programme. */
export const NALATI_ELITE_CONDITIONS = { rules: { always: { rule: 0, phase: false, storm: false }, storm: { rule: 1, phase: true, storm: true }, night: { rule: 2, phase: true, storm: false }, dusk: { rule: 3, phase: true, storm: false } },
  phases: { dawn: 0, day: 0, golden: 0, dusk: 1, night: 2 }, storm: { calm: 0, storm: 1 } };

/** The room's bodies, as the page's rigs size them (goldenKingBody.ts, bodies.json). */
const GOLDEN_KING_DIMS = { bodyY: 0.95, bodyHalfLen: 0.5, bodyRadius: 0.3, headRadius: 0.16, legLen: 0.87, feet: [[0.12, 0.05], [-0.12, 0.05], [0.12, -0.05], [-0.12, -0.05]], halfWidth: 0.3, capsuleAxis: 'y' };
const BALBAL_DIMS = { bodyY: 0.9, bodyHalfLen: 0.6, bodyRadius: 0.4, headRadius: 0.26, legLen: 0.82, feet: [[0.16, 0.05], [-0.16, 0.05], [0.16, -0.05], [-0.16, -0.05]], halfWidth: 0.38, capsuleAxis: 'y' };

/** Nalati's native assembly (P1-E3.1b, J90): its hosts in install order, as data over its product files. */
function nalatiNativeAssemblyPlan(nativeBake: NonNullable<NativeAssemblyPlan['bake']>['reader'] & { readonly size: number; readonly resolution: number }, rows: { readonly herds: string; readonly groups: string; readonly external: readonly unknown[] }): NativeAssemblyPlan {
  return { kind: 'native-assembly', level: { speed: 5, authorCap: true, ground: { size: nativeBake.size, height: 0 } }, terrain: { kind: 'shard-tile', resolution: 256, size: 500 }, navigation: 'shard',
    bake: { rows: { file: 'server/physics.json' }, reader: nativeBake, ground: 'data/physics-ground.bin', colliders: ['data/physics-colliders-0.bin', 'data/physics-colliders-1.bin'], read: 'bake',
      owners: { file: 'sim/population-metadata.json' }, seal: { file: 'combat/room-entry.json', path: ['room'] } },
    collision: { resolution: nativeBake.resolution }, entries: { walk: { lanes: 23, walk: 40, start: 249, maxTicks: 800 } },
    boot: { file: 'server/boot.json' }, field: { rows: { file: 'world/meadow.json' }, pond: 'data/geography-pond.bin' },
    features: [{ host: 'collision' }, { host: 'water.field' }, { host: 'day.declared', clock: { file: 'world/forest-weather.json', path: ['sky', 'clock'] } }, { host: 'riding.roster' },
      { host: 'riding.trample', id: 'nalati.trample', radius: 0.55, strength: 1, speedLimit: 30 }, { host: 'riding.environment', wind: { x: -0.8, z: 0.6, strength: 0.5 }, flatten: 0.85 },
      { host: 'weather.native', program: { file: 'world/weather.json' }, shelters: { file: 'server/shelters.json' }, rows: { file: 'server/weather.json' } }, { host: 'riding.groups', rows: { file: 'server/groups.json' } },
      { host: 'riding.elites', rows: { file: 'server/elites.json' }, strikes: { file: 'server/elite-strikes.json' }, projected: 2, conditions: NALATI_ELITE_CONDITIONS },
      { host: 'riding.hunt', config: { file: 'server/population.json' } }, { host: 'riding.mounted', profile: { file: 'server/ride.json' } },
      { host: 'boss.arena', id: 'nalati.king', file: 'combat/room-entry.json', body: { kind: 'golden-king', variant: 'king' }, reward: 'goldenBow',
        entrance: [GREAT_KURGAN.x - Math.sin(GREAT_KURGAN_DOOR) * (GREAT_KURGAN.r + 3), 0, GREAT_KURGAN.z - Math.cos(GREAT_KURGAN_DOOR) * (GREAT_KURGAN.r + 3), GREAT_KURGAN_DOOR] },
      { host: 'riding.taming', rows: { file: 'server/taming.json' }, poses: { file: 'sim/taming-poses.json', path: ['poses'] }, pose: { file: 'actors/species-looks.json', path: ['poses', 'horse'] } }, { host: 'riding.elites-ready' },
      { host: 'held.arms', step: 'nalati.weapons', slots: 'held/slots.json', speed: 7.2, weather: { file: 'server/weather.json' },
        input: { attack: 'nalati.weapon.attack', swap: 'nalati.weapon.swap', aim: 'nalati.weapon.aim', pitch: 'nalati.weapon.pitch' } },
      { host: 'encounter.patrol', step: 'nalati.patrol', rows: 'combat/timed-encounters.json', actors: 'actors/sheep.json', looks: 'actors/species-looks.json', herds: rows.herds, external: { value: rows.external } },
      { host: 'boss.open-arena', id: 'nalati.titan', fight: 'combat/titan-fight.json', geometry: 'combat/titan-geometry.json', view: 'titan-view', groups: rows.groups,
        input: { use: 'nalati.titan.use', skip: 'nalati.titan.skip' }, target: 'encounter:storm-titan:heart', grants: [{ item: 'naizagai', count: 1 }, { item: 'sky-marked-saddle', count: 1 }] }] };
}

/** Nalati's server-class files (J91), built from the same programs the product ships: a client never fetches one. */
export function nalatiServerFiles(pasture: NalatiTitanProgram, admission: NalatiAdmission, riding: NalatiRidingPrograms, nativeShelters: [number, number, number][]): ServerBlob[] {
  const bootFile = nalatiNativeBootRows(pasture, admission, riding), { constants } = nalatiNativeAssemblyRows(pasture, admission, nativeShelters);
  const strike = (at: number) => declared(constants.pageElites.strikes[at], 'Missing elite strikes').strike;
  const strikes = [strike(0), strike(1), strike(2)], [swipe, pounce, bite] = strikes;
  const elites = nalatiEliteRows({ ...constants, nativeKnockdown: parsePopulationKnockdownSource(bootFile.riding) },
    { swipe: declared(swipe, 'swipe'), pounce: declared(pounce, 'pounce'), bite: declared(bite, 'bite') });
  return nativeAssemblyFiles(nalatiNativeAssemblyPlan(constants.nativeBake, { herds: constants.nativeTaming.herds, groups: constants.nativePopulation.groups, external: constants.pageElites.borrowed }), new Map<string, unknown>([['server/physics.json', nalatiPhysics()], ['server/boot.json', bootFile],
    ['server/shelters.json', constants.nativeShelters], ['server/weather.json', constants.nativeWeather], ['server/groups.json', constants.groupRows], ['server/elites.json', elites],
    ['server/elite-strikes.json', strikes], ['server/population.json', constants.nativePopulation], ['server/ride.json', constants.nativeRide], ['server/taming.json', constants.nativeTaming],
    ['server/arena-species.json', { species: [{ ...speciesRows.king, dims: GOLDEN_KING_DIMS }, { ...speciesRows.balbal, dims: BALBAL_DIMS }] }]]));
}
