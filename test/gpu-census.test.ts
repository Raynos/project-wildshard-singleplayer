import {afterEach, expect, test, vi} from 'vitest';
import {installGpuProbe, type GpuCensusPort} from '../scripts/perf/gpu-census-page.mjs';
import {gpuPairs,gpuPhoneModel} from '../scripts/perf/gpu-census-report.mjs';

const windowDescriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
function fixture() {
  let port:GpuCensusPort|undefined;
  const gl={DEPTH_BUFFER_BIT:256,COLOR_BUFFER_BIT:16384,RGBA:6408,UNSIGNED_BYTE:5121,NO_ERROR:0,VIEWPORT:2978,RENDERER:7937,
    drawingBufferWidth:804,drawingBufferHeight:1748,getError:()=>0,isContextLost:()=>false,
    readPixels:vi.fn(),blitFramebuffer:vi.fn(),getExtension:()=>null,getParameter:(key:number)=>key===2978?[0,0,804,1748]:'Metal fixture'};
  const originalBlit=gl.blitFramebuffer;
  const rect={x:4,y:5,z:6,w:7},originalRect={...rect};
  const draw=vi.fn(),camera={fov:93,aspect:402/874,matrixWorld:{toArray:()=>[]},projectionMatrix:{toArray:()=>[]}};
  const material={name:'graph:material:nine-architecture',type:'ShaderMaterial',uuid:'material',alphaTest:0,fragmentShader:'void main() {}'};
  const object={name:'slab',parent:null,material};
  const renderer={getContext:()=>gl,renderBufferDirect:draw,getRenderTarget:()=>null,
    setRenderTarget:vi.fn(),getScissorTest:()=>true,setScissorTest:vi.fn(),
    getScissor:(target:{copy:(value:typeof rect)=>unknown})=>target.copy(rect),
    setScissor:(x:number,y:number,z:number,w:number)=>{Object.assign(rect,{x,y,z,w});},clear:vi.fn(),
    shadowMap:{autoUpdate:true,needsUpdate:true},info:{reset:vi.fn(),render:{calls:1,triangles:2},programs:[]}};
  const pass={name:'RenderPass',enabled:true,effects:[],render:()=>{renderer.renderBufferDirect();}};
  const composer={passes:[pass],render:()=>{if(pass.enabled) Reflect.apply(pass.render,pass,[camera,null,null,material,object,null]);}};
  // The fixture drives the real serialized probe with native-shaped, explicit ports.
  pass.render=()=>{Reflect.apply(renderer.renderBufferDirect,renderer,[camera,null,null,material,object,null]);};
  const game={renderer,composer,rootScene:{traverseVisible:vi.fn()},camera,frameCount:10};
  const world={game,player:{position:{toArray:()=>[1,2,3]}}};
  const fakeWindow={__wildshard:{requireWorld:()=>world}};
  Object.defineProperty(fakeWindow,'__gpuCensus',{get:()=>port,set:(value:GpuCensusPort)=>{port=value;}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:fakeWindow});
  const environment=installGpuProbe();
  if(port===undefined)throw new Error('Missing installed probe');
  return {port,environment,renderer,pass,draw,gl,rect,originalRect,material,originalBlit};
}
afterEach(()=>{if(windowDescriptor===undefined)Reflect.deleteProperty(globalThis,'window');else Object.defineProperty(globalThis,'window',windowDescriptor);});

test('paired subtraction retains negative savings, no-op noise and the model label',()=>{
 const pairs=[{baseline:3,off:4,baselineCpu:1,offCpu:1},{baseline:10,off:9,baselineCpu:2,offCpu:2},{baseline:5,off:7,baselineCpu:1,offCpu:2}];
 expect(gpuPairs(pairs)).toMatchObject({baseline:5,off:7,saved:-1,pairs});
 expect(()=>gpuPairs([])).toThrow('Missing paired');
 expect(()=>gpuPairs([{baseline:0,off:1,baselineCpu:1,offCpu:1}])).toThrow('Invalid paired');
 expect(()=>gpuPairs([{baseline:1,off:Number.NaN,baselineCpu:1,offCpu:1}])).toThrow('Invalid paired');
 expect(gpuPhoneModel(2,79)).toEqual({kind:'phone-frame / Mac-throughput MODEL',macThroughputMs:2,phoneFrameMs:79,factor:39.5,officialTimingCredit:false});
 expect(()=>gpuPhoneModel(0,79)).toThrow('Invalid GPU calibration');
});

test('the real probe inventories submitted aliases and restores native methods and scissor rectangle',()=>{
 const f=fixture(),originalDraw=f.draw,originalBlit=f.originalBlit;
 expect(f.environment.buffer).toEqual([804,1748]);
 const inventory=f.port.batch('inventory',1);
 expect(inventory.materials).toMatchObject([{name:'graph:material:nine-architecture',groups:['group:facades-slabs'],draws:1,viewportPixelUpperBound:804*1748,fullscreenPixels:0}]);
 expect(f.rect).toEqual(f.originalRect);
 f.port.restore();expect(f.renderer.renderBufferDirect).toBe(originalDraw);expect(f.gl.blitFramebuffer).toBe(originalBlit);
});

test('the real probe skips actual draw submissions and restores every temporary pass/shadow mutation on failure',()=>{
 const f=fixture();f.draw.mockClear();
 const time=f.port.batch('throughput',2,'group:facades-slabs');
 expect(f.draw).not.toHaveBeenCalled();expect(time.whole).toBeGreaterThanOrEqual(time.cpu);
 f.gl.readPixels.mockImplementation(()=>{throw new Error('Native readback failed');});
 expect(()=>f.port.batch('throughput',2,'shadow|pass:0')).toThrow('Native readback failed');
 expect(f.pass.enabled).toBe(true);expect(f.renderer.shadowMap).toEqual({autoUpdate:true,needsUpdate:true});
 f.port.restore();
});

test('invalid batch sizes and compound unknown passes refuse before changing native owners',()=>{
 const f=fixture();
 for(const n of [0,-1,65,1.5,Number.NaN])expect(()=>f.port.batch('throughput',n)).toThrow('Invalid GPU census batch');
 expect(()=>f.port.batch('throughput',1,'pass:0|pass:30')).toThrow('Unknown pass');
 expect(()=>f.port.batch('throughput',1,'depthcopy|pass:30')).toThrow('Unknown pass');
 f.gl.blitFramebuffer(0,0,1,1,0,0,1,1,256,9728);
 expect(f.originalBlit).toHaveBeenCalledOnce();
 expect(f.pass.enabled).toBe(true);expect(f.draw).not.toHaveBeenCalled();f.port.restore();
});
