'use client';

import { useEffect, useRef, useState } from 'react';
import { useSound } from '@/hooks/useSound';
import { supabase, GameRoom } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GameTableProps {
  onEndGame: () => void;
  isMultiplayer?: boolean;
  isPlayer1?: boolean;
  currentRoom?: GameRoom | null;
}

export default function GameTable({ 
  onEndGame,
  isMultiplayer = false,
  isPlayer1 = true,
  currentRoom,
}: GameTableProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const { playWallHit, playPaddleHit, playGoal, playPuckDrop } = useSound();
  
  // Game constants
  const TABLE_WIDTH = 400;
  const TABLE_HEIGHT = 700;
  const PUCK_RADIUS = 15;
  const PADDLE_RADIUS = 25;
  const GOAL_SIZE = 120;

  // Refs to hold mutable game state
  const gameStateRef = useRef({
    puck: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0 },
    player1: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - 100 }, // Bottom (blue)
    player2: { x: TABLE_WIDTH / 2, y: 100 }, // Top (pink)
    myPaddle: { x: TABLE_WIDTH / 2, y: isPlayer1 ? TABLE_HEIGHT - 100 : 100 },
    opponentPaddle: { x: TABLE_WIDTH / 2, y: isPlayer1 ? 100 : TABLE_HEIGHT - 100 },
    score: { player1: 0, player2: 0 },
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef<number>(0);
  const isPlayer1Ref = useRef(isPlayer1);

  useEffect(() => {
    isPlayer1Ref.current = isPlayer1;
  }, [isPlayer1]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameState = gameStateRef.current;

    // Setup Supabase Realtime for multiplayer
    if (isMultiplayer && currentRoom) {
      console.log('Setting up realtime channel for room:', currentRoom.id, 'isPlayer1:', isPlayer1);
      
      channelRef.current = supabase.channel(`game_${currentRoom.id}`, {
        config: {
          broadcast: { self: false },
        },
      });

      // Listen for opponent paddle movements
      channelRef.current.on('broadcast', { event: 'paddle_move' }, (payload) => {
        const { x, y, playerId } = payload.payload;
        console.log('Received paddle move:', { x, y, playerId, myPlayer1: isPlayer1Ref.current });
        // Only update if it's from opponent
        const isFromPlayer1 = playerId === currentRoom.player1_id;
        if ((isPlayer1Ref.current && !isFromPlayer1) || (!isPlayer1Ref.current && isFromPlayer1)) {
          gameState.opponentPaddle.x = x;
          gameState.opponentPaddle.y = y;
        }
      });

      // Listen for puck updates (Player 1 is authoritative for puck)
      channelRef.current.on('broadcast', { event: 'puck_update' }, (payload) => {
        if (!isPlayer1Ref.current) {
          // Player 2 receives puck state from Player 1
          const { x, y, vx, vy } = payload.payload;
          gameState.puck.x = x;
          gameState.puck.y = y;
          gameState.puck.vx = vx;
          gameState.puck.vy = vy;
        }
      });

      // Listen for score updates
      channelRef.current.on('broadcast', { event: 'score_update' }, (payload) => {
        gameState.score = payload.payload;
        setScore(payload.payload);
      });

      // Listen for sound effects
      channelRef.current.on('broadcast', { event: 'sound' }, (payload) => {
        const { type } = payload.payload;
        if (type === 'wall') playWallHit();
        if (type === 'paddle') playPaddleHit();
        if (type === 'goal') playGoal();
      });

      channelRef.current.subscribe();
    }

    // Handle resizing
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
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

    let isDragging = false;

    // Particle system
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
      size: number;
    }
    let particles: Particle[] = [];

    const spawnParticles = (x: number, y: number, color: string, count: number = 15) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
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

    // Broadcast paddle position
    const broadcastPaddle = (x: number, y: number) => {
      if (!isMultiplayer || !currentRoom || !channelRef.current) return;
      
      const now = Date.now();
      if (now - lastSentRef.current < 16) return; // Throttle to ~60fps
      lastSentRef.current = now;

      channelRef.current.send({
        type: 'broadcast',
        event: 'paddle_move',
        payload: {
          x, y,
          playerId: isPlayer1Ref.current ? currentRoom.player1_id : currentRoom.player2_id,
        },
      });
    };

    // Broadcast puck state (only Player 1)
    const broadcastPuck = () => {
      if (!isMultiplayer || !isPlayer1Ref.current || !currentRoom || !channelRef.current) return;
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'puck_update',
        payload: {
          x: gameState.puck.x,
          y: gameState.puck.y,
          vx: gameState.puck.vx,
          vy: gameState.puck.vy,
        },
      });
    };

    // Broadcast score
    const broadcastScore = (newScore: { player1: number; player2: number }) => {
      if (!isMultiplayer || !channelRef.current) return;
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'score_update',
        payload: newScore,
      });
    };

    // Broadcast sound
    const broadcastSound = (type: string) => {
      if (!isMultiplayer || !channelRef.current) return;
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'sound',
        payload: { type },
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

      // Constrain to own half
      const constrainedX = Math.max(PADDLE_RADIUS, Math.min(TABLE_WIDTH - PADDLE_RADIUS, x));
      let constrainedY: number;
      
      if (isPlayer1Ref.current) {
        // Player 1 controls bottom half
        constrainedY = Math.max(TABLE_HEIGHT / 2 + PADDLE_RADIUS, Math.min(TABLE_HEIGHT - PADDLE_RADIUS, y));
        gameState.player1.x = constrainedX;
        gameState.player1.y = constrainedY;
      } else {
        // Player 2 controls top half
        constrainedY = Math.max(PADDLE_RADIUS, Math.min(TABLE_HEIGHT / 2 - PADDLE_RADIUS, y));
        gameState.player2.x = constrainedX;
        gameState.player2.y = constrainedY;
      }

      gameState.myPaddle.x = constrainedX;
      gameState.myPaddle.y = constrainedY;
      
      broadcastPaddle(constrainedX, constrainedY);
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);

    // Reset puck
    const resetPuck = () => {
      gameState.puck = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0 };
      playPuckDrop();
    };

    // Game Loop
    let animationFrameId: number;

    const update = () => {
      // In multiplayer, only Player 1 calculates physics
      if (!isMultiplayer || isPlayer1Ref.current) {
        // Puck movement
        gameState.puck.x += gameState.puck.vx;
        gameState.puck.y += gameState.puck.vy;

        // Friction
        gameState.puck.vx *= 0.99;
        gameState.puck.vy *= 0.99;

        // Wall collisions
        if (gameState.puck.x - PUCK_RADIUS < 0) {
          gameState.puck.x = PUCK_RADIUS;
          gameState.puck.vx *= -1;
          playWallHit();
          broadcastSound('wall');
          spawnParticles(gameState.puck.x, gameState.puck.y, '#00fff5', 10);
        }
        if (gameState.puck.x + PUCK_RADIUS > TABLE_WIDTH) {
          gameState.puck.x = TABLE_WIDTH - PUCK_RADIUS;
          gameState.puck.vx *= -1;
          playWallHit();
          broadcastSound('wall');
          spawnParticles(gameState.puck.x, gameState.puck.y, '#00fff5', 10);
        }
        
        // Top wall / goal
        if (gameState.puck.y - PUCK_RADIUS < 0) {
          if (gameState.puck.x > (TABLE_WIDTH - GOAL_SIZE) / 2 && gameState.puck.x < (TABLE_WIDTH + GOAL_SIZE) / 2) {
            // Goal for Player 1!
            const newScore = { player1: gameState.score.player1 + 1, player2: gameState.score.player2 };
            gameState.score = newScore;
            setScore(newScore);
            broadcastScore(newScore);
            playGoal();
            broadcastSound('goal');
            spawnParticles(gameState.puck.x, gameState.puck.y, '#FFD700', 30);
            resetPuck();
          } else {
            gameState.puck.y = PUCK_RADIUS;
            gameState.puck.vy *= -1;
            playWallHit();
            broadcastSound('wall');
            spawnParticles(gameState.puck.x, gameState.puck.y, '#00fff5', 10);
          }
        }
        
        // Bottom wall / goal
        if (gameState.puck.y + PUCK_RADIUS > TABLE_HEIGHT) {
          if (gameState.puck.x > (TABLE_WIDTH - GOAL_SIZE) / 2 && gameState.puck.x < (TABLE_WIDTH + GOAL_SIZE) / 2) {
            // Goal for Player 2!
            const newScore = { player1: gameState.score.player1, player2: gameState.score.player2 + 1 };
            gameState.score = newScore;
            setScore(newScore);
            broadcastScore(newScore);
            playGoal();
            broadcastSound('goal');
            spawnParticles(gameState.puck.x, gameState.puck.y, '#FFD700', 30);
            resetPuck();
          } else {
            gameState.puck.y = TABLE_HEIGHT - PUCK_RADIUS;
            gameState.puck.vy *= -1;
            playWallHit();
            broadcastSound('wall');
            spawnParticles(gameState.puck.x, gameState.puck.y, '#00fff5', 10);
          }
        }

        // Get paddle positions for collision
        let p1 = gameState.player1;
        let p2 = gameState.player2;
        
        if (isMultiplayer) {
          if (isPlayer1Ref.current) {
            p1 = gameState.myPaddle;
            p2 = gameState.opponentPaddle;
          } else {
            p1 = gameState.opponentPaddle;
            p2 = gameState.myPaddle;
          }
        }

        // Player 1 paddle collision (bottom)
        const dx1 = gameState.puck.x - p1.x;
        const dy1 = gameState.puck.y - p1.y;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        if (dist1 < PUCK_RADIUS + PADDLE_RADIUS) {
          const angle = Math.atan2(dy1, dx1);
          const speed = Math.sqrt(gameState.puck.vx * gameState.puck.vx + gameState.puck.vy * gameState.puck.vy);
          const push = 15;
          
          gameState.puck.vx = Math.cos(angle) * (speed + push * 0.5);
          gameState.puck.vy = Math.sin(angle) * (speed + push * 0.5);
          
          const overlap = (PUCK_RADIUS + PADDLE_RADIUS) - dist1;
          gameState.puck.x += Math.cos(angle) * overlap;
          gameState.puck.y += Math.sin(angle) * overlap;
          
          playPaddleHit();
          broadcastSound('paddle');
          spawnParticles(gameState.puck.x, gameState.puck.y, '#00fff5', 20);
        }

        // Player 2 paddle collision (top)
        const dx2 = gameState.puck.x - p2.x;
        const dy2 = gameState.puck.y - p2.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 < PUCK_RADIUS + PADDLE_RADIUS) {
          const angle = Math.atan2(dy2, dx2);
          const speed = Math.sqrt(gameState.puck.vx * gameState.puck.vx + gameState.puck.vy * gameState.puck.vy);
          const push = 15;
          
          gameState.puck.vx = Math.cos(angle) * (speed + push * 0.5);
          gameState.puck.vy = Math.sin(angle) * (speed + push * 0.5);
          
          const overlap = (PUCK_RADIUS + PADDLE_RADIUS) - dist2;
          gameState.puck.x += Math.cos(angle) * overlap;
          gameState.puck.y += Math.sin(angle) * overlap;
          
          playPaddleHit();
          broadcastSound('paddle');
          spawnParticles(gameState.puck.x, gameState.puck.y, '#ff007f', 20);
        }

        // Broadcast puck state
        broadcastPuck();

        // AI for practice mode
        if (!isMultiplayer) {
          const targetX = gameState.puck.x;
          gameState.player2.x += (targetX - gameState.player2.x) * 0.05;
          if (gameState.puck.y < TABLE_HEIGHT / 2) {
            gameState.player2.y += (gameState.puck.y - gameState.player2.y) * 0.05;
          } else {
            gameState.player2.y += (100 - gameState.player2.y) * 0.05;
          }
        }
      }

      // Update particles
      updateParticles();

      // Draw
      draw();
      animationFrameId = requestAnimationFrame(update);
    };

    const draw = () => {
      // Clear
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Table markings
      ctx.strokeStyle = '#0f3460';
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

      // Goals
      // Top goal (Player 2's goal - yellow)
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
      
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, 0, GOAL_SIZE / 2, 0, Math.PI, false);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Bottom goal (Player 1's goal - blue)
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
      
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT, GOAL_SIZE / 2, Math.PI, 0, false);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Puck
      ctx.beginPath();
      ctx.arc(gameState.puck.x, gameState.puck.y, PUCK_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.closePath();

      // Get paddle positions
      let p1Pos = gameState.player1;
      let p2Pos = gameState.player2;
      
      if (isMultiplayer) {
        if (isPlayer1Ref.current) {
          p1Pos = gameState.myPaddle;
          p2Pos = gameState.opponentPaddle;
        } else {
          p1Pos = gameState.opponentPaddle;
          p2Pos = gameState.myPaddle;
        }
      }

      // Player 1 Paddle (Bottom - Blue)
      ctx.beginPath();
      ctx.arc(p1Pos.x, p1Pos.y, PADDLE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00fff5';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      ctx.beginPath();
      ctx.arc(p1Pos.x, p1Pos.y, PADDLE_RADIUS - 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Player 2 Paddle (Top - Pink)
      ctx.beginPath();
      ctx.arc(p2Pos.x, p2Pos.y, PADDLE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff007f';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.closePath();
      
      ctx.beginPath();
      ctx.arc(p2Pos.x, p2Pos.y, PADDLE_RADIUS - 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.closePath();

      // Draw particles
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
      channelRef.current?.unsubscribe();
    };
  }, [isMultiplayer, currentRoom, playWallHit, playPaddleHit, playGoal, playPuckDrop]);

  // Determine which score is "mine" based on player position
  const myScore = isPlayer1 ? score.player1 : score.player2;
  const opponentScore = isPlayer1 ? score.player2 : score.player1;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
      {/* Scoreboard */}
      <div className="absolute top-4 left-0 right-0 flex justify-between items-center px-8 z-10 pointer-events-none">
        <div className="text-center">
          <div className="text-4xl font-bold text-neon-pink">{score.player2}</div>
          <div className="text-xs text-gray-400">{isPlayer1 ? 'OPPONENT' : 'YOU'}</div>
        </div>
        {isMultiplayer && (
          <div className="text-sm text-green-400 animate-pulse">● LIVE</div>
        )}
        <div className="text-center">
          <div className="text-4xl font-bold text-neon-blue">{score.player1}</div>
          <div className="text-xs text-gray-400">{isPlayer1 ? 'YOU' : 'OPPONENT'}</div>
        </div>
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
