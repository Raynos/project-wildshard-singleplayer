import { Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import type { NpcDef } from '@wildshard/engine/quest/core';
import { duneMesh, fit, without } from '../world/meshes';
import { SPAWN } from '../data/layout';
import { SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { STRINGS } from '../data/strings';

/** She waves while the player is this close (metres) and has not talked to her yet, as Wendell does. */
export const WAVE_RANGE = 16;
const HEIGHT = 1.7, NECK = new Vector3(0, 1.43, 0), SHOULDER = new Vector3(-0.21, 1.36, 0);

/** Sefa's lines: the first whose condition holds is what she says; her first talk is the quest's first step. */
export function scoutNpc(done: string): NpcDef {
  return { id: 'sunscar.scout', name: STRINGS.scoutName, dialogue: [
    { when: { all: [done] }, lines: [STRINGS.scoutDone] },
    { when: { all: [SCOUT_FLAG] }, lines: [STRINGS.scoutLater] },
    { lines: [STRINGS.scoutHello, STRINGS.scoutAsk, STRINGS.scoutHow], sets: [SCOUT_FLAG] },
  ] };
}

const isRightArm = (x: number, y: number): boolean => x < -0.2 && y > 0.78 && y < NECK.y + 0.02;
const isHead = (_x: number, y: number): boolean => y >= NECK.y;
/**
 * Sefa as three meshes on pivots (Wendell's way: not skinned): the body, the head at the neck and the right arm at the
 * shoulder. The figure is the generated one (loop 2: `art/sunscar-dunes/round-11-loop-2/ref-scout.jpg` → Hunyuan3D-2,
 * painted facets), 1.7 m, feet on y 0, facing +Z (her right is −X).
 */
export function scoutParts(): { root: Group; head: Group; arm: Group } | null {
  const source = duneMesh('caravan-scout'); if (source === null) return null;
  const whole = fit(source, { size: HEIGHT, by: 'height' });
  const keep = (cut: (x: number, y: number, z: number) => boolean): BufferGeometry => without(whole.clone(), cut);
  const body = keep((x, y) => isHead(x, y) || isRightArm(x, y)), head = keep((x, y) => !isHead(x, y)), arm = keep((x, y) => !isRightArm(x, y) || isHead(x, y));
  whole.dispose();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
  const root = new Group(), headPivot = new Group(), armPivot = new Group();
  headPivot.position.copy(NECK); armPivot.position.copy(SHOULDER);
  head.translate(-NECK.x, -NECK.y, -NECK.z); arm.translate(-SHOULDER.x, -SHOULDER.y, -SHOULDER.z);
  headPivot.add(new Mesh(head, material)); armPivot.add(new Mesh(arm, material));
  root.add(new Mesh(body, material), headPivot, armPivot);
  return { root, head: headPivot, arm: armPivot };
}
/** The figure at her own origin (the Model Explorer card). */
export function scoutModelGroup(): Group { return scoutParts()?.root ?? new Group(); }

export interface Scout { readonly group: Group; readonly head: Vector3; readonly speaker: { talking: boolean }; update: (dt: number, t: number, player: Vector3, talked: boolean) => void }

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Sefa in the world: she turns to face you within 12 m, waves within 16 m until you have talked, and gestures as she talks. */
export function scout(groundAt: (x: number, z: number) => number): Scout | null {
  const parts = scoutParts(); if (parts === null) return null;
  const { root, head: headPivot, arm } = parts, y = groundAt(SCOUT_AT.x, SCOUT_AT.z);
  const group = new Group(); group.add(root); group.position.set(SCOUT_AT.x, y, SCOUT_AT.z);
  const home = Math.atan2(SPAWN.x - SCOUT_AT.x, SPAWN.z - SCOUT_AT.z); group.rotation.y = home;
  const head = new Vector3(SCOUT_AT.x, y + 1.62, SCOUT_AT.z), speaker = { talking: false };
  return { group, head, speaker, update: (dt, t, player, talked) => {
    const dx = player.x - SCOUT_AT.x, dz = player.z - SCOUT_AT.z, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz), k = 1 - Math.exp(-3 * dt);
    group.rotation.y += wrap((d < 12 || speaker.talking ? toYou : home) - group.rotation.y) * k;
    headPivot.rotation.y += (Math.max(-0.7, Math.min(0.7, wrap(toYou - group.rotation.y))) * (d < 12 ? 1 : 0) - headPivot.rotation.y) * k;
    headPivot.rotation.x = speaker.talking ? Math.sin(t * 5.2) * 0.05 : Math.sin(t * 0.7) * 0.02;
    // waving: the right arm raised overhead and swinging; talking: an open-hand gesture at the chest; else at her side
    const wave = !talked && !speaker.talking && d < WAVE_RANGE;
    const z = speaker.talking ? -0.9 + Math.sin(t * 2.3) * 0.2 : wave ? -2.5 + Math.sin(t * 7) * 0.3 : 0;
    const x = speaker.talking ? -0.5 - Math.max(0, Math.sin(t * 1.7)) * 0.3 : 0;
    arm.rotation.z += (z - arm.rotation.z) * Math.min(1, dt * 8); arm.rotation.x += (x - arm.rotation.x) * Math.min(1, dt * 8);
    root.scale.y = 1 + Math.sin(t * 1.3) * 0.008;
  } };
}
