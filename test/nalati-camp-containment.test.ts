import { afterEach,expect,test,vi } from 'vitest';
import { Bone,Box3,BoxGeometry,Float32BufferAttribute,Group,Matrix4,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { TIER } from '../src/engine/core/tier';
import { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { cellClip } from '../src/game/grid/cellClip';
import { uploadedSkinBounds } from '../src/game/grid/skinEnvelope';
import { enterFigureGroup } from '../src/game/systems/npc/figureRows';
import * as skins from '../src/game/systems/npc/figureSkins';
import channels from '../src/shards/nalati-grasslands/data/peopleChannels.generated.json' with { type: 'json' };
import population from '../src/shards/nalati-grasslands/data/peopleFrames.generated.json' with { type: 'json' };

afterEach(() => { vi.restoreAllMocks(); });
function isSkin(value: unknown): value is SkinnedMesh { return value instanceof SkinnedMesh; }

function prepared(scope: Scope): SkinnedMesh {
  const geometry=scope.own(new BoxGeometry(1,1,1)), count=geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const mesh=new SkinnedMesh(geometry,scope.own(new MeshBasicMaterial()));
  const bones=population.atlas[TIER].joints.map(name=>{const bone=new Bone();bone.name=name;return bone;});
  mesh.bind(scope.own(new Skeleton(bones)),new Matrix4());mesh.name='prepared-camp';mesh.castShadow=true;
  return mesh;
}

test('the real camp owns its manual joints and preserves poses in a translated grid cell',async()=>{
  setTerrainHeight(()=>12);
  const scope=new Scope('camp-grid'), poses: Matrix4[][]=[];
  vi.spyOn(skins,'atlasFigureSkin').mockImplementation((_rows,_sky,owner)=>Promise.resolve(prepared(owner)));
  const sky:unknown=Object.create(SkyRig.prototype);if(!(sky instanceof SkyRig))throw new Error('Missing sky');
  try {
    for(const offset of [0,555]){
      const owner=scope.child(`camp-${offset}`), cell=new Group();cell.name='region:camp';cell.position.set(offset,0,-offset);
      const registry=new WorldRegistry();registry.scope=owner;registry.frame=cell;
      registry.onAdd(piece=>{if(piece.object!==undefined)cell.add(piece.object);});
      const guard=cellClip(cell,250,owner);guard.sweep();
      const camp=enterFigureGroup({scope:owner,sky,registry,channels:channels.clientChannels},population);
      await camp.ready;camp.update(.016,1,new Vector3(90,12,215));
      const mesh=camp.group.getObjectByName('prepared-camp');if(!isSkin(mesh))throw new Error('Missing camp skin');
      for(const bone of mesh.skeleton.bones)expect(bone.parent).toBe(camp.group);
      mesh.updateMatrixWorld(true);mesh.skeleton.update();guard.update();
      const bounds=uploadedSkinBounds(mesh,new Box3()).applyMatrix4(mesh.matrixWorld);
      expect(bounds.min.x).toBeGreaterThan(offset-250);expect(bounds.max.x).toBeLessThan(offset+250);
      expect(bounds.min.z).toBeGreaterThan(-offset-250);expect(bounds.max.z).toBeLessThan(-offset+250);
      expect(mesh.visible).toBe(true);expect(guard.state().refused).toBe(0);
      poses.push(mesh.skeleton.bones.map(bone=>bone.matrixWorld.clone()));
    }
    const [local,regional]=poses;if(local===undefined||regional===undefined)throw new Error('Missing paired poses');
    const frame=new Matrix4().makeTranslation(555,0,-555);
    for(const [i,pose] of local.entries())expect(regional[i]?.elements).toEqual(frame.clone().multiply(pose).elements);
  }finally{scope.dispose();}
});

test('a skin borrowing a bone from another cell is still refused',()=>{
  const scope=new Scope('foreign-camp'),cell=new Group(),other=new Group(),mesh=prepared(scope),bone=mesh.skeleton.bones[0];
  if(bone===undefined)throw new Error('Missing joint');other.add(bone);
  cellClip(cell,250,scope).sweep();
  try{expect(()=>cell.add(mesh)).toThrow('Cell skin borrows bones outside its cell');expect(mesh.visible).toBe(false);}
  finally{scope.dispose();}
});
