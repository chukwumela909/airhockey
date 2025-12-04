'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSound } from '@/hooks/useSound';
import { GameRoom, GameState } from '@/lib/supabase';

interface GameTableProps {
  onEndGame: () => void;
  isMultiplayer?: boolean;
  isPlayer1?: boolean;
  currentRoom?: GameRoom | null;
  updateGameState?: (state: Partial<GameState>) => Promise<void>;
  updateScore?: (player1Score: number, player2Score: number) => Promise<void>;
}

export default function GameTable({ 
  onEndGame,
  isMultiplayer = false,
  isPlayer1 = true,
  currentRoom,
  updateGameState,
  updateScore,
}: GameTableProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const { playWallHit, playPaddleHit, playGoal, playPuckDrop } = useSound();
  
  // Game constants
  const TABLE_WIDTH = 400;
  const TABLE_HEIGHT = 700; // Mobile portrait aspect ratio
  const PUCK_RADIUS = 15;
  const PADDLE_RADIUS = 25;
  const GOAL_SIZE = 120;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        // Maintain aspect ratio
        const scale = Math.min(
          container.clientWidth / TABLE_WIDTH,
          container.clientHeight / TABLE_HEIGHT
        );
        canvas.width = TABLE_WIDTH * scale;
        canvas.height = TABLE_HEIGHT * scale;
        ctx.scale(scale, scale);
      }
    };
    window.addEventListener('resize', resize);
    resize();

    // Game State
    let puck = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0 };
    let player = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - 100 };
    let opponent = { x: TABLE_WIDTH / 2, y: 100, vx: 0, vy: 0 }; // Simple AI
    
    let isDragging = false;

    // Particle system for glitter effects
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
      size: number;
    }
    let particles: Particle[] = [];

    const spawnParticles = (x: number, y: number, color: string, count: number = 15) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          color,
          size: Math.random() * 4 + 2,
        });
      }
    };

    const updateParticles = () => {
      particles = particles.filter(p => p.life > 0.01);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= 0.03;
      });
    };

    const drawParticles = () => {
      particles.forEach(p => {
        const radius = Math.max(0.1, p.size * p.life);
        if (radius > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.closePath();
        }
      });
    };

    // Input handling
    const handleStart = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      handleMove(e);
    };

    const handleEnd = () => {
      isDragging = false;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = TABLE_WIDTH / rect.width;
      const scaleY = TABLE_HEIGHT / rect.height;
      
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      // Constrain player to bottom half
      player.x = Math.max(PADDLE_RADIUS, Math.min(TABLE_WIDTH - PADDLE_RADIUS, x));
      player.y = Math.max(TABLE_HEIGHT / 2 + PADDLE_RADIUS, Math.min(TABLE_HEIGHT - PADDLE_RADIUS, y));
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);

    // Game Loop
    let animationFrameId: number;

    const update = () => {
      // Physics Logic
      
      // Puck movement
      puck.x += puck.vx;
      puck.y += puck.vy;

      // Friction
      puck.vx *= 0.99;
      puck.vy *= 0.99;

      // Wall collisions
      if (puck.x - PUCK_RADIUS < 0) {
        puck.x = PUCK_RADIUS;
        puck.vx *= -1;
        playWallHit();
        spawnParticles(puck.x, puck.y, '#00fff5', 10);
      }
      if (puck.x + PUCK_RADIUS > TABLE_WIDTH) {
        puck.x = TABLE_WIDTH - PUCK_RADIUS;
        puck.vx *= -1;
        playWallHit();
        spawnParticles(puck.x, puck.y, '#00fff5', 10);
      }
      if (puck.y - PUCK_RADIUS < 0) {
        // Goal check (Top)
        if (puck.x > (TABLE_WIDTH - GOAL_SIZE) / 2 && puck.x < (TABLE_WIDTH + GOAL_SIZE) / 2) {
          setScore(s => ({ ...s, player: s.player + 1 }));
          playGoal();
          spawnParticles(puck.x, puck.y, '#FFD700', 30); // Gold particles for goal
          resetPuck();
        } else {
          puck.y = PUCK_RADIUS;
          puck.vy *= -1;
          playWallHit();
          spawnParticles(puck.x, puck.y, '#00fff5', 10);
        }
      }
      if (puck.y + PUCK_RADIUS > TABLE_HEIGHT) {
        // Goal check (Bottom)
        if (puck.x > (TABLE_WIDTH - GOAL_SIZE) / 2 && puck.x < (TABLE_WIDTH + GOAL_SIZE) / 2) {
          setScore(s => ({ ...s, opponent: s.opponent + 1 }));
          playGoal();
          spawnParticles(puck.x, puck.y, '#FFD700', 30); // Gold particles for goal
          resetPuck();
        } else {
          puck.y = TABLE_HEIGHT - PUCK_RADIUS;
          puck.vy *= -1;
          playWallHit();
          spawnParticles(puck.x, puck.y, '#00fff5', 10);
        }
      }

      // Paddle collisions (Player)
      const dx = puck.x - player.x;
      const dy = puck.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PUCK_RADIUS + PADDLE_RADIUS) {
        const angle = Math.atan2(dy, dx);
        const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        const push = 15; // Force
        
        puck.vx = Math.cos(angle) * (speed + push * 0.5);
        puck.vy = Math.sin(angle) * (speed + push * 0.5);
        
        // Prevent sticking
        const overlap = (PUCK_RADIUS + PADDLE_RADIUS) - dist;
        puck.x += Math.cos(angle) * overlap;
        puck.y += Math.sin(angle) * overlap;
        
        playPaddleHit();
        spawnParticles(puck.x, puck.y, '#00fff5', 20); // Cyan for player
      }

      // AI Movement (Simple tracking)
      const targetX = puck.x;
      const targetY = Math.min(TABLE_HEIGHT / 2 - 50, Math.max(50, puck.y)); // Stay in top half
      
      opponent.x += (targetX - opponent.x) * 0.05;
      // Only move Y if puck is in opponent's half
      if (puck.y < TABLE_HEIGHT / 2) {
          opponent.y += (puck.y - opponent.y) * 0.05;
      } else {
          opponent.y += (100 - opponent.y) * 0.05; // Return to defense
      }

      // Paddle collisions (Opponent)
      const odx = puck.x - opponent.x;
      const ody = puck.y - opponent.y;
      const odist = Math.sqrt(odx * odx + ody * ody);
      if (odist < PUCK_RADIUS + PADDLE_RADIUS) {
        const angle = Math.atan2(ody, odx);
        const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        const push = 10;
        
        puck.vx = Math.cos(angle) * (speed + push * 0.5);
        puck.vy = Math.sin(angle) * (speed + push * 0.5);
        
        const overlap = (PUCK_RADIUS + PADDLE_RADIUS) - odist;
        puck.x += Math.cos(angle) * overlap;
        puck.y += Math.sin(angle) * overlap;
        
        playPaddleHit();
        spawnParticles(puck.x, puck.y, '#ff007f', 20); // Pink for opponent
      }

      // Update particles
      updateParticles();

      draw();
      animationFrameId = requestAnimationFrame(update);
    };

    const resetPuck = () => {
      puck = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0 };
      playPuckDrop();
    };

    const draw = () => {
      // Clear
      ctx.fillStyle = '#1a1a2e'; // var(--color-game-bg)
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Table markings
      ctx.strokeStyle = '#0f3460'; // var(--color-game-accent)
      ctx.lineWidth = 5;
      
      // Center line
      ctx.beginPath();
      ctx.moveTo(0, TABLE_HEIGHT / 2);
      ctx.lineTo(TABLE_WIDTH, TABLE_HEIGHT / 2);
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 50, 0, Math.PI * 2);
      ctx.stroke();

      // Goals - styled like the reference image
      // Top goal (opponent) - yellow/gold glow
      ctx.beginPath();
      ctx.moveTo((TABLE_WIDTH - GOAL_SIZE) / 2, 0);
      ctx.lineTo((TABLE_WIDTH + GOAL_SIZE) / 2, 0);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 8;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#FFD700';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      // Top goal arc
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, 0, GOAL_SIZE / 2, 0, Math.PI, false);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Bottom goal (player) - blue glow
      ctx.beginPath();
      ctx.moveTo((TABLE_WIDTH - GOAL_SIZE) / 2, TABLE_HEIGHT);
      ctx.lineTo((TABLE_WIDTH + GOAL_SIZE) / 2, TABLE_HEIGHT);
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 8;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00BFFF';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      // Bottom goal arc
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT, GOAL_SIZE / 2, Math.PI, 0, false);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Puck
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#00fff5'; // var(--color-neon-blue)
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00fff5';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.closePath();

      // Player Paddle (hollow ring style)
      ctx.beginPath();
      ctx.arc(player.x, player.y, PADDLE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00fff5';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      // Inner circle for paddle
      ctx.beginPath();
      ctx.arc(player.x, player.y, PADDLE_RADIUS - 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Opponent Paddle (hollow ring style)
      ctx.beginPath();
      ctx.arc(opponent.x, opponent.y, PADDLE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff007f';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      // Inner circle for opponent paddle
      ctx.beginPath();
      ctx.arc(opponent.x, opponent.y, PADDLE_RADIUS - 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Draw particles on top
      drawParticles();
    };

    update();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [playWallHit, playPaddleHit, playGoal, playPuckDrop]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
      {/* Scoreboard */}
      <div className="absolute top-4 left-0 right-0 flex justify-between px-8 z-10 pointer-events-none">
        <div className="text-4xl font-bold text-neon-pink neon-text">{score.opponent}</div>
        {isMultiplayer && (
          <div className="text-sm text-gray-400 self-center">ONLINE</div>
        )}
        <div className="text-4xl font-bold text-neon-blue neon-text">{score.player}</div>
      </div>

      <div className="relative w-full h-full max-w-lg max-h-[90vh] p-4">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full rounded-xl border-4 border-game-accent shadow-[0_0_30px_rgba(15,52,96,0.5)] bg-table-surface cursor-none touch-none"
        />
      </div>

      <button 
        onClick={onEndGame}
        className="absolute bottom-4 right-4 px-4 py-2 bg-red-500/20 text-red-500 rounded border border-red-500 hover:bg-red-500/40"
      >
        Exit
      </button>
    </div>
  );
}
