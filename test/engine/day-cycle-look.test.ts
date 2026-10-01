import * as THREE from 'three';
import { expect, it } from 'vitest';
import { makeLook, sampleSkyLook, type SkyKey } from '#shards/nalati-grasslands/look/skyRig';
import { steppeClock, nightKeys, blendSteppeKey } from '#shards/nalati-grasslands/look/dayKeys';
import frozen from './fixtures/elevation-keys-e357.json';

const rgb = (values: number[]): [number, number, number] => {
 const [r,g,b] = values;
 if (r === undefined || g === undefined || b === undefined) throw new Error('invalid recorded RGB');
 return [r,g,b];
};
const day: SkyKey = { ...frozen.day,
 sun: rgb(frozen.day.sun),
 zenith: rgb(frozen.day.zenith),
 horizon: rgb(frozen.day.horizon),
 ground: rgb(frozen.day.ground),
 glow: rgb(frozen.day.glow),
 hemiSky: rgb(frozen.day.hemiSky),
 hemiGround: rgb(frozen.day.hemiGround),
 fog: rgb(frozen.day.fog),
 fogSun: rgb(frozen.day.fogSun),
 shade: rgb(frozen.day.shade),
 rim: rgb(frozen.day.rim),
 cloudSun: rgb(frozen.day.cloudSun),
 cloud: rgb(frozen.day.cloud),
 planet: rgb(frozen.day.planet),
 shadowTint: rgb(frozen.day.shadowTint),
 highTint: rgb(frozen.day.highTint),
 lift: rgb(frozen.day.lift),
 gain: rgb(frozen.day.gain),
 vol: rgb(frozen.day.vol),
 };

it('all Nalati elevation-key sky channels match the original SkyRig over24hours', () => {
 const clock = steppeClock(), look = makeLook();
 clock.spec.keys = { coordinate: 'elevation', frames: [day,...nightKeys(day)].map((key) => [key.el,key]), blend: blendSteppeKey };
 const scratch: SkyKey = { ...day,
 sun: [...day.sun],
 zenith: [...day.zenith],
 horizon: [...day.horizon],
 ground: [...day.ground],
 glow: [...day.glow],
 hemiSky: [...day.hemiSky],
 hemiGround: [...day.hemiGround],
 fog: [...day.fog],
 fogSun: [...day.fogSun],
 shade: [...day.shade],
 rim: [...day.rim],
 cloudSun: [...day.cloudSun],
 cloud: [...day.cloud],
 planet: [...day.planet],
 shadowTint: [...day.shadowTint],
 highTint: [...day.highTint],
 lift: [...day.lift],
 gain: [...day.gain],
 vol: [...day.vol],
 };
 for (const row of frozen.samples) {
  const [hour, expected] = row;
  if (typeof hour !== 'number' || typeof expected !== 'object') throw new Error('invalid recorded look');
  void clock.set(hour);
  sampleSkyLook(clock,look,scratch,.0003,.0006,-.015);
  const reference: Record<string, unknown> = expected;
  for (const [key,value] of Object.entries(look)) {
   const actual: unknown = value instanceof THREE.Color ? [value.r,value.g,value.b] : value instanceof THREE.Vector3 ? value.toArray() : value;
   const old = reference[key];
   if (Array.isArray(actual) && Array.isArray(old)) {
    for (let i=0;i<actual.length;i++) {
     const a: unknown = actual[i], e: unknown = old[i];
     if (typeof a === 'number' && typeof e === 'number') expect(a).toBeCloseTo(e,9);
     else expect(a).toEqual(e);
    }
   } else if (typeof actual === 'number' && typeof old === 'number') expect(actual).toBeCloseTo(old,9);
   else expect(actual).toEqual(old);
  }
 }
});
