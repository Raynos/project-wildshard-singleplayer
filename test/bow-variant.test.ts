import {expect,test,vi} from 'vitest';
import * as THREE from 'three';
import {Bow} from '../src/game/weapons/Bow';
import {VariantBowPower} from '../src/game/weapons/bowVariant';
import {bindEquipmentActors,equipmentActorOwner} from '../src/game/loadout/actors';
import {AnimalManager} from '../src/engine/entities/AnimalManager';
import {Animal} from '../src/engine/entities/AnimalView';
import {Scope} from '../src/engine/app/scope';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import rows from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};
import items from '../src/shards/nalati-grasslands/data/items.json' with {type:'json'};

function actor(kind:string):Animal{
  const value:unknown=Object.create(Animal.prototype);if(!(value instanceof Animal))throw new Error('Missing native actor');
  Object.assign(value,{kind,alive:true,position:new THREE.Vector3(),applyDamage:vi.fn(()=>false)});return value;
}
function owner(scope:Scope){
  const animals:unknown=Object.create(AnimalManager.prototype);if(!(animals instanceof AnimalManager))throw new Error('Missing native owner');
  const targets={raycast:()=>null};bindEquipmentActors(targets,animals,scope);return{animals,targets};
}
function bow(targets:ReturnType<typeof owner>['targets']):Bow{
  const value:unknown=Object.create(Bow.prototype);if(!(value instanceof Bow))throw new Error('Missing native bow');
  Object.assign(value,{targets,row:new ItemCatalogue(items).equipment('weapon.bow'),drawSpeedScale:1,carrierVelocity:new THREE.Vector3(),damageMultiplier:()=>2,
    arrows:{predict:(_o:THREE.Vector3,_v:THREE.Vector3,points:Float32Array)=>{points.set([0,0,-10,0,0,-20]);return 2;}}});return value;
}

test('the native variant keeps composition, upgrade idempotence and delayed secondary contact',()=>{
  const scope=new Scope('bow-variant'),{animals,targets}=owner(scope),first=actor('wolf'),second=actor('balbal'),weapon=bow(targets),camera=new THREE.PerspectiveCamera();
  vi.spyOn(Bow.prototype,'setStyle').mockImplementation(()=>undefined);
  const hurt=vi.spyOn(second,'applyDamage'),hurtFirst=vi.spyOn(first,'applyDamage');
  const ray=vi.spyOn(animals,'raycast').mockReturnValueOnce({animal:first,point:new THREE.Vector3(0,0,-1),distance:1,headshot:false,damage:10}).mockReturnValueOnce({animal:second,point:new THREE.Vector3(0,0,-3),distance:1,headshot:false,damage:20}).mockReturnValue(null);
  try{
    const power=new VariantBowPower(new THREE.Scene(),camera,rows);power.apply(weapon);power.apply(weapon);
    expect(weapon.drawSpeedScale).toBe(1.2);expect(weapon.row.id).toBe('weapon.golden-bow');
    weapon.onLoose?.(.9);expect(ray).not.toHaveBeenCalled();
    expect(weapon.damageMultiplier?.({animal:second,point:new THREE.Vector3(),distance:1,headshot:false})).toBe(4);
    weapon.onLoose?.(1);expect(ray).toHaveBeenCalledTimes(2);expect(weapon.damageMultiplier?.({animal:second,point:new THREE.Vector3(),distance:1,headshot:false})).toBe(6);
    power.update(.001);expect(hurt).not.toHaveBeenCalled();power.update(1);expect(hurt).toHaveBeenCalledWith(72,new THREE.Vector3(0,0,-3),expect.any(THREE.Vector3));
    expect(hurtFirst).not.toHaveBeenCalled();
  }finally{scope.dispose();vi.restoreAllMocks();}
});

test('independent kit owners and an orchard charged variant do not share actors or thresholds',()=>{
  const a=new Scope('orchard-kit'),b=new Scope('other-kit'),one=owner(a),two=owner(b),weapon=bow(one.targets),first=actor('beetle'),second=actor('log');
  vi.spyOn(Bow.prototype,'setStyle').mockImplementation(()=>undefined);
  const hurt=vi.spyOn(second,'applyDamage');
  const ray=vi.spyOn(one.animals,'raycast').mockReturnValueOnce({animal:first,point:new THREE.Vector3(),distance:1,headshot:false,damage:5}).mockReturnValueOnce({animal:second,point:new THREE.Vector3(),distance:1,headshot:false,damage:5}).mockReturnValue(null);
  try{
    expect(equipmentActorOwner(one.targets).animals).toBe(one.animals);expect(equipmentActorOwner(two.targets).animals).toBe(two.animals);
    const power=new VariantBowPower(new THREE.Scene(),new THREE.PerspectiveCamera(),{...rows,id:'weapon.orchard-bow',name:'Harvest bow',style:'recurve',threshold:.5,pierce:2,crush:4,crushKinds:['log'],multipliers:[]});
    power.apply(weapon);weapon.onLoose?.(.6);expect(ray).toHaveBeenCalledTimes(2);power.update(1);expect(hurt).toHaveBeenCalledWith(40,expect.any(THREE.Vector3),expect.any(THREE.Vector3));
    a.dispose();expect(()=>equipmentActorOwner(one.targets).animals).toThrow('no native actor owner');expect(equipmentActorOwner(two.targets).animals).toBe(two.animals);
  }finally{a.dispose();b.dispose();vi.restoreAllMocks();}
});
