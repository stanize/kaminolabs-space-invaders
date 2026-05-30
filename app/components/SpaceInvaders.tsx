"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const W = 480;
const H = 460;
const ALIEN_COLORS = ["#ff4444", "#ffaa00", "#44ff99"];

const isMobile = () => window.matchMedia("(pointer: coarse)").matches;

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

// ── Audio ─────────────────────────────────────────────────────────────────────

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const musicRef = useRef<{ stop(): void; pause(): void; resume(): void } | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = mutedRef.current ? 0 : 1;
      masterRef.current.connect(ctxRef.current.destination);
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    return { ctx, master: masterRef.current! };
  }, []);

  const playShoot = useCallback(() => {
    const { ctx, master } = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.09);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + 0.1);
  }, [getCtx]);

  const playAlienExplosion = useCallback(() => {
    const { ctx, master } = getCtx();
    const t = ctx.currentTime;
    const dur = 0.18;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.value = 600; filt.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(gain); gain.connect(master);
    src.start(t); src.stop(t + dur);
  }, [getCtx]);

  const playPlayerHit = useCallback(() => {
    const { ctx, master } = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    og.gain.setValueAtTime(0.55, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(og); og.connect(master);
    osc.start(t); osc.stop(t + 0.35);
    const ndur = 0.12;
    const nbuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * ndur), ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource();
    ns.buffer = nbuf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + ndur);
    ns.connect(ng); ng.connect(master);
    ns.start(t); ns.stop(t + ndur);
  }, [getCtx]);

  const playLevelUp = useCallback(() => {
    const { ctx, master } = getCtx();
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const st = t + i * 0.13;
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(0.3, st + 0.02);
      gain.gain.setValueAtTime(0.3, st + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.17);
      osc.connect(gain); gain.connect(master);
      osc.start(st); osc.stop(st + 0.17);
    });
  }, [getCtx]);

  const playGameOver = useCallback(() => {
    const { ctx, master } = getCtx();
    const t = ctx.currentTime;
    [440, 370, 330, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const st = t + i * 0.23;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, st);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.82, st + 0.26);
      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.27);
      osc.connect(gain); gain.connect(master);
      osc.start(st); osc.stop(st + 0.27);
    });
  }, [getCtx]);

  const startMusic = useCallback(() => {
    const { ctx, master } = getCtx();
    if (musicRef.current) musicRef.current.stop();

    // Shared gate — ramp to 0 on pause, back to 1 on resume
    const musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(master);

    let stopped = false;
    let paused = false;

    // ── Layer 1: Bass Drone ──────────────────────────────────────────────────
    // 55 Hz sine, LFO at 0.1 Hz slowly bends pitch ±5 Hz (50–60 Hz)
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.04;
    bassGain.connect(musicGain);

    const bassOsc = ctx.createOscillator();
    bassOsc.type = "sine";
    bassOsc.frequency.value = 55;
    bassOsc.connect(bassGain);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1;
    const lfoAmp = ctx.createGain();
    lfoAmp.gain.value = 5;          // ±5 Hz around 55 Hz
    lfo.connect(lfoAmp);
    lfoAmp.connect(bassOsc.frequency);

    bassOsc.start();
    lfo.start();

    // ── Layer 2: Arpeggio ────────────────────────────────────────────────────
    // Square wave stepping A2 → C3 → E3 → G3 every 200 ms
    const arpGain = ctx.createGain();
    arpGain.gain.value = 0.03;
    arpGain.connect(musicGain);

    const ARP_NOTES = [110, 130, 165, 196];
    let arpIdx = 0;
    let arpNext = ctx.currentTime + 0.05;
    let arpTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleArp() {
      if (stopped || paused) return;
      while (arpNext < ctx.currentTime + 0.4) {
        const freq = ARP_NOTES[arpIdx % ARP_NOTES.length];
        const t = arpNext;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.005);   // 5 ms attack
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.155); // 150 ms decay
        osc.connect(env);
        env.connect(arpGain);
        osc.start(t);
        osc.stop(t + 0.16);
        arpNext += 0.20;
        arpIdx++;
      }
      arpTimer = setTimeout(scheduleArp, 50);
    }
    scheduleArp();

    // ── Layer 3: Space Pad ───────────────────────────────────────────────────
    // Two sawtooth oscs at 220/221 Hz (shimmer), lowpass filter sweeps 300–1200 Hz / 4 s
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 300;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.02;
    padFilter.connect(padGain);
    padGain.connect(musicGain);

    const padOsc1 = ctx.createOscillator();
    padOsc1.type = "sawtooth";
    padOsc1.frequency.value = 220;
    padOsc1.connect(padFilter);

    const padOsc2 = ctx.createOscillator();
    padOsc2.type = "sawtooth";
    padOsc2.frequency.value = 221;
    padOsc2.connect(padFilter);

    padOsc1.start();
    padOsc2.start();

    let sweepTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleSweep() {
      if (stopped) return;
      const t = ctx.currentTime;
      padFilter.frequency.cancelScheduledValues(t);
      padFilter.frequency.setValueAtTime(300, t);
      padFilter.frequency.linearRampToValueAtTime(1200, t + 4);
      padFilter.frequency.linearRampToValueAtTime(300, t + 8);
      sweepTimer = setTimeout(scheduleSweep, 8000);
    }
    scheduleSweep();

    // ── Layer 4: Random Bleeps ───────────────────────────────────────────────
    // Triangle wave, 800–1600 Hz, fires every 2–4 s, 80 ms duration
    const bleepGain = ctx.createGain();
    bleepGain.gain.value = 0.03;
    bleepGain.connect(musicGain);

    let bleepTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleBleep() {
      if (stopped || paused) return;
      bleepTimer = setTimeout(() => {
        if (stopped || paused) return;
        const freq = 800 + Math.random() * 800;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(env);
        env.connect(bleepGain);
        osc.start(t);
        osc.stop(t + 0.08);
        scheduleBleep();
      }, 2000 + Math.random() * 2000);
    }
    scheduleBleep();

    // ── Controls ─────────────────────────────────────────────────────────────
    musicRef.current = {
      stop() {
        stopped = true;
        if (arpTimer) clearTimeout(arpTimer);
        if (sweepTimer) clearTimeout(sweepTimer);
        if (bleepTimer) clearTimeout(bleepTimer);
        bassOsc.stop(); lfo.stop();
        padOsc1.stop(); padOsc2.stop();
      },
      pause() {
        paused = true;
        if (arpTimer) clearTimeout(arpTimer);
        if (bleepTimer) clearTimeout(bleepTimer);
        musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      },
      resume() {
        paused = false;
        musicGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
        arpNext = ctx.currentTime + 0.05;
        scheduleArp();
        scheduleBleep();
        scheduleSweep();
      },
    };
  }, [getCtx]);

  const stopMusic = useCallback(() => {
    musicRef.current?.stop();
    musicRef.current = null;
  }, []);

  const pauseMusic = useCallback(() => {
    musicRef.current?.pause();
  }, []);

  const resumeMusic = useCallback(() => {
    if (!musicRef.current) return;
    const { ctx } = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    musicRef.current.resume();
  }, [getCtx]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (masterRef.current) masterRef.current.gain.value = mutedRef.current ? 0 : 1;
  }, []);

  return {
    playShoot, playAlienExplosion, playPlayerHit,
    playLevelUp, playGameOver,
    startMusic, stopMusic, pauseMusic, resumeMusic,
    muted, toggleMute,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

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

  const audio = useAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;

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
    audioRef.current.startMusic();
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

  // Prevent page scroll/zoom while touching the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener("touchstart", prevent, { passive: false });
    canvas.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", prevent);
      canvas.removeEventListener("touchmove", prevent);
    };
  }, []);

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
          if (s.gs === "playing") {
            s.gs = "paused";
            const pb = document.getElementById("btnPause"); if (pb) pb.textContent = "Resume";
            audioRef.current.pauseMusic();
          } else if (s.gs === "paused") {
            s.gs = "playing";
            const pb = document.getElementById("btnPause"); if (pb) pb.textContent = "Pause";
            audioRef.current.resumeMusic();
          }
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
      const fireRate = s.keys["boost"] ? 150 : 300;
      if ((s.keys[" "] || s.keys["shoot"] || isMobile()) && now - s.lastShot > fireRate) {
        s.bullets.push({ x: s.px, y: s.py - 14 });
        s.lastShot = now;
        audioRef.current.playShoot();
      }

      s.bullets.forEach(b => b.y -= 9);
      s.bullets = s.bullets.filter(b => b.y > 0);
      s.abuls.forEach(b => b.y += 3 + s.level * 0.25);
      s.abuls = s.abuls.filter(b => b.y < H);
      s.parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
      s.parts = s.parts.filter(p => p.life > 0);

      const alive = s.aliens.filter(a => a.alive);
      if (!alive.length) {
        s.level++;
        audioRef.current.playLevelUp();
        initLevel(); updateHUD();
        return;
      }

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
            audioRef.current.playAlienExplosion();
            updateHUD();
            break;
          }
        }
      }

      let triggeredGameOver = false;

      for (let i = s.abuls.length - 1; i >= 0; i--) {
        const b = s.abuls[i];
        if (hit(b.x, b.y, 4, 10, s.px, s.py, 32, 18)) {
          s.abuls.splice(i, 1);
          spawnParts(s.px, s.py, "#00ccff");
          s.lives--;
          audioRef.current.playPlayerHit();
          updateHUD();
          if (s.lives <= 0 && !triggeredGameOver) {
            triggeredGameOver = true;
            s.gs = "over";
            audioRef.current.playGameOver();
            audioRef.current.stopMusic();
            updateHUD();
          }
        }
      }

      alive.forEach(a => {
        if (a.y + a.h / 2 > s.py - 10 && !triggeredGameOver) {
          triggeredGameOver = true;
          s.gs = "over"; s.lives = 0;
          audioRef.current.playGameOver();
          audioRef.current.stopMusic();
          updateHUD();
        }
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
      audioRef.current.stopMusic();
    };
  }, [drawAlien, initLevel, spawnParts, startGame, updateHUD]);

  const handleMobile = (key: string, down: boolean) => {
    if (down) stateRef.current.keys[key] = true;
    else delete stateRef.current.keys[key];
  };

  const togglePause = () => {
    const s = stateRef.current;
    const pb = document.getElementById("btnPause");
    if (s.gs === "playing") {
      s.gs = "paused";
      if (pb) pb.textContent = "Resume";
      audioRef.current.pauseMusic();
    } else if (s.gs === "paused") {
      s.gs = "playing";
      if (pb) pb.textContent = "Pause";
      audioRef.current.resumeMusic();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-3 select-none">

      {/* HUD — stretches to canvas width on all screen sizes */}
      <div className="flex justify-between w-full max-w-[480px] text-sm font-mono text-gray-400">
        <span>SCORE: <b id="sc" className="text-white">0</b></span>
        <span>LEVEL: <b id="lv" className="text-white">1</b></span>
        <span>LIVES: <b id="li" className="text-white">♥♥♥</b></span>
        <span>BEST: <b id="hi" className="text-white">0</b></span>
      </div>

      {/* Canvas — intrinsic resolution 480×460, CSS scales it to fit the screen */}
      <div className="w-full max-w-[480px]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="border border-gray-700 rounded-lg"
          style={{ width: "100%", height: "auto", display: "block", background: "#050510" }}
        />
      </div>

      {/* System buttons */}
      <div className="flex gap-3">
        <button
          onClick={startGame}
          className="px-5 py-2 min-h-[44px] font-mono text-sm border border-gray-600 rounded text-gray-200 hover:border-cyan-500 hover:text-cyan-400 transition-colors bg-transparent"
        >
          Start
        </button>
        <button
          id="btnPause"
          onClick={togglePause}
          disabled
          className="px-5 py-2 min-h-[44px] font-mono text-sm border border-gray-600 rounded text-gray-200 hover:border-yellow-500 hover:text-yellow-400 transition-colors bg-transparent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Pause
        </button>
        <button
          onClick={audio.toggleMute}
          className="px-5 py-2 min-h-[44px] font-mono text-sm border border-gray-600 rounded text-gray-200 hover:border-purple-500 hover:text-purple-400 transition-colors bg-transparent"
          title={audio.muted ? "Unmute" : "Mute"}
        >
          {audio.muted ? "🔇" : "🔊"}
        </button>
      </div>

      <p className="text-xs font-mono text-gray-500">
        ← → move &nbsp;|&nbsp; Space fire &nbsp;|&nbsp; P pause
      </p>

      {/* D-pad touch controls — auto-fire active, just steer */}
      <div
        className="flex sm:hidden w-full max-w-[480px] gap-2"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        <button
          onPointerDown={() => handleMobile("ArrowLeft", true)}
          onPointerUp={() => handleMobile("ArrowLeft", false)}
          onPointerLeave={() => handleMobile("ArrowLeft", false)}
          className="w-1/2 min-h-[80px] font-mono text-xl border border-gray-600 rounded-lg text-gray-300 active:bg-gray-800 bg-transparent"
          style={{ touchAction: "none" }}
        >
          ◀ LEFT
        </button>
        <button
          onPointerDown={() => handleMobile("ArrowRight", true)}
          onPointerUp={() => handleMobile("ArrowRight", false)}
          onPointerLeave={() => handleMobile("ArrowRight", false)}
          className="w-1/2 min-h-[80px] font-mono text-xl border border-gray-600 rounded-lg text-gray-300 active:bg-gray-800 bg-transparent"
          style={{ touchAction: "none" }}
        >
          RIGHT ▶
        </button>
      </div>
    </div>
  );
}
