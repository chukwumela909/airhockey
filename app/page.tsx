'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import WaitingRoom from '@/components/WaitingRoom';
import GameTable from '@/components/GameTable';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { GameRoom, ChallengeRequest, OnlinePlayer } from '@/lib/supabase';

type GameMode = 'practice' | 'multiplayer';

export default function Home() {
  const [screenState, setScreenState] = useState<'loading' | 'waiting' | 'playing'>('loading');
  const [gameMode, setGameMode] = useState<GameMode>('practice');

  const handleChallengeReceived = useCallback((challenge: ChallengeRequest) => {
    console.log('Challenge received from:', challenge.challenger_nickname);
  }, []);

  const handleChallengeAccepted = useCallback((room: GameRoom, isP1: boolean) => {
    console.log('Challenge accepted! Room:', room.id, 'Is Player 1:', isP1);
    setGameMode('multiplayer');
    setScreenState('playing');
  }, []);

  const handleChallengeDeclined = useCallback((challenge: ChallengeRequest) => {
    console.log('Challenge declined by:', challenge.challenged_nickname);
    alert(`${challenge.challenged_nickname} declined your challenge.`);
  }, []);

  const handleOpponentLeft = useCallback(() => {
    console.log('Opponent left!');
    alert('Opponent left the game.');
    setScreenState('waiting');
  }, []);

  const {
    nickname,
    isOnline,
    onlinePlayers,
    pendingChallenge,
    sentChallenge,
    currentRoom,
    isPlayer1,
    goOnline,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    leaveGame,
    refreshPlayers,
  } = useMultiplayer({
    onChallengeReceived: handleChallengeReceived,
    onChallengeAccepted: handleChallengeAccepted,
    onChallengeDeclined: handleChallengeDeclined,
    onOpponentLeft: handleOpponentLeft,
  });

  useEffect(() => {
    // Simulate loading assets
    const timer = setTimeout(() => {
      setScreenState('waiting');
    }, 2000);
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
  };

  const handleSendChallenge = async (player: OnlinePlayer) => {
    await sendChallenge(player);
  };

  const handleAcceptChallenge = async (challenge: ChallengeRequest) => {
    await acceptChallenge(challenge);
  };

  const handleDeclineChallenge = async (challenge: ChallengeRequest) => {
    await declineChallenge(challenge);
  };

  return (
    <main className="min-h-screen bg-game-bg overflow-hidden">
      {screenState === 'loading' && <LoadingScreen />}
      {screenState === 'waiting' && (
        <WaitingRoom 
          onStart={startPractice}
          nickname={nickname}
          isOnline={isOnline}
          onlinePlayers={onlinePlayers}
          pendingChallenge={pendingChallenge}
          sentChallenge={sentChallenge}
          onGoOnline={goOnline}
          onSendChallenge={handleSendChallenge}
          onAcceptChallenge={handleAcceptChallenge}
          onDeclineChallenge={handleDeclineChallenge}
          onCancelChallenge={cancelChallenge}
          onRefreshPlayers={refreshPlayers}
        />
      )}
      {screenState === 'playing' && (
        <GameTable 
          onEndGame={endGame}
          isMultiplayer={gameMode === 'multiplayer'}
          isPlayer1={isPlayer1}
          currentRoom={currentRoom}
        />
      )}
    </main>
  );
}
