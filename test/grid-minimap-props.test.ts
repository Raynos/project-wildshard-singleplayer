// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the real committed content-addressed prop GLB for the raster proof.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { admittedMapImage, farMapObjects, ProductMinimaps } from '../src/game/grid/minimapBlend';
import props from '../src/shards/_template/data/props.json';

const colours: string[] = [], points: number[][] = [], copied: unknown[] = [];
const context = new Proxy({} as CanvasRenderingContext2D, {
  get: (_target, key) => key === 'moveTo' ? (x: number, y: number) => points.push([x, y]) : key === 'drawImage' ? (image: unknown) => copied.push(image) : () => undefined,
  set: (_target, key, value: unknown) => { if (key === 'fillStyle' && typeof value === 'string') colours.push(value); return true; },
});
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context); });
afterEach(() => { colours.length = points.length = copied.length = 0; });
const triangle = (): BufferGeometry => new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 0, 10], 3));

it('paints the actual admitted template landmarks from bytes without fetching another asset', async () => {
  const hash = props.props.far;
  const bytes = readFileSync(`public/assets/baked/template-props/${hash}`);
  const fetchCalls = vi.spyOn(globalThis, 'fetch');
  const image = await admittedMapImage({ far: props.far, files: props.files, props: props.props }, new Map([[hash, bytes]]));
  expect(image?.width).toBe(400); expect(points).toHaveLength(props.far.triangles);
  expect(new Set(colours).size).toBeGreaterThan(8); // authored paths, huts, practice pad and scattering palette
  expect(fetchCalls).not.toHaveBeenCalled(); fetchCalls.mockRestore();
});

it('honours group and instance transforms, material colours and painter order without changing source geometry', () => {
  const root = new Group(), shape = triangle(), material = new MeshBasicMaterial({ color: '#ff0000' });
  const instances = new InstancedMesh(shape, material, 2); root.position.x = 50;
  instances.setMatrixAt(0, new Matrix4().makeTranslation(20, 2, 0)); instances.setMatrixAt(1, new Matrix4().makeTranslation(-20, 1, 0));
  const ground = new Mesh(shape, new MeshBasicMaterial({ color: '#808080' })); root.add(instances, ground);
  try {
    expect(farMapObjects([root])?.width).toBe(400);
    expect(points).toEqual([[160, 200], [176, 200], [144, 200]]); // ground, lower instance, higher instance
    expect(new Set(colours).size).toBe(2); expect(shape.getAttribute('position').getX(0)).toBe(0);
  } finally { shape.dispose(); material.dispose(); ground.material.dispose(); }
});

it.each(['terrain-first', 'props-first'])('shares one composited canvas per product and releases it (%s)', (order) => {
  const scope = new Scope('map'), maps = new ProductMinimaps(scope), shape = triangle();
  shape.setAttribute('color', new Float32BufferAttribute([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 3));
  const overlay = document.createElement('canvas'); overlay.width = overlay.height = 400;
  if (order === 'terrain-first') { maps.terrain('template-product', shape); maps.props('template-product', overlay); }
  else { maps.props('template-product', overlay); maps.terrain('template-product', shape); }
  const image = maps.image('template-product');
  expect(image?.width).toBe(400); expect(copied).toEqual([overlay]); expect(overlay.width).toBe(0);
  maps.terrain('template-product', shape); expect(maps.image('template-product')).toBe(image);
  scope.dispose(); expect(image?.width).toBe(0); expect(maps.image('template-product')).toBeNull(); shape.dispose();
});
