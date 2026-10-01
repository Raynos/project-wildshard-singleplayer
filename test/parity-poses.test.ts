import { describe, expect, it } from 'vitest';
import { declaredProbePoses } from '../scripts/parity/poses.mjs';
import { toLevelSpec } from '#game/shard/spec';
import driftwood from '#shards/driftwood-isle/manifest';
import pine from '#shards/pine-hollow/manifest';
import nalati from '#shards/nalati-grasslands/manifest';
import nine from '#shards/nine-dragon-stack/manifest';

// Exact pre-G16 parity rows: no degree round-trip and no newly authored Y coordinates.
const previous = [
  [driftwood, [{name:'pier',x:0,z:-194,yaw:Math.PI,pitch:0},{name:'beach',x:-10,z:-150,yaw:4.3,pitch:0},{name:'wreck',x:105,z:0,yaw:-Math.PI/2,pitch:0}]],
  [pine, [{name:'gate',x:0,z:-200,yaw:Math.PI,pitch:0},{name:'cabin',x:-14,z:-62,yaw:Math.PI,pitch:0},{name:'pond',x:-56,z:95,yaw:Math.PI,pitch:0}]],
  [nalati, [{name:'camp',x:60,z:214,yaw:-Math.PI/2,pitch:0},{name:'bridge',x:0,z:200,yaw:0,pitch:0},{name:'plains',x:65,z:0,yaw:Math.PI,pitch:0}]],
  [nine, [{name:'spawn-rail',x:0.95,z:7.5,y:125,yaw:-12*Math.PI/180,pitch:-4*Math.PI/180},{name:'well-edge',x:-19.5,z:13.3,y:125,yaw:0,pitch:-10*Math.PI/180},{name:'stair-street',x:18,z:6,y:125,yaw:-Math.PI/2,pitch:10*Math.PI/180}]],
] as const;

describe('manifest parity cameras', () => {
  it.each(previous)('keeps $slug standing poses byte-identical across the manifest adapter', async (manifest, old) => {
    const spec = toLevelSpec(manifest);
    const cameras = await spec.capturePoses?.();
    expect(cameras).toBeDefined();
    expect(JSON.stringify(declaredProbePoses(cameras ?? {}))).toBe(JSON.stringify(old));
  });
  it('converts a newly authored standing camera and omits free camera views', () => {
    expect(declaredProbePoses({ spawn: { eye: [1, 4, 3], feet: [1, 2.32, 3], yaw: 90, pitch: 10 }, aerial: { eye: [2, 8, 4], yaw: 180, pitch: -10 } })).toEqual([{ name: 'spawn', x: 1, y: 2.32, z: 3, yaw: -Math.PI / 2, pitch: 10 * Math.PI / 180 }]);
    expect(declaredProbePoses({})).toEqual([]);
  });
});
