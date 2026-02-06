
import { ShipType } from './types';

export const GRID_SIZE = 10;

export const DEFAULT_SHIPS: ShipType[] = [
  { name: 'Carrier', size: 5, color: 'yellow' },
  { name: 'Battleship', size: 4, color: 'orange' },
  { name: 'Cruiser', size: 3, color: 'cyan' },
  { name: 'Submarine', size: 3, color: 'purple' },
  { name: 'Destroyer', size: 2, color: 'rose' },
];

export const INITIAL_GRID = (): any[][] => 
  Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('empty'));
