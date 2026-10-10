import { Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import type { LevelContext } from '@wildshard/engine/level/context';
import { boxDesc } from '@wildshard/engine/world/registry';
import { fitGeometry, withoutTriangles } from '../systems/looks/modelLibrary';
import type { NpcRow } from './npcRow';

/**
 * A pivot NPC's figure (SF27): the row's model (`source`) fitted to its height, split into three meshes on pivots — the
 * body, the head at the neck and the arm at the shoulder — in one vertex-coloured standard material. Feet on y 0,
 * facing +Z, at its own origin (the Model Explorer card shows it so).
 */
export function pivotNpcParts(row: NpcRow, source: BufferGeometry): { root: Group; head: Group; arm: Group } {
  const fig = row.figure, [nx, ny, nz] = fig.neck, [sx, sy, sz] = fig.shoulder;
  const isArm = (x: number, y: number): boolean => x < fig.armBelowX && y > fig.armAboveY && y < ny + 0.02;
  const isHead = (_x: number, y: number): boolean => y >= ny;
  const whole = fitGeometry(source, { size: fig.height, by: 'height' });
  const keep = (cut: (x: number, y: number, z: number) => boolean): BufferGeometry => withoutTriangles(whole.clone(), cut);
  const body = keep((x, y) => isHead(x, y) || isArm(x, y)), head = keep((x, y) => !isHead(x, y)), arm = keep((x, y) => !isArm(x, y) || isHead(x, y));
  whole.dispose();
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: fig.roughness, metalness: 0, flatShading: fig.flat });
  const root = new Group(), headPivot = new Group(), armPivot = new Group();
  headPivot.position.set(nx, ny, nz); armPivot.position.set(sx, sy, sz);
  head.translate(-nx, -ny, -nz); arm.translate(-sx, -sy, -sz);
  headPivot.add(new Mesh(head, material)); armPivot.add(new Mesh(arm, material));
  root.add(new Mesh(body, material), headPivot, armPivot);
  return { root, head: headPivot, arm: armPivot };
}

/** A pivot NPC in the world: its group, its head (the talk prompt's anchor), its speaker and its per-frame motion. */
export interface PivotNpc { readonly group: Group; readonly head: Vector3; readonly speaker: { talking: boolean }; update: (dt: number, t: number, player: Vector3, met: boolean) => void }

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * The row's NPC standing on the ground: it turns to face the player within `faceRange` (else back to `faceHome`), its
 * head follows within ±0.7 rad, it waves within `waveRange` until met, gestures with an open hand as it talks and
 * breathes.
 */
export function pivotNpc(row: NpcRow, source: BufferGeometry, groundAt: (x: number, z: number) => number): PivotNpc {
  const { root, head: headPivot, arm } = pivotNpcParts(row, source), { x: ax, z: az } = row.at, y = groundAt(ax, az);
  const group = new Group(); group.add(root); group.position.set(ax, y, az);
  const home = Math.atan2(row.faceHome.x - ax, row.faceHome.z - az); group.rotation.y = home;
  const head = new Vector3(ax, y + row.talkHeight, az), speaker = { talking: false };
  return { group, head, speaker, update: (dt, t, player, met) => {
    const dx = player.x - ax, dz = player.z - az, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz), k = 1 - Math.exp(-3 * dt);
    group.rotation.y += wrap((d < row.faceRange || speaker.talking ? toYou : home) - group.rotation.y) * k;
    headPivot.rotation.y += (Math.max(-0.7, Math.min(0.7, wrap(toYou - group.rotation.y))) * (d < row.faceRange ? 1 : 0) - headPivot.rotation.y) * k;
    headPivot.rotation.x = speaker.talking ? Math.sin(t * 5.2) * 0.05 : Math.sin(t * 0.7) * 0.02;
    // waving: the arm raised overhead and swinging; talking: an open-hand gesture at the chest; else at the side
    const wave = !met && !speaker.talking && d < row.waveRange;
    const z = speaker.talking ? -0.9 + Math.sin(t * 2.3) * 0.2 : wave ? -2.5 + Math.sin(t * 7) * 0.3 : 0;
    const x = speaker.talking ? -0.5 - Math.max(0, Math.sin(t * 1.7)) * 0.3 : 0;
    arm.rotation.z += (z - arm.rotation.z) * Math.min(1, dt * 8); arm.rotation.x += (x - arm.rotation.x) * Math.min(1, dt * 8);
    root.scale.y = 1 + Math.sin(t * 1.3) * 0.008;
  } };
}

/** What `installPivotNpc` is lent: the model, the ground, the player, its met flag's reader, the piece's source file and the shard's dressing of the figure. */
export interface PivotNpcPorts {
  readonly source: BufferGeometry;
  readonly groundAt: (x: number, z: number) => number;
  readonly player: Vector3;
  readonly met: () => boolean;
  /** the authored file the piece names (the Model Explorer and the physics bake list it) */
  readonly file: string;
  /** the shard's look on the figure (its light rim, resource ownership) */
  readonly dress?: (group: Group) => void;
}
/**
 * Installs the row's NPC in a level: the figure under the level root, a solid column piece round it (it turns in place,
 * so the box stays square), and its motion each frame.
 */
export function installPivotNpc(ctx: Pick<LevelContext, 'root' | 'piece' | 'system'>, row: NpcRow, ports: PivotNpcPorts): PivotNpc {
  const npc = pivotNpc(row, ports.source, ports.groundAt), c = row.collider, y = npc.group.position.y;
  ctx.root.add(npc.group); ports.dress?.(npc.group);
  ctx.piece({ id: row.id, name: row.name, category: 'props', file: ports.file, object: npc.group,
    colliders: [boxDesc({ x: row.at.x, z: row.at.z, hw: c.half, hd: c.half, rot: 0, yBottom: y - c.below, yTop: y + c.above }, c.surface)], surface: c.surface });
  ctx.system({ id: row.id, phase: 'update', run: (dt, t) => { npc.update(dt, t, ports.player, ports.met()); } });
  return npc;
}
