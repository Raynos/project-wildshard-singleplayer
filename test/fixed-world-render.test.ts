// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the serialized browser capture with isolated native-clock fixtures.
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { Object3D, PerspectiveCamera, Vector3 } from 'three';
import { fixedWorldFrame } from '../scripts/parity/fixed-render.mjs';

function fixture(fail = false, locked = false) {
  let live = 37;
  const uniform = { get value() { return live; }, set value(_value:number) { /* Shipping accessor is deliberately read-only. */ } };
  if (locked) Object.defineProperty(uniform, 'value', {configurable:false});
  const descriptor = Object.getOwnPropertyDescriptor(uniform, 'value');
  const held = new Object3D(), target = {};
  const observed:number[] = [];
  let currentTarget:object|null = target, scissor = true, dither = true, completions = 0;
  const material = {uniforms:{wsTime:uniform}}, scene = {traverse:(visit:(object:object)=>void) => { visit({material}); }};
  const vector = new Vector3(1,2,3), camera = new PerspectiveCamera();
  camera.position.set(4,5,6); camera.add(held); camera.updateMatrixWorld(true);
  const cameraState = {position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray()};
  const gl = {drawingBufferWidth:1,drawingBufferHeight:1,RGBA:1,UNSIGNED_BYTE:2,NO_ERROR:0,DITHER:3,
    finish:()=>{completions++;},isEnabled:()=>dither,enable:()=>{dither=true;},disable:()=>{dither=false;},
    readPixels:(_x:number,_y:number,_width:number,_height:number,_format:number,_type:number,data:Uint8Array) => {data.set([1,2,3,255]);},getError:()=>0,isContextLost:()=>false};
  const renderer = {renderBufferDirect:()=>{live=37;},getContext:()=>gl,getRenderTarget:()=>currentTarget,getScissorTest:()=>scissor,
    setRenderTarget:(value:object|null) => {currentTarget=value;},setScissorTest:(value:boolean) => {scissor=value;},
    setViewport:(_x:number,_y:number,_width:number,_height:number) => { live = 37; },getPixelRatio:()=>2,
    properties:{get:(_material:object)=>({uniforms:{wsTime:uniform}})},clear:()=>{live=37;},
    render(){this.renderBufferDirect();uniform.value=912;observed.push(uniform.value);if(fail)throw new Error('native render failure');},
    info:{render:{calls:1,triangles:2},reset:()=>{live=37;}}};
  const game = {renderer,rootScene:scene,camera,clock:{elapsedTime:23},shardFrame:()=>{live=37;},frameCount:7,app:{clock:{snapshot:()=>({frames:7})}}};
  const world = {game,player:{position:vector},hud:{entered:true,paused:false}};
  return {uniform,descriptor,held,game,observed,target:()=>currentTarget,scissor:()=>scissor,dither:()=>dither,completions:()=>completions,camera,cameraState,
    run:():unknown => runInNewContext(`(${fixedWorldFrame.toString()})({yaw:0,pitch:0})`, {window:{__wildshard:{requireWorld:()=>world}},document:{querySelector:()=>null}}, {timeout:1000})};
}

test('M3 pins accessor clocks through both real draws and restores their exact descriptor', () => {
  const read = fixture();
  read.run();
  expect(read.observed).toEqual([10,10]);
  expect(read.completions()).toBe(2);
  expect(read.camera.position.toArray()).toEqual(read.cameraState.position);
  expect(read.camera.quaternion.toArray()).toEqual(read.cameraState.quaternion);
  expect(read.camera.up.toArray()).toEqual(read.cameraState.up);
  expect(read.uniform.value).toBe(37);
  expect(Object.getOwnPropertyDescriptor(read.uniform,'value')).toEqual(read.descriptor);
  expect(read.held.visible).toBe(true);
  expect(read.game.clock.elapsedTime).toBe(23);
  expect(read.target()).not.toBeNull();
  expect(read.scissor()).toBe(true);
  expect(read.dither()).toBe(true);
});

test('native render failure restores clocks, target, scissor and held visibility', () => {
  const read = fixture(true);
  expect(read.run).toThrow('native render failure');
  expect(Object.getOwnPropertyDescriptor(read.uniform,'value')).toEqual(read.descriptor);
  expect(read.held.visible).toBe(true);
  expect(read.game.clock.elapsedTime).toBe(23);
  expect(read.target()).not.toBeNull();
  expect(read.scissor()).toBe(true);
  expect(read.dither()).toBe(true);
});

test('a nonconfigurable clock refuses rather than silently capturing live time', () => {
  const read = fixture(false,true);
  expect(read.run).toThrow('Unpinnable render clock wsTime');
  expect(read.observed).toHaveLength(0);
  expect(read.held.visible).toBe(true);
});
