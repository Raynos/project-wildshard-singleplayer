import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emitNamedBlobs, nameBlob, nameMeshoptBlob, type EmittedBlobs, type NamedBlob } from '@wildshard/sdk/blobs';
import painted from '../data/paintedTextures.json' with { type: 'json' };
import trophies from '../data/trophyMounts.json' with { type: 'json' };
import details from '../data/leverDetails.json' with { type: 'json' };
import { leverDetailPool } from './crossbowPool';
import { HANDS_POOL, HANDS_POOL_NAME } from './handsPoolProduct';

/** The rifle's detail pool's product name. */
const LEVER_DETAILS_NAME = 'models/held/lever-details.glb';
/** The trophy mounts' product name. */
const TROPHIES_NAME = 'models/trophies/mounts.bin';
/** The client's committed immutable inputs, each by its declared public URL (the painted textures and the trophy
 *  mounts). GR8: the product reads them through `ctx.cached` (no scheduler job copying them into `assets/`). */
const CLIENT_FILES: readonly { name: string; kind: 'image' | 'bin'; url: string }[] = [
  ...Object.entries(painted.textures).map(([key, row]) => ({ name: `textures/painted/${key}.${row.url.split('.').at(-1) ?? ''}`, kind: 'image' as const, url: row.url })),
  { name: TROPHIES_NAME, kind: 'bin', url: trophies.url },
];
/** Each client input's declared URL and its product name, for the sections that name them. */
const byUrl: [string, string][] = [...CLIENT_FILES.map((file): [string, string] => [file.url, file.name]), [details.pool.url, LEVER_DETAILS_NAME]];
export const CLIENT_BY_URL: Readonly<Record<string, string>> = Object.fromEntries(byUrl);

/** The trophy mounts' measured geometry costs, as the retired source declaration carried them. */
const trophyCosts = {
  decoded: trophies.rows.bytes, gpu: trophies.rows.bytes,
  triangles: trophies.rows.geometries.reduce((sum, geometry) => sum + geometry.count / 3, 0), draws: trophies.rows.geometries.length,
};

/** The client blobs: the committed inputs as read, and the rifle detail and hands pools built in memory and packed as
 *  `meshopt: true` sources are. */
export async function pineClientBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const files = await ctx.cached({ id: 'client-inputs', inputs: CLIENT_FILES.map(file => file.url) }, inputs =>
    new Map(CLIENT_FILES.map(file => {
      const bytes = inputs.get(file.url);
      if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine client input ${file.url}`);
      return [file.name, bytes];
    })));
  if (files.size !== CLIENT_FILES.length) throw new Error('Pine client input inventory differs');
  const blobs: NamedBlob[] = CLIENT_FILES.map(file => {
    const bytes = files.get(file.name);
    if (bytes === undefined) throw new Error(`Missing cached Pine client input ${file.name}`);
    return nameBlob(file.name, file.kind, bytes, file.name === TROPHIES_NAME ? trophyCosts : {});
  });
  blobs.push(await nameMeshoptBlob(LEVER_DETAILS_NAME, leverDetailPool()), await nameMeshoptBlob(HANDS_POOL_NAME, HANDS_POOL.glb));
  return emitNamedBlobs(blobs);
}
