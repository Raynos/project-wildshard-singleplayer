import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { MaterialsSchema } from '@wildshard/format/materials';
import type { GraphIr, GraphRef } from '@wildshard/format/materialGraph';
import { INK_LOOK } from '../src/shards/ink-cel-valley/data/look';
import { PASTEL_LOOK } from '../src/shards/pastel-plain/data/look';
import { inkMaterials } from '../src/shards/ink-cel-valley/generators/materials';
import { pastelMaterials } from '../src/shards/pastel-plain/generators/materials';

/**
 * DS1.4's parity gate in data: each shard's look, re-authored with `@wildshard/sdk/materials` (a `ToonMaterial` /
 * `PainterlyMaterial` ground and a TSL rock compiled by `graph()`), bakes to the shipped catalogue. Graph node ids are
 * free, so the rock is compared as a graph: every stage output's expression tree, the params and the switches.
 */
function canonical(ir: GraphIr): Record<string, unknown> {
  const key = (ref: GraphRef, depth = 0): string => {
    if (depth > 128) throw new Error('graph too deep');
    if (typeof ref !== 'string') return JSON.stringify(ref);
    const node = ir.nodes[ref];
    if (node === undefined) throw new Error(`unknown node ${ref}`);
    if (node.op === 'const') return JSON.stringify(node.value);
    if (node.op === 'param') return `param:${node.param ?? ''}=${JSON.stringify(ir.params?.[node.param ?? ''])}`;
    return `${node.op}${node.mask === undefined ? '' : `.${node.mask}`}${node.param === undefined ? '' : `@${node.param}`}(${(node.in ?? []).map((input) => key(input, depth + 1)).join(',')})`;
  };
  const asRef = (value: unknown): GraphRef => {
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (Array.isArray(value) && value.every((n) => typeof n === 'number')) return value;
    throw new Error('not a graph ref');
  };
  const stages: Record<string, Record<string, string>> = {};
  for (const stage of Object.keys(ir.stages) as (keyof GraphIr['stages'])[]) {
    const outputs: object = ir.stages[stage] ?? {}, row: Record<string, string> = {};
    for (const [slot, ref] of Object.entries(outputs) as [string, unknown][]) row[slot] = typeof ref === 'boolean' || slot === 'alphaCutoff' ? JSON.stringify(ref) : key(asRef(ref));
    stages[stage] = row;
  }
  return { version: ir.version, kind: ir.kind, model: ir.model, flatShading: ir.flatShading === true, doubleSided: ir.doubleSided === true, params: ir.params ?? {}, stages };
}
function rockGraph(entry: v.InferOutput<typeof MaterialsSchema>[string] | undefined): GraphIr {
  if (entry?.family !== 'graph' || !('graph' in entry)) throw new Error('rock is an inline graph');
  return entry.graph;
}

describe('DS1.4 look parity: SDK-authored materials bake to the shipped catalogues', () => {
  for (const [slug, shipped, authored] of [['ink-cel-valley', INK_LOOK.materials, inkMaterials()], ['pastel-plain', PASTEL_LOOK.materials, pastelMaterials()]] as const) {
    it(`${slug}: the ground family preset is identical`, () => {
      const want = v.parse(MaterialsSchema, shipped), got = v.parse(MaterialsSchema, authored);
      expect(got['ground']).toEqual(want['ground']);
    });
    it(`${slug}: the TSL rock compiles to the shipped graph`, () => {
      const want = v.parse(MaterialsSchema, shipped), got = v.parse(MaterialsSchema, authored);
      expect(canonical(rockGraph(got['rock']))).toEqual(canonical(rockGraph(want['rock'])));
    });
  }
});
