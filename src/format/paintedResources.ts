import * as v from 'valibot';

// The original native painted-world data contracts, independent of rendering.
const finite = v.pipe(v.number(), v.finite()), real = finite;
const shapeId = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*$/u));
const tiers = <T extends v.GenericSchema>(schema: T) => v.strictObject({ phone: schema, desktop: schema });
const triple = v.tuple([finite, finite, finite]);

/** Native drifting cloud-shadow rows; no rendering code. */
export const PaintedAirSchema: v.GenericSchema<BoundedPaintedAirInput, BoundedPaintedAir> = v.strictObject({ tile: v.pipe(finite, v.minValue(1)), threshold: finite, strength: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  softness: v.pipe(finite, v.minValue(0)), drift: v.tuple([finite, finite]) });

type BoundedPaintedAirInput = BoundedPaintedAir;
interface BoundedPaintedAirFields {
    tile: number;
    threshold: number;
    strength: number;
    softness: number;
    drift: [
        number,
        number
    ];
}
type BoundedPaintedAir = { [Key in keyof BoundedPaintedAirFields]: BoundedPaintedAirFields[Key] };
/** Native ground binding; its surface retains material-family admission. */
export const PaintedGroundSchema: v.GenericSchema<BoundedPaintedGroundInput, BoundedPaintedGround> = v.strictObject({ surface: v.unknown(), layers: v.pipe(v.array(shapeId), v.minLength(1), v.maxLength(8)),
  material: v.strictObject({ bands: finite, rim: finite, shade: finite }), colour: shapeId,
  shapes: v.pipe(v.array(shapeId), v.minLength(1), v.maxLength(8)), recipe: v.strictObject({ file: v.string(), key: shapeId }), mesh: shapeId,
  tiles: v.exactOptional(v.literal(true)) });

/** Native panorama resource and lent-parameter bindings. */
export const PaintedPanoramaSchema: v.GenericSchema<BoundedPaintedPanoramaInput, BoundedPaintedPanorama> = v.strictObject({
  dome: v.strictObject({ name: shapeId, look: shapeId, image: tiers(v.pipe(v.string(), v.regex(/^\/assets\/[a-zA-Z0-9/_.-]+$/u))), pad: finite, fallbackWidth: v.pipe(finite, v.minValue(1)),
    zenith: tiers(triple), radius: v.pipe(finite, v.minValue(1)),
    segments: v.tuple([v.pipe(finite, v.integer(), v.minValue(3), v.maxValue(256)), v.pipe(finite, v.integer(), v.minValue(2), v.maxValue(256))]), order: v.pipe(finite, v.integer()),
    night: v.tuple([finite, finite]), params: v.strictObject({ image: shapeId, ridge: shapeId, lut: shapeId, pad: shapeId, zenith: shapeId, sun: shapeId, night: shapeId }) }),
  sea: v.strictObject({ name: shapeId, look: shapeId, y: finite, lut: shapeId, sun: shapeId }),
  lit: v.strictObject({ looks: v.pipe(v.array(shapeId), v.maxLength(16)), shade: shapeId, rim: shapeId, wet: shapeId }),
});

/** Native key-light adjustment rows. */
export const PainterKeyLightSchema: v.GenericSchema<BoundedPainterKeyLightInput, BoundedPainterKeyLight> = v.strictObject({ turn: finite, lift: finite, ease: v.tuple([finite, finite]), sky: triple, ground: triple,
  mix: v.pipe(finite, v.minValue(0), v.maxValue(1)), fill: v.pipe(finite, v.minValue(0)) });

type BoundedPaintedGroundInput = BoundedPaintedGround;
interface BoundedPaintedGroundFields {
    surface: unknown;
    layers: string[];
    material: {
        bands: number;
        rim: number;
        shade: number;
    };
    colour: string;
    shapes: string[];
    recipe: {
        file: string;
        key: string;
    };
    mesh: string;
    tiles?: true;
}
type BoundedPaintedGround = { [Key in keyof BoundedPaintedGroundFields]: BoundedPaintedGroundFields[Key] };
type BoundedPaintedPanoramaInput = BoundedPaintedPanorama;
interface BoundedPaintedPanoramaFields {
    dome: {
        name: string;
        look: string;
        image: {
            phone: string;
            desktop: string;
        };
        pad: number;
        fallbackWidth: number;
        zenith: {
            phone: [
                number,
                number,
                number
            ];
            desktop: [
                number,
                number,
                number
            ];
        };
        radius: number;
        segments: [
            number,
            number
        ];
        order: number;
        night: [
            number,
            number
        ];
        params: {
            image: string;
            ridge: string;
            lut: string;
            pad: string;
            zenith: string;
            sun: string;
            night: string;
        };
    };
    sea: {
        name: string;
        look: string;
        y: number;
        lut: string;
        sun: string;
    };
    lit: {
        looks: string[];
        shade: string;
        rim: string;
        wet: string;
    };
}
type BoundedPaintedPanorama = { [Key in keyof BoundedPaintedPanoramaFields]: BoundedPaintedPanoramaFields[Key] };
type BoundedPainterKeyLightInput = BoundedPainterKeyLight;
interface BoundedPainterKeyLightFields {
    turn: number;
    lift: number;
    ease: [
        number,
        number
    ];
    sky: [
        number,
        number,
        number
    ];
    ground: [
        number,
        number,
        number
    ];
    mix: number;
    fill: number;
}
type BoundedPainterKeyLight = { [Key in keyof BoundedPainterKeyLightFields]: BoundedPainterKeyLightFields[Key] };
/** Native capture cadence and caster identities. */
export const PainterlyWorldSchema: v.GenericSchema<BoundedPainterlyWorldInput, BoundedPainterlyWorld> = v.strictObject({ casters: v.pipe(v.array(shapeId), v.maxLength(16)), sweep: v.pipe(real, v.minValue(0.1)),
  liveMap: v.pipe(real, v.integer(), v.minValue(64), v.maxValue(4096)), dusk: v.tuple([real, real]) });

type BoundedPainterlyWorldInput = BoundedPainterlyWorld;
interface BoundedPainterlyWorldFields {
    casters: string[];
    sweep: number;
    liveMap: number;
    dusk: [
        number,
        number
    ];
}
type BoundedPainterlyWorld = { [Key in keyof BoundedPainterlyWorldFields]: BoundedPainterlyWorldFields[Key] };
