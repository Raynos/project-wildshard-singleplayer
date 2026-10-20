import type { BufferGeometryJSON } from 'three';
import type { BossDefinition, BossPhaseDef } from '@wildshard/engine/ai/BossBrain';
import type { PrivateScene, ClientChannelProgram } from '@wildshard/format/clientChannels';

interface Point { x: number; z: number }
type Encounter = Omit<BossDefinition, 'reward'>;
interface Reward { tier: string; name: string; flavour: string; prompt: string }
interface Program { script: unknown; bytes: string }
type Programs = Record<'attack' | 'fire' | 'wind' | 'rules', Program>;
type Tuning = Record<'spearDamage' | 'spearRadius' | 'spearAim' | 'spearLock' | 'spearStuck' | 'whirlDamage' | 'whirlRadius'
  | 'riderHp' | 'riderChip' | 'chargeDamage' | 'laneSeconds' | 'flankSeconds' | 'stunSeconds' | 'cell' | 'burnSeconds'
  | 'fireDps' | 'maxFlames' | 'chainDamage' | 'chainRadius' | 'chainLand' | 'fullDraw' | 'fullDrawMul', number>;
type Lines = Record<'kneels' | 'grassFire' | 'immuneDome' | 'immuneSpear' | 'spearStuck' | 'riderBreaks' | 'lastRider'
  | 'burning' | 'chain' | 'wall' | 'tie' | 'tieOnFoot' | 'tieQuiet' | 'wantsRider' | 'quiet' | 'wakes', string>;
/** Named JSON is validated by the producer; native code consumes only this wire contract. */
export interface TitanFightData {
  TITAN_CLOCKS: unknown;
  TITAN_FIRE_SENSE: { x: number; z: number }[];
  TITAN_CHAINS: { count: number; law: unknown };
  TITAN_TRAIL: unknown; TITAN_WHIRLS: unknown;
  TITAN_SCHEDULES: { spear: unknown; chain: unknown; contact: unknown };
  TITAN_SUPPORT: unknown; TITAN_SUPPORT_SITES: { x: number; z: number; theta: number }[];
  TITAN_FIRE_FIELD: unknown; arenaFire: unknown; programs: Programs; FIRE_NEIGHBOURS: [number, number][];
  TITAN_ARENA: { center: Point; titan: Point; grid: number };
  TITAN_PLACE: { centreZ: number; arenaRadius: number; titanZ: number; heartHp: number; bodyScale: number };
  TITAN_PHASES: BossPhaseDef[]; TITAN_ENCOUNTER: Encounter; TITAN_REWARD: Reward;
  TITAN_SKIN: { id: string; toast: string }; TITAN_LINES: Lines; TITAN_TUNING: Tuning;
  TITAN_BOUNDARY: { x: number; z: number; radius: number };
  TITAN_PHASE_FEED: string[]; TITAN_TIE_FEED: string[]; TITAN_IMMUNE_FEED: string[];
  TITAN_FIRE_SEEDS: Point[];
}
type Geometry = Pick<BufferGeometryJSON, 'type' | 'data'>;
interface PuffRow { bone: string; p: [number,number,number]; r: number; ph: number; colour: [number,number,number] }
interface Tier { flames: Geometry; puffs: PuffRow[] }
export interface TitanGeometryData {
  phone: Tier; desktop: Tier; eyes: Geometry;
  /** game/boss/encounterView CloudBody rows less the eyes, poses and tier puffs the fight adds */
  body: { geometry: Record<string, Geometry>; puffs: object } & Record<string, unknown>;
  poses: ClientChannelProgram[];
  /** game/boss/encounterView ArenaSceneView rows */
  arena: unknown;
}
