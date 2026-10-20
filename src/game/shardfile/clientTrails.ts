import {fxMaterial,FX,type FxMaterial} from '@wildshard/engine/fx/groundFx';
import { BufferAttribute, BufferGeometry, Mesh, Vector3, Color, DynamicDrawUsage, type Object3D, type Camera } from 'three';
import { parse } from 'valibot';
import { SlashTrail } from '@wildshard/engine/combat/view/slashTrail';
import { ClientTrailsSchema,ProjectedTrailSchema,type ProjectedTrailRows } from '@wildshard/format/clientTrails';
import type { ShardContext } from '../plugin/context';
import { clientPopulationActors } from './clientPopulation';
import { sceneModelSource } from './sceneSources';

/** Client-only point trails on the actual population, entered after its
 * bodies exist. The look owns materials; the entered scope owns geometry. */
export function installClientTrails(ctx: ShardContext, input: unknown): void {
  const rows = parse(ClientTrailsSchema, input), eye = new Vector3();
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('Trails require the entered world');
  for (const row of rows.rows) {
    const material = sceneModelSource(ctx.product, row.library).look(row.look);
    if (material === undefined) throw new Error(`Missing trail look: ${row.look}`);
    const trails = clientPopulationActors(ctx, row.group).map(actor => {
      const positions = new Float32Array(row.points * 6), fade = new Float32Array(row.points * 2), sides = new Float32Array(row.points * 2), indices: number[] = [];
      for (let i = 0; i < row.points - 1; i++) { const a = i * 2; indices.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      for (let i = 0; i < row.points; i++) { const f = 1 - i / (row.points - 1); fade[i * 2] = f; fade[i * 2 + 1] = f; sides[i * 2] = 1; sides[i * 2 + 1] = -1; }
      const geometry = new BufferGeometry(), attribute = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', attribute); geometry.setAttribute('aFade', new BufferAttribute(fade, 1)); geometry.setAttribute('aSide', new BufferAttribute(sides, 1)); geometry.setIndex(indices);
      const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; mesh.name = row.name; mesh.visible = false;
      ctx.root.add(mesh); ctx.scope.own(geometry); ctx.scope.onDispose(() => { mesh.removeFromParent(); });
      return { actor, mesh, positions, attribute, follow: SlashTrail.follow({ kind: rows.kind, points: row.points, every: row.every, movementSq: row.movementSq }) };
    });
    ctx.system({ id: row.id, phase: 'late', run: dt => {
      for (const trail of trails) {
        trail.mesh.visible = trail.actor.alive;
        if (!trail.follow.follow(trail.actor.position, trail.actor.alive, dt)) continue;
        trail.follow.face(trail.mesh.worldToLocal(world.game.camera.getWorldPosition(eye)), row.width, row.minimum, trail.positions);
        trail.attribute.needsUpdate = true;
      }
    } });
  }
}

/** Client-only camera-facing prediction ribbon over native points. The caller
 * lends scene/camera identities; topology, widths and fade are data. */
export class ProjectedTrail {
  readonly points:Float32Array;
  readonly mesh:Mesh<BufferGeometry,FxMaterial>;
  private readonly rows:ProjectedTrailRows;
  private readonly positions:Float32Array;
  private readonly attribute:BufferAttribute;
  private remaining=0;
  private readonly eye=new Vector3();private readonly tangent=new Vector3();private readonly side=new Vector3();
  constructor(scene:Object3D,private readonly camera:Camera,input:unknown){
    const rows=parse(ProjectedTrailSchema,input);this.rows=rows;this.points=new Float32Array(rows.points*3);
    this.positions=new Float32Array(rows.points*6);this.attribute=new BufferAttribute(this.positions,3);this.attribute.setUsage(DynamicDrawUsage);
    const geometry=new BufferGeometry(),uv=new Float32Array(rows.points*4),indices:number[]=[];
    for(let i=0;i<rows.points;i++){uv.set([i/(rows.points-1),0,i/(rows.points-1),1],i*4);if(i<rows.points-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
    geometry.setAttribute('position',this.attribute);geometry.setAttribute('normal',new BufferAttribute(new Float32Array(rows.points*6),3));geometry.setAttribute('uv',new BufferAttribute(uv,2));geometry.setIndex(indices);
    this.mesh=new Mesh(geometry,fxMaterial(FX.streak,new Color(...rows.color),0));this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=rows.order;scene.add(this.mesh);
  }
  show(count:number):void{
    const {rows,points,positions,tangent,side}=this;if(!Number.isInteger(count)||count<0||count>rows.points)throw new Error('Invalid prediction length');if(count<2)return;
    this.eye.setFromMatrixPosition(this.camera.matrixWorld);
    for(let i=0;i<rows.points;i++){
      const j=Math.min(i,count-1),k=Math.min(j+1,count-1),h=Math.max(0,j-1),x=points[j*3]??0,y=points[j*3+1]??0,z=points[j*3+2]??0;
      tangent.set((points[k*3]??x)-(points[h*3]??x),(points[k*3+1]??y)-(points[h*3+1]??y),(points[k*3+2]??z)-(points[h*3+2]??z));side.set(x-this.eye.x,y-this.eye.y,z-this.eye.z);
      tangent.cross(side).normalize().multiplyScalar(rows.width[0]+rows.width[1]*(j/Math.max(1,count-1)));
      positions.set([x-tangent.x,y-tangent.y,z-tangent.z,x+tangent.x,y+tangent.y,z+tangent.z],i*6);
    }
    this.attribute.needsUpdate=true;this.remaining=rows.lifetime;this.mesh.visible=true;
  }
  advance(dt:number):void{
    if(this.remaining<=0)return;this.remaining-=dt;this.mesh.material.uniforms.uAlpha.value=Math.max(0,this.remaining/this.rows.lifetime)**this.rows.fade;
    if(this.remaining<=0)this.mesh.visible=false;
  }
  dispose():void{this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
