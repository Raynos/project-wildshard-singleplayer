/**
 * MiniMap — the World Explorer's little map (EXPLORE-WORLD.md X5; mockups round-4 g11 / g12): a MAP button opens a
 * glass sheet with a top-down picture of the shard, a pin per `ChunkDef.pois` entry and the camera's arrow + view cone.
 * Tap a pin → the god-mode camera flies there (Explore.flyTo) and control comes straight back; tap anywhere else on
 * the map → fly over that spot; ⌂ SPAWN → back to the shard's spawn. Flying stays the way to get around — this is a
 * shortcut, not a mode.
 *
 *   const map = new MiniMap(explore, world);   map.toggle();   map.update();   // arrow follows the camera
 */
import * as THREE from 'three';
import type { World } from '../core/bootstrap';
import { CHUNK_HALF } from '../core/config';
import { heightAt, normalAt } from '../world/Heightfield';
import type { ChunkPoi } from '../chunks/ChunkDef';
import type { Explore } from './Explore';

const RES = 192; // map canvas pixels (the sheet scales it)

const html = (tag: string, cls: string, inner = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; e.innerHTML = inner; return e; };

export class MiniMap {
  readonly button: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly board: HTMLElement;
  private readonly arrow: HTMLElement;
  private drawn = false;
  private readonly pois: readonly ChunkPoi[];

  constructor(private readonly explore: Explore, private readonly world: World) {
    this.pois = world.chunk.pois ?? [];
    this.button = html('button', 'ws-x-mapbtn', '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Map</span>');
    (this.button as HTMLButtonElement).type = 'button';
    this.sheet = html('div', 'ws-x-map', `
      <div class="ws-x-map-head"><b>${world.chunk.displayName}</b><small>World explorer · tap a place to fly there</small><button type="button" class="ws-x-map-spawn">⌂ Spawn</button><button type="button" class="ws-x-map-close" aria-label="Close map">✕</button></div>
      <div class="ws-x-map-board"><canvas width="${RES}" height="${RES}"></canvas><i class="ws-x-map-me"></i></div>`);
    this.board = this.sheet.querySelector<HTMLElement>('.ws-x-map-board') ?? this.sheet;
    this.arrow = this.sheet.querySelector<HTMLElement>('.ws-x-map-me') ?? this.sheet;
    for (const p of this.pois) {
      const pin = html('button', 'ws-x-pin', `<i></i><span>${p.name}</span>`);
      (pin as HTMLButtonElement).type = 'button';
      const [u, v] = this.toMap(p.x, p.z);
      pin.style.left = `${u * 100}%`; pin.style.top = `${v * 100}%`;
      pin.addEventListener('click', (e) => { e.stopPropagation(); this.flyToPoi(p); });
      this.board.append(pin);
    }
    this.board.addEventListener('click', (e) => {
      const r = this.board.getBoundingClientRect();
      const [x, z] = this.fromMap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      this.flyOver(x, z);
    });
    this.button.addEventListener('click', () => { this.toggle(); });
    this.sheet.querySelector('.ws-x-map-close')?.addEventListener('click', () => { this.close(); });
    this.sheet.querySelector('.ws-x-map-spawn')?.addEventListener('click', () => { this.home(); });
    explore.root.append(this.button, this.sheet);
  }

  get isOpen(): boolean { return this.sheet.classList.contains('show'); }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  open(): void { this.draw(); this.sheet.classList.add('show'); this.update(); }
  close(): void { this.sheet.classList.remove('show'); }

  /** north (+Z) up, east (−X) right — the HUD compass's convention (src/ui/HUD.ts bearingTo) */
  private toMap(x: number, z: number): [number, number] { return [0.5 - x / (CHUNK_HALF * 2), 0.5 - z / (CHUNK_HALF * 2)]; }
  private fromMap(u: number, v: number): [number, number] { return [(0.5 - u) * CHUNK_HALF * 2, (0.5 - v) * CHUNK_HALF * 2]; }

  /** the shard from above, once: sea by depth, sand, grass, rock by slope — from the same heightfield the terrain is */
  private draw(): void {
    if (this.drawn) return;
    this.drawn = true;
    const c = this.board.querySelector('canvas'), g = c?.getContext('2d');
    if (!g) return;
    const img = g.createImageData(RES, RES), d = img.data;
    const sea = this.world.chunk.ocean?.level ?? -Infinity;
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
      const [x, z] = this.fromMap((i + 0.5) / RES, (j + 0.5) / RES);
      const h = heightAt(x, z), [nx, ny, nz] = normalAt(x, z);
      let r: number, gg: number, b: number;
      if (h < sea) { const k = Math.min(1, (sea - h) / 14); r = 40 - 30 * k; gg = 190 - 110 * k; b = 205 - 60 * k; }
      else if (h < sea + 2.4) { r = 232; gg = 214; b = 160; }
      else if (ny < 0.78) { r = 128; gg = 132; b = 142; }
      else { const k = Math.min(1, (h - sea) / 30); r = 100 - 30 * k; gg = 180 - 40 * k; b = 80 - 20 * k; }
      const shade = 0.78 + 0.22 * Math.max(0, nx * -0.5 + ny * 0.7 + nz * 0.5); // a touch of relief, lit from the NW
      const o = (j * RES + i) * 4;
      d[o] = r * shade; d[o + 1] = gg * shade; d[o + 2] = b * shade; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  private flyToPoi(p: ChunkPoi): void {
    const r = p.r ?? 14;
    const ground = Math.max(heightAt(p.x, p.z), this.world.chunk.ocean?.level ?? -Infinity);
    const look = new THREE.Vector3(p.x, ground + r * 0.2, p.z);
    // come in from the side the camera is already on, a little above
    const cam = this.world.game.camera.position;
    const dir = new THREE.Vector3(cam.x - p.x, 0, cam.z - p.z);
    if (dir.lengthSq() < 1) dir.set(0, 0, -1);
    dir.normalize().multiplyScalar(r * 2.4);
    this.close();
    this.explore.flyTo(new THREE.Vector3(p.x + dir.x, ground + r * 1.1, p.z + dir.z), look);
    this.explore.toast(p.name);
  }

  private flyOver(x: number, z: number): void {
    const ground = Math.max(heightAt(x, z), this.world.chunk.ocean?.level ?? -Infinity);
    this.close();
    this.explore.flyTo(new THREE.Vector3(x, ground + 30, z - 30), new THREE.Vector3(x, ground, z));
  }

  private home(): void {
    const s = this.world.chunk.spawn;
    const y = Math.max(heightAt(s.x, s.z), this.world.chunk.ocean?.level ?? -Infinity) + 3;
    const fwd = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    this.close();
    this.explore.flyTo(new THREE.Vector3(s.x, y + 2, s.z), new THREE.Vector3(s.x + fwd.x * 40, y, s.z + fwd.z * 40));
  }

  /** the camera arrow + heading on the map */
  update(): void {
    if (!this.isOpen) return;
    const cam = this.world.game.camera;
    const [u, v] = this.toMap(cam.position.x, cam.position.z);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const ang = Math.atan2(-fwd.x, fwd.z); // the arrow is drawn pointing up (north); screen right = −world X, up = +world Z
    this.arrow.style.left = `${u * 100}%`; this.arrow.style.top = `${v * 100}%`;
    this.arrow.style.transform = `translate(-50%, -50%) rotate(${ang}rad)`;
  }
}
