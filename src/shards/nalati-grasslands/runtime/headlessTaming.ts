import { Vector3 } from 'three';
import * as v from 'valibot';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HeadlessRuntimeInstallation } from '@wildshard/sdk/headlessRuntime';
import { pickPrompt, setPromptSight } from '@wildshard/engine/world/interact/prompts';
import type { NalatiGroups } from './groups';
import type { NalatiHostCreatures } from './headlessCreatures';
import type { NalatiMountedPlayer } from './headlessMounted';
import { NalatiTamingLaw } from './tamingLaw';
import { NalatiTamingHorsePose } from './tamingHorsePose';
import { HITCHING_RAIL } from '../world/layout';
import type { WildEnv } from '../creatures/env';

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1), law: v.string(), bond: v.nullable(v.picklist(['1', 'argymaq'])),
  pitch: v.pipe(finite, v.minValue(-Math.PI / 2), v.maxValue(Math.PI / 2)), shake: finite, roll: finite,
  poses: v.pipe(v.array(v.tuple([v.string(), v.string()])), v.maxLength(64)) });
const installed = new WeakMap<SimHost, NalatiTamingLaw<AnimalSim, NalatiGroups['herds'][number]>>();
/** Read only this host's live taming law; no global ride singleton or reward override. */
export function nalatiTamingOf(host: SimHost): NalatiTamingLaw<AnimalSim, NalatiGroups['herds'][number]> | undefined { return installed.get(host); }

/** Install Nalati's actual approach/bucking/adoption law after its dynamic roster and native mounted owner.
 * Tick inputs: script nalati.taming.offer=0|1, nalati.taming.lean=-1..1, nalati.look.pitch=-pi/2..pi/2,
 * nalati.taming.mount=1. Mount answers the live native prompt with actual reach and WORLD/body sight.
 * The creature manager calls update after Wildlife, BEFORE raid and think. Only this law's owned clocks are saved here.
 */
export function installNalatiTaming(host: SimHost, ports: {
  readonly groups: NalatiGroups; readonly creatures: NalatiHostCreatures; readonly mounted: NalatiMountedPlayer;
  readonly environment: WildEnv; readonly context: HeadlessRuntimeInstallation;
  readonly rest: { x: number; z: number; face: { x: number; z: number } };
}): NalatiTamingLaw<AnimalSim, NalatiGroups['herds'][number]> {
  if (installed.has(host)) throw new Error('Nalati taming already installed');
  let bond: '1' | 'argymaq' | null = null, pitch = 0, offer = false, lean = 0, shake = 0, roll = 0;
  const camera = new Vector3(), eye = new Vector3(), hurtDir = new Vector3();
  const poses = new Map<string, NalatiTamingHorsePose>(), poseRows: { actor: AnimalSim; pose: NalatiTamingHorsePose }[] = [];
  const addPose = (a: AnimalSim): void => {
    if (poses.size >= 64 || poses.has(a.entityId) || (a.kind !== 'horse' && a.kind !== 'argymaq')) throw new Error('Invalid Nalati taming pose roster');
    const pose = new NalatiTamingHorsePose(a, () => ports.environment.wind); poses.set(a.entityId, pose); poseRows.push({ actor: a, pose });
    a.headWorld = out => pose.headWorld(out);
    // Manager samples pose terrain before its own decision, never at a second independent clock.
    const managed = ports.creatures.bodies.find(body => body === a); if (managed === undefined) throw new Error('Foreign Nalati taming body');
    managed.sampleTerrain = () => { pose.sampleTerrain(); };
  };
  if (ports.creatures.bodies.length > 64) throw new Error('Nalati taming body bound exceeded');
  for (let i = 0; i < 64; i++) { const a = ports.creatures.bodies[i]; if (a === undefined) break; if (a.kind === 'horse' || a.kind === 'argymaq') addPose(a); }
  const mounted = ports.mounted;
  const law = new NalatiTamingLaw({
    bond: { read: () => null, write: value => { if (value !== '1' && value !== 'argymaq') throw new Error('Invalid Nalati bond'); bond = value; } },
    player: { position: host.player.position, get crouching() { return mounted.rider.crouching; },
      get yaw() { return host.player.yaw; }, set yaw(value) { host.player.yaw = value; }, get pitch() { return pitch; }, set pitch(value) { pitch = value; },
      keys: new Set<string>(), camera: { position: camera, getWorldDirection: out => out.set(-Math.sin(host.player.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(host.player.yaw) * Math.cos(pitch)) } },
    mount: { get mounted() { return mounted.mounted; }, get horse() { return mounted.horse; },
      get breakShake() { return shake; }, set breakShake(value) { shake = value; }, get breakRoll() { return roll; }, set breakRoll(value) { roll = value; },
      mount: (a, breaking) => mounted.mount(a.entityId, breaking), dismount: thrown => { mounted.dismount(thrown); },
      addMountable: a => { mounted.addMountable(a); }, removeMountable: a => { mounted.removeMountable(a); } },
    hud: { get offer() { return offer; }, get lean() { return lean; } }, herds: () => ports.groups.herds, rest: ports.rest,
    wind: () => ports.environment.wind, random: () => host.rng.stream('ai').next(),
    spawnBonded: (x, z, yaw, argymaq) => { const a = ports.creatures.spawnBondedHorse(x, z, yaw, argymaq); addPose(a); return a; },
    hideStallion: a => { ports.creatures.hideTamedStallion(a); }, retireBonded: a => {
      ports.creatures.retireBondedHorse(a); poses.delete(a.entityId);
      const at = poseRows.findIndex(row => row.actor === a); if (at === -1) throw new Error('Missing bonded pose'); poseRows.splice(at, 1);
    }, hurt: amount => {
      host.combat.hit({ source: 'env', sourceTags: ['env.ride'], target: host.player.health, amount, throughWalls: true,
        point: host.player.position, dir: hurtDir, cause: { kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' } });
    },
  });
  host.events.on('creature.signal', ({ name, x, z }) => { law.noteEvent(name, x, z); }, host.scope);
  host.events.on('weapon.impact', ({ point }) => {
    // Same state.ts filter: only a distant landing, not an arm's-length melee impact.
    if (Math.hypot(point.x - host.player.position.x, point.z - host.player.position.z) < 4.5) return;
    for (let i = 0; i < 8; i++) { const h = ports.groups.herds[i]; if (h === undefined) break; h.disturb(point.x, point.z); }
    for (let i = 0; i < 16; i++) { const f = ports.creatures.flocks[i]; if (f === undefined) break; if (Math.hypot(f.cx - point.x, f.cz - point.z) < 25) f.scare(point.x, point.z, 4); }
    law.noteShot(point.x, point.z);
  }, host.scope);
  const candidates = [law.interactable], namePoint = new Vector3();
  // ride.ts chooses among registered mounts, taming, then the nearest rail NAME action, before main's LOS selector.
  // Companion whistle/resting and the global quest prompt list stay explicit unhosted gameplay requirements.
  const selectedTaming = (): boolean => {
    if (mounted.mountables.length > 64) throw new Error('Nalati mountable prompt bound exceeded');
    let best = Infinity, taming = false, naming: AnimalSim | null = null, nameDistance = Infinity;
    for (let i = 0; i < 64; i++) {
      const a = mounted.mountables[i]; if (a === undefined) break;
      const d = a.position.distanceTo(camera), radius = mounted.horse === a ? 3.6 : 3.3;
      if (d < radius && d < best) { best = d; taming = false; }
      if (!mounted.mounted && a.alive && Math.hypot(a.position.x - HITCHING_RAIL.x, a.position.z - HITCHING_RAIL.z) <= 5) {
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
  const originalUpdate = law.update.bind(law), invalidInput = new Error('Invalid Nalati taming input');
  law.update = dt => {
    offer = false; lean = 0; let mount = false;
    const commands = ports.context.commands(); if (commands.length > 4096) throw invalidInput;
    for (let i = 0; i < 4096; i++) {
      const c = commands[i]; if (c === undefined) break;
      if (c.kind === 'player') lean = c.steer?.keyX ?? 0;
      else if (c.kind === 'script') {
        if (c.actorId === 'nalati.taming.offer') { if (c.value !== 0 && c.value !== 1) throw invalidInput; offer = c.value === 1; }
        else if (c.actorId === 'nalati.taming.lean') { if (!Number.isFinite(c.value) || Math.abs(c.value) > 1) throw invalidInput; lean = c.value; }
        else if (c.actorId === 'nalati.look.pitch') { if (!Number.isFinite(c.value) || Math.abs(c.value) > Math.PI / 2) throw invalidInput; pitch = c.value; }
        else if (c.actorId === 'nalati.taming.mount') { if (c.value !== 1) throw invalidInput; mount = true; }
      }
    }
    camera.copy(host.player.position); camera.y += 1.68;
    originalUpdate(dt);
    if (mount && selectedTaming()) {
      setPromptSight(law.interactable, { body: law.promptHorse, slack: 0.5 });
      eye.copy(camera);
      if (pickPrompt(candidates, eye, host.physics) === law.interactable) law.startBreaking();
    }
  };
  const missingPose = new Error('Missing Nalati taming pose');
  host.onStep('nalati.taming', () => {
    for (let i = 0; i < 64; i++) {
      const row = poseRows[i]; if (row === undefined) break;
      const bodyDt = host.bodyDt(row.actor.entityId); if (bodyDt <= 0) continue;
      row.pose.advance(bodyDt, host.clock.now, row.actor.position.distanceToSquared(host.player.position) < 140 * 140);
    }
  }, {
    snapshot: (): SimValue => ({ version: 1, law: law.snapshot(), bond, pitch, shake, roll, poses: [...poses].map(([id, pose]) => [id, pose.snapshot()]) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      if (saved.poses.length !== poses.size || new Set(saved.poses.map(([id]) => id)).size !== poses.size) throw new Error('Invalid Nalati taming pose identities');
      for (let i = 0; i < 64; i++) { const row = saved.poses[i]; if (row === undefined) break; const [id, wire] = row; const pose = poses.get(id); if (pose === undefined) throw missingPose; pose.restore(wire); }
      law.restore(saved.law, ports.creatures.bodies.filter(a => a.kind === 'horse' || a.kind === 'argymaq'));
      bond = saved.bond; pitch = saved.pitch; shake = saved.shake; roll = saved.roll;
    },
  }, 'afterBodies');
  host.scope.onDispose(() => { poses.clear(); poseRows.length = 0; installed.delete(host); });
  installed.set(host, law); return law;
}
