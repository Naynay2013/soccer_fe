"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import {
  Activity,
  Badge,
  Crown,
  Database,
  Gauge,
  Gamepad2,
  Goal,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Map,
  Mail,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
  Zap
} from "lucide-react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const length = (x, y) => Math.hypot(x, y) || 1;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const tokenStore = {
  access: "street-cup-access-token",
  refresh: "street-cup-refresh-token"
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }
  return data;
}

const newPlayer = (team, role, x, y, user = false) => ({
  team,
  role,
  x,
  y,
  homeX: x,
  homeY: y,
  vx: 0,
  vy: 0,
  radius: user ? 17 : 15,
  user,
  cooldown: 0
});

const controlledTeam = "gold";

function createGame(width, height) {
  return {
    width,
    height,
    score: { gold: 0, blue: 0 },
    seconds: 90,
    finished: false,
    status: "Kickoff",
    statusUntil: 0,
    activePlayerIndex: 0,
    ball: { x: width / 2, y: height / 2, vx: 0, vy: 0, radius: 9 },
    players: [
      newPlayer("gold", "Striker", width * 0.5, height * 0.66, true),
      newPlayer("gold", "Wing", width * 0.31, height * 0.72),
      newPlayer("gold", "Wing", width * 0.69, height * 0.72),
      newPlayer("gold", "Keeper", width * 0.5, height * 0.9),
      newPlayer("blue", "Striker", width * 0.5, height * 0.34),
      newPlayer("blue", "Wing", width * 0.31, height * 0.28),
      newPlayer("blue", "Wing", width * 0.69, height * 0.28),
      newPlayer("blue", "Keeper", width * 0.5, height * 0.1)
    ]
  };
}

function resetFormation(game, direction = 0) {
  const fresh = createGame(game.width, game.height);
  game.players = fresh.players;
  game.activePlayerIndex = fresh.activePlayerIndex;
  game.ball.x = game.width / 2;
  game.ball.y = game.height / 2;
  game.ball.vx = 0;
  game.ball.vy = direction * 230;
}

function activePlayer(game) {
  return game.players[game.activePlayerIndex] ?? game.players.find((player) => player.team === controlledTeam) ?? game.players[0];
}

function drawPitch(ctx, game) {
  const { width, height } = game;
  const stripeWidth = width / 12;

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#238150");
  base.addColorStop(0.45, "#17633f");
  base.addColorStop(1, "#0d432e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(52, 172, 102, .22)" : "rgba(3, 43, 30, .16)";
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
  }

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#d7ffe4";
  ctx.lineWidth = 1;
  for (let y = 34; y < height; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 2);
    ctx.lineTo(width, y + Math.cos(y) * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(246,255,249,.88)";
  ctx.lineWidth = Math.max(2, width * 0.0036);
  ctx.strokeRect(20, 20, width - 40, height - 40);
  ctx.beginPath();
  ctx.moveTo(width / 2, 20);
  ctx.lineTo(width / 2, height - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(246,255,249,.95)";
  ctx.fill();

  const boxWidth = width * 0.16;
  const boxHeight = height * 0.46;
  ctx.strokeRect(20, height / 2 - boxHeight / 2, boxWidth, boxHeight);
  ctx.strokeRect(width - 20 - boxWidth, height / 2 - boxHeight / 2, boxWidth, boxHeight);
  ctx.fillStyle = "rgba(245,255,247,.18)";
  ctx.fillRect(0, height * 0.36, 20, height * 0.28);
  ctx.fillRect(width - 20, height * 0.36, 20, height * 0.28);
  ctx.restore();

  const light = ctx.createRadialGradient(width / 2, height * 0.18, 20, width / 2, height * 0.18, width * 0.62);
  light.addColorStop(0, "rgba(255,255,255,.20)");
  light.addColorStop(0.5, "rgba(255,255,255,.03)");
  light.addColorStop(1, "rgba(0,0,0,.26)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
}

function drawPlayer(ctx, player) {
  const colors = {
    gold: { shirt: "#ffd34d", ink: "#2b2100" },
    blue: { shirt: "#5aa8ff", ink: "#061a31" }
  };
  const theme = colors[player.team];

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.beginPath();
  ctx.arc(2, 4, player.radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.26)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = theme.shirt;
  ctx.fill();
  ctx.lineWidth = player.user ? 4 : 2;
  ctx.strokeStyle = player.user ? "#ffffff" : "rgba(255,255,255,.54)";
  ctx.stroke();
  ctx.fillStyle = theme.ink;
  ctx.font = `900 ${Math.max(11, player.radius)}px Inter, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.role === "Keeper" ? "1" : player.user ? "9" : "7", 0, 1);
  ctx.restore();
}

function drawBall(ctx, ball) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.beginPath();
  ctx.arc(2, 4, ball.radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fbff";
  ctx.fill();
  ctx.strokeStyle = "#17211f";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(4, -5);
  ctx.lineTo(6, 1);
  ctx.lineTo(0, 6);
  ctx.lineTo(-6, 1);
  ctx.closePath();
  ctx.fillStyle = "#17211f";
  ctx.fill();
  ctx.restore();
}

function resolvePlayers(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = length(dx, dy);
  const overlap = a.radius + b.radius - distance;
  if (overlap <= 0) return;
  const nx = dx / distance;
  const ny = dy / distance;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
}

function collideBall(player, ball) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = length(dx, dy);
  const overlap = player.radius + ball.radius - distance;
  if (overlap <= 0) return;

  const nx = dx / distance;
  const ny = dy / distance;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  ball.vx += nx * 120 + player.vx * 0.82;
  ball.vy += ny * 120 + player.vy * 0.82;
}

function updateAi(game, player, dt, playerIndex = 0) {
  const attacking = player.team === "gold" ? -1 : 1;
  const ownGoal = player.team === "gold" ? game.height : 0;
  const targetGoal = player.team === "gold" ? 0 : game.height;
  const ball = game.ball;
  const active = activePlayer(game);
  const sameTeam = player.team === controlledTeam;
  const teamPlayers = game.players
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.team === player.team && candidate.role !== "Keeper");
  const closestToBall = teamPlayers
    .slice()
    .sort((a, b) => Math.hypot(a.candidate.x - ball.x, a.candidate.y - ball.y) - Math.hypot(b.candidate.x - ball.x, b.candidate.y - ball.y))[0];
  const isPresser = closestToBall?.index === playerIndex;
  const laneOffset = player.role === "Wing" ? (player.homeY < game.height / 2 ? -1 : 1) : 0;
  let tx = player.homeX;
  let ty = player.homeY;

  if (player.role === "Keeper") {
    tx = clamp(ball.x * 0.45 + game.width * 0.5 * 0.55, game.width * 0.34, game.width * 0.66);
    ty = ownGoal + attacking * 52;
  } else if (sameTeam) {
    const teamHasBall = Math.hypot(active.x - ball.x, active.y - ball.y) < 70;
    if (player.role === "Striker") {
      tx = clamp(game.width * 0.5 + Math.sin(performance.now() / 1600 + playerIndex) * 58, game.width * 0.25, game.width * 0.75);
      ty = clamp(Math.min(active.y, ball.y) + attacking * (teamHasBall ? 115 : 70), game.height * 0.16, game.height * 0.84);
    } else {
      tx = clamp(game.width * (laneOffset < 0 ? 0.25 : 0.75), game.width * 0.16, game.width * 0.84);
      ty = clamp(active.y + attacking * 74, game.height * 0.16, game.height * 0.84);
    }
  } else if (isPresser && Math.abs(ball.y - player.y) < game.height * 0.46) {
    tx = ball.x;
    ty = ball.y - attacking * 22;
  } else if (player.role === "Striker") {
    tx = clamp(game.width * 0.5, game.width * 0.28, game.width * 0.72);
    ty = clamp(ball.y - attacking * 95, game.height * 0.18, game.height * 0.82);
  } else {
    tx = clamp(player.homeX + Math.sin(performance.now() / 1800 + player.homeX) * 18, game.width * 0.2, game.width * 0.8);
    ty = clamp(player.homeY - attacking * 24, game.height * 0.18, game.height * 0.88);
  }

  const dx = tx - player.x;
  const dy = ty - player.y;
  const d = length(dx, dy);
  const urgency = isPresser && !sameTeam ? 1.12 : player.role === "Keeper" ? 0.72 : 0.86;
  player.vx += (dx / d) * 520 * urgency * dt;
  player.vy += (dy / d) * 520 * urgency * dt;

  const maxSpeed = player.role === "Keeper" ? 150 : isPresser && !sameTeam ? 205 : 172;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }

  const close = Math.hypot(ball.x - player.x, ball.y - player.y) < player.radius + ball.radius + 8;
  if (close && player.cooldown <= 0 && (isPresser || sameTeam)) {
    const gx = game.width * 0.5 - player.x;
    const gy = targetGoal - player.y;
    const gd = length(gx, gy);
    ball.vx += (gx / gd) * 285;
    ball.vy += (gy / gd) * 285 + (Math.random() - 0.5) * 90;
    player.cooldown = 0.55;
  }
}

function SoccerCanvas({ running, setRunning, onScore, onTime, onStatus, resetToken, actionCommand, gameStateRef }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef(new Set());
  const pointerRef = useRef({ active: false, x: 0, y: 0 });
  const runningRef = useRef(running);
  const sprintBoostRef = useRef(0);
  const actionHandlerRef = useRef(null);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (!actionCommand || !actionHandlerRef.current) return;
    actionHandlerRef.current(actionCommand.action);
  }, [actionCommand]);

  useEffect(() => {
    if (!gameRef.current) return;
    const fresh = createGame(gameRef.current.width, gameRef.current.height);
    gameRef.current = fresh;
    onScore(fresh.score);
    onTime(fresh.seconds);
    onStatus("Kickoff");
    setRunning(false);
  }, [resetToken, onScore, onStatus, onTime, setRunning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(360, Math.floor(rect.width * dpr));
      canvas.height = Math.max(240, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!gameRef.current) {
        gameRef.current = createGame(rect.width, rect.height);
      } else {
        const game = gameRef.current;
        const sx = rect.width / game.width;
        const sy = rect.height / game.height;
        game.width = rect.width;
        game.height = rect.height;
        game.ball.x *= sx;
        game.ball.y *= sy;
        game.players.forEach((player) => {
          player.x *= sx;
          player.y *= sy;
          player.homeX *= sx;
          player.homeY *= sy;
        });
      }
    };

    const publishGameState = () => {
      const game = gameRef.current;
      if (!gameStateRef || !game) return;
      gameStateRef.current = {
        width: game.width,
        height: game.height,
        activePlayerIndex: game.activePlayerIndex,
        ball: { ...game.ball },
        players: game.players.map((player, index) => ({
          team: player.team,
          role: player.role,
          x: player.x,
          y: player.y,
          vx: player.vx,
          vy: player.vy,
          user: index === game.activePlayerIndex,
          active: index === game.activePlayerIndex
        }))
      };
    };

    const getUserAndBall = () => {
      const game = gameRef.current;
      return { game, player: activePlayer(game), ball: game.ball };
    };

    const switchPlayer = () => {
      const game = gameRef.current;
      if (!game) return;
      const current = activePlayer(game);
      const candidates = game.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => player.team === controlledTeam);
      const next = candidates
        .filter(({ index }) => index !== game.activePlayerIndex)
        .sort((a, b) => Math.hypot(a.player.x - game.ball.x, a.player.y - game.ball.y) - Math.hypot(b.player.x - game.ball.x, b.player.y - game.ball.y))[0];
      if (next) {
        current.user = false;
        next.player.user = true;
        game.activePlayerIndex = next.index;
        onStatus(`Controlling ${next.player.role}`);
      }
    };

    const shoot = () => {
      const { game, player, ball } = getUserAndBall();
      if (!player) return;
      const pointer = pointerRef.current;
      const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (distance > player.radius + ball.radius + 28 || player.cooldown > 0) return;
      const aimX = pointer.active ? pointer.x : game.width / 2;
      const aimY = pointer.active ? pointer.y : player.team === "gold" ? 0 : game.height;
      const dx = aimX - ball.x;
      const dy = aimY - ball.y;
      const d = length(dx, dy);
      ball.vx = (dx / d) * 650;
      ball.vy = (dy / d) * 650;
      player.cooldown = 0.42;
      onStatus("Shot taken");
    };

    const pass = () => {
      const { game, player, ball } = getUserAndBall();
      if (!player) return;
      const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (distance > player.radius + ball.radius + 34 || player.cooldown > 0) return;
      const teammate = game.players
        .filter((candidate) => candidate.team === player.team && !candidate.user)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
      const targetX = teammate?.x ?? game.width * 0.58;
      const targetY = teammate?.y ?? game.height * 0.5;
      const dx = targetX - ball.x;
      const dy = targetY - ball.y;
      const d = length(dx, dy);
      ball.vx = (dx / d) * 470;
      ball.vy = (dy / d) * 470;
      player.cooldown = 0.28;
      onStatus("Pass played");
    };

    const dribble = () => {
      const { game, player, ball } = getUserAndBall();
      if (!player) return;
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > player.radius + ball.radius + 38 || player.cooldown > 0) return;
      const keys = keysRef.current;
      let ix = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      let iy = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
      if (!ix && !iy) ix = 1;
      const d = length(ix, iy);
      player.vx += (ix / d) * 260;
      player.vy += (iy / d) * 260;
      ball.vx = (ix / d) * 240;
      ball.vy = (iy / d) * 240;
      player.cooldown = 0.24;
      onStatus("Close dribble");
    };

    const sprint = () => {
      sprintBoostRef.current = performance.now() + 900;
      onStatus("Sprint boost");
    };

    const move = () => {
      const { player } = getUserAndBall();
      if (!player) return;
      player.vx += 120;
      onStatus("Move with WASD or arrows");
    };

    const keeperDive = (side = 1) => {
      const { player, ball } = getUserAndBall();
      if (!player || player.role !== "Keeper" || player.cooldown > 0) return;
      player.vx += side * 360;
      player.vy += player.team === "gold" ? -120 : 120;
      player.cooldown = 0.55;
      if (Math.hypot(ball.x - player.x, ball.y - player.y) < player.radius + ball.radius + 58) {
        ball.vx += side * 260;
        ball.vy += player.team === "gold" ? -180 : 180;
      }
      onStatus(side < 0 ? "Keeper dive left" : "Keeper dive right");
    };

    const keeperRush = () => {
      const { player, ball } = getUserAndBall();
      if (!player || player.role !== "Keeper") return;
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const d = length(dx, dy);
      player.vx += (dx / d) * 300;
      player.vy += (dy / d) * 300;
      onStatus("Keeper rush");
    };

    const keeperClear = () => {
      const { game, player, ball } = getUserAndBall();
      if (!player || player.role !== "Keeper" || player.cooldown > 0) return;
      if (Math.hypot(ball.x - player.x, ball.y - player.y) > player.radius + ball.radius + 42) return;
      const direction = player.team === "gold" ? -1 : 1;
      ball.vx = (game.width * 0.5 - ball.x) * 2.4;
      ball.vy = direction * 640;
      player.cooldown = 0.5;
      onStatus("Keeper clearance");
    };

    const executeAction = (action) => {
      if (!runningRef.current) setRunning(true);
      if (action === "shoot") shoot();
      if (action === "pass") pass();
      if (action === "dribble") dribble();
      if (action === "sprint") sprint();
      if (action === "move") move();
      if (action === "switch") switchPlayer();
      if (action === "keeperDiveLeft") keeperDive(-1);
      if (action === "keeperDiveRight") keeperDive(1);
      if (action === "keeperRush") keeperRush();
      if (action === "keeperClear") keeperClear();
    };
    actionHandlerRef.current = executeAction;

    const shootLegacy = () => {
      const game = gameRef.current;
      const player = game.players.find((candidate) => candidate.user);
      const ball = game.ball;
      const pointer = pointerRef.current;
      const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (distance > player.radius + ball.radius + 28 || player.cooldown > 0) return;
      const aimX = pointer.active ? pointer.x : game.width / 2;
      const aimY = pointer.active ? pointer.y : player.team === "gold" ? 0 : game.height;
      const dx = aimX - ball.x;
      const dy = aimY - ball.y;
      const d = length(dx, dy);
      ball.vx = (dx / d) * 650;
      ball.vy = (dy / d) * 650;
      player.cooldown = 0.42;
    };

    const update = (dt) => {
      const game = gameRef.current;
      if (!runningRef.current || game.finished) return;

      game.seconds -= dt;
      if (game.seconds <= 0) {
        game.seconds = 0;
        game.finished = true;
        runningRef.current = false;
        setRunning(false);
        onStatus(game.score.gold === game.score.blue ? "Full time draw" : game.score.gold > game.score.blue ? "Yellow FC wins" : "Blue United wins");
      }

      const user = activePlayer(game);
      const keys = keysRef.current;
      let ix = 0;
      let iy = 0;
      if (keys.has("arrowleft") || keys.has("a")) ix -= 1;
      if (keys.has("arrowright") || keys.has("d")) ix += 1;
      if (keys.has("arrowup") || keys.has("w")) iy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) iy += 1;

      const pointer = pointerRef.current;
      if (pointer.active) {
        const dx = pointer.x - user.x;
        const dy = pointer.y - user.y;
        const d = Math.hypot(dx, dy);
        if (d > 12) {
          ix += dx / d;
          iy += dy / d;
        }
      }

      if (ix || iy) {
        const d = length(ix, iy);
        const sprint = keys.has("shift") || performance.now() < sprintBoostRef.current ? 1.45 : 1;
        user.vx += (ix / d) * 690 * sprint * dt;
        user.vy += (iy / d) * 690 * sprint * dt;
      }

      for (const [index, player] of game.players.entries()) {
        const isActive = player === user;
        if (!isActive) updateAi(game, player, dt, index);
        const boosting = isActive && (keys.has("shift") || performance.now() < sprintBoostRef.current);
        const maxSpeed = boosting ? 310 : isActive ? 220 : 190;
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > maxSpeed) {
          player.vx = (player.vx / speed) * maxSpeed;
          player.vy = (player.vy / speed) * maxSpeed;
        }
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.vx *= Math.pow(0.055, dt);
        player.vy *= Math.pow(0.055, dt);
        player.cooldown = Math.max(0, player.cooldown - dt);
        player.x = clamp(player.x, player.radius + 6, game.width - player.radius - 6);
        player.y = clamp(player.y, player.radius + 6, game.height - player.radius - 6);
      }

      for (let i = 0; i < game.players.length; i += 1) {
        for (let j = i + 1; j < game.players.length; j += 1) {
          resolvePlayers(game.players[i], game.players[j]);
        }
      }

      game.ball.x += game.ball.vx * dt;
      game.ball.y += game.ball.vy * dt;
      game.ball.vx *= Math.pow(0.22, dt);
      game.ball.vy *= Math.pow(0.22, dt);
      game.players.forEach((player) => collideBall(player, game.ball));

      const goalLeft = game.width * 0.39;
      const goalRight = game.width * 0.61;
      const inGoalMouth = game.ball.x > goalLeft && game.ball.x < goalRight;
      if (game.ball.y < -game.ball.radius && inGoalMouth) {
        game.score.gold += 1;
        game.status = "Goal: Yellow FC";
        game.statusUntil = performance.now() + 1600;
        resetFormation(game, 1);
        onScore({ ...game.score });
      } else if (game.ball.y > game.height + game.ball.radius && inGoalMouth) {
        game.score.blue += 1;
        game.status = "Goal: Blue United";
        game.statusUntil = performance.now() + 1600;
        resetFormation(game, -1);
        onScore({ ...game.score });
      } else {
        if (game.ball.x < game.ball.radius || game.ball.x > game.width - game.ball.radius) {
          game.ball.x = clamp(game.ball.x, game.ball.radius, game.width - game.ball.radius);
          game.ball.vx *= -0.74;
        }
        if ((game.ball.y < game.ball.radius || game.ball.y > game.height - game.ball.radius) && !inGoalMouth) {
          game.ball.y = clamp(game.ball.y, game.ball.radius, game.height - game.ball.radius);
          game.ball.vy *= -0.74;
        }
      }

      onTime(game.seconds);
      if (performance.now() < game.statusUntil) onStatus(game.status);
    };

    const render = (now) => {
      const game = gameRef.current;
      const dt = Math.min(0.033, (now - last) / 1000 || 0);
      last = now;
      update(dt);
      publishGameState();
      ctx.clearRect(0, 0, game.width, game.height);
      frame = requestAnimationFrame(render);
    };

    const keyDown = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return;
      keysRef.current.add(event.key.toLowerCase());
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
      if (event.code === "Space") {
        if (!runningRef.current) setRunning(true);
        shoot();
      }
      if (event.key.toLowerCase() === "f") {
        if (!runningRef.current) setRunning(true);
        pass();
      }
      if (event.key.toLowerCase() === "e") {
        if (!runningRef.current) setRunning(true);
        dribble();
      }
      if (event.key.toLowerCase() === "q" || event.key.toLowerCase() === "tab") {
        event.preventDefault();
        if (!runningRef.current) setRunning(true);
        switchPlayer();
      }
      if (event.key.toLowerCase() === "z") keeperDive(-1);
      if (event.key.toLowerCase() === "c") keeperDive(1);
      if (event.key.toLowerCase() === "r") keeperRush();
      if (event.key.toLowerCase() === "x") keeperClear();
    };
    const keyUp = (event) => keysRef.current.delete(event.key.toLowerCase());
    const setPointer = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
    };
    const pointerDown = (event) => {
      pointerRef.current.active = true;
      setPointer(event);
      setRunning(true);
    };
    const pointerUp = () => {
      shootLegacy();
      pointerRef.current.active = false;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", setPointer);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    frame = requestAnimationFrame(render);

    return () => {
      actionHandlerRef.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", setPointer);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [gameStateRef, onScore, onStatus, onTime, setRunning]);

  return <canvas ref={canvasRef} className="match-canvas" aria-label="Playable soccer match" />;
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamCrest({ tone, code }) {
  return (
    <span className={`team-crest ${tone}`} aria-hidden="true">
      <Badge size={28} />
      <b>{code}</b>
    </span>
  );
}

function Meter({ label, value, tone = "mint" }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i style={{ "--value": `${value}%` }} className={tone} />
    </div>
  );
}

function Radar({ score }) {
  const dots = [
    ["gold", 31, 50],
    ["gold", 22, 28],
    ["gold", 22, 72],
    ["gold", 8, 50],
    ["blue", 69, 50],
    ["blue", 78, 28],
    ["blue", 78, 72],
    ["blue", 92, 50],
    ["ball", 50 + (score.gold - score.blue) * 4, 50]
  ];

  return (
    <div className="radar" aria-label="Tactical radar">
      <div className="radar-field">
        {dots.map(([team, x, y], index) => (
          <span key={`${team}-${index}`} className={`radar-dot ${team}`} style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </div>
    </div>
  );
}

function createNumberTexture(number, shirt, ink = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = shirt;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = ink;
  ctx.font = "900 58px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seededNoise(seed, index) {
  return Math.sin(seed * 37.17 + index * 91.91) * 0.5 + 0.5;
}

function createSkinTexture(baseHex, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const base = new THREE.Color(baseHex);
  const highlight = base.clone().lerp(new THREE.Color("#ffd0aa"), 0.22);
  const shadow = base.clone().lerp(new THREE.Color("#311713"), 0.28);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);

  const glow = ctx.createRadialGradient(116, 86, 8, 116, 86, 132);
  glow.addColorStop(0, `rgba(${Math.floor(highlight.r * 255)}, ${Math.floor(highlight.g * 255)}, ${Math.floor(highlight.b * 255)}, 0.34)`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 220; i += 1) {
    const x = seededNoise(seed, i) * 256;
    const y = seededNoise(seed + 5, i) * 256;
    const alpha = 0.018 + seededNoise(seed + 11, i) * 0.035;
    ctx.fillStyle = seededNoise(seed + 19, i) > 0.5
      ? `rgba(255,230,210,${alpha})`
      : `rgba(${Math.floor(shadow.r * 255)}, ${Math.floor(shadow.g * 255)}, ${Math.floor(shadow.b * 255)}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + seededNoise(seed + 23, i) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `rgba(${Math.floor(shadow.r * 255)}, ${Math.floor(shadow.g * 255)}, ${Math.floor(shadow.b * 255)}, 0.22)`;
  ctx.fillRect(0, 188, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function colorToRgb(color) {
  return `${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}`;
}

function createFaceTexture(baseHex, hairHex, irisHex, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  const skin = new THREE.Color(baseHex);
  const hair = new THREE.Color(hairHex);
  const iris = new THREE.Color(irisHex);
  const light = skin.clone().lerp(new THREE.Color("#ffd3b5"), 0.28);
  const warm = skin.clone().lerp(new THREE.Color("#dc806b"), 0.18);
  const shadow = skin.clone().lerp(new THREE.Color("#1c0e0d"), 0.36);
  const lip = skin.clone().lerp(new THREE.Color("#70313b"), 0.42);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(256, 368, 178, 276, 0, 0, Math.PI * 2);
  ctx.clip();

  const baseGlow = ctx.createRadialGradient(222, 232, 18, 252, 360, 330);
  baseGlow.addColorStop(0, `rgb(${colorToRgb(light)})`);
  baseGlow.addColorStop(0.58, `rgb(${colorToRgb(skin)})`);
  baseGlow.addColorStop(1, `rgb(${colorToRgb(shadow)})`);
  ctx.fillStyle = baseGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 850; i += 1) {
    const x = 84 + seededNoise(seed + 3, i) * 344;
    const y = 96 + seededNoise(seed + 7, i) * 548;
    const tone = seededNoise(seed + 19, i) > 0.5 ? light : shadow;
    ctx.fillStyle = `rgba(${colorToRgb(tone)}, ${0.018 + seededNoise(seed + 31, i) * 0.032})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + seededNoise(seed + 43, i) * 1.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.28)`;
  ctx.beginPath();
  ctx.ellipse(256, 92, 188, 70, 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = `rgba(${colorToRgb(warm)}, 0.23)`;
  ctx.beginPath();
  ctx.ellipse(164, 378, 62, 32, -0.12, 0, Math.PI * 2);
  ctx.ellipse(348, 378, 62, 32, 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${colorToRgb(shadow)}, 0.3)`;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(256, 246);
  ctx.bezierCurveTo(246, 310, 238, 350, 250, 408);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${colorToRgb(light)}, 0.22)`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(268, 252);
  ctx.bezierCurveTo(278, 318, 280, 356, 270, 408);
  ctx.stroke();

  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.34)`;
  ctx.beginPath();
  ctx.ellipse(222, 414, 12, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(290, 414, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  [-1, 1].forEach((side) => {
    const eyeX = 256 + side * 67;
    ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.34)`;
    ctx.beginPath();
    ctx.ellipse(eyeX, 302, 54, 24, side * -0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 248, 238, 0.96)";
    ctx.beginPath();
    ctx.ellipse(eyeX, 300, 36, 13, side * -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${colorToRgb(iris)})`;
    ctx.beginPath();
    ctx.arc(eyeX + side * 2, 300, 10.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(8, 8, 10, 0.95)";
    ctx.beginPath();
    ctx.arc(eyeX + side * 2, 300, 4.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(eyeX - 3, 295, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${colorToRgb(hair)}, 0.9)`;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(eyeX - side * 45, 252 + side * 2);
    ctx.quadraticCurveTo(eyeX, 236, eyeX + side * 46, 252 - side * 3);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${colorToRgb(shadow)}, 0.28)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(eyeX - side * 42, 320);
    ctx.quadraticCurveTo(eyeX, 330, eyeX + side * 42, 318);
    ctx.stroke();
  });

  ctx.fillStyle = `rgba(${colorToRgb(lip)}, 0.82)`;
  ctx.beginPath();
  ctx.ellipse(256, 500, 54, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.58)`;
  ctx.fillRect(210, 496, 92, 4);
  ctx.fillStyle = `rgba(${colorToRgb(lip.clone().lerp(new THREE.Color("#f3a08f"), 0.22))}, 0.7)`;
  ctx.beginPath();
  ctx.ellipse(256, 514, 42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (seed % 3 === 0 || seed % 5 === 0) {
    const beardGradient = ctx.createLinearGradient(256, 420, 256, 626);
    beardGradient.addColorStop(0, `rgba(${colorToRgb(hair)}, 0.05)`);
    beardGradient.addColorStop(0.45, `rgba(${colorToRgb(hair)}, 0.22)`);
    beardGradient.addColorStop(1, `rgba(${colorToRgb(hair)}, 0.34)`);
    ctx.fillStyle = beardGradient;
    ctx.beginPath();
    ctx.ellipse(256, 536, 128, 116, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${colorToRgb(hair)}, 0.34)`;
    ctx.fillRect(216, 452, 80, 12);
  }

  ctx.restore();

  ctx.strokeStyle = `rgba(${colorToRgb(hair)}, 0.9)`;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(106, 190);
  ctx.quadraticCurveTo(256, 70, 406, 190);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHeadTexture(baseHex, hairHex, irisHex, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const skin = new THREE.Color(baseHex);
  const hair = new THREE.Color(hairHex);
  const iris = new THREE.Color(irisHex);
  const light = skin.clone().lerp(new THREE.Color("#ffd4b8"), 0.24);
  const warm = skin.clone().lerp(new THREE.Color("#da806b"), 0.16);
  const shadow = skin.clone().lerp(new THREE.Color("#190b0a"), 0.34);
  const lip = skin.clone().lerp(new THREE.Color("#71313c"), 0.42);

  const baseGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  baseGradient.addColorStop(0, `rgb(${colorToRgb(shadow)})`);
  baseGradient.addColorStop(0.28, `rgb(${colorToRgb(skin)})`);
  baseGradient.addColorStop(0.5, `rgb(${colorToRgb(light)})`);
  baseGradient.addColorStop(0.72, `rgb(${colorToRgb(skin)})`);
  baseGradient.addColorStop(1, `rgb(${colorToRgb(shadow)})`);
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const faceX = 512;
  const faceGlow = ctx.createRadialGradient(faceX - 42, 212, 16, faceX, 260, 250);
  faceGlow.addColorStop(0, `rgba(${colorToRgb(light)}, 0.5)`);
  faceGlow.addColorStop(0.62, `rgba(${colorToRgb(skin)}, 0.22)`);
  faceGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = faceGlow;
  ctx.fillRect(278, 26, 468, 430);

  for (let i = 0; i < 1300; i += 1) {
    const x = seededNoise(seed + 101, i) * canvas.width;
    const y = 44 + seededNoise(seed + 117, i) * 386;
    const tone = seededNoise(seed + 131, i) > 0.48 ? light : shadow;
    ctx.fillStyle = `rgba(${colorToRgb(tone)}, ${0.012 + seededNoise(seed + 139, i) * 0.028})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.45 + seededNoise(seed + 149, i) * 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = `rgba(${colorToRgb(hair)}, 0.86)`;
  ctx.beginPath();
  ctx.ellipse(512, 62, 230, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${colorToRgb(hair)}, 0.72)`;
  ctx.fillRect(0, 0, 210, 188);
  ctx.fillRect(814, 0, 210, 188);
  ctx.fillStyle = `rgba(${colorToRgb(hair)}, 0.36)`;
  ctx.beginPath();
  ctx.ellipse(512, 118, 198, 48, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.22)`;
  ctx.beginPath();
  ctx.ellipse(324, 244, 68, 130, -0.2, 0, Math.PI * 2);
  ctx.ellipse(700, 244, 68, 130, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(${colorToRgb(warm)}, 0.2)`;
  ctx.beginPath();
  ctx.ellipse(420, 288, 58, 28, -0.1, 0, Math.PI * 2);
  ctx.ellipse(604, 288, 58, 28, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${colorToRgb(shadow)}, 0.3)`;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(512, 188);
  ctx.bezierCurveTo(502, 246, 494, 286, 506, 326);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${colorToRgb(light)}, 0.22)`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(524, 192);
  ctx.bezierCurveTo(534, 246, 534, 282, 522, 326);
  ctx.stroke();

  [-1, 1].forEach((side) => {
    const eyeX = faceX + side * 70;
    ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.34)`;
    ctx.beginPath();
    ctx.ellipse(eyeX, 240, 52, 22, side * -0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 248, 239, 0.96)";
    ctx.beginPath();
    ctx.ellipse(eyeX, 239, 35, 12, side * -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${colorToRgb(iris)})`;
    ctx.beginPath();
    ctx.arc(eyeX + side * 2, 239, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(8,8,10,0.96)";
    ctx.beginPath();
    ctx.arc(eyeX + side * 2, 239, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(eyeX - 4, 235, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${colorToRgb(hair)}, 0.9)`;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(eyeX - side * 46, 196 + side * 2);
    ctx.quadraticCurveTo(eyeX, 180, eyeX + side * 47, 196 - side * 3);
    ctx.stroke();
  });

  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.34)`;
  ctx.beginPath();
  ctx.ellipse(478, 332, 12, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(546, 332, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(${colorToRgb(lip)}, 0.84)`;
  ctx.beginPath();
  ctx.ellipse(512, 390, 56, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.58)`;
  ctx.fillRect(464, 386, 96, 4);

  const beard = seed % 3 === 0 || seed % 5 === 0;
  if (beard) {
    const beardGradient = ctx.createLinearGradient(512, 330, 512, 486);
    beardGradient.addColorStop(0, `rgba(${colorToRgb(hair)}, 0.04)`);
    beardGradient.addColorStop(0.5, `rgba(${colorToRgb(hair)}, 0.22)`);
    beardGradient.addColorStop(1, `rgba(${colorToRgb(hair)}, 0.32)`);
    ctx.fillStyle = beardGradient;
    ctx.beginPath();
    ctx.ellipse(512, 418, 126, 86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${colorToRgb(hair)}, 0.3)`;
    ctx.fillRect(472, 354, 80, 10);
  }

  ctx.fillStyle = `rgba(${colorToRgb(shadow)}, 0.18)`;
  ctx.fillRect(0, 390, 1024, 122);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createKitBodyTexture(primaryHex, trimHex, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const primary = new THREE.Color(primaryHex);
  const trim = new THREE.Color(trimHex);
  const dark = primary.clone().lerp(new THREE.Color("#020807"), 0.46);
  const light = primary.clone().lerp(new THREE.Color("#f3fff4"), 0.24);
  const side = primary.clone().lerp(trim, 0.2);

  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, `rgb(${colorToRgb(light)})`);
  gradient.addColorStop(0.52, `rgb(${colorToRgb(primary)})`);
  gradient.addColorStop(1, `rgb(${colorToRgb(dark)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = `rgba(${colorToRgb(trim)}, 0.28)`;
  ctx.lineWidth = 5;
  for (let i = 0; i < 10; i += 1) {
    const x = 52 + i * 45 + seededNoise(seed, i) * 8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x - 20, 130, x + 18, 292, x - 12, 512);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(${colorToRgb(side)}, 0.38)`;
  ctx.beginPath();
  ctx.ellipse(86, 246, 52, 188, -0.04, 0, Math.PI * 2);
  ctx.ellipse(426, 246, 52, 188, 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(${colorToRgb(dark)}, 0.23)`;
  ctx.beginPath();
  ctx.ellipse(256, 348, 92, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 260; i += 1) {
    const x = seededNoise(seed + 13, i) * 512;
    const y = seededNoise(seed + 29, i) * 512;
    ctx.fillStyle = `rgba(255,255,255,${0.018 + seededNoise(seed + 41, i) * 0.025})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeHumanPlayer(player, jersey, x, z, index = 0) {
  const group = new THREE.Group();
  const profileSeed = (player.jerseyNumber ?? index + 7) + index * 3;
  const shirt = jersey?.primaryHex ?? (player.team === "GOLD" ? "#ffd447" : "#58a8ff");
  const trim = jersey?.trimHex ?? "#ffffff";
  const accent = jersey?.accentHex ?? "#111111";
  const skinPalette = ["#7b4b33", "#9d6747", "#c4875d", "#e0ad78", "#5d3829", "#b87455", "#d7a06b", "#8f563d"];
  const hairPalette = ["#16100c", "#3a2418", "#6b3f22", "#201713", "#0d0d0e", "#7a4b2b"];
  const skin = player.skinTone ?? skinPalette[profileSeed % skinPalette.length];
  const buildScale = 0.96 + (profileSeed % 5) * 0.018;
  const shoulderWidth = 1.05 + (profileSeed % 4) * 0.045;
  const torsoHeight = 1.18 + (profileSeed % 3) * 0.035;
  const legLength = 1.58 + (profileSeed % 4) * 0.04;
  const skinColor = new THREE.Color(skin);
  const hairColor = new THREE.Color(hairPalette[profileSeed % hairPalette.length]);
  const irisHex = ["#2f4b5f", "#3b2a1f", "#1f513d", "#5a3a1e"][profileSeed % 4];
  const lipColor = skinColor.clone().lerp(new THREE.Color("#6f3038"), 0.34);
  const cheekColor = skinColor.clone().lerp(new THREE.Color("#e7a287"), 0.16);
  const shadowSkin = skinColor.clone().lerp(new THREE.Color("#2d1715"), 0.22);
  const skinTexture = createSkinTexture(skin, profileSeed);
  const faceTexture = createFaceTexture(skin, `#${hairColor.getHexString()}`, irisHex, profileSeed);
  const headTexture = createHeadTexture(skin, `#${hairColor.getHexString()}`, irisHex, profileSeed);
  const kitTexture = createKitBodyTexture(shirt, trim, profileSeed);
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", map: kitTexture, roughness: 0.42, metalness: 0.02 });
  const shortsMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.58, metalness: 0.02 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.46 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", map: skinTexture, roughness: 0.48, metalness: 0.015 });
  const muscleSkinMaterial = new THREE.MeshStandardMaterial({ color: skinColor.clone().lerp(new THREE.Color("#ffffff"), 0.08), map: skinTexture, roughness: 0.5, metalness: 0.01 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", map: headTexture, roughness: 0.48, metalness: 0.012 });
  const shadowSkinMaterial = new THREE.MeshStandardMaterial({ color: shadowSkin, roughness: 0.64 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.88 });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.38, metalness: 0.02 });
  const bootMaterial = new THREE.MeshStandardMaterial({ color: profileSeed % 2 ? "#10151b" : "#f5f7ef", roughness: 0.42, metalness: 0.08 });
  const laceMaterial = new THREE.MeshBasicMaterial({ color: profileSeed % 2 ? "#f5f7ef" : "#10151b" });
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    transparent: true,
    roughness: 0.5,
    metalness: 0.01,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const torso = new THREE.Group();
  torso.position.y = 4.86;
  group.add(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.82, 34, 22), shirtMaterial);
  chest.position.y = 0.58;
  chest.scale.set(shoulderWidth * buildScale, torsoHeight * 0.72, 0.42);
  torso.add(chest);

  const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 18), shirtMaterial);
  ribs.position.y = -0.08;
  ribs.scale.set(0.92 * buildScale, 0.88, 0.36);
  torso.add(ribs);

  const waist = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), shirtMaterial);
  waist.position.y = -0.7;
  waist.scale.set(0.88 * buildScale, 0.54, 0.34);
  torso.add(waist);

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16), shirtMaterial);
  abdomen.position.set(0, -0.48, 0.27);
  abdomen.scale.set(1.05 * buildScale, 0.92, 0.24);
  torso.add(abdomen);

  const backMass = new THREE.Mesh(new THREE.SphereGeometry(0.66, 28, 18), shirtMaterial);
  backMass.position.set(0, 0.18, -0.28);
  backMass.scale.set(1.02 * buildScale, 1.04, 0.36);
  torso.add(backMass);

  const spineLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 1.5, 8, 10), seamMaterial);
  spineLine.position.set(0, 0.02, -0.58);
  torso.add(spineLine);

  [-1, 1].forEach((side) => {
    const lat = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12), shirtMaterial);
    lat.position.set(side * 0.52 * buildScale, 0.12, -0.23);
    lat.scale.set(0.72, 1.36, 0.52);
    torso.add(lat);

    const scapula = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), seamMaterial);
    scapula.position.set(side * 0.33, 0.48, -0.55);
    scapula.scale.set(1.25, 0.42, 0.16);
    scapula.rotation.z = side * 0.28;
    torso.add(scapula);
  });

  const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.18, 0.03), seamMaterial);
  sternum.position.set(0, 0.18, 0.38);
  torso.add(sternum);

  const clavicle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.035), seamMaterial);
  clavicle.position.set(0, 0.96, 0.37);
  torso.add(clavicle);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.05), trimMaterial);
  chestStripe.position.set(0, 0.5, 0.41);
  torso.add(chestStripe);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.034, 8, 30), seamMaterial);
  collar.position.set(0, 1.24, 0.28);
  collar.scale.set(1.18, 0.58, 0.42);
  collar.rotation.x = Math.PI / 2;
  torso.add(collar);

  [-1, 1].forEach((side) => {
    const shoulder = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 8, 14), shirtMaterial);
    shoulder.position.set(side * 0.72 * shoulderWidth * buildScale, 0.86, 0.0);
    shoulder.rotation.z = side * 1.5;
    shoulder.scale.z = 0.72;
    torso.add(shoulder);

    const sidePanel = new THREE.BoxGeometry(0.055, 1.36, 0.045);
    const sidePanelMesh = new THREE.Mesh(sidePanel, seamMaterial);
    sidePanelMesh.position.set(side * 0.5 * buildScale, -0.08, 0.36);
    sidePanelMesh.rotation.z = side * 0.1;
    torso.add(sidePanelMesh);
  });

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), shortsMaterial);
  pelvis.position.y = 2.84;
  pelvis.scale.set(1.06 * buildScale, 0.48, 0.56);
  group.add(pelvis);

  const gluteBridge = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 14), shortsMaterial);
  gluteBridge.position.set(0, 2.72, -0.32);
  gluteBridge.scale.set(1.24 * buildScale, 0.44, 0.38);
  group.add(gluteBridge);

  const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.52, 0.54), shortsMaterial);
  shorts.position.y = 2.56;
  group.add(shorts);

  [-1, 1].forEach((side) => {
    const shortLeg = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.46), shortsMaterial);
    shortLeg.position.set(side * 0.28, 2.26, 0.01);
    shortLeg.rotation.z = side * 0.05;
    group.add(shortLeg);

    const glute = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), shortsMaterial);
    glute.position.set(side * 0.32, 2.62, -0.42);
    glute.scale.set(1.08, 0.78, 0.72);
    group.add(glute);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 18), headMaterial);
  neck.position.y = 6.46;
  neck.scale.z = 0.86;
  group.add(neck);

  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: createNumberTexture(player.jerseyNumber, shirt, trim), transparent: true })
  );
  number.position.set(0, 5.02, 0.48);
  number.scale.set(0.72, 0.72, 0.72);
  group.add(number);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 36), headMaterial);
  head.position.y = 7.18;
  head.scale.set(0.74 + (profileSeed % 3) * 0.035, 1.08 + (profileSeed % 4) * 0.03, 0.68);
  group.add(head);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.08, 10, 14), faceMaterial);
  face.position.set(0, 7.12, 0.372);
  face.scale.set(1 + (profileSeed % 3) * 0.025, 1, 1);
  group.add(face);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), headMaterial);
  jaw.position.set(0, 6.91, 0.1);
  jaw.scale.set(0.84, 0.42, 0.66);
  group.add(jaw);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), headMaterial);
  chin.position.set(0, 6.72, 0.34);
  chin.scale.set(1.25, 0.5, 0.6);
  group.add(chin);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMaterial);
  hair.position.set(0, 7.58, -0.04);
  hair.scale.set(0.92, 0.58, 0.82);
  group.add(hair);

  const rearHair = new THREE.Mesh(new THREE.SphereGeometry(0.43, 28, 16), hairMaterial);
  rearHair.position.set(0, 7.36, -0.31);
  rearHair.scale.set(0.92, 0.72, 0.42);
  group.add(rearHair);

  const nape = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), hairMaterial);
  nape.position.set(0, 7.02, -0.28);
  nape.scale.set(1.1, 0.5, 0.32);
  group.add(nape);

  [-1, 1].forEach((side) => {
    const fade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.14), hairMaterial);
    fade.position.set(side * 0.38, 7.36, -0.08);
    fade.rotation.z = side * 0.12;
    group.add(fade);

    const temple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), shadowSkinMaterial);
    temple.position.set(side * 0.36, 7.26, 0.22);
    temple.scale.set(0.55, 1.2, 0.5);
    group.add(temple);
  });

  const hairStyle = profileSeed % 4;
  if (hairStyle === 0 || hairStyle === 2) {
    for (let row = 0; row < 3; row += 1) {
      for (let col = -3; col <= 3; col += 1) {
        if (Math.abs(col) === 3 && row === 2) continue;
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.078 + row * 0.01, 10, 8), hairMaterial);
        curl.position.set(col * 0.105, 7.7 + row * 0.07 - Math.abs(col) * 0.01, 0.07 - row * 0.1);
        curl.scale.set(1.0, 0.72, 0.85);
        group.add(curl);
      }
    }
  } else if (hairStyle === 1) {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), hairMaterial);
    bun.position.set(0, 7.54, -0.54);
    group.add(bun);
  } else {
    const crop = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.45), hairMaterial);
    crop.position.set(0, 7.68, 0.03);
    crop.rotation.x = -0.12;
    group.add(crop);
  }

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), headMaterial);
    ear.position.set(side * 0.41, 7.18, 0.01);
    ear.scale.set(0.72, 1.18, 0.5);
    group.add(ear);

    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), shadowSkinMaterial);
    innerEar.position.set(side * 0.422, 7.16, 0.04);
    innerEar.scale.set(0.42, 0.85, 0.28);
    group.add(innerEar);
  });

  const rig = { arms: [], legs: [], torso, head };
  [-1, 1].forEach((side) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.82 * shoulderWidth * buildScale, 5.62, 0.02);
    armGroup.rotation.z = side * 0.17;
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.58, 8, 12), shirtMaterial);
    sleeve.position.y = -0.3;
    sleeve.scale.set(1.0, 1.0, 0.82);
    armGroup.add(sleeve);
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), shirtMaterial);
    deltoid.position.set(side * 0.02, -0.28, -0.02);
    deltoid.scale.set(0.86, 1.1, 0.72);
    armGroup.add(deltoid);
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.78, 10, 14), muscleSkinMaterial);
    upperArm.position.y = -0.78;
    upperArm.scale.set(0.92, 1.0, 0.8);
    armGroup.add(upperArm);
    const tricep = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.62, 8, 10), muscleSkinMaterial);
    tricep.position.set(0.03 * side, -0.82, -0.12);
    tricep.scale.set(0.52, 1.0, 0.28);
    armGroup.add(tricep);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skinMaterial);
    elbow.position.y = -1.22;
    elbow.scale.set(0.88, 0.7, 0.72);
    armGroup.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.108, 1.02, 10, 14), muscleSkinMaterial);
    forearm.position.y = -1.72;
    forearm.scale.set(0.9, 1.0, 0.76);
    armGroup.add(forearm);
    const forearmRidge = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.78, 8, 10), muscleSkinMaterial);
    forearmRidge.position.set(-0.035 * side, -1.72, 0.1);
    forearmRidge.scale.set(0.4, 1.0, 0.2);
    armGroup.add(forearmRidge);
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skinMaterial);
    wrist.position.y = -2.28;
    armGroup.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMaterial);
    hand.position.set(0, -2.43, 0.07);
    hand.scale.set(0.72, 1.08, 0.5);
    armGroup.add(hand);
    rig.arms.push({ group: armGroup, side, hand });
    group.add(armGroup);

    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.31, 2.55, 0);
    legGroup.rotation.z = side * 0.035;
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, legLength, 10, 18), muscleSkinMaterial);
    thigh.position.y = -0.72;
    thigh.scale.set(0.96, 1.0, 0.82);
    legGroup.add(thigh);

    const quad = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, legLength * 0.58, 8, 12), muscleSkinMaterial);
    quad.position.set(0.025 * side, -0.7, 0.16);
    quad.scale.set(0.82, 1.0, 0.35);
    legGroup.add(quad);

    const hamstring = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, legLength * 0.66, 8, 12), muscleSkinMaterial);
    hamstring.position.set(-0.025 * side, -0.76, -0.16);
    hamstring.scale.set(0.78, 1.0, 0.42);
    legGroup.add(hamstring);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), skinMaterial);
    knee.position.y = -1.56;
    knee.scale.set(0.9, 0.68, 0.78);
    legGroup.add(knee);

    const kneecap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), muscleSkinMaterial);
    kneecap.position.set(0, -1.53, 0.16);
    kneecap.scale.set(0.96, 0.52, 0.38);
    legGroup.add(kneecap);

    const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.28, 10, 16), trimMaterial);
    sock.position.y = -2.14;
    sock.scale.set(0.9, 1.0, 0.74);
    legGroup.add(sock);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.92, 8, 12), trimMaterial);
    calf.position.set(0.025 * side, -2.12, -0.12);
    calf.scale.set(0.74, 1.0, 0.48);
    legGroup.add(calf);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.92, 8, 10), seamMaterial);
    shin.position.set(-0.02 * side, -2.08, 0.16);
    shin.scale.set(0.42, 1.0, 0.18);
    legGroup.add(shin);

    const sockBand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.065, 0.28), seamMaterial);
    sockBand.position.y = -1.62;
    legGroup.add(sockBand);
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 12), trimMaterial);
    ankle.position.y = -2.66;
    legGroup.add(ankle);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.72), bootMaterial);
    boot.position.set(0, -2.78, 0.16);
    boot.rotation.x = -0.08;
    legGroup.add(boot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.32), bootMaterial);
    toe.position.set(0, -2.75, 0.52);
    toe.rotation.x = -0.18;
    legGroup.add(toe);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.18), bootMaterial);
    heel.position.set(0, -2.76, -0.2);
    heel.rotation.x = 0.08;
    legGroup.add(heel);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.22), laceMaterial);
    lace.position.set(0, -2.64, 0.28);
    lace.rotation.x = -0.16;
    legGroup.add(lace);
    rig.legs.push({ group: legGroup, side, boot, toe, thigh, sock, knee });
    group.add(legGroup);
  });

  group.position.set(x, 0, z);
  group.rotation.y = player.team === "GOLD" ? Math.PI * 0.02 : Math.PI;
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.userData.rig = rig;
  group.userData.homeX = x;
  group.userData.homeZ = z;
  return group;
}

function makeControlStar() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: "#ffdf4d", transparent: true, opacity: 0.95 });
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 1.15 : 0.5;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const star = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  star.rotation.x = -0.24;
  group.add(star);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.42, 0.08, 8, 32),
    new THREE.MeshBasicMaterial({ color: "#72ffc2", transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.08;
  group.add(ring);
  group.visible = false;
  return group;
}

function StadiumScene({ setup, running, gameStateRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const stadium = setup?.stadium;
    const primary = new THREE.Color(stadium?.primaryHex ?? "#17633f");
    const accent = new THREE.Color(stadium?.accentHex ?? "#72ffc2");
    const ballColor = new THREE.Color(setup?.ball?.primaryHex ?? "#f8fbff");
    const ballAccent = new THREE.Color(setup?.ball?.accentHex ?? "#17211f");
    const roster = setup?.rosterPlayers ?? [];
    const goldJersey = setup?.homeJersey;
    const blueJersey = setup?.awayJersey;
    const animatedObjects = [];
    const cameraTarget = new THREE.Vector3(0, 4, 0);
    const cameraDesired = new THREE.Vector3(0, 42, 58);
    const cameraLook = new THREE.Vector3(0, 4, 0);
    const controlStar = makeControlStar();
    let frame = 0;
    const toField = (x, y, width = 1, height = 1) => ({
      x: THREE.MathUtils.clamp((x / Math.max(width, 1) - 0.5) * 82, -40, 40),
      z: THREE.MathUtils.clamp((y / Math.max(height, 1) - 0.5) * 118, -58, 58)
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    camera.position.copy(cameraDesired);
    camera.lookAt(cameraLook);
    scene.add(controlStar);

    scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    const keyLight = new THREE.DirectionalLight(accent, 1.6);
    keyLight.position.set(-48, 90, 34);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -70;
    keyLight.shadow.camera.right = 70;
    keyLight.shadow.camera.top = 90;
    keyLight.shadow.camera.bottom = -90;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xffffff, 1.2, 260);
    rimLight.position.set(52, 44, -52);
    scene.add(rimLight);

    const pitchMaterial = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.88, metalness: 0.01 });
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: primary.clone().offsetHSL(0.02, 0.1, 0.1), roughness: 0.9 });
    const pitch = new THREE.Mesh(new THREE.BoxGeometry(88, 1.1, 126), pitchMaterial);
    pitch.position.set(0, -0.65, 0);
    pitch.receiveShadow = true;
    scene.add(pitch);

    for (let i = 0; i < 10; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.14, 126), i % 2 ? stripeMaterial : pitchMaterial);
      stripe.position.set(-39.6 + i * 8.8, -0.57, 0);
      stripe.receiveShadow = true;
      scene.add(stripe);
    }

    const lineMaterial = new THREE.MeshBasicMaterial({ color: "#f4fff8", transparent: true, opacity: 0.98 });
    const addPitchLine = (x, y, z, w, h, d) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lineMaterial);
      line.position.set(x, y, z);
      scene.add(line);
      return line;
    };
    const addPenaltySpot = (z) => {
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 24), lineMaterial);
      spot.position.set(0, 0.2, z);
      scene.add(spot);
    };
    const addCornerArc = (x, z, rot) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.16, 8, 28, Math.PI / 2), lineMaterial);
      arc.rotation.set(Math.PI / 2, 0, rot);
      arc.position.set(x, 0.24, z);
      scene.add(arc);
    };
    const addGoal = (z, side) => {
      const goal = new THREE.Group();
      const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4fff8, roughness: 0.32, metalness: 0.18 });
      const netMaterial = new THREE.MeshBasicMaterial({ color: 0xdffff1, transparent: true, opacity: 0.2, wireframe: true });
      [-1, 1].forEach((postSide) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.8, 16), postMaterial);
        post.position.set(postSide * 9.5, 2.35, z);
        goal.add(post);
      });
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 19.4, 16), postMaterial);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, 4.75, z);
      goal.add(crossbar);
      const backBar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 19.4, 12), postMaterial);
      backBar.rotation.z = Math.PI / 2;
      backBar.position.set(0, 4.2, z + side * 5.6);
      goal.add(backBar);
      const rearNet = new THREE.Mesh(new THREE.PlaneGeometry(19.8, 4.5, 8, 4), netMaterial);
      rearNet.position.set(0, 2.35, z + side * 5.8);
      rearNet.rotation.y = Math.PI;
      goal.add(rearNet);
      [-1, 1].forEach((netSide) => {
        const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 4.5, 4, 4), netMaterial);
        sideNet.position.set(netSide * 9.9, 2.35, z + side * 2.9);
        sideNet.rotation.y = Math.PI / 2;
        goal.add(sideNet);
      });
      scene.add(goal);
    };
    [
      [0, 0.05, 0, 0.22, 0.1, 126],
      [-44, 0.06, 0, 0.28, 0.1, 126],
      [44, 0.06, 0, 0.28, 0.1, 126],
      [0, 0.07, -63, 88, 0.1, 0.28],
      [0, 0.07, 63, 88, 0.1, 0.28],
      [0, 0.08, 0, 88, 0.1, 0.18]
    ].forEach(([x, y, z, w, h, d]) => {
      addPitchLine(x, y, z, w, h, d);
    });

    [-1, 1].forEach((side) => {
      const goalLine = side * 63;
      const penaltyLine = side * 43;
      const goalBoxLine = side * 55;
      addPitchLine(0, 0.1, penaltyLine, 44, 0.1, 0.32);
      addPitchLine(-22, 0.1, side * 53, 0.32, 0.1, 20);
      addPitchLine(22, 0.1, side * 53, 0.32, 0.1, 20);
      addPitchLine(0, 0.11, goalBoxLine, 22, 0.1, 0.32);
      addPitchLine(-11, 0.11, side * 59, 0.32, 0.1, 8);
      addPitchLine(11, 0.11, side * 59, 0.32, 0.1, 8);
      addPenaltySpot(side * 51);
      addGoal(goalLine + side * 0.3, side);
    });
    addCornerArc(-44, -63, 0);
    addCornerArc(44, -63, Math.PI / 2);
    addCornerArc(44, 63, Math.PI);
    addCornerArc(-44, 63, -Math.PI / 2);

    const centerRing = new THREE.Mesh(
      new THREE.TorusGeometry(12, 0.22, 8, 88),
      lineMaterial
    );
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = 0.12;
    scene.add(centerRing);

    const standMaterial = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.58, metalness: 0.12 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25 });

    for (let tier = 0; tier < 4; tier += 1) {
      const y = 6 + tier * 6;
      const zBack = 76 + tier * 7;
      const zFront = -76 - tier * 7;
      const width = 122 + tier * 18;
      const depth = 7;
      [
        [0, y, zBack, width, 4.5, depth],
        [0, y, zFront, width, 4.5, depth],
        [-62 - tier * 9, y, 0, depth, 4.5, 144 + tier * 10],
        [62 + tier * 9, y, 0, depth, 4.5, 144 + tier * 10]
      ].forEach(([x, sy, z, w, h, d]) => {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), standMaterial);
        stand.position.set(x, sy, z);
        stand.rotation.x = z > 0 ? -0.12 : z < 0 ? 0.12 : 0;
        scene.add(stand);
      });
    }

    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0f12, roughness: 0.3, metalness: 0.42, transparent: true, opacity: 0.74 });
    [
      [0, 34, 96, 168, 3, 18],
      [0, 34, -96, 168, 3, 18],
      [-90, 34, 0, 18, 3, 182],
      [90, 34, 0, 18, 3, 182]
    ].forEach(([x, y, z, w, h, d]) => {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), roofMaterial);
      roof.position.set(x, y, z);
      scene.add(roof);
    });

    const crowdColors = ["#ffcf4d", "#58a8ff", "#ff5f6d", "#f5fff8", "#72ffc2"];
    for (let i = 0; i < 180; i += 1) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 8),
        new THREE.MeshStandardMaterial({ color: crowdColors[i % crowdColors.length], roughness: 0.65 })
      );
      const side = i % 4;
      const lane = Math.floor(i / 4);
      if (side < 2) {
        dot.position.set(-70 + (lane % 45) * 3.1, 11 + (lane % 4) * 3.2, side === 0 ? 80 : -80);
      } else {
        dot.position.set(side === 2 ? -70 : 70, 11 + (lane % 4) * 3.2, -62 + (lane % 45) * 2.8);
      }
      animatedObjects.push(dot);
      dot.userData.baseY = dot.position.y;
      scene.add(dot);
    }

    for (let i = 0; i < 44; i += 1) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.4), accentMaterial);
      const side = i % 2 === 0 ? -1 : 1;
      light.position.set(-50 + (i % 22) * 4.7, 19 + Math.sin(i) * 1.3, side * 48);
      scene.add(light);
    }

    const floodMaterial = new THREE.MeshStandardMaterial({ color: 0xf4fff8, emissive: 0xf4fff8, emissiveIntensity: 1.6 });
    [[-78, 42, -72], [78, 42, -72], [-78, 42, 72], [78, 42, 72]].forEach(([x, y, z]) => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 42, 12), standMaterial);
      mast.position.set(x, y - 20, z);
      scene.add(mast);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 5), floodMaterial);
      panel.position.set(x, y, z);
      panel.lookAt(0, 0, 0);
      scene.add(panel);
    });

    const selectedRoster = roster.length ? roster : [
      { displayName: "Mateo Cruz", jerseyNumber: 9, team: "GOLD", skinTone: "#9b6a45" },
      { displayName: "Leo Hart", jerseyNumber: 10, team: "GOLD", skinTone: "#d49b6a" },
      { displayName: "Andre Silva", jerseyNumber: 11, team: "BLUE", skinTone: "#a66f4d" },
      { displayName: "Milan Fox", jerseyNumber: 8, team: "BLUE", skinTone: "#c88b62" }
    ];
    const positions = [[-24, -34], [-10, -8], [12, -24], [26, 2], [-28, 18], [30, 34], [0, -45], [0, 43]];
    selectedRoster.slice(0, 8).forEach((player, index) => {
      const [x, z] = positions[index] ?? [0, 0];
      const human = makeHumanPlayer(player, player.team === "GOLD" ? goldJersey : blueJersey, x, z, index);
      human.scale.setScalar(index < 4 ? 1.55 : 1.35);
      human.rotation.y += index % 2 === 0 ? -0.24 : 0.22;
      animatedObjects.push(human);
      human.userData.baseY = human.position.y;
      human.userData.phase = index * 0.8;
      human.userData.gameIndex = index;
      human.userData.lastFieldX = x;
      human.userData.lastFieldZ = z;
      scene.add(human);
    });

    const referee = makeHumanPlayer(
      { displayName: "Referee", jerseyNumber: 0, team: "REF", skinTone: "#b87455" },
      { primaryHex: "#111111", trimHex: "#f7ff4c", accentHex: "#111111" },
      -6,
      10,
      12
    );
    referee.scale.setScalar(1.28);
    referee.rotation.y = Math.PI * 0.18;
    referee.userData.baseY = referee.position.y;
    referee.userData.phase = 4.8;
    animatedObjects.push(referee);
    scene.add(referee);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 24, 24),
      new THREE.MeshStandardMaterial({ color: ballColor, roughness: 0.32, metalness: 0.08 })
    );
    ball.position.set(0, 1.2, 0);
    scene.add(ball);
    const ballStripe = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.08, 6, 36),
      new THREE.MeshBasicMaterial({ color: ballAccent })
    );
    ballStripe.position.copy(ball.position);
    ballStripe.rotation.x = Math.PI / 2;
    scene.add(ballStripe);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      const time = performance.now() / 1000;
      const gameSnapshot = gameStateRef?.current;
      scene.rotation.y = Math.sin(time / 4.2) * 0.025;
      if (gameSnapshot?.ball) {
        const nextBall = toField(gameSnapshot.ball.x, gameSnapshot.ball.y, gameSnapshot.width, gameSnapshot.height);
        ball.position.x = THREE.MathUtils.lerp(ball.position.x, nextBall.x, 0.28);
        ball.position.z = THREE.MathUtils.lerp(ball.position.z, nextBall.z, 0.28);
      } else {
        ball.position.x = Math.sin(time * 0.8) * 7;
        ball.position.z = Math.cos(time * 0.72) * 5;
      }
      ball.rotation.x += 0.035;
      ballStripe.position.copy(ball.position);
      ballStripe.rotation.z += 0.05;
      animatedObjects.forEach((object, index) => {
        const phase = object.userData.phase ?? index;
        object.position.y = object.userData.baseY + Math.sin(time * 2.4 + phase) * (running ? 0.22 : 0.05);
        if (object.userData.rig) {
          const simPlayer = Number.isInteger(object.userData.gameIndex) ? gameSnapshot?.players?.[object.userData.gameIndex] : null;
          let motion = running ? 0.42 : 0.18;
          let stride = Math.sin(time * (running ? 2.1 : 1.15) + phase);
          let velocity = 0;
          if (simPlayer) {
            const next = toField(simPlayer.x, simPlayer.y, gameSnapshot.width, gameSnapshot.height);
            velocity = Math.hypot(simPlayer.vx, simPlayer.vy);
            motion = THREE.MathUtils.clamp(velocity / 220, 0.08, 0.95);
            stride = Math.sin(time * (1.65 + motion * 2.65) + phase);
            object.position.x = THREE.MathUtils.lerp(object.position.x, next.x, 0.18);
            object.position.z = THREE.MathUtils.lerp(object.position.z, next.z, 0.18);
            object.userData.lastFieldX = next.x;
            object.userData.lastFieldZ = next.z;
          } else {
            object.position.x = object.userData.homeX + Math.sin(time * 0.42 + phase) * motion * 1.2;
            object.position.z = object.userData.homeZ + Math.cos(time * 0.36 + phase) * motion * 0.8;
          }
          object.rotation.z = Math.sin(time * 2 + phase) * motion * 0.018;
          const faceAngle = simPlayer && Math.hypot(simPlayer.vx, simPlayer.vy) > 10
            ? Math.atan2(simPlayer.vx, simPlayer.vy)
            : Math.atan2(ball.position.x - object.position.x, ball.position.z - object.position.z);
          object.rotation.y = THREE.MathUtils.lerp(object.rotation.y, faceAngle, 0.04);
          const lift = Math.max(0, Math.sin(time * (1.65 + motion * 2.65) + phase));
          const keeperDive = simPlayer?.role === "Keeper" && velocity > 180 ? THREE.MathUtils.clamp(simPlayer.vx / 320, -0.55, 0.55) : 0;
          object.userData.rig.torso.rotation.x = THREE.MathUtils.lerp(object.userData.rig.torso.rotation.x, motion * 0.08, 0.1);
          object.userData.rig.torso.rotation.z = THREE.MathUtils.lerp(object.userData.rig.torso.rotation.z, keeperDive || Math.sin(time * 1.7 + phase) * motion * 0.035, 0.08);
          object.userData.rig.head.rotation.x = THREE.MathUtils.lerp(object.userData.rig.head.rotation.x, -motion * 0.045, 0.08);
          object.userData.rig.head.rotation.z = THREE.MathUtils.lerp(object.userData.rig.head.rotation.z, -keeperDive * 0.45, 0.08);
          object.userData.rig.arms.forEach(({ group, side, hand }) => {
            const armDrive = stride * side * motion;
            group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, armDrive * 0.42 + keeperDive * 0.6, 0.18);
            group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, side * (0.2 + motion * 0.04) + keeperDive * 0.55, 0.16);
            if (hand) {
              hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, -side * armDrive * 0.28, 0.18);
            }
          });
          object.userData.rig.legs.forEach(({ group, side, boot, toe, sock, knee }) => {
            const legPhase = stride * side;
            const plant = Math.max(0, -legPhase);
            const swing = Math.max(0, legPhase);
            group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -legPhase * motion * 0.42, 0.18);
            group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, side * (0.04 + motion * 0.012) - keeperDive * 0.25, 0.16);
            boot.rotation.x = THREE.MathUtils.lerp(boot.rotation.x, -0.1 + plant * motion * 0.3, 0.22);
            boot.position.y = THREE.MathUtils.lerp(boot.position.y, -2.78 + lift * motion * 0.1, 0.22);
            toe.rotation.x = THREE.MathUtils.lerp(toe.rotation.x, -0.18 + plant * motion * 0.25, 0.22);
            sock.rotation.x = THREE.MathUtils.lerp(sock.rotation.x, swing * motion * 0.14, 0.18);
            knee.position.z = THREE.MathUtils.lerp(knee.position.z, swing * motion * 0.08, 0.18);
          });
        }
      });
      const activeMesh = Number.isInteger(gameSnapshot?.activePlayerIndex)
        ? animatedObjects.find((object) => object.userData.gameIndex === gameSnapshot.activePlayerIndex)
        : null;
      if (activeMesh) {
        controlStar.visible = true;
        controlStar.position.set(activeMesh.position.x, activeMesh.position.y + 13.6, activeMesh.position.z);
        controlStar.rotation.y += 0.035;
        controlStar.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
      } else {
        controlStar.visible = false;
      }
      const leadX = THREE.MathUtils.clamp(ball.position.x * 0.45, -18, 18);
      const leadZ = THREE.MathUtils.clamp(ball.position.z * 0.5, -30, 30);
      cameraTarget.set(leadX, 5.2, leadZ);
      cameraDesired.set(leadX, 32 + Math.abs(leadZ) * 0.1, leadZ + 54);
      cameraDesired.x = THREE.MathUtils.clamp(cameraDesired.x, -22, 22);
      cameraDesired.z = THREE.MathUtils.clamp(cameraDesired.z, 24, 78);
      camera.position.lerp(cameraDesired, 0.045);
      cameraLook.lerp(cameraTarget, 0.075);
      camera.lookAt(cameraLook);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [setup, running]);

  return (
    <div
      className="stadium-3d"
      style={{ "--stadium-image": `url(${setup?.stadium?.imageUrl ?? "/stadiums/apex-dome.png"})` }}
      aria-hidden="true"
    >
      <div ref={mountRef} />
    </div>
  );
}

function GameSetupPanel({ catalog, selected, onSelect, collapsed, setCollapsed }) {
  const stadiums = catalog.stadiums ?? [];
  const balls = catalog.balls ?? [];
  const jerseys = catalog.jerseys ?? [];
  const modes = catalog.modes ?? [];
  const roster = catalog.rosterPlayers ?? [];
  const goldPlayers = roster.filter((player) => player.team === "GOLD").slice(0, 4);
  const bluePlayers = roster.filter((player) => player.team === "BLUE").slice(0, 4);

  return (
    <motion.div
      className={`setup-panel ${collapsed ? "closed" : ""}`}
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <button className="panel-toggle" type="button" onClick={() => setCollapsed((value) => !value)}>
        {collapsed ? "Open Setup" : "Close Setup"}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="setup-panel-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
          <div className="panel-title">
            <Crown size={17} aria-hidden="true" />
            <strong>Match Setup</strong>
          </div>
          <label>
            <span>3D Stadium</span>
            <select value={selected.stadium?.id ?? ""} onChange={(event) => onSelect("stadium", stadiums.find((item) => item.id === event.target.value))}>
              {stadiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Ball</span>
            <select value={selected.ball?.id ?? ""} onChange={(event) => onSelect("ball", balls.find((item) => item.id === event.target.value))}>
              {balls.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Mode</span>
            <select value={selected.mode?.id ?? ""} onChange={(event) => onSelect("mode", modes.find((item) => item.id === event.target.value))}>
              {modes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Home Jersey</span>
            <select value={selected.homeJersey?.id ?? ""} onChange={(event) => onSelect("homeJersey", jerseys.find((item) => item.id === event.target.value))}>
              {jerseys.filter((item) => item.team === "GOLD").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Away Jersey</span>
            <select value={selected.awayJersey?.id ?? ""} onChange={(event) => onSelect("awayJersey", jerseys.find((item) => item.id === event.target.value))}>
              {jerseys.filter((item) => item.team === "BLUE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="roster-grid">
            {[...goldPlayers, ...bluePlayers].map((player) => (
              <div className="roster-card" key={player.id}>
                <i style={{ background: player.skinTone }} />
                <div>
                  <strong>{player.jerseyNumber} {player.displayName}</strong>
                  <span>{player.position} | OVR {player.rating}</span>
                </div>
              </div>
            ))}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AccountHub({
  user,
  apiState,
  authMode,
  setAuthMode,
  authMessage,
  authBusy,
  resetTokenPreview,
  onLogin,
  onRegister,
  onLogout,
  onProfile,
  onPassword,
  onRequestReset,
  onResetPassword
}) {
  return (
    <div className="account-hub">
      <div className="account-head">
        <div>
          <span>Account</span>
          <strong>{user ? user.displayName : "Guest Player"}</strong>
        </div>
        <b className={apiState === "Connected" ? "online" : ""}>{apiState}</b>
      </div>

      <div className="auth-tabs" aria-label="Authentication modes">
        <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
          <LogIn size={15} /> Login
        </button>
        <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
          <Badge size={15} /> Join
        </button>
        <button type="button" className={authMode === "profile" ? "active" : ""} onClick={() => setAuthMode("profile")}>
          <Lock size={15} /> Profile
        </button>
      </div>

      {authMode === "login" && (
        <form className="auth-form" onSubmit={onLogin}>
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="player@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="StrongPass123!" required />
          </label>
          <button className="auth-submit" type="submit" disabled={authBusy}>
            <LogIn size={16} /> Sign In
          </button>
          <button className="text-button" type="button" onClick={() => setAuthMode("reset")}>
            Forgot password?
          </button>
        </form>
      )}

      {authMode === "register" && (
        <form className="auth-form" onSubmit={onRegister}>
          <label>
            <span>Display Name</span>
            <input name="displayName" placeholder="Jason Striker" required minLength={2} />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="player@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="StrongPass123!" required minLength={8} />
          </label>
          <button className="auth-submit" type="submit" disabled={authBusy}>
            <Badge size={16} /> Create Account
          </button>
        </form>
      )}

      {authMode === "profile" && (
        <div className="profile-stack">
          {user ? (
            <>
              <div className="profile-card-mini">
                <span>{user.email}</span>
                <strong>{user.player?.handle ?? "No player handle"}</strong>
                <small>Rating {user.player?.rating ?? "--"} | {user.role}</small>
              </div>
              <form className="auth-form" onSubmit={onProfile}>
                <label>
                  <span>Display Name</span>
                  <input name="displayName" defaultValue={user.displayName} required minLength={2} />
                </label>
                <button className="auth-submit" type="submit" disabled={authBusy}>
                  <Lock size={16} /> Save Profile
                </button>
              </form>
              <form className="auth-form" onSubmit={onPassword}>
                <label>
                  <span>Current Password</span>
                  <input name="currentPassword" type="password" required />
                </label>
                <label>
                  <span>New Password</span>
                  <input name="newPassword" type="password" required minLength={8} />
                </label>
                <button className="auth-submit danger" type="submit" disabled={authBusy}>
                  <KeyRound size={16} /> Change Password
                </button>
              </form>
              <button className="auth-submit ghost" type="button" onClick={onLogout} disabled={authBusy}>
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <p className="auth-note">Sign in to manage your player profile, password, and saved progress.</p>
          )}
        </div>
      )}

      {authMode === "reset" && (
        <div className="profile-stack">
          <form className="auth-form" onSubmit={onRequestReset}>
            <label>
              <span>Email</span>
              <input name="email" type="email" placeholder="player@example.com" required />
            </label>
            <button className="auth-submit" type="submit" disabled={authBusy}>
              <Mail size={16} /> Request Reset
            </button>
          </form>
          <form className="auth-form" onSubmit={onResetPassword}>
            <label>
              <span>Reset Token</span>
              <input name="token" defaultValue={resetTokenPreview} placeholder="Paste token" required />
            </label>
            <label>
              <span>New Password</span>
              <input name="newPassword" type="password" placeholder="NewStrong123!" required minLength={8} />
            </label>
            <button className="auth-submit danger" type="submit" disabled={authBusy}>
              <KeyRound size={16} /> Reset Password
            </button>
          </form>
        </div>
      )}

      {authMessage && <div className="auth-message">{authMessage}</div>}
    </div>
  );
}

function AdminDashboard({
  user,
  adminData,
  adminTab,
  setAdminTab,
  adminMessage,
  adminBusy,
  onRefresh,
  onUpdateUser,
  onDeleteUser,
  onUpdatePlayer,
  onDeleteMatch
}) {
  if (user?.role !== "ADMIN") return null;

  const overview = adminData.overview ?? {};
  const users = adminData.users ?? [];
  const players = adminData.players ?? [];
  const matches = adminData.matches ?? [];

  return (
    <div className="admin-dashboard">
      <div className="admin-head">
        <div>
          <span>Admin Dashboard</span>
          <strong>Control Room</strong>
        </div>
        <button type="button" onClick={onRefresh} disabled={adminBusy}>
          <Database size={15} /> Sync
        </button>
      </div>

      <div className="admin-metrics">
        <StatCard icon={Users} label="Users" value={overview.users ?? "--"} />
        <StatCard icon={Badge} label="Players" value={overview.players ?? "--"} />
        <StatCard icon={Trophy} label="Matches" value={overview.matches ?? "--"} />
        <StatCard icon={Radio} label="Live" value={overview.liveMatches ?? "--"} />
      </div>

      <div className="admin-tabs">
        <button type="button" className={adminTab === "users" ? "active" : ""} onClick={() => setAdminTab("users")}>
          <Users size={15} /> Users
        </button>
        <button type="button" className={adminTab === "players" ? "active" : ""} onClick={() => setAdminTab("players")}>
          <Badge size={15} /> Players
        </button>
        <button type="button" className={adminTab === "matches" ? "active" : ""} onClick={() => setAdminTab("matches")}>
          <Trophy size={15} /> Matches
        </button>
      </div>

      {adminTab === "users" && (
        <div className="admin-list">
          {users.map((item) => (
            <form className="admin-row user-admin-row" key={item.id} onSubmit={(event) => onUpdateUser(event, item.id)}>
              <div>
                <span>{item.email}</span>
                <input name="displayName" defaultValue={item.displayName} />
              </div>
              <select name="role" defaultValue={item.role}>
                <option value="PLAYER">PLAYER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button type="submit" disabled={adminBusy} aria-label="Save user">
                <Save size={15} />
              </button>
              <button type="button" disabled={adminBusy || item.id === user.id} onClick={() => onDeleteUser(item.id)} aria-label="Delete user">
                <Trash2 size={15} />
              </button>
            </form>
          ))}
        </div>
      )}

      {adminTab === "players" && (
        <div className="admin-list">
          {players.map((player) => (
            <form className="admin-row player-admin-row" key={player.id} onSubmit={(event) => onUpdatePlayer(event, player.id)}>
              <div>
                <span>{player.user?.email ?? "unlinked"}</span>
                <input name="displayName" defaultValue={player.displayName} />
              </div>
              <input name="rating" type="number" min="1" max="99" defaultValue={player.rating} aria-label="Rating" />
              <input name="wins" type="number" min="0" defaultValue={player.wins} aria-label="Wins" />
              <input name="goals" type="number" min="0" defaultValue={player.goals} aria-label="Goals" />
              <button type="submit" disabled={adminBusy} aria-label="Save player">
                <Save size={15} />
              </button>
            </form>
          ))}
        </div>
      )}

      {adminTab === "matches" && (
        <div className="admin-list">
          {matches.map((match) => (
            <div className="admin-row match-admin-row" key={match.id}>
              <div>
                <span>{match.arena}</span>
                <strong>{match.goldScore} - {match.blueScore} | {match.status}</strong>
              </div>
              <b>{match._count?.events ?? 0} events</b>
              <button type="button" disabled={adminBusy} onClick={() => onDeleteMatch(match.id)} aria-label="Delete match">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adminMessage && <div className="auth-message">{adminMessage}</div>}
    </div>
  );
}

function GameplayControls({ controls, running, onAction }) {
  const items = controls?.length
    ? controls
    : [
        { id: "move", label: "Move", keyboard: "WASD / Arrows", description: "Move the controlled player around the pitch." },
        { id: "sprint", label: "Sprint", keyboard: "Shift", description: "Burst into space." },
        { id: "dribble", label: "Dribble", keyboard: "E", description: "Keep the ball close and beat a defender." },
        { id: "pass", label: "Pass", keyboard: "F", description: "Play the ball into a teammate or open channel." },
        { id: "shoot", label: "Shoot", keyboard: "Space", description: "Strike toward goal." },
        { id: "switch", label: "Switch Player", keyboard: "Q / Tab", description: "Change control to the best-positioned teammate." },
        { id: "keeperDiveLeft", label: "Keeper Dive L", keyboard: "Z", description: "Dive left when controlling the goalkeeper." },
        { id: "keeperDiveRight", label: "Keeper Dive R", keyboard: "C", description: "Dive right when controlling the goalkeeper." },
        { id: "keeperRush", label: "Keeper Rush", keyboard: "R", description: "Charge toward the ball as the goalkeeper." },
        { id: "keeperClear", label: "Keeper Clear", keyboard: "X", description: "Clear the ball upfield as the goalkeeper." }
      ];

  return (
    <div className="gameplay-controls">
      <div className="panel-title">
        <Gamepad2 size={17} aria-hidden="true" />
        <strong>Control System</strong>
      </div>
      <div className="control-actions">
        {items.map((item) => (
          <button key={item.id} type="button" className={`control-action ${item.id}`} onClick={() => onAction(item.id)}>
            <span>{item.label}</span>
            <small>{item.keyboard}</small>
          </button>
        ))}
      </div>
      <div className="control-tips">
        {items.map((item) => (
          <div key={`tip-${item.id}`}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </div>
        ))}
      </div>
      <p>{running ? "Backend command layer is accepting live actions." : "Start the match, then use buttons or keyboard controls."}</p>
    </div>
  );
}

function SidebarSection({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`sidebar-section ${open ? "open" : "closed"}`}>
      <button className="sidebar-section-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>
          {Icon && <Icon size={16} aria-hidden="true" />}
          <strong>{title}</strong>
        </span>
        <b>{open ? "Close" : "Open"}</b>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="sidebar-section-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function Home() {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState({ gold: 0, blue: 0 });
  const [seconds, setSeconds] = useState(90);
  const [status, setStatus] = useState("Kickoff");
  const [resetToken, setResetToken] = useState(0);
  const [apiState, setApiState] = useState("Offline");
  const [leaders, setLeaders] = useState([]);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resetTokenPreview, setResetTokenPreview] = useState("");
  const [adminData, setAdminData] = useState({ overview: null, users: [], players: [], matches: [] });
  const [adminTab, setAdminTab] = useState("users");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [catalog, setCatalog] = useState({ stadiums: [], balls: [], jerseys: [], modes: [], rosterPlayers: [] });
  const [gameplayControls, setGameplayControls] = useState([]);
  const [actionCommand, setActionCommand] = useState(null);
  const [selectedSetup, setSelectedSetup] = useState({});
  const [setupCollapsed, setSetupCollapsed] = useState(false);
  const gameStateRef = useRef(null);

  const saveSession = useCallback((session) => {
    localStorage.setItem(tokenStore.access, session.accessToken);
    localStorage.setItem(tokenStore.refresh, session.refreshToken);
    setUser(session.user);
    setAuthMode("profile");
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(tokenStore.access);
    localStorage.removeItem(tokenStore.refresh);
    setUser(null);
    setAuthMode("login");
  }, []);

  const authedRequest = useCallback(
    async (path, options = {}) => {
      let accessToken = localStorage.getItem(tokenStore.access);
      const makeRequest = () =>
        apiRequest(path, {
          ...options,
          headers: {
            ...(options.headers ?? {}),
            Authorization: `Bearer ${accessToken}`
          }
        });

      try {
        return await makeRequest();
      } catch (error) {
        const refreshToken = localStorage.getItem(tokenStore.refresh);
        if (!refreshToken) throw error;
        const session = await apiRequest("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken })
        });
        saveSession(session);
        accessToken = session.accessToken;
        return makeRequest();
      }
    },
    [saveSession]
  );

  useEffect(() => {
    async function loadBackendData() {
      try {
        const [healthResponse, leaderboardResponse, catalogResponse, controlsResponse] = await Promise.all([
          fetch(`${apiUrl}/health`),
          fetch(`${apiUrl}/leaderboard`),
          fetch(`${apiUrl}/catalog`),
          fetch(`${apiUrl}/gameplay/controls`)
        ]);
        if (!healthResponse.ok || !leaderboardResponse.ok || !catalogResponse.ok || !controlsResponse.ok) throw new Error("Backend unavailable");
        await healthResponse.json();
        setLeaders(await leaderboardResponse.json());
        const nextCatalog = await catalogResponse.json();
        const controlsPayload = await controlsResponse.json();
        setCatalog(nextCatalog);
        setGameplayControls(controlsPayload.controls ?? []);
        setSelectedSetup({
          stadium: nextCatalog.stadiums?.[0],
          ball: nextCatalog.balls?.[0],
          mode: nextCatalog.modes?.[0],
          homeJersey: nextCatalog.jerseys?.find((item) => item.team === "GOLD"),
          awayJersey: nextCatalog.jerseys?.find((item) => item.team === "BLUE"),
          rosterPlayers: nextCatalog.rosterPlayers ?? []
        });
        setApiState("Connected");
      } catch {
        setApiState("Offline");
      }
    }

    loadBackendData();
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const accessToken = localStorage.getItem(tokenStore.access);
      if (!accessToken) return;
      try {
        const profile = await authedRequest("/auth/me");
        setUser(profile);
        setAuthMode("profile");
      } catch {
        clearSession();
      }
    }

    restoreSession();
  }, [authedRequest, clearSession]);

  const loadAdminData = useCallback(async () => {
    if (user?.role !== "ADMIN") return;
    setAdminBusy(true);
    setAdminMessage("");
    try {
      const [overview, users, players, matches] = await Promise.all([
        authedRequest("/admin/overview"),
        authedRequest("/admin/users"),
        authedRequest("/admin/players"),
        authedRequest("/admin/matches")
      ]);
      setAdminData({ overview, users, players, matches });
      setAdminMessage("Admin dashboard synced.");
    } catch (error) {
      setAdminMessage(error.message);
    } finally {
      setAdminBusy(false);
    }
  }, [authedRequest, user?.role]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadAdminData();
    } else {
      setAdminData({ overview: null, users: [], players: [], matches: [] });
    }
  }, [loadAdminData, user?.role]);

  const runAuth = async (action, successMessage) => {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      await action();
      setAuthMessage(successMessage);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const formValue = (event, name) => new FormData(event.currentTarget).get(name)?.toString() ?? "";
  const formNumber = (event, name) => Number(new FormData(event.currentTarget).get(name) ?? 0);

  const handleLogin = (event) => {
    event.preventDefault();
    const email = formValue(event, "email");
    const password = formValue(event, "password");
    runAuth(async () => {
      const session = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password
        })
      });
      saveSession(session);
    }, "Signed in. Your player profile is live.");
  };

  const handleRegister = (event) => {
    event.preventDefault();
    const displayName = formValue(event, "displayName");
    const email = formValue(event, "email");
    const password = formValue(event, "password");
    runAuth(async () => {
      const session = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          email,
          password
        })
      });
      saveSession(session);
    }, "Account created. Welcome to Street Cup.");
  };

  const handleLogout = () => {
    runAuth(async () => {
      await authedRequest("/auth/logout", { method: "POST" });
      clearSession();
    }, "Signed out.");
  };

  const handleProfile = (event) => {
    event.preventDefault();
    const displayName = formValue(event, "displayName");
    runAuth(async () => {
      const profile = await authedRequest("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName })
      });
      setUser(profile);
    }, "Profile updated.");
  };

  const handlePassword = (event) => {
    event.preventDefault();
    const currentPassword = formValue(event, "currentPassword");
    const newPassword = formValue(event, "newPassword");
    runAuth(async () => {
      await authedRequest("/auth/change-password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      clearSession();
    }, "Password changed. Sign in again with the new password.");
  };

  const handleRequestReset = (event) => {
    event.preventDefault();
    const email = formValue(event, "email");
    runAuth(async () => {
      const result = await apiRequest("/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setResetTokenPreview(result.resetToken ?? "");
    }, "Reset token created. Paste it below to set a new password.");
  };

  const handleResetPassword = (event) => {
    event.preventDefault();
    const token = formValue(event, "token");
    const newPassword = formValue(event, "newPassword");
    runAuth(async () => {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword
        })
      });
      clearSession();
    }, "Password reset. You can sign in now.");
  };

  const runAdmin = async (action, successMessage) => {
    setAdminBusy(true);
    setAdminMessage("");
    try {
      await action();
      await loadAdminData();
      setAdminMessage(successMessage);
    } catch (error) {
      setAdminMessage(error.message);
    } finally {
      setAdminBusy(false);
    }
  };

  const handleAdminUpdateUser = (event, id) => {
    event.preventDefault();
    const displayName = formValue(event, "displayName");
    const role = formValue(event, "role");
    runAdmin(
      () =>
        authedRequest(`/admin/users/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ displayName, role })
        }),
      "User updated."
    );
  };

  const handleAdminDeleteUser = (id) => {
    runAdmin(() => authedRequest(`/admin/users/${id}`, { method: "DELETE" }), "User deleted.");
  };

  const handleAdminUpdatePlayer = (event, id) => {
    event.preventDefault();
    const displayName = formValue(event, "displayName");
    const rating = formNumber(event, "rating");
    const wins = formNumber(event, "wins");
    const goals = formNumber(event, "goals");
    runAdmin(
      () =>
        authedRequest(`/admin/players/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ displayName, rating, wins, goals })
        }),
      "Player stats updated."
    );
  };

  const handleAdminDeleteMatch = (id) => {
    runAdmin(() => authedRequest(`/admin/matches/${id}`, { method: "DELETE" }), "Match deleted.");
  };

  const reset = () => {
    setResetToken((value) => value + 1);
    setScore({ gold: 0, blue: 0 });
    setSeconds(90);
    setStatus("Kickoff");
    setRunning(false);
  };

  const clock = Math.ceil(seconds);
  const possession = clamp(50 + (score.gold - score.blue) * 8 + (running ? 6 : 0), 28, 72);
  const pressure = clamp(62 + score.gold * 7 - score.blue * 4, 35, 92);
  const selectSetup = (key, value) => {
    setSelectedSetup((current) => ({ ...current, [key]: value }));
  };
  const triggerGameplayAction = (action) => {
    setRunning(true);
    setActionCommand({ action, id: `${action}-${Date.now()}` });
    setStatus(action === "shoot" ? "Shoot" : action === "pass" ? "Pass" : action === "dribble" ? "Dribble" : action === "sprint" ? "Sprint" : action === "switch" ? "Switch player" : "Move");
    apiRequest("/gameplay/actions", {
      method: "POST",
      body: JSON.stringify({
        action,
        minute: Math.max(0, Math.round(90 - seconds)),
        metadata: {
          score,
          stadium: selectedSetup.stadium?.name,
          mode: selectedSetup.mode?.name
        }
      })
    }).catch(() => setStatus("Action queued locally"));
  };

  return (
    <main className="app-shell">
      <div className="stadium-glow" aria-hidden="true" />
      <section className="broadcast-bar" aria-label="Match broadcast header">
        <div className="broadcast-live">
          <Radio size={17} aria-hidden="true" />
          <span>{running ? "LIVE MATCH" : "PRE MATCH"}</span>
        </div>

        <div className="broadcast-score" aria-label="Scoreboard">
          <div className="broadcast-team">
            <TeamCrest tone="gold" code="YFC" />
            <div>
              <span>Home</span>
              <strong>Yellow FC</strong>
            </div>
          </div>

          <div className="score-core">
            <span className="match-minute">{clock}&apos;</span>
            <strong>{score.gold}</strong>
            <i>-</i>
            <strong>{score.blue}</strong>
          </div>

          <div className="broadcast-team away">
            <div>
              <span>Away</span>
              <strong>Blue United</strong>
            </div>
            <TeamCrest tone="blue" code="BLU" />
          </div>
        </div>

        <div className="actions">
          <button className="icon-button primary" type="button" onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause match" : "Start match"}>
            {running ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
          </button>
          <button className="icon-button" type="button" onClick={reset} aria-label="Restart match">
            <RotateCcw size={19} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="game-layout">
        <aside className="match-panel left-console">
          <div className="mode-card">
            <Sparkles size={18} aria-hidden="true" />
            <div>
              <span>{user ? "Authenticated" : `Backend ${apiState}`}</span>
              <strong>{user ? user.displayName : "Champions Night"}</strong>
            </div>
          </div>

          <SidebarSection title="Account" icon={Lock} defaultOpen={!user}>
            <AccountHub
              user={user}
              apiState={apiState}
              authMode={authMode}
              setAuthMode={setAuthMode}
              authMessage={authMessage}
              authBusy={authBusy}
              resetTokenPreview={resetTokenPreview}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onLogout={handleLogout}
              onProfile={handleProfile}
              onPassword={handlePassword}
              onRequestReset={handleRequestReset}
              onResetPassword={handleResetPassword}
            />
          </SidebarSection>

          {user?.role === "ADMIN" && (
            <SidebarSection title="Admin" icon={Database}>
              <AdminDashboard
                user={user}
                adminData={adminData}
                adminTab={adminTab}
                setAdminTab={setAdminTab}
                adminMessage={adminMessage}
                adminBusy={adminBusy}
                onRefresh={loadAdminData}
                onUpdateUser={handleAdminUpdateUser}
                onDeleteUser={handleAdminDeleteUser}
                onUpdatePlayer={handleAdminUpdatePlayer}
                onDeleteMatch={handleAdminDeleteMatch}
              />
            </SidebarSection>
          )}

          <SidebarSection title="Player" icon={Star} defaultOpen>
            <div className="player-card">
              <div className="player-portrait">
                <span>9</span>
              </div>
              <div>
                <span>Controlled Player</span>
                <strong>{user?.player?.displayName ?? "J. Striker"}</strong>
                <p>{user?.player ? `${user.player.handle} | Rating ${user.player.rating}` : "Explosive forward"}</p>
              </div>
            </div>
          </SidebarSection>

          <SidebarSection title="Match Stats" icon={Gauge}>
            <Meter label="Possession" value={possession} tone="gold" />
            <Meter label="Attack Pressure" value={pressure} />
            <div className="control-grid">
              <StatCard icon={Activity} label="Tempo" value={running ? "Live" : "Ready"} />
            </div>
          </SidebarSection>

          <SidebarSection title="Controls & Tips" icon={Gamepad2} defaultOpen>
            <div className="control-grid">
              <StatCard icon={Gamepad2} label="Move" value="WASD" />
              <StatCard icon={Zap} label="Sprint" value="Shift" />
              <StatCard icon={Goal} label="Pass" value="F" />
              <StatCard icon={Trophy} label="Shoot" value="Space" />
              <StatCard icon={Activity} label="Dribble" value="E" />
              <StatCard icon={Star} label="Switch" value="Q / Tab" />
            </div>
            <GameplayControls controls={gameplayControls} running={running} onAction={triggerGameplayAction} />
          </SidebarSection>
        </aside>

        <section className="pitch-wrap">
          <StadiumScene setup={selectedSetup} running={running} gameStateRef={gameStateRef} />
          <div className="pitch-chrome top">
            <span>{selectedSetup.stadium?.name ?? "Street Cup Arena"}</span>
            <strong>{selectedSetup.mode?.name ?? status}</strong>
          </div>
          <SoccerCanvas
            running={running}
            setRunning={setRunning}
            onScore={setScore}
            onTime={setSeconds}
            onStatus={setStatus}
            resetToken={resetToken}
            actionCommand={actionCommand}
            gameStateRef={gameStateRef}
          />
          {!running && (
            <button className="kickoff" type="button" onClick={() => setRunning(true)}>
              <Play size={22} aria-hidden="true" />
              <span>
                <strong>Start Match</strong>
                <small>Space or tap pitch also starts</small>
              </span>
            </button>
          )}
          <div className="player-strip">
            <div>
              <span>{user?.player?.handle ?? "YFC 9"}</span>
              <strong>{user?.player?.displayName ?? "J. Striker"}</strong>
            </div>
            <div className="stamina">
              <i />
            </div>
          </div>
        </section>

        <aside className="match-panel right-console">
          <GameSetupPanel
            catalog={catalog}
            selected={selectedSetup}
            onSelect={selectSetup}
            collapsed={setupCollapsed}
            setCollapsed={setSetupCollapsed}
          />

          <div className="timer-block">
            <span>Match Clock</span>
            <strong>{clock}</strong>
          </div>

          <div className="tactics">
            <Shield size={18} aria-hidden="true" />
            <div>
              <strong>{status}</strong>
              <span>Build momentum, press high, and shoot when the lane opens.</span>
            </div>
          </div>

          <div className="radar-card">
            <div className="panel-title">
              <Map size={17} aria-hidden="true" />
              <strong>Tactical Radar</strong>
            </div>
            <Radar score={score} />
          </div>

          <div className="rating-card">
            <div>
              <Star size={17} aria-hidden="true" />
              <span>Match Rating</span>
            </div>
            <strong>{(7.3 + score.gold * 0.4).toFixed(1)}</strong>
          </div>

          <div className="rating-card accent">
            <div>
              <Gauge size={17} aria-hidden="true" />
              <span>Game Speed</span>
            </div>
            <strong>Turbo</strong>
          </div>

          <div className="leader-card">
            <div className="panel-title">
              <Trophy size={17} aria-hidden="true" />
              <strong>Top Players</strong>
            </div>
            {(leaders.length ? leaders.slice(0, 3) : [{ displayName: "Start backend", rating: "--" }]).map((player, index) => (
              <div className="leader-row" key={player.id ?? player.displayName}>
                <span>{index + 1}</span>
                <strong>{player.displayName}</strong>
                <b>{player.rating}</b>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
