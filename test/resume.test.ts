// src/engine/ui/Resume.ts: index.html paints the app-switch resume screen from its first bytes on a GPU-recovery reload (E61) and
// the module adopts it — the two copies of the markup must not drift apart, and the inline script must key on the same
// URL flag and still key as GpuRecovery / Resume write.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { BRAND_KEY, resumeHtml, SHOT_KEY } from '#engine/ui/Resume';
import { RELOAD_PARAM } from '#engine/core/GpuRecovery';

describe('resume screen', () => {
  it('index.html carries resumeHtml() verbatim inside .ws-resume', () => {
    expect(html).toContain(`<div class="ws-resume" aria-hidden="true">${resumeHtml()}</div>`);
  });

  it('the inline script reads the same reload flag and still key', () => {
    expect(html).toContain(`.has('${RELOAD_PARAM}')`);
    expect(html).toContain(`keys?.['${SHOT_KEY}']?.data`);
    expect(html).toContain(`keys?.['${BRAND_KEY}']?.data`);
  });

  it('links its stylesheet from the head (styled before any bundle runs)', () => {
    expect(html).toContain('<link rel="stylesheet" href="/src/engine/ui/styles/resume.css" />');
  });
});
