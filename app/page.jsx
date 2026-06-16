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

function createGame(width, height) {
  return {
    width,
    height,
    score: { gold: 0, blue: 0 },
    seconds: 90,
    finished: false,
    status: "Kickoff",
    statusUntil: 0,
    ball: { x: width / 2, y: height / 2, vx: 0, vy: 0, radius: 9 },
    players: [
      newPlayer("gold", "Striker", width * 0.31, height * 0.5, true),
      newPlayer("gold", "Wing", width * 0.22, height * 0.28),
      newPlayer("gold", "Wing", width * 0.22, height * 0.72),
      newPlayer("gold", "Keeper", width * 0.08, height * 0.5),
      newPlayer("blue", "Striker", width * 0.69, height * 0.5),
      newPlayer("blue", "Wing", width * 0.78, height * 0.28),
      newPlayer("blue", "Wing", width * 0.78, height * 0.72),
      newPlayer("blue", "Keeper", width * 0.92, height * 0.5)
    ]
  };
}

function resetFormation(game, direction = 0) {
  const fresh = createGame(game.width, game.height);
  game.players = fresh.players;
  game.ball.x = game.width / 2;
  game.ball.y = game.height / 2;
  game.ball.vx = direction * 230;
  game.ball.vy = 0;
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

function updateAi(game, player, dt) {
  const attacking = player.team === "gold" ? 1 : -1;
  const ownGoal = player.team === "gold" ? 0 : game.width;
  const targetGoal = player.team === "gold" ? game.width : 0;
  const ball = game.ball;
  const ballNearTeam = player.team === "gold" ? ball.x < game.width * 0.6 : ball.x > game.width * 0.4;
  let tx = player.homeX;
  let ty = player.homeY;

  if (player.role === "Keeper") {
    tx = ownGoal + attacking * 58;
    ty = clamp(ball.y, game.height * 0.34, game.height * 0.66);
  } else if (ballNearTeam || player.role === "Striker") {
    tx = ball.x - attacking * 18;
    ty = ball.y;
  } else {
    tx = player.homeX + attacking * 78;
    ty = player.homeY + Math.sin(performance.now() / 850 + player.homeY) * 34;
  }

  const dx = tx - player.x;
  const dy = ty - player.y;
  const d = length(dx, dy);
  player.vx += (dx / d) * 760 * dt;
  player.vy += (dy / d) * 760 * dt;

  const maxSpeed = player.role === "Keeper" ? 186 : 220;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }

  const close = Math.hypot(ball.x - player.x, ball.y - player.y) < player.radius + ball.radius + 8;
  if (close && player.cooldown <= 0) {
    const gx = targetGoal - player.x;
    const gy = game.height * 0.5 - player.y;
    const gd = length(gx, gy);
    ball.vx += (gx / gd) * 285;
    ball.vy += (gy / gd) * 285 + (Math.random() - 0.5) * 90;
    player.cooldown = 0.55;
  }
}

function SoccerCanvas({ running, setRunning, onScore, onTime, onStatus, resetToken }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef(new Set());
  const pointerRef = useRef({ active: false, x: 0, y: 0 });
  const runningRef = useRef(running);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

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

    const shoot = () => {
      const game = gameRef.current;
      const player = game.players.find((candidate) => candidate.user);
      const ball = game.ball;
      const pointer = pointerRef.current;
      const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (distance > player.radius + ball.radius + 28 || player.cooldown > 0) return;
      const aimX = pointer.active ? pointer.x : game.width;
      const aimY = pointer.active ? pointer.y : game.height / 2;
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

      const user = game.players.find((player) => player.user);
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
        const sprint = keys.has("shift") ? 1.35 : 1;
        user.vx += (ix / d) * 930 * sprint * dt;
        user.vy += (iy / d) * 930 * sprint * dt;
      }

      for (const player of game.players) {
        if (!player.user) updateAi(game, player, dt);
        const maxSpeed = player.user && keys.has("shift") ? 330 : player.user ? 250 : 230;
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > maxSpeed) {
          player.vx = (player.vx / speed) * maxSpeed;
          player.vy = (player.vy / speed) * maxSpeed;
        }
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.vx *= Math.pow(0.035, dt);
        player.vy *= Math.pow(0.035, dt);
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

      const goalTop = game.height * 0.36;
      const goalBottom = game.height * 0.64;
      if (game.ball.x < -game.ball.radius && game.ball.y > goalTop && game.ball.y < goalBottom) {
        game.score.blue += 1;
        game.status = "Goal: Blue United";
        game.statusUntil = performance.now() + 1600;
        resetFormation(game, 1);
        onScore({ ...game.score });
      } else if (game.ball.x > game.width + game.ball.radius && game.ball.y > goalTop && game.ball.y < goalBottom) {
        game.score.gold += 1;
        game.status = "Goal: Yellow FC";
        game.statusUntil = performance.now() + 1600;
        resetFormation(game, -1);
        onScore({ ...game.score });
      } else {
        if (game.ball.x < game.ball.radius || game.ball.x > game.width - game.ball.radius) {
          game.ball.x = clamp(game.ball.x, game.ball.radius, game.width - game.ball.radius);
          game.ball.vx *= -0.74;
        }
        if (game.ball.y < game.ball.radius || game.ball.y > game.height - game.ball.radius) {
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
      shoot();
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
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", setPointer);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [onScore, onStatus, onTime, setRunning]);

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

function makeHumanPlayer(player, jersey, x, z, index = 0) {
  const group = new THREE.Group();
  const profileSeed = (player.jerseyNumber ?? index + 7) + index * 3;
  const shirt = jersey?.primaryHex ?? (player.team === "GOLD" ? "#ffd447" : "#58a8ff");
  const trim = jersey?.trimHex ?? "#ffffff";
  const accent = jersey?.accentHex ?? "#111111";
  const skinPalette = ["#7b4b33", "#9d6747", "#c4875d", "#e0ad78", "#5d3829", "#b87455", "#d7a06b", "#8f563d"];
  const hairPalette = ["#16100c", "#3a2418", "#6b3f22", "#201713", "#0d0d0e", "#7a4b2b"];
  const skin = player.skinTone ?? skinPalette[profileSeed % skinPalette.length];
  const buildScale = 0.94 + (profileSeed % 5) * 0.025;
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.5, metalness: 0.02 });
  const shortsMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.58, metalness: 0.02 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.46 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: hairPalette[profileSeed % hairPalette.length], roughness: 0.84 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: "#fffaf1" });
  const eyeDark = new THREE.MeshBasicMaterial({ color: "#161616" });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.84, 2.85, 8, 18), shirtMaterial);
  torso.position.y = 4.72;
  torso.scale.set(0.86 * buildScale, 1.06, 0.52);
  group.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.15, 0.08), trimMaterial);
  chestStripe.position.set(0, 5.32, 0.54);
  group.add(chestStripe);

  const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.82, 0.72), shortsMaterial);
  shorts.position.y = 2.72;
  group.add(shorts);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.48, 16), skinMaterial);
  neck.position.y = 6.38;
  group.add(neck);

  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: createNumberTexture(player.jerseyNumber, shirt, trim), transparent: true })
  );
  number.position.set(0, 4.82, 0.6);
  group.add(number);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 24), skinMaterial);
  head.position.y = 7.2;
  head.scale.set(0.78 + (profileSeed % 3) * 0.04, 1.04 + (profileSeed % 4) * 0.035, 0.72);
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMaterial);
  hair.position.set(0, 7.62, -0.03);
  hair.scale.set(0.9, 0.62, 0.82);
  group.add(hair);

  const hairStyle = profileSeed % 4;
  if (hairStyle === 0 || hairStyle === 2) {
    for (let i = -2; i <= 2; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42 + (hairStyle === 2 ? 0.18 : 0), 8), hairMaterial);
      spike.position.set(i * 0.16, 7.9 - Math.abs(i) * 0.04, 0.1);
      spike.rotation.x = -0.42;
      spike.rotation.z = i * 0.1;
      group.add(spike);
    }
  } else if (hairStyle === 1) {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), hairMaterial);
    bun.position.set(0, 7.54, -0.54);
    group.add(bun);
  } else {
    const crop = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.58), hairMaterial);
    crop.position.set(0, 7.76, 0.03);
    crop.rotation.x = -0.12;
    group.add(crop);
  }

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skinMaterial);
    ear.position.set(side * 0.51, 7.2, 0.03);
    group.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhite);
    eye.position.set(side * 0.2, 7.27, 0.49);
    group.add(eye);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeDark);
    pupil.position.set(side * 0.205, 7.25, 0.57);
    group.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), hairMaterial);
    brow.position.set(side * 0.2, 7.46, 0.52);
    brow.rotation.z = -side * (0.08 + (profileSeed % 3) * 0.04);
    group.add(brow);
  });

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22 + (profileSeed % 3) * 0.025, 10), skinMaterial);
  nose.position.set(0, 7.12, 0.58);
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 18, Math.PI), eyeDark);
  smile.position.set(0, 6.94, 0.54);
  smile.rotation.set(0, 0, Math.PI);
  group.add(smile);

  const rig = { arms: [], legs: [] };
  [-1, 1].forEach((side) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.76 * buildScale, 5.48, 0.02);
    armGroup.rotation.z = side * 0.23;
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.58, 6, 10), shirtMaterial);
    sleeve.position.y = -0.32;
    armGroup.add(sleeve);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.2, 6, 10), skinMaterial);
    forearm.position.y = -1.18;
    armGroup.add(forearm);
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skinMaterial);
    wrist.position.y = -1.9;
    armGroup.add(wrist);
    rig.arms.push({ group: armGroup, side });
    group.add(armGroup);

    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.38, 2.36, 0);
    legGroup.rotation.z = side * 0.045;
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.28, 6, 10), skinMaterial);
    thigh.position.y = -0.62;
    legGroup.add(thigh);
    const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.16, 6, 10), trimMaterial);
    sock.position.y = -1.68;
    legGroup.add(sock);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.72), shortsMaterial);
    boot.position.set(0, -2.33, 0.16);
    boot.rotation.x = -0.08;
    legGroup.add(boot);
    rig.legs.push({ group: legGroup, side });
    group.add(legGroup);
  });

  group.position.set(x, 0, z);
  group.rotation.y = player.team === "GOLD" ? Math.PI * 0.02 : Math.PI;
  group.userData.rig = rig;
  group.userData.homeX = x;
  group.userData.homeZ = z;
  return group;
}

function StadiumScene({ setup, running }) {
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
    let frame = 0;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    camera.position.set(0, 70, 112);
    camera.lookAt(0, 1.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    const keyLight = new THREE.DirectionalLight(accent, 1.6);
    keyLight.position.set(-48, 90, 34);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xffffff, 1.2, 260);
    rimLight.position.set(52, 44, -52);
    scene.add(rimLight);

    const pitchMaterial = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.88, metalness: 0.01 });
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: primary.clone().offsetHSL(0.02, 0.1, 0.1), roughness: 0.9 });
    const pitch = new THREE.Mesh(new THREE.BoxGeometry(88, 1.1, 126), pitchMaterial);
    pitch.position.set(0, -0.65, 0);
    scene.add(pitch);

    for (let i = 0; i < 10; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.14, 126), i % 2 ? stripeMaterial : pitchMaterial);
      stripe.position.set(-39.6 + i * 8.8, -0.57, 0);
      scene.add(stripe);
    }

    const lineMaterial = new THREE.MeshBasicMaterial({ color: "#f4fff8", transparent: true, opacity: 0.88 });
    [
      [0, 0.05, 0, 0.22, 0.1, 126],
      [-44, 0.06, 0, 0.28, 0.1, 126],
      [44, 0.06, 0, 0.28, 0.1, 126],
      [0, 0.07, -63, 88, 0.1, 0.28],
      [0, 0.07, 63, 88, 0.1, 0.28],
      [0, 0.08, 0, 88, 0.1, 0.18]
    ].forEach(([x, y, z, w, h, d]) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lineMaterial);
      line.position.set(x, y, z);
      scene.add(line);
    });

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
      scene.add(human);
    });

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
      scene.rotation.y = Math.sin(time / 4.2) * 0.025;
      ball.position.x = Math.sin(time * 0.8) * 7;
      ball.position.z = Math.cos(time * 0.72) * 5;
      ball.rotation.x += 0.035;
      ballStripe.position.copy(ball.position);
      ballStripe.rotation.z += 0.05;
      animatedObjects.forEach((object, index) => {
        const phase = object.userData.phase ?? index;
        object.position.y = object.userData.baseY + Math.sin(time * 2.4 + phase) * (running ? 0.22 : 0.05);
        if (object.userData.rig) {
          const motion = running ? 1 : 0.55;
          const stride = Math.sin(time * (running ? 5.2 : 3.2) + phase);
          object.position.x = object.userData.homeX + Math.sin(time * 0.42 + phase) * motion * 1.8;
          object.position.z = object.userData.homeZ + Math.cos(time * 0.36 + phase) * motion * 1.25;
          object.rotation.z = Math.sin(time * 2 + phase) * motion * 0.02;
          object.userData.rig.arms.forEach(({ group, side }) => {
            group.rotation.x = stride * side * motion * 0.72;
            group.rotation.z = side * 0.26;
          });
          object.userData.rig.legs.forEach(({ group, side }) => {
            group.rotation.x = -stride * side * motion * 0.82;
            group.rotation.z = side * 0.05;
          });
        }
      });
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
  const [selectedSetup, setSelectedSetup] = useState({});
  const [setupCollapsed, setSetupCollapsed] = useState(false);

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
        const [healthResponse, leaderboardResponse, catalogResponse] = await Promise.all([
          fetch(`${apiUrl}/health`),
          fetch(`${apiUrl}/leaderboard`),
          fetch(`${apiUrl}/catalog`)
        ]);
        if (!healthResponse.ok || !leaderboardResponse.ok || !catalogResponse.ok) throw new Error("Backend unavailable");
        await healthResponse.json();
        setLeaders(await leaderboardResponse.json());
        const nextCatalog = await catalogResponse.json();
        setCatalog(nextCatalog);
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

          <Meter label="Possession" value={possession} tone="gold" />
          <Meter label="Attack Pressure" value={pressure} />

          <div className="control-grid">
            <StatCard icon={Gamepad2} label="Move" value="WASD" />
            <StatCard icon={Zap} label="Sprint" value="Shift" />
            <StatCard icon={Trophy} label="Shoot" value="Space" />
            <StatCard icon={Activity} label="Tempo" value={running ? "Live" : "Ready"} />
          </div>
        </aside>

        <section className="pitch-wrap">
          <StadiumScene setup={selectedSetup} running={running} />
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
