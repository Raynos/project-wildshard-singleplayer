// Every shard the Developer grid places shows a far proxy from the road (SHARD-PLATFORM SF23 / SF55). The grid session
// (src/game/grid/session.ts loadFar) reads an authored mesh-world project's proxy from its admitted product and every
// other shard's from its repo bake, public/assets/baked/<slug>/far.{json,glb} (scripts/bake/far-proxies.mjs). A placed
// shard with neither stays "loading" forever: its ring never reports ready, and boot-smoke's grid gameplay deadline
// refused every main commit after SF59's two fixture shards were placed without a bake (2026-10-10).
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the committed grid layout and far bakes.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test resolves repo paths.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { contentHash } from '../src/sdk/project';

const repo = join(import.meta.dirname, '..');
const Layout = v.object({ placements: v.array(v.object({ slug: v.string() })) });
const FarManifest = v.object({ far: v.object({ files: v.tuple([v.string()]) }), file: v.object({ hash: v.string(), compressed: v.number() }),
  look: v.object({ family: v.picklist(['toon', 'painterly', 'pbr']) }) });
const AuthoredWorld = v.object({ default: v.object({ world: v.object({ colliders: v.literal('mesh') }) }) });

const slugs = [...new Set(v.parse(Layout, JSON.parse(readFileSync(join(repo, 'src/game/grid/singleplayer.json'), 'utf8'))).placements.map((row) => row.slug))].sort();

describe('grid far sources', () => {
  it.each(slugs)('%s has a far proxy the grid can load', async (slug) => {
    const dir = join(repo, 'public/assets/baked', slug);
    if (!existsSync(join(dir, 'far.json'))) {
      // an authored mesh-world project (blender-template) carries its proxy in the admitted product instead
      const config: unknown = await import(`../src/shards/${slug}/shard.config.ts`);
      expect(v.is(AuthoredWorld, config), `${slug}: no public/assets/baked/${slug}/far.json and no authored mesh world`).toBe(true);
      return;
    }
    const manifest = v.parse(FarManifest, JSON.parse(readFileSync(join(dir, 'far.json'), 'utf8')));
    const glb = new Uint8Array(readFileSync(join(dir, 'far.glb')));
    expect(manifest.far.files[0]).toBe(manifest.file.hash);
    expect(glb.length).toBe(manifest.file.compressed);
    expect(contentHash(glb)).toBe(manifest.file.hash);
  });
});
