import type { bakeNineDecal } from './decalAtlasPage';
import type { bakeGlyphPage } from './glyphPage';
import type { bakeSignAtlasPage } from './signAtlasPage';

declare global {
  interface Window {
    readonly NineDecalBake: { readonly bakeNineDecal: typeof bakeNineDecal };
    readonly NineGlyphBake: { readonly bakeGlyphPage: typeof bakeGlyphPage };
    readonly NineSignBake: { readonly bakeSignAtlasPage: typeof bakeSignAtlasPage };
  }
}
