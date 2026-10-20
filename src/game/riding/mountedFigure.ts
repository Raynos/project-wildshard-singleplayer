import { creatureFactory } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { SpecimenModelMetadataSchema } from '@wildshard/format/specimenCatalogue';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';
import { shapeBook } from '../models/shapeBook';
import * as v from 'valibot';
import type { Object3D, BufferGeometry } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';
import { ClipRowsSchema } from '@wildshard/format/kitFigure';
import { isJsonData } from '@wildshard/format/json';
import { createClientScene } from '../plugin/ui';
import { playClips, type ClipCtx } from '../plugin/animation';

const number = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1));
const profile = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  mount: id, scene: PrivateSceneSchema, material: v.strictObject({ id, rim: number, bands: number }),
  shadows: v.strictObject({ phone: v.boolean(), other: v.boolean(), receive: v.boolean() }),
  clips: ClipRowsSchema, speed: id,
  gestures: v.pipe(v.array(v.strictObject({ cue: id, clock: id, duration: v.pipe(number, v.minValue(.01)) })), v.maxLength(16)),
}));

/** Client-only mounted figure projection. The scene, mount joint, eased clips
 * and cue clocks are rows; this owner has no decisions or author callbacks. */
export class MountedFigure {
  readonly root: Object3D;
  private readonly row: v.InferOutput<typeof profile>;
  private readonly frame: ClipCtx;
  constructor(input: unknown, geometry: ReadonlyMap<string, BufferGeometry>) {
    const row = this.row = v.parse(profile, input);
    const material = painterlyMaterial(null, { rim: row.material.rim, bands: row.material.bands });
    const view = createClientScene(row.scene, { geometry, materials: new Map([[row.material.id, material]]) });
    this.root = view.root;
    this.root.traverse(object => { if ('isMesh' in object) { object.castShadow = TIER === 'phone' ? row.shadows.phone : row.shadows.other; object.receiveShadow = row.shadows.receive; } });
    const mem: Record<string, number> = {};
    for (const gesture of row.gestures) mem[gesture.clock] = -1;
    this.frame = { t: 0, phase: 0, dt: 0, speed: 0, alive: true, deathT: 0, attack: -1, mem, bones: Object.fromEntries(view.parts) };
  }
  /** Attach to an actual roster rig; a missing declared mount joint refuses. */
  attach(actor: Animal): void {
    const bone = actor.mesh.skeleton.getBoneByName(this.row.mount);
    if (bone === undefined) throw new Error('Missing mounted figure joint');
    bone.add(this.root);
  }
  cue(kind: string): void { for (const row of this.row.gestures) if (row.cue === kind) this.frame.mem[row.clock] = 0; }
  update(dt: number, speed: number): void {
    const frame = this.frame; frame.dt = dt; frame.t += dt; frame.speed = speed; frame.mem[this.row.speed] = speed;
    for (const row of this.row.gestures) if ((frame.mem[row.clock] ?? -1) >= 0) frame.mem[row.clock] = (frame.mem[row.clock] ?? 0) + dt;
    playClips(this.row.clips, frame);
    for (const row of this.row.gestures) if ((frame.mem[row.clock] ?? -1) >= row.duration) frame.mem[row.clock] = -1;
  }
}

/** The same admitted mounted figure, seated on its species rig for the catalogue. */
export function defineMountedSpecimen(input: unknown, shapes: object): ModelDef<object> {
  const row = v.parse(v.strictObject({ model: SpecimenModelMetadataSchema, slug: id, json: id,
    species: id, variant: id, scale: number, geometry: v.array(id) }), input);
  let prepared: v.InferOutput<typeof profile> | null = null;
  const { surface, variants, seed, specimenYaw, ...metadata } = row.model;
  return defineModel<object>({ ...metadata,
    ...(surface === undefined ? {} : { surface }), ...(variants === undefined ? {} : { variants }),
    ...(seed === undefined ? {} : { seed }), ...(specimenYaw === undefined ? {} : { specimenYaw }),
    prepare: async () => { prepared = v.parse(profile, await (await loadFirstPartyProduct(row.slug)).json(row.json)); },
    build: ctx => {
      if (prepared === null) throw new Error('Mounted specimen is not prepared');
      const factory = creatureFactory(ctx), rig = factory.instantiate(factory.model(row.species, row.variant), row.scale);
      const figure = new MountedFigure(prepared, new Map(shapeBook(shapes).geometries(row.geometry)));
      rig.bones[prepared.mount]?.add(figure.root); return rig.mesh;
    },
  });
}
