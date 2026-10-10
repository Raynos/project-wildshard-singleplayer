import { describe, expect, it } from 'vitest';
import { generatedContent, inventoryMarkdown, outputPolicy } from '../scripts/generation-inventory.mjs';

describe('G292 output inventory', () => {
  it('requires both measured expense and small size, preserving normative and Blender inputs', () => {
    const row = {bytes:199_999,seconds:null,darwinOnly:null,blender:false,frozen:false};
    expect(outputPolicy(row)).toContain('candidate');
    expect(outputPolicy({...row,seconds:61})).toBe('retain small + expensive');
    expect(outputPolicy({...row,seconds:61,bytes:200_000})).toContain('candidate');
    expect(outputPolicy({...row,seconds:60})).toContain('candidate');
    expect(outputPolicy({...row,blender:true})).toBe('retain Blender (G293)');
    expect(outputPolicy({...row,darwinOnly:true})).toBe('retain Darwin normative');
    expect(outputPolicy({...row,frozen:true})).toBe('retain frozen baseline');
  });
  it('recognizes content outputs without classifying authored rows as generated', () => {
    for (const path of ['public/assets/x/baked/world.glb','public/assets/gpu/x.ktx2',`src/shards/x/assets/${'a'.repeat(64)}`,'test/proof/x/checkpoints/basis.snap.gz','src/shards/x/look/map.baked.json','public/assets/x/map/top.webp','src/shards/x/ktx2.generated.ts','public/assets/packs/a.ws-pack']) expect(generatedContent(path),path).toBe(true);
    expect(generatedContent('src/shards/x/data/creatures.ts')).toBe(false);
    expect(generatedContent('src/shards/x/data/creatures.ts','// DO NOT EDIT: generator')).toBe(true);
    expect(generatedContent('src/shards/x/generators/creatures.ts')).toBe(false);
  });
  it('renders missing evidence as unavailable rather than zero or a portability claim', () => {
    const row={path:'public/assets/x/baked/world.bin',bytes:22,generator:null,seconds:null,darwinOnly:null,blender:false,frozen:false,policy:'pending'};
    const report=inventoryMarkdown({pin:'abc',rows:[row]});
    expect(report).toContain('1 files, 22 bytes');
    expect(report).toContain('UNRESOLVED | unavailable | unproven');
  });
});
