import * as v from 'valibot';
import { WorldUpdatesSchema } from '@wildshard/format/worldUpdates';
import { withOwner } from '@wildshard/engine/app/ownership';
import { updateWind } from '@wildshard/engine/world/wind';
import { wind } from '@wildshard/engine/world/steppeWind';
import type { DeclaredEliteEntry } from '@wildshard/engine/ai/view/eliteEntry';
import type { ArenaRoomEncounter } from '../boss/arenaRoom';
import type { ShardContext } from '../plugin/context';
import { followToonLook } from '../looks/toonLook';
import { toonLightingOf } from '../looks/toonLighting';
import { entryOwner, lateEntryOwner, presentEntryOwner } from './entryOwners';
import { lentToon } from './lentLooks';
import { boundResidentWorldScope } from './hybridPresentation';
import { paintedWorldUpdate } from './paintedWorldStages';
import { clientCosmeticFinishes } from './clientCosmeticFinishes';

/** Original construction owners; ids in rows select only these typed loans. */
export interface WorldUpdateLoans {
  readonly arenas?: ReadonlyMap<string,ArenaRoomEncounter>;
  readonly elites?: ReadonlyMap<string,DeclaredEliteEntry>;
}

/** Entered native updates over the original construction owners. Resolve every
 * loan before registering anything; frame callbacks keep their old order and
 * primitive methods, including the rope's awake/alpha short circuit. */
export function installWorldUpdates(ctx: ShardContext, input: unknown, loans:WorldUpdateLoans={}): void {
  const rows = v.parse(WorldUpdatesSchema, input), scope = ctx.scope, product = ctx.product, runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null) throw new Error('World updates require their native world');
  const bound = boundResidentWorldScope(scope), construction = bound ?? scope, game = world.game;
  const live = (): void => {
    if (scope.disposed || scope.disposing || construction.disposed || construction.disposing || !scope.belongsTo(construction)
      || ctx.scope !== scope || ctx.product !== product || boundResidentWorldScope(scope) !== bound || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game) throw new Error('World update owner left or changed');
  };
  live();
  if (new Set(rows.map(row => row.system)).size !== rows.length) throw new Error('Repeated world update system');
  const checks: (() => boolean)[] = [];
  const updates = rows.map(row => {
    let run: (dt: number, time: number) => void;
    if (row.kind === 'entered-owner') {
      const owner = entryOwner(scope, 'world-frame', row.owner), update = owner.update, late = owner.late;
      if (typeof update !== 'function' || typeof late !== 'function') throw new Error('Invalid world frame owner');
      const same = (): boolean => entryOwner(scope, 'world-frame', row.owner) === owner && owner.update === update && owner.late === late;
      checks.push(same);
      const frame = row.phase === 'update' ? update : late;
      run = (dt, time) => { live(); if (!same()) throw new Error('World frame owner changed'); frame.call(owner, dt, time); };
    } else if (row.kind === 'wind') run = dt => { updateWind(dt); };
    else if (row.kind === 'rope-deck') {
      const deck = entryOwner(scope, 'rope-deck', row.deck), chain = entryOwner(scope, 'chain', row.chain);
      checks.push(() => entryOwner(scope, 'rope-deck', row.deck) === deck && entryOwner(scope, 'chain', row.chain) === chain);
      run = () => { if (chain.awake) deck.setPoses(chain, game.alpha); };
    } else if (row.kind === 'toon-look') {
      const toon = withOwner(construction, () => lentToon(row.look)), lightingId = ctx.product.section('look/toon').lighting.id, lighting = toonLightingOf(lightingId);
      const follow = withOwner(construction, () => followToonLook(ctx.product, row.look));
      checks.push(() => withOwner(construction, () => lentToon(row.look)) === toon && toonLightingOf(lightingId) === lighting);
      run = () => { follow(); };
    } else if (row.kind === 'painted-world') {
      const painted = entryOwner(scope, 'painted-world', row.world);
      checks.push(() => entryOwner(scope, 'painted-world', row.world) === painted);
      run = paintedWorldUpdate(scope, row);
    } else if(row.kind==='audio-scene'){
      // oxlint-disable-next-line typescript/unbound-method -- pin identities; emission uses call(events), gust uses wind's receiver
      const player=world.player,events=ctx.app.events,emit=events.emit,gust=wind.gustAt;
      const ownChecks:(()=>boolean)[]=[()=>world.player===player&&ctx.app.events===events&&events.emit===emit&&wind.gustAt===gust];
      const inputs=row.inputs.map(({name,source})=>{
        let sample:()=>number;
        if(source.kind==='wind')sample=source.field==='speed'?()=>wind.speed:()=>wind.gustAt(player.position.x,player.position.z);
        else if(source.kind==='arena'){
          const owner=loans.arenas?.get(source.owner);if(owner===undefined)throw new Error('Missing audio arena owner');
          ownChecks.push(()=>loans.arenas?.get(source.owner)===owner);
          sample=source.field==='inside'?()=>Number(owner.inside):()=>Number(owner.engaged);
        }else{
          const weatherLoan=lateEntryOwner(scope,'world-weather',source.owner);
          const resolve=()=>{
            const rig=weatherLoan(),sky=rig.sky,storm=rig.storm;
            if(sky===null||source.field==='storm'&&storm===null)throw new Error('Audio weather requires its original sky and storm');
            return {rig,sky,storm,clock:sky.clock};
          };
          let original:ReturnType<typeof resolve>|undefined;
          const read=()=>{
            const rig=weatherLoan();
            original??=resolve();
            if(rig!==original.rig||rig.sky!==original.sky||rig.storm!==original.storm||original.sky.clock!==original.clock)throw new Error('Audio frame owner changed');
            return original;
          };
          ownChecks.push(()=>{if(original!==undefined||presentEntryOwner(scope,'world-weather',source.owner)!==null)read();return true;});
          sample=()=>{const {clock,storm}=read();if(source.field==='sun')return clock.sunElevation;if(source.field==='dark')return Number(clock.dayPhase==='dusk'||clock.dayPhase==='night');if(storm===null)throw new Error('Missing audio storm');return Number(storm.stormActive);};
        }
        return {name,sample};
      });
      const valid=():void=>{live();if(ownChecks.some(check=>!check()))throw new Error('Audio frame owner changed');};
      checks.push(()=>{valid();return true;});
      run=dt=>{valid();const values:[string,number][]=[];for(const source of inputs){valid();const value=source.sample();if(!Number.isFinite(value))throw new Error('Non-finite audio frame input');values.push([source.name,value]);}valid();emit.call(events,'audio.scene-frame',{delta:dt,inputs:Object.fromEntries(values)});};
    } else if(row.kind==='cosmetic-finishes'){
      const owner=loans.elites?.get(row.elite);if(owner===undefined)throw new Error('Missing cosmetic grant owner');
      const skins=owner.skins;
      const valid=():void=>{live();if(loans.elites?.get(row.elite)!==owner||owner.skins!==skins)throw new Error('Cosmetic grant owner changed');};
      checks.push(()=>{valid();return true;});
      let since=0;
      run=dt=>{valid();const finishes=clientCosmeticFinishes(ctx);since-=dt;if(since<=0){since=row.every;for(const id of skins){valid();finishes.locker.own(id);}}valid();finishes.frame(ctx);};
    } else {
      const life = entryOwner(scope, 'buildings', row.owner);
      checks.push(() => entryOwner(scope, 'buildings', row.owner) === life);
      run = dt => { life.update(dt); };
    }
    const system = { id: row.system, phase: row.kind === 'entered-owner' ? row.phase : 'update' as const, before: [...row.before], run };
    return row.after === undefined ? system : Object.assign(system, { after: [...row.after] });
  });
  live(); if (checks.some(check => !check())) throw new Error('World update loans changed');
  for (const system of updates) { live(); ctx.system(system); }
}
