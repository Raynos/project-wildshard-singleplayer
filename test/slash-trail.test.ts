import { expect, it } from 'vitest';
import { Vector3, type BufferGeometry } from 'three';
import { SlashTrail } from '../src/engine/combat/view/slashTrail';
import expected from './fixtures/slash-trail-bytes.json';

it('keeps pre-refactor ribbon bytes through wrapping, duplicate samples, expiry and stroke reset',async()=>{
 const out:Record<string, { count: number; hash: string }[]>={};
 for (const name of ['age', 'alpha'] as const) {
  const ribbon = new SlashTrail({ samples: 28, subdivisions: 4, movementSq: name === 'age' ? 1e-6 : 1e-4, channel: name });
  let time = 0;
  const t = { mesh: { geometry: ribbon.geometry }, begin: (_life: number, _seed: number) => { ribbon.reset(); }, sample: (a: Vector3, b: Vector3) => { ribbon.sample(a, b, time); }, update: (dt: number) => { time += dt; ribbon.rebuild(time, .32, name === 'alpha' ? .7 : 1); } }; 
  t.begin(0.32,3);const frames=[];
  for(let i=0;i<40;i++){const a=new Vector3(Math.sin(i*.22)*.4,i*.005,.1),b=new Vector3(Math.sin(i*.22),Math.cos(i*.22)*.7,i*.01);t.sample(a,b);t.sample(a,b);t.update(1/60);if([1,15,27,39].includes(i))frames.push(await hash(t.mesh));}
  t.update(.5);frames.push(await hash(t.mesh));t.begin(.32,9);t.sample(new Vector3(),new Vector3(1,0,0));t.update(1/60);t.sample(new Vector3(.1,0,0),new Vector3(1,.1,0));t.update(1/60);frames.push(await hash(t.mesh));out[name]=frames;
 }
 expect(out).toEqual(expected);
});
async function hash(mesh: { geometry: BufferGeometry }): Promise<{ count: number; hash: string }> {
  const bytes: number[] = [];
  for (const name of Object.keys(mesh.geometry.attributes).sort()) {
    const attr = mesh.geometry.getAttribute(name).array;
    bytes.push(...new Uint8Array(attr.buffer, attr.byteOffset, attr.byteLength));
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
  return { count: mesh.geometry.drawRange.count, hash: [...digest].map((b) => b.toString(16).padStart(2, '0')).join('') };
}
