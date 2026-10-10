import { BuildingLife as PlatformBuildingLife, type BuildingDoor as PlatformBuildingDoor, type BuildingFloor as PlatformBuildingFloor, type BuildingFlicker as PlatformBuildingFlicker, type BuildingLifeLook as PlatformBuildingLifeLook, type BuildingLightAnchor as PlatformBuildingLightAnchor, type BuildingLightKind as PlatformBuildingLightKind, type BuildingLightSite as PlatformBuildingLightSite, type BuildingRoom as PlatformBuildingRoom, type BuildingSwing as PlatformBuildingSwing, type BuildingWave as PlatformBuildingWave } from '@wildshard/game/systems/props/buildingLife';

/** A building's door: pivot, state, legacy box, prompt and leaf (SHARD-PLATFORM M3, the props system). */
export type BuildingDoor = PlatformBuildingDoor;
/** A light's kind: a fire burns all day, a lamp is lit by the clock. */
export type BuildingLightKind = PlatformBuildingLightKind;
/** A flickering light with its base, seed and kind. */
export type BuildingFlicker = PlatformBuildingFlicker;
/** A shared light's slot at a site. */
export type BuildingLightAnchor = PlatformBuildingLightAnchor;
/** A room's floor rectangle in its building's frame. */
export type BuildingRoom = PlatformBuildingRoom;
/** A swinging pivot and its seed. */
export type BuildingSwing = PlatformBuildingSwing;
/** A floor / deck rectangle in world space and its top. */
export type BuildingFloor = PlatformBuildingFloor;
/** A place the shared lights may visit. */
export type BuildingLightSite = PlatformBuildingLightSite;
/** One wave of a clock motion: rate, seed scale, amount. */
export type BuildingWave = PlatformBuildingWave;
/** How a settlement's buildings move and light (a shard's data row). */
export type BuildingLifeLook = PlatformBuildingLifeLook;
/** A settlement's buildings as a living place: doors, flicker, lamps, swings, wheels, shared lights, floors and solids. */
export const BuildingLife: typeof PlatformBuildingLife = PlatformBuildingLife;
/** A settlement's living buildings (the instance type). */
export type BuildingLifeView = PlatformBuildingLife;
