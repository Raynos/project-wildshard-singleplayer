/** Shared HUD + Weapon Explorer: a 100 × 100 m enclosed grid room and three hit-reactive humanoid dummies. */
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Physics } from '../physics/Physics';
import { addTrainingTarget, trainingTargetRaycast } from '../physics/trainingTargets';
import type { Player } from '../player/Player';
import type { TargetAnimal, TargetHit } from '../player/Crossbow';
import type { Weapons } from '../player/Weapons';
import type { WorldRegistry, ColliderDesc } from '../world/registry';
import { buildTrainingDummy, DUMMY_VARIANTS, type DummyVariant, type TrainingDummyModel } from './TrainingDummy';
import { loadTrainingDummy } from './TrainingDummyAssets';
import './arena.css';

const HALF_WIDTH = 50, HALF_DEPTH = 50, WALL_HEIGHT = 9;
const Y = 900; // an isolated room high over each shard; existing world geometry and AI never enter it
const CYAN = 0x75d9ff;

interface FloatingText { el: HTMLElement; point: THREE.Vector3; time: number }

class TrainingTarget implements TargetAnimal {
  readonly kind = 'training-dummy';
  readonly alive = true; // practice targets never die or stop accepting combos
  readonly position: THREE.Vector3;
  readonly dims = { bodyY: 0.94, bodyRadius: 0.4, bodyHalfLen: 0.4 };
  model: TrainingDummyModel;
  ready = false;
  readonly variant: DummyVariant;
  readonly label: HTMLElement;
  private flinch = 0;
  private phase = 0;
  onDamage: (amount: number, point: THREE.Vector3) => void = () => undefined;

  constructor(variant: DummyVariant, x: number, y: number, z: number, localX: number, localZ: number, layer: HTMLElement) {
    this.variant = variant;
    this.position = new THREE.Vector3(x, y, z);
    const root = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
    const leftArm = new THREE.Group(), rightArm = new THREE.Group();
    root.add(torso); torso.add(head, leftArm, rightArm);
    this.model = { root, torso, head, leftArm, rightArm };
    this.model.root.position.set(localX, 0, localZ);
    const label = document.createElement('div'); label.className = 'ws-practice-label';
    label.textContent = DUMMY_VARIANTS.find((v) => v.id === variant)?.label ?? variant;
    layer.append(label); this.label = label;
  }

  install(model: TrainingDummyModel): void {
    const previous = this.model.root;
    model.root.position.copy(previous.position);
    const parent = previous.parent;
    if (parent) { parent.remove(previous); parent.add(model.root); }
    this.model = model;
    this.ready = true;
  }

  damageFor(headshot: boolean, distance: number): number {
    const base = this.variant === 'straw-cloth' ? 39 : this.variant === 'wood' ? 30 : 22;
    return Math.round(base * (headshot ? 2.2 : 1) * Math.max(0.7, 1 - distance / 160));
  }

  headWorld(out: THREE.Vector3): THREE.Vector3 { out.copy(this.position); out.y += 1.58; return out; }

  applyDamage(amount: number, point: THREE.Vector3): boolean {
    const armor = this.variant === 'wood-steel' ? 0.62 : this.variant === 'wood' ? 0.82 : 1;
    const dealt = Math.max(1, Math.round(amount * armor));
    this.flinch = Math.min(1, this.flinch + (dealt > 45 ? 0.85 : 0.55));
    this.onDamage(dealt, point);
    return false;
  }

  stagger(_dir: THREE.Vector3, strength: number): void { this.flinch = Math.min(1, this.flinch + strength * 0.16); }

  update(dt: number): void {
    this.phase += dt;
    this.flinch = Math.max(0, this.flinch - dt * 2.6);
    const sway = Math.sin(this.phase * 1.7) * 0.012;
    this.model.torso.rotation.z = sway + this.flinch * 0.12;
    this.model.torso.rotation.x = -this.flinch * 0.09;
    this.model.head.rotation.z = -this.flinch * 0.14;
    this.model.leftArm.rotation.z = -0.09 - this.flinch * 0.17;
    this.model.rightArm.rotation.z = 0.09 + this.flinch * 0.17;
  }
}

function makeRoom(cx: number, cz: number): { root: THREE.Group; colliders: ColliderDesc[] } {
  const root = new THREE.Group(); root.name = 'HUD + Weapon Explorer · grid arena';
  root.position.set(cx, Y, cz);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x0b1726, fog: false });
  const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x07101d, side: THREE.DoubleSide, fog: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, HALF_DEPTH * 2).rotateX(-Math.PI / 2), floorMaterial);
  floor.position.y = -0.03; root.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, HALF_DEPTH * 2).rotateX(Math.PI / 2), wallMaterial);
  ceiling.position.y = WALL_HEIGHT; root.add(ceiling);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, WALL_HEIGHT), wallMaterial);
  back.position.set(0, WALL_HEIGHT / 2, -HALF_DEPTH); root.add(back);
  const front = back.clone(); front.position.z = HALF_DEPTH; root.add(front);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(HALF_DEPTH * 2, WALL_HEIGHT), wallMaterial);
  side.rotation.y = Math.PI / 2; side.position.set(-HALF_WIDTH, WALL_HEIGHT / 2, 0); root.add(side);
  const other = side.clone(); other.position.x = HALF_WIDTH; root.add(other);

  // All grid strokes are one line-segment draw call; stronger corner strokes give the box a VR-stage silhouette.
  const lines: number[] = [];
  const push = (a: readonly number[], b: readonly number[]): void => { lines.push(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, b[0] ?? 0, b[1] ?? 0, b[2] ?? 0); };
  for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 2) push([x, 0.015, -HALF_DEPTH], [x, 0.015, HALF_DEPTH]);
  for (let z = -HALF_DEPTH; z <= HALF_DEPTH; z += 2) push([-HALF_WIDTH, 0.015, z], [HALF_WIDTH, 0.015, z]);
  for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 2) {
    push([x, 0.02, -HALF_DEPTH + 0.01], [x, WALL_HEIGHT, -HALF_DEPTH + 0.01]);
    push([x, 0.02, HALF_DEPTH - 0.01], [x, WALL_HEIGHT, HALF_DEPTH - 0.01]);
  }
  for (let z = -HALF_DEPTH; z <= HALF_DEPTH; z += 2) {
    push([-HALF_WIDTH + 0.01, 0.02, z], [-HALF_WIDTH + 0.01, WALL_HEIGHT, z]);
    push([HALF_WIDTH - 0.01, 0.02, z], [HALF_WIDTH - 0.01, WALL_HEIGHT, z]);
  }
  for (let h = 2; h <= WALL_HEIGHT; h += 2) {
    push([-HALF_WIDTH, h, -HALF_DEPTH + 0.01], [HALF_WIDTH, h, -HALF_DEPTH + 0.01]);
    push([-HALF_WIDTH, h, HALF_DEPTH - 0.01], [HALF_WIDTH, h, HALF_DEPTH - 0.01]);
    push([-HALF_WIDTH + 0.01, h, -HALF_DEPTH], [-HALF_WIDTH + 0.01, h, HALF_DEPTH]);
    push([HALF_WIDTH - 0.01, h, -HALF_DEPTH], [HALF_WIDTH - 0.01, h, HALF_DEPTH]);
  }
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.29, depthWrite: false, fog: false, toneMapped: false }));
  root.add(grid);
  const corners: number[] = [];
  for (const x of [-HALF_WIDTH, HALF_WIDTH]) for (const z of [-HALF_DEPTH, HALF_DEPTH]) corners.push(x, 0, z, x, WALL_HEIGHT, z);
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(corners, 3)), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9, fog: false, toneMapped: false })));
  const ambient = new THREE.AmbientLight(0xabcce2, 0.45); root.add(ambient);
  const key = new THREE.PointLight(0xcfe8ff, 40, 35); key.position.set(-4, 7, 5); root.add(key);
  const fill = new THREE.PointLight(0x78b9d7, 25, 28); fill.position.set(6, 6, -5); root.add(fill);
  root.visible = false;
  const colliders: ColliderDesc[] = [
    { kind: 'box', x: cx, y: Y - 0.14, z: cz, hx: HALF_WIDTH, hy: 0.14, hz: HALF_DEPTH },
    { kind: 'box', x: cx, y: Y + WALL_HEIGHT / 2, z: cz - HALF_DEPTH, hx: HALF_WIDTH, hy: WALL_HEIGHT / 2, hz: 0.22 },
    { kind: 'box', x: cx, y: Y + WALL_HEIGHT / 2, z: cz + HALF_DEPTH, hx: HALF_WIDTH, hy: WALL_HEIGHT / 2, hz: 0.22 },
    { kind: 'box', x: cx - HALF_WIDTH, y: Y + WALL_HEIGHT / 2, z: cz, hx: 0.22, hy: WALL_HEIGHT / 2, hz: HALF_DEPTH },
    { kind: 'box', x: cx + HALF_WIDTH, y: Y + WALL_HEIGHT / 2, z: cz, hx: 0.22, hy: WALL_HEIGHT / 2, hz: HALF_DEPTH },
  ];
  return { root, colliders };
}

export class TrainingArena {
  readonly targets: TrainingTarget[];
  private readonly root: THREE.Group;
  private readonly overlay: HTMLElement;
  private readonly floats: FloatingText[] = [];
  private active = false;
  private modelsReady = false;
  private loadPromise: Promise<void> | null = null;
  private readonly preparation: HTMLElement;
  private readonly center: { x: number; z: number };

  constructor(private readonly game: Game, registry: WorldRegistry, private readonly physics: Physics, center: { x: number; z: number }) {
    this.center = center;
    const { root, colliders } = makeRoom(center.x, center.z);
    this.root = root;
    registry.add({ id: 'practice-arena', name: 'HUD + Weapon Explorer arena', category: 'ground', file: 'src/practice/TrainingArena.ts', object: root, colliders, surface: 'metal', solidFloor: true });
    const overlay = document.createElement('div'); overlay.className = 'ws-practice'; overlay.innerHTML = '<div class="ws-practice-title">HUD + WEAPON EXPLORER <small>TRAINING ARENA</small></div>';
    document.getElementById('hud')?.append(overlay); this.overlay = overlay;
    const preparation = document.createElement('div'); preparation.className = 'ws-practice-preparing'; preparation.textContent = 'PREPARING TRAINING TARGETS';
    overlay.append(preparation); this.preparation = preparation;
    this.targets = DUMMY_VARIANTS.map((v, i) => {
      // The outer targets stand back: 8.5 m between neighbors while all three fit a portrait first view.
      const localX = (i - 1) * 6, localZ = i === 1 ? -7 : -13;
      const x = center.x + localX, z = center.z + localZ;
      const target = new TrainingTarget(v.id, x, Y, z, localX, localZ, overlay);
      addTrainingTarget(physics, target, x, Y, z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.012, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: CYAN, fog: false, toneMapped: false }));
      ring.position.set(localX, 0.01, localZ); root.add(ring);
      target.onDamage = (amount, point) => { this.float(String(amount), point, 'hit'); };
      return target;
    });
    // Dummies are children of the room for visibility; their static solid bodies and separate hitboxes live in Rapier.
    for (const target of this.targets) root.add(target.model.root);
    game.onUpdate((dt) => { if (this.active) this.update(dt); }, 'training-arena');
  }

  get entered(): boolean { return this.active; }

  private async prepareModels(): Promise<void> {
    await Promise.all(this.targets.map(async (target) => {
      try { target.install(await loadTrainingDummy(target.variant)); }
      catch (error) {
        console.warn(`[practice] ${target.variant} mesh unavailable; using procedural fallback`, error);
        target.install(buildTrainingDummy(target.variant));
      }
    }));
    this.modelsReady = true;
    this.preparation.hidden = true;
  }

  enter(player: Player, weapons: Weapons): void {
    this.active = true; this.root.visible = true; this.overlay.classList.add('show');
    document.dispatchEvent(new CustomEvent('ws:practice-active', { detail: true }));
    this.overlay.parentElement?.classList.add('practice-active');
    this.preparation.hidden = this.modelsReady;
    this.loadPromise ??= this.prepareModels();
    weapons.select(weapons.list[0]?.id ?? weapons.current.id, true);
    player.spawn(this.center.x, this.center.z + 5, 0, Y);
  }

  exit(): void {
    this.active = false; this.root.visible = false; this.overlay.classList.remove('show');
    document.dispatchEvent(new CustomEvent('ws:practice-active', { detail: false }));
    this.overlay.parentElement?.classList.remove('practice-active');
    for (const f of this.floats) f.el.remove();
    this.floats.length = 0;
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null {
    if (!this.active || !this.modelsReady) return null;
    const hit = trainingTargetRaycast(this.physics, origin, dir, maxDist);
    const target = this.targets.find((t) => t === hit?.target);
    return hit && target ? { animal: target, point: new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z), distance: hit.distance, headshot: hit.headshot } : null;
  }

  miss(point: THREE.Vector3): void { if (this.active) this.float('MISS', point, 'miss'); }

  private float(value: string, point: THREE.Vector3, tone: 'hit' | 'miss'): void {
    const el = document.createElement('div'); el.className = `ws-practice-float ${tone}`; el.textContent = value;
    this.overlay.append(el); this.floats.push({ el, point: point.clone(), time: 0 });
  }

  private update(dt: number): void {
    for (const target of this.targets) {
      target.update(dt);
      const p = target.position.clone().add(new THREE.Vector3(0, 2.05, 0)).project(this.game.camera);
      target.label.style.display = target.ready && p.z < 1 ? '' : 'none';
      target.label.style.transform = `translate(${Math.round((p.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-p.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -50%)`;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; if (!f) continue;
      f.time += dt;
      if (f.time > 0.85) { f.el.remove(); this.floats.splice(i, 1); continue; }
      const p = f.point.clone().add(new THREE.Vector3(0, 0.25 + f.time * 0.6, 0)).project(this.game.camera);
      f.el.style.opacity = String(1 - f.time / 0.85);
      f.el.style.transform = `translate(${Math.round((p.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-p.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -50%)`;
    }
  }
}
