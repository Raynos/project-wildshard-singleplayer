import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import * as v from 'valibot';
import { parseDomeCameras } from '../dome-cameras.mjs';

const name = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const plotsSchema = v.pipe(v.array(v.strictObject({
  slug: name, instance: name,
  cameras: v.pipe(v.string(), v.regex(/^art\/open-plots\/[a-z0-9-]+\/domes$/u)),
})), v.minLength(1));
const registrySchema = v.strictObject({schema:v.literal('open-plot-captures/1'),plots:plotsSchema});
export const ALL_DOMES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

/** Select an explicit ordered subset without changing any camera or renumbering views.
 * Partial captures remain partial inputs to the strict nine-view board maker.
 * @param {import('../dome-cameras.mjs').DomeCameras} cameras
 * @param {readonly number[] | undefined} selected */
export function selectDomeViews(cameras, selected) {
  if (selected === undefined) return cameras.views;
  if (!Array.isArray(selected) || selected.length === 0
    || selected.some((n, i) => !Number.isInteger(n) || n < 1 || n > 9 || (i > 0 && n <= selected[i - 1])))
    throw new Error('Capture views must be a nonempty increasing subset of 1..9');
  return cameras.views.filter(view => selected.includes(view.n));
}

/** Resolve a requested ordered subset; never silently skip an unknown or duplicate plot.
 * @param {unknown} value @param {readonly string[]} slugs */
export function selectCapturePlots(value, slugs) {
  const {plots:rows} = v.parse(registrySchema, value);
  if (new Set(rows.map(row => row.slug)).size !== rows.length
    || new Set(rows.map(row => row.instance)).size !== rows.length) throw new Error('Duplicate capture registry identity');
  if (slugs.length === 0 || new Set(slugs).size !== slugs.length) throw new Error('Name unique capture plots');
  return slugs.map(slug => {
    const row = rows.find(candidate => candidate.slug === slug);
    if (row === undefined) throw new Error(`Unknown capture plot: ${slug}`);
    return row;
  });
}

/** Admit all manifests before opening Chromium. Keep their exact bytes bound to the report.
 * @param {{slug:string,instance:string,cameras:string}} target
 * @param {readonly string[]} selected @param {string} [root] @param {string} [pin] */
export function readCapturePlans(target, selected = ALL_DOMES, root = process.cwd(), pin = '') {
  if (selected.length === 0 || new Set(selected).size !== selected.length || selected.some(id => !ALL_DOMES.includes(id))) {
    throw new Error('Invalid dome selection');
  }
  const source = resolve(root, target.cameras);
  if (pin !== '' && !/^[a-f0-9]{40}$/u.test(pin)) throw new Error('Camera source requires a full pin');
  const files = pin === '' ? readdirSync(source, {withFileTypes:true}).filter(row => row.isDirectory()).map(row => join(target.cameras, row.name, 'cameras.json'))
    : execFileSync('git', ['ls-tree','-r','--name-only',pin,'--',target.cameras], {cwd:root,encoding:'utf8'}).trim().split('\n').filter(file => file.endsWith('/cameras.json'));
  const rows = files.map(file => {
    const bytes = pin === '' ? readFileSync(resolve(root,file)) : execFileSync('git',['show',`${pin}:${file}`],{cwd:root});
    const cameras = parseDomeCameras(JSON.parse(bytes.toString('utf8')));
    if (cameras.dome !== basename(dirname(file)) || !/^[A-D][12]-[a-z0-9-]+$/u.test(cameras.dome)) throw new Error('Dome directory differs from manifest');
    return { cameras, file, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  if (new Set(rows.map(row => row.cameras.dome.slice(0, 2))).size !== rows.length) throw new Error('Duplicate dome manifest');
  return selected.map(id => {
    const row = rows.find(candidate => candidate.cameras.dome.slice(0, 2) === id);
    if (row === undefined) throw new Error(`Missing committed dome manifest: ${target.slug}/${id}`);
    return row;
  });
}

/** A junction is the actual road between four assembled cells, not a plot-local photo pose.
 * @param {{pitch?:number,cells:readonly {instance:string,slug:string,cell:readonly [number,number]}[]}} grid
 * @param {{x:number,z:number}} lattice */
export function ringJunctionPlan(grid, lattice) {
  const pitch = grid.pitch ?? 555;
  if (!Number.isFinite(pitch) || pitch <= 500 || !Number.isInteger(lattice.x - 0.5) || !Number.isInteger(lattice.z - 0.5)) throw new Error('Invalid road junction lattice');
  const neighbours = grid.cells.filter(cell => Math.abs(cell.cell[0] - lattice.x) === 0.5 && Math.abs(cell.cell[1] - lattice.z) === 0.5);
  if (neighbours.length !== 4 || new Set(neighbours.map(cell => cell.instance)).size !== 4
    || new Set(neighbours.map(cell => cell.cell.join(','))).size !== 4
    || !neighbours.some(cell => cell.slug.startsWith('open-plot-'))) throw new Error('Ring junction needs four distinct assembled neighbours including an open plot');
  return { anchor: {x: lattice.x * pitch, z: lattice.z * pitch, instance: null}, neighbours };
}

/** Registry and camera inputs come from the same immutable source as the served preview.
 * @param {string} pin @param {readonly string[]} slugs */
export function readCaptureRegistry(pin, slugs) {
  if (!/^[a-f0-9]{40}$/u.test(pin)) throw new Error('Registry source requires a full pin');
  return selectCapturePlots(JSON.parse(execFileSync('git',['show',`${pin}:scripts/open-plots/plots.json`],{encoding:'utf8'})), slugs);
}
