import * as THREE from 'three';
import * as v from 'valibot';
import { TIER } from '@wildshard/engine/core/tier';
import { defineModel, announceModelReady, type ModelDef } from '@wildshard/engine/models/model';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { SpecimenModelMetadataSchema, assertSpecimenJson } from '@wildshard/format/specimenCatalogue';
import { createPageCrowds, readCrowdBody } from '../ambient/crowdPage';
import type { CrowdBody } from '../ambient/crowdDraw';
import { CloudBody, CloudBodySchema } from '../boss/encounterView';
import { productRiggedHulls } from '../looks/riggedHulls';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';

const id = v.pipe(v.string(), v.minLength(1)), number = v.pipe(v.number(), v.finite());
const height = v.strictObject({ heightAt: v.tuple([number, number]) });
const cloud = v.strictObject({ name: id, phone: CloudBodySchema, desktop: CloudBodySchema,
  pose: v.record(id, number), ports: v.record(id, v.record(id, v.union([number, height]))) });
const sources = v.variant('kind', [
  v.strictObject({ kind: v.literal('cloud'), slug: id, json: id }),
  v.strictObject({ kind: v.literal('crowd'), slug: id, json: id, binary: id, seed: number,
    options: v.strictObject({ x: number, z: number, count: v.literal(1), seed: number }), hull: v.nullable(id) }),
]);
const declarations = v.pipe(v.array(v.strictObject({ key: id, model: SpecimenModelMetadataSchema, source: sources })), v.maxLength(64));


function cloudSpecimen(rows: v.InferOutput<typeof cloud>): THREE.Group {
  const scene = new THREE.Scene(), input = TIER === 'phone' ? rows.phone : rows.desktop;
  const ports = new Map(Object.entries(rows.ports).map(([port, values]) => [port, Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, typeof value === 'number' ? value : terrainHeight(...value.heightAt)]))]));
  const body = new CloudBody(scene, input, rows.pose, ports);
  body.setVisible(true); body.update(0, new THREE.PerspectiveCamera());
  const own = new THREE.Group();
  for (const child of scene.children.slice()) own.add(child);
  body.puffs.computeBoundingBox();
  const root = body.part(input.root), low = body.puffs.boundingBox?.min.y ?? root.position.y;
  own.position.set(-root.position.x, -low, -root.position.z);
  body.puffs.onBeforeRender = (): void => { body.focusWorld(body.focusPoint); body.syncLook(); };
  const group = new THREE.Group(); group.name = rows.name; group.add(own); return group;
}

/** Client-only catalogue projections of the same cloud bodies and native crowds
 * the world uses. Product files and preview policy are inert author rows. */
export function defineRuntimeSpecimens(input: unknown): { readonly model: (key: string) => ModelDef<object> } {
  assertSpecimenJson(input);
  const rows = v.parse(declarations, input), models = new Map<string, ModelDef<object>>();
  if (new Set(rows.map(row => row.key)).size !== rows.length) throw new Error('Duplicate runtime specimen');
  for (const row of rows) {
    let body: CrowdBody | null = null, crowdRows: unknown;
    let cloudRows: v.InferOutput<typeof cloud> | null = null, ready: Promise<void> | undefined;
    const prepare = (): Promise<void> => {
      ready ??= (async (): Promise<void> => {
        const product = await loadFirstPartyProduct(row.source.slug);
        const content: unknown = JSON.parse(new TextDecoder().decode(await product.file(row.source.json)));
        if (row.source.kind === 'cloud') cloudRows = v.parse(cloud, content);
        else {
          body = await readCrowdBody(product, row.source);
          crowdRows = v.parse(v.object({ page: v.object({ specimen: v.unknown() }) }), content).page.specimen;
        }
      })();
      return ready;
    };
    const { surface, variants, seed, specimenYaw, ...metadata } = row.model;
    models.set(row.key, defineModel<object>({ ...metadata, prepare,
      ...(surface === undefined ? {} : { surface }), ...(variants === undefined ? {} : { variants }),
      ...(seed === undefined ? {} : { seed }), ...(specimenYaw === undefined ? {} : { specimenYaw }),
      build: ctx => {
        if (row.source.kind === 'cloud') {
          if (cloudRows === null) throw new Error('Cloud specimen is not prepared');
          return cloudSpecimen(cloudRows);
        }
        if (body === null) throw new Error('Crowd specimen is not prepared');
        const crowd = createPageCrowds(ctx.sky, row.source.seed, body, crowdRows);
        const mesh = crowd.factory(row.source.options, 0).mesh;
        mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.instanceMatrix.needsUpdate = true;
        const fit = (): void => { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); };
        fit();
        if (row.source.hull !== null) void productRiggedHulls(row.source.slug).load(row.source.hull).then(() => {
          fit(); announceModelReady(row.model.id); return undefined;
        }).catch((cause: unknown) => { throw new Error('Crowd specimen rig failed', { cause }); });
        return mesh;
      },
    }));
  }
  return { model: key => { const model = models.get(key); if (model === undefined) throw new Error('Missing runtime specimen'); return model; } };
}
