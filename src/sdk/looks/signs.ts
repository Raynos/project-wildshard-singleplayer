import { SignAtlas as PlatformSignAtlas, SignBuilder as PlatformSignBuilder, signBoardBox as platformSignBoardBox, signSize as platformSignSize, type PlacedSign as PlatformPlacedSign, type SignAtlasLayout as PlatformSignAtlasLayout, type SignBoardBox as PlatformSignBoardBox, type SignBoardSink as PlatformSignBoardSink, type SignCalligraphy as PlatformSignCalligraphy, type SignCell as PlatformSignCell, type SignFace as PlatformSignFace, type SignLen as PlatformSignLen, type SignLight as PlatformSignLight, type SignPaint as PlatformSignPaint, type SignPlace as PlatformSignPlace, type SignSegment as PlatformSignSegment, type SignSpec as PlatformSignSpec, type SignStep as PlatformSignStep, type SignStyleRow as PlatformSignStyleRow } from '@wildshard/game/systems/signs/signAtlas';

/** A length in a sign cell: px + fractions of the cell's width and height + glyph units. */
export type SignLen = PlatformSignLen;
/** A colour: a CSS colour, or the spec's colour / ink. */
export type SignPaint = PlatformSignPaint;
/** One segment of a stroked sign path. */
export type SignSegment = PlatformSignSegment;
/** One drawing step over a sign's cell. */
export type SignStep = PlatformSignStep;
/** How a sign face is sized. */
export type SignFace = PlatformSignFace;
/** One sign style as data (SHARD-PLATFORM M3, the sign system). */
export type SignStyleRow = PlatformSignStyleRow;
/** A sign's words and style. */
export type SignSpec<S extends string = string> = PlatformSignSpec<S>;
/** The atlases' sizes for a tier. */
export type SignAtlasLayout = PlatformSignAtlasLayout;
/** A sign's cell in its atlas. */
export type SignCell = PlatformSignCell;
/** A sign to hang. */
export type SignPlace<S extends string = string> = PlatformSignPlace<S>;
/** A sign the builder drew. */
export type PlacedSign<S extends string = string> = PlatformPlacedSign<S>;
/** A lit face a sign reports. */
export type SignLight = PlatformSignLight;
/** The box behind a sign's face. */
export type SignBoardBox = PlatformSignBoardBox;
/** Where a sign's board goes. */
export type SignBoardSink = PlatformSignBoardSink;
/** The neon calligraphy a builder may route calligraphy styles to. */
export type SignCalligraphy = PlatformSignCalligraphy;
/** The mono and colour sign atlases, drawn from a shard's style rows. */
export const SignAtlas: typeof PlatformSignAtlas = PlatformSignAtlas;
/** A built sign atlas. */
export type SignAtlasView<S extends string = string> = PlatformSignAtlas<S>;
/** Collects sign quads and boards. */
export const SignBuilder: typeof PlatformSignBuilder = PlatformSignBuilder;
/** A sign builder. */
export type SignBuilderView<S extends string = string> = PlatformSignBuilder<S>;
/** A sign's face size (m). */
export const signSize: typeof platformSignSize = platformSignSize;
/** A sign's board box. */
export const signBoardBox: typeof platformSignBoardBox = platformSignBoardBox;
