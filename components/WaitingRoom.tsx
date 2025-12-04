'use client';

import { motion } from 'framer-motion';
import { User, Users, X } from 'lucide-react';

interface WaitingRoomProps {
  onStart: () => void;
  onFindMatch: () => void;
  onCancelSearch: () => void;
  isSearching: boolean;
  opponentFound: boolean;
}

export default function WaitingRoom({ 
  onStart, 
  onFindMatch, 
  onCancelSearch,
  isSearching,
  opponentFound 
}: WaitingRoomProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-game-bg p-4">
      <div className="w-full max-w-md bg-table-surface rounded-2xl p-8 border border-game-accent shadow-2xl">
        <h2 className="text-3xl font-bold text-center text-white mb-8 neon-text">WAITING ROOM</h2>
        
        <div className="flex justify-between items-center mb-12">
          {/* Player 1 (You) */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-game-accent border-2 border-neon-blue flex items-center justify-center shadow-[0_0_15px_var(--color-neon-blue)]">
              <User className="w-10 h-10 text-neon-blue" />
            </div>
            <span className="text-neon-blue font-bold">YOU</span>
          </div>

          <div className="text-gray-500 font-mono text-sm animate-pulse">VS</div>

          {/* Player 2 (Opponent) */}
          <div className="flex flex-col items-center gap-4">
            {opponentFound ? (
              <>
                <div className="w-20 h-20 rounded-full bg-game-accent border-2 border-neon-pink flex items-center justify-center shadow-[0_0_15px_var(--color-neon-pink)]">
                  <User className="w-10 h-10 text-neon-pink" />
                </div>
                <span className="text-neon-pink font-bold">OPPONENT</span>
              </>
            ) : isSearching ? (
              <>
                <div className="w-20 h-20 rounded-full bg-game-accent border-2 border-yellow-500 flex items-center justify-center relative overflow-hidden animate-pulse">
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
                <span className="text-yellow-500 font-bold">SEARCHING...</span>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-game-accent border-2 border-gray-700 flex items-center justify-center">
                  <span className="text-gray-600 text-3xl">?</span>
                </div>
                <span className="text-gray-500 font-bold">WAITING</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!isSearching && !opponentFound ? (
            <>
              <button
                onClick={onFindMatch}
                className="w-full py-4 bg-neon-pink/10 border border-neon-pink text-neon-pink font-bold rounded-lg hover:bg-neon-pink/20 transition-colors uppercase tracking-wider shadow-[0_0_10px_var(--color-neon-pink)]"
              >
                Find Opponent
              </button>
              
              <button
                onClick={onStart}
                className="w-full py-4 bg-neon-blue/10 border border-neon-blue text-neon-blue font-bold rounded-lg hover:bg-neon-blue/20 transition-colors uppercase tracking-wider"
              >
                Practice Mode
              </button>
            </>
          ) : isSearching && !opponentFound ? (
            <button
              onClick={onCancelSearch}
              className="w-full py-4 bg-red-500/10 border border-red-500 text-red-500 font-bold rounded-lg hover:bg-red-500/20 transition-colors uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Cancel Search
            </button>
          ) : null}
          
          {opponentFound && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-bold text-green-400 neon-text"
              >
                MATCH FOUND!
              </motion.div>
              <p className="text-gray-400 mt-2">Starting game...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
