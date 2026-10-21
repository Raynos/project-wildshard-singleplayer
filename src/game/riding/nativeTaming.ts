import { Vector3 } from 'three';
import * as v from 'valibot';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import { pickPrompt, setPromptSight } from '@wildshard/engine/world/interact/prompts';
import { nativeHerdCollection } from '../shardfile/groupRuntime';
import { bondedMountRoster } from './roster';
import { mountedPlayerOf } from './native';
import { TamingBinding } from './binding';
import type { TamingBindingProfile, TamingObservation } from './bindingTypes';
import type { TamingPrograms } from './taming';
import { createNativeCreaturePoses, type NativeCreaturePoseRecipe } from '../plugin/animation';
import { numericCreaturePose } from '../plugin/channelPrograms';
import { poseRidingEnvelopes, type RidingPresentationRows } from './presentation';

/** Engine-owned tick input, shared by native modes; authors supply only rows. */
export interface NativeTamingContext {
  commands: () => readonly ({ kind: 'player'; steer?: { keyX: number } } | { kind: 'script'; actorId: string; value: number } | { kind: 'action' })[];
}
export interface NativeTamingRows {
  step: string; herds: string; roster: string; kinds: readonly string[]; programs: TamingPrograms; binding: TamingBindingProfile;
  poses: readonly { kind: string; variant: string; pose: NativeCreaturePoseRecipe }[];
  presentation: RidingPresentationRows; poseProgram: unknown;
  inputs: { offer: string; lean: string; pitch: string; mount: string };
  rest: { x: number; z: number; face: { x: number; z: number } }; rail: { x: number; z: number };
  eye: number; impactRange: number; scareRange: number; scareSeconds: number; thrownLabel: string;
}
/** Native observations and actions expose no per-shard hooks or callback ports. */
export interface NativeTamingOwner {
  readonly phase: 'wild' | 'breaking' | 'bonded'; readonly companion: AnimalSim | null; readonly upgraded: boolean;
  readonly promptHorse: AnimalSim | null; readonly view: TamingObservation;
  readonly interactable: { position: Vector3; radius: number; label: string; onInteract: () => void };
  update: (dt: number) => void; snapshot: () => string; noteEvent: (name: string, x: number, z: number) => void;
  noteShot: (x: number, z: number) => void;
}
const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1), law: v.string(), bond: v.nullable(v.string()),
  pitch: v.pipe(finite, v.minValue(-Math.PI / 2), v.maxValue(Math.PI / 2)), shake: finite, roll: finite,
  poses: v.pipe(v.array(v.tuple([v.string(), v.string()])), v.maxLength(64)) });
const installed = new WeakMap<SimHost, NativeTamingOwner>();
/** Read only this host's live taming law; no global ride singleton or reward override. */
export function nativeTamingOf(host: SimHost): NativeTamingOwner | undefined { return installed.get(host); }

/** Install native's actual approach/bucking/adoption law after its dynamic roster and native mounted owner.
 * Tick inputs: script riding.taming.offer=0|1, riding.taming.lean=-1..1, riding.look.pitch=-pi/2..pi/2,
 * riding.taming.mount=1. Mount answers the live native prompt with actual reach and WORLD/body sight.
 * The creature manager calls update after Wildlife, BEFORE raid and think. Only this law's owned clocks are saved here.
 */
export function installNativeTaming(host: SimHost, context: NativeTamingContext, rows: NativeTamingRows): NativeTamingOwner {
  const { herds, wind } = nativeHerdCollection(host, rows.herds), creatures = bondedMountRoster(host, rows.roster), mounted = mountedPlayerOf(host);
  if (mounted === undefined) throw new Error('Missing native mounted owner');
  const draw = numericCreaturePose(rows.poseProgram);
  if (installed.has(host)) throw new Error('native taming already installed');
  let bond: string | null = null, pitch = 0, offer = false, lean = 0, shake = 0, roll = 0;
  const camera = new Vector3(), eye = new Vector3(), hurtDir = new Vector3();
  const poses = createNativeCreaturePoses(rows.poses, 64), poseRows: AnimalSim[] = [];
  const addPose = (a: AnimalSim): void => {
    if (poseRows.length >= 64 || poses.get(a.entityId) !== undefined || !rows.kinds.includes(a.kind)) throw new Error('Invalid native taming pose roster');
    poses.binding.preflight(a); poses.binding.attach(a, { id: a.entityId, kind: a.kind, variant: a.variant });
    const pose = poses.get(a.entityId); if (pose === undefined) throw new Error('Missing taming pose'); pose.publish(); poseRows.push(a);
    a.headWorld = out => { pose.headWorld(out); return out; };
    // Manager samples pose terrain before its own decision, never at a second independent clock.
    const managed = creatures.actors.find(body => body === a); if (managed === undefined) throw new Error('Foreign native taming body');
    managed.sampleTerrain = () => { pose.sampleTerrain(); };
  };
  if (creatures.actors.length > 64) throw new Error('native taming body bound exceeded');
  for (let i = 0; i < 64; i++) { const a = creatures.actors[i]; if (a === undefined) break; if (rows.kinds.includes(a.kind)) addPose(a); }
  const law = new TamingBinding<AnimalSim, HerdBrain<AnimalSim>>({
    profile: rows.binding,
    programs: rows.programs,
    bond: { read: () => null, write: value => { if (!rows.binding.bonds.includes(value)) throw new Error('Invalid native bond'); bond = value; } },
    player: { position: host.player.position, get crouching() { return mounted.rider.crouching; },
      get yaw() { return host.player.yaw; }, set yaw(value) { host.player.yaw = value; }, get pitch() { return pitch; }, set pitch(value) { pitch = value; },
      keys: new Set<string>(), camera: { position: camera, getWorldDirection: out => out.set(-Math.sin(host.player.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(host.player.yaw) * Math.cos(pitch)) } },
    mount: { get mounted() { return mounted.mounted; }, get horse() { return mounted.horse; },
      get breakShake() { return shake; }, set breakShake(value) { shake = value; }, get breakRoll() { return roll; }, set breakRoll(value) { roll = value; },
      mount: (a, breaking) => mounted.mount(a.entityId, breaking), dismount: thrown => { mounted.dismount(thrown); },
      addMountable: a => { mounted.addMountable(a.entityId); }, removeMountable: a => { mounted.removeMountable(a.entityId); } },
    hud: { get offer() { return offer; }, get lean() { return lean; } }, herds: () => herds, rest: rows.rest,
    wind: () => wind, random: () => host.rng.stream('ai').next(),
    spawnBonded: (x, z, yaw, upgraded) => { const a = creatures.spawn(x, z, yaw, upgraded); addPose(a); return a; },
    hideStallion: a => { creatures.hide(a.entityId); }, retireBonded: a => {
      creatures.retire(a.entityId); poses.delete(a.entityId);
      const at = poseRows.indexOf(a); if (at === -1) throw new Error('Missing bonded pose'); poseRows.splice(at, 1);
    }, hurt: amount => {
      host.combat.hit({ source: 'env', sourceTags: ['env.ride'], target: host.player.health, amount, throughWalls: true,
        point: host.player.position, dir: hurtDir, cause: { kind: 'env.ride', label: rows.thrownLabel, text: rows.thrownLabel } });
    },
  });
  host.events.on('creature.signal', ({ name, x, z }) => { law.noteEvent(name, x, z); }, host.scope);
  host.events.on('weapon.impact', ({ point }) => {
    // Same state.ts filter: only a distant landing, not an arm's-length melee impact.
    if (Math.hypot(point.x - host.player.position.x, point.z - host.player.position.z) < rows.impactRange) return;
    for (let i = 0; i < 8; i++) { const h = herds[i]; if (h === undefined) break; h.disturb(point.x, point.z); }
    for (let i = 0; i < 16; i++) { const f = creatures.flocks[i]; if (f === undefined) break; if (Math.hypot(f.cx - point.x, f.cz - point.z) < rows.scareRange) f.scare(point.x, point.z, rows.scareSeconds); }
    law.noteShot(point.x, point.z);
  }, host.scope);
  const candidates = [law.interactable], namePoint = new Vector3();
  // ride.ts chooses among registered mounts, taming, then the nearest rail NAME action, before main's LOS selector.
  // Companion whistle/resting and the global quest prompt list stay explicit unhosted gameplay requirements.
  const selectedTaming = (): boolean => {
    if (mounted.mountables.length > 64) throw new Error('native mountable prompt bound exceeded');
    let best = Infinity, taming = false, naming: AnimalSim | null = null, nameDistance = Infinity;
    for (let i = 0; i < 64; i++) {
      const a = mounted.mountables[i]; if (a === undefined) break;
      const d = a.position.distanceTo(camera), radius = mounted.horse === a ? 3.6 : 3.3;
      if (d < radius && d < best) { best = d; taming = false; }
      if (!mounted.mounted && a.alive && Math.hypot(a.position.x - rows.rail.x, a.position.z - rows.rail.z) <= 5) {
        const foot = Math.hypot(a.position.x - host.player.position.x, a.position.z - host.player.position.z);
        if (foot < nameDistance) { nameDistance = foot; naming = a; }
      }
    }
    const distance = law.interactable.position.distanceTo(camera);
    if (distance < law.interactable.radius && distance < best) { best = distance; taming = true; }
    if (naming !== null) {
      const x = naming.position.x + Math.sin(naming.yaw) * 1.15 * naming.scale, z = naming.position.z + Math.cos(naming.yaw) * 1.15 * naming.scale;
      namePoint.set(x, host.groundHeightAt(x, z) + 1.5, z);
      const d = namePoint.distanceTo(camera); if (d < 1.9 && d < best) taming = false;
    }
    return taming;
  };
  const originalUpdate = law.update.bind(law), invalidInput = new Error('Invalid native taming input');
  law.update = dt => {
    offer = false; lean = 0; let mount = false;
    const commands = context.commands(); if (commands.length > 4096) throw invalidInput;
    for (let i = 0; i < 4096; i++) {
      const c = commands[i]; if (c === undefined) break;
      if (c.kind === 'player') lean = c.steer?.keyX ?? 0;
      else if (c.kind === 'script') {
        if (c.actorId === rows.inputs.offer) { if (c.value !== 0 && c.value !== 1) throw invalidInput; offer = c.value === 1; }
        else if (c.actorId === rows.inputs.lean) { if (!Number.isFinite(c.value) || Math.abs(c.value) > 1) throw invalidInput; lean = c.value; }
        else if (c.actorId === rows.inputs.pitch) { if (!Number.isFinite(c.value) || Math.abs(c.value) > Math.PI / 2) throw invalidInput; pitch = c.value; }
        else if (c.actorId === rows.inputs.mount) { if (c.value !== 1) throw invalidInput; mount = true; }
      }
    }
    camera.copy(host.player.position); camera.y += rows.eye;
    originalUpdate(dt);
    if (mount && selectedTaming()) {
      setPromptSight(law.interactable, { body: law.promptHorse, slack: 0.5 });
      eye.copy(camera);
      if (pickPrompt(candidates, eye, host.physics) === law.interactable) law.startBreaking();
    }
  };
  const missingPose = new Error('Missing native taming pose');
  host.onStep(rows.step, () => {
    for (let i = 0; i < 64; i++) {
      const row = poseRows[i]; if (row === undefined) break;
      const pose = poses.get(row.entityId); if (pose === undefined) throw missingPose;
      const bodyDt = host.bodyDt(row.entityId); if (bodyDt <= 0) continue;
      const near = row.position.distanceToSquared(host.player.position) < 140 * 140;
      pose.advance(bodyDt, host.clock.now, near); if (near) { poseRidingEnvelopes(pose.context, rows.presentation, wind); draw(pose.context); } pose.publish();
    }
  }, {
    snapshot: (): SimValue => ({ version: 1, law: law.snapshot(), bond, pitch, shake, roll, poses: poseRows.map(actor => { const pose = poses.get(actor.entityId); if (pose === undefined) throw missingPose; return [actor.entityId, pose.snapshot('local')]; }) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      if (saved.poses.length !== poseRows.length || new Set(saved.poses.map(([id]) => id)).size !== poseRows.length) throw new Error('Invalid native taming pose identities');
      for (let i = 0; i < 64; i++) { const row = saved.poses[i]; if (row === undefined) break; const [id, wire] = row; const pose = poses.get(id); if (pose === undefined) throw missingPose; pose.restore(wire); }
      law.restore(saved.law, creatures.actors.filter(a => rows.kinds.includes(a.kind)));
      bond = saved.bond; pitch = saved.pitch; shake = saved.shake; roll = saved.roll;
    },
  }, 'afterBodies');
  host.scope.onDispose(() => { for (let i = 0; i < 64; i++) { const actor = poseRows[i]; if (actor === undefined) break; poses.delete(actor.entityId); } poseRows.length = 0; installed.delete(host); });
  installed.set(host, law); return law;
}
