// D8 exception: small source declarations only, never asset/product generation.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authoredManifestSource, productManifestPath } from './authored-manifest.mjs';
import { manifestFolders, outputManifest, shardProducts } from '../scripts/shard-outputs.mjs';
import { genStarterArmClips } from '../scripts/gen-starter-arm-clips.mjs';
import { genStarterWeapons } from '../scripts/gen-starter-weapons.mjs';
import { genStarterBag } from '../scripts/gen-starter-bag.mjs';
import { genStarterEffects } from '../scripts/gen-starter-effects.mjs';

/** @param {string} root */
export function pushTables(root) {
  genStarterArmClips(root); genStarterWeapons(root); genStarterBag(root); genStarterEffects(root);
  for (const product of shardProducts(root, manifestFolders(root))) {
    if (!existsSync(resolve(root, 'src/shards', product.folder, 'manifest.json'))) continue;
    const composed = product.output === null ? null : outputManifest(root, product.folder, product.output);
    writeFileSync(resolve(root, productManifestPath(root, product)), authoredManifestSource(root, product.slug, {
      folder: product.folder, composed, generation: true, metadataOnly: true,
    }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  pushTables(resolve(process.argv[2] ?? '.'));
}
