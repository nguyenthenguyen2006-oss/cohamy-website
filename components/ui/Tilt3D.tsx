"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface Tilt3DProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  intensity?: number;
  scale?: number;
  glare?: boolean;
  lift?: boolean;
}

export function Tilt3D({
  children,
  className,
  innerClassName,
  intensity = 10,
  scale = 1.02,
  glare = true,
  lift = true,
}: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const isHovering = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]), {
    stiffness: 260,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]), {
    stiffness: 260,
    damping: 22,
  });
  const scaleValue = useSpring(useTransform(isHovering, [0, 1], [1, scale]), {
    stiffness: 260,
    damping: 22,
  });
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);
  const glareOpacity = useSpring(useTransform(isHovering, [0, 1], [0, 0.45]), {
    stiffness: 200,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseEnter = () => isHovering.set(1);
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    isHovering.set(0);
  };

  if (prefersReducedMotion) {
    return (
      <div className={cn(lift && "card-3d-lift", className)}>
        <div className={innerClassName}>{children}</div>
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale: scaleValue,
        transformPerspective: 1100,
        transformStyle: "preserve-3d",
      }}
      className={cn("relative", lift && "will-change-transform", className)}
    >
      {glare ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
          style={{ opacity: glareOpacity }}
        >
          <motion.div
            className="absolute h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white/70 via-white/10 to-transparent blur-md"
            style={{ left: glareX, top: glareY }}
          />
        </motion.div>
      ) : null}
      <div
        className={cn("relative h-full", innerClassName)}
        style={{ transform: "translateZ(20px)" }}
      >
        {children}
      </div>
    </motion.div>
  );
}