import { app } from '@wildshard/engine/app/runtime';
import { practiceFps } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { DevKit, devLabel, devMaterial } from '@wildshard/engine/practice/playground/devGrid';
import { PlaygroundChip, clock, playgroundActive } from '@wildshard/engine/practice/playground/hud';
import { PLAYGROUND_Y, type Playground, type PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { RoomMap, RoomMarker, RoomShape } from '@wildshard/engine/ui/roomMap';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { Ride } from '../ride/ride';
/**
 * Nalati ▸ Horse playground (E307, Jake: "a naive, playable mini level in Explore mode for running around on a horse, to
 * get a feel for the horse controls, maybe horse racing"). An open dev-grid field high over the steppe (PLAYGROUND_Y), in
 * Nalati's own sky: an oval track with posts, a start / finish line with a lap timer, a half-way line, and an infield lane
 * of four rails (0.9 – 1.2 m) the horse jumps by itself at a canter or faster. Walls round the field keep the horse on it.
 *
 * The REAL riding (src/shards/nalati-grasslands/ride/Mount.ts through Nalati's src/shards/nalati-grasslands/ride/ride.ts): a saddled horse waits on the start, you stand
 * by its left side — USE mounts it (the ride's one prompt), the RideHUD's GALLOP / DISMOUNT and the STEED bar work as on
 * the steppe. While the field is open the track's centre line is the horse's road (Mount.setRoads): let go of the stick
 * at a trot or faster and it keeps its gait round the oval (B1's keep-to-the-road).
 *
 * The horse is an ordinary AnimalManager horse ('camp-bay'), spawned on the first visit and hidden while you are away;
 * it stands on the field, not the terrain 3 km under it (Animal.yOffset / levelGround, as a ridden horse on a deck does).
 */
import * as THREE from 'three';
import { FIELD, HORSE_START, JUMPS, JUMP_WIDTH, LINE_X, OVAL, POST_GAP, POST_OFF, RIDER_START, ovalLine } from './horseCourse';

const FILE = 'src/shards/nalati-grasslands/playground/HorsePlayground.ts';
/** a place on the steppe whose field (240 × 150 m) is over dry ground well inside the chunk: Mount slows a horse over the
 *  river's mask (its fording) and stops it at the chunk's edge — both read the terrain under the field */
export const FIELD_AT = { x: 40, z: 60 } as const;
const HORSE_NAME = 'Track horse';

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

  constructor(private readonly host: PlaygroundHost & { ride: Ride | null }) {
    if (host.ride === null) throw new Error('the horse playground needs Nalati\'s riding');
    this.center = { x: FIELD_AT.x, z: FIELD_AT.z };
    const o = this.origin;
    const { root, colliders } = this.build(o);
    this.root = root;
    root.visible = false;
    host.registry.add({ id: 'playground-horse', name: 'Horse playground', category: 'ground', file: FILE, object: root, colliders, surface: 'wood', solidFloor: true });
    const lap = ovalLine(4).map(([x, z]) => [o.x + x, o.z + z] as const);
    this.road = [...lap, ...lap.slice(1)];
    const mark: RoomMarker = { x: 0, z: 0 }, marks = [mark], none: RoomMarker[] = [];   // reused: read every frame
    this.map = { ...fieldMap(o), markers: () => { const h = this.horse; if (h === null || h.hidden) return none; mark.x = h.position.x; mark.z = h.position.z; return marks; } };
    this.chip = new PlaygroundChip('Horse track', () => { this.restart(); });
    host.game.onUpdate(() => { if (this.active) this.update(); }, 'playground-horse');
  }

  get entered(): boolean { return this.active; }

  /** the field's floor centre, world space (one vector: update() reads it every frame) */
  private readonly origin = new THREE.Vector3(FIELD_AT.x, PLAYGROUND_Y, FIELD_AT.z);

  private build(o: THREE.Vector3): { root: THREE.Group; colliders: ColliderDesc[] } {
    const kit = new DevKit();
    const colliders: ColliderDesc[] = [];
    const solid = (tone: Parameters<DevKit['box']>[0], x: number, y: number, z: number, sx: number, sy: number, sz: number, surface?: 'wood' | 'metal'): void => {
      kit.box(tone, o.x + x, o.y + y, o.z + z, sx, sy, sz);
      colliders.push({ kind: 'box', x: o.x + x, y: o.y + y, z: o.z + z, hx: sx / 2, hy: sy / 2, hz: sz / 2, ...(surface ? { surface } : {}) });
    };
    const F = FIELD, W = F.x1 - F.x0, D = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
    // ── the field: a grass-green dev floor on a 4 m slab, grey walls round it (drawn both sides: the field is open) ──
    kit.plane('field', o.x + cx, o.y, o.z + cz, W, D);
    colliders.push({ kind: 'box', x: o.x + cx, y: o.y - 2, z: o.z + cz, hx: W / 2, hy: 2, hz: D / 2, surface: 'ground' });
    const t = 0.6;
    solid('grey', F.x0 - t / 2, F.wall / 2, cz, t, F.wall, D + 2 * t);
    solid('grey', F.x1 + t / 2, F.wall / 2, cz, t, F.wall, D + 2 * t);
    solid('grey', cx, F.wall / 2, F.z0 - t / 2, W, F.wall, t);
    solid('grey', cx, F.wall / 2, F.z1 + t / 2, W, F.wall, t);
    // ── the posts either side of the track, every POST_GAP m along it ──
    const line = ovalLine(1);
    let run = POST_GAP / 2;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (a === undefined || b === undefined) continue;
      run += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (run < POST_GAP) continue;
      run = 0;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      for (const side of [-1, 1]) solid('light', b[0] + nx * POST_OFF * side, 0.65, b[1] + nz * POST_OFF * side, 0.25, 1.3, 0.25);
    }
    // ── the jump lane: four orange rails across the infield, a grey post at each end ──
    for (const j of JUMPS) {
      solid('orange', j.x, j.h - 0.15, 0, 0.2, 0.3, JUMP_WIDTH, 'wood');
      solid('orange', j.x, (j.h - 0.3) / 2, 0, 0.12, j.h - 0.3, JUMP_WIDTH - 1, 'wood');
      for (const s of [-1, 1]) solid('grey', j.x, (j.h + 0.3) / 2, s * (JUMP_WIDTH / 2 + 0.2), 0.3, j.h + 0.3, 0.3);
    }
    // ── the start / finish gate over the front straight, the half-way gate over the back ──
    for (const [z, tall] of [[OVAL.radius, 6], [-OVAL.radius, 4]] as const) {
      for (const s of [-1, 1]) solid('orange', LINE_X, tall / 2, z + s * (OVAL.width / 2 + 1.5), 0.4, tall, 0.4);
    }
    const root = kit.build('playground-horse');
    // the track: a sand band, 12 m wide, just over the floor (drawn only: the horse runs on the field's slab)
    root.add(trackBand(o));
    // the lines across the track: checkered at the start / finish, orange at half way
    root.add(checkerLine(o.x + LINE_X, o.y + 0.03, o.z + OVAL.radius, OVAL.width + 2));
    const half = new THREE.Mesh(new THREE.PlaneGeometry(0.8, OVAL.width).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe2843a, fog: false }));
    half.position.set(o.x + LINE_X, o.y + 0.03, o.z - OVAL.radius);
    root.add(half);
    // the banners on the gates: one each way, back to back, so neither side reads mirrored
    for (const [z, y, text] of [[OVAL.radius, 5.4, 'START · FINISH'], [-OVAL.radius, 3.5, 'HALF WAY']] as const) {
      for (const face of [Math.PI / 2, -Math.PI / 2]) {
        const banner = devLabel(text, OVAL.width + 3, { standing: true, back: '#0d1b26', color: '#8fe3ff' });
        banner.rotation.y = face;
        banner.position.set(o.x + LINE_X + Math.sign(face) * 0.02, o.y + y, o.z + z);
        root.add(banner);
      }
    }
    // floor paint: the jumps' heights, the running direction on the front straight
    for (const j of JUMPS) {
      const l = devLabel(`${j.h.toFixed(1)} M`, 3.2, { color: '#e8f4fa' });
      l.position.set(o.x + j.x - 2.6, o.y + 0.03, o.z + 5.2);
      root.add(l);
    }
    // the running direction in dark floor paint, like the grid's own lines: unlit near-white glyphs (MeshBasic, no tone
    // map) glowed, and from the saddle at a gallop the middle ▶ peeked over the horse's poll as a floating white
    // triangle — the rest of the row hidden by the head (E320 follow-up)
    const arrow = devLabel('▶ ▶ ▶', 7, { color: '#7a5530' });
    arrow.position.set(o.x + LINE_X + 16, o.y + 0.035, o.z + OVAL.radius);
    root.add(arrow);
    return { root, colliders };
  }

  enter(): void {
    const ride = this.host.ride;
    if (ride === null) return;
    this.active = true;
    app.setState('playground');
    this.root.visible = true;
    const horse = this.horse ?? this.spawnHorse();
    horse.hidden = false; horse.mesh.visible = true;
    ride.mount.addMountable(horse, HORSE_NAME);
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
      ride.mount.removeMountable(horse);
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
    const a = this.host.animals.spawn('horse', FIELD_AT.x + HORSE_START.x, FIELD_AT.z + HORSE_START.z, HORSE_START.yaw, 'camp-bay');
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
    this.standHorse(a, o.x + HORSE_START.x, o.z + HORSE_START.z, HORSE_START.yaw);
    const px = o.x + RIDER_START.x, pz = o.z + RIDER_START.z;
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
    const onFront = Math.abs(z - OVAL.radius) < OVAL.width / 2 + 2, onBack = Math.abs(z + OVAL.radius) < OVAL.width / 2 + 2;
    const now = performance.now();
    if (onFront && this.prevX < LINE_X && x >= LINE_X && mounted) {
      if (this.running && this.halfDone) {
        const t = (now - this.lapT0) / 1000;
        this.last = t; this.best = this.best === null ? t : Math.min(this.best, t);
        this.host.toast(`LAP ${this.lap} · ${clock(t)}${this.best === t ? ' · BEST' : ''}`);
      }
      this.running = true; this.halfDone = false; this.lap++; this.lapT0 = now;
    }
    if (onBack && this.prevX > LINE_X && x <= LINE_X && this.running && !this.halfDone) {
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

/** the field as map shapes, world x / z (src/engine/ui/roomMap.ts): what the minimap and the full map draw while the field is up */
function fieldMap(o: THREE.Vector3): Omit<RoomMap, 'markers'> {
  const F = FIELD, w = (x: number, z: number): [number, number] => [o.x + x, o.z + z];
  const shapes: RoomShape[] = [
    { kind: 'rect', x0: o.x + F.x0, z0: o.z + F.z0, x1: o.x + F.x1, z1: o.z + F.z1, fill: '#123326', stroke: '#9aa6ae' },
    { kind: 'path', pts: ovalLine(2).map(([x, z]) => w(x, z)), width: OVAL.width, color: '#c9a468', closed: true },
  ];
  // the posts either side of the band (as the field builds them: every POST_GAP m along the line)
  const line = ovalLine(1);
  let run = POST_GAP / 2;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (a === undefined || b === undefined) continue;
    run += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (run < POST_GAP) continue;
    run = 0;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const side of [-1, 1]) shapes.push({ kind: 'dot', x: o.x + b[0] + nx * POST_OFF * side, z: o.z + b[1] + nz * POST_OFF * side, r: 0.7, color: '#e8f4fa' });
  }
  const half = OVAL.width / 2 + 1;
  shapes.push(
    { kind: 'path', pts: [w(LINE_X, OVAL.radius - half), w(LINE_X, OVAL.radius + half)], width: 2.4, color: '#f2f4f6' },     // START · FINISH
    { kind: 'path', pts: [w(LINE_X, -OVAL.radius - half), w(LINE_X, -OVAL.radius + half)], width: 2.4, color: '#e2843a' },   // HALF WAY
    ...JUMPS.map((j): RoomShape => ({ kind: 'path', pts: [w(j.x, -JUMP_WIDTH / 2), w(j.x, JUMP_WIDTH / 2)], width: 1.6, color: '#e2843a' })),
    { kind: 'label', x: o.x + LINE_X, z: o.z + OVAL.radius + half + 5, text: 'START · FINISH', color: '#f2f4f6' },
    { kind: 'label', x: o.x + LINE_X, z: o.z - OVAL.radius - half - 5, text: 'HALF WAY', color: '#e2843a' },
    { kind: 'label', x: o.x, z: o.z + 9, text: 'JUMPS', color: '#e8f4fa' },
  );
  return { bounds: { x0: o.x + F.x0, z0: o.z + F.z0, x1: o.x + F.x1, z1: o.z + F.z1 }, shapes };
}

/** the track: a 12 m sand band along the oval's centre line, world-aligned metre UVs, one draw */
function trackBand(o: THREE.Vector3): THREE.Mesh {
  const line = ovalLine(2), half = OVAL.width / 2;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], c = line[i];
    if (a === undefined || b === undefined || c === undefined) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const s of [-1, 1]) {
      const x = o.x + c[0] + nx * half * s, z = o.z + c[1] + nz * half * s;
      pos.push(x, o.y + 0.02, z); uv.push(x / 4, -z / 4); col.push(1, 1, 1);
    }
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = devMaterial('sand').clone();
  mat.side = THREE.DoubleSide; mat.polygonOffset = true; mat.polygonOffsetFactor = -1;
  const m = new THREE.Mesh(g, mat);
  m.name = 'playground-horse:track';
  return m;
}

/** a checkered start / finish strip across the track (x = the line), `length` m along z */
function checkerLine(x: number, y: number, z: number, length: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const g = c.getContext('2d');
  if (g !== null) for (let r = 0; r < 16; r++) for (let k = 0; k < 2; k++) { g.fillStyle = (r + k) % 2 === 0 ? '#f2f4f6' : '#15191e'; g.fillRect(k * 16, r * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, length).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, y, z);
  m.name = 'playground-horse:start-line';
  return m;
}
