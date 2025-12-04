'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Users, X, Gamepad2, RefreshCw, Check } from 'lucide-react';
import { OnlinePlayer, ChallengeRequest } from '@/lib/supabase';

interface WaitingRoomProps {
  onStart: () => void;
  // Multiplayer props
  nickname: string;
  isOnline: boolean;
  onlinePlayers: OnlinePlayer[];
  pendingChallenge: ChallengeRequest | null;
  sentChallenge: ChallengeRequest | null;
  onGoOnline: (nickname: string) => void;
  onSendChallenge: (player: OnlinePlayer) => void;
  onAcceptChallenge: (challenge: ChallengeRequest) => void;
  onDeclineChallenge: (challenge: ChallengeRequest) => void;
  onCancelChallenge: () => void;
  onRefreshPlayers: () => void;
}

export default function WaitingRoom({ 
  onStart,
  nickname,
  isOnline,
  onlinePlayers,
  pendingChallenge,
  sentChallenge,
  onGoOnline,
  onSendChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
  onCancelChallenge,
  onRefreshPlayers,
}: WaitingRoomProps) {
  const [nicknameInput, setNicknameInput] = useState(nickname || '');
  const [showNicknameInput, setShowNicknameInput] = useState(!isOnline);

  const handleGoOnline = () => {
    if (nicknameInput.trim().length >= 2) {
      onGoOnline(nicknameInput.trim());
      setShowNicknameInput(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-game-bg p-4 overflow-y-auto">
      {/* Incoming Challenge Modal */}
      <AnimatePresence>
        {pendingChallenge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-table-surface rounded-2xl p-6 border border-neon-pink shadow-[0_0_30px_var(--color-neon-pink)] max-w-sm w-full"
            >
              <h3 className="text-2xl font-bold text-center text-white mb-4">CHALLENGE!</h3>
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-game-accent border-2 border-neon-pink flex items-center justify-center">
                  <User className="w-8 h-8 text-neon-pink" />
                </div>
                <p className="text-lg text-white">
                  <span className="text-neon-pink font-bold">{pendingChallenge.challenger_nickname}</span>
                  <br />
                  <span className="text-gray-400 text-sm">wants to play!</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onDeclineChallenge(pendingChallenge)}
                  className="flex-1 py-3 bg-red-500/20 border border-red-500 text-red-500 font-bold rounded-lg hover:bg-red-500/30 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Decline
                </button>
                <button
                  onClick={() => onAcceptChallenge(pendingChallenge)}
                  className="flex-1 py-3 bg-green-500/20 border border-green-500 text-green-500 font-bold rounded-lg hover:bg-green-500/30 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiting for response modal */}
      <AnimatePresence>
        {sentChallenge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-table-surface rounded-2xl p-6 border border-yellow-500 max-w-sm w-full"
            >
              <h3 className="text-xl font-bold text-center text-white mb-4">Challenge Sent!</h3>
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-game-accent border-2 border-yellow-500 flex items-center justify-center animate-pulse">
                  <User className="w-8 h-8 text-yellow-500" />
                </div>
                <p className="text-center text-gray-400">
                  Waiting for <span className="text-yellow-500 font-bold">{sentChallenge.challenged_nickname}</span> to respond...
                </p>
              </div>
              <button
                onClick={onCancelChallenge}
                className="w-full py-3 bg-red-500/20 border border-red-500 text-red-500 font-bold rounded-lg hover:bg-red-500/30 flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancel Challenge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-2 neon-text">AIR HOCKEY</h1>
        <p className="text-center text-gray-400 mb-8">Multiplayer Neon Edition</p>

        {/* Nickname / Go Online Section */}
        {showNicknameInput || !isOnline ? (
          <div className="bg-table-surface rounded-2xl p-6 border border-game-accent shadow-2xl mb-4">
            <h2 className="text-xl font-bold text-white mb-4">Enter Nickname</h2>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Your nickname..."
              maxLength={15}
              className="w-full px-4 py-3 bg-game-bg border border-game-accent rounded-lg text-white placeholder-gray-500 focus:border-neon-blue focus:outline-none mb-4"
            />
            <button
              onClick={handleGoOnline}
              disabled={nicknameInput.trim().length < 2}
              className="w-full py-3 bg-neon-blue/20 border border-neon-blue text-neon-blue font-bold rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go Online
            </button>
          </div>
        ) : (
          <>
            {/* Online Status */}
            <div className="bg-table-surface rounded-2xl p-4 border border-game-accent shadow-2xl mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-game-accent border-2 border-neon-blue flex items-center justify-center">
                    <User className="w-5 h-5 text-neon-blue" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{nickname}</p>
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Online
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Online Players List */}
            <div className="bg-table-surface rounded-2xl p-4 border border-game-accent shadow-2xl mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Online Players ({onlinePlayers.length})
                </h2>
                <button
                  onClick={onRefreshPlayers}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {onlinePlayers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No other players online.<br />
                  <span className="text-sm">Invite a friend to play!</span>
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {onlinePlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-game-bg rounded-lg border border-game-accent"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-game-accent border border-neon-pink flex items-center justify-center">
                          <User className="w-4 h-4 text-neon-pink" />
                        </div>
                        <span className="text-white">{player.nickname}</span>
                      </div>
                      <button
                        onClick={() => onSendChallenge(player)}
                        className="px-3 py-1 bg-neon-pink/20 border border-neon-pink text-neon-pink text-sm font-bold rounded hover:bg-neon-pink/30 flex items-center gap-1"
                      >
                        <Gamepad2 className="w-4 h-4" />
                        Challenge
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Practice Mode Button */}
        <button
          onClick={onStart}
          className="w-full py-4 bg-game-accent/50 border border-gray-600 text-gray-300 font-bold rounded-lg hover:bg-game-accent hover:text-white transition-colors"
        >
          Practice Mode (vs AI)
        </button>
      </div>
    </div>
  );
}
