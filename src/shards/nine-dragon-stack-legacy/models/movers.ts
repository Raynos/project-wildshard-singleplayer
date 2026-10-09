/**
 * The fragment's movers (E306 / E315 M4): the monorail train over the square's north side, the Well's cable gondola
 * and the two surveillance drones circling the square — Kit geometry in its own frame, drawn by the Jiehua program,
 * one object per copy. The world moves them every frame (../world/build.ts `update`); they neither collide nor carry.
 * A drone carries its navigation lights (red, white, cyan), neon quads in the sign atlas's program.
 */
import { Mesh, Vector3 } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { droneKit, trainKit } from '../world/towers';
import { gondolaCabin as gondolaKit } from '../world/well-bridges';
import { SignBuilder } from '../look/signs';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/movers.ts';

const mat = (ctx: ModelContext): ModelPart['material'] => need(ndLook(ctx).mat, 'the Jiehua program');

export const monorailTrain = defineModel({
  id: 'nine-dragon-stack/monorail-train', name: 'Monorail train (four cars)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{ geometry: trainKit().build(), material: mat(ctx) }],
});

export const cableGondola = defineModel({
  id: 'nine-dragon-stack/cable-gondola', name: 'Cable gondola', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{ geometry: gondolaKit().build(), material: mat(ctx) }],
});

export const drone = defineModel({
  id: 'nine-dragon-stack/drone', name: 'Surveillance drone', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => {
    const neon = need(ndLook(ctx).neon, 'the neon program');
    const body = new Mesh(droneKit().build(), mat(ctx));
    const lb = new SignBuilder(neon.atlas);
    lb.light(new Vector3(1.3, 0.6, 1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xff3b30, 10, 2, 0.1);
    lb.light(new Vector3(-1.3, 0.6, -1.3), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.35, 0.35, 0xffffff, 10, 2, 0.6);
    lb.light(new Vector3(0, -0.3, 0.82), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.3, 0.2, 0x3fe6ff, 6, 1);
    body.add(new Mesh(lb.build(), neon.mat));
    return body;
  },
});
