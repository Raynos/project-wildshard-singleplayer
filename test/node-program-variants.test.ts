import { expect, test } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { NodeProgramVariants } from '../src/engine/render/nodes/nodeProgramVariants';

test('warm variants retain their program facts while edits and disposal invalidate them', () => {
  const variants = new NodeProgramVariants(), material = new MeshBasicMaterial(), programs = new Map<string, object>();
  const a = { id: 'mesh' }, b = { id: 'instance' }, lights = { version: 1 }, target = { id: 'target' };
  const properties = { programs, currentProgram: a, __version: material.version, uniforms: { a: 1 },
    uniformsList: ['a'], instancing: false, lightsStateVersion: lights.version, outputColorSpace: target };
  const first = properties.uniforms;
  variants.record(material, 'mesh', properties);
  Object.assign(properties, { currentProgram: b, uniforms: { b: 2 }, uniformsList: ['b'], instancing: true, lightsStateVersion: 2 });
  variants.record(material, 'instance', properties);
  expect(variants.select(material, 'mesh', properties)).toBe(true);
  expect(properties.currentProgram).toBe(a); expect(properties.uniforms).toBe(first); expect(properties.instancing).toBe(false);
  expect(properties.programs).toBe(programs); expect(properties.lightsStateVersion).toBe(1); expect(properties.outputColorSpace).toBe(target);
  expect(variants.select(material, 'instance', properties)).toBe(true); expect(properties.currentProgram).toBe(b);
  material.needsUpdate = true;
  expect(variants.select(material, 'mesh', properties)).toBe(false);
  properties.__version = material.version; variants.record(material, 'instance', properties);
  expect(variants.select(material, 'mesh', properties)).toBe(false);
  variants.forget(material); expect(variants.select(material, 'instance', properties)).toBe(false);
  material.dispose();
});

test('precompile pairing cannot publish a variant for the previous draw object', () => {
  const variants = new NodeProgramVariants(), material = new MeshBasicMaterial();
  const properties = { currentProgram: {}, __version: -1 };
  variants.record(material, 'pending', properties);
  expect(variants.select(material, 'pending', properties)).toBe(false);
  expect(properties.__version).toBe(-1); expect(material.version).toBe(0);
  material.dispose();
});

// the handler keys variants by a token per whole program key (node keys run to hundreds of KB): tokens match by identity
test('token keys select by identity, never by text', () => {
  const variants = new NodeProgramVariants(), material = new MeshBasicMaterial(), a = {}, b = {};
  const programA = { id: 'a' }, programB = { id: 'b' };
  const properties = { currentProgram: programA, __version: material.version };
  variants.record(material, a, properties);
  properties.currentProgram = programB; variants.record(material, b, properties);
  expect(variants.select(material, a, properties)).toBe(true); expect(properties.currentProgram).toBe(programA);
  expect(variants.select(material, {}, properties)).toBe(false);
  expect(variants.select(material, b, properties)).toBe(true); expect(properties.currentProgram).toBe(programB);
  material.dispose();
});
