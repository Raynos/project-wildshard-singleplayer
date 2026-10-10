import { cardField as platformCardField, cardFieldRow as platformCardFieldRow, cardFloats as platformCardFloats, cardGroup as platformCardGroup, cardGroupRow as platformCardGroupRow, type CardAttributeRow as PlatformCardAttributeRow, type CardFieldRow as PlatformCardFieldRow, type CardGroup as PlatformCardGroup, type CardGroupRow as PlatformCardGroupRow, type CardPulseRow as PlatformCardPulseRow, type CardRow as PlatformCardRow } from '@wildshard/game/systems/looks/cardField';

/** A card uniform's pulse as data: `base + amp · sin(t · rate + phase)`. */
export type CardPulseRow = PlatformCardPulseRow;
/** One card: a program of the family, its own uniforms and an optional pulse. */
export type CardRow<P extends string = string> = PlatformCardRow<P>;
/** A group of unit cards: its name, render order and cards (SHARD-PLATFORM M3, look-family rows). */
export type CardGroupRow<P extends string = string> = PlatformCardGroupRow<P>;
/** What a card group builds: the group, the shared plane, the materials and the pulse update. */
export type CardGroup = PlatformCardGroup;
/** One per-instance attribute: its item size and float32 bytes (base64). */
export type CardAttributeRow = PlatformCardAttributeRow;
/** An instanced card field: name, render order, quad size, program and per-instance attributes. */
export type CardFieldRow<P extends string = string> = PlatformCardFieldRow<P>;
/** A group of camera-facing unit cards drawn by a shard's shader family. */
export const cardGroup: typeof platformCardGroup = platformCardGroup;
/** An instanced camera-facing card field, one draw, from baked per-instance attributes. */
export const cardField: typeof platformCardField = platformCardField;
/** The float32 bytes of a list of numbers, base64 (for a card field's bake). */
export const cardFloats: typeof platformCardFloats = platformCardFloats;
/** A card group row read from a bake's JSON, checked against the family. */
export const cardGroupRow: typeof platformCardGroupRow = platformCardGroupRow;
/** A card field row read from a bake's JSON, checked against the family. */
export const cardFieldRow: typeof platformCardFieldRow = platformCardFieldRow;
