import { GlyphField as PlatformGlyphField, type GlyphFieldLayout as PlatformGlyphFieldLayout, type GlyphRect as PlatformGlyphRect } from '@wildshard/game/systems/signs/glyphField';
import { NeonText as PlatformNeonText, type NeonTextDef as PlatformNeonTextDef, type NeonTextGlsl as PlatformNeonTextGlsl, type NeonTextLook as PlatformNeonTextLook, type NeonTextOptions as PlatformNeonTextOptions } from '@wildshard/game/systems/signs/neonText';

/** A glyph field's sizes for a tier. */
export type GlyphFieldLayout = PlatformGlyphFieldLayout;
/** A glyph's cell in the field. */
export type GlyphRect = PlatformGlyphRect;
/** A glyph distance-field atlas (fill and skeleton) for lit lettering. */
export const GlyphField: typeof PlatformGlyphField = PlatformGlyphField;
/** A built glyph field. */
export type GlyphFieldView = PlatformGlyphField;
/** One neon calligraphy sign. */
export type NeonTextDef = PlatformNeonTextDef;
/** The neon's look as data (SHARD-PLATFORM M3, the sign system). */
export type NeonTextLook = PlatformNeonTextLook;
/** The shard's GLSL the neon programs splice in. */
export type NeonTextGlsl = PlatformNeonTextGlsl;
/** The neon's uniforms, GLSL, blending and look. */
export type NeonTextOptions = PlatformNeonTextOptions;
/** Neon calligraphy signs: boards and SDF tubes, two draws. */
export const NeonText: typeof PlatformNeonText = PlatformNeonText;
/** A neon calligraphy batch. */
export type NeonTextView = PlatformNeonText;
