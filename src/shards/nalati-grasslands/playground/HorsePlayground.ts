import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomMarker } from '@wildshard/engine/ui/roomMap';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { buildPracticeScene } from '@wildshard/game/practice/scene';
import * as THREE from 'three';
import type { RidingPracticeLayout } from '@wildshard/format/practiceCourse';
import type { Ride } from '../ride/ride';

const HORSE_NAME = 'Track horse', FILE = 'src/shards/nalati-grasslands/playground/HorsePlayground.ts';

export class HorsePlayground implements Playground {
  readonly id = 'horse' as const;
  readonly title = 'Horse playground';
  readonly center: { x: number; z: number };
  readonly root: THREE.Group;
  /** the field's own map (E321): the walls, the oval and its posts, the start / finish and half-way lines, the jump rails,
   *  the horse — the minimap draws this while you ride, not the steppe 3 km under the field */
  readonly map: RoomMap;
  /** the track's centre line, world x / z, two laps long (the road wraps past the line) */
  readonly road: (readonly [number, number])[];
  private horse: Animal | null = null;
  private readonly chip: PlaygroundChip;
  private active = false;
  private lap = 0;
  private lapT0 = 0;
  private running = false;
  private halfDone = false;
  private best: number | null = null;
  private last: number | null = null;
  private prevX = 0;

  constructor(private readonly host: PlaygroundHost & { ride: Ride | null; rows: RidingPracticeLayout }) {
    const rows = host.rows;
    this.origin = new THREE.Vector3(rows.fieldAt.x, PLAYGROUND_Y, rows.fieldAt.z);
    if (host.ride === null) throw new Error('the horse playground needs Nalati\'s riding');
    this.center = { x: this.host.rows.fieldAt.x, z: this.host.rows.fieldAt.z };
    const o = this.origin;
    const { root, colliders, map } = buildPracticeScene(rows.presentation, o, 'playground-horse');
    this.root = root;
    root.visible = false;
    host.registry.add({ id: 'playground-horse', name: 'Horse playground', category: 'ground', file: FILE, object: root, colliders, surface: 'wood', solidFloor: true });
    const lap = rows.road.map(([x, z]) => [o.x + x, o.z + z] as const);
    this.road = [...lap, ...lap.slice(1)];
    const mark: RoomMarker = { x: 0, z: 0 }, marks = [mark], none: RoomMarker[] = [];   // reused: read every frame
    this.map = { ...map, markers: () => { const h = this.horse; if (h === null || h.hidden) return none; mark.x = h.position.x; mark.z = h.position.z; return marks; } };
    this.chip = new PlaygroundChip('Horse track', () => { this.restart(); });
    host.game.onUpdate(() => { if (this.active) this.update(); }, 'playground-horse');
  }

  get entered(): boolean { return this.active; }

  /** the field's floor centre, world space (one vector: update() reads it every frame) */
  private readonly origin: THREE.Vector3;

  enter(): void {
    const ride = this.host.ride;
    if (ride === null) return;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    const horse = this.horse ?? this.spawnHorse();
    horse.hidden = false; horse.mesh.visible = true;
    ride.mount.addMountable(horse.entityId, HORSE_NAME);
    ride.mount.setRoads([this.road]);             // the track is the road while the field is open (B1's keep-to-the-road)
    practiceFps.on = true;                        // a small scene: mobile runs it at 60 (tier.ts, as the Practice arena)
    playgroundActive(true);
    this.host.player.setHover(false);
    this.chip.show(true);
    this.restart();
  }

  exit(): void {
    if (!this.active) return;
    const ride = this.host.ride, horse = this.horse;
    this.active = false;
    app.setState('play');
    if (ride !== null && horse !== null) {
      if (ride.mount.horse === horse) ride.mount.dismount();
      ride.mount.removeMountable(horse.entityId);
      ride.mount.setRoads(null);
      horse.hidden = true; horse.mesh.visible = false;
    }
    this.root.visible = false;
    this.chip.show(false);
    playgroundActive(false);
    practiceFps.on = false;
  }

  /** the saddled horse, spawned once through the shard's AnimalManager (its rig, its sounds, its hit tests) */
  private spawnHorse(): Animal {
    const a = this.host.animals.spawn('horse', this.host.rows.fieldAt.x + this.host.rows.horseStart.x, this.host.rows.fieldAt.z + this.host.rows.horseStart.z, this.host.rows.horseStart.yaw, 'camp-bay');
    this.horse = a;
    return a;
  }

  /** stand the horse on the field at (x, z): the field is PLAYGROUND_Y up, the terrain under it is not its ground */
  private standHorse(a: Animal, x: number, z: number, yaw: number): void {
    a.place(x, z, yaw);
    a.yOffset = PLAYGROUND_Y - heightAt(x, z);
    a.position.y = PLAYGROUND_Y;
    a.levelGround = true;
    a.hp = a.maxHp;             // whole again: under 20 % Mount's bolt would run it for the camp's rail, 3 km down
    a.speed = 0;
    a.setMotion(yaw, 0, 2);
    a.mesh.position.copy(a.position);
  }

  /** ↺: off the horse, the horse back on the start facing east, you by its left side; the laps reset */
  restart(): void {
    const ride = this.host.ride, a = this.horse;
    if (ride === null || a === null) return;
    if (ride.mount.horse === a) ride.mount.dismount();
    const o = this.origin;
    this.standHorse(a, o.x + this.host.rows.horseStart.x, o.z + this.host.rows.horseStart.z, this.host.rows.horseStart.yaw);
    const px = o.x + this.host.rows.riderStart.x, pz = o.z + this.host.rows.riderStart.z;
    // face the horse's shoulder: Player.forward is (−sin yaw, −cos yaw)
    const yaw = Math.atan2(-(a.position.x + 0.6 - px), -(a.position.z - pz));
    this.host.player.spawn(px, pz, yaw, o.y);
    this.host.player.pitch = -0.28;
    this.lap = 0; this.running = false; this.halfDone = false; this.last = null;
    this.prevX = px - o.x;
    this.chip.status('READY · MOUNT UP');
    this.chip.time(0, this.best);
  }

  private update(): void {
    const ride = this.host.ride, a = this.horse, p = this.host.player;
    if (ride === null || a === null) return;
    if (p.hover) p.setHover(false);
    const o = this.origin;
    // unridden, the horse stands on the field (a dismount hands it back to the terrain's tilt: level it again)
    // — and at the field's height where it stands now: its ground follow tracks the terrain 3 km under it, so the offset
    // taken on the start would float or sink it anywhere else (a dismount mid-lap; E321 / E328)
    if (ride.mount.horse !== a) { a.levelGround = true; a.yOffset = PLAYGROUND_Y - heightAt(a.position.x, a.position.z); }
    const mounted = this.host.player.mountedOn === a;
    // the laps: across the start line eastward on the front straight starts / ends one; half way counts on the back
    const x = p.position.x - o.x, z = p.position.z - o.z;
    const onFront = Math.abs(z - this.host.rows.oval.radius) < this.host.rows.oval.width / 2 + 2, onBack = Math.abs(z + this.host.rows.oval.radius) < this.host.rows.oval.width / 2 + 2;
    const now = performance.now();
    if (onFront && this.prevX < this.host.rows.lineX && x >= this.host.rows.lineX && mounted) {
      if (this.running && this.halfDone) {
        const t = (now - this.lapT0) / 1000;
        this.last = t; this.best = this.best === null ? t : Math.min(this.best, t);
        this.host.toast(`LAP ${this.lap} · ${clock(t)}${this.best === t ? ' · BEST' : ''}`);
      }
      this.running = true; this.halfDone = false; this.lap++; this.lapT0 = now;
    }
    if (onBack && this.prevX > this.host.rows.lineX && x <= this.host.rows.lineX && this.running && !this.halfDone) {
      this.halfDone = true;
      this.host.toast(`HALF WAY · ${clock((now - this.lapT0) / 1000)}`);
    }
    this.prevX = x;
    const t = this.running ? (now - this.lapT0) / 1000 : 0;
    this.chip.time(t, this.best);
    if (!mounted && !this.running) this.chip.status('READY · MOUNT UP');
    else if (!this.running) this.chip.status('RIDE OVER THE LINE ▶', 'go');
    else this.chip.status(`LAP ${this.lap}${this.halfDone ? ' · ½' : ''}${this.last !== null ? ` · LAST ${clock(this.last)}` : ''}`, 'go');
    // off the field (a dismount in mid-jump drops you to the terrain under it): back on the start
    if (p.position.y < o.y - 12) { this.restart(); this.host.toast('OFF THE FIELD · BACK ON THE START'); }
  }
}

