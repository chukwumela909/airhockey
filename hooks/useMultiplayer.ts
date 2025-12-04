'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, getDeviceId, GameRoom, GameState } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseMultiplayerOptions {
  onMatchFound: (room: GameRoom, isPlayer1: boolean) => void;
  onOpponentJoined: (room: GameRoom) => void;
  onGameStateUpdate: (state: GameState) => void;
  onOpponentLeft: () => void;
}

export function useMultiplayer(options: UseMultiplayerOptions) {
  const [isSearching, setIsSearching] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isPlayer1, setIsPlayer1] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const gameStateChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Cleanup on unmount or browser close
  useEffect(() => {
    const cleanup = async () => {
      if (deviceId) {
        // Remove from matchmaking queue
        await supabase.from('matchmaking_queue').delete().eq('player_id', deviceId);
        
        // If in a room, handle leaving
        if (currentRoom) {
          if (currentRoom.status === 'waiting') {
            // Delete the room if we created it and no one joined
            await supabase.from('game_rooms').delete().eq('id', currentRoom.id);
          } else {
            // Mark room as finished if game was in progress
            await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
          }
        }
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
      channelRef.current?.unsubscribe();
      gameStateChannelRef.current?.unsubscribe();
    };
  }, [deviceId, currentRoom]);

  const findMatch = useCallback(async () => {
    if (!deviceId) return;
    
    setIsSearching(true);

    try {
      // First, check if there's an existing waiting room we can join
      const { data: waitingRooms } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('status', 'waiting')
        .neq('player1_id', deviceId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (waitingRooms && waitingRooms.length > 0) {
        // Join existing room
        const room = waitingRooms[0] as GameRoom;
        
        const { data: updatedRoom, error } = await supabase
          .from('game_rooms')
          .update({ 
            player2_id: deviceId, 
            status: 'playing',
            updated_at: new Date().toISOString()
          })
          .eq('id', room.id)
          .eq('status', 'waiting') // Ensure it's still waiting
          .select()
          .single();

        if (updatedRoom && !error) {
          setCurrentRoom(updatedRoom);
          setIsPlayer1(false);
          setIsSearching(false);
          subscribeToRoom(updatedRoom.id);
          options.onMatchFound(updatedRoom, false);
          return;
        }
      }

      // No waiting room found, create a new one
      const { data: newRoom, error } = await supabase
        .from('game_rooms')
        .insert({
          player1_id: deviceId,
          status: 'waiting'
        })
        .select()
        .single();

      if (newRoom && !error) {
        setCurrentRoom(newRoom);
        setIsPlayer1(true);
        subscribeToRoom(newRoom.id);
        
        // Initialize game state for this room
        await supabase.from('game_state').insert({
          room_id: newRoom.id
        });
      }
    } catch (error) {
      console.error('Error finding match:', error);
      setIsSearching(false);
    }
  }, [deviceId, options]);

  const subscribeToRoom = useCallback((roomId: string) => {
    // Unsubscribe from previous channels
    channelRef.current?.unsubscribe();
    gameStateChannelRef.current?.unsubscribe();

    // Subscribe to room changes
    channelRef.current = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const updatedRoom = payload.new as GameRoom;
          setCurrentRoom(updatedRoom);
          
          if (updatedRoom.status === 'playing' && updatedRoom.player2_id) {
            setIsSearching(false);
            options.onOpponentJoined(updatedRoom);
          }
          
          if (updatedRoom.status === 'finished') {
            options.onOpponentLeft();
          }
        }
      )
      .subscribe();

    // Subscribe to game state changes
    gameStateChannelRef.current = supabase
      .channel(`gamestate:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          options.onGameStateUpdate(payload.new as GameState);
        }
      )
      .subscribe();
  }, [options]);

  const updateGameState = useCallback(async (state: Partial<GameState>) => {
    if (!currentRoom) return;
    
    await supabase
      .from('game_state')
      .update({
        ...state,
        last_update: new Date().toISOString()
      })
      .eq('room_id', currentRoom.id);
  }, [currentRoom]);

  const updateScore = useCallback(async (player1Score: number, player2Score: number) => {
    if (!currentRoom) return;
    
    await supabase
      .from('game_rooms')
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentRoom.id);
  }, [currentRoom]);

  const cancelSearch = useCallback(async () => {
    if (currentRoom && currentRoom.status === 'waiting') {
      await supabase.from('game_rooms').delete().eq('id', currentRoom.id);
      await supabase.from('game_state').delete().eq('room_id', currentRoom.id);
    }
    
    channelRef.current?.unsubscribe();
    gameStateChannelRef.current?.unsubscribe();
    setCurrentRoom(null);
    setIsSearching(false);
  }, [currentRoom]);

  const leaveGame = useCallback(async () => {
    if (currentRoom) {
      await supabase
        .from('game_rooms')
        .update({ status: 'finished' })
        .eq('id', currentRoom.id);
    }
    
    channelRef.current?.unsubscribe();
    gameStateChannelRef.current?.unsubscribe();
    setCurrentRoom(null);
    setIsSearching(false);
  }, [currentRoom]);

  return {
    isSearching,
    currentRoom,
    isPlayer1,
    deviceId,
    findMatch,
    cancelSearch,
    leaveGame,
    updateGameState,
    updateScore,
  };
}
