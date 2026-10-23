import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { ScalarChannelSchema,ScalarLatticeSchema,type ScalarChannelRows,type ScalarLatticeRows } from '@wildshard/format/scalarChannel';

export function readScalarChannel(input: ScalarChannelRows & { readonly type: 'f32' },blocks?:ReadonlyMap<string,Uint8Array>): Float32Array;
export function readScalarChannel(input: ScalarChannelRows & { readonly type: 'f64' },blocks?:ReadonlyMap<string,Uint8Array>): Float64Array;
export function readScalarChannel(input: unknown,blocks?:ReadonlyMap<string,Uint8Array>): Float32Array | Float64Array;
/** One bounded inflate and one typed view, with no conversion, interpolation,
 * owner/cache or second intake. Reject short, oversized and non-finite rows. */
export function readScalarChannel(input: unknown,blocks?:ReadonlyMap<string,Uint8Array>): Float32Array | Float64Array {
  const row = v.parse(ScalarChannelSchema,input), length = row.count*(row.type === 'f32' ? 4 : 8);
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw new Error('Scalar channel requires little-endian storage');
  const source=typeof row.data==='string'?Uint8Array.from(atob(row.data),value=>value.codePointAt(0)??0):blocks?.get(row.data.file);
  if(source===undefined)throw new Error('Missing scalar block');
  const bytes = unzlibSync(source,{ out: new Uint8Array(length+1) });
  if (bytes.length !== length) throw new Error('Scalar channel length mismatch');
  const values = row.type === 'f32' ? new Float32Array(bytes.buffer,bytes.byteOffset,row.count) : new Float64Array(bytes.buffer,bytes.byteOffset,row.count);
  if (!values.every(Number.isFinite)) throw new Error('Non-finite scalar channel');return values;
}

/** Decode once and borrow that same native typed storage for the defining bilinear sampler. */
export function readScalarLattice(input: unknown,blocks?:ReadonlyMap<string,Uint8Array>): (x: number,z: number) => number {
  const row = v.parse(ScalarLatticeSchema,input),values = readScalarChannel(row.values,blocks);
  if (!(values instanceof Float32Array)) throw new Error('Scalar lattice requires f32 storage');
  return bakedSamplers({ res: row.res,size: row.size,heights: values,seed: 0,landscapeHash: 0,splat: new Uint8Array(0),undergrowth: null }).heightAt;
}

type Sample = (x: number, z: number) => number;
interface LatticeBounds { readonly min: number; readonly max: number }
interface LatticeBinding {
  readonly row: ScalarLatticeRows;
  readonly bounds: LatticeBounds | undefined;
  sample: Sample | undefined;
  readonly read: Sample;
}
/** One definition's declared binary rasters. Registration performs no IO or
 * inflate; preparation validates every block before publishing any sampler. */
export class ScalarLatticeBindings {
  private readonly bindings = new Map<string, LatticeBinding>();
  private ready = false;
  private sealed = false;
  get prepared(): boolean { return this.ready || this.bindings.size === 0; }
  get files(): readonly string[] { return [...this.bindings.keys()]; }
  seal(): void { this.sealed = true; }

  lattice(input: unknown, bounds?: LatticeBounds): Sample {
    const row = v.parse(ScalarLatticeSchema, input);
    if (typeof row.values.data === 'string') return this.decode(row, undefined, bounds);
    const file = row.values.data.file, prior = this.bindings.get(file);
    if (prior !== undefined) {
      if (prior.row.res !== row.res || prior.row.size !== row.size || prior.row.values.count !== row.values.count
        || prior.row.values.type !== row.values.type || prior.bounds?.min !== bounds?.min || prior.bounds?.max !== bounds?.max) {
        throw new Error('Conflicting scalar block declaration');
      }
      return prior.read;
    }
    if (this.ready || this.sealed) throw new Error('Scalar declarations already sealed');
    if (this.bindings.size >= 64) throw new Error('Too many scalar blocks');
    const entry: LatticeBinding = {
      row, bounds: bounds === undefined ? undefined : { ...bounds }, sample: undefined,
      read: (x, z) => {
        if (entry.sample === undefined) throw new Error('Scalar blocks are not prepared');
        return entry.sample(x, z);
      },
    };
    this.bindings.set(file, entry);
    return entry.read;
  }

  prepare(blocks: ReadonlyMap<string, Uint8Array>): void {
    if (this.ready) return;
    this.seal();
    const candidates = [...this.bindings.values()].map(entry => ({
      entry, sample: this.decode(entry.row, blocks, entry.bounds),
    }));
    for (const { entry, sample } of candidates) entry.sample = sample;
    this.ready = true;
  }

  private decode(row: ScalarLatticeRows, blocks: ReadonlyMap<string, Uint8Array> | undefined, bounds: LatticeBounds | undefined): Sample {
    const values = readScalarChannel(row.values, blocks);
    if (!(values instanceof Float32Array)) throw new Error('Scalar lattice requires f32 storage');
    if (bounds !== undefined && !values.every(value => value >= bounds.min && value <= bounds.max)) {
      throw new Error('Scalar lattice outside declared bounds');
    }
    return bakedSamplers({ res: row.res, size: row.size, heights: values, seed: 0,
      landscapeHash: 0, splat: new Uint8Array(0), undergrowth: null }).heightAt;
  }
}
