
import React from 'react';
import { GRID_SIZE } from '../constants';
import { CellStatus, ShipInstance, ShipColor } from '../types';

interface GridProps {
  grid: CellStatus[][];
  ships?: ShipInstance[];
  onCellClick?: (r: number, c: number) => void;
  onDrop?: (r: number, c: number) => void;
  showShips?: boolean;
  disabled?: boolean;
  fogOfWar?: boolean;
}

const colorMap: Record<ShipColor, { bg: string; border: string; hitBg: string; sunkBg: string; text: string }> = {
  yellow: { bg: 'bg-yellow-500/40', border: 'border-yellow-400/50', hitBg: 'bg-yellow-900/80', sunkBg: 'bg-yellow-950', text: 'text-yellow-500' },
  orange: { bg: 'bg-orange-500/40', border: 'border-orange-400/50', hitBg: 'bg-orange-900/80', sunkBg: 'bg-orange-950', text: 'text-orange-500' },
  cyan: { bg: 'bg-cyan-500/40', border: 'border-cyan-400/50', hitBg: 'bg-cyan-900/80', sunkBg: 'bg-cyan-950', text: 'text-cyan-500' },
  purple: { bg: 'bg-purple-500/40', border: 'border-purple-400/50', hitBg: 'bg-purple-900/80', sunkBg: 'bg-purple-950', text: 'text-purple-500' },
  rose: { bg: 'bg-rose-500/40', border: 'border-rose-400/50', hitBg: 'bg-rose-900/80', sunkBg: 'bg-rose-950', text: 'text-rose-500' },
};

const Grid: React.FC<GridProps> = ({ grid, ships, onCellClick, onDrop, showShips = true, disabled = false, fogOfWar = false }) => {
  return (
    <div className="relative border-4 border-slate-700 bg-slate-950 shadow-2xl overflow-hidden group rounded-xl">
      <div className="radar-sweep"></div>
      <div className="grid grid-cols-10 gap-0.5 p-1.5 bg-slate-900/40">
        {grid.map((row, r) =>
          row.map((cell, c) => {
            let bgColor = 'bg-slate-900';
            let cursor = 'cursor-default';
            let pulse = '';
            let content = null;
            let isRevealed = cell === 'hit' || cell === 'miss' || cell === 'sunk';

            const showFog = fogOfWar && !isRevealed && !showShips;
            const shipAtCell = ships?.find(s => s.coordinates.some(coord => coord.r === r && coord.c === c));
            const shipStyles = shipAtCell ? colorMap[shipAtCell.color] : null;

            if (cell === 'hit') {
              bgColor = shipStyles ? shipStyles.hitBg : 'bg-red-600';
              pulse = 'animate-pulse';
              content = <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_white]"></div>;
            } else if (cell === 'miss') {
              bgColor = 'bg-slate-800/80';
              content = <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>;
            } else if (cell === 'sunk') {
              bgColor = shipStyles ? shipStyles.sunkBg : 'bg-red-950';
              content = <div className={`text-[10px] font-black ${shipStyles ? shipStyles.text : 'text-red-500'} scale-125`}>X</div>;
            } else if (cell === 'ship' && showShips) {
              bgColor = shipStyles ? `${shipStyles.bg} border ${shipStyles.border} shadow-[inset_0_0_12px_rgba(255,255,255,0.05)]` : 'bg-cyan-700/80 border border-cyan-400/40';
            } else if (showFog) {
              bgColor = 'bg-slate-950 opacity-90';
            }

            if (!disabled && !isRevealed) {
              if (onCellClick) cursor = 'cursor-crosshair hover:bg-cyan-900/50 hover:scale-105';
              if (onDrop) cursor = 'cursor-copy hover:bg-cyan-500/20';
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onCellClick && !disabled && onCellClick(r, c)}
                onDragOver={(e) => { 
                    e.preventDefault(); 
                    if (onDrop && !disabled) e.currentTarget.classList.add('bg-cyan-500/30', 'scale-110', 'z-10'); 
                }}
                onDragLeave={(e) => { 
                    if (onDrop) e.currentTarget.classList.remove('bg-cyan-500/30', 'scale-110', 'z-10'); 
                }}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  if (onDrop && !disabled) {
                    e.currentTarget.classList.remove('bg-cyan-500/30', 'scale-110', 'z-10');
                    onDrop(r, c);
                  }
                }}
                className={`w-8 h-8 md:w-11 md:h-11 border border-slate-800/40 grid-cell ${bgColor} ${cursor} ${pulse} flex items-center justify-center transition-all relative group/cell overflow-hidden rounded-[2px]`}
              >
                {showFog && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_30%,#000_100%)] opacity-50 pointer-events-none"></div>}
                {content}
                {!disabled && !isRevealed && (onCellClick || onDrop) && (
                   <div className="absolute inset-0 bg-cyan-400/0 group-hover/cell:bg-cyan-400/10 pointer-events-none transition-colors"></div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <div className="absolute top-0 -left-6 flex flex-col justify-around h-full text-[9px] text-slate-700 font-mono font-bold">
        {Array.from({length: GRID_SIZE}).map((_, i) => <span key={i}>{i}</span>)}
      </div>
      <div className="absolute -top-6 left-0 flex justify-around w-full text-[9px] text-slate-700 font-mono font-bold">
        {Array.from({length: GRID_SIZE}).map((_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}
      </div>
    </div>
  );
};

export default Grid;
