import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate or retrieve a persistent device ID for anonymous sessions
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  
  let deviceId = localStorage.getItem('airhockey_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
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

export interface MatchmakingEntry {
  id: string;
  player_id: string;
  created_at: string;
}
