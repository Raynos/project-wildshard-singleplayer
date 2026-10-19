import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import { wildEnv } from '../creatures/env';
import bootMetadata from '../bootMetadata.generated.json' with { type: 'json' };
import * as v from 'valibot';
import type { SkyKey as SteppeKey, SkyLook, SkyRows } from '../look/skyRig';
import { dayLookPresets } from '@wildshard/game/looks/dayLookPresets';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { painterlyUniforms, syncPainterlySun } from '@wildshard/engine/world/painterly';
/**
 * Nalati weather + day/night wiring (row B10 of project/archive/2026-09-23-nalati.md): the clock, the storm state machine, the storm's
 * visuals, and everything they touch — the sky rig (sun / moon, sky, fog, grade), the one Wind, the creatures'
 * `wildEnv` (light, storm), the HUD chip + GET LOW warning (the `ws:weather` event), the audio beds and thunder.
 *
 *   const w = wireWeather({ game, sky, player, forest, pois });   // src/shards/nalati-grasslands/index.ts, the weather section
 *   w.update(dt)                                                  // every frame (index.ts pushes it)
 *   w.bind({ audio, hurt, scare })                                // main.ts, once the audio / health exist (see below)
 *   w.clock    — DayClock: .phase ('dawn' | 'day' | 'golden' | 'dusk' | 'night'), .hour, .onDusk / onNight / onDawn(fn)
 *   w.weather  — Weather: .state, .stormActive, .onStrike(fn), .onPhase(fn), .hold (a boss fight), .force(phase)
 *
 * Dev params: `?time=dawn|day|noon|golden|dusk|night|midnight|<hour>` ·
 * `?clock=0` (freeze the clock) · `?weather=clear|building|gust|storm|clearing|after[:0..1]` (jump into a phase,
 * optionally part-way). `window.__weather` = the lot.
 *
 * Hooks for other rows: B11 balbals `w.clock.onDusk(…)`, ghost riders `w.clock.onNight(…)`; B12 Qyran and B14 the
 * Storm Titan read `w.weather.stormActive`; B13 sets `w.air.hold = true` during a boss fight; the
 * herds / packs: `w.weather.onStrike((s) => wildlife.scare(s.x, s.z, 60))` (or pass `scare` to `bind`).
 */
import * as THREE from 'three';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Game } from '@wildshard/engine/core/Game';
import { TIER } from '@wildshard/engine/core/tier';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { Player } from '@wildshard/engine/player/Player';
import type { HUD } from '@wildshard/engine/ui/HUD';
import { DayCycle, compassDir, type DayPhase } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { wind } from '@wildshard/engine/world/steppeWind';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { audioVoicePatches } from '@wildshard/game/audio/voicePatches';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { Lightning as Weather, Exposed, LightningPlayer, Strike } from './Lightning';
import { readWeatherProgram, steppeStorm, stormWind, stepStorm, stormEnv, yurtsOf, yurtShelters, exposeTrees, type YurtCircle } from './weatherStep';
import { rainCurtain } from '@wildshard/game/systems/looks/rainCurtain';
import { RAIN_PROGRAM } from './rainProgram';
import { graphParamRoots } from '@wildshard/game/looks/graphDaySky';
import { lentLook, setLentTexture, pushLentParams, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { smoothstep } from '@wildshard/engine/core/noise';

type WeatherHUD = Parameters<HUD['setWeather']>[0];
declare module '@wildshard/engine/events/maps' { interface EventMap { 'weather.changed': WeatherHUD } }

export interface WeatherCtx {
  ctx: ShardContext; manifest: ShardManifest;
  game: Game; sky: Sky; player: Player; forest: Forest; colliders?: Collider[];
}

export interface WeatherHooks {
  audio?: Audio;
  /** damage the player (health, flash, toast) — the lightning strike */
  hurt?: (damage: number, why: string) => void;
  /** a strike landed: scare the creatures near it (Wildlife.scare) */
  scare?: (x: number, z: number) => void;
  /**
   * The player is somewhere the weather cannot reach (the great kurgan's dungeon, `boss.inside`): no lightning at
   * them, no GET LOW, no rain / storm audio around them — and, since that is where the Golden King is fought, no
   * storm may start meanwhile (`air.hold`).
   */
  indoors?: () => boolean;
  /**
   * The Storm Titan's fight is on (B14, src/shards/nalati-grasslands/stormTitan.ts): the storm that called him may not run out until he
   * falls (the storm phase is held open), no new storm cycle starts, and the natural lightning leaves the player alone —
   * his strikes take its place. Combined with `indoors` into `air.hold`, never overwritten by it.
   */
  stormHold?: () => boolean;
}

export interface NalatiWeather {
  clock: DayCycle<SteppeKey>;
  weather: Weather;
  /** Plain admitted weather owner; lightning is composed separately. */
  air: WeatherContinuation;
  rig: Awaited<ReturnType<typeof weatherSky>>;
  fx: Awaited<ReturnType<typeof weatherEffects>>;
  /** the look applied last frame (clock + storm) */
  look: SkyLook;
  /** the yurts the lightning's shelter rule reads (world/weatherStep.ts yurtsOf over the POI colliders; the headless bake's `yurts`) */
  readonly yurts: readonly YurtCircle[];
  update: (dt: number) => void;
  bind: (hooks: WeatherHooks) => void;
}

const TIME_NAMES = ['dawn', 'day', 'noon', 'golden', 'dusk', 'night', 'midnight'] as const;
function isTimeName(s: string): s is DayPhase | 'noon' | 'midnight' { return (TIME_NAMES as readonly string[]).includes(s); }
const mmss = (s: number): string => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/**
 * The water's look is unlit (its colours are painted: data/lookGraphs.json 'nalati-water'): its light follows the hour and
 * the storm through the look's params, so the water doesn't glow at night and rain rings its surface.
 */
const WATER = 'nalati-water', waterSky: number[] = [0, 0, 0], waterSun: number[] = [0, 0, 0], rgb = new THREE.Color();
function lightWater(L: SkyLook, dayFog: number, dayKey: number, rain: number): void {
  const lum = 0.2126 * L.fogColor.r + 0.7152 * L.fogColor.g + 0.0722 * L.fogColor.b;
  setLentParam(WATER, 'brightness', Math.min(1, Math.max(0.06, lum / Math.max(1e-3, dayFog))));
  setLentParam(WATER, 'sky', rgb.copy(L.horizon).lerp(L.zenith, 0.35).toArray(waterSky));
  setLentParam(WATER, 'sunColour', rgb.copy(L.keyColor).multiplyScalar(L.keyIntensity / Math.max(1e-3, dayKey)).toArray(waterSun));
  setLentParam(WATER, 'rain', Math.min(1, Math.max(0, rain)));
}

export async function wireWeather(ctx: WeatherCtx): Promise<NalatiWeather> {
  const program=readWeatherProgram(JSON.parse(new TextDecoder().decode(await ctx.ctx.product.file('world/weather.json'))));
  const { game, player, forest } = ctx;
  const def = ctx.manifest;
  const qs = ctx.ctx.app.params;
  const hooks: WeatherHooks = {};
  /** refreshed each frame from `hooks.indoors` */
  let indoors = false;

  // ── the clock: starts on the def's own sun, so the first frame is the look the shard was painted with ──
  const clock = new DayCycle<SteppeKey>({ ...bootMetadata.dayClock, units: 'hour',
    schedule: bootMetadata.dayClock.schedule.map(row => ({ from: row.from, to: row.to, minutes: row.minutes, phase: v.parse(v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), row.phase) })) });
  const tq = qs.get('time');
  if (tq) { const h = Number.parseFloat(tq); if (Number.isFinite(h)) void clock.set(h); else if (isTimeName(tq)) void clock.set(tq); }
  clock.paused = qs.get('clock') === '0';

  const rig = await weatherSky(ctx,clock), look=rig.look;
  const stormLook=installChannelPrograms(ctx.ctx.product.shardfile.clientChannels,'weather',new Map([['look',look]]));
  const dayFog = 0.2126 * rig.dayFog.r + 0.7152 * rig.dayFog.g + 0.0722 * rig.dayFog.b, dayKey = Math.max(0.1, rig.daySunIntensity);

  // ── the lightning's view of the world ──
  const yurts = yurtsOf(ctx.colliders ?? []);
  let held = false;   // the Storm Titan's hold (hooks.stormHold), read by the lightning's player() below
  const lp: LightningPlayer = { x: 0, y: 0, z: 0, crouched: false, mounted: false, sheltered: false };
  const weather = steppeStorm(def.seed, {
    heightAt,
    exposed(x: number, z: number, r: number, out: Exposed[]) { exposeTrees(forest.nearby(x, z, r), (t) => t.y + t.height, (t) => t, x, z, r, out); },
    player() {
      const p = player.position;
      lp.x = p.x; lp.y = p.y; lp.z = p.z;
      lp.crouched = player.crouching; lp.mounted = wildEnv.playerMounted;
      lp.sheltered = indoors || held || yurtShelters(yurts, p.x, p.z);
      return lp;
    },
  }, program);
  const wq = qs.get('weather');
  if (wq) {
    const [ph = '', at = '0'] = wq.split(':');
    const phase = weather.weather.profile.states.find((p) => p === ph);
    if (phase) weather.weather.force(phase, Number.parseFloat(at) || 0);
  }

  const fx = weatherEffects(ctx,rig.rows);

  weather.onTelegraph((s) => {
    fx.telegraph(s);
    const d = Math.hypot(s.x - player.position.x, s.z - player.position.z);
    if (d < 160 && hooks.audio) audioVoicePatches(hooks.audio).play('lightningCrackle',{pan:panOf(s.x,s.z),gain:Math.max(.15,1-d/160)});
  });
  weather.onStrike((s) => {
    fx.bolt(s);
    hooks.scare?.(s.x, s.z);
  });
  weather.onFlash((dist, bearing) => {
    fx.inCloudFlash(bearing);
    const p = player.position;
    if (hooks.audio) audioVoicePatches(hooks.audio).play('thunder',{distance:dist,pan:panOf(p.x+Math.cos(bearing)*100,p.z+Math.sin(bearing)*100)});
  });
  weather.onPlayerHit((dmg) => hooks.hurt?.(game.app.events.ask('weather.damage', dmg), 'Struck by lightning — get low in a storm'));

  /** stereo pan of a world point for the listener (Player.yaw convention: forward = (−sin, −cos)) */
  function panOf(x: number, z: number): number {
    const dx = x - player.position.x, dz = z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 1) return 0;
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    return ((dx * rx + dz * rz) / d) * 0.7;
  }

  // ── the wind: the storm asks for its own; back to the calm prevailing westerly after ──
  const windAsk = stormWind(wind);

  // ── HUD + audio, throttled ──
  let hudKey = '';
  let audioT = 0;

  const out: NalatiWeather = {
    clock, weather, air:weather.weather, rig, fx, look, yurts,
    bind(h) { Object.assign(hooks, h); },
    update(dt) {
      indoors = hooks.indoors?.() === true;
      held = hooks.stormHold?.() === true;
      // the Golden King is fought indoors (no storm starts meanwhile); the Storm Titan in the storm that called him
      weather.weather.hold = indoors || held;
      clock.update(dt);
      // the storm (the Storm Titan's holds it open) and the wind it asks for (world/weatherStep.ts, the host's rule too)
      stepStorm(weather, windAsk, wind, dt, held);
      // the look
      rig.sample();
      stormLook.evaluate({time:0,delta:dt,values:{overcast:weather.weather.overcast,flash:weather.flash,rain:weather.weather.rain,wet:weather.weather.wet}});
      rig.flash = weather.flash * 0.7;
      rig.apply(dt);
      lightWater(look, dayFog, dayKey, indoors ? 0 : weather.weather.rain);
      fx.update(dt, weather, look, game.camera, { x: wind.dirX * wind.speed, z: wind.dirZ * wind.speed });
      fx.rain.visible &&= !indoors;
      // the creatures
      stormEnv(wildEnv, clock, weather);
      // HUD (the event fires on change only)
      const ws = `WIND ${Math.round(wind.speed)} m/s`;
      let chip: WeatherHUD['chip'] = null;
      if (weather.weather.state === 'building' && weather.untilStorm <= 45) chip = { title: `Storm in ${mmss(weather.untilStorm)}`, sub: ws, tone: 'soon' };
      else if (weather.weather.state === 'gust') chip = { title: 'Storm', sub: ws, tone: 'storm' };
      else if (weather.weather.state === 'storm') chip = { title: `Storm ${mmss(weather.phaseLeft)}`, sub: ws, tone: 'storm' };
      else if (weather.weather.state === 'clearing') chip = { title: 'Clearing', sub: ws, tone: 'clearing' };
      const detail: WeatherHUD = { chip, getLow: weather.getLow && !indoors };
      const key = `${chip?.title ?? ''}|${chip?.sub ?? ''}|${String(detail.getLow)}`;
      if (key !== hudKey) { hudKey = key; ctx.ctx.app.events.emit('weather.changed', detail); }
      // audio beds at 4 Hz
      audioT -= dt;
      if (audioT <= 0 && hooks.audio) {
        audioT = 0.25;
        const windLevel = smoothstep(6, 22, wind.speed);
        audioVoicePatches(hooks.audio).setGroup('storm',{rain:indoors?0:weather.weather.rain,stormwind:indoors||weather.weather.state==='clear'?0:windLevel});
      }
    },
  };
  ctx.ctx.debug.expose('nalati.weather', out);
  return out;
}

/** Static weather is admitted data; events only place borrowed visuals. */
function weatherEffects(ctx: WeatherCtx, rows: Awaited<ReturnType<typeof weatherSky>>['rows']) {
 const channels=ctx.ctx.product.shardfile.clientChannels, loader=new THREE.BufferGeometryLoader();
 const geometry=(id:string):THREE.BufferGeometry=>{const row=rows.shapes[id];if(row===undefined)throw new Error('Missing weather geometry');return loader.parse(row);};
 const texture=(bytes:number[],noise=false):THREE.DataTexture=>{
  const t=new THREE.DataTexture(Uint8Array.from(bytes),128,128);
  t.magFilter=THREE.LinearFilter;t.minFilter=noise?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;t.generateMipmaps=noise;
  if(noise)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;
 };
 const noise=texture(rows.noise,true);for(const id of ['nalati-storm-deck','nalati-storm-curtains'])setLentTexture(id,'tNoise',noise);
 const group=new THREE.Group(), parts=new Map<string,THREE.Object3D>(), shapes:THREE.BufferGeometry[]=[];
 for(const [id,look,order] of [['deck','nalati-storm-deck',-9],['curtains','nalati-storm-curtains',-8],['bolt','nalati-lightning-bolt',15],['smoke','nalati-strike-smoke',9],['puddles','nalati-puddles',2]] as const){
  const g=geometry(id);shapes.push(g);
  const mesh=id==='smoke'?new THREE.Points(g,lentLook(look)):id==='puddles'?new THREE.InstancedMesh(g,lentLook(look),Math.max(1,rows.puddles.length/16)):new THREE.Mesh(g,lentLook(look));
  if(mesh instanceof THREE.InstancedMesh){mesh.count=rows.puddles.length/16;mesh.instanceMatrix.array.set(rows.puddles);mesh.instanceMatrix.needsUpdate=true;}
  mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=order;mesh.name=id;parts.set(id,mesh);group.add(mesh);
 }
 const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(rows.glow),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false}));
 const fire=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(rows.fire),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
 glow.renderOrder=12;fire.renderOrder=11;group.add(glow,fire);parts.set('glow',glow);parts.set('fire',fire);
 const rainU={uOffset:{value:new THREE.Vector3()},uR:{value:TIER==='phone'?11:16},uVel:{value:new THREE.Vector3(0,-9,0)},uLen:{value:.9},uCol:{value:new THREE.Color()},uAlpha:{value:.3},uWidth:{value:.013}};
 const count=TIER==='phone'?3500:6000,rain=rainCurtain({count,seed:ctx.manifest.seed,uniforms:rainU,program:RAIN_PROGRAM});group.add(rain);parts.set('rain',rain);
 const uniforms={uVelx:0,uVely:0,uVelz:0,uLen:0,uAlpha:0,uColx:0,uColy:0,uColz:0},draw={count:0};
 const flags:Record<string,number>=Object.fromEntries([...parts.keys()].map(id=>[id,0]));
 const timers={boltT:99,glowT:99,smokeLeft:0,smokeT:0},windReading={x:0,z:0};
 const params=graphParamRoots(channels,'nalati.fx',['nalati-storm-deck','nalati-storm-curtains','nalati-lightning-bolt','nalati-strike-smoke','nalati-puddles']);
 const owners=new Map<string,unknown>([...params.roots,...parts,['wind',windReading],['flags',flags],['rainU',uniforms],['draw',draw],['glowMaterial',{get opacity(){return glow.material.opacity;},set opacity(value:number){glow.material.opacity=value;}}],['fireMaterial',{get opacity(){return fire.material.opacity;},set opacity(value:number){fire.material.opacity=value;}}]]);
 let lane:ReturnType<typeof installChannelPrograms>|null=null;
 ctx.game.levelScope.onDispose(()=>{group.removeFromParent();for(const g of shapes)g.dispose();rain.geometry.dispose();if(Array.isArray(rain.material)){for(const material of rain.material)material.dispose();}else rain.material.dispose();noise.dispose();for(const sprite of [glow,fire]){sprite.material.map?.dispose();sprite.material.dispose();}});
 group.name='weather-fx';ctx.game.scene.add(group);
 return {group,rain,
  telegraph(s:Strike){glow.position.set(s.x,s.y+.4,s.z);timers.glowT=0;},
  bolt(s:Strike){timers.glowT=99;timers.boltT=0;setLentParam('nalati-lightning-bolt','origin',[s.x,s.y,s.z]);if(s.kind==='tree'){setLentParam('nalati-strike-smoke','origin',[s.x,s.y-2,s.z]);fire.position.set(s.x,s.y-1.5,s.z);timers.smokeLeft=360;}},
  inCloudFlash(bearing:number){setLentParam('nalati-storm-deck','flashDir',new THREE.Vector3(Math.cos(bearing),.25,Math.sin(bearing)).normalize().toArray());},
  update(dt:number,weather:Weather,look:SkyLook,camera:THREE.Camera,airWind:{x:number;z:number}){
   timers.boltT+=dt;timers.glowT+=dt;timers.smokeLeft=Math.max(0,timers.smokeLeft-dt);timers.smokeT+=dt;
   windReading.x=airWind.x;windReading.z=airWind.z;
   if(lane===null){owners.set('weather',{get front(){return weather.front;},get stormFrom(){return weather.stormFrom;},get rainbow(){return weather.rainbow;},get overcast(){return weather.overcast;},get flash(){return weather.flash;},get rain(){return weather.rain;},get wet(){return weather.weather.wet;}});owners.set('look',look);owners.set('camera',camera.position);lane=installChannelPrograms(channels,'nalati.fx',owners);}
   lane.evaluate({time:0,delta:dt,values:{...timers,active:Number(weather.weather.state!=='clear'),count}});pushLentParams(params);
   for(const [id,part] of parts)part.visible=(flags[id]??0)>0;
   rainU.uVel.value.set(uniforms.uVelx,uniforms.uVely,uniforms.uVelz);rainU.uCol.value.setRGB(uniforms.uColx,uniforms.uColy,uniforms.uColz);rainU.uLen.value=uniforms.uLen;rainU.uAlpha.value=uniforms.uAlpha;
   if(rain.visible){const box=rainU.uR.value*2;rainU.uOffset.value.addScaledVector(rainU.uVel.value,dt);for(const axis of ['x','y','z'] as const)rainU.uOffset.value[axis]=((rainU.uOffset.value[axis]%box)+box)%box;rain.geometry.setDrawRange(0,Math.ceil(draw.count)*6);}
  },
 };
}

/** Day presets create palettes; H4 rows project keys and feed the sky graph. */
async function weatherSky(ctx: WeatherCtx, clock: DayCycle<SteppeKey>) {
 const rows=await ctx.ctx.product.json<{sky:SkyRows;shapes:Record<string,{data:unknown}>;puddles:number[];noise:number[];glow:number[];fire:number[]}>('world/weather-fx.json');
 const {game,sky}=ctx,day=rows.sky.day,key=structuredClone(day),kit=dayLookPresets(rows.sky.schema),channels=ctx.ctx.product.shardfile.clientChannels;
 const create=():SkyLook=>({...kit.live(rows.sky.initial),sunDir:new THREE.Vector3(0,1,0),keyDir:new THREE.Vector3(0,1,0)});
 const base=create(),look=create(),dayFog=game.scene.fog instanceof THREE.Fog?game.scene.fog.color:new THREE.Color(...day.fog);
 day.fog=[dayFog.r,dayFog.g,dayFog.b];const shade=painterlyUniforms.uPShade.value,rim=painterlyUniforms.uPRimColor.value;day.shade=[shade.r,shade.g,shade.b];day.rim=[rim.r,rim.g,rim.b];
 const clockRead={get elevation(){return clock.sunElevation;}},baseRead={fogDist:fogUniforms.fogDistDensity.value,fogHeightDensity:fogUniforms.fogHeightDensity.value,brightness:ctx.manifest.grade.brightness};
 const owners=new Map<string,unknown>([['day',day],['key',key],['clock',clockRead],['base',baseRead],['look',base]]);
 for(const field of Object.keys(key) as (keyof SteppeKey)[]){const value=key[field];if(Array.isArray(value))owners.set(`key.${field}`,{
  get x(){return value[0];},set x(n:number){value[0]=n;},get y(){return value[1];},set y(n:number){value[1]=n;},get z(){return value[2];},set z(n:number){value[2]=n;},
 });}
 const keys=installChannelPrograms(channels,'nalati.day',owners),sample=installChannelPrograms(channels,'nalati.sky.sample',owners);
 const shape=rows.shapes['sky'];if(shape===undefined)throw new Error('Missing sky geometry');
 const dome=new THREE.Mesh(new THREE.BufferGeometryLoader().parse(shape),lentLook('nalati-sky-dome'));dome.frustumCulled=false;dome.renderOrder=-100;dome.name='sky-dome';game.scene.add(dome);game.scene.background=null;
 const params=graphParamRoots(channels,'nalati.sky.dome',['nalati-sky-dome']);
 const domeChannels=installChannelPrograms(channels,'nalati.sky.dome',new Map<string,unknown>([...params.roots,['look',look]]));
 const disc=sky.sunDisc,discColor=disc.material instanceof THREE.MeshBasicMaterial?disc.material.color.clone():new THREE.Color(),discScale=disc.scale.x;
 const halo=disc.children.find((child):child is THREE.Sprite=>child instanceof THREE.Sprite),haloScale=halo?.scale.clone(),moonDisc=new THREE.Color(.85,.9,1),tint=new THREE.Color();
 game.levelScope.onDispose(()=>{dome.removeFromParent();dome.geometry.dispose();});
 return {dome,rows,look,dayFog:dayFog.clone(),daySunIntensity:day.sunI,flash:0,
  sample(){
   keys.evaluate({time:0,delta:0,values:{}});sample.evaluate({time:0,delta:0,values:{}});
   compassDir(clock.sunAzimuth,clock.sunElevation,base.sunDir);
   if(base.moon>0)compassDir(clock.moonAzimuth,clock.moonElevation,base.keyDir);else base.keyDir.copy(base.sunDir);
   kit.lerp(look,base,base,0);look.sunDir.copy(base.sunDir);look.keyDir.copy(base.keyDir);
  },
  apply(dt:number){
   sky.setKeyLight(look.keyDir,look.keyColor,look.keyIntensity);syncPainterlySun(sky);
   painterlyUniforms.uPShade.value.copy(look.shadeTint);painterlyUniforms.uPRimColor.value.copy(look.rimColor);
   sky.hemi.color.copy(look.hemiSky);sky.hemi.groundColor.copy(look.hemiGround);sky.hemi.intensity=look.hemiIntensity;
   game.scene.environmentIntensity=look.envIntensity;if(game.scene.fog instanceof THREE.Fog)game.scene.fog.color.copy(look.fogColor);
   fogUniforms.fogSunColor.value.copy(look.fogSunColor);fogUniforms.fogDistDensity.value=look.fogDist;fogUniforms.fogHeightDensity.value=look.fogHeightDensity;
   sky.setCloudLight(look.cloudSun,look.cloudLight);sky.setPlanetLight(look.planetLight,look.planetOpacity);
   disc.visible=look.disc>.01;if(disc.material instanceof THREE.MeshBasicMaterial)disc.material.color.copy(tint.copy(discColor).lerp(moonDisc,look.moon)).multiplyScalar(look.disc*(look.moon>0?1.4:1));
   disc.scale.setScalar(discScale*(look.moon>0?.55:1));if(halo&&haloScale){halo.scale.copy(haloScale).multiplyScalar(look.moon>0?.5:1);halo.material.opacity=look.disc*(look.moon>0?.35:1);}
   domeChannels.evaluate({time:0,delta:dt,values:{flash:this.flash}});pushLentParams(params);dome.position.copy(game.camera.position);
  },
 };
}
