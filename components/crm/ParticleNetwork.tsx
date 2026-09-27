"use client";
import { useEffect, useRef } from "react";
interface Particle { x: number; y: number; vx: number; vy: number; radius: number }
// HumanBank particle-network.tsx: same density, speed, connection distance and tones.
export function ParticleNetwork({ tone = "white" }: { tone?: "orange" | "white" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext("2d"); if (!context) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles: Particle[] = [];
    let frame = 0, currentW = 0, currentH = 0, currentRatio = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      const bounds = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(bounds.width));
      const h = Math.max(1, Math.round(bounds.height));
      if (w === currentW && h === currentH && ratio === currentRatio) return;
      currentW = w;
      currentH = h;
      currentRatio = ratio;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles.length = 0;
      for (let i = 0, n = Math.min(80, Math.max(34, Math.round(w * h / 14500))); i < n; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - .5) * .46,
          vy: (Math.random() - .5) * .46,
          radius: 1 + Math.random() * 1.7
        });
      }
    };
    const draw = () => {
      context.clearRect(0, 0, currentW, currentH);
      for (const [index, left] of particles.entries()) {
        if (!media.matches) {
          left.x += left.vx; left.y += left.vy;
          if (left.x < 0 || left.x > currentW) left.vx *= -1;
          if (left.y < 0 || left.y > currentH) left.vy *= -1;
        }
        context.beginPath();
        context.arc(left.x, left.y, left.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${tone === "orange" ? "249, 115, 22" : "255, 255, 255"}, 0.24)`;
        context.fill();
        for (let j = index + 1; j < particles.length; j++) {
          const right = particles[j];
          const distance = Math.hypot(left.x - right.x, left.y - right.y);
          if (distance > 150) continue;
          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.strokeStyle = `rgba(255,255,255,${.11 * (1 - distance / 150)})`;
          context.lineWidth = 1;
          context.stroke();
        }
      }
      if (!media.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); frame = 0; draw(); };
    const targetToObserve = canvas.parentElement || canvas;
    const observer = new ResizeObserver(() => { resize(); if (media.matches) draw(); });
    observer.observe(targetToObserve);
    resize();
    draw();
    media.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      media.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [tone]);
  return (
    <canvas
      aria-hidden
      className="particle-network"
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
