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
    const particles: Particle[] = []; let frame=0, width=0, height=0;
    const resize=()=> {
      const bounds=canvas.getBoundingClientRect(); const ratio=Math.min(window.devicePixelRatio || 1,2);
      width=Math.max(1,bounds.width); height=Math.max(1,bounds.height);
      canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio); context.setTransform(ratio,0,0,ratio,0,0);
      particles.length=0;
      for(let i=0, n=Math.min(80,Math.max(34,Math.round(width*height/14500)));i<n;i++) particles.push({x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.46,vy:(Math.random()-.5)*.46,radius:1+Math.random()*1.7});
    };
    const draw=()=> {
      context.clearRect(0,0,width,height);
      for(const [index,left] of particles.entries()) {
        if(!media.matches) {left.x+=left.vx;left.y+=left.vy;if(left.x<0||left.x>width)left.vx*=-1;if(left.y<0||left.y>height)left.vy*=-1;}
        context.beginPath();context.arc(left.x,left.y,left.radius,0,Math.PI*2);context.fillStyle=`rgba(${tone==="orange"?"249, 115, 22":"255, 255, 255"}, 0.24)`;context.fill();
        for(let j=index+1;j<particles.length;j++) {const right=particles[j];const distance=Math.hypot(left.x-right.x,left.y-right.y);if(distance>150)continue;context.beginPath();context.moveTo(left.x,left.y);context.lineTo(right.x,right.y);context.strokeStyle=`rgba(255,255,255,${.11*(1-distance/150)})`;context.lineWidth=1;context.stroke();}
      }
      if(!media.matches && !document.hidden) frame=requestAnimationFrame(draw);
    };
    const restart=()=>{cancelAnimationFrame(frame);frame=0;draw();};
    const observer=new ResizeObserver(()=>{resize();if(media.matches)draw();});observer.observe(canvas);resize();draw();
    media.addEventListener("change",restart);document.addEventListener("visibilitychange",restart);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);media.removeEventListener("change",restart);document.removeEventListener("visibilitychange",restart);};
  },[tone]);
  return <canvas aria-hidden className="particle-network" ref={canvasRef}/>;
}
