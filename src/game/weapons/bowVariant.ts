import * as THREE from 'three';
import type {BowVariantRows} from '@wildshard/format/bowVariantRows';
import type {TargetAnimal} from '@wildshard/engine/combat/types';
import {equipmentActorOwner} from '../loadout/actors';
import {ReturnProgram} from '../population/returnProgram';
import {ProjectedTrail} from '../shardfile/clientTrails';
import type {Bow} from './Bow';

/** Client-only held variant. The existing bow and its native actor owner keep
 * their identities; charged activation and contact numbers come from the guest. */
export class VariantBowPower {
  private bow:Bow|null=null;
  private brain:ReturnProgram|null=null;
  private readonly trail:ProjectedTrail;
  private readonly pending:{t:number;target:TargetAnimal;point:THREE.Vector3;dir:THREE.Vector3;base:number}[]=[];
  private sunShot=false;
  private readonly origin=new THREE.Vector3();private readonly direction=new THREE.Vector3();private readonly velocity=new THREE.Vector3();private readonly at=new THREE.Vector3();private readonly segment=new THREE.Vector3();
  constructor(scene:THREE.Scene,private readonly camera:THREE.Camera,private readonly rows:BowVariantRows){
    if(this.rows.trail.points>48)throw new Error('Bow prediction exceeds its native contact bound');
    this.trail=new ProjectedTrail(scene,camera,this.rows.trail);
  }
  get applied():boolean{return this.bow!==null;}
  apply(bow:Bow):void{
    const {rows}=this,owner=equipmentActorOwner(bow.targetSource);this.brain??=ReturnProgram.page(rows.program,owner.scope);
    bow.row={...bow.row,id:rows.id,meta:{...bow.meta,name:rows.name}};if(this.bow===bow)return;
    this.bow=bow;bow.setStyle(rows.style);bow.drawSpeedScale*=rows.drawSpeed;bow.onLoose=power=>{this.loosed(power);};
    const previous=bow.damageMultiplier;
    bow.damageMultiplier=hit=>{
      const scales=Object.hasOwn(rows.damageScale.kinds,hit.animal.kind)?rows.damageScale.kinds[hit.animal.kind]:undefined;
      return (previous?.(hit)??1)*(scales??rows.damageScale.base)[this.sunShot?1:0];
    };
  }
  private decide(power:number,base=0,crush=false):Readonly<Record<string,number>>{
    const rows=this.rows;if(this.brain===null)throw new Error('Variant has no applied native owner');return this.brain.project(rows.signal,{bowPower:power,bowThreshold:rows.threshold,bowBaseDamage:base,bowPierce:rows.pierce,bowCrush:Number(crush),bowCrushScale:rows.crush});
  }
  private loosed(power:number):void{
    const bow=this.bow;this.sunShot=this.decide(power)['bowSun']===1;if(bow===null||!this.sunShot)return;
    const {flight}=this.rows,animals=equipmentActorOwner(bow.targetSource).animals,o=this.origin,d=this.direction,v=this.velocity,a=this.at,b=this.segment;
    this.camera.getWorldDirection(d);o.setFromMatrixPosition(this.camera.matrixWorld).addScaledVector(d,flight.offset);v.copy(d).multiplyScalar(flight.base+flight.draw*power).add(bow.carrierVelocity);
    const n=bow.arrows.predict(o,v,this.trail.points,this.rows.trail.points,flight.step,flight.from);this.trail.show(n);
    let first:TargetAnimal|null=null,travelled=0,ax=o.x,ay=o.y,az=o.z;
    for(let i=0;i<48;i++){
      if(i>=n)break;const bx=this.trail.points[i*3]??ax,by=this.trail.points[i*3+1]??ay,bz=this.trail.points[i*3+2]??az;
      a.set(ax,ay,az);b.set(bx-ax,by-ay,bz-az);const length=b.length();
      if(length>1e-3){b.multiplyScalar(1/length);let from=0;
        for(let guard=0;guard<3;guard++){
          const hit=animals.raycast(a.set(ax,ay,az).addScaledVector(b,from),b,length-from);if(hit===null)break;
          if(first===null){first=hit.animal;from+=hit.distance+flight.gap;continue;}
          if(hit.animal!==first&&hit.animal.alive){this.pending.push({t:(travelled+from+hit.distance)/(flight.base+flight.draw*power),target:hit.animal,point:hit.point.clone(),dir:b.clone(),base:hit.damage});return;}
          from+=hit.distance+flight.gap;
        }
      }
      travelled+=length;ax=bx;ay=by;az=bz;
    }
  }
  update(dt:number):void{
    this.trail.advance(dt);
    for(let i=this.pending.length-1;i>=0;i--){const hit=this.pending[i];if(hit===undefined)continue;hit.t-=dt;if(hit.t>0)continue;this.pending.splice(i,1);
      if(!hit.target.alive)continue;const result=this.decide(0,hit.base,this.rows.crushKinds.includes(hit.target.kind)),damage=result['bowDamage'];if(damage===undefined)throw new Error('Missing variant contact number');hit.target.applyDamage(damage,hit.point,hit.dir);
    }
  }
}
