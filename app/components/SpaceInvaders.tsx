"use client";

import { useEffect, useRef, useCallback } from "react";

const W = 480;
const H = 460;
const ALIEN_COLORS = ["#ff4444", "#ffaa00", "#44ff99"];

interface Bullet {
  x: number;
  y: number;
}

interface Alien {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  alive: boolean;
  f: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  col: string;
  life: number;
}

export default function SpaceInvaders() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    gs: "idle" as "idle" | "playing" | "paused" | "over",
    score: 0,
    best: 0,
    lives: 3,
    level: 1,
    px: W / 2,
    py: H - 36,
    bullets: [] as Bullet[],
    abuls: [] as Bullet[],
    aliens: [] as Alien[],
    parts: [] as Particle[],
    adir: 1,
    atick: 0,
    fc: 0,
    lastShot: 0,
    keys: {} as Record<string, boolean>,
  });
  const rafRef = useRef<number>(0);

  const updateHUD = useCallback(() => {
    const s = stateRef.current;
    const el = (id: string) => document.getElementById(id);
    const sc = el("sc"); if (sc) sc.textContent = String(s.score);
    const lv = el("lv"); if (lv) lv.textContent = String(s.level);
    const li = el("li"); if (li) li.textContent = "♥".repeat(Math.max(0, s.lives)) || "0";
    const hi = el("hi"); if (hi) hi.textContent = String(s.best);
    const pb = el("btnPause") as HTMLButtonElement | null;
    if (pb) pb.disabled = s.gs !== "playing" && s.gs !== "paused";
  }, []);

  const initLevel = useCallback(() => {
    const s = stateRef.current;
    s.bullets = []; s.abuls = []; s.aliens = []; s.parts = [];
    s.px = W / 2; s.py = H - 36;
    s.adir = 1; s.atick = 0; s.fc = 0;
    const rows = Math.min(2 + s.level, 6);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 10; c++) {
        s.aliens.push({ x: 30 + c * 42, y: 40 + r * 34, w: 24, h: 16, t: r < 2 ? 2 : r < 4 ? 1 : 0, alive: true, f: 0 });
      }
    }
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.score = 0; s.lives = 3; s.level = 1;
    initLevel();
    s.gs = "playing";
    updateHUD();
    const pb = document.getElementById("btnPause") as HTMLButtonElement | null;
    if (pb) { pb.disabled = false; pb.textContent = "Pause"; }
  }, [initLevel, updateHUD]);

  const drawAlien = useCallback((cx: CanvasRenderingContext2D, a: Alien) => {
    if (!a.alive) return;
    const c = ALIEN_COLORS[a.t];
    cx.fillStyle = c;
    if (a.t === 2) {
      cx.beginPath();
      cx.moveTo(a.x, a.y - 8);
      cx.lineTo(a.x - 10, a.y + 8);
      cx.lineTo(a.x + 10, a.y + 8);
      cx.closePath();
      cx.fill();
      cx.fillStyle = "#000";
      cx.fillRect(a.x - 4, a.y - 2, 3, 3);
      cx.fillRect(a.x + 1, a.y - 2, 3, 3);
    } else if (a.t === 1) {
      cx.fillRect(a.x - 10, a.y - 6, 20, 12);
      cx.fillStyle = "#000";
      cx.fillRect(a.x - 6, a.y - 3, 4, 4);
      cx.fillRect(a.x + 2, a.y - 3, 4, 4);
      cx.fillStyle = c;
      const leg = a.f ? 2 : -2;
      cx.fillRect(a.x - 12, a.y + leg, 4, 4);
      cx.fillRect(a.x + 8, a.y + leg, 4, 4);
    } else {
      cx.fillRect(a.x - 12, a.y - 6, 24, 12);
      cx.fillStyle = "#000";
      cx.fillRect(a.x - 8, a.y - 3, 4, 4);
      cx.fillRect(a.x + 4, a.y - 3, 4, 4);
      cx.fillStyle = c;
      const leg = a.f ? 2 : -2;
      cx.fillRect(a.x - 14, a.y + leg, 5, 4);
      cx.fillRect(a.x - 5, a.y + leg, 5, 4);
      cx.fillRect(a.x, a.y + leg, 5, 4);
      cx.fillRect(a.x + 9, a.y + leg, 5, 4);
    }
  }, []);

  const spawnParts = useCallback((x: number, y: number, col: string) => {
    const s = stateRef.current;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      s.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col, life: 25 });
    }
  }, []);

  const hit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
    Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx: CanvasRenderingContext2D = ctx;

    const s = stateRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.type === "keydown") {
        s.keys[e.key] = true;
        if (e.key === " ") { e.preventDefault(); if (s.gs === "idle" || s.gs === "over") startGame(); }
        if (e.key === "p" || e.key === "P") {
          if (s.gs === "playing") { s.gs = "paused"; const pb = document.getElementById("btnPause"); if (pb) pb.textContent = "Resume"; }
          else if (s.gs === "paused") { s.gs = "playing"; const pb = document.getElementById("btnPause"); if (pb) pb.textContent = "Pause"; }
        }
      } else { delete s.keys[e.key]; }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);

    function update() {
      if (s.gs !== "playing") return;
      s.fc++;

      if (s.keys["ArrowLeft"] || s.keys["a"] || s.keys["A"]) s.px = Math.max(18, s.px - 4);
      if (s.keys["ArrowRight"] || s.keys["d"] || s.keys["D"]) s.px = Math.min(W - 18, s.px + 4);

      const now = performance.now();
      if ((s.keys[" "] || s.keys["shoot"]) && now - s.lastShot > 300) {
        s.bullets.push({ x: s.px, y: s.py - 14 });
        s.lastShot = now;
      }

      s.bullets.forEach(b => b.y -= 9);
      s.bullets = s.bullets.filter(b => b.y > 0);
      s.abuls.forEach(b => b.y += 3 + s.level * 0.25);
      s.abuls = s.abuls.filter(b => b.y < H);
      s.parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
      s.parts = s.parts.filter(p => p.life > 0);

      const alive = s.aliens.filter(a => a.alive);
      if (!alive.length) { s.level++; initLevel(); updateHUD(); return; }

      s.atick++;
      const moveEvery = Math.max(3, 18 - s.level * 2 - Math.floor(alive.length / 10));
      if (s.atick >= moveEvery) {
        s.atick = 0;
        alive.forEach(a => a.f = 1 - a.f);
        let wall = false;
        alive.forEach(a => { a.x += s.adir * 12; if (a.x > W - 18 || a.x < 18) wall = true; });
        if (wall) {
          s.adir *= -1;
          alive.forEach(a => { a.x += s.adir * 12; a.y += 14; });
        }
      }

      if (s.fc % Math.max(20, 70 - s.level * 6) === 0 && alive.length) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        s.abuls.push({ x: shooter.x, y: shooter.y + 10 });
      }

      for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        for (let j = s.aliens.length - 1; j >= 0; j--) {
          const a = s.aliens[j];
          if (!a.alive) continue;
          if (hit(b.x, b.y, 4, 10, a.x, a.y, a.w, a.h)) {
            a.alive = false;
            s.bullets.splice(i, 1);
            s.score += (a.t + 1) * 10;
            s.best = Math.max(s.best, s.score);
            spawnParts(a.x, a.y, ALIEN_COLORS[a.t]);
            updateHUD();
            break;
          }
        }
      }

      for (let i = s.abuls.length - 1; i >= 0; i--) {
        const b = s.abuls[i];
        if (hit(b.x, b.y, 4, 10, s.px, s.py, 32, 18)) {
          s.abuls.splice(i, 1);
          spawnParts(s.px, s.py, "#00ccff");
          s.lives--;
          updateHUD();
          if (s.lives <= 0) { s.gs = "over"; updateHUD(); }
        }
      }

      alive.forEach(a => {
        if (a.y + a.h / 2 > s.py - 10) { s.gs = "over"; s.lives = 0; updateHUD(); }
      });
    }

    function draw() {
      cx.fillStyle = "#050510";
      cx.fillRect(0, 0, W, H);

      for (let i = 0; i < 50; i++) {
        cx.globalAlpha = 0.25 + Math.sin(i * 7 + s.fc * 0.02) * 0.15;
        cx.fillStyle = "#ffffff";
        cx.fillRect((i * 173) % W, (i * 97 + s.fc * 0.2) % H, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
      cx.globalAlpha = 1;

      s.aliens.forEach(a => drawAlien(cx, a));

      cx.fillStyle = "#ffff44";
      s.bullets.forEach(b => cx.fillRect(b.x - 2, b.y - 6, 4, 12));
      cx.fillStyle = "#ff4444";
      s.abuls.forEach(b => cx.fillRect(b.x - 2, b.y - 6, 4, 12));

      s.parts.forEach(p => {
        cx.globalAlpha = p.life / 25;
        cx.fillStyle = p.col;
        cx.fillRect(p.x - 2, p.y - 2, 4, 4);
      });
      cx.globalAlpha = 1;

      if (s.gs !== "over") {
        cx.fillStyle = "#00ccff";
        cx.beginPath();
        cx.moveTo(s.px, s.py - 9);
        cx.lineTo(s.px - 16, s.py + 9);
        cx.lineTo(s.px + 16, s.py + 9);
        cx.closePath();
        cx.fill();
        cx.fillStyle = "#007799";
        cx.fillRect(s.px - 4, s.py - 13, 8, 6);
      }

      cx.textAlign = "center";
      if (s.gs === "idle") {
        cx.fillStyle = "rgba(5,5,16,0.85)";
        cx.fillRect(0, 0, W, H);
        cx.fillStyle = "#00ccff";
        cx.font = "bold 30px monospace";
        cx.fillText("SPACE INVADERS", W / 2, H / 2 - 30);
        cx.fillStyle = "#aaaaaa";
        cx.font = "14px monospace";
        cx.fillText("Press Start or Space", W / 2, H / 2 + 10);
        cx.fillText("Arrow keys + Space to play", W / 2, H / 2 + 34);
      }
      if (s.gs === "over") {
        cx.fillStyle = "rgba(5,5,16,0.85)";
        cx.fillRect(0, 0, W, H);
        cx.fillStyle = "#ff4444";
        cx.font = "bold 28px monospace";
        cx.fillText("GAME OVER", W / 2, H / 2 - 24);
        cx.fillStyle = "#aaaaaa";
        cx.font = "14px monospace";
        cx.fillText(`Score: ${s.score}  Best: ${s.best}`, W / 2, H / 2 + 12);
        cx.fillText("Press Start to play again", W / 2, H / 2 + 38);
      }
      if (s.gs === "paused") {
        cx.fillStyle = "rgba(5,5,16,0.75)";
        cx.fillRect(0, 0, W, H);
        cx.fillStyle = "#ffaa00";
        cx.font = "bold 26px monospace";
        cx.fillText("PAUSED", W / 2, H / 2);
      }
    }

    function loop() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, [drawAlien, initLevel, spawnParts, startGame, updateHUD]);

  const handleMobile = (key: string, down: boolean) => {
    if (down) stateRef.current.keys[key] = true;
    else delete stateRef.current.keys[key];
  };

  const togglePause = () => {
    const s = stateRef.current;
    const pb = document.getElementById("btnPause");
    if (s.gs === "playing") { s.gs = "paused"; if (pb) pb.textContent = "Resume"; }
    else if (s.gs === "paused") { s.gs = "playing"; if (pb) pb.textContent = "Pause"; }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 select-none">
      <div className="flex justify-between w-[480px] text-sm font-mono text-gray-400">
        <span>SCORE: <b id="sc" className="text-white">0</b></span>
        <span>LEVEL: <b id="lv" className="text-white">1</b></span>
        <span>LIVES: <b id="li" className="text-white">♥♥♥</b></span>
        <span>BEST: <b id="hi" className="text-white">0</b></span>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="border border-gray-700 rounded-lg"
        style={{ background: "#050510" }}
      />

      <div className="flex gap-3">
        <button
          onClick={startGame}
          className="px-5 py-2 font-mono text-sm border border-gray-600 rounded text-gray-200 hover:border-cyan-500 hover:text-cyan-400 transition-colors bg-transparent"
        >
          Start
        </button>
        <button
          id="btnPause"
          onClick={togglePause}
          disabled
          className="px-5 py-2 font-mono text-sm border border-gray-600 rounded text-gray-200 hover:border-yellow-500 hover:text-yellow-400 transition-colors bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Pause
        </button>
      </div>

      <p className="text-xs font-mono text-gray-500">
        ← → move &nbsp;|&nbsp; Space fire &nbsp;|&nbsp; P pause
      </p>

      <div className="flex gap-4 mt-1">
        {[
          { label: "←", key: "ArrowLeft" },
          { label: "●", key: "shoot" },
          { label: "→", key: "ArrowRight" },
        ].map(({ label, key }) => (
          <button
            key={key}
            onPointerDown={() => handleMobile(key, true)}
            onPointerUp={() => handleMobile(key, false)}
            onPointerLeave={() => handleMobile(key, false)}
            className="w-14 h-12 font-mono text-xl border border-gray-600 rounded text-gray-300 active:bg-gray-800 bg-transparent touch-none"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
