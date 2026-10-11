import { app } from '@wildshard/engine/app/runtime';
import { ads as blendAds } from '@wildshard/engine/combat/blocks/ads';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import { Firearm } from '@wildshard/engine/combat/Firearm';
import type { Targets } from '@wildshard/engine/combat/types';
import { brassFloor, stepBrass } from '@wildshard/engine/combat/view/brass';
import { HitLine, makeFlashTexture } from '@wildshard/engine/combat/view/firearmFx';
import { hitscan, type HitscanProfile } from '@wildshard/engine/combat/view/hitscan';
import { Puffs, fovForAspect, FOV_HIP, FOV_ADS, isMesh, whiteColors, worldHit, type RangedOptions, type RangedWorld } from '@wildshard/engine/combat/view/ranged';
import type { WeaponState, AimInfo } from '@wildshard/engine/combat/Weapon';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { sstep, clamp01 } from '@wildshard/engine/player/viewmodelTextures';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';

/**
 * The magazine firearm family (SHARD-PLATFORM SF36): a semi-automatic, magazine-fed hitscan gun whose model is the shard's
 * parts and whose numbers and view are rows. One round per trigger pull (`profile.interval` min), a magazine plus reserve,
 * `profile.reload` s reload on Reload or automatically when the trigger is pulled on an empty magazine. Hitscan along
 * `aimRay()` (the camera forward): the physics world's first hit and `Targets.raycast` for the animals short of it, the
 * nearer wins. Muzzle flash (two additive quads for `view.flash.frames` frames plus a pooled point light for
 * `view.flash.lightTime`), pooled brass from `view.port`, camera kick, a short red tracer when the 'tracers' setting is on,
 * impact puffs and `onImpact` / `onHit` so audio and combat feedback need no weapon-specific wiring.
 *
 * ADS = shouldered iron sights: model rotation 0, the sight line `profile.ads.sightY` above the bore on the eye, the rear
 * aperture as close as the near plane allows (near + `profile.ads.nearMargin`). FOV hip → ADS through `fovForAspect`.
 *
 *   const rifle = new MagazineFirearm(world, targets, { row, profile, parts: buildRifleParts, view: RIFLE_VIEW });
 */

/** The numbers the family reads: the hitscan's, the magazine and its timing, the kick and bloom, brass, tracers and ADS. */
export interface MagazineFirearmProfile extends HitscanProfile {
  magazine: number; reserve: number; interval: number; reload: number; autoReload: number; kick: number;
  bloomShot: number; bloomMax: number;
  brass: { count: number; life: number }; tracer: { count: number };
  ads: { blend: number; motion: number; nearMargin: number; sightY: number; rearZ: number; frontZ: number; muzzleZ: number };
}

/**
 * The gun's parts in model space (−Z the bore, +Y up, the bore axis at y 0), every one on the viewmodels' shared lit
 * program: the three body meshes, the charging handle, the bolt and the magazine (the three the viewmodel animates; the
 * magazine at `magRest`), the rear sight's glow (hidden: shown sighted) and the ejected brass's material.
 */
export interface MagazineFirearmParts {
  readonly alu: THREE.Mesh; readonly poly: THREE.Mesh; readonly steel: THREE.Mesh;
  readonly handle: THREE.Mesh; readonly bolt: THREE.Mesh; readonly mag: THREE.Mesh; readonly magRest: THREE.Vector3;
  readonly glowRing: THREE.Mesh; readonly glow: THREE.MeshBasicMaterial;
  readonly aluMat: THREE.MeshPhysicalMaterial; readonly polyMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial; readonly brassMat: THREE.MeshPhysicalMaterial;
}

/** The family's view as rows (metres, seconds, radians). */
export interface MagazineFirearmView {
  /** the hip pose (lower right) and the model's scale */
  readonly hip: { readonly px: number; readonly py: number; readonly pz: number; readonly rx: number; readonly ry: number; readonly rz: number; readonly scale: number };
  /** the ejection port in model space, where the brass leaves */
  readonly port: readonly [number, number, number];
  /** the ejected case: radius and length */
  readonly brassCase: readonly [number, number];
  /** the muzzle flash: quads shown `frames` frames, the light `lightTime` s at `light` intensity in `colour`, the quad size */
  readonly flash: { readonly frames: number; readonly lightTime: number; readonly light: number; readonly colour: number; readonly size: number };
  /** the tracer line's life (s) */
  readonly tracer: number;
}

export interface MagazineFirearmOptions<P extends MagazineFirearmProfile> extends RangedOptions {
  profile: P;
  /** the gun's model, built at the viewmodel's build from the scene's sky */
  parts: (sky: Sky) => MagazineFirearmParts;
  view: MagazineFirearmView;
  /**
   * Take the muzzle-flash light from the scene's LightPool at boot (default). A shard where the gun can't be found passes
   * false: its flash is the quads only and every lit program there keeps one point light fewer.
   */
  muzzleLight?: boolean;
}

interface Brass { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; down: boolean; /** where it lands (PHYSICS P7: ray-landed at the eject) */ floor: number }

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** A magazine firearm: the shard's parts and rows on the platform's trigger, hitscan, brass, flash, tracer and pose. */
export class MagazineFirearm<P extends MagazineFirearmProfile = MagazineFirearmProfile> extends Firearm {
  readonly profile: P;
  readonly view: MagazineFirearmView;
  readonly state: WeaponState & { ammo: number };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  holster = 0;
  aimInfo: AimInfo | null = null;
  private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };

  readonly model = new THREE.Group();
  private game: RangedWorld['game']; private sky: RangedWorld['sky']; private player: RangedWorld['player'];
  private targets: Targets | undefined;
  private active = true;
  private readonly buildParts: (sky: Sky) => MagazineFirearmParts;
  private readonly port: THREE.Vector3;

  // animated parts
  private mag!: THREE.Mesh; private magRest = new THREE.Vector3(); private handle!: THREE.Mesh; private bolt!: THREE.Mesh;
  private flash = new THREE.Group(); private flashQuads: THREE.Mesh[] = []; private flashLight: THREE.PointLight; private flashFrames = 0; private flashLightT = 0;
  private rearGlow!: THREE.Material;
  private glowRing!: THREE.Mesh;
  /** geometry + material pairs for `displayModel()` (a world pickup) */
  private displayParts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos?: THREE.Vector3 }[] = [];
  private brass: Brass[] = [];
  private brassMat!: THREE.MeshStandardMaterial;
  private tracers: HitLine[] = []; private tracerRes = new THREE.Vector2();
  private puffs = new Puffs();

  // animation state
  private cooldown = 0; private reloadT = 0;
  private recoil = 0; private kickPending = 0; private kickApplied = 0; private bloom = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;
  private time = 0;
  /** tracer line life (s) — a dev knob for screenshots */
  tracerLife: number;
  /** hip pose (lower-right); a dev knob: `__weapons.get('rifle').hip.py = …` */
  readonly hip: { px: number; py: number; pz: number; rx: number; ry: number; rz: number; scale: number };
  /** the solved shouldered pose (dev / verification: `__weapons.get('rifle').adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, scale: 1, rearDepth: 0, frontDepth: 0, muzzleDepth: 0 };

  constructor(world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmOptions<P>) {
    super(opts.row);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.profile = opts.profile;
    this.view = opts.view;
    this.buildParts = opts.parts;
    this.hip = { ...opts.view.hip };
    this.tracerLife = opts.view.tracer;
    this.port = new THREE.Vector3(...opts.view.port);
    this.state = { ammo: this.profile.magazine, magazine: this.profile.magazine, reserve: this.profile.reserve, loaded: true, reloading: false, reloadProgress: 0, ads: false };
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    // the muzzle light is a pooled scene light (B7), taken now, at boot: in the viewmodel it came and went with the
    // model's visibility, and every change of the scene's light count recompiled every lit program in view (taking the
    // gun mid-play: 28 programs). Dark at rest, lit by intensity only, placed at the muzzle in world space when it fires.
    const flash = opts.view.flash;
    this.flashLight = opts.muzzleLight === false ? new THREE.PointLight(flash.colour, 0, 8, 2) : LightPool.for(this.game.scene).acquire(flash.colour, 0, 8, 2);
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildEffects();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);
  }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.bindInput(ctx);
    ctx.scope.onDispose(() => { this.model.removeFromParent(); });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('aim', () => { this.mouseAds = !this.mouseAds; }, ctx.scope, allowed);
    app.input.bind('reload', () => { this.reload(); }, ctx.scope, allowed);
    app.input.onReset(() => { this.mouseAds = false; }, ctx.scope);
  }

  override setActive(on: boolean): void {
    this.active = on;
    this.model.visible = on;
    if (!on) { this.enabled = false; this.mouseAds = false; }
  }

  /** the pooled muzzle light, just ahead of the muzzle, in world space (the pool's group sits at the scene origin) */
  private placeFlashLight(): void {
    this.model.updateWorldMatrix(true, false);
    this.model.localToWorld(this.flashLight.position.set(0, 0.03, this.profile.ads.muzzleZ + 0.1));
  }

  /** Pull the trigger: one round if the mag has one, else a dry click and (after a beat) a reload. */
  protected override actionReady(): boolean { return this.cooldown <= 0; }

  override reload(): void {
    if (this.state.reloading || this.state.ammo >= this.profile.magazine || this.state.reserve <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  addRounds(n: number): void { this.state.reserve += n; }

  protected override fire(): void {
    const s = this.state, flash = this.view.flash;
    s.ammo--; s.loaded = s.ammo > 0;
    this.cooldown = this.profile.interval;
    this.recoil = 1; this.kickPending = this.profile.kick;
    this.flashFrames = flash.frames; this.flashLightT = flash.lightTime;
    for (const q of this.flashQuads) { q.rotation.z = app.rng.stream('cosmetic').next() * Math.PI * 2; q.scale.setScalar(0.8 + app.rng.stream('cosmetic').next() * 0.5); }
    this.flash.visible = true; this.flashLight.intensity = flash.light; this.placeFlashLight();
    this.onFire?.(); // before the hit resolves: Combat registers the aimed shot, the damage float then closes it
    this.hitscan();
    this.ejectBrass();
    this.bloom = Math.min(this.profile.bloomMax, this.bloom + this.profile.bloomShot);
    this.onShot();
  }

  private hitscan(): void {
    const result = hitscan((origin, dir) => this.aimRay(origin, dir), this.targets, this.profile, this.adsBlend, this.bloom, this.player.speedFactor);
    const { point, direction, surface, hit, killed } = result;
    if (hit) this.onHit?.(hit.animal.kind, hit.headshot, killed);
    _d.copy(direction);
    if (getSetting('tracers')) {
      const tr = this.tracers.reduce((acc, x) => (x.t0 < acc.t0 ? x : acc));
      this.model.updateMatrixWorld();
      this.model.localToWorld(_v3.set(0, 0.004, this.profile.ads.muzzleZ));
      tr.show(_v3, point, this.time);
    }
    if (surface) {
      this.puffs.emit(point, _d, surface);
      this.onImpact?.(surface, point);
    }
  }

  // ── viewmodel ──
  private buildViewmodel() {
    const p = this.buildParts(this.sky);
    const { alu: meshA, poly: meshP, steel: meshS, glowRing, aluMat, polyMat, steelMat } = p;
    const handleGeo = p.handle.geometry, magGeo = p.mag.geometry;
    this.brassMat = p.brassMat; this.handle = p.handle; this.bolt = p.bolt; this.mag = p.mag; this.magRest.copy(p.magRest); this.rearGlow = p.glow;
    this.model.add(meshA, meshP, meshS, this.handle, this.bolt, this.mag, glowRing);
    this.displayParts.push({ geo: meshA.geometry, mat: aluMat }, { geo: meshP.geometry, mat: polyMat }, { geo: meshS.geometry, mat: steelMat }, { geo: handleGeo, mat: steelMat }, { geo: magGeo, mat: polyMat, pos: this.magRest.clone() });
    this.glowRing = glowRing;

    // ── muzzle flash: two additive quads (one facing, one along the bore) + a point light, shown `flash.frames` frames ──
    const flashTex = makeFlashTexture();
    const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const fq = new THREE.PlaneGeometry(this.view.flash.size, this.view.flash.size);
    const q1 = new THREE.Mesh(fq, flashMat); const q2 = new THREE.Mesh(fq, flashMat); q2.rotation.y = Math.PI / 2; q2.position.z = -0.06; q2.scale.set(1.4, 0.6, 1);
    this.flashQuads.push(q1, q2);
    this.flash.add(q1, q2);
    this.flash.position.set(0, 0.002, this.profile.ads.muzzleZ - 0.02);
    this.flash.visible = false;
    this.model.add(this.flash);

    // The engine clears depth once for all viewmodels before this transparent queue.
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.renderOrder = this.flashQuads.includes(m) ? 1001 : 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; if (mat !== flashMat) mat.depthWrite = true; }
    });
  }

  /** A world-space copy of the gun for a pickup: the same geometry + materials (one program), no depth clearer / flash /
   *  light, normal render order, casts a shadow; bore along -Z, origin at the receiver. */
  displayModel(): THREE.Group {
    const g = new THREE.Group();
    for (const { geo, mat, pos } of this.displayParts) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      if (pos) m.position.copy(pos);
      g.add(m);
    }
    return g;
  }

  private buildEffects() {
    const [radius, length] = this.view.brassCase;
    const caseGeo = new THREE.CylinderGeometry(radius, radius, length, 8); caseGeo.rotateX(Math.PI / 2); whiteColors(caseGeo); // brassMat reads vertex colours
    for (let i = 0; i < this.profile.brass.count; i++) {
      const mesh = new THREE.Mesh(caseGeo, this.brassMat);
      mesh.visible = false; mesh.frustumCulled = false;
      this.game.scene.add(mesh);
      this.brass.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, down: false, floor: 0 });
    }
    for (let i = 0; i < this.profile.tracer.count; i++) this.tracers.push(new HitLine(this.game.scene));
  }

  private ejectBrass() {
    const b = this.brass.find((x) => x.life <= 0) ?? this.brass.reduce((a, x) => (x.life < a.life ? x : a));
    const cam = this.game.camera;
    this.model.updateMatrixWorld();
    this.model.localToWorld(b.mesh.position.copy(this.port));
    _v1.set(1, 0, 0).applyQuaternion(cam.quaternion); // camera right
    _v2.set(0, 1, 0).applyQuaternion(cam.quaternion);
    cam.getWorldDirection(_v3);
    b.vel.copy(_v1).multiplyScalar(2.2 + app.rng.stream('cosmetic').next() * 0.8).addScaledVector(_v2, 1.6 + app.rng.stream('cosmetic').next() * 0.6).addScaledVector(_v3, -0.4 + app.rng.stream('cosmetic').next() * 0.3);
    b.spin.set((app.rng.stream('cosmetic').next() - 0.5) * 30, (app.rng.stream('cosmetic').next() - 0.5) * 30, (app.rng.stream('cosmetic').next() - 0.5) * 30);
    b.mesh.quaternion.copy(cam.quaternion).multiply(_q.setFromAxisAngle(_v1.set(0, 1, 0), Math.PI / 2));
    b.life = this.profile.brass.life; b.down = false; b.mesh.visible = true;
    b.floor = brassFloor(b.mesh.position, b.vel) + 0.005;
  }

  private stepBrass(dt: number): void { stepBrass(this.brass, dt); }

  /** Shouldered pose: rotation 0, sight line on the eye, rear aperture at near + margin. Depends on the scale only. */
  private solveAds(scale: number) {
    const o = this.adsPose, cam = this.game.camera;
    if (o.scale === scale && o.rearDepth > 0) return o;
    o.scale = scale;
    o.rearDepth = cam.near + this.profile.ads.nearMargin;
    o.px = 0; o.py = -this.profile.ads.sightY * scale; o.pz = -o.rearDepth - this.profile.ads.rearZ * scale;
    o.frontDepth = -(o.pz + this.profile.ads.frontZ * scale); o.muzzleDepth = -(o.pz + this.profile.ads.muzzleZ * scale);
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera, s = this.state, flash = this.view.flash;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceEmpty += dt;
    this.bloom = Math.max(0, this.bloom - dt * 2.4);

    // auto reload: the mag ran dry on a trigger pull
    if (this.autoReloadDue()) this.reload();
    this.reloadStep(dt);
    this.animateAction(t, dt);

    // muzzle flash: `flash.frames` frames of quads, the light for `flash.lightTime`
    if (this.flashFrames > 0 && --this.flashFrames === 0) this.flash.visible = false;
    if (this.flashLightT > 0) { this.flashLightT -= dt; this.flashLight.intensity = this.flashLightT <= 0 ? 0 : flash.light * clamp01(this.flashLightT / flash.lightTime); this.placeFlashLight(); }

    // ADS + FOV (only the held weapon owns the camera FOV)
    if (p.sprinting || !this.enabled) this.mouseAds = false; // sprinting / pause / holster drop the RMB toggle
    s.ads = (this.mouseAds || this.adsHeld) && this.enabled && !s.reloading && !p.sprinting;
    this.adsBlend = blendAds(this.adsBlend, s.ads, dt, this.profile.ads.blend);
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (this.active && Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (up on fire, recovered over ~0.2 s)
    this.recoil *= Math.exp(-dt * 14);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, this.profile.kick * dt * 60); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 9); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring, substepped)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload ↔ holster
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = s.reloading ? Math.sin(Math.min(1, s.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt;
    const port = portrait, scale = this.hip.scale * (1 - port * 0.12); // portrait phone: a touch smaller, held a little further out
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.014 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.011 * sf, bobRz = Math.cos(p.bobTime) * 0.018 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.009 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil;
    // hip: lower-right, muzzle a touch in toward the centre
    let { px, py, pz, rx, ry, rz } = this.hip;
    px += sp * -0.06; py += sp * -0.08; pz += sp * 0.05; rx += sp * 0.30; ry += sp * 0.5; rz += sp * -0.12;
    px += rt * -0.05; py += rt * -0.04; pz += rt * 0.03; rx += rt * 0.22; ry += rt * -0.2; rz += rt * 0.35;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.045; py += rc * 0.008; rx += rc * 0.06; rz += rc * -0.015; // kick back + muzzle up
    px *= 1 - port * 0.35; py *= 1 + port * 0.25; pz *= 1 + port * 0.35;
    if (a > 0) {
      const ads = this.solveAds(scale), m = this.profile.ads.motion;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.004, az = ads.pz + rc * 0.02;
      const arx = (bobRx + lagRx) * m + rc * 0.035, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.01;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }
    this.glowRing.visible = a > 0.001; (this.rearGlow as THREE.MeshBasicMaterial).opacity = a * 0.85;
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.3; pz += h * 0.06; rx -= h * 0.5; rz += h * 0.2; }
    this.model.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 16) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout (held weapon only)
    if (this.active && this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_o, _d);
      const wall = worldHit(_o, _v2.copy(_o).addScaledVector(_d, 120), 0); // an animal behind a wall shows no range (P5-L2)
      const hit = this.targets.raycast(_o, _d, wall?.distance ?? 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBrass(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, this.tracerRes, this.tracerLife);
  }
  protected override animateAction(_t: number, _dt: number): void {
    const s = this.state;
    // magazine: drops out (0–30 %), gone (30–60 %), the fresh one comes up (60–85 %); charging handle racks at 88–100 %
    const pr = s.reloading ? s.reloadProgress : 0;
    const out = s.reloading ? (pr < 0.3 ? sstep(0.05, 0.3, pr) : pr < 0.6 ? 1 : 1 - sstep(0.6, 0.85, pr)) : 0;
    this.mag.position.set(this.magRest.x, this.magRest.y - out * 0.16, this.magRest.z - out * 0.03);
    this.mag.rotation.x = out * 0.3;
    this.mag.visible = out < 0.999;
    const rack = s.reloading ? Math.sin(sstep(0.88, 1, pr) * Math.PI) : 0;
    this.handle.position.z = rack * 0.05; this.bolt.position.z = rack * 0.05;
  }
  protected override autoReloadDue(): boolean {
    const s = this.state;
    return !s.reloading && s.ammo <= 0 && s.reserve > 0 && this.sinceEmpty > this.profile.autoReload && this.active && this.enabled;
  }
  protected override reloadStep(dt: number): void {
    const s = this.state;
    if (s.reloading) {
      this.reloadT += dt;
      const pr = Math.min(1, this.reloadT / this.profile.reload);
      s.reloadProgress = pr;
      if (pr >= 1) {
        const take = Math.min(this.profile.magazine - s.ammo, s.reserve);
        s.ammo += take; s.reserve -= take; s.loaded = s.ammo > 0;
        s.reloading = false; s.reloadProgress = 0;
        this.onReloadEnd?.();
      }
    }
  }
}

/** A shard's gun as a row: its default profile, its parts and its view. */
export interface MagazineFirearmRow<P extends MagazineFirearmProfile> {
  readonly profile: P;
  readonly parts: (sky: Sky) => MagazineFirearmParts;
  readonly view: MagazineFirearmView;
}
/** Construction of a row-bound gun: its equipment row, an optional profile over the row's and the muzzle light. */
export interface MagazineFirearmRowOptions<P extends MagazineFirearmProfile> extends RangedOptions {
  profile?: P;
  muzzleLight?: boolean;
}
/** The constructor a row binds: `new Gun(world, targets, { row })`, as every other held weapon is built. */
export interface MagazineFirearmType<P extends MagazineFirearmProfile> {
  new (world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmRowOptions<P>): MagazineFirearm<P>;
  readonly prototype: MagazineFirearm<P>;
}
/**
 * Bind a shard's row to the family (SHARD-PLATFORM SF36): the shard writes data and a model, never a subclass.
 *
 *   export const Rifle = magazineFirearmType({ profile: AR15, parts: buildRifleParts, view: RIFLE_VIEW });
 *   const rifle = new Rifle(world, targets, { row: AR15_ROW, allowUnlocked });
 */
export function magazineFirearmType<P extends MagazineFirearmProfile>(row: MagazineFirearmRow<P>): MagazineFirearmType<P> {
  return class extends MagazineFirearm<P> {
    constructor(world: RangedWorld, targets: Targets | undefined, opts: MagazineFirearmRowOptions<P>) {
      super(world, targets, { ...opts, profile: opts.profile ?? row.profile, parts: row.parts, view: row.view });
    }
  };
}
