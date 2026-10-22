import * as THREE from 'three';
import { afterEach, expect, test } from 'vitest';
import * as v from 'valibot';
import { PaintedWorldSchema, paintedWorld, paintedWorldOf } from '../src/game/looks/paintedWorld';
import paintedTextures from '../src/shards/nalati-grasslands/boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../src/shards/nalati-grasslands/boot/specimens.generated.json' with { type: 'json' };
import grassRows from '../src/shards/nalati-grasslands/boot/grass.generated.json' with { type: 'json' };
import capture from '../src/shards/nalati-grasslands/data/staticCapture.json' with { type: 'json' };

// A made-up moor (the painted world's fixture level): its own fog ramp, LUT and drifting cloud shadows over painted ground
// and grass rows (the boot rows of the first level, which the moor borrows for its ground and blades).
const chunks = { ...THREE.ShaderChunk };
afterEach(() => { Object.assign(THREE.ShaderChunk, chunks); });
const moor = () => ({ fog: { start: 40, end: 900, haze: [0.3, 0.32, 0.36], aerial: [0.002, 40, -5, 0.001], edge: [0.9, 251, 270, 15], order: 280, lut: [0.5, 0.55, 0.6, 0.52, 0.56, 0.6] },
  air: { tile: 800, threshold: 0.6, strength: 0.4, softness: 0.1, drift: [1, 0.5] }, ground: 'ground' in paintedTextures ? paintedTextures.ground : null, tiles: specimenData.materials,
  capture, grass: { rows: grassRows, cards: { url: '/assets/moor/cards.webp', phoneUrl: '/assets/moor/cards.phone.webp', name: 'moor-cards' } } });

test('a painted world refuses executable or malformed rows', () => {
  expect(v.safeParse(PaintedWorldSchema, moor()).success).toBe(true);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), fog: { ...moor().fog, lut: [0.5, 0.5] } }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), fog: { ...moor().fog, start: Number.NaN } }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), build: () => undefined }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), grass: { ...moor().grass, cards: { url: 'https://example.com/a.webp', phoneUrl: '/a.webp', name: 'a' } } }).success).toBe(false);
});

test('a level builds its painted world once a page and its world wiring reads the same parts by slug', () => {
  expect(() => paintedWorldOf('moor')).toThrow('No painted world for moor');
  const parts = paintedWorld('moor', moor());
  expect(paintedWorld('moor', moor())).toBe(parts);
  expect(paintedWorldOf('moor')).toBe(parts);
  expect(parts.fogLut.image.width).toBe(2);
  expect(parts.look.fog.order).toBe(280);
  expect([parts.look.sky.clouds, parts.look.sky.planet, parts.look.sky.ownSky]).toEqual([false, false, true]);
  expect(typeof parts.look.terrainPainter.build).toBe('function');
  expect(parts.grass.input.view.trail.speedLimit).toBeGreaterThan(0);
  parts.look.fog.install();
  expect(THREE.ShaderChunk.fog_pars_fragment.split('float pCloudShadow()').length).toBe(2);
});
