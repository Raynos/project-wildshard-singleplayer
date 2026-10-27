// oxlint-disable-next-line import/no-nodejs-modules -- Independent full predecessor files captured before writer retirement.
import { readFileSync } from 'node:fs';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { nalatiMountedFigure } from '../../src/shards/nalati-grasslands/generators/mountedFigure';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import pins from './nalati-poi-paint-files.json' with { type: 'json' };

/** Fresh original byte loans, verified against every complete independent predecessor pin. */
export function originalPoiPaintFiles(): ReadonlyMap<string, Uint8Array> {
  const document = new Uint8Array(readFileSync('test/fixtures/nalati-poi-paint-original.json'));
  const bank = new Uint8Array(readFileSync('test/fixtures/nalati-poi-shapes-original.bin'));
  const files = new Map<string, Uint8Array>([['data/poiPaint.json', document], ['boot/poiPaint.json', document.slice()]]);
  let offset = 0;
  for (let index = 0; index < 14; index++) {
    const file = `data/poi-shape-${String(index)}.bin`, pin = pins.find(row => row.path.endsWith(`/${file}`));
    if (pin === undefined) throw new Error(`Missing original POI pin ${file}`);
    files.set(file, bank.slice(offset, offset + pin.bytes)); offset += pin.bytes;
  }
  if (offset !== bank.length) throw new Error('Original POI bank extent differs');
  for (const pin of pins) {
    const file = pin.path.slice('src/shards/nalati-grasslands/'.length), bytes = files.get(file);
    if (bytes === undefined || bytes.length !== pin.bytes || hashImmutableBytes(bytes) !== pin.sha256) {
      throw new Error(`Original POI paint differs ${file}`);
    }
  }
  return files;
}

export const MOUNTED_FIGURE: ReturnType<typeof nalatiMountedFigure> = nalatiMountedFigure(paint);
