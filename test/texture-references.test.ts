import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The audit regression reads the real Node-side generator corpus.
import { cwd } from 'node:process';
import { auditTextureReferences, textureSources, type InventoryRow } from '../scripts/audit-assets.mjs';
import { textureTierJobs } from '../scripts/texture-inputs.mjs';
import formerCandidates from './texture-reference-candidates.json';

const row: InventoryRow = { slug: 'fixture', tier: 'phone', files: [], packFiles: [], packed: [], gpu: {}, ktxFiles: [] };
const folder = '/assets/tex/fixture';
const original = `${folder}/diffuse.jpg`, small = `${folder}/diffuse_1k.jpg`, phone = `${folder}/diffuse_1k.phone.webp`;

describe('texture deletion dependency audit', () => {
  it('keeps original, phone-selected _1k input and cached WebP through the actual tier generator plan', () => {
    const result = auditTextureReferences([original, small, phone], [row], []);
    for (const reference of result) expect(reference.referencedBy.some((why) => why.startsWith('scripts/tex-tiers.mjs:'))).toBe(true);
    const jobs = textureTierJobs([original, small, phone].map((url) => `public${url}`));
    expect(jobs).toContainEqual({ kind: 'phone', source: `public${original}`, served: `public${small}`, output: `public${phone}`, max: 1024 });
  });
  it('counts GPU source keys with layer suffixes and phone/image manifests as references', () => {
    const gpuSource = `${folder}/atlas.png`, image = `${folder}/fallback.webp`;
    const references = auditTextureReferences([gpuSource, image], [{ ...row, files: [image], gpu: { [`${gpuSource}#layer`]: '/assets/gpu/atlas.ktx2' } }], []);
    expect(references[0]?.referencedBy).toContain('GPU source: fixture/phone');
    expect(references[1]?.referencedBy).toContain('inventory: fixture/phone');
  });
  it('keeps Blender directory inputs and dynamically constructed script paths', () => {
    const input = `${folder}/twig_alpha.jpg`;
    const references = auditTextureReferences([input], [], [{ path: 'scripts/blender/targets.json', text: `{"inputs":["public${folder}/"]}` }]);
    expect(references[0]?.referencedBy).toContain('source: scripts/blender/targets.json');
  });
  it('leaves an unrelated image without references eligible for review', () => {
    const unused = '/assets/tex/orphan/unused.webp';
    expect(auditTextureReferences([unused], [row], [{ path: 'src/example.ts', text: "const name = 'another-set';" }])).toEqual([{ url: unused, referencedBy: [] }]);
  });
});

describe('shared texture-tier generation plan', () => {
  it('uses originals for ARM and twig inputs and preserves phone sizes', () => {
    const paths = ['public/assets/tex/set/arm.jpg', 'public/assets/tex/set/arm_1k.jpg', 'public/assets/tex/pine_tree_01/twig_rgba.png', 'public/assets/tex/pine_tree_01/twig_alpha.jpg'];
    const jobs = textureTierJobs(paths);
    expect(jobs.filter((job) => job.kind === 'phone')).toEqual([
      { kind: 'phone', source: paths[0], served: paths[1], output: 'public/assets/tex/set/arm_1k.phone.webp', max: 512 },
      { kind: 'phone', source: paths[2], served: paths[2], output: 'public/assets/tex/pine_tree_01/twig_rgba.phone.webp', max: 1024 },
    ]);
    expect(jobs.some((job) => job.source === paths[3])).toBe(false);
  });
});

it('retains all 54 formerly misclassified textures using real authored generator references', () => {
  const files = Object.keys(import.meta.glob('../public/assets/tex/**/*')).map((path) => path.replace('../public', ''));
  const references = auditTextureReferences(files, [], textureSources(cwd()));
  expect(formerCandidates).toHaveLength(54);
  for (const url of formerCandidates) {
    expect(files, url).toContain(url);
    expect(references.find((reference) => reference.url === url)?.referencedBy.length, url).toBeGreaterThan(0);
  }
});
