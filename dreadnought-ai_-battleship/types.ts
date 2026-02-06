
export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type SpecialAbilityType = 'OBLITERATOR' | 'PULSE_CANNON';

export interface AbilityStats {
  available: boolean;
  active: boolean;
  used: boolean;
}

export interface SpecialAbilities {
  OBLITERATOR: AbilityStats;
  PULSE_CANNON: AbilityStats;
}

export type ShipColor = 'yellow' | 'orange' | 'cyan' | 'purple' | 'rose';

export interface ShipType {
  name: string;
  size: number;
  color: ShipColor;
}

export interface ShipInstance extends ShipType {
  id: string;
  coordinates: { r: number; c: number }[];
  hits: number;
  orientation: 'horizontal' | 'vertical';
  isSunk: boolean;
  // Ability Specific State
  carrierHiddenHit?: { r: number; c: number } | null;
  submergedTurns?: number;
  // Cruiser Healing: Record of coordinate keys (e.g. "r,c") to remaining opponent shots
  hitCounters?: Record<string, number>;
}

export type GridData = CellStatus[][];

export enum GamePhase {
  SETUP = 'SETUP',
  PLACEMENT = 'PLACEMENT',
  PLAYER_TURN = 'PLAYER_TURN',
  AI_TURN = 'AI_TURN',
  GAME_OVER = 'GAME_OVER'
}

export interface GameState {
  playerGrid: GridData;
  aiGrid: GridData;
  playerShips: ShipInstance[];
  aiShips: ShipInstance[];
  phase: GamePhase;
  difficulty: Difficulty;
  configuredShips: ShipType[];
  specialAbilities: SpecialAbilities;
  winner: 'player' | 'ai' | null;
  logs: string[];
}
