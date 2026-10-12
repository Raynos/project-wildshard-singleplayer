import { describe, expect, it } from 'vitest';
import { auditInventory, type InventoryRow } from '../scripts/audit-assets.mjs';
import { prepareBootAudio, bootAudioFiles, resolveBootAudio } from '../src/engine/boot/audioInventory';
import type { BootSpec } from '../src/engine/level/spec';

describe('manifest asset audit', () => {
  const row: InventoryRow = { slug: 'fixture', tier: 'phone', files: ['/a.jpg'], packFiles: ['/a.jpg'], packed: ['/a.jpg'], gpu: { '/a.jpg': '/a.ktx2' }, ktxFiles: ['/a.ktx2'] };
  it('requires declared files, mapped GPU copies and exact pack membership', () => {
    expect(auditInventory([row], () => true)).toEqual([]);
    expect(auditInventory([row], (file) => file !== '/a.ktx2').join('\n')).toContain('missing GPU stand-in');
    expect(auditInventory([{ ...row, packed: [] }], () => true).join('\n')).toContain('absent from pack');
    expect(auditInventory([{ ...row, packed: ['/a.jpg', '/orphan.jpg'] }], () => true).join('\n')).toContain('orphan pack member');
    expect(auditInventory([row], () => false).join('\n')).toContain('missing declared file');
  });
});

describe('owning audio inventory for prefetch', () => {
  it('round-trips declared URLs and keeps the legacy order, cache and await boundary', async () => {
    const urls = ['/assets/music/own/b.m4a', '/assets/sfx/own/bark.m4a', '/assets/music/own/a.m4a'];
    const declared: BootSpec = { files: () => [], audio: urls };
    const legacy: BootSpec = { files: () => [], audio: () => Promise.resolve(urls) };
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON serialization is the row contract under test.
    expect(JSON.parse(JSON.stringify(declared.audio))).toEqual(urls);
    const dataReady = prepareBootAudio(declared), legacyReady = prepareBootAudio(legacy);
    expect(bootAudioFiles(declared)).toBeUndefined();
    expect(bootAudioFiles(legacy)).toBeUndefined();
    await Promise.all([dataReady, legacyReady, prepareBootAudio(declared)]);
    expect(bootAudioFiles(declared)).toEqual(bootAudioFiles(legacy));
    expect(bootAudioFiles(declared)).toEqual({ music: [urls[0], urls[2]], sfx: [urls[1]] });
    const cached = bootAudioFiles(declared);
    await prepareBootAudio(declared);
    expect(bootAudioFiles(declared)).toBe(cached);
  });

  it('keeps data and legacy unsupported-path refusals identical', async () => {
    for (const audio of [['/assets/props/invalid.glb'], () => Promise.resolve(['/assets/props/invalid.glb'])]) {
      const boot: BootSpec = { files: () => [], audio };
      await expect(prepareBootAudio(boot)).rejects.toThrow('unsupported path');
      expect(bootAudioFiles(boot)).toBeUndefined();
    }
  });

  it('keeps the legacy callback receiver and empty inventory semantics', async () => {
    const boot: BootSpec = { files: () => [], audio(this: BootSpec) {
      expect(this).toBe(boot); return Promise.resolve([]);
    } };
    expect(await resolveBootAudio(boot)).toEqual([]);
    expect(await resolveBootAudio({ files: () => [], audio: [] })).toEqual([]);
    expect(await resolveBootAudio(undefined)).toEqual([]);
  });

  it('prepares once without changing the authored order and retries a failed preparation', async () => {
    let calls = 0;
    const boot: BootSpec = { files: () => [], audio: () => { calls++; return Promise.resolve(['/assets/music/own/b.m4a', '/assets/music/own/a.m4a', '/assets/sfx/own/bark.m4a']); } };
    await Promise.all([prepareBootAudio(boot), prepareBootAudio(boot)]);
    expect(calls).toBe(1);
    expect(bootAudioFiles(boot)).toEqual({ music: ['/assets/music/own/b.m4a', '/assets/music/own/a.m4a'], sfx: ['/assets/sfx/own/bark.m4a'] });
    let failed = true;
    const retry: BootSpec = { files: () => [], audio: () => failed ? Promise.reject(new Error('dropped connection')) : Promise.resolve(['/assets/sfx/own/bark.m4a']) };
    await expect(prepareBootAudio(retry)).rejects.toThrow('dropped connection');
    failed = false; await prepareBootAudio(retry);
    expect(bootAudioFiles(retry)?.sfx).toEqual(['/assets/sfx/own/bark.m4a']);
  });
});
