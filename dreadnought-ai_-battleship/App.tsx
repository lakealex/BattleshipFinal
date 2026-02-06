
import React, { useState, useEffect, useCallback } from 'react';
import { GamePhase, GameState, ShipInstance, GridData, CellStatus, Difficulty, ShipType, SpecialAbilityType, SpecialAbilities, AbilityStats, ShipColor } from './types';
import { GRID_SIZE, DEFAULT_SHIPS, INITIAL_GRID } from './constants';
import Grid from './components/Grid';
import { getAIGameMove } from './services/geminiService';

const shipColorClasses: Record<ShipColor, string> = {
  yellow: 'bg-yellow-950/40 border-yellow-500/50 hover:bg-yellow-500/20 text-yellow-400',
  orange: 'bg-orange-950/40 border-orange-500/50 hover:bg-orange-500/20 text-orange-400',
  cyan: 'bg-cyan-950/40 border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-400',
  purple: 'bg-purple-950/40 border-purple-500/50 hover:bg-purple-500/20 text-purple-400',
  rose: 'bg-rose-950/40 border-rose-500/50 hover:bg-rose-500/20 text-rose-400',
};

const shipStatusBorderClasses: Record<ShipColor, string> = {
  yellow: 'border-yellow-900/40',
  orange: 'border-orange-900/40',
  cyan: 'border-cyan-900/40',
  purple: 'border-purple-900/40',
  rose: 'border-rose-900/40',
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    playerGrid: INITIAL_GRID(),
    aiGrid: INITIAL_GRID(),
    playerShips: [],
    aiShips: [],
    phase: GamePhase.SETUP,
    difficulty: 'MEDIUM',
    configuredShips: [...DEFAULT_SHIPS],
    specialAbilities: {
      OBLITERATOR: { available: true, active: false, used: false },
      PULSE_CANNON: { available: true, active: false, used: false },
    },
    winner: null,
    logs: ["Tactical Command Online. Fleet abilities synchronized."],
  });

  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [draggedShipIndex, setDraggedShipIndex] = useState<number | null>(null);

  const canPlaceShip = (grid: GridData, r: number, c: number, size: number, orient: 'horizontal' | 'vertical'): boolean => {
    if (orient === 'horizontal') {
      if (c + size > GRID_SIZE) return false;
      for (let i = 0; i < size; i++) if (grid[r][c + i] !== 'empty') return false;
    } else {
      if (r + size > GRID_SIZE) return false;
      for (let i = 0; i < size; i++) if (grid[r + i][c] !== 'empty') return false;
    }
    return true;
  };

  const handleStartPlacement = () => {
    setGameState(prev => ({ ...prev, phase: GamePhase.PLACEMENT }));
  };

  const handleDrop = (r: number, c: number) => {
    if (draggedShipIndex === null || gameState.phase !== GamePhase.PLACEMENT) return;
    const currentShip = gameState.configuredShips[draggedShipIndex];
    
    if (canPlaceShip(gameState.playerGrid, r, c, currentShip.size, orientation)) {
      const newGrid = [...gameState.playerGrid.map(row => [...row])];
      const coords: { r: number; c: number }[] = [];
      
      for (let i = 0; i < currentShip.size; i++) {
        const currR = orientation === 'vertical' ? r + i : r;
        const currC = orientation === 'horizontal' ? c + i : c;
        newGrid[currR][currC] = 'ship';
        coords.push({ r: currR, c: currC });
      }

      const newShip: ShipInstance = {
        ...currentShip,
        id: `p-${gameState.playerShips.length}`,
        coordinates: coords,
        hits: 0,
        orientation,
        isSunk: false,
      };

      const updatedPlayerShips = [...gameState.playerShips, newShip];
      setGameState(prev => ({
        ...prev,
        playerGrid: newGrid,
        playerShips: updatedPlayerShips,
        logs: [...prev.logs, `${currentShip.name} deployed at ${String.fromCharCode(65 + c)}${r}.`]
      }));

      if (updatedPlayerShips.length === gameState.configuredShips.length) {
        setupAI();
      }
    }
    setDraggedShipIndex(null);
  };

  const toggleAbility = (type: SpecialAbilityType) => {
    const cruiser = gameState.playerShips.find(s => s.name === 'Cruiser');
    const destroyer = gameState.playerShips.find(s => s.name === 'Destroyer');
    
    if (type === 'PULSE_CANNON' && (!cruiser || cruiser.isSunk)) return;
    if (type === 'OBLITERATOR' && (!destroyer || destroyer.isSunk)) return;
    if (gameState.specialAbilities[type].used) return;

    setGameState(prev => {
      const isActivating = !prev.specialAbilities[type].active;
      const resetAbilities = { ...prev.specialAbilities };
      Object.keys(resetAbilities).forEach(k => {
        resetAbilities[k as SpecialAbilityType].active = false;
      });
      return {
        ...prev,
        specialAbilities: {
          ...resetAbilities,
          [type]: { ...prev.specialAbilities[type], active: isActivating }
        }
      };
    });
  };

  const setupAI = () => {
    const aiGrid = INITIAL_GRID();
    const aiShips: ShipInstance[] = [];

    gameState.configuredShips.forEach((ship, idx) => {
      let placed = false;
      while (!placed) {
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        const orient = Math.random() > 0.5 ? 'horizontal' : 'vertical';
        if (canPlaceShip(aiGrid, r, c, ship.size, orient)) {
          const coords: { r: number; c: number }[] = [];
          for (let i = 0; i < ship.size; i++) {
            const currR = orient === 'vertical' ? r + i : r;
            const currC = orient === 'horizontal' ? c + i : c;
            aiGrid[currR][currC] = 'ship';
            coords.push({ r: currR, c: currC });
          }
          aiShips.push({ ...ship, id: `ai-${idx}`, coordinates: coords, hits: 0, orientation: orient, isSunk: false });
          placed = true;
        }
      }
    });

    setGameState(prev => ({
      ...prev,
      aiGrid,
      aiShips,
      phase: GamePhase.PLAYER_TURN,
      logs: [...prev.logs, "AI Fleet initialized. Ship tactical colors online."]
    }));
  };

  const checkShot = (grid: GridData, ships: ShipInstance[], r: number, c: number) => {
    let newGrid = [...grid.map(row => [...row])];
    let newShips = [...ships.map(s => ({ ...s }))];
    let result: CellStatus = 'miss';
    let sunkShip: ShipInstance | null = null;
    let logs: string[] = [];
    let counterFire: { r: number, c: number } | null = null;

    const targetShip = newShips.find(s => s.coordinates.some(coord => coord.r === r && coord.c === c));

    if (targetShip) {
      result = 'hit';
      
      if (targetShip.name === 'Carrier' && targetShip.hits === 0) {
        targetShip.hits = 1;
        targetShip.carrierHiddenHit = { r, c };
        result = 'miss';
        newGrid[r][c] = 'miss';
        logs.push(`Carrier Phantom Hull active. Attacker sensors reported a miss.`);
      } else {
        targetShip.hits += 1;
        newGrid[r][c] = 'hit';

        if (targetShip.name === 'Carrier' && targetShip.carrierHiddenHit) {
          const hidden = targetShip.carrierHiddenHit;
          newGrid[hidden.r][hidden.c] = 'hit';
          targetShip.carrierHiddenHit = null;
          logs.push(`Carrier's phantom hull detected! Previous hit revealed.`);
        }

        if (targetShip.name === 'Battleship') {
          counterFire = {
            r: Math.floor(Math.random() * GRID_SIZE),
            c: Math.floor(Math.random() * GRID_SIZE)
          };
          logs.push(`Battleship Counter-Battery firing!`);
        }

        if (targetShip.hits === targetShip.size) {
          targetShip.isSunk = true;
          sunkShip = targetShip;
          targetShip.coordinates.forEach(coord => { newGrid[coord.r][coord.c] = 'sunk'; });
        }
      }
    } else {
      newGrid[r][c] = 'miss';
    }

    return { newGrid, newShips, result, sunkShip, logs, counterFire };
  };

  const triggerSubmarineDeathRattle = (targetGrid: GridData, targetShips: ShipInstance[]) => {
    const activeCoords: { r: number, c: number }[] = [];
    targetShips.forEach(ship => {
      if (!ship.isSunk) {
        ship.coordinates.forEach(coord => {
          if (targetGrid[coord.r][coord.c] === 'ship') {
            activeCoords.push(coord);
          }
        });
      }
    });

    if (activeCoords.length > 0) {
      return activeCoords[Math.floor(Math.random() * activeCoords.length)];
    }
    return null;
  };

  const handlePlayerShot = async (r: number, c: number) => {
    if (gameState.phase !== GamePhase.PLAYER_TURN || isAiProcessing) return;
    if (gameState.aiGrid[r][c] === 'hit' || gameState.aiGrid[r][c] === 'sunk') return;

    let currentAiGrid = gameState.aiGrid;
    let currentAiShips = gameState.aiShips;
    let currentPlayerGrid = gameState.playerGrid;
    let currentPlayerShips = gameState.playerShips;
    let masterLogs = [...gameState.logs];

    let oblUsed = false;
    let pulseUsed = false;

    if (gameState.specialAbilities.OBLITERATOR.active) {
       oblUsed = true;
       const ship = currentAiShips.find(s => s.coordinates.some(coord => coord.r === r && coord.c === c));
       if (ship) {
         ship.hits = ship.size;
         ship.isSunk = true;
         ship.coordinates.forEach(coord => currentAiGrid[coord.r][coord.c] = 'sunk');
         masterLogs.push(`OBLITERATOR IMPACT: ${ship.name} completely destroyed.`);
         if (ship.name === 'Submarine') {
            const rattle = triggerSubmarineDeathRattle(currentPlayerGrid, currentPlayerShips);
            if (rattle) {
                const { newGrid, newShips, logs: sLogs } = checkShot(currentPlayerGrid, currentPlayerShips, rattle.r, rattle.c);
                currentPlayerGrid = newGrid;
                currentPlayerShips = newShips;
                masterLogs.push(`SUBMARINE DEATH RATTLE: Random retaliatory hit at ${String.fromCharCode(65 + rattle.c)}${rattle.r}!`);
                masterLogs.push(...sLogs);
            }
         }
       } else {
         currentAiGrid[r][c] = 'miss';
         masterLogs.push(`OBLITERATOR MISS: Impact in open water.`);
       }
    } else if (gameState.specialAbilities.PULSE_CANNON.active) {
      pulseUsed = true;
      masterLogs.push(`PULSE CANNON: Concentrated 5-square spread...`);
      const cross = [[0,0], [0,1], [0,-1], [1,0], [-1,0]];
      for (const [dr, dc] of cross) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
            const { newGrid, newShips, sunkShip, logs: subLogs } = checkShot(currentAiGrid, currentAiShips, nr, nc);
            currentAiGrid = newGrid;
            currentAiShips = newShips;
            masterLogs.push(...subLogs);
            if (sunkShip) {
                masterLogs.push(`Pulse Kill: ${sunkShip.name} confirmed sunk.`);
                if (sunkShip.name === 'Submarine') {
                    const rattle = triggerSubmarineDeathRattle(currentPlayerGrid, currentPlayerShips);
                    if (rattle) {
                        const { newGrid: pG, newShips: pS, logs: rLogs } = checkShot(currentPlayerGrid, currentPlayerShips, rattle.r, rattle.c);
                        currentPlayerGrid = pG;
                        currentPlayerShips = pS;
                        masterLogs.push(`SUBMARINE DEATH RATTLE: Retaliation strike hit ${String.fromCharCode(65 + rattle.c)}${rattle.r}!`);
                        masterLogs.push(...rLogs);
                    }
                }
            }
          }
      }
    } else {
      const { newGrid, newShips, result, sunkShip, logs: subLogs, counterFire } = checkShot(currentAiGrid, currentAiShips, r, c);
      currentAiGrid = newGrid;
      currentAiShips = newShips;
      masterLogs.push(...subLogs);
      masterLogs.push(`Fire Mission ${String.fromCharCode(65 + c)}${r}: [${result.toUpperCase()}]`);
      if (sunkShip) {
          masterLogs.push(`Victory Intel: Enemy ${sunkShip.name} neutralized.`);
          if (sunkShip.name === 'Submarine') {
            const rattle = triggerSubmarineDeathRattle(currentPlayerGrid, currentPlayerShips);
            if (rattle) {
                const { newGrid: pG, newShips: pS, logs: rLogs } = checkShot(currentPlayerGrid, currentPlayerShips, rattle.r, rattle.c);
                currentPlayerGrid = pG;
                currentPlayerShips = pS;
                masterLogs.push(`SUBMARINE DEATH RATTLE: Sinking vessel fires one last shot at ${String.fromCharCode(65 + rattle.c)}${rattle.r}!`);
                masterLogs.push(...rLogs);
            }
          }
      }
      
      if (counterFire) {
         const { newGrid: pGrid, newShips: pShips, logs: cLogs } = checkShot(currentPlayerGrid, currentPlayerShips, counterFire.r, counterFire.c);
         currentPlayerGrid = pGrid;
         currentPlayerShips = pShips;
         masterLogs.push(`REACTION: Battleship Counter-Fire at ${String.fromCharCode(65 + counterFire.c)}${counterFire.r}!`);
         masterLogs.push(...cLogs);
      }
    }

    const updatedAbilities = { ...gameState.specialAbilities };
    updatedAbilities.OBLITERATOR = {
      ...updatedAbilities.OBLITERATOR,
      active: false,
      used: updatedAbilities.OBLITERATOR.used || oblUsed
    };
    updatedAbilities.PULSE_CANNON = {
      ...updatedAbilities.PULSE_CANNON,
      active: false,
      used: updatedAbilities.PULSE_CANNON.used || pulseUsed
    };

    const allSunk = currentAiShips.every(s => s.isSunk);
    setGameState(prev => ({
      ...prev,
      aiGrid: currentAiGrid,
      aiShips: currentAiShips,
      playerGrid: currentPlayerGrid,
      playerShips: currentPlayerShips,
      specialAbilities: updatedAbilities,
      phase: allSunk ? GamePhase.GAME_OVER : GamePhase.AI_TURN,
      winner: allSunk ? 'player' : null,
      logs: masterLogs
    }));
  };

  const processAIMove = useCallback(async () => {
    if (gameState.phase !== GamePhase.AI_TURN) return;
    setIsAiProcessing(true);

    let masterLogs = [...gameState.logs];
    let currentPlayerGrid = gameState.playerGrid;
    let currentPlayerShips = gameState.playerShips;
    let currentAiGrid = gameState.aiGrid;
    let currentAiShips = gameState.aiShips;

    let move;
    if (gameState.difficulty === 'HARD') {
      move = await getAIGameMove(currentPlayerGrid.map(row => row.map(cell => cell === 'ship' ? 'empty' : cell)), masterLogs);
    } else {
      let r, c;
      do { r = Math.floor(Math.random() * GRID_SIZE); c = Math.floor(Math.random() * GRID_SIZE); } 
      while (currentPlayerGrid[r][c] === 'hit' || currentPlayerGrid[r][c] === 'sunk');
      move = { r, c, taunt: "Preparing salvos." };
    }
    
    const { newGrid, newShips, result, sunkShip, logs: subLogs, counterFire } = checkShot(currentPlayerGrid, currentPlayerShips, move.r, move.c);
    currentPlayerGrid = newGrid;
    currentPlayerShips = newShips;
    
    if (gameState.difficulty === 'HARD') masterLogs.push(`ADMIRAL OBSIDIAN: "${move.taunt}"`);
    masterLogs.push(`INCOMING FIRE: ${String.fromCharCode(65 + move.c)}${move.r}: [${result.toUpperCase()}]`);
    masterLogs.push(...subLogs);
    
    if (sunkShip) {
      masterLogs.push(`CRITICAL ALERT: Friendly ${sunkShip.name} lost.`);
      if (sunkShip.name === 'Submarine') {
          const rattle = triggerSubmarineDeathRattle(currentAiGrid, currentAiShips);
          if (rattle) {
              const { newGrid: aG, newShips: aS, logs: rLogs } = checkShot(currentAiGrid, currentAiShips, rattle.r, rattle.c);
              currentAiGrid = aG;
              currentAiShips = aS;
              masterLogs.push(`LAST STRIKE: Sunk Submarine hits AI Sector ${String.fromCharCode(65 + rattle.c)}${rattle.r}!`);
              masterLogs.push(...rLogs);
          }
      }
    }

    if (counterFire) {
      const { newGrid: aGrid, newShips: aShips, logs: cLogs } = checkShot(currentAiGrid, currentAiShips, counterFire.r, counterFire.c);
      currentAiGrid = aGrid;
      currentAiShips = aShips;
      masterLogs.push(`COUNTER-STRIKE: Retaliatory hit on AI grid at ${String.fromCharCode(65 + counterFire.c)}${counterFire.r}.`);
      masterLogs.push(...cLogs);
    }

    const allSunk = currentPlayerShips.every(s => s.isSunk);

    setTimeout(() => {
        setGameState(prev => ({
            ...prev,
            playerGrid: currentPlayerGrid,
            playerShips: currentPlayerShips,
            aiGrid: currentAiGrid,
            aiShips: currentAiShips,
            phase: allSunk ? GamePhase.GAME_OVER : GamePhase.PLAYER_TURN,
            winner: allSunk ? 'ai' : null,
            logs: masterLogs
        }));
        setIsAiProcessing(false);
    }, 1200);
  }, [gameState.phase, gameState.playerGrid, gameState.playerShips, gameState.aiGrid, gameState.aiShips, gameState.difficulty, gameState.logs]);

  useEffect(() => {
    if (gameState.phase === GamePhase.AI_TURN && !isAiProcessing) processAIMove();
  }, [gameState.phase, processAIMove, isAiProcessing]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-slate-950 text-slate-200 selection:bg-cyan-500/30">
      <header className="mb-10 text-center relative">
        <div className="absolute -inset-4 bg-cyan-500/10 blur-3xl rounded-full"></div>
        <h1 className="text-5xl md:text-7xl font-bold text-cyan-500 mb-2 drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] font-oswald">DREADNOUGHT AI</h1>
        <p className="text-slate-500 font-mono text-sm tracking-[0.3em] uppercase">Tactical Fleet Coding // Online</p>
      </header>

      {gameState.phase === GamePhase.SETUP && (
        <div className="w-full max-w-4xl bg-slate-900/50 border border-slate-700/50 p-8 rounded-2xl backdrop-blur-md shadow-2xl">
          <h2 className="text-3xl font-bold mb-8 text-cyan-400 border-b border-cyan-500/20 pb-4 tracking-widest">STRATEGIC PLANNING</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-lg font-bold mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-cyan-500 inline-block"></span> Fleet Composition
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                {gameState.configuredShips.map((ship, idx) => (
                  <div key={idx} className={`flex items-center gap-4 bg-slate-800/40 p-3 rounded-lg border ${shipStatusBorderClasses[ship.color]}`}>
                    <span className={`text-sm font-mono uppercase tracking-widest ${shipColorClasses[ship.color].split(' ').pop()}`}>{ship.name}</span>
                    <div className="ml-auto text-xs opacity-50 font-mono">Size: {ship.size}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-bold mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-4 bg-red-500 inline-block"></span> Adversary Logic
              </h3>
              <div className="grid grid-cols-1 gap-4 flex-grow">
                {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setGameState(prev => ({ ...prev, difficulty: d }))} className={`p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                      gameState.difficulty === d ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800/20 border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}>
                    <div className="font-bold text-xl mb-1 tracking-widest">{d}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleStartPlacement} className="mt-12 w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xl rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98] uppercase tracking-[0.2em]">
            Begin Placement
          </button>
        </div>
      )}

      {gameState.phase !== GamePhase.SETUP && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-12 max-w-[1600px] w-full items-start">
          <section className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 bg-slate-900/80 px-6 py-3 rounded-full border border-green-500/30 tracking-widest">
              <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></span>
              FRIENDLY SECTOR
            </h2>
            <Grid 
              grid={gameState.playerGrid} 
              ships={gameState.playerShips}
              onDrop={handleDrop}
              disabled={gameState.phase !== GamePhase.PLACEMENT}
            />
            {gameState.phase === GamePhase.PLACEMENT && (
              <div className="mt-8 p-6 bg-slate-900/60 border border-cyan-500/20 rounded-2xl w-full backdrop-blur-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <p className="text-cyan-400 font-bold uppercase tracking-widest text-xs font-mono">Deployment Bay</p>
                    <button onClick={() => setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[10px] uppercase font-bold tracking-widest font-mono">
                        Rotate: {orientation}
                    </button>
                </div>
                <div className="flex flex-wrap gap-4 justify-center">
                  {gameState.configuredShips.map((ship, idx) => {
                    const isPlaced = gameState.playerShips.some(s => s.name === ship.name);
                    return (
                      <div
                        key={idx}
                        draggable={!isPlaced}
                        onDragStart={() => setDraggedShipIndex(idx)}
                        className={`p-2 rounded border cursor-grab active:cursor-grabbing text-[10px] font-bold uppercase tracking-widest font-mono transition-all ${
                          isPlaced ? 'opacity-10 border-slate-800' : shipColorClasses[ship.color]
                        }`}
                      >
                        {ship.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-8 grid grid-cols-2 gap-4 w-full">
               {gameState.playerShips.map(s => (
                 <div key={s.id} className={`p-2 rounded border text-[10px] font-mono flex flex-col items-center transition-all ${
                   s.isSunk ? 'bg-red-900/20 border-red-500 text-red-500 line-through' : `bg-slate-900/40 ${shipStatusBorderClasses[s.color]} text-slate-400`
                 }`}>
                    <span className={`font-bold uppercase tracking-widest ${s.isSunk ? 'text-red-500' : shipColorClasses[s.color].split(' ').pop()}`}>{s.name}</span>
                    <span className="text-[8px] opacity-60 uppercase tracking-tighter">
                      {s.name === 'Carrier' && 'Phantom Hull'}
                      {s.name === 'Battleship' && 'Counter-Battery'}
                      {s.name === 'Cruiser' && 'Pulse Cannon Link'}
                      {s.name === 'Submarine' && 'Last Strike'}
                      {s.name === 'Destroyer' && 'Obliterator Link'}
                    </span>
                 </div>
               ))}
            </div>
          </section>

          <div className="hidden xl:flex flex-col items-center justify-center h-full opacity-30">
            <div className="w-px h-96 bg-gradient-to-b from-transparent via-cyan-500 to-transparent"></div>
          </div>

          <section className="flex flex-col items-center">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 bg-slate-900/80 px-6 py-3 rounded-full border border-red-500/30 tracking-widest">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]"></span>
              ADVERSARY SECTOR
            </h2>
            <Grid 
              grid={gameState.aiGrid} 
              ships={gameState.aiShips}
              onCellClick={handlePlayerShot} 
              showShips={gameState.phase === GamePhase.GAME_OVER}
              disabled={gameState.phase !== GamePhase.PLAYER_TURN || isAiProcessing}
              fogOfWar={gameState.phase !== GamePhase.GAME_OVER}
            />

            <div className="mt-8 grid grid-cols-2 gap-6 w-full">
                {(Object.entries(gameState.specialAbilities) as [SpecialAbilityType, AbilityStats][]).map(([type, ability]) => {
                  const cruiser = gameState.playerShips.find(s => s.name === 'Cruiser');
                  const destroyer = gameState.playerShips.find(s => s.name === 'Destroyer');
                  
                  let isLocked = false;
                  let lockReason = "";
                  let activeColor = "bg-cyan-600/30 border-cyan-500 ring-cyan-500/20";
                  
                  if (type === 'PULSE_CANNON') {
                      if (!cruiser || cruiser.isSunk) {
                          isLocked = true;
                          lockReason = "Cruiser Offline";
                      }
                      activeColor = "bg-cyan-600/30 border-cyan-500 ring-cyan-500/20";
                  } else if (type === 'OBLITERATOR') {
                      if (!destroyer || destroyer.isSunk) {
                          isLocked = true;
                          lockReason = "Destroyer Offline";
                      }
                      activeColor = "bg-rose-600/30 border-rose-500 ring-rose-500/20";
                  }

                  const isUsed = ability.used;
                  
                  return (
                    <button
                      key={type}
                      disabled={isLocked || isUsed || gameState.phase !== GamePhase.PLAYER_TURN || isAiProcessing}
                      onClick={() => toggleAbility(type as SpecialAbilityType)}
                      className={`p-4 border-2 rounded-2xl flex flex-col items-center transition-all ${
                        ability.active ? `${activeColor} ring-4` : 
                        isUsed ? 'bg-slate-950 border-slate-900 text-slate-600 line-through' :
                        !isLocked ? 'bg-slate-900 border-slate-700 hover:border-cyan-500/40 text-slate-300' : 'bg-slate-950 border-slate-900 opacity-20 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black text-xs uppercase tracking-widest font-mono">{type}</span>
                      {isUsed && <span className="text-[8px] text-slate-500 mt-1 uppercase tracking-widest font-mono">Expended</span>}
                      {isLocked && !isUsed && <span className="text-[8px] text-red-500 mt-1 uppercase tracking-widest font-mono">{lockReason}</span>}
                      {!isUsed && !isLocked && <span className="text-[8px] text-cyan-500 mt-1 uppercase tracking-widest font-mono">Available (Once)</span>}
                    </button>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {/* Feed */}
      {gameState.phase !== GamePhase.SETUP && (
        <div className="mt-16 w-full max-w-7xl h-64 bg-black border border-cyan-900/40 rounded-3xl font-mono text-sm shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-cyan-950/20 px-6 py-3 border-b border-cyan-900/40 flex justify-between items-center text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.2em]">TACTICAL INTEL STREAM</div>
          <div className="p-6 overflow-y-auto custom-scrollbar flex-grow flex flex-col-reverse">
            {gameState.logs.slice().reverse().map((log, i) => (
              <div key={i} className={`mb-2 py-1 border-b border-white/5 last:border-0 ${
                log.includes('Carrier') ? 'text-yellow-400' :
                log.includes('Battleship') ? 'text-orange-400' :
                log.includes('Cruiser') ? 'text-cyan-400' :
                log.includes('Submarine') ? 'text-purple-400' :
                log.includes('Destroyer') ? 'text-rose-400' :
                log.includes('CRITICAL') || log.includes('ALERT') ? 'text-red-500 font-bold' : 'text-slate-400'
              }`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState.phase === GamePhase.GAME_OVER && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border-2 border-cyan-500/40 p-16 rounded-[3rem] max-w-2xl w-full text-center shadow-[0_0_120px_rgba(6,182,212,0.2)]">
            <div className={`text-7xl font-black mb-8 tracking-tighter font-oswald ${gameState.winner === 'player' ? 'text-green-400' : 'text-red-600'}`}>
              {gameState.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-6 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-3xl transition-all shadow-xl active:scale-95 text-2xl uppercase tracking-[0.2em]">Reset Operation</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
