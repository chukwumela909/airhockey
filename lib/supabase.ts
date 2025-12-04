import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate a UUID using a fallback for older browsers
function generateUUID(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate or retrieve a persistent device ID for anonymous sessions
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  
  let deviceId = localStorage.getItem('airhockey_device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('airhockey_device_id', deviceId);
  }
  return deviceId;
}

// Types for database
export interface GameRoom {
  id: string;
  player1_id: string;
  player2_id: string | null;
  status: 'waiting' | 'playing' | 'finished';
  player1_score: number;
  player2_score: number;
  created_at: string;
  updated_at: string;
}

export interface GameState {
  id: string;
  room_id: string;
  puck_x: number;
  puck_y: number;
  puck_vx: number;
  puck_vy: number;
  player1_x: number;
  player1_y: number;
  player2_x: number;
  player2_y: number;
  last_update: string;
}

export interface OnlinePlayer {
  id: string;
  device_id: string;
  nickname: string;
  status: 'online' | 'in_game' | 'busy';
  last_seen: string;
  created_at: string;
}

export interface ChallengeRequest {
  id: string;
  challenger_id: string;
  challenger_nickname: string;
  challenged_id: string;
  challenged_nickname: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  room_id: string | null;
  created_at: string;
  expires_at: string;
}
