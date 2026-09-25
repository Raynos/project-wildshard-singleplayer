/** The shard's baked navmesh (scripts/bake-navmesh.mjs), when the build has one — its own module so src/boot/manifest.ts
 *  (which also runs under Node's type stripping in scripts/bake-packs.mjs) can declare it without pulling in navcat. */
import { PUBLIC_BYTES } from '../boot/bytes.generated';

export const navmeshUrl = (slug: string, variant = ''): string | null => {
  const url = `/assets/baked/${slug}/navmesh${variant}.bin`;
  return url in PUBLIC_BYTES ? url : null;
};
