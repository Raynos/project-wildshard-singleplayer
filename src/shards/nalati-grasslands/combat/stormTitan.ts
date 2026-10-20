import type { TitanCtx, TitanFightHost, TitanPlay, TitanRiders, Puff, Whirl, Chain, StormRider } from './bossBindings';
import { weaponSpecimen } from '../weapons/loadout';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { NALATI_STRIKES, sampleArena } from './strikes';
import { app } from '@wildshard/engine/app/runtime';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { TIER } from '@wildshard/engine/core/tier';
import { setEliteDamage } from '../runtime/eliteBrain';
import { listenPage } from '@wildshard/engine/input/dom';
import type { AimTarget } from '@wildshard/engine/player/AimTargets';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt, terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';







import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { installBossEncounter, type Boss } from '@wildshard/game/Boss';
import { GroundTell } from '@wildshard/game/Elite';

import { fxMaterial, FX, type FxMaterial } from '@wildshard/engine/fx/groundFx';


import { wildEnv } from '../creatures/env';

import layoutRows from '../boot/layout.generated.json' with { type: 'json' };
import { LightningStrip } from '@wildshard/game/weapons/arcPower';
import { NaizagaiPower, type NaizagaiPowerHandle } from '../weapons/nativeMelee';
import { ArenaFireView } from '@wildshard/game/boss/arenaFire';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { createClientScene } from '@wildshard/game/plugin/ui';
import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import { smoothstep } from '@wildshard/engine/core/noise';
import type { TitanFightData, TitanGeometryData } from './titanTypes';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

const { CAIRN } = layoutRows;

type TitanData = TitanFightData & { geometry: TitanGeometryData };
let prepared: TitanData | null = null;
function titanRows(): TitanData { if (prepared === null) throw new Error('Titan rows are not prepared'); return prepared; }
/** Named data is build-validated and read from verified product bytes. */
export async function prepareStormTitan(product: Pick<ShardProduct, 'json'>): Promise<void> {
  const [fight, geometry] = await Promise.all([product.json<TitanFightData>('combat/titan-fight.json'), product.json<TitanGeometryData>('combat/titan-geometry.json')]);
  prepared = { ...fight, geometry };
}

function isMesh(value: unknown): value is THREE.Mesh { return value instanceof THREE.Mesh; }
function isInstances(value: unknown): value is THREE.InstancedMesh { return value instanceof THREE.InstancedMesh; }

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
const _ray = new THREE.Ray(), _sph = new THREE.Sphere(), _hitP = new THREE.Vector3();

// ─────────────────────────────── the body ───────────────────────────────



/** the Titan's body: seven bones, ~340 cloud puffs on them (one InstancedMesh), the heart, the eyes, the spear */
export class TitanBody {
  private readonly data = titanRows();
  readonly root: THREE.Object3D;
  readonly chest: THREE.Object3D;
  readonly head: THREE.Object3D;
  readonly armR: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  readonly armL: [THREE.Object3D, THREE.Object3D, THREE.Object3D];
  readonly puffs: THREE.InstancedMesh;
  readonly heart: THREE.Mesh;
  readonly heartGlow: THREE.Mesh;
  readonly heartRing: THREE.Mesh;
  readonly dome: THREE.Mesh;
  readonly eyes: THREE.Mesh;
  readonly spear: LightningStrip;
  readonly uni = {
    uT: { value: 0 }, uHeart: { value: new THREE.Vector3() }, uGlow: { value: 0.4 }, uFlash: { value: 0 }, uAlpha: { value: 1 },
    uFogC: { value: new THREE.Color(0.3, 0.32, 0.4) }, uFog: { value: 0.1 },
  };
  readonly heartMat: THREE.MeshBasicMaterial;
  readonly glowMat: FxMaterial;
  readonly ringMat: THREE.MeshBasicMaterial;
  readonly domeMat: FxMaterial;
  private readonly list: Puff[] = [];
  private readonly draw: ReturnType<typeof installChannelPrograms>;
  readonly poseState = { rise: 0, bend: 0, kneel: 0, raise: .2, castL: 0, stride: 0, heartOpen: 0 };
  // pose (0..1 each), set by the fight
  visible = false;
  get rise(): number { return this.poseState.rise; }
  set rise(value: number) { this.poseState.rise = value; }

  constructor(scene: THREE.Scene) {
    this.heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 3.8), toneMapped: false, fog: false });
    this.glowMat = fxMaterial(FX.beam, new THREE.Color(.55,.7,2.4), .8);
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6,1.9,.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.domeMat = fxMaterial(FX.dome, new THREE.Color(2,1.6,.7), .85);
    const rows = this.data.geometry.body;
    const loader = new THREE.BufferGeometryLoader();
    const geometry = new Map(Object.entries({ ...rows.geometry, eyes: this.data.geometry.eyes }).map(([id, row]) => [id, loader.parse(row)]));
    const made = createClientScene(rows.scene, { geometry, materials: new Map<string, THREE.Material>([
      ['heart',this.heartMat],['glow',this.glowMat],['ring',this.ringMat],['dome',this.domeMat],
      ['eyes',new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2,3.4,4.2), toneMapped: false, fog: false })],
    ]) });
    const part = (id: string): THREE.Object3D => { const object = made.parts.get(id); if (object === undefined) throw new Error(`Missing Titan bone ${id}`); return object; };
    const mesh = (id: string): THREE.Mesh => { const object = part(id); if (!isMesh(object)) throw new Error(`Missing Titan mesh ${id}`); return object; };
    this.root = part('root'); this.chest = part('chest'); this.head = part('head');
    this.armR = [part('upperR'),part('foreR'),part('handR')]; this.armL = [part('upperL'),part('foreL'),part('handL')];
    this.heart = mesh('heart'); this.heartGlow = mesh('glow'); this.dome = mesh('dome'); this.eyes = mesh('eyes'); this.heartRing = mesh('ring');
    this.root.scale.setScalar(this.data.TITAN_PLACE.bodyScale); scene.add(made.root);
    this.draw = installChannelPrograms(this.data.geometry.poses, 'titan.pose', new Map<string, unknown>([
      ...made.parts, ['pose',this.poseState], ['place',{ ...this.data.TITAN_ARENA.titan, ground: heightAt(CAIRN.x, CAIRN.z) }],
    ]));
    // ── the puffs ──
    const puffRows = (TIER === 'phone' ? this.data.geometry.phone : this.data.geometry.desktop).puffs;
    const bones = new Map([['root', this.root], ['chest', this.chest], ['head', this.head],
      ['upperR', this.armR[0]], ['foreR', this.armR[1]], ['handR', this.armR[2]], ['upperL', this.armL[0]], ['foreL', this.armL[1]], ['handL', this.armL[2]]]);
    for (const row of puffRows) {
      const bone = bones.get(row.bone);
      if (bone === undefined) throw new Error('Titan puff has no retained bone');
      this.list.push({ bone, p: new THREE.Vector3().fromArray(row.p), r: row.r, ph: row.ph });
    }

    const geo = new THREE.IcosahedronGeometry(1, 2);
    // colour: the albedo the cloud lights — the exposed outer puffs full, his core, the skirt and the cloak darker
    geo.setAttribute('aAlbedo', new THREE.InstancedBufferAttribute(new Float32Array(puffRows.flatMap(row => row.colour)), 3));
    // dark cumulus, lightning veins, the heart's spiral (stormTitanLook.ts)
    this.puffs = new THREE.InstancedMesh(geo, lentLook('nalati-titan-cloud'), this.list.length);
    this.puffs.frustumCulled = false; this.puffs.castShadow = false; this.puffs.receiveShadow = false;
    this.puffs.name = 'titan-cloud';
    scene.add(this.puffs);

    this.spear = new LightningStrip(scene, 18, new THREE.Color(2.2, 2.4, 3.8));
    this.setVisible(false);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.puffs.visible = on; this.heart.visible = on; this.eyes.visible = on;
    if (!on) { this.spear.alpha = 0; this.heartRing.visible = false; this.dome.visible = false; }
  }

  /** the heart's world position (after pose()) */
  heartWorld(out: THREE.Vector3): THREE.Vector3 { return this.heart.getWorldPosition(out); }
  handR(out: THREE.Vector3): THREE.Vector3 { return this.armR[2].getWorldPosition(out); }
  handL(out: THREE.Vector3): THREE.Vector3 { return this.armL[2].getWorldPosition(out); }

  pose(t: number, camera: THREE.Camera): void {
    this.draw.evaluate({ time: t, delta: 0, values: {} });
    this.root.updateMatrixWorld(true);
    // the puffs follow their bones, churning
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const pf = L[i];
      if (pf === undefined) continue;
      _v.copy(pf.p).applyMatrix4(pf.bone.matrixWorld);
      const k = pf.r * (1 + 0.08 * Math.sin(t * 0.9 + pf.ph));
      _v.x += Math.sin(t * 0.37 + pf.ph) * 0.5; _v.y += Math.sin(t * 0.29 + pf.ph * 1.7) * 0.5;
      _q.setFromAxisAngle(_w.set(0, 1, 0), t * 0.05 + pf.ph);
      _m.compose(_v, _q, _s.set(k, k * 0.9, k));
      this.puffs.setMatrixAt(i, _m);
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.heartWorld(this.uni.uHeart.value);
    this.uni.uT.value = t;
    // the heart: pulse, and blaze when open
    const open = this.poseState.heartOpen;
    this.heartMat.color.setRGB(1.6 + 1.6 * open, 1.9 + 1.2 * open, 3.8 + 0.4 * open);
    this.glowMat.uniforms.uAlpha.value = 0.55 + 0.45 * open;
    this.glowMat.uniforms.uTime.value = t;
    this.uni.uGlow.value = 0.3 + 0.6 * open;
    // the gold target ring faces you while the heart is open
    this.heartRing.visible = this.visible && open > 0.02;
    if (this.heartRing.visible) {
      this.heartRing.position.copy(this.uni.uHeart.value);
      this.heartRing.lookAt(camera.position);
      this.heartRing.rotateZ(t * 0.8);
      this.ringMat.opacity = open * (0.7 + 0.3 * Math.sin(t * 9));
    }
    this.domeMat.uniforms.uTime.value = t;
    this.syncCloud();
  }

  syncCloud(): void {
    const t = this.uni.uT.value, h = this.uni.uHeart.value, c = this.uni.uFogC.value, look = 'nalati-titan-cloud';
    setLentParam(look, 't', t); setLentParam(look, 'heart', [h.x, h.y, h.z]); setLentParam(look, 'glow', this.uni.uGlow.value);
    setLentParam(look, 'flash', this.uni.uFlash.value); setLentParam(look, 'alpha', this.uni.uAlpha.value);
    setLentParam(look, 'fogC', [c.r, c.g, c.b]); setLentParam(look, 'fog', this.uni.uFog.value);
  }
}

// ─────────────────────────────── the arena: wall, whirlwinds, fire ───────────────────────────────








/** the BossScript: the Titan, his moves, the arena's hazards */
export class StormTitanFight implements BossScript {
  private readonly data = titanRows();
  readonly body: TitanBody;
  phase = 0;
  hp = this.data.TITAN_PLACE.heartHp;
  private invuln = false;
  private fighting = false;
  private open = false;
  private victoryT = -1;
  // the spear
  private spear: 'idle' | 'aim' | 'strike' | 'stuck' = 'idle';
  private spearT = 0; private spearCd = 2.5;
  private readonly spearAt = new THREE.Vector3();
  private readonly spearRing: GroundTell; private readonly spearFork: GroundTell;
  private jagT = 0;
  // phase II
  private stormRiders: StormRider[] = [];
  private readonly lanes: GroundTell[];
  private chargeCd = 2.5;
  private domeBroken = false;
  // phase III
  private readonly burn = new Uint8Array(this.data.TITAN_ARENA.grid * this.data.TITAN_ARENA.grid);      // 0 grass · 1 burning · 2 burnt
  private readonly burnT = new Float32Array(this.data.TITAN_ARENA.grid * this.data.TITAN_ARENA.grid);
  private spreadT = 0; private fireOn = false; private fireDmgT = 0;
  private readonly fire: ArenaFireView; private readonly scorch: THREE.InstancedMesh;
  private scorchN = 0;
  private readonly chains: Chain[];
  private chainCd = 4; private chainLeft = 0; private chainStep = 0;
  private readonly trail: { x: number; z: number }[] = []; private trailT = 0;
  // whirlwinds
  private readonly whirls: Whirl[];
  private readonly debris: THREE.InstancedMesh;
  private whirlCd = 0;
  // the seal
  private readonly wall: THREE.Mesh[]; private readonly wallMat: [FxMaterial,FxMaterial];
  private wallK = 0; private sealed = false;
  private immuneT = 0; private introBolt = false;
  private decisionT = 0;
  private hazardT = 0; private hazardDt = 0;
  private readonly author: ReturnProgram;
  private readonly fireLaw: ReturnProgram;
  private readonly windLaw: ReturnProgram;
  private readonly rules: ReturnProgram;
  private readonly fightDraw: ReturnType<typeof installChannelPrograms>;
  private readonly viewRead = { fighting: 0, victoryT: -1, phase: 0, domeBroken: 0, open: 0, flash: 0 };

  constructor(private readonly ctx: TitanCtx, private readonly host: TitanFightHost) {
    const scene = ctx.game.scene;
    this.author = ReturnProgram.page(this.data.programs.attack, ctx.game.levelScope);
    this.fireLaw = ReturnProgram.page(this.data.programs.fire, ctx.game.levelScope);
    this.windLaw = ReturnProgram.page(this.data.programs.wind, ctx.game.levelScope);
    this.rules = ReturnProgram.page(this.data.programs.rules, ctx.game.levelScope);
    this.body = new TitanBody(scene);
    this.fightDraw = installChannelPrograms(this.data.geometry.poses, 'titan.fight', new Map<string,unknown>([
      ['pose',this.body.poseState],['alpha',this.body.uni.uAlpha],['flash',this.body.uni.uFlash],['fight',this.viewRead],
    ]));
    this.spearRing = new GroundTell(scene, 'ring', new THREE.Color(2.6, 2.0, 0.8));
    this.spearFork = new GroundTell(scene, 'ring', new THREE.Color(2.8, 2.6, 1.6));
    this.lanes = [0, 1, 2].map(() => new GroundTell(scene, 'lane', new THREE.Color(1.2, 2.2, 2.8)));
    this.chains = Array.from({ length: 8 }, () => ({ tell: new GroundTell(scene, 'ring', new THREE.Color(2.4, 2.2, 1.4)), x: 0, z: 0, t: 0, on: false }));
    this.wallMat = [fxMaterial(FX.stream, new THREE.Color(.5,.53,.62), .85, false), fxMaterial(FX.stream, new THREE.Color(.66,.7,.8), .55, false)];
    const rows = this.data.geometry.arena, texture = new THREE.DataTexture(Uint8Array.from(rows.scorch),64,64);
    texture.needsUpdate = true;
    const scorch = new THREE.MeshBasicMaterial({ color: 0x0d0a08, alphaMap: texture, transparent: true, opacity: .88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    scorch.name = 'titan-scorch';
    const made = createClientScene(rows.scene, { geometry: new Map(Object.entries(rows.geometry).map(([id,row]) => [id,new THREE.BufferGeometryLoader().parse(row)])),
      materials: new Map<string,THREE.Material>([['wall0',this.wallMat[0]],['wall1',this.wallMat[1]],['funnel',fxMaterial(FX.stream,new THREE.Color(.66,.62,.55),.75,false)],['debris',new THREE.MeshLambertMaterial({color:0x6a5a44})],['scorch',scorch]]) });
    const mesh = (id: string): THREE.Mesh => { const object = made.parts.get(id); if (!isMesh(object)) throw new Error(`Missing Titan arena mesh ${id}`); return object; };
    const instances = (id: string): THREE.InstancedMesh => { const object = mesh(id); if (!isInstances(object)) throw new Error(`Missing Titan arena instances ${id}`); return object; };
    this.wall = [mesh('wall0'),mesh('wall1')];
    for (const w of this.wall) w.position.set(this.data.TITAN_ARENA.center.x,heightAt(this.data.TITAN_ARENA.center.x,this.data.TITAN_ARENA.center.z)-6,this.data.TITAN_ARENA.center.z);
    this.whirls = [0,1,2].map(i => ({ x: this.data.TITAN_ARENA.center.x + Math.cos(i*2.1)*30, z: this.data.TITAN_ARENA.center.z + Math.sin(i*2.1)*30,
      vx: 0, vz: 0, funnel: mesh(`funnel${i}`), on: false, k: 0 }));
    this.debris = instances('debris'); this.scorch = instances('scorch'); this.debris.count = 0; this.scorch.count = 0;
    scene.add(made.root);
    this.fire = new ArenaFireView(scene, this.data.arenaFire, (TIER === 'phone' ? this.data.geometry.phone : this.data.geometry.desktop).flames);

  }

  // ── BossScript ──
  get hpFrac(): number { return Math.max(0, this.hp / this.data.TITAN_PLACE.heartHp); }
  get shielded(): boolean { return this.phase === 1 && !this.domeBroken; }
  get dead(): boolean { return this.hp <= 0; }
  get heartOpen(): boolean {
    return this.open;
  }
  private heartDecision(amount: number): Readonly<Record<string, number>> {
    return this.rules.project('heart', { phase: this.phase, fighting: Number(this.fighting), invuln: Number(this.invuln),
      mode: ['idle', 'aim', 'strike', 'stuck'].indexOf(this.spear), broke: Number(this.domeBroken), hp: this.hp, amount,
      fullDraw: this.data.TITAN_TUNING.fullDraw, fullDrawMul: this.data.TITAN_TUNING.fullDrawMul });
  }

  inArena(p: THREE.Vector3): boolean { return this.tied && this.host.mounted() && Math.hypot(p.x - this.data.TITAN_ARENA.center.x, p.z - this.data.TITAN_ARENA.center.z) < this.data.TITAN_PLACE.arenaRadius - 2; }
  /** the strip is tied (the cairn's prompt) — the threshold */
  tied = false;
  seal(on: boolean): void { this.sealed = on; }
  clampHp(frac: number): void { this.hp = Math.max(1, Math.round(this.data.TITAN_PLACE.heartHp * frac)); }
  setInvulnerable(on: boolean): void { this.invuln = on; if (on) this.open = false; }
  rewardPoint(): THREE.Vector3 {
    const s = this.cairnSpot();
    const dx = this.data.TITAN_ARENA.center.x - s.x, dz = this.data.TITAN_ARENA.center.z - s.z, l = Math.hypot(dx, dz) || 1;
    const x = s.x + (dx / l) * 3.5, z = s.z + (dz / l) * 3.5;
    return new THREE.Vector3(x, heightAt(x, z) + 1.3, z);
  }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } {
    const s = this.cairnSpot();
    const dx = this.data.TITAN_ARENA.center.x - s.x, dz = this.data.TITAN_ARENA.center.z - s.z, l = Math.hypot(dx, dz) || 1;
    const x = s.x + (dx / l) * 16, z = s.z + (dz / l) * 16;
    return { pos: new THREE.Vector3(x, heightAt(x, z), z), yaw: Math.atan2(-(this.data.TITAN_ARENA.titan.x - x), -(this.data.TITAN_ARENA.titan.z - z)) };
  }
  cairnSpot(): THREE.Vector3 { return this.ctx.tieSpot ?? new THREE.Vector3(CAIRN.x, heightAt(CAIRN.x, CAIRN.z + 3), CAIRN.z + 3); }

  reset(phase: number): void {
    this.phase = phase; this.decisionT = 0;
    this.hp = Math.round(this.data.TITAN_PLACE.heartHp * (this.data.TITAN_PHASES[phase]?.at ?? 1));
    this.fighting = false; this.open = false; this.invuln = false; this.victoryT = -1; this.introBolt = false;
    const b = this.body;
    b.poseState.rise = 0; b.poseState.bend = 0; b.poseState.raise = 0.2; b.poseState.kneel = 0; b.poseState.castL = 0; b.poseState.stride = 0; b.poseState.heartOpen = 0;
    b.uni.uAlpha.value = 1; b.dome.visible = false;
    b.setVisible(false);
    this.spear = 'idle'; this.spearCd = 2.5; this.spearRing.hide(); this.spearFork.hide(); b.spear.alpha = 0;
    this.clearRiders();
    this.domeBroken = false; this.chargeCd = 2.5;
    this.clearFire();
    for (const c of this.chains) { c.on = false; c.tell.hide(); }
    this.chainLeft = 0; this.chainCd = 4;
    for (const w of this.whirls) { w.on = false; w.funnel.visible = false; }
    this.debris.count = 0;
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const b = this.body;
    if (!b.visible) b.setVisible(true);
    const len = short ? 1.2 : 3.2;
    b.poseState.rise = smoothstep(0, 1, t / len);
    b.poseState.kneel = this.phase === 1 ? smoothstep(0, 1, t / len) : 0;
    b.uni.uAlpha.value = this.phase === 1 ? 1 - 0.45 * smoothstep(0, 1, t / len) : 1;
    b.uni.uFlash.value = t > len * 0.7 ? Math.max(0, 1 - (t - len * 0.7) * 2) : 0;
    // his eyes ignite, and the first bolt hits the meadow
    if (!short && t > 2.5 && !this.introBolt) { this.introBolt = true; this.bolt(this.data.TITAN_ARENA.center.x + 18, this.data.TITAN_ARENA.center.z - 10); }
    return b.heartWorld(_hitP);
  }

  begin(phase: number): void {
    this.fighting = true;
    this.body.poseState.rise = 1;
    this.enterPhase(phase);
  }

  enterPhase(phase: number): void {
    const row = this.data.TITAN_PHASE_ACTIONS[phase]; if (row === undefined) throw new Error('Missing Titan phase entry');
    this.phase = phase;
    const b = this.body;
    this.spear = 'idle'; this.spearCd = row.spearCooldown; this.spearRing.hide(); this.spearFork.hide(); b.spear.alpha = 0; b.poseState.bend = 0; b.poseState.raise = .2;
    this.whirls.forEach((w,i) => { w.on = row.whirls[i] === true; });
    if (row.riders) { this.domeBroken = false; this.spawnRiders(); } else this.clearRiders();
    if (row.fire) {
      this.fireOn = true;
      const p = this.host.player.position;
      for (const seed of this.data.TITAN_FIRE_SEEDS) this.ignite(p.x + seed.x, p.z + seed.z);
    }
    if (row.feed) this.host.feed(row.feed);
  }

  update(dt: number, t: number, fighting: boolean): void {
    const b = this.body, p = this.host.player.position;
    this.hazardT += dt; this.hazardDt = this.hazardT >= .1 - 1e-9 ? this.hazardT : 0;
    if (this.hazardDt > 0) this.hazardT = 0;
    // the wall rises / falls with the seal
    this.wallK += ((this.sealed ? 1 : 0) - this.wallK) * Math.min(1, dt * 1.2);
    for (let i = 0; i < this.wall.length; i++) {
      const w = this.wall[i], m = this.wallMat[i];
      if (w === undefined || m === undefined) continue;
      w.visible = this.wallK > 0.02;
      w.scale.y = Math.max(0.02, this.wallK);
      w.rotation.y += dt * (i === 0 ? 0.35 : -0.22);
      m.uniforms.uTime.value = t;
    }
    if (!b.visible && this.victoryT < 0) { this.updateFire(dt, t, false); return; }
    if (this.victoryT >= 0) { this.victoryT += dt; if (this.victoryT > 3.6) b.setVisible(false); }
    Object.assign(this.viewRead, { fighting: Number(fighting), victoryT: this.victoryT, phase: this.phase, domeBroken: Number(this.domeBroken), open: Number(this.heartOpen), flash: this.ctx.weather.weather.flash });
    this.fightDraw.evaluate({ time: t, delta: dt, values: {} });
    const fog = this.ctx.game.scene.fog;
    if (fog) b.uni.uFogC.value.copy(fog.color);
    // the dome
    b.dome.visible = b.visible && this.phase === 1 && !this.domeBroken && this.victoryT < 0;
    this.immuneT -= dt;
    if (fighting && this.victoryT < 0) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.1; this.trail.push({ x: p.x, z: p.z }); if (this.trail.length > 12) this.trail.shift(); }
      this.decisionT += dt;
      const thinkDt = this.decisionT >= .1 - 1e-9 ? this.decisionT : 0;
      if (thinkDt > 0) this.decisionT = 0;
      if (this.phase !== 1) this.updateSpear(dt, t, thinkDt);
      if (this.phase === 1 && thinkDt > 0) this.updateRiders(thinkDt);
      if (this.phase === 2) this.updateChains(dt, t, thinkDt);
      if (thinkDt > 0) this.open = this.heartDecision(0)['open'] === 1;
    }
    this.spearRing.setTime(t); this.spearFork.setTime(t);
    for (const l of this.lanes) l.setTime(t);
    for (const c of this.chains) c.tell.setTime(t);
    this.updateWhirls(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    this.updateFire(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    b.pose(t, this.ctx.game.camera);
    // the spear in his hand (raised) or stuck in the meadow
    this.jagT -= dt;
    if (this.jagT <= 0) {
      this.jagT = 0.07;
      const s = b.spear;
      if (this.spear === 'stuck' || this.spear === 'strike') { b.handR(_v); s.set(_v, this.spearAt, 1.4, 0.55); }
      else if (this.victoryT < 0 && b.visible && this.phase !== 1) { b.handR(_v); b.armR[1].getWorldPosition(_w); _w.sub(_v).multiplyScalar(-1).normalize(); _w.multiplyScalar(34).add(_v); s.set(_v, _w, 0.9, 0.5); }
    }
    b.spear.alpha = b.visible && this.victoryT < 0 && this.phase !== 1 ? (this.spear === 'stuck' ? 1 : 0.85) : 0;
  }

  victory(): void {
    this.victoryT = 0; this.fighting = false; this.open = false;
    this.spear = 'idle'; this.spearRing.hide(); this.spearFork.hide();
    for (const c of this.chains) { c.on = false; c.tell.hide(); }
    for (const l of this.lanes) l.hide();
    this.clearRiders();
    // the rain puts the fire out: every burning cell goes to black
    for (let i = 0; i < this.burn.length; i++) if (this.burn[i] === 1) { this.burn[i] = 2; this.addScorch(i); }
    this.fireOn = false;
    this.fire.out();
    for (const w of this.whirls) w.on = false;
  }

  // ── the heart as a target (main's Targets chain) ──

  private readonly heartTarget: TargetAnimal = {
    kind: 'storm-titan', position: new THREE.Vector3(), alive: true,
    damageFor: () => 40,
    applyDamage: (amount) => this.hitHeart(amount),
  };
  private readonly heartHit: TargetHit = { animal: this.heartTarget, point: new THREE.Vector3(), distance: 0, headshot: false };

  /** the heart as a lock-on target (NALATI-MERGE H3, src/engine/player/LockOnTarget.ts): while he fights, from anywhere in the arena
   *  (`lockRange` — he stands 50–140 m out beyond the rim) — main.ts adds it to the aim list; null otherwise */
  private readonly heartLock: AimTarget = { kind: 'storm-titan', position: new THREE.Vector3(), alive: true, lockable: true, lockRange: 150, dims: { bodyY: 0, bodyRadius: 4 } };
  lockTarget(): AimTarget | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return null;
    this.body.heartWorld(this.heartLock.position); this.heartLock.alive = !this.dead;
    return this.heartLock;
  }

  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return hit;
    const best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist;
    this.body.heartWorld(_hitP);
    _sph.set(_hitP, this.heartOpen ? 7 : 4);   // open: the gold ring (a 110 m giant, 50–140 m out, in a gale)
    _ray.set(origin, dir);
    if (_ray.intersectSphere(_sph, _v) === null) return hit;
    const d = _v.distanceTo(origin);
    if (d > best) return hit;
    this.heartTarget.position.copy(_hitP); this.heartTarget.alive = !this.dead;
    this.heartHit.point.copy(_v); this.heartHit.distance = d; this.heartHit.headshot = this.heartOpen;
    return this.heartHit;
  }

  private hitHeart(amount: number): boolean {
    if (this.dead) return false;
    if (!this.heartOpen) {
      if (this.immuneT <= 0) { this.immuneT = 2.5; this.host.toast(this.phase === 1 ? this.data.TITAN_LINES.immuneDome : this.data.TITAN_LINES.immuneSpear); }
      return false;
    }
    this.hp = this.heartDecision(amount)['hp'] ?? this.hp;
    this.body.uni.uFlash.value = 1;
    return this.hp <= 0;
  }

  // ── I · the Sky Spear ──

  private updateSpear(dt: number, t: number, thinkDt: number): void {
    const b = this.body, p = this.host.player.position;
    if (thinkDt > 0) {
      const answer = this.author.project('spear', { dt: thinkDt, phase: this.phase, mode: ['idle', 'aim', 'strike', 'stuck'].indexOf(this.spear),
        t: this.spearT, cd: this.spearCd, x: this.spearAt.x, z: this.spearAt.z, px: p.x, pz: p.z,
        chain: this.chainLeft, aim: this.data.TITAN_TUNING.spearAim, lock: this.data.TITAN_TUNING.spearLock, stuck: this.data.TITAN_TUNING.spearStuck }, app.rng.stream('ai'));
      const n = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing Titan spear decision'); return value; };
      const mode = (['idle', 'aim', 'strike', 'stuck'] as const)[n('mode')]; if (mode === undefined) throw new Error('Invalid Titan spear mode');
      this.spear = mode; this.spearT = n('t'); this.spearCd = n('cd'); this.spearAt.x = n('x'); this.spearAt.z = n('z');
      if (n('strike') === 1) {
        this.spearAt.y = heightAt(this.spearAt.x, this.spearAt.z); this.bolt(this.spearAt.x, this.spearAt.z);
        if (Math.hypot(p.x - this.spearAt.x, p.z - this.spearAt.z) < this.data.TITAN_TUNING.spearRadius && sampleArena(NALATI_STRIKES.spear, this.spearAt, p, () => { this.host.hurt(this.data.TITAN_TUNING.spearDamage, 'The Sky Spear — keep turning at a canter'); }, app.physics)) this.host.throwRider();
        if (this.phase === 2) this.ignite(this.spearAt.x, this.spearAt.z);
      }
      if (n('stuck') === 1) this.host.feed(this.data.TITAN_LINES.spearStuck);
    }
    // Continuous pose and telegraph drawing observes the last 10 Hz decision.
    if (this.spear === 'idle') { b.poseState.bend += (0 - b.poseState.bend) * Math.min(1, dt * 2); b.poseState.raise += (.2 - b.poseState.raise) * Math.min(1, dt * 2); }
    else if (this.spear === 'aim') {
      b.poseState.raise += (1 - b.poseState.raise) * Math.min(1, dt * 4);
      const pulse = .6 + .4 * Math.sin(t * (this.spearT > this.data.TITAN_TUNING.spearAim - this.data.TITAN_TUNING.spearLock ? 30 : 12));
      this.spearRing.ring(this.spearAt.x, this.spearAt.z, this.data.TITAN_TUNING.spearRadius, .95 * pulse);
      this.spearFork.ring(this.spearAt.x, this.spearAt.z, this.data.TITAN_TUNING.spearRadius * (.3 + .7 * (1 - this.spearT / this.data.TITAN_TUNING.spearAim)), .8 * pulse);
    } else { b.poseState.bend += (1 - b.poseState.bend) * Math.min(1, dt * 5); if (this.spear === 'strike') b.poseState.raise += (0 - b.poseState.raise) * Math.min(1, dt * 8); }
    if (this.spear !== 'aim') { this.spearRing.hide(); this.spearFork.hide(); }
  }

  // ── II · the Three Winds ──

  private spawnRiders(): void {
    this.clearRiders();
    const gr = this.host.riders();
    if (gr === null) { this.domeBroken = true; return; }
    for (let i = 0; i < 3; i++) {
      const x = this.data.TITAN_ARENA.titan.x + (i - 1) * 18, z = this.data.TITAN_ARENA.center.z - this.data.TITAN_PLACE.arenaRadius + 10;
      const a = gr.spawnRider({ x, z, yaw: 0, variant: 'rider', storm: true });
      if (a === null) continue;
      a.maxHp = this.data.TITAN_TUNING.riderHp; a.hp = this.data.TITAN_TUNING.riderHp;
      const lane = this.lanes[i] ?? this.lanes[0];
      if (lane === undefined) continue;
      const r: StormRider = { a, mode: 'circle', t: 0, th: i * 2.09, lane, x0: 0, z0: 0, x1: 0, z1: 0, hit: false };
      // the flank is open 2 s after a pass: the sabre ×3; arrows ×0.5 always
      setEliteDamage(a, (_a, hitPoint) => {
        const pl = this.host.player.position;
        return this.rules.project('riderDamage', { x: hitPoint.x, z: hitPoint.z, px: pl.x, pz: pl.z, radius: a.scale, open: Number(r.mode === 'open') })['alpha'] ?? 1;
      });
      this.stormRiders.push(r);
    }
  }

  private clearRiders(): void {
    const gr = this.host.riders();
    for (const r of this.stormRiders) { r.lane.hide(); if (r.a.alive && gr !== null) { r.a.alive = false; gr.dissolve(r.a); } }
    this.stormRiders = [];
    for (const l of this.lanes) l.hide();
  }

  private updateRiders(dt: number): void {
    const p = this.host.player.position;
    const riders = this.stormRiders;
    const coupling = this.rules.project('couple', { dt, px: p.x, pz: p.z, count: riders.length, hp: this.hp,
      cd: this.chargeCd, invuln: Number(this.invuln), chip: this.data.TITAN_TUNING.riderChip * this.data.TITAN_PLACE.heartHp }, app.rng.stream('ai'),
    riders.map(r => ({ hit: Number(r.a.alive), mode: ['circle', 'aim', 'charge', 'open'].indexOf(r.mode), x: r.a.position.x, z: r.a.position.z })));
    this.hp = coupling['hp'] ?? this.hp; this.chargeCd = coupling['cd'] ?? this.chargeCd;
    const selected = riders[coupling['index'] ?? -1];
    if (selected !== undefined) Object.assign(selected, { mode: 'aim', t: 0, x0: coupling['x0'], z0: coupling['z0'], x1: coupling['x1'], z1: coupling['z1'] });
    for (let i = riders.length - 1; i >= 0; i--) {
      const r = riders[i]; if (r === undefined) continue;
      if (((coupling['mask'] ?? 0) & (1 << i)) !== 0) {
        r.lane.hide(); riders.splice(i, 1);
        this.host.feed(riders.length > 0 ? `${this.data.TITAN_LINES.riderBreaks} · ${riders.length} left` : this.data.TITAN_LINES.lastRider);
        continue;
      }
      const a = r.a, m = a.mem;
      const answer = this.author.project('rider', { dt, px: p.x, pz: p.z, ax: a.position.x, az: a.position.z,
        mode: ['circle', 'aim', 'charge', 'open'].indexOf(r.mode), t: r.t, theta: r.th, hit: Number(r.hit),
        x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, lane: this.data.TITAN_TUNING.laneSeconds, flank: this.data.TITAN_TUNING.flankSeconds });
      const n = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing Titan rider decision'); return value; };
      const mode = (['circle', 'aim', 'charge', 'open'] as const)[n('mode')]; if (mode === undefined) throw new Error('Invalid Titan rider mode');
      r.mode = mode; r.t = n('t'); r.th = n('theta'); r.hit = n('hit') === 1;
      m['tx'] = n('x'); m['tz'] = n('z'); m['v'] = n('speed'); m['turn'] = n('turn');
      if (n('show') === 1) r.lane.lane(r.x0, r.z0, r.x1, r.z1, 4.2, n('alpha')); else r.lane.hide();
      if (n('hurt') === 1 && sampleArena(NALATI_STRIKES.wind, a.position, p, () => { this.host.hurt(this.data.TITAN_TUNING.chargeDamage, 'Wind Charge — swerve out of the lane'); }, app.physics)) this.host.throwRider();
    }
    if (coupling['broke'] === 1 && !this.domeBroken) { this.domeBroken = true; this.body.uni.uFlash.value = 1; }
  }

  // ── III · the grass fire + chain lightning ──

  private cellOf(x: number, z: number): number {
    const i = Math.floor((x - (this.data.TITAN_ARENA.center.x - this.data.TITAN_PLACE.arenaRadius)) / this.data.TITAN_TUNING.cell), j = Math.floor((z - (this.data.TITAN_ARENA.center.z - this.data.TITAN_PLACE.arenaRadius)) / this.data.TITAN_TUNING.cell);
    return i < 0 || j < 0 || i >= this.data.TITAN_ARENA.grid || j >= this.data.TITAN_ARENA.grid ? -1 : j * this.data.TITAN_ARENA.grid + i;
  }
  private cellX(c: number): number { return this.data.TITAN_ARENA.center.x - this.data.TITAN_PLACE.arenaRadius + ((c % this.data.TITAN_ARENA.grid) + 0.5) * this.data.TITAN_TUNING.cell; }
  private cellZ(c: number): number { return this.data.TITAN_ARENA.center.z - this.data.TITAN_PLACE.arenaRadius + (Math.floor(c / this.data.TITAN_ARENA.grid) + 0.5) * this.data.TITAN_TUNING.cell; }
  private inside(c: number): boolean { return Math.hypot(this.cellX(c) - this.data.TITAN_ARENA.center.x, this.cellZ(c) - this.data.TITAN_ARENA.center.z) < this.data.TITAN_PLACE.arenaRadius - 2; }
  /** a burning cell (for the horse's refusal, the HUD) */
  burningAt(x: number, z: number): boolean { const c = this.cellOf(x, z); return c >= 0 && this.burn[c] === 1; }

  private ignite(x: number, z: number): void {
    const c = this.cellOf(x, z);
    if (c < 0 || this.burn[c] !== 0 || !this.inside(c)) return;
    this.burn[c] = 1; this.burnT[c] = this.fireLaw.project('ignite', { burn: this.data.TITAN_TUNING.burnSeconds }, app.rng.stream('ai'))['burn'] ?? this.data.TITAN_TUNING.burnSeconds;
  }
  private addScorch(c: number): void {
    if (this.scorchN >= this.scorch.instanceMatrix.count) return;
    const x = this.cellX(c) + (app.rng.stream('cosmetic').next() - 0.5) * 2.4, z = this.cellZ(c) + (app.rng.stream('cosmetic').next() - 0.5) * 2.4;
    // lying on the slope (a flat decal floats off the rim's fall), turned at random
    const n = normalAt(x, z);
    _q.setFromUnitVectors(_w.set(0, 1, 0), _v.set(n[0], n[1], n[2]).normalize());
    _q.multiply(_q2.setFromAxisAngle(_w.set(0, 1, 0), app.rng.stream('cosmetic').next() * 6.28));
    _m.compose(_v.set(x, heightAt(x, z) + 0.08, z), _q, _s.set(0.8 + app.rng.stream('cosmetic').next() * 0.5, 1, 0.8 + app.rng.stream('cosmetic').next() * 0.5));
    this.scorch.setMatrixAt(this.scorchN++, _m);
    this.scorch.count = this.scorchN; this.scorch.instanceMatrix.needsUpdate = true;
    wildEnv.trample(x, z, this.data.TITAN_TUNING.cell * 0.6, 1, 0, 0);   // the grass burnt flat
  }
  private clearFire(): void {
    this.burn.fill(0); this.burnT.fill(0);
    this.scorchN = 0; this.scorch.count = 0; this.fire.clear(); this.fireOn = false;
  }

  private updateFire(dt: number, t: number, live: boolean, thinkDt = 0): void {
    this.fire.update(dt, t, wind.dirX, wind.dirZ, wind.speed, this.body.uni.uFogC.value, this.body.uni.uFlash.value);
    if (!this.fireOn) return;
    if (thinkDt > 0 && live) {
      this.spreadT -= thinkDt;
      const spread = this.spreadT <= 0; if (spread) this.spreadT = .25;
      const next: number[] = [];
      for (let c = 0; c < this.burn.length; c++) {
        if (this.burn[c] !== 1) continue;
        const i = c % this.data.TITAN_ARENA.grid, j = Math.floor(c / this.data.TITAN_ARENA.grid);
        const neighbours = this.data.FIRE_NEIGHBOURS.map(([x, z]) => ({ x, z, cell: (j + z) * this.data.TITAN_ARENA.grid + i + x }))
          .filter(row => i + row.x >= 0 && i + row.x < this.data.TITAN_ARENA.grid && j + row.z >= 0 && j + row.z < this.data.TITAN_ARENA.grid);
        const result = this.fireLaw.project('fire', { dt: thinkDt, burn: this.burnT[c] ?? 0, spread: Number(spread), count: neighbours.length, wx: wind.dirX, wz: wind.dirZ },
          app.rng.stream('ai'), neighbours.map(row => ({ ...row, mode: this.burn[row.cell] ?? 2 })));
        this.burnT[c] = result['burn'] ?? 0;
        if ((this.burnT[c] ?? 0) <= 0) { this.burn[c] = 2; this.addScorch(c); }
        neighbours.forEach((row, at) => { if (((result['mask'] ?? 0) & (1 << at)) !== 0) next.push(row.cell); });
      }
      for (const c of next) this.ignite(this.cellX(c), this.cellZ(c));
    }
    // burn down; draw the flames: each cell rises, roars and sinks to embers; the downwind front stands tallest; smoke rolls off
    const fx = this.fire;
    fx.begin();
    const wx = wind.dirX, wz = wind.dirZ;
    const smokeRate = TIER === 'phone' ? 0.8 : 1.5;
    for (let c = 0; c < this.burn.length; c++) {
      if (this.burn[c] !== 1) continue;
      const bt = this.burnT[c] ?? 0;
      const x = this.cellX(c), z = this.cellZ(c), y = heightAt(x, z) - 0.15;
      const age = this.data.TITAN_TUNING.burnSeconds - bt;
      const heat = Math.min(1, age / 0.9) * Math.min(1, bt / 2.2);
      // the front: the next cell downwind is still grass
      const nc = this.cellOf(x + wx * this.data.TITAN_TUNING.cell, z + wz * this.data.TITAN_TUNING.cell);
      const front = nc >= 0 && this.burn[nc] === 0 ? 1 : 0;
      fx.flame(x + Math.sin(c * 3.1) * 0.8, y, z + Math.cos(c * 2.3) * 0.8, c, heat, front, 1.5);
      if (app.rng.stream('cosmetic').next() < dt * smokeRate * (0.4 + heat)) fx.puff(x, y, z, heat);
    }
    fx.end();
    if (!live || thinkDt <= 0) return;
    // the player in fire: 8 / s; the horse panics near it
    const p = this.host.player.position;
    let near = false;
    if (this.host.mounted()) for (let a = 0; a < 6 && !near; a++) near = this.burningAt(p.x + Math.cos(a) * 5, p.z + Math.sin(a) * 5);
    const contact = this.fireLaw.project('fireContact', { dt: thinkDt, cd: this.fireDmgT, hit: Number(this.burningAt(p.x,p.z)), open: Number(near), amount: this.data.TITAN_TUNING.fireDps });
    this.fireDmgT = contact['cd'] ?? this.fireDmgT;
    if ((contact['hurt'] ?? 0) > 0) sampleArena(NALATI_STRIKES.fire, p, p, () => { this.host.hurt(contact['hurt'] ?? 0, this.data.TITAN_LINES.burning); }, app.physics);
    if ((contact['speed'] ?? 0) < 0) this.host.horseSteed(contact['speed'] ?? 0);

  }

  private updateChains(dt: number, t: number, thinkDt: number): void {
    const b = this.body, p = this.host.player.position;
    if (thinkDt > 0) {
      const result = this.author.project('chain', { dt: thinkDt, cd: this.chainCd, chain: this.chainLeft, t: this.chainStep, mode: Number(this.spear === 'idle'), count: this.trail.length }, app.rng.stream('ai'));
      this.chainCd = result['cd'] ?? this.chainCd; this.chainLeft = result['left'] ?? this.chainLeft; this.chainStep = result['t'] ?? this.chainStep;
      if (result['strike'] === 1) {
        const tr = this.trail[result['index'] ?? 0] ?? p, ring = this.chains.find(row => !row.on);
        if (ring) { ring.on = true; ring.t = 0; ring.x = tr.x; ring.z = tr.z; }
      }
    }
    b.poseState.castL += ((this.chainLeft > 0 ? 1 : 0) - b.poseState.castL) * Math.min(1, dt * 4);
    for (const ring of this.chains) {
      if (!ring.on) continue;
      ring.tell.ring(ring.x, ring.z, this.data.TITAN_TUNING.chainRadius, .85 * (.6 + .4 * Math.sin(t * 24)));
      if (thinkDt <= 0) continue;
      const result = this.author.project('chainLand', { dt: thinkDt, t: ring.t, land: this.data.TITAN_TUNING.chainLand, radius: this.data.TITAN_TUNING.chainRadius, x: ring.x, z: ring.z, px: p.x, pz: p.z });
      ring.t = result['t'] ?? ring.t;
      if (result['strike'] === 1) {
        ring.on = false; ring.tell.hide(); this.bolt(ring.x, ring.z); this.ignite(ring.x, ring.z);
        if (result['hurt'] === 1) sampleArena(NALATI_STRIKES.chain, _v.set(ring.x, p.y, ring.z), p, () => { this.host.hurt(this.data.TITAN_TUNING.chainDamage, this.data.TITAN_LINES.chain); }, app.physics);
      }
    }
  }

  // ── whirlwinds ──

  private updateWhirls(dt: number, t: number, live: boolean, thinkDt: number): void {
    const p = this.host.player.position;

    let n = 0;
    for (let wi = 0; wi < this.whirls.length; wi++) {
      const w = this.whirls[wi];
      if (w === undefined) continue;
      const want = live && w.on ? 1 : 0;
      w.k += (want - w.k) * Math.min(1, dt * 1.2);
      w.funnel.visible = w.k > 0.02;
      if (!w.funnel.visible) continue;
      let hurt = false;
      if (thinkDt > 0) {
        const result = this.windLaw.project('whirl', { dt: thinkDt, t, index: wi, x: w.x, z: w.z, vx: w.vx, vz: w.vz,
          cx: this.data.TITAN_ARENA.center.x, cz: this.data.TITAN_ARENA.center.z, radius: this.data.TITAN_PLACE.arenaRadius, wx: wind.dirX, wz: wind.dirZ,
          cd: this.whirlCd, hit: Number(wi === 0), px: p.x, pz: p.z, flank: this.data.TITAN_TUNING.whirlRadius, open: Number(live) });
        w.x = result['x'] ?? w.x; w.z = result['z'] ?? w.z; w.vx = result['vx'] ?? w.vx; w.vz = result['vz'] ?? w.vz;
        if (wi === 0 || result['hurt'] === 1) this.whirlCd = result['cd'] ?? this.whirlCd;
        hurt = result['hurt'] === 1;
      }
      const gy = heightAt(w.x, w.z);
      w.funnel.position.set(w.x, gy - 0.5, w.z);
      w.funnel.rotation.y += dt * 5;
      w.funnel.scale.set(w.k, w.k * (1 + 0.06 * Math.sin(t * 3 + wi)), w.k);
      // its debris: a rising spiral
      for (let i = 0; i < 40; i++) {
        const u = ((i / 40) + t * 0.35 + wi * 0.13) % 1, ang = t * 4 + i * 2.4, rr = 1 + u * 5.5;
        _m.compose(_v.set(w.x + Math.cos(ang) * rr, gy + u * 13, w.z + Math.sin(ang) * rr), _q.setFromAxisAngle(_w.set(0.3, 1, 0.2).normalize(), t * 6 + i), _s.setScalar(w.k * (0.6 + (i % 5) * 0.2)));
        this.debris.setMatrixAt(n++, _m);
      }
      // touching it lifts you out of the saddle
      if (hurt && sampleArena(NALATI_STRIKES.whirl, _v.set(w.x, gy, w.z), p, () => { this.host.hurt(this.data.TITAN_TUNING.whirlDamage, 'A whirlwind — ride around them'); }, app.physics)) this.host.throwRider();
    }
    this.debris.count = n; this.debris.instanceMatrix.needsUpdate = true;
  }

  // ── a strike from the sky ──
  private bolt(x: number, z: number): void {
    const y = heightAt(x, z);
    this.ctx.weather.fx.bolt({ x, y, z, kind: 'ground' });
    this.ctx.weather.weather.flash = 1;
    this.body.uni.uFlash.value = 1;
    wildEnv.onEvent?.('lightning', x, z);
  }

  /** the storm wall and the fire line the horse will not ride into */
  refuses(x: number, z: number): boolean {
    if (this.sealed && Math.hypot(x - this.data.TITAN_ARENA.center.x, z - this.data.TITAN_ARENA.center.z) > this.data.TITAN_PLACE.arenaRadius - 3) return true;
    return this.fighting && this.phase === 2 && this.burningAt(x, z);
  }
  get sealedNow(): boolean { return this.sealed; }
}

// ─────────────────────────────── the wiring ───────────────────────────────



export class StormTitan {
  private readonly data = titanRows();
  readonly fight: StormTitanFight;
  readonly spareLight = new THREE.PointLight(0xc8dcff, 0, 1, 2);
  ui: BossBar | null = null;
  boss: Boss | null = null;
  naizagai: NaizagaiPowerHandle | null = null;
  /** B11's ghost riders (the storm riders ride their rig) — handed in by src/shards/nalati-grasslands/index.ts */
  riders: TitanRiders | null = null;
  private play: TitanPlay | null = null;
  private readonly prompt: Interactable;
  private decisionT = 0; private wallCooldown = 0;
  private readonly author: ReturnProgram;
  private skipTouch = false; private skipEnter = false;
  private hurtWhy = ''; private hurtT = 0;

  constructor(private readonly ctx: TitanCtx) {
    this.author = ReturnProgram.page(this.data.programs.rules, ctx.game.levelScope);
    const host: TitanFightHost = {
      player: ctx.player,
      hurt: (d, why) => {
        // the same reason toasts at most every 4 s (the fire ticks twice a second)
        const say = why !== this.hurtWhy || this.hurtT <= 0;
        if (say) { this.hurtWhy = why; this.hurtT = 4; }
        this.play?.hurt(d, say ? why : '');
      },
      throwRider: () => { const m = this.play?.ride?.mount; if (m?.mounted === true) m.dismount(true); },
      mounted: () => this.play?.ride?.mount.mounted === true,
      horseSteed: (d) => { const m = this.play?.ride?.mount; if (m) m.steed = Math.max(0, m.steed + d); },
      feed: (s) => { this.play?.feed(s); },
      toast: (s) => { this.play?.toast(s); },
      riders: () => this.play?.riders ?? this.riders,
      animals: () => this.play?.animals ?? null,
    };
    this.fight = new StormTitanFight(ctx, host);
    this.spareLight.position.set(this.data.TITAN_ARENA.titan.x, -60, this.data.TITAN_ARENA.titan.z);
    ctx.game.scene.add(this.spareLight);
    const spot = this.fight.cairnSpot();
    this.prompt = { position: new THREE.Vector3(spot.x, spot.y + 1.2, spot.z), radius: 0, label: this.data.TITAN_LINES.tie, onInteract: () => { this.tie(); } };
  }

  get engaged(): boolean { return this.boss?.engaged === true; }

  bind(play: TitanPlay): void {
    this.play = play;
    const { game, player } = this.ctx;
    const god = play.params.has('bossGod');
    if (god) { const hurt = play.hurt; play.hurt = (d, why) => { if (!this.engaged) hurt(d, why); }; }
    this.naizagai = new NaizagaiPower({
      scene: game.scene, player, camera: game.camera, animals: play.animals,
      weather:this.ctx.weather.weather,scope:game.levelScope,
    });
    const encounter = installBossEncounter({ definition: this.data.TITAN_ENCOUNTER, reward: this.data.TITAN_REWARD }, () => this.fight, {
      game, player, spareLight: this.spareLight, scope: game.levelScope, chunkId: 'nalati-grasslands', interactables: play.interactables,
      reward: { model: () => weaponSpecimen('naizagai', game.sky), grant: () => {
        if (this.naizagai) play.upgradeSabre?.(this.naizagai);
        play.ownSkin?.(this.data.TITAN_SKIN.id); play.toast(this.data.TITAN_SKIN.toast);
      } },
      lockInput: on => { play.setWeaponsEnabled(!on); player.moveScale = on ? 0 : 1; },
      respawn: (pos, yaw) => { this.respawnMounted(pos, yaw); play.refill(); },
      skipHeld: () => this.skipEnter || this.skipTouch || app.input.held('jump') || app.input.held('use'),
      toast: play.toast, feed: play.feed,
      ...(play.persistence === undefined ? {} : { persistence: play.persistence }),
      ...(play.music ? { music: play.music } : {}), ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    });
    this.ui = encounter.ui; this.boss = encounter.boss;
    play.interactables.push(this.prompt);
    if (this.boss.rewardTaken) play.upgradeSabre?.(this.naizagai);
    // the horse refuses the storm wall and the fire line
    const ride = play.ride;
    if (ride) { const prev = ride.refuse; ride.refuse = (x, z) => this.fight.refuses(x, z) || (prev?.(x, z) ?? false); }
    listenPage(game.levelScope, 'keydown', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipEnter = true; });
    listenPage(game.levelScope, 'keyup', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipEnter = false; });
    listenPage(game.levelScope, 'pointerdown', () => { this.skipTouch = true; });
    listenPage(game.levelScope, 'pointerup', () => { this.skipTouch = false; });
    listenPage(game.levelScope, 'pointercancel', () => { this.skipTouch = false; });
    // dev: `?boss=storm-titan` — a storm, mounted at the cairn, the strip tied; `&bossPhase=2|3` at that checkpoint
    if (play.params.get('boss') === 'storm-titan') {
      this.ctx.weather.air.force('storm', 0.1);
      const r = this.fight.respawnPoint();
      this.respawnMounted(r.pos, r.yaw);
      this.fight.tied = true;
      const ph = Number(play.params.get('bossPhase') ?? '1');
      if (ph > 1) this.boss.devStartAt(ph - 1); else this.boss.arm();
    }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.titan', this));
  }

  /** a death: in the fight → back at the cairn, mounted (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  /** the cairn's prompt: only mounted, only in a natural storm */
  private tie(): void {
    const play = this.play, boss = this.boss;
    if (!play || !boss || this.engaged || boss.state === 'victory' && boss.reward !== null) return;
    if (play.ride?.mount.mounted !== true) { play.toast(this.data.TITAN_LINES.wantsRider); return; }
    if (!this.ctx.weather.weather.stormActive) { play.toast(this.data.TITAN_LINES.quiet); return; }
    this.fight.tied = true;
    if (boss.state === 'victory') boss.disarm();
    boss.arm();
    play.toast(this.data.TITAN_LINES.wakes);
  }

  /** back at the cairn in the saddle: Tulpar / Argymaq if you have him, else a camp horse */
  private respawnMounted(pos: THREE.Vector3, yaw: number): void {
    const { player } = this.ctx;
    player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0;
    const ride = this.play?.ride, w = this.play?.wildlife;
    if (!ride) return;
    const m = ride.mount;
    if (m.mounted) m.dismount();
    const horses = [ride.taming.tulpar, ...(w?.campHorses ?? [])];
    for (const h of horses) {
      if (h === null || !m.canRide(h)) continue;
      h.place(pos.x, pos.z, yaw + Math.PI);
      if (m.mount(h)) { m.teleport(pos.x, pos.z, yaw + Math.PI); m.steed = 100; m.winded = false; return; }
    }
  }

  update(dt: number, t: number): void {
    const boss = this.boss, play = this.play;
    this.naizagai?.update(dt, t);
    this.hurtT -= dt;
    if (!boss || !play) return;
    this.decisionT += dt;
    if (this.decisionT >= .1 - 1e-9) {
      const p = this.ctx.player.position;
      const result = this.author.project('boundary', { dt: this.decisionT, px: p.x, pz: p.z, cx: this.data.TITAN_ARENA.center.x, cz: this.data.TITAN_ARENA.center.z,
        radius: this.data.TITAN_PLACE.arenaRadius, mounted: Number(play.ride?.mount.mounted === true), storm: Number(this.ctx.weather.weather.stormActive),
        engaged: Number(this.engaged), sealed: Number(this.fight.sealedNow), armed: Number(boss.state === 'armed'), victory: Number(boss.state === 'victory'), tied: Number(this.fight.tied), wall: this.wallCooldown });
      this.decisionT = 0; this.wallCooldown = result['wall'] ?? 0;
      this.prompt.radius = result['radius'] ?? 0;
      this.prompt.label = result['label'] === 1 ? this.data.TITAN_LINES.tieOnFoot : result['label'] === 2 ? this.data.TITAN_LINES.tieQuiet : this.data.TITAN_LINES.tie;
      if (result['disarm'] === 1) { this.fight.tied = false; boss.disarm(); }
      p.x = result['x'] ?? p.x; p.z = result['z'] ?? p.z;
      if (result['hurt'] === 1) sampleArena(NALATI_STRIKES.wall, p, p, () => { play.hurt(10, this.data.TITAN_LINES.wall); }, app.physics);
      if (result['clear'] === 1) { this.fight.tied = false; this.ctx.weather.air.force('clearing'); play.record?.('storm-titan', 'jel-ata'); }
    }
    if (boss.state !== 'dormant' || this.fight.body.visible) boss.update(dt, t);
    else this.fight.update(dt, t, false);
  }

  /** the heart in main's Targets chain */
  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null { return this.fight.target(origin, dir, maxDist, hit); }
  /** the heart for the lock-on while he fights (H3), else null */
  lockTarget(): AimTarget | null { return this.fight.lockTarget(); }
}

/** the wiring's one call (src/shards/nalati-grasslands/index.ts): the Titan's meshes built at boot (before the precompile), bound later */
export function wireStormTitan(ctx: TitanCtx): StormTitan { return new StormTitan(ctx); }
