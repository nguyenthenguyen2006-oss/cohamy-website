"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type OrbVariant = "cream" | "gold" | "chocolate" | "mixed";

interface DecorativeOrbsProps {
  variant?: OrbVariant;
  className?: string;
  density?: "light" | "medium" | "rich";
}

const orbSets: Record<OrbVariant, string[]> = {
  cream: ["bg-[#FAF6EF]/80", "bg-[#FFF4D8]/60"],
  gold: ["bg-[#D9A441]/15", "bg-[#D9A441]/8"],
  chocolate: ["bg-[#4A2418]/8", "bg-[#2A120C]/6"],
  mixed: ["bg-[#D9A441]/12", "bg-[#4A2418]/6", "bg-[#FFF4D8]/50"],
};

export function DecorativeOrbs({
  variant = "mixed",
  className,
  density = "medium",
}: DecorativeOrbsProps) {
  const prefersReducedMotion = useReducedMotion();
  const colors = orbSets[variant];
  const count = density === "light" ? 2 : density === "rich" ? 5 : 3;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute rounded-full blur-3xl",
            colors[i % colors.length],
          )}
          style={{
            width: `${180 + i * 80}px`,
            height: `${180 + i * 80}px`,
            top: `${10 + i * 18}%`,
            left: i % 2 === 0 ? `${-8 + i * 5}%` : `${55 + i * 8}%`,
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [0, i % 2 === 0 ? -18 : 14, 0],
                  x: [0, i % 2 === 0 ? 12 : -10, 0],
                  scale: [1, 1.06, 1],
                }
          }
          transition={{
            duration: 7 + i * 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      <div className="grain-overlay absolute inset-0 opacity-[0.35]" />
    </div>
  );
}