import {parse} from 'valibot';
import {StealthRowsSchema,type StealthRows} from '@wildshard/format/stealth';
import type { Scope } from '@wildshard/engine/app/scope';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { declarePanel, type PanelView } from '@wildshard/engine/ui/panel';
import { mountUi } from '@wildshard/engine/ui/ownership';
import { ReturnProgram } from '../population/returnProgram';
import './stealth.css';

/** Admitted scalar awareness observations; animal senses retain their actual owners. */
export interface StealthThreat {x:number;z:number;awareness:number;alert:number;hunting:number}
export interface StealthObservation {grass:number;mounted:boolean;forced:boolean;threats:readonly StealthThreat[]}
/** Renderer-free decision owner: rows and scalar snapshots only, with one projection at most every 100 ms. */
export class StealthDetection {
 readonly program:ReturnProgram;
 state:Readonly<Record<string,number>>={on:0,off:0,inLong:0,can:0,latched:0,cover:0,threat:0,x:0,z:0,state:0};
 private elapsed=0;
 constructor(input:unknown,owner?:Scope){this.program=ReturnProgram.page(input,owner);}
 step(dt:number,observations:Readonly<Record<string,number>>,threats:readonly StealthThreat[]):boolean{
  this.elapsed+=dt;if(this.elapsed<.1-1e-9)return false;
  if(threats.length>8)throw new Error('Stealth threat observation bound');
  this.state=this.program.project('step',{...this.state,...observations,dt:this.elapsed,count:threats.length},undefined,threats.map(row=>({...row})));this.elapsed=0;return true;
 }
}
/** Client-only crouch/detection presentation. The guest owns eligibility, concealment and alert-state decisions. */
export class StealthController {
 private readonly scope:Scope;private readonly player:Player;private readonly law:StealthDetection;
 state:string;cover=0;threat=0;inLongGrass=false;canCrouch=false;latched=false;
 private toggleWas=false;private pendingToggle=false;private pendingCancel=false;
 private observation:StealthObservation={grass:0,mounted:false,forced:false,threats:[]};
 private shotUntil=-1;private t=0;private threatX=0;private threatZ=0;private hinted=false;
 private readonly layer:PanelView;private readonly row:PanelView;private readonly grassRow:PanelView;private readonly disc:HTMLElement;
 private shown='';private lastCover=-1;private lastThreat=-1;
 private readonly rows:StealthRows;
 constructor(ctx:LevelContext,player:Player,input:unknown){
  const rows=parse(StealthRowsSchema,input);this.rows=rows;
  this.scope=ctx.scope;this.player=player;this.law=new StealthDetection(rows.program,ctx.scope);this.state=rows.states[0]??'none';
  this.layer=declarePanel(rows.panels.layer);mountUi(this.layer.root,this.scope);
  this.disc=ctx.hud.disc({cls:'ws-stealth-crouch',icon:rows.disc,label:rows.discLabel,spot:'up0',press:()=>{this.pendingToggle=!this.pendingToggle;}});
  this.row=declarePanel(rows.panels.row);ctx.hud.widget('band.3',this.row.root,3);
  this.grassRow=declarePanel(rows.panels.grass);ctx.hud.widget('band.3',this.grassRow.root,4);
  this.scope.onDispose(hudSlots.onLayer(()=>{this.layer.text('hint',rows.hint);this.layer.flag('hint','touch',true);}));
  this.scope.onDispose(()=>{this.layer.remove();this.row.remove();this.grassRow.remove();this.latched=false;});
  ctx.inputContext(rows.input);ctx.app.input.push(rows.input.id,this.scope);
  ctx.answer('player.crouch',request=>this.answerCrouch(request));
  ctx.system({id:rows.system,phase:'input',before:['engine.player.input'],run:dt=>{this.crouchStep(dt);}});
 }
 private crouchStep(dt:number):void{
  const p=this.player,o=this.observation;
  const sprint=(p.inputService?.held('sprint')??false)&&((p.inputService?.held('move.forward')??false)||p.touchMove.y>.1),jump=p.touchJump||(p.inputService?.pressed('jump')??false);
  this.pendingCancel ||= sprint||jump;
  const stepped=this.law.step(dt,{...this.rows.tuning,grass:o.grass,forced:Number(o.forced),blocked:Number(p.hover||p.swimming||o.mounted||practiceRoom.open),practice:Number(practiceRoom.open),crouched:Number(p.crouching),px:p.position.x,pz:p.position.z,sprint:Number(sprint),jump:Number(this.pendingCancel),toggle:Number(this.pendingToggle)},o.threats);
  if(!stepped)return;this.pendingToggle=false;this.pendingCancel=false;
  const v=this.law.state;this.inLongGrass=v['inLong']===1;this.canCrouch=v['can']===1;this.latched=v['latched']===1;
  this.cover=v['cover']??0;this.threat=v['threat']??0;this.threatX=v['x']??0;this.threatZ=v['z']??0;
  const state=this.rows.states[v['state']??0];if(state===undefined)throw new Error('Undeclared stealth state');this.state=state;
 }
 answerCrouch(request:{want:boolean;via:'toggle'|'hold'}):{allowed:boolean;latched:boolean}{
  if(request.via==='toggle'){if(request.want&&!this.toggleWas)this.pendingToggle=!this.pendingToggle;this.toggleWas=request.want;}
  return {allowed:request.via==='hold'&&this.canCrouch,latched:this.latched};
 }
 noteShot():void{this.shotUntil=this.state===this.rows.sneak.state?this.t+this.rows.sneak.seconds:-1;}
 sneakMultiplier():number{return this.t<this.shotUntil?this.rows.sneak.multiplier:1;}
 update(_dt:number,t:number,observation:StealthObservation):void{this.t=t;this.observation=observation;this.render();}
  private render(): void {
    const s = this.state;
    if (s !== this.shown) {
      this.shown = s;
      this.layer.data('', 'state', s);
      const icon = this.rows.icons[s]??this.rows.icons['visible'];if(icon===undefined)throw new Error('Missing stealth icon');
      const label = this.rows.labels[s]??this.rows.labels['visible']??'';
      this.layer.fill('pipIcon', [icon]); this.layer.text('pipLabel', label);
      this.row.data('', 'state', s); this.row.fill('icon', [icon]); this.row.text('label', label);
    }
    // the GRASS meter while crouched
    const crouched = this.player.crouching;
    this.layer.flag('meter', 'on', crouched); this.grassRow.flag('', 'on', crouched);
    const c = Math.round(this.cover * 100) / 100;
    if (c !== this.lastCover) {
      this.lastCover = c;
      this.layer.style('meterFill', 'transform', `scaleY(${c.toFixed(2)})`); this.grassRow.style('fill', 'transform', `scaleX(${c.toFixed(2)})`);
      this.layer.flag('meter', 'good', c >= (this.rows.tuning['hiddenCover']??1)); this.grassRow.flag('', 'good', c >= (this.rows.tuning['hiddenCover']??1));
    }
    const th = Math.round(this.threat * 50) / 50;
    if (th !== this.lastThreat) { this.lastThreat = th; this.layer.style('pip', '--threat', th.toFixed(2)); this.row.style('', '--threat', th.toFixed(2)); }
    // the chevron: round the crosshair, pointing at the most aware creature
    const threatening = this.rows.threatStates.includes(s);
    this.layer.flag('chev', 'on', threatening);
    if (threatening) {
      const p = this.player.position, yaw = this.player.yaw;
      const dx = this.threatX - p.x, dz = this.threatZ - p.z;
      const ax = dx * Math.cos(yaw) - dz * Math.sin(yaw), ay = -dx * Math.sin(yaw) - dz * Math.cos(yaw); // right / forward
      const a = Math.atan2(ax, ay);
      this.layer.style('chev', 'transform', `translate(${(Math.sin(a) * 64).toFixed(1)}px, ${(-Math.cos(a) * 64).toFixed(1)}px) rotate(${a.toFixed(3)}rad)`);
    }
    // the crouch disc (touch) and the one-time TALL GRASS chip
    const avail = this.canCrouch || this.latched;
    hudSlots.show(this.disc, avail);
    this.disc.classList.toggle('on', this.latched);
    if (avail && !this.hinted) {
      this.hinted = true;
      this.disc.classList.add('pulse');
      this.layer.flag('hint', 'on', true);
      const endHint = (): void => { this.layer.flag('hint', 'on', false); this.disc.classList.remove('pulse'); };
      this.scope.timeout(this.rows.hintSeconds*1000, endHint);
    }
  }
}
