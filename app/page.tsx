'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import WaitingRoom from '@/components/WaitingRoom';
import GameTable from '@/components/GameTable';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { GameRoom, GameState } from '@/lib/supabase';

type GameMode = 'practice' | 'multiplayer';

export default function Home() {
  const [screenState, setScreenState] = useState<'loading' | 'waiting' | 'playing'>('loading');
  const [gameMode, setGameMode] = useState<GameMode>('practice');
  const [opponentFound, setOpponentFound] = useState(false);

  const handleMatchFound = useCallback((room: GameRoom, isPlayer1: boolean) => {
    console.log('Match found!', room, 'Is Player 1:', isPlayer1);
    setOpponentFound(true);
    // Start game after a brief delay to show "Match Found" message
    setTimeout(() => {
      setGameMode('multiplayer');
      setScreenState('playing');
    }, 2000);
  }, []);

  const handleOpponentJoined = useCallback((room: GameRoom) => {
    console.log('Opponent joined!', room);
    setOpponentFound(true);
    setTimeout(() => {
      setGameMode('multiplayer');
      setScreenState('playing');
    }, 2000);
  }, []);

  const handleGameStateUpdate = useCallback((state: GameState) => {
    // This will be used by GameTable component for real-time sync
    console.log('Game state update:', state);
  }, []);

  const handleOpponentLeft = useCallback(() => {
    console.log('Opponent left!');
    setScreenState('waiting');
    setOpponentFound(false);
  }, []);

  const {
    isSearching,
    currentRoom,
    isPlayer1,
    findMatch,
    cancelSearch,
    leaveGame,
    updateGameState,
    updateScore,
  } = useMultiplayer({
    onMatchFound: handleMatchFound,
    onOpponentJoined: handleOpponentJoined,
    onGameStateUpdate: handleGameStateUpdate,
    onOpponentLeft: handleOpponentLeft,
  });

  useEffect(() => {
    // Simulate loading assets
    const timer = setTimeout(() => {
      setScreenState('waiting');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const startPractice = () => {
    setGameMode('practice');
    setScreenState('playing');
  };

  const endGame = async () => {
    if (gameMode === 'multiplayer') {
      await leaveGame();
    }
    setScreenState('waiting');
    setOpponentFound(false);
  };

  return (
    <main className="min-h-screen bg-game-bg overflow-hidden">
      {screenState === 'loading' && <LoadingScreen />}
      {screenState === 'waiting' && (
        <WaitingRoom 
          onStart={startPractice}
          onFindMatch={findMatch}
          onCancelSearch={cancelSearch}
          isSearching={isSearching}
          opponentFound={opponentFound}
        />
      )}
      {screenState === 'playing' && (
        <GameTable 
          onEndGame={endGame}
          isMultiplayer={gameMode === 'multiplayer'}
          isPlayer1={isPlayer1}
          currentRoom={currentRoom}
          updateGameState={updateGameState}
          updateScore={updateScore}
        />
      )}
    </main>
  );
}
