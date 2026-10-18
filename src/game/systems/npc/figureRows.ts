/** Client-only figure presentation; story decisions remain outside this host. */
import * as THREE from 'three';
import * as v from 'valibot';
import { bindRig } from '@wildshard/engine/anim/rig';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import { FigureRowSchema, type FigureRow, type FigureSkinRow } from '@wildshard/format/figures';
import type { ScenePointRef } from '@wildshard/format/sceneRefs';
import type { SceneHandles } from '../../shardfile/sceneHandles';
import { FigureSkins } from './figureSkins';
import { standingFigure, type FigureSkinState } from './standingFigure';

const skins = new FigureSkins();
function sourceId(ref: ScenePointRef): string {
  if (!('part' in ref)) throw new Error('Figure object requires a scene part');
  return ref.part;
}
function anchorColliders(box: FigureRow['collider']): readonly ColliderDesc[] {
  return box === undefined ? [] : box.kind === 'box' ? [{ kind: 'box', x: 0, y: (box.top - box.bottom) / 2,
    z: 0, hx: box.half, hy: (box.top + box.bottom) / 2, hz: box.half }] : [{ ...box, x: 0, z: 0 }];
}

/** Rows name resources; this owner publishes roots, prompts, joints and sockets.
 * Geometry/material handles are borrowed. Per-instance skeletons and attachment
 * geometry belong to the figure. `resources` is its publication namespace.
 * Eviction cancels late skin publication.
 */
export class FigureRows {
  /** Loading-screen intake shares immutable sources with subsequent instances. */
  static async prepareSkins(rows: readonly FigureSkinRow[]): Promise<void> { await Promise.all(rows.map(row => skins.load(row))); }
  /** The same data anchors are usable by the model registry before a draw exists. */
  static collidersFor(input: unknown): readonly ColliderDesc[] { return anchorColliders(v.parse(FigureRowSchema, input).collider); }
  readonly group: THREE.Group;
  readonly talkPoint = new THREE.Vector3();
  readonly collider: BoxSpec;
  readonly colliders: readonly ColliderDesc[];
  readonly ready: Promise<void>;
  talking = false;
  private live = true;
  private readonly publications = new Map<string, THREE.Object3D | THREE.Vector3>();
  private readonly draws: THREE.Object3D[];
  private readonly row: FigureRow;
  private readonly person: ReturnType<typeof standingFigure> | undefined;
  private readonly skinState: FigureSkinState = { pending: null, owned: [] };

  constructor(readonly resources: SceneHandles, input: unknown, owner: Scope = resourceScope()) {
    if (owner.disposed) throw new Error('Figure owner is disposed');
    const row = v.parse(FigureRowSchema, input); this.row = row;
    const ids = [`${row.id}.root`, `${row.id}.prompt`, ...row.joints.map(joint => joint.id), ...row.sockets.map(socket => socket.id)];
    if (new Set(ids).size !== ids.length || ids.some(id => resources.has(id))) throw new Error('Duplicate figure publication');
    this.group = row.root === undefined ? new THREE.Group() : resources.group(sourceId(row.root));
    if (row.root === undefined) { this.group.name = row.name; this.group.position.fromArray(row.feet); this.group.rotation.y = row.yaw; }
    const p = this.group.position, box = row.collider;
    this.collider = { x: p.x, z: p.z, hw: box?.kind === 'box' ? box.half : 0, hd: box?.kind === 'box' ? box.half : 0,
      rot: 0, yTop: p.y + (box?.kind === 'box' ? box.top : 0), yBottom: p.y - (box?.kind === 'box' ? box.bottom : 0) };
    this.colliders = anchorColliders(box);
    this.draws = row.visible.map(ref => resources.object(sourceId(ref)));
    const joints = row.joints.flatMap(joint => 'source' in joint ? [{ id: joint.id, object: resources.object(sourceId(joint.source)) }] : []);
    const replacement = row.replacement === undefined ? undefined : {
      target: resources.mesh(sourceId(row.replacement.target)), source: resources.geometry(row.replacement.geometry),
    };
    if (row.fallback !== undefined) {
      if (row.motion === undefined) throw new Error('Standing figure requires motion rows');
      const f = row.fallback; resources.geometry(f.geometry); resources.material(f.material); resources.material(f.glow);
      if (f.glass !== null) resources.geometry(f.glass);
    }
    if (row.skin !== undefined && row.fallback === undefined) throw new Error('Baked skin requires a standing fallback');
    if (row.skin === undefined && row.joints.some(joint => 'bone' in joint)) throw new Error('Baked joint requires a skin');
    const pivotSockets = row.skin !== undefined ? [] : row.sockets.map(socket => ({ id: socket.id,
      object: joints.find(joint => joint.id === socket.joint)?.object ?? resources.object(socket.joint) }));
    bindRig(this.group, [], row.rig, { skeleton: row.rig.skeleton, procedural: row.rig.clips });
    this.publish(`${row.id}.root`, this.group); this.publish(`${row.id}.prompt`, this.talkPoint);
    for (const joint of joints) this.publish(joint.id, joint.object);
    for (const socket of pivotSockets) this.publish(socket.id, socket.object);
    this.person = row.fallback === undefined ? undefined : standingFigure(this.group, resources, row, this.skinState);
    this.refreshPoint();
    owner.onDispose(() => { this.dispose(); });
    this.ready = (async () => {
      try {
      if (replacement !== undefined) {
        await Promise.resolve();
        if (!this.live) return;
        const geometry = replacement.source.clone();
        replacement.target.geometry.dispose(); replacement.target.geometry = geometry; this.skinState.owned.push(geometry);
      }
      if (row.skin === undefined) return;
      await skins.load(row.skin);
      if (!this.live) return;
      const rig = skins.rig(row.skin, resources.sky);
      if (rig === null) throw new Error('Baked figure skin was not prepared');
      this.skinState.pending = rig; this.skinState.owned.push(rig.mesh.skeleton);
      for (const joint of row.joints) if ('bone' in joint) {
        const bone = rig.mesh.skeleton.bones.find(candidate => candidate.name === joint.bone);
        if (bone === undefined) throw new Error(`Missing figure joint: ${joint.bone}`);
        this.publish(joint.id, bone);
      }
      for (const socket of row.sockets) {
        const joint = rig.mesh.skeleton.bones.find(bone => bone.name === socket.joint);
        if (joint === undefined) throw new Error(`Missing figure socket: ${socket.joint}`);
        this.publish(socket.id, joint);
      }
      } catch (error: unknown) { this.dispose(); throw error; }
    })();
  }
  private publish(id: string, object: THREE.Object3D | THREE.Vector3): void {
    this.resources.publish(id, object); this.publications.set(id, object);
  }
  private refreshPoint(): void {
    this.group.updateWorldMatrix(true, false);
    this.talkPoint.set(0, this.row.talkHeight, 0).applyMatrix4(this.group.matrixWorld);
  }
  /** Refresh a borrowed pivot figure's world prompt without advancing its law. */
  syncAnchors(): void { if (this.live) this.refreshPoint(); }
  headWorld(out: THREE.Vector3): THREE.Vector3 { this.refreshPoint(); return out.copy(this.talkPoint); }
  get active(): boolean { return this.live; }
  /** Walking updates the same collider and prompt objects read by the quest. */
  walkTo(x: number, y: number, z: number): void { if (this.live) this.person?.walkTo(x, y, z); }
  lod(distance: number): void {
    if (!this.live) return;
    if (this.person !== undefined) this.person.lod(distance);
    else for (const draw of this.draws) draw.visible = distance < this.row.drawDistance;
  }
  update(dt: number, t: number, player: THREE.Vector3): void {
    if (!this.live) return;
    if (this.person !== undefined) {
      this.person.talking = this.talking; this.person.update(dt, t, player);
      this.talkPoint.copy(this.person.talkPoint); Object.assign(this.collider, this.person.collider);
    } else this.refreshPoint();
  }
  /** Late loads cannot attach or publish into an evicted scene. */
  dispose(): void {
    if (!this.live) return;
    this.live = false; this.skinState.pending = null;
    for (const [id, object] of this.publications) this.resources.release(id, object);
    this.publications.clear();
    for (const owned of this.skinState.owned) owned.dispose(); this.skinState.owned.length = 0;
  }
}
