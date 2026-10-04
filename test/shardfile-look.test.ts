// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed look fixture and its LUT file.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { parseShardfile } from '../src/game/shardfile/schema';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { shardfileLook } from '../src/game/shardfile/look';
import { sampleLook } from '../src/engine/render/dataLook';
import type { SkyBackdropContext, SkyBackdropTargets } from '../src/engine/render/look';
import type { SkyRig } from '../src/engine/world/skyRig';
import { LUT_SIZE } from '../src/engine/render/lut';
import { declareLookLut } from '../src/sdk/author';
import { validateProject, contentHash } from '../src/sdk/project';

const dir = 'test/fixtures/shardfile/look/';
const raw: unknown = JSON.parse(readFileSync(`${dir}shard.json`, 'utf8'));
const fixture = () => parseShardfile(structuredClone(raw));
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** The parts of the sky rig and backdrop targets the data look writes, as plain three objects. */
function rig() {
  const key = { dir: new THREE.Vector3(), colour: new THREE.Color(), intensity: 0 };
  const sky = { setKeyLight: (to: THREE.Vector3, colour: THREE.Color, intensity: number) => { key.dir.copy(to); key.colour.copy(colour); key.intensity = intensity; } };
  const hemi = new THREE.HemisphereLight(), fog = new THREE.Fog(0, 1, 2);
  const fogU = { fogSunDir: { value: new THREE.Vector3() }, fogSunColor: { value: new THREE.Color() }, fogDistDensity: { value: 0 }, fogHeightDensity: { value: 1 } };
  const targets: Pick<SkyBackdropTargets, 'hemi' | 'fog' | 'fogU' | 'underwater'> = { hemi, fog, fogU, underwater: () => false };
  return { key, sky, hemi, fog, fogU, targets };
}
const isRig = (value: object): value is SkyRig => 'setKeyLight' in value;
const isTargets = (value: object): value is SkyBackdropTargets => 'fogU' in value;

it('the fixture look parses, keeps no shader source and passes the empty loader', () => {
  const look = fixture().look;
  expect(look.keys.map((k) => k.time)).toEqual([0, 0.25, 0.5, 0.75]);
  expect(JSON.stringify(look)).not.toMatch(/gl_|void main|#include|vec3\(/u);
  expect(() => emptyShardfileSource(structuredClone(raw))).not.toThrow();
  const lutBytes = readFileSync(`${dir}${look.grade.lut ?? ''}`);
  expect(lutBytes.length).toBe(LUT_SIZE ** 3 * 4);
});

it('SDK LUT declaration charges the library once and refuses orphan or understated LUT costs', () => {
  const source = fixture(), hash = source.look.grade.lut;
  if (hash === null) throw new Error('fixture LUT');
  const bytes = readFileSync(`${dir}${hash}`); source.library = []; source.budgets.library = { compressed: 0, resident: 0 };
  expect(() => validateProject(source, new Map([[hash, bytes]]))).toThrow('charged library');
  declareLookLut(source, hash); declareLookLut(source, hash);
  expect(source.library).toEqual([hash]); expect(source.budgets.library).toEqual({ compressed: bytes.length, resident: bytes.length * 2 });
  expect(contentHash(bytes)).toBe(hash); expect(validateProject(source, new Map([[hash, bytes]]))).toEqual(source);
  source.budgets.library.resident--; expect(() => validateProject(source, new Map([[hash, bytes]]))).toThrow('budget');
});

it('the format refuses a texture sky, a misdeclared LUT and content beside the look in the empty loader', () => {
  const textured = structuredClone(raw) as { look: { keys: { sky: unknown }[] } };
  const first = textured.look.keys[0]; if (first === undefined) throw new Error('fixture keys');
  first.sky = 'a'.repeat(64);
  expect(() => parseShardfile(textured)).toThrow();
  const small = fixture(); const file = small.files[0]; if (file === undefined) throw new Error('fixture file');
  file.compressed = 1000;
  expect(() => parseShardfile(small)).toThrow();
  const ui = fixture(); ui.ui.push({ kind: 'marker', id: 'marker', label: 'Marker', at: [0, 0, 0] });
  expect(() => emptyShardfileSource(ui)).toThrow('empty shardfiles only');
});

it('samples keys linearly and wraps across midnight', () => {
  const keys = fixture().look.keys;
  const noon = keys[2], dusk = keys[3], night = keys[0];
  if (noon === undefined || dusk === undefined || night === undefined) throw new Error('fixture keys');
  const at = sampleLook(keys, 0.5);
  expect(at.fogDensity).toBeCloseTo(noon.fog.density, 9); expect(at.sunIntensity).toBeCloseTo(1.5, 9);
  const mid = sampleLook(keys, 0.625);
  expect(mid.zenith.r).toBeCloseTo((noon.sky.zenith[0] + dusk.sky.zenith[0]) / 2, 6);
  const wrap = sampleLook(keys, 0.875), wrapNext = sampleLook(keys, 1.875);
  expect(wrap.horizon.g).toBeCloseTo((dusk.sky.horizon[1] + night.sky.horizon[1]) / 2, 6);
  expect(wrapNext.horizon.g).toBeCloseTo(wrap.horizon.g, 9);
});

it('renders the fixture look on the engine clock: the sun, fog, ambient and dome follow the keys, the LUT loads', async () => {
  const lutBytes = readFileSync(`${dir}${fixture().look.grade.lut ?? ''}`);
  const fetched: string[] = [];
  globalThis.fetch = vi.fn((url: string | URL | Request) => { fetched.push(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url); return Promise.resolve(new Response(lutBytes)); });
  const look = shardfileLook(fixture().look), r = rig(), backdrop = look.backdrop;
  if (backdrop === undefined) throw new Error('data look has a backdrop');
  if (!isRig(r.sky)) throw new Error('rig');
  const built = await backdrop({ sky: r.sky } satisfies Pick<SkyBackdropContext, 'sky'> as SkyBackdropContext);
  expect(fetched).toEqual([`./${fixture().look.grade.lut ?? ''}`]);
  expect(built.lut?.image.width).toBe(LUT_SIZE);
  const targets = { ...r.targets };
  if (!isTargets(targets)) throw new Error('targets');
  built.bind(targets);
  const dome = built.clouds;
  if (!(dome instanceof THREE.Mesh) || !(dome.material instanceof THREE.ShaderMaterial)) throw new Error('the dome is the engine gradient');
  const zenith: unknown = dome.material.uniforms['uZenith']?.value;
  if (!(zenith instanceof THREE.Color)) throw new Error('zenith uniform');
  // noon: the template's numbers, the sun high on the clock's arc
  expect(built.clock.hour).toBeCloseTo(12, 6);
  expect(r.key.intensity).toBeCloseTo(1.5, 6); expect(r.fogU.fogDistDensity.value).toBeCloseTo(0.0058, 9); expect(r.fogU.fogHeightDensity.value).toBe(0);
  expect(r.hemi.intensity).toBeCloseTo(0.7, 6); expect(zenith.r).toBeCloseTo(0.35, 6); expect(r.key.dir.y).toBeGreaterThan(0.8);
  // the 12-minute day: 3 minutes later it is 18:00, the dusk key exactly
  const camera = new THREE.PerspectiveCamera();
  for (let i = 0; i < 180 * 60; i++) built.update(1 / 60, camera);
  expect(built.clock.hour).toBeCloseTo(18, 3);
  expect(r.key.intensity).toBeCloseTo(0.9, 3); expect(r.fogU.fogDistDensity.value).toBeCloseTo(0.007, 6);
  expect(r.fog.color.r).toBeCloseTo(0.75, 3); expect(zenith.b).toBeCloseTo(0.3, 3); expect(Math.abs(r.key.dir.y)).toBeLessThan(0.05);
});

it('a day override pins the clock', async () => {
  const source = fixture(); source.look.dayOverride = 0.25; source.look.grade.lut = null; source.files = [];
  const look = shardfileLook(source.look), r = rig(), backdrop = look.backdrop;
  if (backdrop === undefined || !isRig(r.sky)) throw new Error('backdrop');
  const built = await backdrop({ sky: r.sky } satisfies Pick<SkyBackdropContext, 'sky'> as SkyBackdropContext);
  for (let i = 0; i < 600; i++) built.update(1 / 60, new THREE.PerspectiveCamera());
  expect(built.clock.hour).toBeCloseTo(6, 9); expect(r.key.intensity).toBeCloseTo(1, 9); expect(built.lut).toBeNull();
});
