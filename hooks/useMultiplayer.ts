'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, getDeviceId, OnlinePlayer, ChallengeRequest, GameRoom } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseMultiplayerOptions {
  onChallengeReceived: (challenge: ChallengeRequest) => void;
  onChallengeAccepted: (room: GameRoom, isPlayer1: boolean) => void;
  onChallengeDeclined: (challenge: ChallengeRequest) => void;
  onOpponentLeft: () => void;
}

export function useMultiplayer(options: UseMultiplayerOptions) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [pendingChallenge, setPendingChallenge] = useState<ChallengeRequest | null>(null);
  const [sentChallenge, setSentChallenge] = useState<ChallengeRequest | null>(null);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [isPlayer1, setIsPlayer1] = useState(false);
  
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    
    // Check if user has a saved nickname
    const savedNickname = localStorage.getItem('airhockey_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  // Go online with nickname
  const goOnline = useCallback(async (playerNickname: string) => {
    if (!deviceId) return;
    
    // Save nickname
    localStorage.setItem('airhockey_nickname', playerNickname);
    setNickname(playerNickname);

    // Upsert into online_players
    const { error } = await supabase
      .from('online_players')
      .upsert({
        device_id: deviceId,
        nickname: playerNickname,
        status: 'online',
        last_seen: new Date().toISOString(),
      }, {
        onConflict: 'device_id'
      });

    if (!error) {
      setIsOnline(true);
      startHeartbeat();
      subscribeToUpdates();
      fetchOnlinePlayers();
    }
  }, [deviceId]);

  // Heartbeat to keep presence alive
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    heartbeatRef.current = setInterval(async () => {
      if (deviceId) {
        await supabase
          .from('online_players')
          .update({ last_seen: new Date().toISOString() })
          .eq('device_id', deviceId);
        
        // Also refresh the players list
        fetchOnlinePlayers();
      }
    }, 5000); // Every 5 seconds
  }, [deviceId]);

  // Fetch online players
  const fetchOnlinePlayers = useCallback(async () => {
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
    
    const { data } = await supabase
      .from('online_players')
      .select('*')
      .eq('status', 'online')
      .gte('last_seen', fifteenSecondsAgo)
      .neq('device_id', deviceId);

    if (data) {
      setOnlinePlayers(data);
    }
  }, [deviceId]);

  // Subscribe to real-time updates
  const subscribeToUpdates = useCallback(() => {
    // Unsubscribe from previous channels
    channelsRef.current.forEach(ch => ch.unsubscribe());
    channelsRef.current = [];

    // Subscribe to online players changes
    const playersChannel = supabase
      .channel('online_players_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'online_players' },
        () => {
          fetchOnlinePlayers();
        }
      )
      .subscribe();

    // Subscribe to challenge requests for this player (incoming)
    const incomingChallengesChannel = supabase
      .channel(`challenges_incoming_${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenge_requests',
          filter: `challenged_id=eq.${deviceId}`
        },
        (payload) => {
          const challenge = payload.new as ChallengeRequest;
          if (challenge.status === 'pending') {
            setPendingChallenge(challenge);
            options.onChallengeReceived(challenge);
          }
        }
      )
      .subscribe();

    // Subscribe to challenge requests we sent (outgoing)
    const outgoingChallengesChannel = supabase
      .channel(`challenges_outgoing_${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenge_requests',
          filter: `challenger_id=eq.${deviceId}`
        },
        async (payload) => {
          const challenge = payload.new as ChallengeRequest;
          if (challenge.status === 'accepted' && challenge.room_id) {
            // Fetch the room
            const { data: room } = await supabase
              .from('game_rooms')
              .select('*')
              .eq('id', challenge.room_id)
              .single();
            
            if (room) {
              setCurrentRoom(room);
              setIsPlayer1(true);
              setSentChallenge(null);
              options.onChallengeAccepted(room, true);
            }
          } else if (challenge.status === 'declined') {
            setSentChallenge(null);
            options.onChallengeDeclined(challenge);
            
            // Reset our status back to online
            await supabase
              .from('online_players')
              .update({ status: 'online' })
              .eq('device_id', deviceId);
          }
        }
      )
      .subscribe();

    channelsRef.current = [playersChannel, incomingChallengesChannel, outgoingChallengesChannel];
  }, [deviceId, options, fetchOnlinePlayers]);

  // Send challenge to a player
  const sendChallenge = useCallback(async (targetPlayer: OnlinePlayer) => {
    if (!deviceId || !nickname) return null;

    // Set our status to busy
    await supabase
      .from('online_players')
      .update({ status: 'busy' })
      .eq('device_id', deviceId);

    const { data, error } = await supabase
      .from('challenge_requests')
      .insert({
        challenger_id: deviceId,
        challenger_nickname: nickname,
        challenged_id: targetPlayer.device_id,
        challenged_nickname: targetPlayer.nickname,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Reset status
      await supabase
        .from('online_players')
        .update({ status: 'online' })
        .eq('device_id', deviceId);
      return null;
    }

    setSentChallenge(data as ChallengeRequest);
    return data as ChallengeRequest;
  }, [deviceId, nickname]);

  // Accept a challenge
  const acceptChallenge = useCallback(async (challenge: ChallengeRequest) => {
    if (!deviceId) return;

    // Create a game room
    const { data: room, error: roomError } = await supabase
      .from('game_rooms')
      .insert({
        player1_id: challenge.challenger_id,
        player2_id: deviceId,
        status: 'playing',
      })
      .select()
      .single();

    if (roomError || !room) return;

    // Create game state
    await supabase.from('game_state').insert({
      room_id: room.id
    });

    // Update challenge with room_id and status
    await supabase
      .from('challenge_requests')
      .update({
        status: 'accepted',
        room_id: room.id,
      })
      .eq('id', challenge.id);

    // Update both players to in_game
    await supabase
      .from('online_players')
      .update({ status: 'in_game' })
      .in('device_id', [challenge.challenger_id, deviceId]);

    setCurrentRoom(room);
    setIsPlayer1(false);
    setPendingChallenge(null);
    options.onChallengeAccepted(room, false);
  }, [deviceId, options]);

  // Decline a challenge
  const declineChallenge = useCallback(async (challenge: ChallengeRequest) => {
    await supabase
      .from('challenge_requests')
      .update({ status: 'declined' })
      .eq('id', challenge.id);

    // Reset challenger's status
    await supabase
      .from('online_players')
      .update({ status: 'online' })
      .eq('device_id', challenge.challenger_id);

    setPendingChallenge(null);
  }, []);

  // Cancel a sent challenge
  const cancelChallenge = useCallback(async () => {
    if (!sentChallenge) return;
    
    await supabase
      .from('challenge_requests')
      .delete()
      .eq('id', sentChallenge.id);

    // Reset our status
    await supabase
      .from('online_players')
      .update({ status: 'online' })
      .eq('device_id', deviceId);
    
    setSentChallenge(null);
  }, [sentChallenge, deviceId]);

  // Leave game
  const leaveGame = useCallback(async () => {
    if (currentRoom) {
      await supabase
        .from('game_rooms')
        .update({ status: 'finished' })
        .eq('id', currentRoom.id);
    }

    // Go back online
    await supabase
      .from('online_players')
      .update({ status: 'online' })
      .eq('device_id', deviceId);

    setCurrentRoom(null);
  }, [currentRoom, deviceId]);

  // Go offline
  const goOffline = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    channelsRef.current.forEach(ch => ch.unsubscribe());
    
    await supabase
      .from('online_players')
      .delete()
      .eq('device_id', deviceId);

    setIsOnline(false);
    setOnlinePlayers([]);
  }, [deviceId]);

  // Cleanup on unmount
  useEffect(() => {
    const cleanup = async () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      channelsRef.current.forEach(ch => ch.unsubscribe());
      
      if (deviceId) {
        await supabase
          .from('online_players')
          .delete()
          .eq('device_id', deviceId);
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [deviceId]);

  return {
    deviceId,
    nickname,
    isOnline,
    onlinePlayers,
    pendingChallenge,
    sentChallenge,
    currentRoom,
    isPlayer1,
    goOnline,
    goOffline,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    leaveGame,
    refreshPlayers: fetchOnlinePlayers,
  };
}
