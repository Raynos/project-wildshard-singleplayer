import { LUT_SIZE } from '@wildshard/engine/render/lut';
import layout from '../data/layoutPlan.json' with { type: 'json' };
import bleed from '../data/composite.json' with { type: 'json' };
import { JIEHUA_FS } from './compositeProgram';

/** Compile the static post Effect source while authoring the existing boot rows. */
export function compositeRows(): { readonly source: string; readonly bleed: typeof bleed } {
  const fragments: Readonly<Record<string, string>> = { y0: String(layout.Y0), lutScale: ((LUT_SIZE - 1) / LUT_SIZE).toFixed(6), lutBias: (0.5 / LUT_SIZE).toFixed(6) };
  const source = JIEHUA_FS.replaceAll(/@\{([a-zA-Z0-9_]+)\}/gu, (_token, name: string) => {
    const value = fragments[name];
    if (value === undefined) throw new Error(`Missing composite splice: ${name}`);
    return value;
  });
  return { source, bleed };
}
