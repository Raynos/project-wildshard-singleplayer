import * as v from 'valibot';
import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { PineKingPose } from './kingPoseHost';
import { readKingCollisionBake } from './kingCollisionBake';
import { bindRangedVolumes } from './rangedVolumes';
import raw from './kingCollision.baked.json' with { type: 'json' };

const MAX_KINGS = 512; // The roster's same bounded live-body capacity, including unlisted encounter bodies.
const NEAR_SQUARED = 140 * 140; // AnimalManager's shipping custom-pose near/far boundary.
const Saved = v.strictObject({ version: v.literal(1), bodies: v.pipe(v.array(v.strictObject({ id: v.string(), pose: v.unknown() })), v.maxLength(MAX_KINGS)) });
type Body = AnimalSim & { hidden: boolean; sampleTerrain: () => void;
  foreCapsule?: (left: Vector3, right: Vector3) => boolean; ribsWorld?: (out: Vector3) => Vector3;
  publishKingHead?: () => void };
export const KING_POSE_STEP = 'pine.king.pose';

/** The roster's sole King pose owner. The body-step hook follows its moved actor; the final afterBodies callback
 * represents the ordinary render publication after equipment. Forced ribcage reads retain their separate clock. */
export function installKingPoseKeeper(host: SimHost): {
  attach: (body: Body) => void;
  retire: (id: string) => void;
} {
  const metadata = readKingCollisionBake(raw);
  const entries: { body: Body; pose: PineKingPose; near: boolean }[] = [];
  const byId = new Map<string, { body: Body; pose: PineKingPose; near: boolean }>();
  host.onStep(`${KING_POSE_STEP}.hitboxes`, () => {
    for (let i = 0; i < MAX_KINGS; i++) {
      const row = entries[i]; if (row === undefined) break;
      if (!row.body.hidden) row.pose.sampleHitboxes();
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
      if (!row.body.hidden) row.pose.publish('head');
    }
  }, {
    snapshot: () => ({ version: 1, bodies: entries.map(({ body, pose }) => ({ id: body.entityId, pose: pose.snapshot() })) }),
    restore: input => {
      const saved = v.parse(Saved, input);
      if (saved.bodies.length !== entries.length || saved.bodies.some((row, i) => row.id !== entries[i]?.body.entityId)) {
        throw new Error('Incompatible King pose roster');
      }
      const commits = saved.bodies.map((row, i) => {
        const entry = entries[i]; if (entry === undefined) throw new Error('Missing King pose owner');
        return entry.pose.prepareRestore(row.pose);
      });
      commits.forEach(commit => { commit(); });
    },
  }, 'afterBodies');
  host.scope.onDispose(() => { entries.length = 0; byId.clear(); });
  return {
    attach: body => {
      if (entries.length >= MAX_KINGS || byId.has(body.entityId)) throw new Error('King pose roster is full or duplicated');
      const pose = new PineKingPose(body, metadata);
      body.bindVolumes({ entityId: body.entityId,
        headWorld: out => { pose.query.head(out); },
        bodyCapsule: (rear, front) => { pose.query.body(rear, front); },
        foreCapsule: (left, right) => { pose.query.fore(left, right); return true; } });
      bindRangedVolumes(body, {
        headWorld: out => pose.hits.head(out),
        bodyCapsule: (rear, front) => { pose.hits.body(rear, front); },
        foreCapsule: (left, right) => { pose.hits.fore(left, right); return true; },
      });
      const entry = { body, pose, near: false };
      entries.push(entry); byId.set(body.entityId, entry);
      body.ribsWorld = out => pose.ribs(out);
      body.publishKingHead = () => { pose.publish('head'); };
      body.sampleTerrain = () => { pose.sampleTerrain(); };
    },
    retire: id => {
      const index = entries.findIndex(row => row.body.entityId === id);
      if (index !== -1) entries.splice(index, 1);
      byId.delete(id);
    },
  };
}
