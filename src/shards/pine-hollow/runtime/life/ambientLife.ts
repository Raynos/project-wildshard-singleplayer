import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { app } from '@wildshard/engine/app/runtime';
import { TickScheduler } from '@wildshard/engine/app/scheduler';
import { PlaceGuide } from '@wildshard/engine/quest/view';
import { audioRandom } from '@wildshard/engine/audio/util';
import { CameraFX } from '@wildshard/engine/player/CameraFX';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { smoothstep } from '@wildshard/engine/core/noise';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { installEnteredRuntimeObserver,installEnteredRuntimeService,retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import { sharedWeaponVoices } from '@wildshard/game/plugin/audio';
import { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import { AmbientFlock, type AmbientFlockBird, type AmbientFlockPlayer } from '@wildshard/engine/ai/ambientFlock';
import { parseAmbientLife, type AmbientLifeData } from '@wildshard/format/ambientLife';
import { createAmbientFlock, installAmbientFlock, type AmbientFlockLook } from '@wildshard/sdk/looks/ambientFlock';

interface PlaceSpot {id:string;x:number;z:number;r:number}
export interface WildPose {kind:number;x:number;y:number;z:number;yaw:number;pitch:number;roll:number;scale:number;a0:number;a1:number;a2:number;a3:number;b1:number;b2:number}
const newPose=(kind:number):WildPose=>({kind,x:0,y:-999,z:0,yaw:0,pitch:0,roll:0,scale:1,a0:0,a1:0,a2:0,a3:0,b1:0,b2:0});
export interface AmbientLifeView {mesh:THREE.InstancedMesh;glow:{value:number};look:AmbientFlockLook;begin:()=>void;add:(pose:WildPose)=>void;commit:()=>void}
function beatEnvelope(t:number,beat:AmbientLifeData['harvest']):number {if(t<=0||t>=beat.len)return 0;const ease=(u:number):number=>u*u*(3-2*u);if(t<beat.kneelIn)return ease(t/beat.kneelIn);if(t>beat.rise)return ease(1-(t-beat.rise)/(beat.len-beat.rise));return 1;}

export interface AmbientLifeHost<Birds> {
  ctx: ShardContext;
  game: Game; sky: Sky; player: Player; animals: AnimalManager; weapons: EquipmentService; audio: Parameters<typeof sharedWeaponVoices>[0];
  trees: readonly TreeInstance[];
  /** the journal's places (id, spot, radius) and whether one is visited (seen) — null = no journal on this build */
  places: (() => PlaceSpot[]) | null;
  visited: (id: string) => boolean;
  /** a fight is on (no breadcrumbs then) */
  inCombat: () => boolean;
  /** ambient's generated one-shots (ForestAmbience's `sfx`): the birds' voices, the knife's strokes; null = none */
  sfx?: { shot:(name:string,options?:{at?:{x:number;y:number;z:number}|undefined;gain?:number})=>boolean } | null;
  view: AmbientLifeView;
  /** One-shot owned intake; released after the view copies its vertex channels. */
  birds: Birds|null;
  swapBirds: (set:Birds,renderer:Game['renderer']) => void;
  knife: () => { update:(time:number)=>void };
  trimShadows: boolean;
}
export interface AmbientLife {
  mesh: THREE.InstancedMesh;
  /** the skinning beat over `carcass`; `give` hands out the drops at its end. The carcass then waits for the ravens. */
  harvest: (carcass: Animal, give: () => void, cancel?: () => void) => void;
  /** the beat is running */
  readonly busy: boolean;
}

/** a kill: when the ravens come, the skinning, its scavenge site (-1 waiting, -2 they came and went unseen) */
interface Carcass { a: Animal; killT: number; comeT: number; harvestT: number; site: number; dimmed: boolean }

export function createAmbientLife<Birds>(data: AmbientLifeData,h: AmbientLifeHost<Birds>): AmbientLife | null {
  if (h.trimShadows) h.animals.shadowBatch = false; // G180 B5: the herd shadows from the visible herd (ambient memory trim)
  const { game, sky, player, animals } = h;
  const sc = data.scavenger;
  const retained = retainsRuntimeServices(h.ctx);
  let lifeTime = app.clock.now;
  const now = (): number => retained ? lifeTime : app.clock.now;
  const rng = new Rng(data.seed);
  const wild = h.view;
  game.scene.add(wild.mesh);
  if(h.birds===null)throw new Error('Missing required ambient models');
  h.swapBirds(h.birds,game.renderer);h.birds=null;
  const cam = game.camera;
  const fwd = new THREE.Vector3();

  // ── the birds: three ambient flock rows (the ravens at a kill, the owl on a snag top, the woodpecker on the bark) ──
  const ravens = new AmbientFlock(sc.flock), owl = new AmbientFlock(data.sentinel.flock, data.sentinel.perches), wood = new AmbientFlock(data.trunkForager.flock, data.trunkForager.perches);
  const flocks = [ravens, owl, wood], pose = newPose(0);
  const lane = (b: AmbientFlockBird, l: AmbientFlock['row']['channels'][0][number]): number => typeof l === 'number' ? l : b[l];
  /** each flock's live birds into the wildlife draw, and its voices through the ambience's one-shots */
  const shot: { at: { x: number; y: number; z: number } | undefined; gain: number } = { at: undefined, gain: 1 };
  const drawFlock = (f: AmbientFlock): void => {
    const [a, b] = f.row.channels;
    for (let i = 0; i < 8; i++) { const c = f.calls[i]; if (c === undefined) break; shot.at = c; shot.gain = c.gain; h.sfx?.shot(c.cue, shot); }
    for (let i = 0; i < 256; i++) { // a flock row is at most 256 birds
      const bird = f.birds[i];
      if (bird === undefined) break;
      if (bird.state === 0) continue;
      pose.x = bird.x; pose.y = bird.y; pose.z = bird.z; pose.yaw = bird.yaw; pose.pitch = bird.pitch; pose.roll = bird.roll; pose.scale = f.row.scale;
      pose.a0 = lane(bird, a[0]); pose.a1 = lane(bird, a[1]); pose.a2 = lane(bird, a[2]); pose.a3 = lane(bird, a[3]);
      pose.kind = b === null ? 0 : lane(bird, b[0]); pose.b1 = b === null ? 0 : lane(bird, b[1]); pose.b2 = b === null ? 0 : lane(bird, b[2]);
      wild.add(pose);
    }
  };

  // ── the ravens at a carcass ──
  const carcasses: Carcass[] = [];
  const harvestColors = new WeakMap<Carcass, { original: THREE.Color; dimmed: THREE.Color }>();
  const ravenDelay = (u: number): number => sc.arrival[0] + Math.max(0, Math.min(1, u)) * (sc.arrival[1] - sc.arrival[0]);
  /** the ravens came and went (or never will) */
  const left = (c: Carcass): boolean => c.site === -2 || (c.site >= 0 && ravens.siteVisit(c.site) === 3);
  // a kill, through the combat pipeline's event (no chained onKill: E357 AG19)
  h.ctx.on('actor.died', ({ actor }) => {
    const a = animals.animals.find((x) => x.combatActor() === actor);
    if (a === undefined || !Object.hasOwn(sc.visitors, a.kind)) return;
    const t = now();
    carcasses.push({ a, killT: t, comeT: t + ravenDelay(rng.next()), harvestT: -1, site: -1, dimmed: false });
  });
  const dim = (c: Carcass): void => {
    // the hide is off: the body dims a little (its own fur material only; a shared one is never touched)
    if (c.dimmed) return;
    c.dimmed = true;
    const mats = Array.isArray(c.a.mesh.material) ? c.a.mesh.material : [c.a.mesh.material];
    const fur = mats[0];
    if (!(fur instanceof THREE.MeshStandardMaterial)) return;
    const shared = animals.animals.some((o) => o !== c.a && (Array.isArray(o.mesh.material) ? o.mesh.material.includes(fur) : o.mesh.material === fur));
    if (!shared) {
      const original = retained ? fur.color.clone() : undefined;
      fur.color.multiplyScalar(0.62);
      if (original !== undefined) harvestColors.set(c, { original, dimmed: fur.color.clone() });
    }
  };
  const updateCarcasses = (t: number): void => {
    const pp = player.position;
    for (let k = 0; k < 256; k++) { // newest first; a few kills at a time
      const i = carcasses.length - 1 - k;
      if (i < 0) break;
      const c = carcasses[i];
      if (c === undefined) continue;
      const a = c.a;
      if (a.hidden || !animals.animals.includes(a)) { if (c.site >= 0) ravens.release(c.site, pp); carcasses.splice(i, 1); continue; }
      if (c.site === -1 && t >= c.comeT) { // the flock is at another kill / you are far off: they came and went unseen
        const far = Math.hypot(a.position.x - pp.x, a.position.z - pp.z) > sc.reach;
        c.site = far ? -2 : ravens.gather(a.position.x, a.position.z, sc.bodyWidths[a.kind] ?? 0.8, sc.visitors[a.kind] ?? sc.defaultVisitors);
        if (c.site < 0) c.site = -2;
      }
      if (c.harvestT >= 0) {
        dim(c);
        if (left(c) || t - c.harvestT > sc.giveUp) { a.fadeOut(); if (c.site >= 0) ravens.release(c.site, pp); carcasses.splice(i, 1); }
      } else if (left(c) && t - c.killT > 900) carcasses.splice(i, 1); // an old unharvested kill: nothing more to track
    }
  };

  // ── the breadcrumbs: ravens toward the nearest unvisited place (the guide flock row, @wildshard/sdk/looks/ambientFlock) ──
  const crumbs = createAmbientFlock(data.guide.flock, wild.look);
  wild.mesh.add(crumbs.group); // the guide flock draws beside the wildlife (both at the origin)
  installAmbientFlock(h.ctx, crumbs, player);
  const guide = new PlaceGuide(data.guide.policy, { points: () => h.places?.() ?? [], discovered: h.visited,
    position: () => player.position, fly: flyCrumbs, time: now, random: (lo: number, hi: number) => rng.range(lo, hi) });
  function flyCrumbs(target: PlaceSpot): boolean {
    if (!crumbs.guide(player.position, target.x, target.z)) return false;
    const lead = crumbs.flock.birds[0];
    if (lead) h.sfx?.shot(data.sounds.pair, { at: lead, gain: 0.9 }); // croaking as they pass over: look up
    return true;
  }
  /** the player as the flocks read it: sprinting, the night, the view's forward, the nearest unseen place (the owl's heading) */
  let night = 0;
  const reader: AmbientFlockPlayer = { get x() { return player.position.x; }, get y() { return player.position.y; }, get z() { return player.position.z; },
    get fast() { return player.sprinting; }, get light() { return night; }, get fx() { return fwd.x; }, get fz() { return fwd.z; }, get toward() { return guide.target(); } };

  // ── the hares: a roaming forager population round the player, drawn into the wildlife mesh ──
  const hares = new ForagerPopulation(data.forager, data.seed, h.trees).roam(reader), harePose = newPose(data.forager.model);
  harePose.scale = data.forager.scale;
  const drawHares = (): void => { for (let i = 0; i < 256; i++) {
    const hr = hares.rows[i], p = harePose, motion = hares.motion[i];
    if (hr === undefined || motion === undefined) break;
    if (hares.shown[i] !== 1) continue;
    p.x = hr.x; p.y = heightAt(hr.x, hr.z) + motion.y; p.z = hr.z; p.yaw = hr.yaw;
    p.a0 = motion.hind; p.a1 = motion.fore; p.pitch = motion.pitch;
    p.a2 = hr.headPitch - hr.sit * 0.2; p.a3 = hr.ears; p.b1 = hr.mode === 'alert' ? Math.sin(now() * 1.3 + i) * 0.5 : 0;
    wild.add(p);
  } };

  // ── the skinning beat (F2) ──
  const BEAT = data.harvest;
  const voice = (family: string, gain: number): boolean => { shot.at = undefined; shot.gain = gain; return h.sfx?.shot(family, shot) ?? false; };
  let beatCancel: (() => void) | undefined;
  let beatT = -1, beatCarcass: Animal | null = null, beatGive: (() => void) | null = null, cutsDone = 0;
  let addPitch = 0, addY = 0, lastRx = Number.NaN, lastPy = Number.NaN;
  const fx = CameraFX.for(game);
  // the gloved hand and the skinning knife the strokes are made with (the weapon is holstered for the beat)
  const knife = h.knife();
  let interrupted: { enabled: boolean; visible: boolean } | undefined;
  let previousWeapons: { enabled: boolean; visible: boolean } | undefined;
  const harvest = (carcass: Animal, give: () => void, cancel?: () => void): void => {
    if (beatT >= 0) { beatGive?.(); } // a second harvest mid-beat (never, the prompt hides): the first one's drops land now
    if (retained && beatT < 0) previousWeapons = { enabled: h.weapons.enabled, visible: h.weapons.visible };
    beatCancel = cancel;
    beatT = 0; beatCarcass = carcass; beatGive = give; cutsDone = 0;
    h.weapons.setEnabled(false); h.weapons.visible = false;
    h.audio.footstep(false, 'litter'); // kneeling in the needles
    const c = carcasses.find((k) => k.a === carcass);
    if (c) c.harvestT = now();
    else carcasses.push({ a: carcass, killT: now() - 60, comeT: now() + ravenDelay(rng.next()) * 0.5, harvestT: now(), site: -1, dimmed: false });
  };
  const updateBeat = (dt: number): void => {
    // take last frame's offset back when nothing rewrote the camera since (Player.update rewrites it every frame)
    if (cam.rotation.x === lastRx && cam.position.y === lastPy) { cam.rotation.x -= addPitch; cam.position.y -= addY; }
    addPitch = 0; addY = 0;
    if (beatT < 0) { lastRx = Number.NaN; lastPy = Number.NaN; knife.update(-1); return; }
    beatT += dt;
    knife.update(beatT);
    const env = beatEnvelope(beatT,BEAT);
    // kneel: down 0.55 m and the view tipped toward the carcass (at most ~35°, never past it)
    let tip = 0.35;
    if (beatCarcass) {
      const a = beatCarcass.position, dx = a.x - cam.position.x, dz = a.z - cam.position.z, dy = a.y + 0.3 - (cam.position.y - 0.55);
      const want = Math.atan2(dy, Math.hypot(dx, dz)); // negative = below
      tip = THREE.MathUtils.clamp(-(want - cam.rotation.x), 0, 0.6);
    }
    addPitch = -tip * env; addY = -0.55 * env;
    const cut = BEAT.cuts[cutsDone];
    if (cut !== undefined && beatT >= cut) {
      cutsDone++;
      if (!voice(cutsDone % 2 === 1 ? data.sounds.cutA : data.sounds.cutB, 0.85)) sharedWeaponVoices(h.audio).swordHit('flesh', (audioRandom() - 0.5) * 0.3, 0.42);
      fx.kick(-1.1, cutsDone % 2 === 0 ? 0.8 : -0.8);
    }
    if (beatT >= BEAT.len) {
      beatT = -1; beatCarcass = null; beatCancel = undefined;
      const give = beatGive; beatGive = null; give?.();
      if (!player.swimming) { h.weapons.setEnabled(true); h.weapons.visible = true; }
    }
    cam.rotation.x += addPitch; cam.position.y += addY;
    lastRx = cam.rotation.x; lastPy = cam.position.y;
  };

  if (retained) installEnteredRuntimeService(h.ctx, (scope) => {
    // Only the next home entry may release an interrupted harvest hold; never reveal a stowed weapon on the road.
    if (interrupted !== undefined) {
      h.weapons.setEnabled(interrupted.enabled); h.weapons.visible = interrupted.visible;
      interrupted = undefined;
    }
    scope.onDispose(() => {
      if (beatT >= 0) {
        interrupted = previousWeapons;
        const carcass = carcasses.find((entry) => entry.a === beatCarcass);
        if (carcass !== undefined) {
          const color = harvestColors.get(carcass), materials = carcass.a.mesh.material;
          const fur = Array.isArray(materials) ? materials[0] : materials;
          if (color !== undefined && fur instanceof THREE.MeshStandardMaterial && fur.color.equals(color.dimmed)) fur.color.copy(color.original);
          harvestColors.delete(carcass); carcass.dimmed = false; carcass.harvestT = -1;
        }
        const cancel = beatCancel; beatCancel = undefined; cancel?.();
      }
      if (cam.rotation.x === lastRx && cam.position.y === lastPy) { cam.rotation.x -= addPitch; cam.position.y -= addY; }
      beatT = -1; beatCarcass = null; beatGive = null; cutsDone = 0;
      addPitch = 0; addY = 0; lastRx = Number.NaN; lastPy = Number.NaN;
      knife.update(-1);
    });
  });

  // ── the frame ──
  const scheduler = new TickScheduler();
  const ambient = { id:data.system.ambient, phase: 'update' as const, tick: 'fx', run: (): void => undefined };
  h.ctx.system({ id:data.system.id, phase: 'update', after:data.system.after, before:data.system.before, run: (dt) => {
    if (retained) lifeTime += dt;
    scheduler.beginFrame(dt, player.position);
    wild.begin();
    updateBeat(dt);
    cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    night = sky.dayNight?.night ?? 0;
    wild.glow.value = smoothstep(0, 1, (night - 0.45) / 0.3);
    const ambientDt = scheduler.systemDt(ambient, dt);
    if (ambientDt > 0) { updateCarcasses(now()); guide.update(ambientDt, 0, () => night < 0.5 && !h.inCombat()); }
    for (let i = 0; i < 3; i++) { const f = flocks[i]; if (f === undefined) break; f.update(ambientDt, reader); drawFlock(f); }
    hares.update(dt, reader, player.sprinting); drawHares();
    wild.commit();
  } });

  const life: AmbientLife = { mesh: wild.mesh, harvest, get busy() { return beatT >= 0; } };
  const probe = {
    wild, ravens: ravens.birds, owl: owl.birds[0], wood: wood.birds[0], guides: crumbs.flock.birds, hares: hares.rows, carcasses,
    /** a breadcrumb flock now (captures); the place it heads for */
    crumbs: () => guide.attempt(true),
    /** the owl onto a perch near you now (captures; set the clock to night first), or onto the snag nearest (x, z) */
    owlNow: (x?: number, z?: number) => { if (x === undefined || z === undefined) { owl.visitSoon(); return true; } return owl.visitAt(x, z, 20, reader); },
    /** the woodpecker onto a trunk near you now */
    woodNow: () => { wood.visitSoon(); },
    /** ravens to the nearest carcass now (or the one at x, z) */
    ravensTo: (x?: number, z?: number) => {
      const pp = player.position, qx = x ?? pp.x, qz = z ?? pp.z;
      let best: Carcass | undefined, bd = Infinity;
      for (const c of carcasses) { const d = Math.hypot(c.a.position.x - qx, c.a.position.z - qz); if (d < bd) { bd = d; best = c; } }
      if (best?.site === -1) best.comeT = now();
      return best !== undefined;
    },
    /** the skinning beat's clock (-1 idle) */
    beat: () => beatT,
  };
  h.ctx.debug.expose(data.debug.id,probe);
  installEnteredRuntimeObserver(h.ctx,data.debug.window,probe);
  return life;
}

/** Install this shard's ambient role on its actual scoped world/model owners. */
export function installAmbientLife<Birds>(input:unknown,ports:AmbientLifeHost<Birds>):ReturnType<typeof createAmbientLife<Birds>> {
  return createAmbientLife(parseAmbientLife(input),ports);
}
