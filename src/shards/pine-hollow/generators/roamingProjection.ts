/** Compile the roaming projection from its existing encounter, rig and look rows. */
import { Color } from 'three';
import * as v from 'valibot';
import { RoamingBossProjectionSchema } from '@wildshard/format/roamingBossProjection';
import { NATIVE_VIEW } from './nativeView';
import { PINE_OUTPUT } from './outputInputs';
import look from '../data/antlerKingLook.json' with { type: 'json' };

const D = look.KING_DRESS, O = D.open, source = PINE_OUTPUT.custom['custom/kingKit'];
const material = (id: string, gain: number) => ({ id, colour: new Color(D.glowMat.color).toArray(), emissive: D.amber,
  gain, roughness: D.glowMat.roughness, metalness: D.glowMat.metalness, lit: false, fog: D.glowMat.fog });
const hazardMeshes = [{ geometry: 'king-lantern-frame', material: 'frame' }, { geometry: 'king-lantern-glass', material: 'glass' }];
export const ROAMING_PROJECTION = v.parse(RoamingBossProjectionSchema, {
  id: 'pine.king.projection', session: 'pine.combat', spawn: 'pine.antler-king', spawnStream: 'pine.spawn.thrall', variant: 'warden',
  socketRig: { id: 'pine.king.rig', pool: source.pool, collision: { joints: NATIVE_VIEW.QUADRUPED.collision.joints, volumes: NATIVE_VIEW.QUADRUPED.collision.volumes },
    materials: [{ id: 'frame', colour: new Color(D.frameMat.color).toArray(), emissive: [0, 0, 0], gain: 1,
      roughness: D.frameMat.roughness, metalness: D.frameMat.metalness, lit: true, fog: true },
    material('glass', D.glow.glass), material('ribs', D.glow.ribs), material('core', D.glow.core)],
    attachments: [...source.lanterns.map((at, i) => ({ id: `hazard.${String(i)}`, name: `king-lantern.${String(i)}`, socket: 'head', at,
      meshes: hazardMeshes.map((row, j) => ({ ...row, id: `hazard.${String(i)}.${String(j)}` })) })),
    { id: 'weakpoint', name: 'king-ribcage', socket: 'chest', at: D.ribAt,
      meshes: [{ id: 'weak.core', geometry: 'king-core', material: 'core' }, { id: 'weak.ribs', geometry: 'king-ribs', material: 'ribs' }] }],
    hazards: source.lanterns.map((_, i) => `hazard.${String(i)}`), focus: 'weakpoint', radius: D.ribR * D.ribHit,
    glow: [{ material: 'glass', gain: D.glow.glass }, { material: 'ribs', gain: D.glow.ribs }, { material: 'core', gain: D.glow.core }],
    opening: [{ part: 'weak.ribs', scale: O.ribs, breathe: [O.breathe[0], 0, O.breathe[0]], frequency: O.breathe[1] },
      { part: 'weak.core', scale: [O.core, O.core, O.core], breathe: [0, 0, 0], frequency: 0 }],
    emission: [{ material: 'core', base: O.coreGlow[0], open: O.coreGlow[1] }, { material: 'ribs', base: O.ribGlow[0], open: O.ribGlow[1] }],
  },
  encounter: NATIVE_VIEW.BOSS_ENCOUNTER, presentation: 'roaming',
  events: { hit: 'cue.king.bark', open: 'cue.king.ember.open', shut: 'cue.king.ember.shut', burst: 'cue.king.stomp', land: 'cue.king.lantern' },
  roar: 'bear_roar', landSound: 'lanternLight', colours: { tell: [1.5, .62, .12], wave: [2.6, 1.1, .3], puff: [2, 1.1, .4] },
  prewarm: [{ kind: 'elk', variant: 'thrall' }, { kind: 'boar', variant: 'thrall' }], fur: { prewarm: 8, parked: 0 },
  wall: { look: NATIVE_VIEW.KING_FX_LOOKS.fog, alpha: 'alpha', colour: 'colour', name: 'antler-king-fog-wall',
    radius: NATIVE_VIEW.KING_ARENA_FOG, bottom: 1.04, height: 22, segments: 96, lift: -2.5, order: 26, seal: .92, visible: .01, colourGain: 1.15 },
  hazard: { look: NATIVE_VIEW.KING_FX_LOOKS.flame, alpha: 'alpha', name: 'antler-king-lantern-fire', meshes: hazardMeshes,
    scale: look.KING_COAT.scale[0], flameScale: [1.3, 1.3, 1.9], order: 27, landingLift: .3, arc: 2, rotation: [1.3, 2, .4],
    alphaBase: .95, dark: .5, radius: 3.2, pulse: [.35, .15, 5], width: .2 },
  light: { colour: 0xffa040, distance: 18, decay: 1.6, playerAbove: .3, focusAbove: .5, darkness: .5,
    playerColour: [1, .72, .4], playerDistance: 16, playerGain: 16, focusColour: [1, .55, .18], focusDistance: 20, focusGain: 30, focusOpen: [.6, .8] },
  room: { density: [25, 50], fog: [.35, .55], hemi: .8, environment: .75, dome: .85, lights: .85, domeUniforms: ['uGainA', 'uGainB'] },
  puffs: { count: 3, enter: [2.5, .6, .6, .6], leave: [.5, 2.5, .6, .7], lift: 1 },
});
