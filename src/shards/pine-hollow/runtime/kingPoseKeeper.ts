import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '@wildshard/game/plugin/animation';
import { advanceKingPose, newPose, type KingPose, type KingPoseRest } from '../combat/kingRig';
import { readKingCollisionBake } from './kingCollisionBake';
import { bindNativeRangedVolumes } from '@wildshard/game/plugin/nativeItems';
import raw from '../data/kingCollision.generated.json' with { type: 'json' };

const MAX_KINGS = 512; // The roster's same bounded live-body capacity, including unlisted encounter bodies.
const NEAR_SQUARED = 140 * 140; // AnimalManager's shipping custom-pose near/far boundary.
const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const HitsWire = v.pipe(v.array(finite), v.length(15));
/** SF72's first wire (the retired scalar owner): read only what converts; its cached query clock re-publishes from the staged pose. */
const Legacy = v.object({ version: v.literal(1), timers: v.pipe(v.string(), v.maxLength(8192)),
  query: v.object({ staged: v.record(v.string(), finite) }),
  hits: v.object({ published: v.object({ head: triple, rear: triple, front: triple, left: triple, right: triple }) }) });
const Saved = v.union([
  v.strictObject({ version: v.literal(1), bodies: v.pipe(v.array(v.strictObject({ id: v.string(), pose: Legacy })), v.maxLength(MAX_KINGS)) }),
  v.strictObject({ version: v.literal(2), bodies: v.pipe(v.array(v.strictObject({ id: v.string(), pose: v.string(), hits: HitsWire })), v.maxLength(MAX_KINGS)) }),
]);
type Body = AnimalSim & { hidden: boolean; sampleTerrain: () => void;
  foreCapsule?: (left: Vector3, right: Vector3) => boolean; ribsWorld?: (out: Vector3) => Vector3;
  publishKingHead?: () => void };
interface Hits { readonly head: Vector3; readonly rear: Vector3; readonly front: Vector3; readonly left: Vector3; readonly right: Vector3 }
interface Entry { body: Body; pose: NativeCreaturePose; hits: Hits; near: boolean }
const wire = ({ head, rear, front, left, right }: Hits): number[] => [...head, ...rear, ...front, ...left, ...right];
export const KING_POSE_STEP = 'pine.king.pose';

/** Write the scalar pose onto the four collision joints (rest translation plus the root's lift, YXZ angles). */
function placeJoints(bones: NativeCreaturePose['bones'], rest: readonly [number, number, number], p: KingPose): void {
  const { body, chest, neck, head } = bones;
  if (body === undefined || chest === undefined || neck === undefined || head === undefined) throw new Error('Missing King pose joint');
  body.position.set(rest[0], rest[1] + p.rootY, rest[2] + p.rootZ); body.rotation.set(p.rootPitch, p.rootYaw, p.rootRoll);
  chest.rotation.set(p.chestPitch, p.chestYaw, p.chestRoll); neck.rotation.set(p.neckPitch, p.neckYaw, 0);
  head.rotation.set(p.headPitch, p.headYaw, p.headRoll);
}

/** The roster's sole King pose owner, on the shared NativeCreaturePose: the custom callback runs the King's scalar blend
 * onto his four baked collision joints. The body-step hook follows its moved actor; the final afterBodies callback is the
 * ordinary render publication; a forced ribcage read publishes only the root/chest chain; ranged volumes read the
 * contacts sampled at the start of the step. */
export function installKingPoseKeeper(host: SimHost): {
  attach: (body: Body) => void;
  retire: (id: string) => void;
} {
  const bake = readKingCollisionBake(raw), rest: KingPoseRest = bake.rest, ribs = bake.volumes.ribs;
  const rootRest = bake.joints[0].position;
  const joint = (name: string, row: { parent: number; position: readonly [number, number, number] }): NativeCreaturePoseRecipe['joints'][number] =>
    ({ name, parent: row.parent, position: row.position, order: 'YXZ', scale: [1, 1, 1] });
  const [rootRow, chestRow, neckRow, headRow] = bake.joints;
  const recipe: NativeCreaturePoseRecipe = { custom: true,
    joints: [joint('body', rootRow), joint('chest', chestRow), joint('neck', neckRow), joint('head', headRow)] };
  const entries: Entry[] = [];
  const byId = new Map<string, Entry>();
  const sample = (row: Entry): void => {
    const { head, rear, front, left, right } = row.hits;
    row.pose.headWorld(head); row.pose.bodyCapsule(rear, front); row.pose.foreCapsule(left, right);
  };
  const restore = (saved: v.InferOutput<typeof Saved>): void => {
    for (let i = 0; i < MAX_KINGS; i++) {
      const entry = entries[i]; if (entry === undefined) break;
      if (saved.version === 2) {
        const row = saved.bodies[i]; if (row === undefined) break;
        entry.pose.restore(row.pose);
        const { head, rear, front, left, right } = entry.hits;
        head.fromArray(row.hits, 0); rear.fromArray(row.hits, 3); front.fromArray(row.hits, 6); left.fromArray(row.hits, 9); right.fromArray(row.hits, 12);
        continue;
      }
      const legacy = saved.bodies[i]?.pose; if (legacy === undefined) break;
      placeJoints(entry.pose.bones, rootRest, Object.assign(newPose(), legacy.query.staged));
      entry.pose.adopt({ pose: legacy.timers });
      const was = legacy.hits.published, hits = entry.hits;
      hits.head.fromArray(was.head); hits.rear.fromArray(was.rear); hits.front.fromArray(was.front);
      hits.left.fromArray(was.left); hits.right.fromArray(was.right);
    }
  };
  host.onStep(`${KING_POSE_STEP}.hitboxes`, () => {
    for (let i = 0; i < MAX_KINGS; i++) {
      const row = entries[i]; if (row === undefined) break;
      if (!row.body.hidden) sample(row);
    }
  });
  host.useBodyStep({ before: (id, body) => {
    const entry = byId.get(id);
    if (entry?.body === body) entry.near = body.position.distanceToSquared(host.player.position) < NEAR_SQUARED;
  }, after: (id, body, dt) => {
    const entry = byId.get(id);
    if (entry === undefined || entry.body !== body || body.harnessHold || entry.body.hidden) return;
    // The manager chooses the animation band before a.update moves the actor, not from its later position.
    entry.pose.advance(dt, host.clock.now, entry.near);
  } });
  host.onStep(KING_POSE_STEP, () => {
    for (let i = 0; i < MAX_KINGS; i++) {
      const row = entries[i]; if (row === undefined) break;
      if (!row.body.hidden) row.pose.publish();
    }
  }, {
    snapshot: () => ({ version: 2, bodies: entries.map(({ body, pose, hits }) =>
      ({ id: body.entityId, pose: pose.snapshot(), hits: wire(hits) })) }),
    restore: input => {
      const saved = v.parse(Saved, input);
      if (saved.bodies.length !== entries.length || saved.bodies.some((row, i) => row.id !== entries[i]?.body.entityId)) {
        throw new Error('Incompatible King pose roster');
      }
      // Atomic across the roster: a refused King rolls every King back to its live state.
      const backup = { version: 2 as const, bodies: entries.map(({ body, pose, hits }) =>
        ({ id: body.entityId, pose: pose.snapshot(), hits: wire(hits) })) };
      try { restore(saved); } catch (error) { restore(backup); throw error; }
    },
  }, 'afterBodies');
  host.scope.onDispose(() => { entries.length = 0; byId.clear(); });
  return {
    attach: body => {
      if (entries.length >= MAX_KINGS || byId.has(body.entityId)) throw new Error('King pose roster is full or duplicated');
      const staged = newPose();
      const pose = new NativeCreaturePose(body, recipe, c => {
        advanceKingPose(c, rest, staged); placeJoints(c.bones, rootRest, staged);
      });
      body.sampleTerrain = () => { pose.sampleTerrain(); };
      body.sampleTerrain(); pose.publish();
      const entry: Entry = { body, pose, hits: { head: new Vector3(), rear: new Vector3(), front: new Vector3(), left: new Vector3(), right: new Vector3() }, near: false };
      sample(entry);
      body.bindVolumes(pose);
      bindNativeRangedVolumes(host, body.entityId, entry.hits);
      entries.push(entry); byId.set(body.entityId, entry);
      body.ribsWorld = out => { pose.publish('chest'); return pose.jointPoint('chest', ribs, out); };
      body.publishKingHead = () => { pose.publish(); };
    },
    retire: id => {
      const index = entries.findIndex(row => row.body.entityId === id);
      if (index !== -1) entries.splice(index, 1);
      byId.delete(id);
    },
  };
}
