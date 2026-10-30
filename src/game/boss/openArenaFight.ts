import * as THREE from 'three';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import type { AimTarget } from '@wildshard/engine/player/AimTargets';
import { setEliteDamage } from '@wildshard/engine/entities/eliteBrain';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { wind } from '@wildshard/engine/world/steppeWind';
import type { ArenaScriptData, ArenaScriptRows } from '@wildshard/format/arenaScriptRows';
import { ARENA_BURNT_PER_FRAME, ARENA_VIEW, arenaChainTell } from '@wildshard/format/arenaView';
import { V2_ACTION_OPS, type V2ActionBinding } from '@wildshard/format/scriptActionsV2';
import { ReturnProgram, ProjectedState } from '../population/returnProgram';
import { installChannelPrograms } from '../plugin/channelPrograms';
import { CellField } from '../systems/cellField';
import { lendViewArray, lendViewCell, lendViewDraw, lendViewFrame, lendViewTell, lendViewValues } from '../shardfile/clientViewProgram';
import { prepareV2WorldActions, type V2WorldActionLoan } from '../shardfile/worldActionsV2';
import type { GroundTell } from '../Elite';
import type { Mount } from '../riding/mount';
import type { ArenaBoundary } from '../riding/client';
import type { WeatherReactions } from '../weather/reactions';
import type { wildEnv } from '../population/pageGroups';
import type { ArenaFireView, ArenaWhirlsView } from './arenaFire';
import type { ArenaSceneView, CloudBody, PatrolEncounterView } from './encounterView';

/** The fight's looks, as the parts it calls (the page passes its views; the Node simulation its own). */
export type ArenaBodyPort = Pick<CloudBody, 'alpha' | 'flash' | 'fogColour' | 'part' | 'setVisible' | 'visible' | 'aim' | 'update' | 'focusWorld'>;
export type ArenaScenePort = Pick<ArenaSceneView, 'tell' | 'tells' | 'instances' | 'mesh' | 'update'>;
export type ArenaFirePort = Pick<ArenaFireView, 'update' | 'smoke' | 'flames'>;
export type ArenaWhirlsPort = Pick<ArenaWhirlsView, 'arm' | 'reset' | 'update' | 'bindView'>;
/** Each look made once, in the fight's construction order: the body (over the fight's pose), the arena, its whirl funnels
 *  (over the arena, the wind law, the attack program and the level scope) and the fire. */
export interface OpenArenaViews {
  readonly body: (pose: Readonly<Record<string, number>>) => ArenaBodyPort;
  readonly arena: () => ArenaScenePort;
  readonly whirls: (arena: ArenaScenePort, wind: ReturnProgram, author: ReturnProgram, scope: Scope) => ArenaWhirlsPort;
  readonly fire: () => ArenaFirePort;
  /** the whirlwind rows' admission against the attack program's bindings (ArenaWhirlsView.preflight), run in place */
  readonly whirlsPreflight: (rows: ArenaScriptData['whirls'], bindings: ReturnType<typeof ReturnProgram.projectionBindings>) => void;
}
/** The fight's world: its level's scope (its programs' owner), the weather it reads and raises, the cairn spot, the AI
 *  random stream, the scene's fog and camera (its body's look), the wildlife it alerts and flattens grass for, and whether
 *  the page is the phone tier (the smoke's rate). */
export interface OpenArenaFightWorld {
  readonly scope: Scope; readonly weather: Pick<WeatherReactions, 'stormActive' | 'flash' | 'raise'>; readonly tieSpot: THREE.Vector3 | null;
  readonly ai: () => Rng; readonly fog: () => { readonly color: THREE.Color } | null; readonly camera: THREE.Camera;
  readonly wild: Pick<typeof wildEnv, 'trample' | 'onEvent'>; readonly phone: boolean;
}
/** What the fight asks of its encounter: the player, the boss's state, the mount, contacts and the HUD lines. */
export interface OpenArenaFightHost {
  readonly player: { readonly position: THREE.Vector3 }; readonly boss: { readonly state: string } | null; readonly engaged: boolean;
  readonly mounted: () => boolean; readonly contact: (name: string, origin: THREE.Vector3, amount: number, why: string) => boolean;
  readonly throwRider: () => void; readonly horseSteed: (amount: number) => void; readonly feed: (message: string) => void;
  readonly toast: (message: string) => void; readonly riderOwner: () => PatrolEncounterView | null;
}
interface SupportActor { readonly a: Animal; readonly lane: GroundTell; readonly law: ProjectedState }
interface Chain { readonly tell:GroundTell; readonly row:ArenaScriptData['clocks']['landings'][number] }
const _openV = new THREE.Vector3(), _openRAY = new THREE.Ray(), _openSPH = new THREE.Sphere(), _openHITP = new THREE.Vector3();
/** The open arena's fight (Nalati's Storm Titan) as numbers and rules: its life, clocks, support riders, grass fire,
 *  whirlwinds, spear and chains, the heart as a target and its damage. Its looks are ports the page fills (the cloud body,
 *  the arena's tells and lanes, the fire, the scorch and the whirl funnels) and the Node simulation fills with its own;
 *  moved from arenaRoom.ts unchanged, so the page fights the same numbers in the same order. */
export class OpenArenaFight implements BossScript {
  private readonly data: ArenaScriptData;
  readonly body: ArenaBodyPort;
  /** the body's pose, set by the fight and read by its channel rows */
  readonly pose:ArenaScriptRows['pose'];
  get phase(): number { return this.life.value('phase'); }
  get hp(): number { return this.life.value('hp'); }
  private set hp(hp: number) { this.life.event('support',{ hp,broke: Number(this.domeBroken) }); }
  private get invuln(): boolean { return this.life.value('invuln')===1; }
  private get fighting(): boolean { return this.life.value('fighting')===1; }
  private get open(): boolean { return this.life.value('open')===1; }
  private get victoryT(): number { return this.life.value('victoryT'); }
  // the spear
  readonly spearAt: THREE.Vector3 = new THREE.Vector3();
  // phase II
  private stormRiders: SupportActor[] = [];
  private readonly support: ProjectedState;
  private readonly memberOutputs: readonly string[];
  private get domeBroken(): boolean { return this.life.value('broke')===1; }
  private set domeBroken(on: boolean) { this.life.event('support',{ hp: this.hp,broke: Number(on) }); }
  // phase III
  private readonly field: CellField;
  private fireOn = false;
  private readonly fire: ArenaFirePort;
  /** the scorch decals' draw, the burnt-out cells not yet drawn, the frame's share of them, a reset the fire view has not
   *  seen yet, and the fire view's slot (R6: behaviour/titanFireView draws the flames, smoke and scorch) */
  private readonly scorch: THREE.InstancedMesh;
  private readonly burntQueue: number[] = [];
  private readonly burnt = new Float32Array(1 + ARENA_BURNT_PER_FRAME);
  private fireClear = false;
  private fireFrame: ((dt: number, time: number) => boolean) | null = null;
  private readonly chains: Chain[];
  private get chainLeft(): number { return this.clocks.value(this.data.clocks.left); }
  readonly clocks:ProjectedState;
  readonly scope:Scope;
  private readonly clockRandom: Rng;
  private readonly whirls: ArenaWhirlsPort;
  // the seal
  private readonly arena: ArenaScenePort;
  private get sealed(): boolean { return this.life.value('sealed')===1; }
  private hazardDt = 0;
  readonly boundary: ArenaBoundary;
  private boundaryEffect: Readonly<Record<string,number>> | null = null;
  private readonly author: ReturnProgram;
  readonly life: ProjectedState;
  private readonly fightDraw: ReturnType<typeof installChannelPrograms>;
  private readonly viewRead = { fighting: 0, victoryT: -1, phase: 0, domeBroken: 0, open: 0, flash: 0 };
  /** Nalati zero R6: the tells and pose run in the fight's view module at its frame slot (format/arenaView), lent in the
   *  entered encounter's bind; its cells are the eased pose and the aim's operands */
  private view: { readonly frame: (dt: number, time: number) => void; readonly cells: Record<'bend' | 'raise' | 'castL' | 'struck' | 'alpha', { value: number }> } | null = null;

  constructor(private readonly ctx: OpenArenaFightWorld, private readonly host: OpenArenaFightHost, data: ArenaScriptData, views: OpenArenaViews) {
    this.clockRandom=ctx.ai();
    this.scope=ctx.scope;this.data = data; this.pose={...data.pose};
    const clocks=this.data.clocks;
    const state=clocks.frame.initial,outputs=clocks.frame.outputs,channels=data.programs.attack.v2?.channels,retain=Object.entries(clocks.frame.retain),slots=clocks.landings.flatMap(row=>[row.on,row.t,row.x,row.z]);
    if(clocks.frame.parameters[clocks.count]!==clocks.landings.length||new Set(slots).size!==slots.length||outputs===undefined
      ||[clocks.left,...slots,...retain.map(([,slot])=>slot)].some(key=>!Object.hasOwn(state,key))
      ||new Set(retain.map(([,slot])=>slot)).size!==Object.keys(state).length
      ||[...retain.map(([channel])=>channel),'strike','stuck','hurt','spread',clocks.spear,...clocks.landings.flatMap(row=>[row.strike,row.hurt])].some(key=>!outputs.includes(key))
      ||channels!==undefined&&outputs.some(key=>!channels.includes(key))
      ||Object.keys(clocks.clear).length!==slots.length||slots.some(key=>!Object.hasOwn(clocks.clear,key)||!Object.is(clocks.clear[key],state[key])))throw new Error('Invalid encounter clock bank');
    const actors=data.support.actors;
    if(actors===undefined||Object.entries(data.support.commit).some(([slot,value])=>!Object.hasOwn(data.support.member,slot)||!Number.isFinite(value)))throw new Error('Invalid support actor binding');
    this.memberOutputs=['show','alpha','hurt',...Object.values(actors.memory)];
    const bindings=ReturnProgram.projectionBindings(data.programs.attack);
    ProjectedState.preflight(data.script.fight,bindings);
    ProjectedState.preflight(clocks.frame,bindings);ProjectedState.preflight({...data.support,signal:'couple',outputs:['index','hp','mask','broke']},bindings);
    ProjectedState.preflight({initial:{...data.support.member,theta:0},parameters:data.support.parameters,signals:data.support.signals,signal:'member',outputsEvents:{member:this.memberOutputs,damage:['alpha']}},bindings);
    views.whirlsPreflight(data.whirls,bindings);
    const windBindings=ReturnProgram.projectionBindings(data.programs.wind);
    for(const law of data.whirls.laws)ProjectedState.preflight(law,windBindings);
    if(data.field.contact!==undefined)ProjectedState.preflight(data.field.contact.law,windBindings);
    if(Object.entries(data.field.channels).some(([kind,channel])=>!Object.values(kind==='state'?windBindings.script.fields:windBindings.script.channels).includes(channel))||Object.values(data.field.signals).some(signal=>!Object.values(windBindings.script.signals).includes(signal)))throw new Error('Missing cell field program binding');
    if(data.programs.attack.v2===undefined||Object.values(data.commands).some(signal=>!Object.values(bindings.script.signals).includes(signal)))throw new Error('Missing encounter command program');
    this.author=ReturnProgram.page(this.data.programs.attack,ctx.scope);
    this.clocks=new ProjectedState(clocks.frame,this.author);
    const windLaw = ReturnProgram.page(this.data.programs.wind, ctx.scope);
    this.field = new CellField(this.data.field, windLaw, ctx.ai());
    this.boundary = { field: this.field,boundary: data.boundary,mask: 0 };
    this.life = new ProjectedState(this.data.script.fight,this.author);
    this.support = new ProjectedState({...this.data.support,signal:'couple',outputs:['index','hp','mask','broke']},this.author);
    this.body = views.body(this.pose);
    this.fightDraw = installChannelPrograms(this.data.geometry.poses, this.data.view.group, new Map<string,unknown>([
      ['pose',this.pose],['alpha',this.body.alpha],['flash',this.body.flash],['fight',this.viewRead],
    ]));
    const arena = this.arena = views.arena();
    this.chains=clocks.landings.map((row,i)=>({tell:arena.tell('chain',i),row}));
    this.whirls = views.whirls(arena, windLaw, this.author, this.scope);
    this.fire = views.fire();
    this.scorch = arena.instances('scorch'); this.scorch.count = 0;
    const target = data.view.target;
    this.heartTarget = { kind: data.definition.id,position: new THREE.Vector3(),alive: true,damageFor: () => target.damage,applyDamage: amount => this.hitHeart(amount) };
    this.heartHit = { animal: this.heartTarget,point: new THREE.Vector3(),distance: 0,headshot: false };
    this.heartLock = { kind: data.definition.id,position: new THREE.Vector3(),alive: true,lockable: true,lockRange: target.range,dims: { bodyY: 0,bodyRadius: target.closed } };
  }

  /** Lend the view module (format/arenaView) what it samples and writes, then the frame slot it runs at, for `scope`'s life. */
  lendView(scope: Scope): void {
    const { sources, cells: ids, tells } = ARENA_VIEW, pose = this.pose;
    lendViewValues(scope, sources.life, field => this.life.value(field));
    lendViewValues(scope, sources.clocks, field => this.clocks.value(field));
    lendViewValues(scope, sources.pose, field => field === 'bend' ? pose.bend : field === 'raise' ? pose.raise : field === 'castL' ? pose.castL : Number.NaN);
    lendViewValues(scope, sources.spear, field => field === 'x' ? this.spearAt.x : field === 'z' ? this.spearAt.z : Number.NaN);
    const cells = { bend: { value: pose.bend }, raise: { value: pose.raise }, castL: { value: pose.castL }, struck: { value: 0 }, alpha: { value: 0 } };
    for (const key of ['bend', 'raise', 'castL', 'struck', 'alpha'] as const) lendViewCell(scope, ids[key], cells[key]);
    lendViewTell(scope, tells.spear, this.arena.tell('spear')); lendViewTell(scope, tells.fork, this.arena.tell('fork'));
    for (const [i, chain] of this.chains.entries()) lendViewTell(scope, arenaChainTell(i), chain.tell);
    const view = { frame: lendViewFrame(scope, ARENA_VIEW.slot).frame, cells };
    // the grass fire: its field (modes, lifetimes, the ground under each cell, this frame's burnt-out cells), its values
    // and its draws, at the fire's own slot
    const fire = ARENA_VIEW.fire, field = this.field, ground = new Float32Array(field.length), smoke = this.data.arenaFire.cells?.smoke;
    for (let c = 0; c < field.length; c++) ground[c] = heightAt(field.x(c), field.z(c));
    const smokeRate = smoke === undefined ? 0 : this.ctx.phone ? smoke[0] : smoke[1];
    const values: Readonly<Record<string, () => number>> = { on: () => Number(this.fireOn), clear: () => Number(this.fireClear), windX: () => wind.dirX,
      windZ: () => wind.dirZ, windSpeed: () => wind.speed, smokeCap: () => this.fire.smoke.instanceMatrix.count, smokeRate: () => smokeRate,
      scorchCap: () => this.scorch.instanceMatrix.count };
    lendViewValues(scope, fire.values, name => values[name]?.() ?? Number.NaN);
    lendViewArray(scope, fire.arrays.modes, () => field.modeCells); lendViewArray(scope, fire.arrays.lifetimes, () => field.lifetimeCells);
    lendViewArray(scope, fire.arrays.ground, () => ground); lendViewArray(scope, fire.arrays.burnt, () => this.burnt);
    lendViewDraw(scope, fire.draws.flames, this.fire.flames); lendViewDraw(scope, fire.draws.smoke, this.fire.smoke); lendViewDraw(scope, fire.draws.scorch, this.scorch);
    const fireFrame = lendViewFrame(scope, fire.slot).frame;
    this.fireFrame = fireFrame; scope.onDispose(() => { if (this.fireFrame === fireFrame) this.fireFrame = null; });
    this.whirls.bindView(scope);
    this.view = view; scope.onDispose(() => { if (this.view === view) this.view = null; });
  }

  // ── BossScript ──
  get hpFrac(): number { return Math.max(0, this.hp / this.data.place.heartHp); }
  get shielded(): boolean { return this.life.value(this.data.script.fight.retainEvents.step.shield)===1; }
  get dead(): boolean { return this.hp <= 0; }
  get heartOpen(): boolean {
    return this.open;
  }
  inArena(_p: THREE.Vector3): boolean { return this.life.value(this.data.script.fight.retainEvents.step.enter)===1; }
  /** the strip is tied (the cairn's prompt) — the threshold */
  get tied(): boolean { return this.life.value('tied')===1; }
  set tied(on: boolean) { this.life.event('tied',{ amount: Number(on) }); }
  seal(on: boolean): void { this.life.event('seal',{ amount: Number(on) }); }
  clampHp(share: number): void { this.life.event('clamp',{ share }); }
  setInvulnerable(on: boolean): void { this.life.event('invulnerable',{ amount: Number(on) }); }
  private point(respawn: boolean): { x: number; z: number; yaw: number } {
    const at = this.cairnSpot(), center = this.data.arena.center, body = this.data.arena.body;
    const answer = this.life.event('point',{ x: at.x,z: at.z,cx: center.x,cz: center.z,bodyX: body.x,bodyZ: body.z,amount: Number(respawn) });
    return { x: answer['x'] ?? at.x,z: answer['z'] ?? at.z,yaw: answer['yaw'] ?? 0 };
  }
  rewardPoint(): THREE.Vector3 { const p = this.point(false); return new THREE.Vector3(p.x,heightAt(p.x,p.z)+this.data.view.reward.lift,p.z); }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } { const p = this.point(true); return { pos: new THREE.Vector3(p.x,heightAt(p.x,p.z),p.z),yaw: p.yaw }; }
  cairnSpot(): THREE.Vector3 { return this.ctx.tieSpot ?? new THREE.Vector3(this.data.arena.anchor.x, heightAt(this.data.arena.anchor.x, this.data.arena.anchor.z), this.data.arena.anchor.z); }

  reset(phase: number): void {
    this.life.restart({ phase,share: this.data.phases[phase]?.at ?? 1,tied: Number(this.tied),sealed: Number(this.sealed) }); this.clocks.reset();
    this.boundaryEffect = null; this.hazardDt = 0; this.boundary.mask = 0;
    const b = this.body;
    Object.assign(this.pose,this.data.pose);
    b.alpha.value = 1; b.part(this.data.view.dome).visible = false;
    b.setVisible(false);
    this.arena.tell('spear').hide(); this.arena.tell('fork').hide(); this.body.aim(null, 0);
    this.clearRiders();
    this.domeBroken = false; this.support.reset();
    this.clearFire();
    this.clocks.set(this.data.clocks.clear);for (const c of this.chains) c.tell.hide();
    this.whirls.reset();
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const b = this.body; if (!b.visible) b.setVisible(true);
    if (this.life.event('introClock',{t})['zzzzIntroTick']===1) {
      const answer = this.life.event('intro',{ t,amount: Number(short) });
      this.pose.rise = this.life.value(this.data.script.fight.retainEvents.intro.rise); this.pose.kneel = this.life.value(this.data.script.fight.retainEvents.intro.kneel);
      b.alpha.value = this.life.value(this.data.script.fight.retainEvents.intro.alpha); b.flash.value = answer['flash'] ?? b.flash.value;
      if (answer['strike']===1) this.bolt(this.data.arena.center.x+this.data.view.introBolt.x,this.data.arena.center.z+this.data.view.introBolt.z);
    }
    return b.focusWorld(_openHITP);
  }

  begin(phase: number): void {
    this.phaseEffects(this.life.event('begin',{ phase }));
  }

  enterPhase(phase: number): void {
    this.phaseEffects(this.life.event('phase',{ phase }));
  }
  private phaseEffects(row: Readonly<Record<string,number>>): void {
    this.clocks.set({ mode: row['mode'] ?? 0, cd: row['cd'] ?? 0 }); this.arena.tell('spear').hide(); this.arena.tell('fork').hide(); this.body.aim(null, 0);
    this.pose.bend = this.data.pose.bend; this.pose.raise = this.data.pose.raise; this.pose.rise = row['rise'] ?? this.pose.rise;
    this.whirls.arm(row['mask'] ?? 0);
    if (row['arm'] === 1) { this.domeBroken = false; this.spawnRiders(); } else this.clearRiders();
    if (row['spread'] === 1) {
      this.fireOn = true;
      const p = this.host.player.position;
      for (const seed of this.data.seeds) this.ignite(p.x + seed.x, p.z + seed.z);
    }
    const line = this.data.phaseLines[row['index'] ?? -1]; if (line) this.host.feed(line);
  }

  takeBoundary(): Readonly<Record<string,number>> | null { const effect = this.boundaryEffect; this.boundaryEffect = null; return effect; }
  update(dt: number, t: number, fighting: boolean): void {
    const b = this.body, p = this.host.player.position;
    const boss = this.host.boss, center = this.data.arena.center;
    const decision = this.life.step(dt,{ px: p.x,pz: p.z,cx: center.x,cz: center.z,radius: this.data.place.arenaRadius,
      mounted: Number(this.host.mounted()),fighting: Number(fighting),mode: this.clocks.value('mode'),
      engaged: Number(this.host.engaged),storm: Number(this.ctx.weather.stormActive),armed: Number(boss?.state==='armed'),victory: Number(boss?.state==='victory') });
    this.hazardDt = decision.dt;
    if (decision.dt>0) {
      this.boundaryEffect = decision.values; this.boundary.mask = this.life.value(this.data.script.fight.retainEvents.step.mask);
      if (decision.values['show']===0) b.setVisible(false);
    }
    this.arena.update(dt, t, this.sealed);   // the wall rises / falls with the seal
    if (!b.visible && this.victoryT < 0) { this.updateFire(dt, t, false); return; }
    Object.assign(this.viewRead, { fighting: Number(fighting), victoryT: this.victoryT, phase: this.phase, domeBroken: Number(this.domeBroken), open: Number(this.heartOpen), flash: this.ctx.weather.flash });
    this.fightDraw.evaluate({ time: t, delta: dt, values: {} });
    const fog = this.ctx.fog();
    if (fog) b.fogColour.copy(fog.color);
    // the dome
    b.part(this.data.view.dome).visible = b.visible && this.life.value(this.data.script.fight.retainEvents.step.dome)===1;
    if (this.life.value(this.data.script.fight.retainEvents.step.active)===1 && this.fighting) {
      const step = this.clocks.step(dt, { phase: this.phase, fighting: Number(fighting), px: p.x, pz: p.z }, this.clockRandom);
      if (this.life.value(this.data.script.fight.retainEvents.step.weapon)===1) this.updateSpear(step.values[this.data.clocks.spear]===1?step.values:undefined);
      if (this.life.value(this.data.script.fight.retainEvents.step.arm)===1 && step.dt>0) this.updateRiders(step.dt);
      if (this.life.value(this.data.script.fight.retainEvents.step.spread)===1 && step.dt>0) this.updateChains(step.values);
    }
    if (decision.dt>0) this.life.event('tell',{ t,mode: this.clocks.value('mode'),spearT: this.clocks.value('t'),chainLeft: this.chainLeft,bend: this.pose.bend,raise: this.pose.raise });
    // the frame slot: the view module eases the pose and draws the spear, fork and chain rings (behaviour titanView);
    // the aim's operands are captured here, before the whirls and the fire (a reset during their contact keeps them)
    let struck = 0, alpha = 0;
    const view = this.view;
    if (view !== null) {
      view.frame(dt, t); const c = view.cells;
      this.pose.bend = c.bend.value; this.pose.raise = c.raise.value; this.pose.castL = c.castL.value; struck = c.struck.value; alpha = c.alpha.value;
    }
    this.updateWhirls(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    this.updateFire(dt, t, fighting && this.victoryT < 0, this.hazardDt);
    // the spear in his hand (raised) or stuck in the meadow
    b.aim(struck===1 ? this.spearAt : null,b.visible ? alpha : 0);
    b.update(t, this.ctx.camera);
  }

  victory(): void {
    this.life.event('victory');
    this.clocks.set({ mode: 0 }); this.arena.tell('spear').hide(); this.arena.tell('fork').hide();
    this.clocks.set(this.data.clocks.clear);for (const c of this.chains) c.tell.hide();
    for (const l of this.arena.tells('lane')) l.hide();
    this.clearRiders();
    // the rain puts the fire out: every burning cell goes to black
    for (const cell of this.field.deactivate()) this.addScorch(cell);
    this.fireOn = false;
    this.whirls.arm(0);
  }

  // ── the heart as a target (main's Targets chain) ──

  private readonly heartTarget: TargetAnimal;
  private readonly heartHit: TargetHit;
  private readonly heartLock: AimTarget;
  lockTarget(): AimTarget | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return null;
    this.body.focusWorld(this.heartLock.position); this.heartLock.alive = !this.dead;
    return this.heartLock;
  }

  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    if (!this.fighting || !this.body.visible || this.victoryT >= 0) return hit;
    const best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist;
    this.body.focusWorld(_openHITP);
    _openSPH.set(_openHITP, this.heartOpen ? this.data.view.target.open : this.data.view.target.closed);
    _openRAY.set(origin, dir);
    if (_openRAY.intersectSphere(_openSPH, _openV) === null) return hit;
    const d = _openV.distanceTo(origin);
    if (d > best) return hit;
    this.heartTarget.position.copy(_openHITP); this.heartTarget.alive = !this.dead;
    this.heartHit.point.copy(_openV); this.heartHit.distance = d; this.heartHit.headshot = this.heartOpen;
    return this.heartHit;
  }

  private hitHeart(amount: number): boolean {
    const answer = this.life.event('damage',{ amount,mode: this.clocks.value('mode') });
    if (answer['show']===1) this.host.toast(this.data.immuneLines[answer['index'] ?? 0] ?? '');
    if (answer['flash']===1) this.body.flash.value = 1;
    return this.dead;
  }

  // ── I · the Sky Spear ──

  private updateSpear(answer: Readonly<Record<string, number>> | undefined): void {
    if (answer !== undefined) {
      const n = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing attack decision'); return value; };
      this.spearAt.x = this.clocks.value('x'); this.spearAt.z = this.clocks.value('z');
      if (n('strike') === 1) {
        this.spearAt.y = heightAt(this.spearAt.x, this.spearAt.z); this.bolt(this.spearAt.x, this.spearAt.z);
        if (n('hurt') === 1 && this.host.contact('spear', this.spearAt, this.data.tuning.spearDamage, this.data.lines.spear)) this.host.throwRider();
        if (n('spread') === 1) this.ignite(this.spearAt.x, this.spearAt.z);
      }
      if (n('stuck') === 1) this.host.feed(this.data.lines.spearStuck);
    }
  }

  // ── II · the Three Winds ──

  private spawnRiders(): void {
    this.clearRiders();
    const gr = this.host.riderOwner();
    if (gr === null) { this.domeBroken = true; return; }
    for (const [i, site] of this.data.supportSites.entries()) {
      const { x, z } = site;
      const a = gr.spawnRider({ x, z, yaw: 0, variant: this.data.view.quietVariant, quiet: true });
      if (a === null) continue;
      const lane = this.arena.tells('lane')[i];
      if (lane === undefined) continue;
      const rows=this.data.support,actors=rows.actors;if(actors===undefined)throw new Error('Missing support actor rows');
      const law=new ProjectedState({initial:{...rows.member,theta:site.theta},parameters:rows.parameters,signals:rows.signals,signal:'member',outputsEvents:{member:this.memberOutputs,damage:['alpha']}},this.author),player=this.host.player.position;
      a.maxHp=actors.hp;a.hp=actors.hp;
      setEliteDamage(a,(body,point)=>law.event('damage',{x:point.x,z:point.z,px:player.x,pz:player.z,radius:body.scale})['alpha']??1);
      const r: SupportActor = { a,lane,law };
      this.stormRiders.push(r);
    }
  }

  private clearRiders(): void {
    const gr = this.host.riderOwner();
    for (const r of this.stormRiders) { setEliteDamage(r.a,()=>1);r.lane.hide(); if (r.a.alive && gr !== null) { r.a.alive = false; gr.dissolve(r.a); } }
    this.stormRiders = [];
    for (const l of this.arena.tells('lane')) l.hide();
  }

  private updateRiders(dt: number): void {
    const p=this.host.player.position,riders=this.stormRiders,rows=this.data.support;
    const frame={dt,px:p.x,pz:p.z,hp:this.hp,invuln:Number(this.invuln)};
    const state=this.support.project({...frame,count:riders.length},this.ctx.ai(),riders.map(({a,law})=>({x:a.position.x,z:a.position.z,hit:Number(a.alive),mode:law.value('mode')})));
    const selected=riders[state['index']??-1];
    if(selected!==undefined){
      selected.law.set(rows.commit);
      selected.law.set(Object.fromEntries(['x0','z0','x1','z1'].map(key=>[key,state[key]??0] as const)));
    }
    this.hp=state['hp']??this.hp;
    for(let i=riders.length-1;i>=0;i--){
      const r=riders[i];if(r===undefined)continue;
      if(((state['mask']??0)&(1<<i))!==0){
        setEliteDamage(r.a,()=>1);r.lane.hide();riders.splice(i,1);
        this.host.feed(riders.length>0?this.data.lines.riderBreaks+this.data.view.remaining.replace('{count}',String(riders.length)):this.data.lines.lastRider);continue;
      }
      const a=r.a,answer=r.law.project({...frame,ax:a.position.x,az:a.position.z});
      const n=(key:string):number=>{const value=answer[key];if(value===undefined)throw new Error('Missing support decision');return value;};
      for(const [slot,channel]of Object.entries(rows.actors?.memory??{}))a.mem[slot]=n(channel);
      if(n('show')===1)r.lane.lane(r.law.value('x0'),r.law.value('z0'),r.law.value('x1'),r.law.value('z1'),4.2,n('alpha'));else r.lane.hide();
      if(n('hurt')===1&&this.host.contact('wind',a.position,this.data.tuning.chargeDamage,this.data.lines.charge))this.host.throwRider();
    }
    if(state['broke']===1&&!this.domeBroken){this.domeBroken=true;this.body.flash.value=1;}
  }

  // ── III · the grass fire + chain lightning ──

  /** A native contact/result remains a synchronous barrier. Only its original
   * concrete field or current entered mount is lent for this one request. */
  private command(signal:string,frame:Readonly<Record<string,number>>,loan:Extract<V2WorldActionLoan,{kind:'mount'|'cell-field'}>):void {
    const project=this.author.prepareWorld;if(project===undefined)throw new Error('Missing encounter command transport');
    const binding:V2ActionBinding={identity:'arena',handle:1,targets:new Map([[1,{identity:loan.target,kind:loan.kind==='cell-field'?'cell-field':'mount'}]]),operations:new Set([loan.kind==='cell-field'?V2_ACTION_OPS.ignite:V2_ACTION_OPS.dismount]),maxCommands:1,bounds:{coordinate:Number.MAX_VALUE,velocity:0}};
    const prepared=project(signal,frame,new Map([[1,binding]])),effects=prepareV2WorldActions(prepared.actions,[loan]);
    if(Object.keys(prepared.values).length>0||prepared.actions.length!==1)throw new Error('Invalid encounter command result');
    effects.validate();prepared.accept();for(const apply of effects.operations)apply();
  }
  dismount(mount:Mount,scope:Scope):void {this.command(this.data.commands.dismount,{}, {binding:'arena',target:'mount',kind:'mount',scope,owner:mount});}
  private ignite(x:number,z:number):void {this.command(this.data.commands.ignite,{x,z},{binding:'arena',target:'field',kind:'cell-field',scope:this.scope,owner:this.field});}
  private addScorch(c: number): void {
    this.burntQueue.push(c);
    this.ctx.wild.trample(this.field.x(c), this.field.z(c), this.data.tuning.cell * 0.6, 1, 0, 0);   // the grass burnt flat
  }
  private clearFire(): void { this.field.clear(); this.burntQueue.length = 0; this.fireClear = true; this.fireOn = false; }

  private updateFire(dt: number, t: number, live: boolean, thinkDt = 0): void {
    this.fire.update(t, wind.dirX, wind.dirZ, wind.speed, this.body.fogColour, this.body.flash.value);
    if (this.fireOn && live) for (const cell of this.field.update(dt, { wx: wind.dirX, wz: wind.dirZ })) this.addScorch(cell);
    // the fire slot: the view module draws the smoke, the burning cells' flames and up to a frame's share of the burnt-out
    // cells' scorch; what it has not run for (its lane's rate can skip a frame) waits for the frame it runs
    const n = Math.min(ARENA_BURNT_PER_FRAME, this.burntQueue.length); this.burnt[0] = n;
    for (let k = 0; k < n; k++) this.burnt[1 + k] = this.burntQueue[k] ?? 0;
    if (this.fireFrame?.(dt, t) === true) { this.burntQueue.splice(0, n); this.fireClear = false; }
    if (!this.fireOn || !live || thinkDt <= 0) return;
    // the player in fire: 8 / s; the horse panics near it
    const p = this.host.player.position;
    const contact = this.field.sense(thinkDt, p, { mounted: Number(this.host.mounted()) });
    if ((contact['hurt'] ?? 0) > 0) this.host.contact('fire', p, contact['hurt'] ?? 0, this.data.lines.burning);
    if ((contact['speed'] ?? 0) < 0) this.host.horseSteed(contact['speed'] ?? 0);
  }

  private updateChains(values:Readonly<Record<string,number>>):void {
    const p=this.host.player.position;
    for(const chain of this.chains)if(values[chain.row.strike]===1){
      const x=this.clocks.value(chain.row.x),z=this.clocks.value(chain.row.z);
      chain.tell.hide();this.bolt(x,z);this.ignite(x,z);
      if(values[chain.row.hurt]===1)this.host.contact('chain',_openV.set(x,p.y,z),this.data.tuning.chainDamage,this.data.lines.chain);
    }
  }

  // ── whirlwinds: touching one lifts you out of the saddle ──

  private updateWhirls(dt: number, t: number, live: boolean, thinkDt: number): void {
    const p = this.host.player.position;
    const hits = this.whirls.update(dt, t, live, thinkDt, { wx: wind.dirX, wz: wind.dirZ, px: p.x, pz: p.z });
    for (const at of hits) if (this.host.contact('whirl', at, this.data.tuning.whirlDamage, this.data.lines.whirl)) this.host.throwRider();
  }

  // ── a strike from the sky ──
  private bolt(x: number, z: number): void {
    const y = heightAt(x, z);
    this.ctx.weather.raise(this.data.weather.strike, { x, y, z, kind: 0 });
    this.ctx.weather.flash = 1;
    this.body.flash.value = 1;
    this.ctx.wild.onEvent('lightning', x, z);
  }

}
