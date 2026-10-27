// The real room upload/GC child needs original shapes and host registries, not
// every shard's species, pickup and script compilation from test/setup.ts.
import { vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the same pinned original Places transport as the shared fixture.
import { inflateSync } from 'node:zlib';
import { ENGINE_CONTENT_STRINGS } from '../../src/game/engineStrings';
import { installEngineStrings } from '../../src/engine/strings';
import { prepareAssetDecoders } from '../../src/format/product';
import { unshuffleLanes } from '../../src/engine/core/deflate';
import { originalPlaceBinary } from './nalati-original-place-binary';

vi.stubGlobal('location', new URL('http://localhost:5173/'));
await import('../../src/identity');
installEngineStrings(ENGINE_CONTENT_STRINGS);
(await import('../../src/engine/world/registry')).installWorldRegistry();
await prepareAssetDecoders();
const { SHAPES, SHAPE_BYTES } = await import('./nalatiShapes');
if (!SHAPES.ready) await SHAPES.load(new Map([...SHAPE_BYTES,
  ['/assets/nalati/baked/places.bin', unshuffleLanes(new Uint8Array(inflateSync(await originalPlaceBinary())))]]));
