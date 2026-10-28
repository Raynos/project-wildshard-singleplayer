import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, MeshLambertMaterial, MeshPhysicalMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { parseItems } from '../src/format/items';
import { emptyShardfile } from '../src/sdk/author';
import * as geometry from '../src/game/plugin/geometry';
import * as paint from '../src/engine/world/painterly';
import * as ranged from '../src/engine/combat/view/ranged';
import { PolearmSet, type HeldPolearmWorld } from '../src/game/weapons/heldPolearm';
import { nalatiSpear } from './fixtures/nalati-spear';
import { parse } from 'valibot';
import { PolearmRowsSchema } from '../src/format/heldMelee';
import { HeldDecision } from '../src/game/weapons/heldDecision';
import { originalHeldMetadata } from './fixtures/nalati-held-original';
import { lendNalatiHeld } from './fixtures/nalati-return-modules';
import powers from '../src/shards/nalati-grasslands/data/weaponPowers.json' with { type: 'json' };
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };

const spear=parse(PolearmRowsSchema,{...nalatiSpear.rows,program:originalHeldMetadata().held.programs.polearm,presentation:powers.polearm});
afterEach(()=>{vi.restoreAllMocks();});
function fixture(){
  const scope=new Scope('held-pool');lendNalatiHeld(scope);const decision=vi.spyOn(HeldDecision.prototype,'update');const part=new BoxGeometry(),preload=vi.fn(()=>Promise.resolve()),lookup=vi.fn(()=>part);
  vi.spyOn(geometry,'createModelLibrary').mockReturnValue(legacyDouble<ReturnType<typeof geometry.createModelLibrary>>({preload,geometry:lookup}));
  vi.spyOn(paint,'painterlyMaterial').mockImplementation(()=>new MeshLambertMaterial());
  vi.spyOn(ranged,'viewmodelMaterial').mockImplementation(()=>new MeshPhysicalMaterial());
  const set=new PolearmSet({file:'weapons/polearm.json',item:'weapon.spear'}),warm=vi.fn(()=>Promise.resolve());
  const product={shardfile:{...emptyShardfile({slug:'held-fixture',name:'Held',author:'Fixture',revision:1,seed:1}),items:parseItems(items)},
    file:vi.fn(()=>Promise.resolve(new TextEncoder().encode(JSON.stringify(spear)))),hasFile:()=>false,url:(name:string)=>name};
  const world:HeldPolearmWorld={game:legacyDouble<HeldPolearmWorld['game']>({levelScope:scope,camera:new PerspectiveCamera(),scene:new Scene(),warmSceneRoots:warm,
    viewmodel:legacyDouble<HeldPolearmWorld['game']['viewmodel']>({mountOwnPass:()=>undefined})}),sky:legacyDouble<HeldPolearmWorld['sky']>({}),
    player:legacyDouble<HeldPolearmWorld['player']>({position:new Vector3(),yaw:0,pitch:0,moveScale:1,swinging:false,sprinting:false}),forest:legacyDouble<HeldPolearmWorld['forest']>({})};
  return {scope,part,preload,lookup,set,product,world,warm,decision};
}
test('explicit spare geometry keeps admitted numeric state and native decision clocks without fetching a pool',async()=>{
  const f=fixture();
  try{
    await f.set.prepare(f.product,{geometry:'on-select'});expect(f.product.file).toHaveBeenCalledOnce();expect(f.preload).not.toHaveBeenCalled();expect(f.set.profile().reach).toBe(spear.profile.reach);
    const weapon=new f.set.Weapon(f.world,undefined,{owner:f.scope});weapon.setActive(false);
    expect(weapon.needsPreparation).toBe(true);expect(f.lookup).not.toHaveBeenCalled();const state=weapon.state;
    weapon.update(.05,1);weapon.update(.05,1.05);expect(f.decision).toHaveBeenCalledOnce();expect(f.decision.mock.calls[0]?.[0]).toBe(.1);
    expect(weapon.state).toBe(state);expect(weapon.state.ammo).toBe(weapon.maxJavelins);expect(()=>weapon.setActive(true)).toThrow('not prepared');
    await Promise.all([weapon.prepareView(),weapon.prepareView()]);expect(f.preload).toHaveBeenCalledOnce();expect(f.warm).toHaveBeenCalledOnce();expect(weapon.needsPreparation).toBe(false);
    expect(weapon.state).toBe(state);weapon.setActive(true);expect(weapon.model.visible).toBe(true);expect(weapon.model.children.length).toBeGreaterThan(0);
    await weapon.prepareView();expect(f.preload).toHaveBeenCalledOnce();
  }finally{f.scope.dispose();f.part.dispose();}
});
test('eager default preloads the same complete pool and builds synchronously',async()=>{
  const f=fixture();
  try{await f.set.prepare(f.product);expect(f.preload).toHaveBeenCalledOnce();const weapon=new f.set.Weapon(f.world);expect(weapon.needsPreparation).toBe(false);expect(weapon.model.children.length).toBeGreaterThan(0);expect(f.warm).not.toHaveBeenCalled();}
  finally{f.scope.dispose();f.part.dispose();}
});
test('owner retirement during first pool read prevents visual construction and publication',async()=>{
  const f=fixture();let finish:()=>void=()=>undefined;f.preload.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  try{await f.set.prepare(f.product,{geometry:'on-select'});const weapon=new f.set.Weapon(f.world,undefined,{owner:f.scope});weapon.setActive(false);
    const pending=weapon.prepareView();f.scope.dispose();finish();await expect(pending).rejects.toThrow('owner left');expect(f.lookup).not.toHaveBeenCalled();expect(f.warm).not.toHaveBeenCalled();expect(weapon.needsPreparation).toBe(true);}
  finally{f.scope.dispose();f.part.dispose();}
});
