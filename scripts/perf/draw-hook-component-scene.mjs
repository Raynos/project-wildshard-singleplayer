// Deterministic native component scene for draw-hook parity. No game clock or post.
import * as T from 'three';
import { createRenderer } from '../../src/engine/render/renderer';
import { EngineNodesHandler } from '../../src/engine/render/nodes/engineNodesHandler';
import { Scope } from '../../src/engine/app/scope';
import { AssetService } from '../../src/engine/app/assets';
import { ownSceneTree } from '../../src/engine/app/sceneOwnership';
import { UploadOwnership } from '../../src/engine/render/uploadOwnership';
import { installMemorySaver } from '../../src/engine/render/memorySaver';
import { installGpuLabels } from '../../src/engine/render/gpuLabels';
import { gpuOnlyTexture } from '../../src/engine/core/gpuOnly';

const canvas = document.createElement('canvas'); document.body.append(canvas);
const context = canvas.getContext('webgl2', {antialias:false, preserveDrawingBuffer:true});
if (!context) throw new Error('Native WebGL2 unavailable');
const scope = new Scope('draw-components'), assets = new AssetService();
const uploads = new UploadOwnership(scope, assets);
const renderer = createRenderer(canvas, context, {assets, scope, uploads});
renderer.setPixelRatio(2); renderer.setSize(402, 874); renderer.shadowMap.enabled = true;
renderer.setNodesHandler(new EngineNodesHandler()); installMemorySaver(renderer);
const scene = new T.Scene(); scene.background = new T.Color('#153449');
const camera = new T.PerspectiveCamera(42, 402 / 874, .1, 100);
camera.position.set(9, 11, 19); camera.lookAt(0, 1, 0);
scene.add(new T.AmbientLight(0xffffff, .8));
const sun = new T.DirectionalLight(0xffffff, 3); sun.position.set(-5, 12, 6); sun.castShadow = true;
sun.shadow.mapSize.set(256,256); sun.shadow.camera.left=-8; sun.shadow.camera.right=8;
sun.shadow.camera.top=8; sun.shadow.camera.bottom=-8; scene.add(sun);
const ground = new T.Mesh(new T.PlaneGeometry(20,20), new T.MeshStandardMaterial({color:0x728c70,roughness:1}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const pixels = new Uint8Array([255,80,32,255, 20,220,140,255, 60,80,240,255, 250,230,70,255]);
const texture = new T.DataTexture(pixels,2,2); texture.magFilter=T.NearestFilter; texture.needsUpdate=true;
assets.register('component:checker',texture,{retain:true,cache:true});
const material = new T.MeshStandardMaterial({map:texture, roughness:.7});
const geometry = new T.BoxGeometry(1.7,2.6,1.7);
const first = new T.Mesh(geometry,material); first.position.set(-2,1.3,0); first.castShadow=true;
const instances = new T.InstancedMesh(geometry,material,2); instances.castShadow=true;
instances.setMatrixAt(0,new T.Matrix4().makeTranslation(1,1.3,0));
instances.setMatrixAt(1,new T.Matrix4().makeTranslation(2.8,1.3,-2));
const firstOwner=scope.child('first'), secondOwner=scope.child('second');
const firstRoot=new T.Group().add(first), secondRoot=new T.Group().add(instances);
ownSceneTree(firstRoot,firstOwner,assets); ownSceneTree(secondRoot,secondOwner,assets); scene.add(firstRoot,secondRoot);
const snapshots=[];
function capture(id) {
  renderer.setRenderTarget(null); renderer.setScissorTest(false);
  renderer.setViewport(0,0,402,874); renderer.render(scene,camera); renderer.info.reset(); renderer.render(scene,camera);
  const data=new Uint8Array(context.drawingBufferWidth*context.drawingBufferHeight*4);
  context.readPixels(0,0,context.drawingBufferWidth,context.drawingBufferHeight,context.RGBA,context.UNSIGNED_BYTE,data);
  const lit=data.reduce((sum,value,index)=>sum+(index%4===0 && (value+data[index+1]+data[index+2]>0)?1:0),0);
  if (!renderer.info.render.calls || !renderer.info.render.triangles || !lit || context.getError()!==context.NO_ERROR) throw new Error(`Invalid native component frame ${id}`);
  snapshots.push({id,state:{width:context.drawingBufferWidth,height:context.drawingBufferHeight,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
    textureVersion:texture.version,sourceVersion:texture.source.version,lit},data});
}
try {
  capture('first-upload-shadow');
  capture('repeated-consumer');
  const target=new T.WebGLRenderTarget(64,64); renderer.setRenderTarget(target); renderer.render(scene,camera);
  capture('target-rebind'); target.dispose();
  texture.dispose(); texture.needsUpdate=true; capture('native-row-recreated');
  firstRoot.remove(first); secondRoot.add(first); capture('consumer-reparent');
  installGpuLabels(renderer); capture('labels-installed');
  const extension=context.getExtension('WEBGL_compressed_texture_s3tc');
  if (!extension) throw new Error('Native S3TC required for compressed first-draw component');
  const compressed=new T.CompressedTexture([{width:4,height:4,data:new Uint8Array([0,248,0,248,0,0,0,0])}],4,4,T.RGB_S3TC_DXT1_Format);
  compressed.minFilter=T.NearestFilter; compressed.magFilter=T.NearestFilter; compressed.generateMipmaps=false;
  compressed.needsUpdate=true; gpuOnlyTexture(compressed,'component compressed');
  const compressedMaterial=new T.MeshBasicMaterial({map:compressed}); first.material=compressedMaterial;
  capture('compressed-first-draw');
  if (compressed.mipmaps.some(m=>m.data.byteLength!==0)) throw new Error('Successful compressed draw retained CPU bytes');
  capture('compressed-retired-repeat');
  // Cross the production 240-render static-geometry retirement boundary.
  for (let frame=0;frame<242;frame++) renderer.render(scene,camera);
  capture('settled-static-geometry');
  const skinGeometry=new T.BoxGeometry(1.5,2.5,1.5), count=skinGeometry.attributes.position.count;
  skinGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4); for(let index=0;index<count;index++)weights[index*4]=1;
  skinGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const bone=new T.Bone(), skin=new T.SkinnedMesh(skinGeometry,material);
  skin.add(bone); skin.bind(new T.Skeleton([bone])); skin.position.set(0,2,3); skin.castShadow=true;
  secondRoot.add(skin); capture('skinned-shadow');
  bone.rotation.z=.2; bone.updateMatrixWorld(true); capture('skinned-pose-change');
  window.componentProof={snapshots};
} catch(error) { window.componentProof={error:String(error.stack??error)}; }
