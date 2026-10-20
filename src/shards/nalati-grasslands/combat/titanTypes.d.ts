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
  TITAN_FIRE_FIELD: unknown; arenaFire: unknown; programs: Programs; FIRE_NEIGHBOURS: [number, number][];
  TITAN_ARENA: { center: Point; titan: Point; grid: number };
  TITAN_PLACE: { centreZ: number; arenaRadius: number; titanZ: number; heartHp: number; bodyScale: number };
  TITAN_PHASES: BossPhaseDef[]; TITAN_ENCOUNTER: Encounter; TITAN_REWARD: Reward;
  TITAN_SKIN: { id: string; toast: string }; TITAN_LINES: Lines; TITAN_TUNING: Tuning;
  TITAN_PHASE_ACTIONS: { spearCooldown: number; whirls: boolean[]; riders: boolean; fire: boolean; feed: string }[];
  TITAN_FIRE_SEEDS: Point[];
}
type Geometry = Pick<BufferGeometryJSON, 'type' | 'data'>;
interface PuffRow { bone: string; p: [number,number,number]; r: number; ph: number; colour: [number,number,number] }
interface Tier { flames: Geometry; puffs: PuffRow[] }
export interface TitanGeometryData {
  phone: Tier; desktop: Tier; eyes: Geometry;
  body: { scene: PrivateScene; geometry: Record<string, Geometry> };
  poses: ClientChannelProgram[];
  arena: { scene: PrivateScene; geometry: Record<string,Geometry>; scorch: number[] };
}
export interface KurganData {
  king: { page: unknown; profile: unknown; encounter: Encounter; reward: Reward; tuning: { reach: number; ringMax: number; beamRadius: number } };
  programs: Programs; arenaRoom: unknown;
}
