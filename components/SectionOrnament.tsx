import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionOrnamentProps {
  children: ReactNode;
  className?: string;
  variant?: "light" | "dark" | "cream";
}

const cornerColors = {
  light: "border-[#D9A441]/35",
  dark: "border-[#D9A441]/50",
  cream: "border-[#4A2418]/15",
};

export function SectionOrnament({
  children,
  className,
  variant = "light",
}: SectionOrnamentProps) {
  const color = cornerColors[variant];

  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-4 top-4 h-10 w-10 border-l-2 border-t-2 md:left-8 md:top-8 md:h-14 md:w-14",
          color,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-4 right-4 h-10 w-10 border-b-2 border-r-2 md:bottom-8 md:right-8 md:h-14 md:w-14",
          color,
        )}
      />
      {children}
    </div>
  );
}