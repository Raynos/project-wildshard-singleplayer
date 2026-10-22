import {BufferAttribute,BufferGeometry,Color,Float16BufferAttribute,Matrix4,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import type {GlbPrimitive} from '../../src/sdk/bake/glb';

/** Wire fixtures cover ordinary float coercion and all distinct accessor storage paths. */
export function glbByteCases():readonly {name:string;parts:readonly GlbPrimitive[]}[] {
 const plain=new BufferGeometry();
 plain.setAttribute('position',new BufferAttribute(new Float64Array([-0,1/3,1e-46,1+2**-30,-2/3,-1e-46,-1,Math.PI,0]),3));
 plain.setAttribute('normal',new BufferAttribute(new Float32Array([0,0,1,0,0,1,0,0,1]),3));
 plain.setAttribute('custom',new BufferAttribute(new Float32Array([1,2,3,4,5,6,7,8,9,10,11,12]),4));
 const native=new BufferGeometry();
 native.setAttribute('position',new BufferAttribute(new Float32Array([-0,0,0,1,0,0,0,1,0]),3));
 native.setAttribute('normal',new Float16BufferAttribute(new Uint16Array([0,0,0x3c00,0,0,0x3c00,0,0,0x3c00]),3));
 native.setAttribute('color',new BufferAttribute(new Uint8Array([255,0,127,255,0,255,63,127,127,63,255,0]),4,true));
 native.setAttribute('pair',new BufferAttribute(new Int16Array([-32767,16384,0,-16384,32767,1]),2,true));
 native.setAttribute('tag',new BufferAttribute(new Uint32Array([0,65536,4294967295]),1));
 native.setIndex(new BufferAttribute(new Uint16Array([2,1,0]),1));
 const indexed=new BufferGeometry();
 indexed.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));
 indexed.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,0,1]),2));
 indexed.setAttribute('tangent',new BufferAttribute(new Float32Array([1,0,0,1,1,0,0,-1,1,0,0,1]),4));
 indexed.setIndex(new BufferAttribute(new Uint32Array([1,2,0]),1));
 const instances=[new Matrix4().makeTranslation(4,2,1),new Matrix4().makeScale(2,3,4)];
 return [
  {name:'source-floats',parts:[{name:'float_values',geometry:plain,material:new MeshStandardMaterial(),customAttributes:{_CUSTOM:'custom'},transform:new Matrix4().makeTranslation(1,2,3)}]},
  {name:'compact-native',parts:[{name:'native_values',geometry:native,material:new MeshStandardMaterial({vertexColors:true}),nativeAttributes:true,compactIndex:true,customAttributes:{_PAIR:'pair',_TAG:'tag'}}]},
  {name:'trs-instances',parts:[{name:'trs_values',geometry:indexed,material:new MeshBasicMaterial(),instances,instanceColours:[new Color(0.25,0.5,0.75),new Color(1,0,0)]}]},
  {name:'matrix-instances',parts:[{name:'matrix_values',geometry:indexed.clone(),material:new MeshStandardMaterial(),instances,exactInstances:true,nativeAttributes:true}]},
 ];
}
