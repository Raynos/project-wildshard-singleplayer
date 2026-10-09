/**
 * E435 ktx2-probe: the KTX2 capability probe's verdict (src/engine/render/ktx2Probe.ts). A family that samples mipmapped
 * uploads wrong is never transcoded to; when that leaves a Basis format only the uncompressed RGBA32 target, the page
 * loads images (src/engine/boot/gpuFiles.ts texModeWhy).
 */
import { describe, expect, it } from 'vitest';
import { probeVeto, withoutFailing, ktx2ProbeLine, ktx2Probe, linearAstcSurvives, type TranscoderFlags, type Ktx2FormatResult } from '../../src/engine/render/ktx2Probe';

const IOS: TranscoderFlags = { astcSupported: true, etc2Supported: true, etc1Supported: true, bptcSupported: false, dxtSupported: false, pvrtcSupported: false };
const WINDOWS: TranscoderFlags = { astcSupported: false, etc2Supported: false, etc1Supported: false, bptcSupported: true, dxtSupported: true, pvrtcSupported: false };
const zero = (format: string, family: Ktx2FormatResult['family']): Ktx2FormatResult => ({ family, format, ok: false, level: 1, read: [0, 0, 0, 0], expected: [154, 34, 8, 153] });

describe('KTX2 capability probe verdict', () => {
  it('the iOS Simulator (sRGB ASTC and ETC2 mips read 0) loads images, with the failures in the reason', () => {
    const formats = [zero('SRGB8_ALPHA8_ASTC_4x4', 'astc'), zero('RGB8_ETC2', 'etc2')];
    const veto = probeVeto(IOS, { astc: false, etc2: false }, formats);
    expect(veto).toContain('SRGB8_ALPHA8_ASTC_4x4 L1 0,0,0,0');
    expect(veto).toContain('left for UASTC, ETC1S');
  });

  it('a GPU where every family works keeps KTX2 and every flag', () => {
    expect(probeVeto(IOS, { astc: true, etc2: true }, [])).toBeNull();
    expect(withoutFailing(IOS, { astc: true, etc2: true })).toEqual(IOS);
  });

  it('one broken family with a compressed fallback keeps KTX2 and transcodes past it', () => {
    expect(probeVeto(WINDOWS, { bptc: false, s3tc: true }, [zero('RGBA_BPTC_UNORM', 'bptc')])).toBeNull();
    expect(withoutFailing(WINDOWS, { bptc: false, s3tc: true })).toMatchObject({ bptcSupported: false, dxtSupported: true });
  });

  it('ETC2 alone broken on an ASTC phone: UASTC keeps ASTC, but ETC1S would go uncompressed (three ranks ASTC after RGBA32), so images', () => {
    const veto = probeVeto(IOS, { astc: true, etc2: false }, [zero('RGB8_ETC2', 'etc2')]);
    expect(veto).toContain('left for ETC1S');
    expect(veto).not.toContain('UASTC');
  });

  it('without a page there is no verdict and nothing is vetoed', () => {
    const probe = ktx2Probe();
    expect(probe).toMatchObject({ ran: false, veto: null });
    expect(ktx2ProbeLine(probe)).toContain('no verdict');
    expect(ktx2ProbeLine(null)).toContain('not run');
  });
  it('img-fallback: a vetoed page keeps linear ASTC only when the linear format read right (the iOS Simulator), never on a KTX2 page', () => {
    const ok = (format: string, family: Ktx2FormatResult['family']): Ktx2FormatResult => ({ family, format, ok: true });
    const sim = [ok('RGBA_ASTC_4x4', 'astc'), zero('SRGB8_ALPHA8_ASTC_4x4', 'astc'), zero('RGB8_ETC2', 'etc2')];
    const veto = probeVeto(IOS, { astc: false, etc2: false }, sim);
    expect(linearAstcSurvives({ ran: true, note: '', families: { astc: false, etc2: false }, formats: sim, veto })).toBe(true);
    const bothBroken = [zero('RGBA_ASTC_4x4', 'astc'), zero('SRGB8_ALPHA8_ASTC_4x4', 'astc'), zero('RGB8_ETC2', 'etc2')];
    expect(linearAstcSurvives({ ran: true, note: '', families: { astc: false, etc2: false }, formats: bothBroken, veto })).toBe(false);
    expect(linearAstcSurvives({ ran: true, note: '', families: { astc: true }, formats: [ok('RGBA_ASTC_4x4', 'astc')], veto: null })).toBe(false);
    expect(linearAstcSurvives(null)).toBe(false);
  });
});
